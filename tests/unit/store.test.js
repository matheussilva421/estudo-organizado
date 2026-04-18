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

    expect(store.state.schemaVersion).toBe(7);
    expect(store.state.editais[0].id).toMatch(/^ed_/);
    expect(store.state.editais[0].disciplinas[0].id).toMatch(/^disc_/);
    expect(store.state.editais[0].disciplinas[0].assuntos).toHaveLength(1);
    expect(store.state.editais[0].disciplinas[0].aulas).toHaveLength(1);
    expect(store.state.editais[0].disciplinas[0].aulas[0]).toMatchObject({
      estudada: true,
      dataEstudo: '2026-04-10',
      _migratedFromV6: true
    });
    expect(store.state.config.frequenciaRevisao).toEqual([1, 7, 30, 90]);
    expect(store.state.bancaRelevance.lessonMappings).toEqual({});
  });
});
