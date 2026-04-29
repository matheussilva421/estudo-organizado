import { describe, expect, it } from 'vitest';

const schema = await import('../../src/js/sync/firestore-entity-schema.js?v=8.28');

describe('firestore-entity-schema.js', () => {
  it('encodes entity keys into Firestore-safe doc ids', () => {
    expect(schema.encodeEntityDocId('editais/ed_1')).toBe('editais%2Fed_1');
    expect(schema.decodeEntityDocId('editais%2Fed_1')).toBe('editais/ed_1');
  });

  it('creates an entity document from an active entity', () => {
    const entity = {
      id: 'ed_1',
      nome: 'TRF',
      _sync: {
        createdAt: '2026-04-29T09:00:00.000Z',
        updatedAt: '2026-04-29T10:00:00.000Z',
        deletedAt: null,
        revision: 3,
        updatedBy: 'web-a'
      }
    };

    const doc = schema.createFirestoreEntityDocument({
      key: 'editais/ed_1',
      collection: 'editais',
      id: 'ed_1',
      entity,
      schemaVersion: 9,
      sentAt: '2026-04-29T10:00:01.000Z'
    });

    expect(doc).toMatchObject({
      version: 1,
      schemaVersion: 9,
      key: 'editais/ed_1',
      collection: 'editais',
      id: 'ed_1',
      updatedAt: '2026-04-29T10:00:00.000Z',
      deletedAt: null,
      revision: 3,
      updatedBy: 'web-a',
      sentAt: '2026-04-29T10:00:01.000Z',
      payload: entity
    });
    expect(doc.checksum).toEqual(expect.any(String));
  });

  it('creates a tombstone entity document', () => {
    const doc = schema.createFirestoreTombstoneDocument({
      tombstone: {
        key: 'eventos/ev_1',
        collection: 'eventos',
        id: 'ev_1',
        deletedAt: '2026-04-29T10:00:00.000Z',
        deletedBy: 'web-a',
        revision: 4
      },
      schemaVersion: 9,
      sentAt: '2026-04-29T10:00:01.000Z'
    });

    expect(doc).toMatchObject({
      version: 1,
      key: 'eventos/ev_1',
      collection: 'eventos',
      id: 'ev_1',
      checksum: null,
      updatedAt: null,
      deletedAt: '2026-04-29T10:00:00.000Z',
      revision: 4,
      updatedBy: 'web-a',
      payload: null
    });
  });
});
