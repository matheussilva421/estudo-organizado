import {
  LOCAL_STATE_CURRENT_KEY,
  LOCAL_STATE_LEGACY_KEY,
  LOCAL_STATE_PREVIOUS_KEY,
  RETA_FINAL_DRAFT_STORE,
  RETA_FINAL_JOURNAL_STORE,
  STORE_NAME,
} from './indexeddb.js';
import {
  createLocalStateEnvelope,
  isLocalStateEnvelopeValid,
  pickRecoverableLocalState,
  stableStringify,
} from './normalize-state.js';
import { validateRetaFinalDraft } from '../logic/reta-final-drafts.js';
import { projectRetaFinalSchedule } from '../logic/reta-final-schedule.js';
import { rebuildRetaFinalAutoEvents } from '../logic/reta-final-events.js';
import { buildRetaFinalEventTitle } from '../logic/reta-final-core.js';

const clone = (value) => structuredClone(value);

function codedError(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

function requestError(request) {
  return request?.error || new Error('Falha ao ler estado local da Reta Final.');
}

function uniqueOperationIds(operations) {
  const ids = [];
  const seen = new Set();
  for (const operation of Array.isArray(operations) ? operations : []) {
    const id = operation?.operationId;
    if (typeof id === 'string' && id.trim() && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function assertOperationIdsAvailable(journalRecords, draftId, operationIds) {
  const committedBy = new Map();
  for (const record of Array.isArray(journalRecords) ? journalRecords : []) {
    if (record?.type !== 'sync_intent' || !Array.isArray(record.operationIds)) continue;
    for (const operationId of record.operationIds) {
      if (typeof operationId === 'string' && operationId && !committedBy.has(operationId)) {
        committedBy.set(operationId, record.draftId ?? null);
      }
    }
  }
  for (const operationId of operationIds) {
    if (committedBy.has(operationId) && committedBy.get(operationId) !== draftId) {
      throw codedError(
        'RETA_FINAL_CONFLICT',
        'operationId já foi utilizado por outro commit da Reta Final.',
        { operationId },
      );
    }
  }
}

function recoverStateFromReads(reads) {
  const recovered = pickRecoverableLocalState({
    current: requestResult(reads.current),
    previous: requestResult(reads.previous),
    legacy: requestResult(reads.legacy),
  });
  if (!recovered.state) {
    throw codedError('RETA_FINAL_CONFLICT', 'Estado local persistido indisponível para recuperação.');
  }
  return recovered.state;
}

function listCatalogIds(editais) {
  const ids = new Set();
  for (const edital of Array.isArray(editais) ? editais : []) {
    if (typeof edital?.id === 'string') ids.add(edital.id);
    for (const discipline of Array.isArray(edital?.disciplinas) ? edital.disciplinas : []) {
      if (typeof discipline?.id === 'string') ids.add(discipline.id);
      for (const collection of ['assuntos', 'aulas']) {
        for (const entity of Array.isArray(discipline?.[collection]) ? discipline[collection] : []) {
          if (typeof entity?.id === 'string') ids.add(entity.id);
        }
      }
    }
  }
  return ids;
}

function materializeCatalogIntents(editais, intents) {
  const catalog = clone(Array.isArray(editais) ? editais : []);
  const allIds = listCatalogIds(catalog);
  const seen = new Set();
  const collectionByEntity = { assunto: 'assuntos', aula: 'aulas' };
  for (const intent of intents) {
    const collection = collectionByEntity[intent?.entity];
    if (
      !collection ||
      typeof intent.id !== 'string' || !intent.id.trim() ||
      typeof intent.discId !== 'string' || !intent.discId.trim() ||
      typeof intent.nome !== 'string' || !intent.nome.trim() ||
      seen.has(intent.id)
    ) {
      throw codedError('RETA_FINAL_CONFLICT', 'Intenção de catálogo inválida ou ambígua.');
    }
    seen.add(intent.id);
    const matches = [];
    for (const edital of catalog) {
      for (const discipline of Array.isArray(edital?.disciplinas) ? edital.disciplinas : []) {
        if (discipline?.id === intent.discId) matches.push(discipline);
      }
    }
    if (matches.length !== 1) {
      throw codedError('RETA_FINAL_CONFLICT', 'A disciplina da intenção de catálogo não é única.');
    }
    if (allIds.has(intent.id)) {
      const existing = (matches[0][collection] || []).filter((item) => item?.id === intent.id);
      if (existing.length === 1 && existing[0].nome === intent.nome) continue;
      throw codedError('RETA_FINAL_CONFLICT', 'O id da intenção de catálogo já está ocupado.');
    }
    matches[0][collection] = Array.isArray(matches[0][collection]) ? matches[0][collection] : [];
    matches[0][collection].push({ id: intent.id, nome: intent.nome });
    allIds.add(intent.id);
  }
  return catalog;
}

function eventTitle(block, editais) {
  let discipline = null;
  for (const edital of Array.isArray(editais) ? editais : []) {
    discipline = (Array.isArray(edital?.disciplinas) ? edital.disciplinas : []).find(
      (item) => item?.id === block.discId,
    ) || discipline;
  }
  return buildRetaFinalEventTitle(block, discipline);
}

function createEventId(context, usedIds) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const value = typeof context.makeId === 'function'
      ? context.makeId()
      : globalThis.crypto?.randomUUID?.() || `rf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const id = 'autorf_' + value;
    if (typeof value === 'string' && value.trim() && !usedIds.has(id)) {
      usedIds.add(id);
      return value;
    }
  }
  return null;
}

function buildCommittedSnapshot(sourceState, draft, context) {
  const plan = sourceState.planejamento;
  const catalogIntents = draft.catalogIntents ?? context.catalogIntents ?? [];
  if (!Array.isArray(catalogIntents)) {
    throw codedError('RETA_FINAL_CONFLICT', 'Intenções de catálogo devem ser uma lista.');
  }
  const editais = materializeCatalogIntents(sourceState.editais, catalogIntents);
  const validation = validateRetaFinalDraft(draft, plan, {
    ...context,
    events: sourceState.eventos || [],
    catalog: editais,
    catalogIntents,
    activeTimerIds: context.activeTimerIds || [],
  });
  if (validation.status !== 'ready') {
    const stale = validation.status === 'stale';
    throw codedError(
      stale ? 'RETA_FINAL_STALE' : 'RETA_FINAL_CONFLICT',
      validation.errors?.[0]?.message || 'Rascunho não pode ser aplicado ao plano persistido.',
      { validation },
    );
  }

  const now = typeof context.now === 'string' && context.now
    ? context.now
    : new Date().toISOString();
  const nextPlan = clone(draft.snapshot);
  nextPlan.planId = plan.planId;
  nextPlan.revision = plan.revision + 1;
  nextPlan.updatedAt = now;

  const occupied = new Set();
  const completed = new Set();
  for (const event of sourceState.eventos || []) {
    if (!event?.rfBlocoId) continue;
    if (event.status === 'estudei' || Number(event.tempoAcumulado) > 0) occupied.add(event.rfBlocoId);
    if (event.status === 'estudei') completed.add(event.rfBlocoId);
  }
  const projection = projectRetaFinalSchedule(nextPlan, {
    today: context.today,
    occupiedBlocoIds: occupied,
    completedBlocoIds: completed,
  });
  const byBlockId = new Map(projection.blocos.map((block) => [block.id, block]));
  nextPlan.retaFinal.blocos = nextPlan.retaFinal.blocos.map((block) => {
    const projected = byBlockId.get(block.id);
    if (!projected || block.arquivado === true) return block;
    return {
      ...block,
      data: projected.dataEfetiva || block.data,
      status: projected.status,
    };
  });
  const projectedPlan = {
    ...nextPlan,
    retaFinal: { ...nextPlan.retaFinal, blocos: projection.blocos },
  };
  const usedEventIds = new Set((sourceState.eventos || []).map((event) => event?.id).filter(Boolean));
  const rebuilt = rebuildRetaFinalAutoEvents(projectedPlan, sourceState.eventos || [], {
    today: context.today,
    makeId: () => createEventId(context, usedEventIds),
  });
  const createdEventIds = new Set(rebuilt.diagnostics.created.map((item) => item.eventId));
  const events = rebuilt.events.map((event) => {
    if (!createdEventIds.has(event?.id)) return event;
    const block = byBlockId.get(event.rfBlocoId);
    if (!block) return event;
    return { ...event, titulo: eventTitle(block, editais), criadoEm: now };
  });
  const finalPlan = { ...nextPlan };
  return {
    ...clone(sourceState),
    editais,
    planejamento: finalPlan,
    eventos: events,
  };
}

function resultFor(plan, draftId) {
  return { plan: clone(plan), revision: plan.revision, localCommitted: true, syncPending: true, commitId: draftId };
}

/** Atomically commits the editor draft to the official local state and journal. */
export function commitRetaFinalDraft({
  db,
  draftId,
  expectedPlanId,
  expectedRevision,
  context = {},
}) {
  if (!db || typeof db.transaction !== 'function') {
    return Promise.reject(new TypeError('Instância IndexedDB indisponível.'));
  }
  if (typeof draftId !== 'string' || !draftId.trim()) {
    return Promise.reject(new TypeError('draftId inválido.'));
  }
  if (typeof expectedPlanId !== 'string' || !expectedPlanId.trim() || !Number.isSafeInteger(expectedRevision)) {
    return Promise.reject(new TypeError('Identidade ou revisão esperada inválida.'));
  }

  return new Promise((resolve, reject) => {
    let transaction;
    let plannedError = null;
    let nextState = null;
    let commitResult = null;
    let settled = false;
    const settleError = (error) => {
      if (settled) return;
      settled = true;
      reject(error || new Error('Transação local da Reta Final falhou.'));
    };
    try {
      transaction = db.transaction(
        [STORE_NAME, RETA_FINAL_DRAFT_STORE, RETA_FINAL_JOURNAL_STORE],
        'readwrite',
      );
      transaction.oncomplete = () => {
        if (settled) return;
        if (plannedError) {
          settleError(plannedError);
          return;
        }
        settled = true;
        try {
          context.onCommitted?.(clone(nextState), clone(commitResult));
        } catch (error) {
          console.error('Reta Final: commit durável; falha ao publicar estado em memória.', error);
        }
        resolve(clone(commitResult));
      };
      transaction.onerror = (event) => {
        if (!plannedError) plannedError = event?.target?.error || transaction.error;
      };
      transaction.onabort = (event) => {
        settleError(plannedError || event?.target?.error || transaction.error);
      };

      const appStore = transaction.objectStore(STORE_NAME);
      const draftStore = transaction.objectStore(RETA_FINAL_DRAFT_STORE);
      const journalStore = transaction.objectStore(RETA_FINAL_JOURNAL_STORE);
      const reads = {
        current: appStore.get(LOCAL_STATE_CURRENT_KEY),
        previous: appStore.get(LOCAL_STATE_PREVIOUS_KEY),
        legacy: appStore.get(LOCAL_STATE_LEGACY_KEY),
        draft: draftStore.get(draftId),
        journal: journalStore.getAll(),
      };
      const completedReads = new Set();
      const abortForError = (error) => {
        plannedError = error;
        try { transaction.abort(); } catch { settleError(plannedError); }
      };
      const failForRequest = (request) => abortForError(requestError(request));
      for (const [key, request] of Object.entries(reads)) {
        request.onerror = () => failForRequest(request);
        request.onsuccess = () => {
          completedReads.add(key);
          if (completedReads.size !== Object.keys(reads).length || plannedError) return;
          try {
            const draft = requestResult(reads.draft);
            if (!draft) throw codedError('RETA_FINAL_CONFLICT', 'Rascunho não encontrado.');
            if (draft.planId !== expectedPlanId || draft.baseRevision !== expectedRevision) {
              throw codedError('RETA_FINAL_CONFLICT', 'Identidade ou revisão-base não corresponde ao rascunho.');
            }
            if (draft.state === 'applied') {
              if (
                draft.appliedCommitId !== draftId ||
                draft.appliedBaseRevision !== expectedRevision ||
                draft.appliedPlanId !== expectedPlanId ||
                !draft.appliedResult?.plan
              ) {
                throw codedError('RETA_FINAL_CONFLICT', 'Registro de commit aplicado está inconsistente.');
              }
              const replayState = recoverStateFromReads(reads);
              if (replayState.planejamento?.planId !== expectedPlanId) {
                throw codedError('RETA_FINAL_CONFLICT', 'O estado recuperado não pertence ao plano do commit.');
              }
              nextState = clone(replayState);
              commitResult = clone(draft.appliedResult);
              return;
            }
            if (draft.state !== 'editing') {
              throw codedError('RETA_FINAL_CONFLICT', 'O rascunho não está em edição.');
            }

            const state = recoverStateFromReads(reads);
            const currentPlan = state.planejamento;
            if (!currentPlan || currentPlan.planId !== expectedPlanId) {
              throw codedError('RETA_FINAL_CONFLICT', 'A identidade do plano persistido mudou.');
            }
            if (currentPlan.revision !== expectedRevision) {
              throw codedError('RETA_FINAL_STALE', 'A revisão do plano mudou desde a criação do rascunho.');
            }
            if (context.expectedDigest && context.expectedDigest !== draft.baseDigest) {
              throw codedError('RETA_FINAL_STALE', 'O digest esperado não corresponde à base do rascunho.');
            }
            if (stableStringify(currentPlan) !== stableStringify(draft.baseSnapshot)) {
              throw codedError('RETA_FINAL_STALE', 'O conteúdo do plano mudou desde a criação do rascunho.');
            }

            const operationIds = uniqueOperationIds(draft.operations);
            assertOperationIdsAvailable(requestResult(reads.journal), draftId, operationIds);
            nextState = buildCommittedSnapshot(state, draft, context);
            const committedPlan = nextState.planejamento;
            commitResult = resultFor(committedPlan, draftId);
            const oldCurrent = requestResult(reads.current);
            const previousEnvelope = isLocalStateEnvelopeValid(oldCurrent)
              ? { ...oldCurrent, slot: 'previous' }
              : createLocalStateEnvelope(state, { slot: 'previous' });
            const currentEnvelope = createLocalStateEnvelope(nextState, {
              slot: 'current',
              savedAt: committedPlan.updatedAt,
            });
            const appliedDraft = {
              ...draft,
              state: 'applied',
              updatedAt: committedPlan.updatedAt,
              appliedAt: committedPlan.updatedAt,
              appliedPlanId: expectedPlanId,
              appliedBaseRevision: expectedRevision,
              appliedRevision: committedPlan.revision,
              appliedCommitId: draftId,
              appliedResult: commitResult,
            };
            const checkpoint = {
              id: `rf-checkpoint:${draftId}`,
              type: 'checkpoint',
              planId: expectedPlanId,
              revision: expectedRevision,
              kind: 'automatic',
              createdAt: committedPlan.updatedAt,
              plan: clone(currentPlan),
              draftId,
            };
            const syncIntent = {
              id: `rf-sync-intent:${draftId}`,
              type: 'sync_intent',
              planId: expectedPlanId,
              revision: committedPlan.revision,
              status: 'pending',
              operationIds,
              createdAt: committedPlan.updatedAt,
              draftId,
              localCommitted: true,
              syncPending: true,
            };
            appStore.put(previousEnvelope, LOCAL_STATE_PREVIOUS_KEY);
            appStore.put(currentEnvelope, LOCAL_STATE_CURRENT_KEY);
            appStore.put(nextState, LOCAL_STATE_LEGACY_KEY);
            draftStore.put(appliedDraft);
            journalStore.put(checkpoint);
            journalStore.put(syncIntent);
          } catch (error) {
            abortForError(error);
          }
        };
      }
    } catch (error) {
      settleError(error);
    }
  });
}

function requestResult(request) {
  return request?.result;
}
