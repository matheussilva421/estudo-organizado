import { afterEach, expect, it } from 'vitest';
import {
  appendRetaFinalDraftOperation,
  createRetaFinalDraft,
} from '../../src/js/logic/reta-final-drafts.js';
import { commitRetaFinalDraft } from '../../src/js/store/reta-final-commit.js';
import { createTransactionalIdb } from './reta-final-draft-idb-helper.js';
import { clearActiveV1Context, setActiveV1Context, v1ScopeKey } from '../../src/js/sync/v1-next/local.js';
import { convertBackupV12 } from '../../src/js/sync/v1-next/backup-codec.js';
import { createBaseState } from '../helpers/state-builders.js';

const modules = import.meta.glob('../../src/js/sync/v1-next/*.js');
const day = '2026-11-24';
const block = { id: 'b', discId: 'd', minutos: 30, topicos: [], ordem: 0, dataPlanejada: day, data: day };
const plan = { tipo: 'reta_final', ativo: true, planId: 'p', revision: 4, schemaVersionRetaFinal: 2,
  retaFinal: { dataFinal: day, blocos: [block] } };
const catalog = [{ id: 'e', disciplinas: [{ id: 'd', assuntos: [], aulas: [] }] }];
const state = createBaseState({
  schemaVersion: 12,
  planejamento: plan,
  eventos: [],
  editais: catalog,
});
afterEach(clearActiveV1Context);

it('resolves 140 blocks, removal and notes only from complete validated batches', async () => {
  const load = modules['../../src/js/sync/v1-next/reta-final.js'];
  expect(load).toBeTypeOf('function');
  const { preparePlanRevision, resolveVisiblePlanRevision } = await load();
  const blocks = Array.from({ length: 140 }, (_, ordem) => ({ ...block, id: `b${ordem}`,
    ordem, notas: ordem === 7 ? 'nota preservada' : '', topicos: [{ assId: `a${ordem}` }],
    dataPlanejada: `2026-11-${String(24 + (ordem % 4)).padStart(2, '0')}` }));
  const metadata = { operations: ['mover'], historico: { arquivado: ['b0'] },
    notas: { b7: 'nota preservada' }, datas: { b7: '2026-11-27' } };
  const op = { planId: 'p', baseRevision: 4, opId: 'apply', blocks, metadata };
  const { manifest, batches } = preparePlanRevision(op);
  expect(batches.length).toBe(4);
  expect(resolveVisiblePlanRevision(manifest, batches)).toMatchObject({
    planId: 'p', revision: 5, baseRevision: 4, blocks, metadata,
  });
  const removed = { ...op, baseRevision: 5, opId: 'remove', blocks: blocks.slice(1),
    metadata: { ...metadata, exclusoes: ['b0'], tombstones: ['b0'] } };
  const removal = preparePlanRevision(removed);
  expect(resolveVisiblePlanRevision(removal.manifest, removal.batches)).toMatchObject({
    revision: 6, blocks: blocks.slice(1), metadata: removed.metadata,
  });
  expect(() => resolveVisiblePlanRevision(manifest, [])).toThrow();
  const corrupted = structuredClone(batches);
  corrupted[0].data.blocks[0].minutos++;
  expect(() => resolveVisiblePlanRevision(manifest, corrupted)).toThrow();
  expect(() => preparePlanRevision({ ...op, blocks: [block, { ...block, id: 'c' }] })).toThrow();
  expect(() => preparePlanRevision({ ...op, metadata: { tombstones: ['b0'] } })).toThrow();
});

it('aborts draft, state and events on an outbox failure and replay enqueues exactly once', async () => {
  const baseDraft = createRetaFinalDraft(plan, { draftId: 'edit', now: day });
  const appended = appendRetaFinalDraftOperation(baseDraft, {
    operationId: 'patch-1', type: 'PATCH', blockIds: ['b'], patch: { minutos: 45 },
  }, { today: day, now: day, events: [], catalog, activeTimerIds: [] });
  expect(appended.valid).toBe(true);
  const draft = appended.draft;
  const key = v1ScopeKey('A', 'g1');
  const pk = JSON.stringify(['v1-generation-pointer', 'A']);
  const { manifestDraft } = convertBackupV12(state);
  const manifest = { schemaVersion: 1, generationId: 'g1', migrationId: 'm', state: 'active', revision: 0,
    sourceSha256: 'a'.repeat(64), businessDigest: manifestDraft.businessDigest, counts: manifestDraft.counts,
    updatedAt: { seconds: 1, nanoseconds: 0 } };
  const stores = { app_state: { main_state: state }, reta_final_drafts: { edit: draft }, reta_final_journal: {},
    v1_local_state: { [key]: { key, uid: 'A', generationId: 'g1', verified: true, state },
      [pk]: { key: pk, uid: 'A', generationId: 'g1', kind: 'v1_generation_pointer', status: 'ready', verified: true, manifest } },
    v1_sync_outbox: {}, v1_entity_meta: {}, v1_sync_meta: {}, v1_sync_conflicts: {} };
  const idb = createTransactionalIdb({ stores, keyPaths: { v1_local_state: 'key', v1_sync_outbox: 'opId',
    v1_entity_meta: 'key', v1_sync_meta: 'key', v1_sync_conflicts: 'key' } });
  setActiveV1Context('A', 'g1');
  const commit = () => commitRetaFinalDraft({ db: idb.database, draftId: 'edit',
    expectedPlanId: 'p', expectedRevision: 4, context: { today: day, now: day, pruneAutomatic: false } });
  idb.failNextWriteInStore('v1_sync_outbox');
  await expect(commit()).rejects.toThrow(/quota/i);
  expect(idb.getRecord('app_state', 'main_state')).toEqual(state);
  expect(idb.getRecord('reta_final_drafts', 'edit').state).toBe('editing');
  expect(idb.journalKeys()).toEqual([]);
  await commit();
  const all = async () => {
    const req = idb.database.transaction(['v1_sync_outbox']).objectStore('v1_sync_outbox').getAll();
    return new Promise(resolve => { req.onsuccess = () => resolve(req.result); });
  };
  const pending = await all();
  expect(pending.length).toBeGreaterThan(0);
  expect(pending.some(op => op.entityType === 'retaFinalBloco')).toBe(true);
  const committed = idb.getRecord('v1_local_state', key).state;
  const journalCount = idb.journalKeys().length;
  await commit();
  expect(await all()).toEqual(pending);
  expect(idb.getRecord('app_state', 'main_state')).toEqual(state);
  expect(idb.journalKeys().length).toBe(journalCount);
  expect(idb.getRecord('v1_local_state', key).state.eventos).toEqual(committed.eventos);
  expect(committed.eventos.map(event => event.id)).toEqual(
    [...new Set(committed.eventos.map(event => event.id))],
  );
});

it('uses the authoritative V1 cache and preserves a newer remote change outside Reta Final', async () => {
  const baseDraft = createRetaFinalDraft(plan, { draftId: 'edit-v1-ahead', now: day });
  const draft = appendRetaFinalDraftOperation(baseDraft, {
    operationId: 'patch-v1-ahead', type: 'PATCH', blockIds: ['b'], patch: { minutos: 45 },
  }, { today: day, now: day, events: [], catalog, activeTimerIds: [] }).draft;
  const key = v1ScopeKey('A', 'g1');
  const pk = JSON.stringify(['v1-generation-pointer', 'A']);
  const remoteEvent = { id: 'ev-remote-ahead', titulo: 'delta remoto', data: day,
    status: 'agendado', tempoAcumulado: 0, discId: 'd', assId: null };
  const v1Ahead = createBaseState({ ...state, eventos: [remoteEvent] });
  const { manifestDraft } = convertBackupV12(v1Ahead);
  const manifest = { schemaVersion: 1, generationId: 'g1', migrationId: 'm', state: 'active', revision: 0,
    sourceSha256: 'a'.repeat(64), businessDigest: manifestDraft.businessDigest, counts: manifestDraft.counts,
    updatedAt: { seconds: 1, nanoseconds: 0 } };
  const idb = createTransactionalIdb({ stores: {
    app_state: { main_state: state }, reta_final_drafts: { 'edit-v1-ahead': draft }, reta_final_journal: {},
    v1_local_state: {
      [key]: { key, uid: 'A', generationId: 'g1', verified: true, state: v1Ahead },
      [pk]: { key: pk, uid: 'A', generationId: 'g1', kind: 'v1_generation_pointer', status: 'ready',
        verified: true, manifest },
    },
    v1_sync_outbox: {}, v1_entity_meta: {}, v1_sync_meta: {}, v1_sync_conflicts: {},
  }, keyPaths: { v1_local_state: 'key', v1_sync_outbox: 'opId', v1_entity_meta: 'key',
    v1_sync_meta: 'key', v1_sync_conflicts: 'key' } });
  setActiveV1Context('A', 'g1');
  await commitRetaFinalDraft({ db: idb.database, draftId: 'edit-v1-ahead', expectedPlanId: 'p',
    expectedRevision: 4, context: { today: day, now: day, pruneAutomatic: false } });
  expect(idb.getRecord('v1_local_state', key)).toMatchObject({ verified: true });
  expect(idb.getRecord('v1_local_state', key).state.eventos)
    .toContainEqual(remoteEvent);
});
