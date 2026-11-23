// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { convertBackupV12 } from '../../src/js/sync/v1-next/backup-codec.js';
import {
  compareRevisions, encodeDocId, encodeRecordData, entityCollectionForType,
  recordKey, validateManifest, validateRecord,
} from '../../src/js/sync/v1-next/contracts.js';

const stamp = { seconds: 1, nanoseconds: 0 };
const payload = { key: 'evento:1', entityType: 'evento', entityId: 1,
  path: ['eventos', 0], data: { id: 1 } };
const envelope = { schemaVersion: 1, generationId: 'g1', collection: 'eventos',
  entityType: 'evento', entityId: '1', revision: 1, baseRevision: 0, opId: 'o1',
  opDigest: 'a'.repeat(64), deleted: false, data: JSON.stringify(payload), updatedAt: stamp };
const counts = { editais: 0, disciplinas: 0, eventos: 0, habitos: 0, meta: 1,
  tombstones: 0, retaFinalBlocos: 0 };
const manifest = { schemaVersion: 1, generationId: 'g1', migrationId: 'm1',
  state: 'verified', revision: 0, sourceSha256: 'a'.repeat(64), businessDigest: 'b'.repeat(64),
  counts: { total: 1, byCollection: counts }, updatedAt: stamp };

describe('V1 remote contract', () => {
  it('keeps logical keys and uses injective UTF-8 document IDs', () => {
    expect(recordKey('evento', 1)).toBe('evento:1');
    expect(encodeDocId('evento:á/💾')).toBe('6576656e746f3ac3a12ff09f92be');
    expect(encodeDocId('evento:a/b')).not.toBe(encodeDocId('evento:a%2Fb'));
    for (const key of ['', 'á'.repeat(376), '\uD800']) expect(() => encodeDocId(key)).toThrow();
    expect(() => recordKey('habito.x:y', 1)).toThrow();
    expect(() => entityCollectionForType('constructor')).toThrow();
  });

  it('wraps actual T1 records reversibly including null, numeric ID and map tombstone', () => {
    const { records } = convertBackupV12({ schemaVersion: 12, editais: [
      { id: 'a', disciplinas: [{ id: 2, aulas: [], assuntos: [] }] }],
    eventos: [{ id: 'á/1' }], habitos: { 'questões/extra': [{ id: 3 }] }, planejamento: null,
    config: { entityTombstones: { 'eventos:a/b': 'old' } } });
    for (const [collection, items] of Object.entries(records)) {
      for (const item of items) {
        expect(entityCollectionForType(item.entityType)).toBe(collection);
        const data = encodeRecordData(item);
        expect(JSON.parse(data)).toStrictEqual(item);
        expect(validateRecord({ ...envelope, collection, entityId: String(item.entityId),
          entityType: item.entityType, data })).toBe(true);
      }
    }
  });

  it.each([{ role: 'admin' }, { revision: 0 }, { baseRevision: 2 }, { entityId: 1 },
    { schemaVersion: 12 }, { generationId: '../g' }, { opId: '__bad__' }, { entityId: 'other' },
    { collection: 'meta' }, { deleted: true }, { data: '{' }, { updatedAt: 'today' },
    { opDigest: 'abc' }])('rejects malformed envelope %j', patch => {
    expect(() => validateRecord({ ...envelope, ...patch })).toThrow();
  });

  it('bounds actual serialized UTF-8 bytes, shape and nested JSON before sending', () => {
    const item = { ...payload, data: { id: 1, texts: [] } };
    const room = 900 * 1024 - encodeRecordData(item).length - 11;
    item.data.texts = ['é'.repeat(100000), 'a'.repeat(240000), 'b'.repeat(240000),
      'c'.repeat(room - 680000)];
    expect(new globalThis.TextEncoder().encode(encodeRecordData(item)).length).toBe(900 * 1024);
    item.data.texts[3] += 'é';
    expect(() => encodeRecordData(item)).toThrow(/900 KiB/);
    for (const value of [Array(10001).fill(1), undefined, NaN, new Date()]) {
      expect(() => encodeRecordData({ ...payload, data: { id: 1, value } })).toThrow();
    }
    const discipline = { key: 'disciplina:1', entityId: 1, entityType: 'disciplina',
      path: ['editais', 0, 'disciplinas', 0], data: { id: 1, aulas: {} } };
    expect(() => encodeRecordData(discipline)).toThrow();
    expect(() => encodeRecordData({ key: 'meta:planejamento', entityType: 'meta',
      entityId: 'planejamento', path: ['planejamento'], data: { retaFinal: { blocos: {} } } })).toThrow();
  });

  it('validates a terminal delete and exact Admin manifest with baseline counts', () => {
    expect(validateRecord({ ...envelope, revision: 2, baseRevision: 1, deleted: true, data: null })).toBe(true);
    expect(validateManifest(manifest)).toBe(true);
    for (const patch of [{ state: 'ready' }, { revision: -1 }, { counts: { total: 2, byCollection: counts } },
      { counts: {} }, { migrationId: '' }, { sourceSha256: null }, { admin: true }]) {
      expect(() => validateManifest({ ...manifest, ...patch })).toThrow();
    }
  });

  it('orders safe nonnegative revisions without coercion', () => {
    expect([compareRevisions(1, 2), compareRevisions(2, 2), compareRevisions(3, 2)]).toEqual([-1, 0, 1]);
    for (const value of [-1, null, '1', 0.5, Infinity, 2 ** 53]) {
      expect(() => compareRevisions(0, value)).toThrow();
    }
  });
});
