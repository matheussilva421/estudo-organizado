import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc,
  updateDoc, writeBatch } from 'firebase/firestore';
import { encodeDocId, encodeRecordData, validateRecord } from '../../src/js/sync/v1-next/contracts.js';

const pointer = 'users/A/v1SyncControl/current';
const root = generation => 'users/A/v1SyncNamespaces/' + generation;
const key = 'evento:á/1';
const target = 'eventos/' + Buffer.from(key).toString('hex');
const sha = data => createHash('sha256').update(data ?? 'null').digest('hex');
let env, owner;

function operation(revision = 1, opId = 'op1', deleted = false) {
  const data = deleted ? null : JSON.stringify({ key, entityType: 'evento', entityId: 'á/1',
    path: ['eventos', 0], data: { id: 'á/1', revision } });
  return { schemaVersion: 1, generationId: 'g1', collection: 'eventos', entityType: 'evento',
    entityId: 'á/1', revision, baseRevision: revision - 1, opId, opDigest: sha(data),
    deleted, updatedAt: serverTimestamp(), data };
}

function pair(db, entity = operation(), options = {}) {
  const { data: _data, ...receipt } = entity;
  const batch = writeBatch(db);
  const base = root(options.generation ?? 'g1');
  batch.set(doc(db, base, options.target ?? target), entity);
  batch.set(doc(db, base, 'operations', entity.opId), { ...receipt, ...options.receipt });
  return batch.commit();
}

async function activate(generationId, state = 'active') {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const batch = writeBatch(db);
    const common = { schemaVersion: 1, generationId, updatedAt: serverTimestamp() };
    batch.set(doc(db, pointer), common);
    batch.set(doc(db, root(generationId)), { ...common, state, revision: 0, migrationId: 'm1',
      sourceSha256: 'a'.repeat(64), businessDigest: 'b'.repeat(64), counts: { total: 0,
        byCollection: { editais: 0, disciplinas: 0, eventos: 0, habitos: 0,
          retaFinalBlocos: 0, meta: 0, tombstones: 0 } } });
    await batch.commit();
  });
}

async function environment(projectId, file) {
  return initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8085,
    rules: await readFile(file, 'utf8') } });
}
beforeAll(async () => { env = await environment('demo-estudo-v1-sync', 'firestore.rules'); });
beforeEach(async () => {
  await env.clearFirestore();
  await activate('g1');
  owner = env.authenticatedContext('A').firestore();
});
afterAll(async () => { await env?.cleanup(); });

it('allows owner gets, empty baseline query, create, CAS and durable receipt reads', async () => {
  await assertSucceeds(getDoc(doc(owner, pointer)));
  await assertSucceeds(getDoc(doc(owner, root('g1'))));
  await assertSucceeds(getDocs(collection(owner, root('g1'), 'eventos')));
  await assertSucceeds(pair(owner));
  await assertSucceeds(pair(owner, operation(2, 'op2')));
  expect((await getDoc(doc(owner, root('g1'), target))).data().revision).toBe(2);
  expect((await getDoc(doc(owner, root('g1'), 'operations/op1'))).data().revision).toBe(1);
});

it('denies anonymous and other UID reads, queries and matching write pairs', async () => {
  for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('B').firestore()]) {
    for (const path of [pointer, root('g1'), root('g1') + '/' + target, root('g1') + '/operations/op1']) {
      await assertFails(getDoc(doc(db, path)));
    }
    await assertFails(getDocs(collection(db, root('g1'), 'eventos')));
    await assertFails(pair(db));
  }
});

it('reserves manifest and pointer for Admin including self-declared migration clients', async () => {
  const db = env.authenticatedContext('A', { admin: true }).firestore();
  await activate('g1', 'staging');
  for (const path of [pointer, root('g1'), root('g2')]) {
    await assertFails(setDoc(doc(db, path), { generationId: 'g2', state: 'active', trusted: true }));
    await assertFails(deleteDoc(doc(db, path)));
  }
  await assertFails(updateDoc(doc(db, root('g1')), { state: 'active' }));
  await assertFails(pair(db));
});

it.each(['retired', 'staging', 'verified'])('denies %s even with a pointing control', async state => {
  await activate('g1', state);
  await assertFails(getDoc(doc(owner, root('g1'))));
  await assertFails(pair(owner));
});

it('rejects writes and reads from previous generation immediately after pointer switch', async () => {
  await assertSucceeds(pair(owner));
  await activate('g2');
  await assertFails(getDoc(doc(owner, root('g1'), target)));
  await assertFails(pair(owner, operation(2, 'op2')));
  await assertSucceeds(pair(owner, { ...operation(), generationId: 'g2' }, { generation: 'g2' }));
});

it('requires a new matching receipt and entity mutation in the same commit', async () => {
  const entity = operation();
  const { data: _data, ...receipt } = entity;
  await assertFails(setDoc(doc(owner, root('g1'), target), entity));
  await assertFails(setDoc(doc(owner, root('g1'), 'operations/op1'), receipt));
  for (const patch of [{ opDigest: 'a'.repeat(64) }, { entityId: '2' }, { baseRevision: 1 },
    { role: 'admin' }, { deleted: true }]) {
    await assertFails(pair(owner, entity, { receipt: patch }));
  }
  expect((await getDoc(doc(owner, root('g1'), target))).exists()).toBe(false);
});

it('rejects stale revisions, replay, jumps and receipt edits/deletes', async () => {
  await assertSucceeds(pair(owner));
  for (const entity of [operation(), operation(1, 'stale'), operation(3, 'jump'), operation(2, 'op1')]) {
    await assertFails(pair(owner, entity));
  }
  const ref = doc(owner, root('g1'), 'operations/op1');
  await assertFails(updateDoc(ref, { deleted: true }));
  await assertFails(deleteDoc(ref));
});

it('enforces path identity, envelope types, UTF-8 ceiling and payload digest', async () => {
  for (const patch of [{ generationId: 'g2' }, { entityId: 'other' }, { schemaVersion: 2 },
    { opDigest: '0'.repeat(64) }, { revision: 1.5 }, { baseRevision: -1 }, { collection: 'meta' },
    { role: 'admin' }, { updatedAt: new Date(0) }, { data: {} }, { data: null }]) {
    await assertFails(pair(owner, { ...operation(), ...patch }));
  }
  for (const path of ['extra/abc', 'eventos/alias', 'editais/' + target.split('/')[1]]) {
    await assertFails(pair(owner, operation(), { target: path }));
  }
  const data = 'é'.repeat(460801);
  await assertFails(pair(owner, { ...operation(), data, opDigest: sha(data) }));
});

it('keeps a terminal tombstone at the same path and denies physical deletion', async () => {
  await assertSucceeds(pair(owner));
  await assertFails(deleteDoc(doc(owner, root('g1'), target)));
  await assertSucceeds(pair(owner, operation(2, 'delete1', true)));
  await assertFails(pair(owner, operation(3, 'revive')));
  await assertFails(pair(owner, operation(3, 'delete2', true)));
});

it('commits exactly one of two updates based on the same revision', async () => {
  await assertSucceeds(pair(owner));
  const secondDevice = env.authenticatedContext('A').firestore();
  const results = await Promise.allSettled([
    pair(owner, operation(2, 'left')), pair(secondDevice, operation(2, 'right')),
  ]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  const loser = results.findIndex(r => r.status === 'rejected');
  expect(results[loser].reason.code).toBe('permission-denied');
  const receipt = doc(owner, root('g1'), 'operations', ['left', 'right'][loser]);
  expect((await getDoc(receipt)).exists()).toBe(false);
});

it('reads back all other T1 types and a 900 KiB discipline through the same SDK contract', async () => {
  const rows = [
    ['editais', 'edital', 'e', ['editais', 0], { id: 'e', disciplinas: [null] }],
    ['disciplinas', 'disciplina', 7, ['editais', 0, 'disciplinas', 0], { id: 7, aulas: [], assuntos: [] }],
    ['habitos', 'habito.leitura/questões', 7, ['habitos', 'leitura/questões', 0], { id: 7 }],
    ['retaFinalBlocos', 'retaFinalBloco', 7, ['planejamento', 'retaFinal', 'blocos', 0], { id: 7 }],
    ['meta', 'meta', 'planejamento', ['planejamento'], null],
    ['tombstones', 'tombstone.config.entityTombstones.eventos', 7, ['config', 'entityTombstones', 0],
      { collection: 'eventos', id: 7 }],
  ];
  for (const [c, type, id, path, value] of rows) {
    const item = { key: type + ':' + id, entityType: type, entityId: id, path, data: value };
    if (c === 'disciplinas') {
      value.notas = Array(4).fill('');
      const room = 900 * 1024 - Buffer.byteLength(encodeRecordData(item));
      value.notas = value.notas.map((_, i) => 'x'.repeat(Math.floor((room + i) / 4)));
      expect(Buffer.byteLength(encodeRecordData(item))).toBe(900 * 1024);
    }
    const data = encodeRecordData(item);
    const entity = { ...operation(1, 'add-' + c), collection: c, entityType: type,
      entityId: String(id), data, opDigest: sha(data) };
    const pathInGeneration = c + '/' + encodeDocId(item.key);
    await assertSucceeds(pair(owner, entity, { target: pathInGeneration }));
    const persisted = (await getDoc(doc(owner, root('g1'), pathInGeneration))).data();
    expect(validateRecord(persisted)).toBe(true);
    expect(JSON.parse(persisted.data)).toEqual(item);
  }
});

it('legacy rules deny the new namespace and current rules retain the legacy snapshot scope', async () => {
  const legacy = await environment('demo-estudo-v1-legacy', 'tests/firestore-rules/legacy-console.rules');
  try {
    const db = legacy.authenticatedContext('A').firestore();
    for (const path of [pointer, root('g1'), root('g1') + '/' + target]) {
      await assertFails(getDoc(doc(db, path)));
    }
    await assertFails(pair(db));
    const snapshot = { version: 1, deviceId: 'synthetic', payloadUpdatedAt: 'now', payload: {} };
    await assertSucceeds(setDoc(doc(owner, 'users/A/snapshots/main'), snapshot));
    await assertFails(setDoc(doc(owner, 'users/B/snapshots/main'), snapshot));
    await assertFails(setDoc(doc(owner, 'users/A/snapshots/other'), snapshot));
    await assertFails(setDoc(doc(owner, root('g1'), target), snapshot));
  } finally { await legacy.cleanup(); }
});
