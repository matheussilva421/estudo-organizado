import { describe, expect, it } from 'vitest';

const builder = await import('../../src/js/sync/entity-state-builder.js?v=8.28');

describe('entity-state-builder.js', () => {
  it('rebuilds editais with nested disciplinas, assuntos and aulas', () => {
    const docs = [
      { key: 'editais/ed_1', collection: 'editais', id: 'ed_1', payload: { id: 'ed_1', nome: 'TRF' }, revision: 1 },
      { key: 'editais/ed_1/disciplinas/disc_1', collection: 'disciplinas', id: 'disc_1', payload: { id: 'disc_1', nome: 'Administrativo' }, revision: 1 },
      { key: 'editais/ed_1/disciplinas/disc_1/assuntos/ass_1', collection: 'assuntos', id: 'ass_1', payload: { id: 'ass_1', nome: 'Atos' }, revision: 1 },
      { key: 'editais/ed_1/disciplinas/disc_1/aulas/aula_1', collection: 'aulas', id: 'aula_1', payload: { id: 'aula_1', nome: 'Aula 01' }, revision: 1 }
    ];

    const partial = builder.rebuildStateFromEntityDocs(docs);

    expect(partial.editais[0]).toMatchObject({
      id: 'ed_1',
      disciplinas: [{
        id: 'disc_1',
        assuntos: [{ id: 'ass_1' }],
        aulas: [{ id: 'aula_1' }]
      }]
    });
  });

  it('omits tombstoned docs from visible collections', () => {
    const docs = [
      { key: 'eventos/ev_1', collection: 'eventos', id: 'ev_1', payload: { id: 'ev_1', titulo: 'Old' }, revision: 1 },
      { key: 'eventos/ev_1', collection: 'eventos', id: 'ev_1', payload: null, deletedAt: '2026-04-29T10:00:00.000Z', revision: 2 }
    ];

    const partial = builder.rebuildStateFromEntityDocs(docs);

    expect(partial.eventos).toEqual([]);
    expect(partial.config.entityTombstones).toEqual([
      expect.objectContaining({ key: 'eventos/ev_1', revision: 2 })
    ]);
  });
});
