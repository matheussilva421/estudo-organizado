import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import * as sdk from 'firebase/firestore';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  fetchGenerationRecords,
  fetchPlanRevision,
  wireFirestores,
} from '../../src/js/sync/v1-next/remote.js';
import { setActiveV1Context, clearActiveV1Context } from '../../src/js/sync/v1-next/local.js';
import { encodeDocId } from '../../src/js/sync/v1-next/contracts.js';

const modules = import.meta.glob('../../src/js/sync/v1-next/*.js');
let env;
let writer;
let readers;
const root = 'users/A/v1SyncNamespaces/g1';
const pointerId = encodeDocId('meta:retaFinalRevision');
const counts = Object.fromEntries(['editais', 'disciplinas', 'eventos', 'habitos',
  'retaFinalBlocos', 'meta', 'tombstones'].map(key => [key, 0]));

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-estudo-t8', firestore: {
    host: (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085').split(':')[0],
    port: Number((process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085').split(':')[1]),
    rules: await readFile('firestore.rules', 'utf8'),
  } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    const common = { schemaVersion: 1, generationId: 'g1', updatedAt: sdk.serverTimestamp() };
    await sdk.setDoc(sdk.doc(db, root), { ...common, migrationId: 'm1', state: 'active',
      revision: 0, sourceSha256: 'a'.repeat(64), businessDigest: 'b'.repeat(64),
      counts: { total: 0, byCollection: counts } });
    await sdk.setDoc(sdk.doc(db, 'users/A/v1SyncControl/current'), common);
  });
  [writer, ...readers] = Array.from({ length: 3 }, () => env.authenticatedContext('A').firestore());
  setActiveV1Context('A', 'g1');
});
afterAll(async () => { clearActiveV1Context(); await env?.cleanup(); });

it('keeps two readers on the prior revision across interrupted staging and publishes once on retry', async () => {
  const load = modules['../../src/js/sync/v1-next/reta-final.js'];
  expect(load, 'publicador de revisão lógica').toBeTypeOf('function');
  const { publishPlanRevision, resolveVisiblePlanRevision } = await load();
  let interrupt = false;
  const firestore = { ...sdk, runTransaction: (db, fn) => sdk.runTransaction(db, tx => fn({
    get: ref => tx.get(ref),
    set(ref, value) {
      if (interrupt && ref.id === pointerId) throw new Error('simulated disconnect');
      tx.set(ref, value);
    },
  })) };
  wireFirestores({ db: writer, auth: { currentUser: { uid: 'A' } }, firestore });
  const blocks = Array.from({ length: 140 }, (_, ordem) => ({ id: 'b' + ordem, ordem,
    discId: 'd', topicos: [{ assId: 'a' }], minutos: 40, dataPlanejada: '2026-11-24' }));
  const metadata = { operations: ['edit'], planejamentoArquivado: { rfBlocoId: 'historic-only' } };
  const op = { planId: 'plan', opId: 'first', baseRevision: 0, blocks, metadata };
  const visible = async db => {
    const rows = (await sdk.getDocsFromServer(sdk.collection(db, root, 'meta'))).docs
      .map(row => JSON.parse(row.data().data));
    return resolveVisiblePlanRevision(rows.find(row => row.entityId === 'retaFinalRevision').data, rows);
  };
  const first = await publishPlanRevision(op);
  expect(first).toMatchObject({ status: 'published', revision: 1, blocks });
  const planSnapshot = await fetchPlanRevision('A', 'g1');
  expect(planSnapshot.pointer).toBeTruthy();
  const resolvedSnapshot = resolveVisiblePlanRevision(planSnapshot.pointer, planSnapshot.records);
  expect(resolvedSnapshot).toMatchObject({ planId: 'plan', revision: 1, blocks });
  const generation = await fetchGenerationRecords('A', 'g1');
  expect(generation.planRevision.pointer).toBeTruthy();
  expect(generation.records.some(record => record.entityId === 'retaFinalRevision'))
    .toBe(false);
  const next = { ...op, baseRevision: 1, opId: 'next', blocks: blocks.slice(1).reverse()
    .map((b, ordem) => ({ ...b, ordem, notas: 'nova', dataPlanejada: '2026-11-25' })),
    metadata: { ...metadata, tombstones: ['b0'] } };
  interrupt = true;
  await expect(publishPlanRevision(next)).rejects.toThrow();
  for (const reader of readers) expect(await visible(reader)).toMatchObject({ revision: 1, blocks });
  const staged = await sdk.getDocsFromServer(sdk.collection(writer, root, 'meta'));
  expect(staged.size).toBeGreaterThan(3);
  interrupt = false;
  await publishPlanRevision(next);
  await publishPlanRevision(next);
  await publishPlanRevision(op);
  for (const reader of readers) expect(await visible(reader)).toMatchObject({
    revision: 2, blocks: next.blocks, metadata: next.metadata,
  });
  expect((await sdk.getDocsFromServer(sdk.collection(writer, root, 'meta'))).size).toBe(staged.size);
  await expect(publishPlanRevision({ ...next, metadata: {} })).rejects.toThrow();
});
