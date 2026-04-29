import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseState } from '../helpers/state-builders.js';
import { loadAppModules } from '../helpers/module-loader.js';

let store;

beforeEach(async () => {
  vi.useFakeTimers();
  ({ store } = await loadAppModules());
  store.setState(createBaseState());
  localStorage.clear();
  sessionStorage.clear();
});

describe('store.js', () => {
  it('createExportableState strips sync secrets without mutating local state', () => {
    store.setState(createBaseState({
      config: {
        cfSyncEnabled: true,
        cfUrl: 'https://sync.example.test',
        cfToken: 'super-secret-token',
        cfTokenSaved: true,
        cfConflict: { remoteDeviceId: 'device-a' },
        cfRemoteUpdatedAt: '2026-04-19T11:00:00.000Z',
        cfLastSyncAt: '2026-04-19T12:00:00.000Z',
        _lastUpdated: 1770000000000,
        entityTombstones: [{
          key: 'eventos/ev-1',
          collection: 'eventos',
          id: 'ev-1',
          deletedAt: '2026-04-29T10:00:00.000Z',
          revision: 2
        }]
      }
    }));

    const exportable = store.createExportableState();

    expect(exportable.config.cfUrl).toBeUndefined();
    expect(exportable.config.cfToken).toBeUndefined();
    expect(exportable.config.cfTokenSaved).toBeUndefined();
    expect(exportable.config.cfConflict).toBeUndefined();
    expect(exportable.config._lastUpdated).toBeUndefined();
    expect(exportable.config.entityTombstones).toHaveLength(1);
    expect(exportable.config.cfSyncEnabled).toBe(false);
    expect(exportable.config.firestoreSync.enabled).toBe(false);
    expect(store.state.config.cfToken).toBe('super-secret-token');
  });

  it('declares Firestore local-first IndexedDB stores', () => {
    expect(store.DB_VERSION).toBeGreaterThanOrEqual(4);
    expect(store.FIRESTORE_OUTBOX_STORE).toBe('firestore_outbox');
    expect(store.FIRESTORE_META_STORE).toBe('firestore_meta');
    expect(store.FIRESTORE_CONFLICT_STORE).toBe('firestore_conflicts');
    expect(store.ENTITY_META_STORE).toBe('entity_meta');
  });

  it('clearData also clears isolated credentials', async () => {
    const credentials = await import('../../src/js/credentials.js?v=8.28');
    const spy = vi.spyOn(credentials, 'clearAllCredentials').mockResolvedValue(undefined);

    store.clearData();

    expect(spy).toHaveBeenCalled();
  });

  it('setState normalizes missing collections and config defaults', () => {
    store.setState({
      schemaVersion: 7,
      editais: null,
      eventos: null,
      config: { visualizacao: 'semana' }
    });

    expect(store.state.editais).toEqual([]);
    expect(store.state.eventos).toEqual([]);
    expect(store.state.config.visualizacao).toBe('semana');
    expect(store.state.config.materiasPorDia).toBe(3);
    expect(store.state.config.entityTombstones).toEqual([]);
    expect(store.state.habitos.videoaula).toEqual([]);
  });

  it('runMigrations upgrades legacy state to schema version 7 and separates lesson-like topics', () => {
    store.setState({
      schemaVersion: 1,
      editais: [
        {
          nome: 'TRF',
          grupos: [
            {
              disciplinas: [
                {
                  nome: 'Direito Administrativo',
                  assuntos: [
                    { nome: 'Aula 01 - Atos Administrativos', concluido: true, dataConclusao: '2026-04-10' },
                    { nome: 'Poderes Administrativos', concluido: false }
                  ]
                }
              ]
            }
          ]
        }
      ],
      config: { frequenciaRevisao: '1,7,30,90' }
    });

    store.runMigrations();
    vi.runOnlyPendingTimers();

    expect(store.state.schemaVersion).toBe(9);
    expect(store.state.editais[0].id).toMatch(/^ed_/);
    expect(store.state.editais[0]._sync).toMatchObject({ revision: 1 });
    expect(store.state.editais[0].disciplinas[0].id).toMatch(/^disc_/);
    expect(store.state.editais[0].disciplinas[0].assuntos).toHaveLength(1);
    expect(store.state.editais[0].disciplinas[0].aulas).toHaveLength(1);
    expect(store.state.editais[0].disciplinas[0].aulas[0]).toMatchObject({
      estudada: true,
      dataEstudo: '2026-04-10',
      _migratedFromV6: true
    });
    expect(store.state.editais[0].disciplinas[0].arquivada).toBe(false);
    expect(store.state.editais[0].disciplinas[0].arquivadaEm).toBeNull();
    expect(store.state.config.frequenciaRevisao).toEqual([1, 7, 30, 90]);
    expect(store.state.bancaRelevance.lessonMappings).toEqual({});
  });
});
