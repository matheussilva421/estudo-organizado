import { describe, expect, it } from 'vitest';

import { buildEntityDelta, splitDeltaIntoPages } from '../../src/js/sync/entity-delta-builder.js?v=8.32';
import { stableEntityChecksum } from '../../src/js/sync/entity-metadata.js?v=8.32';

function makeEntity(id, titulo, revision = 1) {
  return { id, titulo, _sync: { revision, updatedAt: '2026-05-01T10:00:00.000Z' } };
}

function makeState(eventos = [], editais = [], tombstones = []) {
  return {
    eventos,
    editais,
    arquivo: [],
    revisoes: [],
    habitos: {},
    planejamento: { sequencia: [] },
    config: { entityTombstones: tombstones, entitySync: { schemaVersion: 1 } },
  };
}

describe('sync/entity-delta-builder.js', () => {
  describe('buildEntityDelta()', () => {
    it('generates full batch when no previous meta exists', () => {
      const state = makeState([
        makeEntity('ev1', 'Evento 1'),
        makeEntity('ev2', 'Evento 2'),
      ]);
      const result = buildEntityDelta({ state, previousMeta: [] });

      expect(result.docs).toHaveLength(2);
      expect(result.fullRebuild).toBe(true);
      expect(result.changedCount).toBe(2);
      expect(result.unchangedCount).toBe(0);
    });

    it('generates only 1 doc when 1 event changed out of 500', () => {
      const eventos = [];
      const previousMeta = [];
      for (let i = 1; i <= 500; i++) {
        const entity = makeEntity(`ev${i}`, `Evento ${i}`, 1);
        eventos.push(entity);
        previousMeta.push({
          key: `eventos/ev${i}`,
          collection: 'eventos',
          id: `ev${i}`,
          checksum: stableEntityChecksum(entity),
          revision: 1,
        });
      }
      eventos[42].titulo = 'Evento 43 MODIFIED';
      eventos[42]._sync.revision = 2;

      const state = makeState(eventos);
      const result = buildEntityDelta({ state, previousMeta });

      expect(result.docs.length).toBeLessThanOrEqual(2);
      expect(result.unchangedCount).toBe(499);
      expect(result.changedCount).toBeGreaterThanOrEqual(1);
    });

    it('generates tombstone when entity is removed', () => {
      const state = makeState([], [], [
        { key: 'eventos/ev1', collection: 'eventos', id: 'ev1', deletedAt: '2026-05-01', revision: 2 },
      ]);
      const previousMeta = [
        { key: 'eventos/ev1', collection: 'eventos', id: 'ev1', checksum: 'abc', revision: 1 },
      ];

      const result = buildEntityDelta({ state, previousMeta });

      expect(result.tombstoneCount).toBeGreaterThanOrEqual(1);
      const tombstoneDoc = result.docs.find((d) => d.payload === null);
      expect(tombstoneDoc).toBeDefined();
      expect(tombstoneDoc.key).toBe('eventos/ev1');
    });

    it('marks fullRebuild when previous meta is empty and entities exist', () => {
      const state = makeState([makeEntity('ev1', 'Test')]);
      const result = buildEntityDelta({ state, previousMeta: [] });

      expect(result.fullRebuild).toBe(true);
    });

    it('marks not fullRebuild when previous meta matches', () => {
      const entity = makeEntity('ev1', 'Test', 1);
      const state = makeState([entity]);
      const previousMeta = [{
        key: 'eventos/ev1',
        collection: 'eventos',
        id: 'ev1',
        checksum: stableEntityChecksum(entity),
        revision: 1,
      }];

      const result = buildEntityDelta({ state, previousMeta });

      expect(result.fullRebuild).toBe(false);
      expect(result.docs).toHaveLength(0);
      expect(result.unchangedCount).toBe(1);
    });

    it('includes batchBytesEstimate', () => {
      const state = makeState([makeEntity('ev1', 'Test')]);
      const result = buildEntityDelta({ state, previousMeta: [] });

      expect(result.batchBytesEstimate).toBeGreaterThan(0);
    });

    it('handles state with no entities', () => {
      const state = makeState();
      const result = buildEntityDelta({ state, previousMeta: [] });

      expect(result.docs).toHaveLength(0);
      expect(result.changedCount).toBe(0);
      expect(result.unchangedCount).toBe(0);
    });
  });

  describe('splitDeltaIntoPages()', () => {
    it('returns single page when under limit', () => {
      const delta = { docs: Array(10).fill({ key: 'test' }) };
      const pages = splitDeltaIntoPages(delta);
      expect(pages).toHaveLength(1);
      expect(pages[0].docs).toHaveLength(10);
    });

    it('splits large delta into pages of max 450', () => {
      const delta = { docs: Array(500).fill({ key: 'test' }) };
      const pages = splitDeltaIntoPages(delta);
      expect(pages).toHaveLength(2);
      expect(pages[0].docs).toHaveLength(450);
      expect(pages[1].docs).toHaveLength(50);
    });

    it('handles empty docs', () => {
      const delta = { docs: [] };
      const pages = splitDeltaIntoPages(delta);
      expect(pages).toHaveLength(1);
      expect(pages[0].docs).toHaveLength(0);
    });
  });
});
