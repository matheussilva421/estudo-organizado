import { describe, expect, it } from 'vitest';

const metadata = await import('../../src/js/sync/entity-metadata.js?v=8.26');

describe('entity-metadata.js', () => {
  it('normalizes legacy entities with embedded sync metadata without changing domain fields', () => {
    const state = {
      editais: [
        {
          id: 'ed-1',
          nome: 'TRF',
          disciplinas: [
            {
              id: 'disc-1',
              nome: 'Administrativo',
              assuntos: [{ id: 'ass-1', nome: 'Atos', concluido: false }],
              aulas: [{ id: 'aula-1', nome: 'Aula 01', progress: 10 }]
            }
          ]
        }
      ],
      eventos: [{ id: 'ev-1', titulo: 'Estudar', data: '2026-04-29' }],
      habitos: { questoes: [{ id: 'hab-1', total: 20 }] },
      planejamento: { sequencia: [{ id: 'seq-1', discId: 'disc-1' }] },
      config: {}
    };

    const result = metadata.normalizeEntityMetadata(state, {
      now: '2026-04-29T10:00:00.000Z',
      updatedBy: 'device-a',
      baselineOnly: true
    });

    expect(state.editais[0]).toMatchObject({ id: 'ed-1', nome: 'TRF' });
    expect(state.editais[0]._sync).toMatchObject({
      createdAt: '2026-04-29T10:00:00.000Z',
      updatedAt: '2026-04-29T10:00:00.000Z',
      revision: 1,
      updatedBy: 'device-a'
    });
    expect(state.editais[0].disciplinas[0].assuntos[0]._sync.revision).toBe(1);
    expect(result.index.map(item => item.collection)).toEqual([
      'editais',
      'disciplinas',
      'assuntos',
      'aulas',
      'eventos',
      'habitos.questoes',
      'planejamento.sequencia'
    ]);
    expect(state.config.entityTombstones).toEqual([]);
  });

  it('detects content edits by checksum and increments revisions', () => {
    const state = {
      editais: [{ id: 'ed-1', nome: 'TRF 2', _sync: { createdAt: '2026-04-28T10:00:00.000Z', updatedAt: '2026-04-28T10:00:00.000Z', revision: 1, updatedBy: 'device-a' } }],
      config: {}
    };

    const previousIndex = new Map([
      ['editais/ed-1', {
        key: 'editais/ed-1',
        collection: 'editais',
        id: 'ed-1',
        checksum: metadata.stableEntityChecksum({ id: 'ed-1', nome: 'TRF' }),
        updatedAt: '2026-04-28T10:00:00.000Z',
        revision: 1
      }]
    ]);

    const result = metadata.normalizeEntityMetadata(state, {
      now: '2026-04-29T10:00:00.000Z',
      updatedBy: 'device-b',
      previousIndex
    });

    expect(state.editais[0]._sync).toMatchObject({
      createdAt: '2026-04-28T10:00:00.000Z',
      updatedAt: '2026-04-29T10:00:00.000Z',
      revision: 2,
      updatedBy: 'device-b'
    });
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0]).toMatchObject({ key: 'editais/ed-1', revision: 2 });
  });

  it('detects removals and creates capped tombstones', () => {
    const old = '2025-09-01T00:00:00.000Z';
    const state = {
      editais: [],
      config: {
        entityTombstones: Array.from({ length: 501 }, (_, index) => ({
          key: `editais/old-${index}`,
          collection: 'editais',
          id: `old-${index}`,
          deletedAt: index === 0 ? old : '2026-04-28T10:00:00.000Z',
          revision: 1
        }))
      }
    };
    const previousIndex = new Map([
      ['editais/ed-1', {
        key: 'editais/ed-1',
        collection: 'editais',
        id: 'ed-1',
        checksum: 'abc',
        updatedAt: '2026-04-28T10:00:00.000Z',
        revision: 3
      }]
    ]);

    const result = metadata.normalizeEntityMetadata(state, {
      now: '2026-04-29T10:00:00.000Z',
      updatedBy: 'device-c',
      previousIndex
    });

    expect(result.removed).toEqual([expect.objectContaining({
      key: 'editais/ed-1',
      deletedAt: '2026-04-29T10:00:00.000Z',
      revision: 4,
      deletedBy: 'device-c'
    })]);
    expect(state.config.entityTombstones).toHaveLength(500);
    expect(state.config.entityTombstones[0].key).not.toBe('editais/old-0');
    expect(state.config.entityTombstones.some(item => item.key === 'editais/ed-1')).toBe(true);
  });

  it('builds a Firestore entity manifest from active entities and tombstones', () => {
    const state = {
      editais: [{ id: 'ed-1', nome: 'TRF', _sync: { updatedAt: '2026-04-29T10:00:00.000Z', revision: 2 } }],
      config: {
        entityTombstones: [{
          key: 'eventos/ev-1',
          collection: 'eventos',
          id: 'ev-1',
          deletedAt: '2026-04-29T11:00:00.000Z',
          revision: 3
        }]
      }
    };

    expect(metadata.buildEntityManifest(state)).toEqual([
      expect.objectContaining({
        key: 'editais/ed-1',
        collection: 'editais',
        id: 'ed-1',
        updatedAt: '2026-04-29T10:00:00.000Z',
        revision: 2,
        checksum: expect.any(String)
      }),
      {
        key: 'eventos/ev-1',
        collection: 'eventos',
        id: 'ev-1',
        updatedAt: null,
        deletedAt: '2026-04-29T11:00:00.000Z',
        revision: 3,
        checksum: null
      }
    ]);
  });

  it('merges arrays using entity revisions and reports ambiguous collisions', () => {
    const collisions = [];
    const merged = metadata.mergeEntityAwareArrays([
      { id: 'safe', nome: 'Local antigo', _sync: { revision: 1, updatedAt: '2026-04-28T10:00:00.000Z' } },
      { id: 'ambiguous', nome: 'Local' }
    ], [
      { id: 'safe', nome: 'Remoto novo', _sync: { revision: 2, updatedAt: '2026-04-29T10:00:00.000Z' } },
      { id: 'ambiguous', nome: 'Remoto' }
    ], { collection: 'editais', collisions });

    expect(merged.find(item => item.id === 'safe').nome).toBe('Remoto novo');
    expect(merged.find(item => item.id === 'ambiguous').nome).toBe('Local');
    expect(collisions).toEqual([expect.objectContaining({
      collection: 'editais',
      id: 'ambiguous',
      localRevision: null,
      remoteRevision: null
    })]);
  });
});
