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

  it('handles entity without _sync', () => {
    const doc = schema.createFirestoreEntityDocument({
      key: 'eventos/1',
      collection: 'eventos',
      id: '1',
      entity: { id: '1', nome: 'Test' },
      schemaVersion: 9,
    });
    expect(doc.revision).toBe(1);
    expect(doc.updatedAt).toBeNull();
    expect(doc.updatedBy).toBeNull();
    expect(doc.checksum).toBeDefined();
  });

  it('handles null entity', () => {
    const doc = schema.createFirestoreEntityDocument({
      key: 'eventos/1',
      collection: 'eventos',
      id: '1',
      entity: null,
      schemaVersion: 9,
    });
    expect(doc.revision).toBe(1);
    expect(doc.payload).toBeNull();
  });

  it('uses current time for sentAt when not provided', () => {
    const doc = schema.createFirestoreEntityDocument({
      key: 'eventos/1',
      collection: 'eventos',
      id: '1',
      entity: { id: '1' },
      schemaVersion: 9,
    });
    expect(doc.sentAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('tombstone uses updatedBy as fallback for deletedBy', () => {
    const doc = schema.createFirestoreTombstoneDocument({
      tombstone: {
        key: 'eventos/1',
        collection: 'eventos',
        id: '1',
        updatedBy: 'user123',
      },
      schemaVersion: 9,
    });
    expect(doc.updatedBy).toBe('user123');
  });

  it('tombstone defaults revision to 1', () => {
    const doc = schema.createFirestoreTombstoneDocument({
      tombstone: {
        key: 'eventos/1',
        collection: 'eventos',
        id: '1',
      },
      schemaVersion: 9,
    });
    expect(doc.revision).toBe(1);
  });

  it('encodes special characters in doc id', () => {
    expect(schema.encodeEntityDocId('habitos.diarios/1')).toBe('habitos.diarios%2F1');
  });

  it('decodes special characters from doc id', () => {
    expect(schema.decodeEntityDocId('habitos.diarios%2F1')).toBe('habitos.diarios/1');
  });
});
