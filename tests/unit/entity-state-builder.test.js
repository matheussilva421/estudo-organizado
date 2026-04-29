import { describe, it, expect } from 'vitest';
import {
  pickNewestEntityDocs,
  rebuildStateFromEntityDocs,
  applyEntityDocsToState,
  replaceEntityInStateByRecord,
} from '../../src/js/sync/entity-state-builder.js';

describe('entity-state-builder.js', () => {
  describe('pickNewestEntityDocs()', () => {
    it('returns empty array for empty input', () => {
      expect(pickNewestEntityDocs([])).toEqual([]);
    });

    it('returns single doc unchanged', () => {
      const docs = [{ key: 'a/1', revision: 1 }];
      expect(pickNewestEntityDocs(docs)).toEqual(docs);
    });

    it('picks newest revision for same key', () => {
      const docs = [
        { key: 'a/1', revision: 1, payload: { name: 'old' } },
        { key: 'a/1', revision: 3, payload: { name: 'new' } },
        { key: 'a/1', revision: 2, payload: { name: 'mid' } },
      ];
      const result = pickNewestEntityDocs(docs);
      expect(result).toHaveLength(1);
      expect(result[0].revision).toBe(3);
    });

    it('keeps different keys separate', () => {
      const docs = [
        { key: 'a/1', revision: 1 },
        { key: 'b/2', revision: 1 },
      ];
      expect(pickNewestEntityDocs(docs)).toHaveLength(2);
    });

    it('handles missing revision as 0', () => {
      const docs = [
        { key: 'a/1' },
        { key: 'a/1', revision: 1 },
      ];
      const result = pickNewestEntityDocs(docs);
      expect(result).toHaveLength(1);
      expect(result[0].revision).toBe(1);
    });
  });

  describe('rebuildStateFromEntityDocs()', () => {
    it('returns default empty state for empty input', () => {
      const state = rebuildStateFromEntityDocs([]);
      expect(state.editais).toEqual([]);
      expect(state.eventos).toEqual([]);
      expect(state.arquivo).toEqual([]);
      expect(state.revisoes).toEqual([]);
      expect(state.habitos).toEqual({});
      expect(state.planejamento).toEqual({ sequencia: [] });
      expect(state.config).toEqual({ entityTombstones: [] });
    });

    it('rebuilds editais collection', () => {
      const docs = [
        { key: 'editais/1', collection: 'editais', id: '1', revision: 1, payload: { id: '1', nome: 'Test' } },
      ];
      const state = rebuildStateFromEntityDocs(docs);
      expect(state.editais).toHaveLength(1);
      expect(state.editais[0].nome).toBe('Test');
      expect(state.editais[0].disciplinas).toEqual([]);
    });

    it('rebuilds eventos collection', () => {
      const docs = [
        { key: 'eventos/1', collection: 'eventos', id: '1', revision: 1, payload: { id: '1', titulo: 'Aula' } },
      ];
      const state = rebuildStateFromEntityDocs(docs);
      expect(state.eventos).toHaveLength(1);
      expect(state.eventos[0].titulo).toBe('Aula');
    });

    it('rebuilds arquivo collection', () => {
      const docs = [
        { key: 'arquivo/1', collection: 'arquivo', id: '1', revision: 1, payload: { id: '1', nome: 'PDF' } },
      ];
      const state = rebuildStateFromEntityDocs(docs);
      expect(state.arquivo).toHaveLength(1);
    });

    it('rebuilds revisoes collection', () => {
      const docs = [
        { key: 'revisoes/1', collection: 'revisoes', id: '1', revision: 1, payload: { id: '1' } },
      ];
      const state = rebuildStateFromEntityDocs(docs);
      expect(state.revisoes).toHaveLength(1);
    });

    it('rebuilds habitos by type', () => {
      const docs = [
        { key: 'habitos.diarios/1', collection: 'habitos.diarios', id: '1', revision: 1, payload: { id: '1' } },
      ];
      const state = rebuildStateFromEntityDocs(docs);
      expect(state.habitos.diarios).toHaveLength(1);
    });

    it('rebuilds planejamento.sequencia', () => {
      const docs = [
        { key: 'planejamento.sequencia/1', collection: 'planejamento.sequencia', id: '1', revision: 1, payload: { id: '1' } },
      ];
      const state = rebuildStateFromEntityDocs(docs);
      expect(state.planejamento.sequencia).toHaveLength(1);
    });

    it('creates tombstone for deleted entities', () => {
      const docs = [
        { key: 'eventos/1', collection: 'eventos', id: '1', revision: 1, payload: { id: '1' }, deletedAt: '2024-01-01', updatedBy: 'user1' },
      ];
      const state = rebuildStateFromEntityDocs(docs);
      expect(state.eventos).toHaveLength(0);
      expect(state.config.entityTombstones).toHaveLength(1);
      expect(state.config.entityTombstones[0].key).toBe('eventos/1');
    });

    it('creates tombstone for null payload', () => {
      const docs = [
        { key: 'eventos/1', collection: 'eventos', id: '1', revision: 1, payload: null },
      ];
      const state = rebuildStateFromEntityDocs(docs);
      expect(state.eventos).toHaveLength(0);
      expect(state.config.entityTombstones).toHaveLength(1);
    });

    it('nests disciplinas under editais', () => {
      const docs = [
        { key: 'editais/1', collection: 'editais', id: '1', revision: 1, payload: { id: '1' } },
        { key: 'editais/1/disciplinas/2', collection: 'disciplinas', id: '2', revision: 1, payload: { id: '2' } },
      ];
      const state = rebuildStateFromEntityDocs(docs);
      expect(state.editais[0].disciplinas).toHaveLength(1);
    });

    it('nests assuntos and aulas under disciplinas', () => {
      const docs = [
        { key: 'editais/1', collection: 'editais', id: '1', revision: 1, payload: { id: '1' } },
        { key: 'editais/1/disciplinas/2', collection: 'disciplinas', id: '2', revision: 1, payload: { id: '2' } },
        { key: 'editais/1/disciplinas/2/assuntos/3', collection: 'assuntos', id: '3', revision: 1, payload: { id: '3' } },
        { key: 'editais/1/disciplinas/2/aulas/4', collection: 'aulas', id: '4', revision: 1, payload: { id: '4' } },
      ];
      const state = rebuildStateFromEntityDocs(docs);
      const disc = state.editais[0].disciplinas[0];
      expect(disc.assuntos).toHaveLength(1);
      expect(disc.aulas).toHaveLength(1);
    });
  });

  describe('applyEntityDocsToState()', () => {
    it('merges rebuilt state with base state', () => {
      const base = { custom: 'value', habitos: { diarios: [] }, planejamento: { other: true } };
      const docs = [
        { key: 'eventos/1', collection: 'eventos', id: '1', revision: 1, payload: { id: '1' } },
      ];
      const result = applyEntityDocsToState(base, docs);
      expect(result.custom).toBe('value');
      expect(result.eventos).toHaveLength(1);
    });

    it('preserves base habitos not in docs', () => {
      const base = { habitos: { diarios: [{ id: 'existing' }] } };
      const docs = [];
      const result = applyEntityDocsToState(base, docs);
      expect(result.habitos.diarios).toEqual([{ id: 'existing' }]);
    });

    it('overwrites habitos from docs', () => {
      const base = { habitos: { diarios: [{ id: 'old' }] } };
      const docs = [
        { key: 'habitos.diarios/1', collection: 'habitos.diarios', id: '1', revision: 1, payload: { id: 'new' } },
      ];
      const result = applyEntityDocsToState(base, docs);
      expect(result.habitos.diarios).toHaveLength(1);
      expect(result.habitos.diarios[0].id).toBe('new');
    });
  });

  describe('replaceEntityInStateByRecord()', () => {
    it('returns false for invalid record', () => {
      expect(replaceEntityInStateByRecord({}, null)).toBe(false);
      expect(replaceEntityInStateByRecord({}, {})).toBe(false);
      expect(replaceEntityInStateByRecord({}, { entity: {} })).toBe(false);
    });

    it('replaces edital in state', () => {
      const state = { editais: [{ id: '1', nome: 'old' }] };
      const record = { collection: 'editais', id: '1', entity: { id: '1', nome: 'new' } };
      const result = replaceEntityInStateByRecord(state, record);
      expect(result).toBe(true);
      expect(state.editais[0].nome).toBe('new');
    });

    it('returns false when edital not found', () => {
      const state = { editais: [{ id: '1' }] };
      const record = { collection: 'editais', id: '2', entity: { id: '2' } };
      expect(replaceEntityInStateByRecord(state, record)).toBe(false);
    });

    it('replaces evento in state', () => {
      const state = { eventos: [{ id: '1', titulo: 'old' }] };
      const record = { collection: 'eventos', id: '1', entity: { id: '1', titulo: 'new' } };
      const result = replaceEntityInStateByRecord(state, record);
      expect(result).toBe(true);
      expect(state.eventos[0].titulo).toBe('new');
    });

    it('replaces arquivo in state', () => {
      const state = { arquivo: [{ id: '1' }] };
      const record = { collection: 'arquivo', id: '1', entity: { id: '1', nome: 'new' } };
      expect(replaceEntityInStateByRecord(state, record)).toBe(true);
    });

    it('replaces revisao in state', () => {
      const state = { revisoes: [{ id: '1' }] };
      const record = { collection: 'revisoes', id: '1', entity: { id: '1' } };
      expect(replaceEntityInStateByRecord(state, record)).toBe(true);
    });

    it('replaces habito in state', () => {
      const state = { habitos: { diarios: [{ id: '1' }] } };
      const record = { collection: 'habitos.diarios', id: '1', entity: { id: '1', nome: 'new' } };
      expect(replaceEntityInStateByRecord(state, record)).toBe(true);
      expect(state.habitos.diarios[0].nome).toBe('new');
    });

    it('replaces planejamento item in state', () => {
      const state = { planejamento: { sequencia: [{ id: '1' }] } };
      const record = { collection: 'planejamento.sequencia', id: '1', entity: { id: '1' } };
      expect(replaceEntityInStateByRecord(state, record)).toBe(true);
    });

    it('replaces disciplina under edital', () => {
      const state = { editais: [{ id: '1', disciplinas: [{ id: '2' }] }] };
      const record = { collection: 'disciplinas', id: '2', key: 'editais/1/disciplinas/2', entity: { id: '2', nome: 'new' } };
      expect(replaceEntityInStateByRecord(state, record)).toBe(true);
      expect(state.editais[0].disciplinas[0].nome).toBe('new');
    });

    it('replaces assunto under disciplina', () => {
      const state = { editais: [{ id: '1', disciplinas: [{ id: '2', assuntos: [{ id: '3' }] }] }] };
      const record = { collection: 'assuntos', id: '3', key: 'editais/1/disciplinas/2/assuntos/3', entity: { id: '3', nome: 'new' } };
      expect(replaceEntityInStateByRecord(state, record)).toBe(true);
      expect(state.editais[0].disciplinas[0].assuntos[0].nome).toBe('new');
    });

    it('replaces aula under disciplina', () => {
      const state = { editais: [{ id: '1', disciplinas: [{ id: '2', aulas: [{ id: '4' }] }] }] };
      const record = { collection: 'aulas', id: '4', key: 'editais/1/disciplinas/2/aulas/4', entity: { id: '4', nome: 'new' } };
      expect(replaceEntityInStateByRecord(state, record)).toBe(true);
    });

    it('returns false when edital not found for nested collection', () => {
      const state = { editais: [] };
      const record = { collection: 'disciplinas', id: '2', key: 'editais/99/disciplinas/2', entity: {} };
      expect(replaceEntityInStateByRecord(state, record)).toBe(false);
    });

    it('returns false when disciplina not found for assuntos/aulas', () => {
      const state = { editais: [{ id: '1', disciplinas: [] }] };
      const record = { collection: 'assuntos', id: '3', key: 'editais/1/disciplinas/99/assuntos/3', entity: {} };
      expect(replaceEntityInStateByRecord(state, record)).toBe(false);
    });
  });
});
