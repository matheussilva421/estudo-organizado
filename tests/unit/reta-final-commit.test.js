import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRetaFinalDraft, appendRetaFinalDraftOperation } from '../../src/js/logic/reta-final-drafts.js';
import { createLocalStateEnvelope, isLocalStateEnvelopeValid } from '../../src/js/store/normalize-state.js';
import { commitRetaFinalDraft } from '../../src/js/store/reta-final-commit.js';
import {
  commitRetaFinalDraft as commitRetaFinalDraftViaStore,
  setState as setStoreState,
  state as liveState,
} from '../../src/js/store.js';
import { createTransactionalIdb } from './reta-final-draft-idb-helper.js';

const NOW = '2026-10-20T12:30:00.000Z';
const TODAY = '2026-10-20';

function plan(overrides = {}) {
  return {
    ativo: true,
    tipo: 'reta_final',
    planId: overrides.planId || 'plan-1',
    schemaVersionRetaFinal: 2,
    revision: overrides.revision ?? 4,
    updatedAt: '2026-10-19T10:00:00.000Z',
    retaFinal: {
      dataFinal: '2026-11-30',
      minutosPadrao: 60,
      blocos: [
        {
          id: 'rf-1',
          discId: 'disc-1',
          topicos: [{ assId: 'ass-1', aulaId: null }],
          minutos: 60,
          status: 'pendente',
          ordem: 0,
          dataOriginal: TODAY,
          dataPlanejada: TODAY,
          data: TODAY,
          rolagens: 0,
        },
      ],
    },
  };
}

function catalog() {
  return [
    {
      id: 'edital-1',
      disciplinas: [
        {
          id: 'disc-1',
          nome: 'Direito Administrativo',
          assuntos: [{ id: 'ass-1', nome: 'Atos administrativos' }],
          aulas: [],
        },
      ],
    },
  ];
}

function appState(overrides = {}) {
  return {
    schemaVersion: 12,
    planejamento: plan(),
    planejamentoArquivado: null,
    eventos: [],
    editais: catalog(),
    config: {},
    ...overrides,
  };
}

function idbFor(state = appState(), options = {}) {
  const current = createLocalStateEnvelope(state, {
    slot: 'current',
    savedAt: '2026-10-19T10:00:00.000Z',
  });
  const previous = createLocalStateEnvelope(state, {
    slot: 'previous',
    savedAt: '2026-10-18T10:00:00.000Z',
  });
  return createTransactionalIdb({
    stores: {
      app_state: {
        main_state_current: current,
        main_state_previous: previous,
        main_state: state,
      },
      reta_final_drafts: {},
      reta_final_journal: {},
    },
    keyPaths: { reta_final_drafts: 'draftId', reta_final_journal: 'id' },
    ...options,
  });
}

function draftFor(
  sourcePlan = plan(),
  draftId = 'draft-1',
  { operations = true, catalogIntents, operationId = `op-${draftId}`, patch = { minutos: 90 } } = {},
) {
  let draft = createRetaFinalDraft(sourcePlan, { draftId, now: NOW });
  if (operations) {
    const appended = appendRetaFinalDraftOperation(
      draft,
      {
        operationId,
        type: 'PATCH',
        blockIds: ['rf-1'],
        patch,
      },
      { today: TODAY, events: [], catalog: catalog(), activeTimerIds: [] },
    );
    expect(appended.valid).toBe(true);
    draft = appended.draft;
  }
  return catalogIntents ? { ...draft, catalogIntents } : draft;
}

function context(overrides = {}) {
  let nextId = 0;
  return {
    today: TODAY,
    now: NOW,
    makeId: () => `commit-id-${++nextId}`,
    ...overrides,
  };
}

function commit(database, draft, overrides = {}) {
  return commitRetaFinalDraft({
    db: database,
    draftId: draft.draftId,
    expectedPlanId: draft.planId,
    expectedRevision: draft.baseRevision,
    context: context(overrides),
  });
}

async function persistDraft(idb, draft) {
  const tx = idb.database.transaction(['reta_final_drafts'], 'readwrite');
  tx.objectStore('reta_final_drafts').put(draft);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

function readAppState(idb) {
  return idb.getRecord('app_state', 'main_state_current')?.payload;
}

function journalRecords(idb) {
  const records = [];
  for (const key of idb.journalKeys?.() || []) {
    records.push(idb.getRecord('reta_final_journal', key));
  }
  return records;
}

afterEach(() => vi.restoreAllMocks());

describe('commitRetaFinalDraft', () => {
  it('writes one new revision and resolves only after all three stores commit', async () => {
    let release;
    const commitGate = new Promise((resolve) => { release = resolve; });
    const idb = idbFor();
    const draft = draftFor();
    await persistDraft(idb, draft);
    idb.holdNextCommit(commitGate);
    const before = readAppState(idb);
    let publishedState = before;
    const publishedEvents = [];
    let settled = false;

    const pending = commit(idb.database, draft, {
      onCommitted: (nextState) => {
        publishedState = nextState;
        publishedEvents.push('stateSaved');
      },
    }).then((result) => {
      settled = true;
      return result;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(settled).toBe(false);
    expect(publishedState).toBe(before);
    expect(publishedEvents).toEqual([]);
    expect(readAppState(idb)).toEqual(before);
    expect(idb.getRecord('reta_final_drafts', draft.draftId).state).toBe('editing');
    expect(idb.journalKeys?.()).toEqual([]);

    release();
    await expect(pending).resolves.toMatchObject({
      plan: { planId: 'plan-1', revision: 5, retaFinal: { blocos: [{ minutos: 90 }] } },
      revision: 5,
      localCommitted: true,
      syncPending: true,
    });
    expect(publishedState.planejamento.revision).toBe(5);
    expect(publishedEvents).toEqual(['stateSaved']);
    const current = idb.getRecord('app_state', 'main_state_current');
    expect(isLocalStateEnvelopeValid(current)).toBe(true);
    expect(current.payload.planejamento.revision).toBe(5);
    expect(idb.getRecord('app_state', 'main_state_previous').payload.planejamento.revision).toBe(4);
    expect(idb.getRecord('app_state', 'main_state').planejamento.revision).toBe(5);
    expect(idb.getRecord('reta_final_drafts', draft.draftId)).toMatchObject({
      state: 'applied',
      appliedRevision: 5,
      appliedCommitId: draft.draftId,
    });
    expect(journalRecords(idb).map((record) => record.type).sort()).toEqual(['checkpoint', 'sync_intent']);
  });

  it('rejects a changed persisted revision with a structured stale code and no writes', async () => {
    const sourceState = appState({ planejamento: plan({ revision: 5 }) });
    const idb = idbFor(sourceState);
    const draft = draftFor(plan());
    await persistDraft(idb, draft);
    const before = readAppState(idb);

    await expect(commit(idb.database, draft)).rejects.toMatchObject({ code: 'RETA_FINAL_STALE' });

    expect(readAppState(idb)).toEqual(before);
    expect(idb.getRecord('reta_final_drafts', draft.draftId).state).toBe('editing');
    expect(idb.journalKeys?.()).toEqual([]);
  });

  it('rejects a plan identity mismatch without changing any participating store', async () => {
    const idb = idbFor(appState());
    const draft = draftFor(plan({ planId: 'another-plan' }));
    await persistDraft(idb, draft);
    const before = readAppState(idb);

    await expect(commit(idb.database, draft)).rejects.toMatchObject({ code: 'RETA_FINAL_CONFLICT' });

    expect(readAppState(idb)).toEqual(before);
    expect(idb.getRecord('reta_final_drafts', draft.draftId).state).toBe('editing');
    expect(idb.journalKeys?.()).toEqual([]);
  });

  it('makes repeated clicks on an applied draft idempotent', async () => {
    const idb = idbFor();
    const draft = draftFor();
    await persistDraft(idb, draft);

    const [first, second] = await Promise.all([
      commit(idb.database, draft),
      commit(idb.reopen(), draft),
    ]);

    expect(first.revision).toBe(5);
    expect(second).toEqual(first);
    expect(readAppState(idb).planejamento.revision).toBe(5);
    expect(journalRecords(idb)).toHaveLength(2);
  });

  it('publishes the recovered committed state through the public facade on replay', async () => {
    const idb = idbFor();
    const draft = draftFor();
    await persistDraft(idb, draft);
    const first = await commitRetaFinalDraftViaStore({
      db: idb.database,
      draftId: draft.draftId,
      expectedPlanId: draft.planId,
      expectedRevision: draft.baseRevision,
      context: context(),
    });
    expect(liveState.planejamento.revision).toBe(5);

    setStoreState(appState({ planejamento: plan({ revision: 3 }) }));
    const saved = [];
    const onSaved = (event) => saved.push(event.detail);
    document.addEventListener('stateSaved', onSaved);
    try {
      const replay = await commitRetaFinalDraftViaStore({
        db: idb.reopen(),
        draftId: draft.draftId,
        expectedPlanId: draft.planId,
        expectedRevision: draft.baseRevision,
        context: context(),
      });

      expect(replay).toEqual(first);
      expect(liveState.planejamento).toEqual(first.plan);
      expect(liveState.planejamento.revision).toBe(5);
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ revision: 5, localCommitted: true, syncPending: true });
      expect(readAppState(idb).planejamento.revision).toBe(5);
      expect(journalRecords(idb)).toHaveLength(2);
    } finally {
      document.removeEventListener('stateSaved', onSaved);
    }
  });

  it('allows only one of two connections committing different drafts from the same base', async () => {
    const idb = idbFor();
    const firstDraft = draftFor(plan(), 'draft-a');
    const secondDraft = draftFor(plan(), 'draft-b');
    await persistDraft(idb, firstDraft);
    await persistDraft(idb, secondDraft);

    const outcomes = await Promise.allSettled([
      commit(idb.database, firstDraft),
      commit(idb.reopen(), secondDraft),
    ]);

    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((item) => item.status === 'rejected')).toHaveLength(1);
    const rejected = outcomes.find((item) => item.status === 'rejected');
    expect(rejected.reason.code).toBe('RETA_FINAL_STALE');
    expect(readAppState(idb).planejamento.revision).toBe(5);
    expect(journalRecords(idb)).toHaveLength(2);
  });

  it('deduplicates repeated operation ids when recording a local sync intent', async () => {
    const idb = idbFor();
    const baseDraft = draftFor(plan(), 'repeat-draft');
    const draft = {
      ...baseDraft,
      operations: [...baseDraft.operations, ...baseDraft.operations],
    };
    await persistDraft(idb, draft);

    await commit(idb.database, draft);

    const intent = journalRecords(idb).find((record) => record.type === 'sync_intent');
    expect(intent.operationIds).toEqual(['op-repeat-draft']);
  });

  it('rejects a different draft that reuses a committed operation id', async () => {
    const idb = idbFor();
    const firstDraft = draftFor(plan(), 'draft-a');
    await persistDraft(idb, firstDraft);
    const first = await commit(idb.database, firstDraft);
    const secondDraft = draftFor(first.plan, 'draft-b', {
      operationId: 'op-draft-a',
      patch: { minutos: 120 },
    });
    await persistDraft(idb, secondDraft);
    const before = readAppState(idb);

    await expect(commit(idb.database, secondDraft)).rejects.toMatchObject({
      code: 'RETA_FINAL_CONFLICT',
    });

    expect(readAppState(idb)).toEqual(before);
    expect(readAppState(idb).planejamento.revision).toBe(5);
    expect(idb.getRecord('reta_final_drafts', secondDraft.draftId).state).toBe('editing');
    expect(journalRecords(idb)).toHaveLength(2);
  });

  it.each(['app_state', 'reta_final_drafts', 'reta_final_journal'])(
    'rolls back every store when quota fails in %s',
    async (storeName) => {
      const idb = idbFor();
      const draft = draftFor();
      await persistDraft(idb, draft);
      const before = readAppState(idb);
      idb.failNextWriteInStore?.(storeName);

      await expect(commit(idb.database, draft)).rejects.toMatchObject({ name: 'QuotaExceededError' });

      expect(readAppState(idb)).toEqual(before);
      expect(idb.getRecord('reta_final_drafts', draft.draftId).state).toBe('editing');
      expect(idb.journalKeys?.()).toEqual([]);
      expect(readAppState(idb).planejamento.revision).toBe(4);
    },
  );

  it('keeps all records unchanged after an explicit transaction abort', async () => {
    const idb = idbFor();
    const draft = draftFor();
    await persistDraft(idb, draft);
    const before = readAppState(idb);
    const pending = commit(idb.database, draft);
    await Promise.resolve();
    await Promise.resolve();
    idb.lastTransaction.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(readAppState(idb)).toEqual(before);
    expect(idb.getRecord('reta_final_drafts', draft.draftId).state).toBe('editing');
    expect(idb.journalKeys?.()).toEqual([]);
  });

  it('aborts every store when a later put throws synchronously after earlier writes were queued', async () => {
    const idb = idbFor();
    const draft = draftFor();
    await persistDraft(idb, draft);
    const before = readAppState(idb);
    const beforeDraft = idb.getRecord('reta_final_drafts', draft.draftId);
    const failure = Object.assign(new Error('synchronous journal put failure'), {
      name: 'DataCloneError',
    });
    idb.throwNextWriteInStore('reta_final_journal', failure);

    await expect(commit(idb.database, draft)).rejects.toMatchObject({
      name: 'DataCloneError',
      message: 'synchronous journal put failure',
    });

    expect(readAppState(idb)).toEqual(before);
    expect(idb.getRecord('reta_final_drafts', draft.draftId)).toEqual(beforeDraft);
    expect(idb.journalKeys?.()).toEqual([]);
  });

  it('recovers the committed snapshot and applied result from a reopened connection', async () => {
    const idb = idbFor();
    const draft = draftFor();
    await persistDraft(idb, draft);

    const result = await commit(idb.database, draft);
    const reopened = idb.reopen();

    expect(isLocalStateEnvelopeValid(idb.getRecord('app_state', 'main_state_current'))).toBe(true);
    expect(readAppState(idb).planejamento).toEqual(result.plan);
    expect(idb.getRecord('reta_final_drafts', draft.draftId).appliedRevision).toBe(5);
    expect(journalRecords(idb)).toHaveLength(2);
    await expect(commit(reopened, draft)).resolves.toEqual(result);
    expect(readAppState(idb).planejamento.revision).toBe(5);
    expect(journalRecords(idb)).toHaveLength(2);
  });

  it('preserves studied and partial event history and titles newly materialized autos', async () => {
    const studied = {
      id: 'event-studied',
      rfBlocoId: 'rf-1',
      status: 'estudei',
      tempoAcumulado: 42,
      questoes: 7,
      revisoes: [{ id: 'review-1' }],
      paginas: '10-12',
    };
    const partial = {
      id: 'event-partial',
      rfBlocoId: 'rf-partial',
      status: 'agendado',
      tempoAcumulado: 5,
      questoes: 2,
      revisoes: [{ id: 'review-2' }],
      paginas: '20',
    };
    const sourcePlan = {
      ...plan(),
      retaFinal: {
        ...plan().retaFinal,
        blocos: [
          ...plan().retaFinal.blocos,
          {
            ...plan().retaFinal.blocos[0],
            id: 'rf-partial',
            ordem: 1,
          },
          {
            ...plan().retaFinal.blocos[0],
            id: 'rf-unoccupied',
            ordem: 2,
          },
        ],
      },
    };
    const idb = idbFor(appState({ planejamento: sourcePlan, eventos: [studied, partial] }));
    const draft = draftFor(sourcePlan, 'history-draft');
    await persistDraft(idb, draft);

    await commit(idb.database, draft, { makeId: () => 'new-auto' });

    const events = readAppState(idb).eventos;
    expect(events).toContainEqual(studied);
    expect(events).toContainEqual(partial);
    const generated = events.find((event) => event.rfBlocoId === 'rf-unoccupied' && event.isAutoGenerated);
    expect(generated.titulo).toBe('Direito Administrativo — Atos administrativos');
    expect(events.filter((event) => event.rfBlocoId === 'rf-1')).toEqual([studied]);
    expect(events.filter((event) => event.rfBlocoId === 'rf-partial')).toEqual([partial]);
    expect(events.filter((event) => event.rfBlocoId === 'rf-unoccupied')).toEqual([generated]);
  });

  it('materializes exact optional catalog intents only in the successful commit', async () => {
    const idb = idbFor();
    const draft = draftFor(plan(), 'catalog-draft', {
      catalogIntents: [{ entity: 'assunto', id: 'ass-2', discId: 'disc-1', nome: 'Poderes' }],
    });
    await persistDraft(idb, draft);

    await commit(idb.database, draft);

    expect(readAppState(idb).editais[0].disciplinas[0].assuntos).toEqual([
      { id: 'ass-1', nome: 'Atos administrativos' },
      { id: 'ass-2', nome: 'Poderes' },
    ]);
  });

  it('rejects a catalog intent whose id already belongs to another entity', async () => {
    const idb = idbFor();
    const draft = draftFor(plan(), 'bad-catalog-draft', {
      catalogIntents: [{ entity: 'aula', id: 'ass-1', discId: 'disc-1', nome: 'Poderes' }],
    });
    await persistDraft(idb, draft);
    const before = readAppState(idb);

    await expect(commit(idb.database, draft)).rejects.toMatchObject({ code: 'RETA_FINAL_CONFLICT' });

    expect(readAppState(idb)).toEqual(before);
    expect(idb.getRecord('reta_final_drafts', draft.draftId).state).toBe('editing');
    expect(idb.journalKeys?.()).toEqual([]);
  });
});
