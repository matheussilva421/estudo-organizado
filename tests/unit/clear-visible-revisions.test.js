import { describe, it, expect, vi, beforeEach } from 'vitest';
import { todayStr } from '../../src/js/utils.js?v=8.37';
import {
  createBaseState,
  createEdital,
  createDisciplina,
  createAssunto,
} from '../helpers/state-builders.js';

// clearVisibleRevisions deve ESVAZIAR a lista visível do escopo, drenando todo o
// backlog de cada assunto — não apenas pular a primeira ocorrência (que deixava
// o próximo nível ressurgir e a lista nunca esvaziava).

let mod;
let logic;
let state;
let scheduleSave;
let showToast;
let selectedEditalId;

async function setup(editais) {
  vi.resetModules();
  selectedEditalId = null;
  state = createBaseState({ editais });
  scheduleSave = vi.fn();
  showToast = vi.fn();

  vi.doMock('../../src/js/app.js?v=8.37', () => ({
    // showConfirm executa o callback de confirmação imediatamente
    showConfirm: vi.fn((_msg, onConfirm) => onConfirm()),
    showToast,
  }));
  vi.doMock('../../src/js/store.js?v=8.37', () => ({
    scheduleSave,
    state,
  }));
  // logic.js puxa sync-center e timer (grafo pesado); reexporta o módulo real
  // leve de revisões para que a matemática de datas use o `state` mockado.
  vi.doMock('../../src/js/logic.js?v=8.37', async () => {
    const real = await vi.importActual('../../src/js/logic/revisions.js?v=8.37');
    return {
      calcRevisionDates: real.calcRevisionDates,
      getPendingRevisoes: real.getPendingRevisoes,
      invalidateRevCache: real.invalidateRevCache,
      invalidatePendingRevCache: real.invalidatePendingRevCache,
    };
  });
  vi.doMock('../../src/js/components.js?v=8.37', () => ({ renderCurrentView: vi.fn() }));
  vi.doMock('../../src/js/edital-filter.js?v=8.37', () => ({
    getFilteredActiveDisciplinas: vi.fn(() => []),
    getSelectedEditalId: vi.fn(() => selectedEditalId),
  }));

  mod = await import('../../src/js/views/revisao-view.js?v=8.37');
  logic = await import('../../src/js/logic.js?v=8.37');
}

function pendingFor(assId) {
  logic.invalidatePendingRevCache();
  return logic.getPendingRevisoes().filter((r) => r.assunto.id === assId);
}

describe('clearVisibleRevisions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scope=pending: drena todo o backlog vencido do assunto (lista esvazia)', async () => {
    // Concluído há muito tempo → as 4 revisões [1,7,30,90] estão todas vencidas.
    const ass = createAssunto({
      id: 'ass_back',
      nome: 'Backlog',
      concluido: true,
      dataConclusao: '2020-01-01',
      revisoesFetas: [],
    });
    const editais = [
      createEdital({ id: 'ed_1', disciplinas: [createDisciplina({ assuntos: [ass] })] }),
    ];
    await setup(editais);

    // Sanidade: começa com 1 pendente (getPendingRevisoes só expõe a 1ª por assunto).
    expect(pendingFor('ass_back')).toHaveLength(1);

    mod.clearVisibleRevisions('pending');

    // Depois do clear, NENHUMA revisão pendente deve sobrar para o assunto.
    expect(pendingFor('ass_back')).toHaveLength(0);
    // Todas as 4 ocorrências viraram "feitas" (puladas).
    expect(ass.revisoesFetas).toHaveLength(4);
    expect(scheduleSave).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalled();
  });

  it('scope=upcoming: drena toda a janela de 30 dias do assunto', async () => {
    // Concluído hoje → revisões em +1, +7, +30 (dentro de 30d) e +90 (fora).
    const ass = createAssunto({
      id: 'ass_up',
      nome: 'Upcoming',
      concluido: true,
      dataConclusao: todayStr(),
      revisoesFetas: [],
    });
    const editais = [
      createEdital({ id: 'ed_1', disciplinas: [createDisciplina({ assuntos: [ass] })] }),
    ];
    await setup(editais);

    expect(mod.getUpcomingRevisoes(30).filter((r) => r.assunto.id === 'ass_up')).toHaveLength(1);

    mod.clearVisibleRevisions('upcoming');

    // A aba "Próximas 30 dias" deve esvaziar para o assunto.
    expect(mod.getUpcomingRevisoes(30).filter((r) => r.assunto.id === 'ass_up')).toHaveLength(0);
    // +1, +7, +30 puladas; +90 permanece fora da janela.
    expect(ass.revisoesFetas).toHaveLength(3);
  });

  it('respeita o filtro de edital: só drena os assuntos visíveis', async () => {
    const assA = createAssunto({
      id: 'ass_a',
      concluido: true,
      dataConclusao: '2020-01-01',
      revisoesFetas: [],
    });
    const assB = createAssunto({
      id: 'ass_b',
      concluido: true,
      dataConclusao: '2020-01-01',
      revisoesFetas: [],
    });
    const editais = [
      createEdital({ id: 'ed_1', disciplinas: [createDisciplina({ id: 'd_a', assuntos: [assA] })] }),
      createEdital({ id: 'ed_2', disciplinas: [createDisciplina({ id: 'd_b', assuntos: [assB] })] }),
    ];
    await setup(editais);
    selectedEditalId = 'ed_1';

    mod.clearVisibleRevisions('pending');

    // ed_1 limpo, ed_2 intacto.
    expect(pendingFor('ass_a')).toHaveLength(0);
    expect(pendingFor('ass_b')).toHaveLength(1);
    expect(assB.revisoesFetas).toHaveLength(0);
  });
});
