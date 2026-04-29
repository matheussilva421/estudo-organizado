import { describe, it, expect } from 'vitest';
import {
  visitTrackedEntities,
  stableEntityChecksum,
  pruneTombstones,
  createEntityIndex,
  buildEntityManifest,
  mergeEntityAwareArrays,
} from '../../src/js/sync/entity-metadata.js';

describe('entity-metadata.js', () => {
  describe('visitTrackedEntities()', () => {
    it('returns empty array for empty state', () => {
      expect(visitTrackedEntities({})).toEqual([]);
    });

    it('visits editais', () => {
      const state = { editais: [{ id: '1', nome: 'Test' }] };
      const entities = visitTrackedEntities(state);
      expect(entities).toHaveLength(1);
      expect(entities[0].collection).toBe('editais');
      expect(entities[0].key).toBe('editais/1');
    });

    it('visits nested disciplinas', () => {
      const state = {
        editais: [{ id: '1', disciplinas: [{ id: '2' }] }],
      };
      const entities = visitTrackedEntities(state);
      expect(entities).toHaveLength(2);
      expect(entities[1].collection).toBe('disciplinas');
      expect(entities[1].key).toBe('editais/1/disciplinas/2');
    });

    it('visits nested assuntos', () => {
      const state = {
        editais: [{ id: '1', disciplinas: [{ id: '2', assuntos: [{ id: '3' }] }] }],
      };
      const entities = visitTrackedEntities(state);
      const assunto = entities.find(e => e.collection === 'assuntos');
      expect(assunto).toBeDefined();
      expect(assunto.key).toBe('editais/1/disciplinas/2/assuntos/3');
    });

    it('visits nested aulas', () => {
      const state = {
        editais: [{ id: '1', disciplinas: [{ id: '2', aulas: [{ id: '4' }] }] }],
      };
      const entities = visitTrackedEntities(state);
      const aula = entities.find(e => e.collection === 'aulas');
      expect(aula).toBeDefined();
    });

    it('visits eventos', () => {
      const state = { eventos: [{ id: '1' }] };
      const entities = visitTrackedEntities(state);
      expect(entities[0].collection).toBe('eventos');
    });

    it('visits arquivo', () => {
      const state = { arquivo: [{ id: '1' }] };
      const entities = visitTrackedEntities(state);
      expect(entities[0].collection).toBe('arquivo');
    });

    it('visits revisoes', () => {
      const state = { revisoes: [{ id: '1' }] };
      const entities = visitTrackedEntities(state);
      expect(entities[0].collection).toBe('revisoes');
    });

    it('visits habitos by type', () => {
      const state = { habitos: { diarios: [{ id: '1' }] } };
      const entities = visitTrackedEntities(state);
      const habit = entities.find(e => e.collection === 'habitos.diarios');
      expect(habit).toBeDefined();
    });

    it('visits planejamento.sequencia', () => {
      const state = { planejamento: { sequencia: [{ id: '1' }] } };
      const entities = visitTrackedEntities(state);
      const plan = entities.find(e => e.collection === 'planejamento.sequencia');
      expect(plan).toBeDefined();
    });

    it('skips entities without id', () => {
      const state = { eventos: [{ nome: 'No ID' }] };
      const entities = visitTrackedEntities(state);
      expect(entities).toHaveLength(0);
    });
  });

  describe('stableEntityChecksum()', () => {
    it('returns same checksum for same entity', () => {
      const entity = { id: '1', nome: 'Test' };
      const checksum1 = stableEntityChecksum(entity);
      const checksum2 = stableEntityChecksum(entity);
      expect(checksum1).toBe(checksum2);
    });

    it('returns different checksum for different entities', () => {
      const checksum1 = stableEntityChecksum({ id: '1', nome: 'A' });
      const checksum2 = stableEntityChecksum({ id: '1', nome: 'B' });
      expect(checksum1).not.toBe(checksum2);
    });

    it('ignores _sync field in checksum', () => {
      const entity1 = { id: '1', nome: 'Test', _sync: { revision: 1 } };
      const entity2 = { id: '1', nome: 'Test', _sync: { revision: 2 } };
      expect(stableEntityChecksum(entity1)).toBe(stableEntityChecksum(entity2));
    });
  });

  describe('pruneTombstones()', () => {
    it('returns empty array for empty input', () => {
      expect(pruneTombstones([])).toEqual([]);
    });

    it('removes tombstones without key', () => {
      const tombstones = [{ deletedAt: '2024-01-01' }];
      expect(pruneTombstones(tombstones)).toEqual([]);
    });

    it('removes expired tombstones', () => {
      const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
      const tombstones = [{ key: 'a/1', deletedAt: oldDate }];
      expect(pruneTombstones(tombstones)).toEqual([]);
    });

    it('keeps recent tombstones', () => {
      const recentDate = new Date().toISOString();
      const tombstones = [{ key: 'a/1', deletedAt: recentDate }];
      const result = pruneTombstones(tombstones);
      expect(result).toHaveLength(1);
    });

    it('limits to 500 tombstones', () => {
      const recentDate = new Date().toISOString();
      const tombstones = Array.from({ length: 600 }, (_, i) => ({
        key: `a/${i}`,
        deletedAt: recentDate,
      }));
      const result = pruneTombstones(tombstones);
      expect(result).toHaveLength(500);
    });

    it('sorts by deletedAt descending', () => {
      const older = new Date(Date.now() - 1000).toISOString();
      const newer = new Date().toISOString();
      const tombstones = [
        { key: 'a/1', deletedAt: older },
        { key: 'a/2', deletedAt: newer },
      ];
      const result = pruneTombstones(tombstones);
      expect(result[0].key).toBe('a/2');
    });
  });

  describe('createEntityIndex()', () => {
    it('returns empty array for empty state', () => {
      expect(createEntityIndex({})).toEqual([]);
    });

    it('creates index entries with checksum', () => {
      const state = { eventos: [{ id: '1', nome: 'Test' }] };
      const index = createEntityIndex(state);
      expect(index).toHaveLength(1);
      expect(index[0].key).toBe('eventos/1');
      expect(index[0].checksum).toBeDefined();
      expect(index[0].revision).toBe(1);
    });

    it('uses _sync revision if present', () => {
      const state = { eventos: [{ id: '1', _sync: { revision: 5 } }] };
      const index = createEntityIndex(state);
      expect(index[0].revision).toBe(5);
    });
  });

  describe('buildEntityManifest()', () => {
    it('returns empty array for empty state', () => {
      expect(buildEntityManifest({})).toEqual([]);
    });

    it('includes active entities', () => {
      const state = { eventos: [{ id: '1' }] };
      const manifest = buildEntityManifest(state);
      expect(manifest).toHaveLength(1);
      expect(manifest[0].deletedAt).toBeNull();
      expect(manifest[0].checksum).toBeDefined();
    });

    it('includes tombstones', () => {
      const state = {
        config: {
          entityTombstones: [{ key: 'eventos/1', collection: 'eventos', id: '1', deletedAt: '2024-01-01', revision: 2 }],
        },
      };
      const manifest = buildEntityManifest(state);
      expect(manifest).toHaveLength(1);
      expect(manifest[0].deletedAt).toBe('2024-01-01T00:00:00.000Z');
      expect(manifest[0].checksum).toBeNull();
    });
  });

  describe('mergeEntityAwareArrays()', () => {
    it('merges arrays by id', () => {
      const local = [{ id: '1', nome: 'Local' }];
      const remote = [{ id: '2', nome: 'Remote' }];
      const merged = mergeEntityAwareArrays(local, remote);
      expect(merged).toHaveLength(2);
    });

    it('prefers local item when same id and no changes', () => {
      const local = [{ id: '1', nome: 'Local' }];
      const remote = [{ id: '1', nome: 'Remote' }];
      const merged = mergeEntityAwareArrays(local, remote);
      expect(merged).toHaveLength(1);
      expect(merged[0].nome).toBe('Local');
    });

    it('detects collision when both items differ', () => {
      const collisions = [];
      const local = [{ id: '1', nome: 'Local', _sync: { revision: 1, updatedAt: '2024-01-01' } }];
      const remote = [{ id: '1', nome: 'Remote', _sync: { revision: 1, updatedAt: '2024-01-01' } }];
      const merged = mergeEntityAwareArrays(local, remote, { collisions });
      expect(collisions).toHaveLength(1);
      expect(collisions[0].id).toBe('1');
    });

    it('prefers higher revision', () => {
      const local = [{ id: '1', nome: 'Local', _sync: { revision: 2 } }];
      const remote = [{ id: '1', nome: 'Remote', _sync: { revision: 1 } }];
      const merged = mergeEntityAwareArrays(local, remote);
      expect(merged[0].nome).toBe('Local');
    });

    it('prefers more recent updatedAt when revisions equal', () => {
      const local = [{ id: '1', nome: 'Local', _sync: { revision: 1, updatedAt: '2024-06-01' } }];
      const remote = [{ id: '1', nome: 'Remote', _sync: { revision: 1, updatedAt: '2024-01-01' } }];
      const merged = mergeEntityAwareArrays(local, remote);
      expect(merged[0].nome).toBe('Local');
    });

    it('handles empty arrays', () => {
      expect(mergeEntityAwareArrays([], [])).toEqual([]);
      expect(mergeEntityAwareArrays(null, [])).toEqual([]);
      expect(mergeEntityAwareArrays([], null)).toEqual([]);
    });
  });
});
