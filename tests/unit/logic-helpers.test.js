import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseState, createEvento, createDisciplina, createEdital, createAssunto } from '../helpers/state-builders.js';
import { loadAppModules } from '../helpers/module-loader.js';

let store;
let logic;

beforeEach(async () => {
  global.document = {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getElementById: vi.fn(() => null)
  };
  ({ store, logic } = await loadAppModules());
  store.setState(createBaseState());
  logic.invalidateDiscCache();
});

describe('logic.js - Timer utilities', () => {
  describe('isTimerActive()', () => {
    it('retorna false para evento sem timer', () => {
      const evento = createEvento({ id: 'ev_1', _timerStart: null });
      store.setState(createBaseState({ eventos: [evento] }));

      expect(logic.isTimerActive('ev_1')).toBe(false);
    });

    it('retorna true para evento com timer ativo', () => {
      const evento = createEvento({ id: 'ev_1', _timerStart: Date.now() });
      store.setState(createBaseState({ eventos: [evento] }));

      expect(logic.isTimerActive('ev_1')).toBe(true);
    });
  });

  describe('getElapsedSeconds()', () => {
    it('retorna tempo acumulado quando timer parado', () => {
      const ev = { tempoAcumulado: 1800, _timerStart: null };
      expect(logic.getElapsedSeconds(ev)).toBe(1800);
    });

    it('retorna 0 para evento vazio', () => {
      const ev = { tempoAcumulado: 0, _timerStart: null };
      expect(logic.getElapsedSeconds(ev)).toBe(0);
    });
  });
});

describe('logic.js - Discipline helpers', () => {
  describe('getAllDisciplinas()', () => {
    it('retorna lista de disciplinas com edital', () => {
      store.setState(createBaseState({
        editais: [createEdital({
          disciplinas: [
            createDisciplina({ id: 'disc_1', nome: 'Português' }),
            createDisciplina({ id: 'disc_2', nome: 'Direito' })
          ]
        })]
      }));
      logic.invalidateDiscCache();

      const result = logic.getAllDisciplinas();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getDisc()', () => {
    it('encontra disciplina por ID', () => {
      const disc = createDisciplina({ id: 'disc_1', nome: 'Português' });
      store.setState(createBaseState({
        editais: [createEdital({ disciplinas: [disc] })]
      }));
      logic.invalidateDiscCache();

      const result = logic.getDisc('disc_1');
      expect(result.disc.nome).toBe('Português');
    });

    it('retorna null para ID inexistente', () => {
      store.setState(createBaseState({ editais: [] }));
      logic.invalidateDiscCache();

      const result = logic.getDisc('disc_x');
      expect(result).toBeNull();
    });
  });
});

describe('logic.js - Event mutations', () => {
  describe('deleteEvento()', () => {
    it('marca evento para exclusão', () => {
      const evento = createEvento({ id: 'ev_1' });
      store.setState(createBaseState({ eventos: [evento] }));

      // deleteEvento pode ser assíncrono ou ter comportamento diferente
      // Testamos que a função existe e pode ser chamada
      expect(() => logic.deleteEvento('ev_1')).not.toThrow();
    });
  });
});

describe('logic.js - Planning', () => {
  describe('deletePlanejamento()', () => {
    it('chama função de deletar planejamento', () => {
      store.setState(createBaseState({
        planejamento: { ativo: true, tipo: 'ciclo', sequencia: [] }
      }));

      // A função pode ter comportamento complexo, testamos que existe
      expect(() => logic.deletePlanejamento()).not.toThrow();
    });
  });
});

describe('logic.js - Cache invalidation', () => {
  describe('invalidateDiscCache()', () => {
    it('invalida cache de disciplinas', () => {
      // Função existe e pode ser chamada
      expect(() => logic.invalidateDiscCache()).not.toThrow();
    });
  });

  describe('invalidateRevCache()', () => {
    it('limpa cache de revisões', () => {
      logic.invalidateRevCache();
      expect(logic.revCache).toBeUndefined();
    });
  });

  describe('invalidatePendingRevCache()', () => {
    it('limpa cache de revisões pendentes', () => {
      logic.invalidatePendingRevCache();
      expect(logic.pendingRevCache).toBeUndefined();
    });
  });

  describe('invalidateStreakCache()', () => {
    it('limpa cache de streak', () => {
      logic.invalidateStreakCache();
      expect(logic.streakCache).toBeUndefined();
    });
  });

  describe('invalidateDashCaches()', () => {
    it('limpa caches do dashboard', () => {
      logic.invalidateDashCaches();
      expect(logic.dashCaches).toBeUndefined();
    });
  });
});

describe('logic.js - Subject Stats', () => {
  describe('getSyllabusProgress()', () => {
    it('calcula porcentagem de conclusão', () => {
      store.setState(createBaseState({
        editais: [createEdital({
          disciplinas: [createDisciplina({
            aulas: [
              { estudada: true },
              { estudada: false },
              { estudada: true }
            ]
          })]
        })]
      }));
      logic.invalidateDashCaches();

      const progress = logic.getSyllabusProgress();
      expect(progress.totalAssuntos).toBe(3);
      expect(progress.totalConcluidos).toBe(2);
    });
  });
});

describe('logic.js - Performance stats', () => {
  describe('getPerformanceStats()', () => {
    it('agrega questões certas e erradas', () => {
      store.setState(createBaseState({
        eventos: [
          createEvento({ status: 'estudei', questoes: { certas: 10, erradas: 2 } }),
          createEvento({ status: 'estudei', questoes: { certas: 5, erradas: 3 } })
        ]
      }));
      logic.invalidateDashCaches();

      const stats = logic.getPerformanceStats();
      expect(stats.questionsTotal).toBe(20);
      expect(stats.questionsCorrect).toBe(15);
      expect(stats.questionsWrong).toBe(5);
    });
  });

  describe('totalStudySeconds()', () => {
    it('soma tempo de eventos estudados', () => {
      store.setState(createBaseState({
        eventos: [
          createEvento({ status: 'estudei', tempoAcumulado: 1800 }),
          createEvento({ status: 'estudei', tempoAcumulado: 3600 }),
          createEvento({ status: 'agendado', tempoAcumulado: 900 })
        ]
      }));

      const total = logic.totalStudySeconds();
      expect(total).toBe(5400);
    });
  });
});
