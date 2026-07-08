import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAppModules } from '../helpers/module-loader.js';
import {
  createBaseState,
  createEvento,
  createDisciplina,
  createAssunto,
  createEdital,
} from '../helpers/state-builders.js';

vi.mock('../../src/js/app.js?v=8.37', () => ({
  openModal: vi.fn(),
  closeModal: vi.fn(),
  showToast: vi.fn(),
  showConfirm: vi.fn(),
  navigate: vi.fn(),
  renderCurrentView: vi.fn(),
  updateBadges: vi.fn(),
  currentView: 'home',
}));

let store;
let logic;
let app;
let sessionSave;

function createMockDOM() {
  const elements = {};

  const createElement = (id) => {
    const el = {
      id,
      classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn() },
      setAttribute: vi.fn(),
      textContent: '',
      innerHTML: '',
      children: [],
      value: '',
      style: { display: '' },
      dataset: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      click: vi.fn(),
      focus: vi.fn(),
      blur: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(() => true),
      querySelectorAll: vi.fn(() => []),
    };
    elements[id] = el;
    return el;
  };

  const mockDocument = {
    getElementById: vi.fn((id) => {
      if (!elements[id]) elements[id] = createElement(id);
      return elements[id];
    }),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    activeElement: { blur: vi.fn() },
    body: { contains: vi.fn(() => true), style: {} },
    elements,
  };

  return mockDocument;
}

function setupState({ evento = {}, assuntoOverrides = {}, extraAssuntos = [] } = {}) {
  const disc = createDisciplina({
    id: 'disc_a',
    nome: 'Materia A',
    assuntos: [
      createAssunto({ id: 'ass_1', nome: 'Topico 1', ...assuntoOverrides }),
      createAssunto({ id: 'ass_2', nome: 'Topico 2' }),
      ...extraAssuntos,
    ],
    aulas: [{ id: 'aula_1', nome: 'Aula 01', estudada: false, dataEstudo: null }],
  });
  const edital = createEdital({ disciplinas: [disc] });
  const ev = createEvento({
    id: 'ev_multi',
    titulo: 'Sessao',
    data: '2026-04-20',
    status: 'agendado',
    tempoAcumulado: 3600,
    discId: 'disc_a',
    ...evento,
  });
  store.setState(createBaseState({ editais: [edital], eventos: [ev] }));
  logic.invalidateDiscCache();
  return ev;
}

function saveArgs(extra = {}) {
  return {
    currentEventId: 'ev_multi',
    selectedTipos: ['questoes'],
    selectedMateriais: [],
    sessionStartTime: null,
    sessionEndTime: null,
    sessionMode: 'timer',
    ...extra,
  };
}

function topicoItem(overrides = {}) {
  return {
    assId: 'ass_1',
    aulaId: null,
    questoes: null,
    paginas: null,
    statusTopico: 'em_andamento',
    ...overrides,
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-20T10:00:00Z'));

  const mockDoc = createMockDOM();
  global.document = mockDoc;
  global.window = {
    innerWidth: 1024,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    navigate: vi.fn(),
    currentView: 'home',
  };
  global.Notification = { permission: 'granted' };
  global.Audio = vi.fn(() => ({ play: vi.fn(() => Promise.resolve()) }));
  global.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  global.sessionStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  const modules = await loadAppModules();
  store = modules.store;
  logic = modules.logic;
  app = await import('../../src/js/app.js?v=8.37');
  sessionSave = await import('../../src/js/registro-sessao/session-save.js?v=8.37');

  store.setState(createBaseState());
  logic.invalidateDiscCache();
  logic.invalidateRevCache();
  logic.invalidatePendingRevCache();
  logic.invalidateDashCaches();
  logic.invalidateStreakCache();
});

describe('performSave — sessão multi-tópico', () => {
  it('grava topicos[] com escalares e somas derivadas (compat sem migração)', () => {
    setupState();
    document.getElementById('reg-disciplina').value = 'disc_a';

    const result = sessionSave.performSave(
      saveArgs({
        sessionTopicos: [
          topicoItem({ questoes: { total: 10, acertos: 8, erros: 2 } }),
          topicoItem({
            assId: 'ass_2',
            questoes: { total: 5, acertos: 3, erros: 2 },
            paginas: { modo: 'simples', total: 7 },
          }),
        ],
      })
    );

    expect(result).toBe(true);
    const ev = store.state.eventos.find((e) => e.id === 'ev_multi');
    expect(ev.status).toBe('estudei');
    expect(ev.sessao.topicos).toHaveLength(2);
    // Derivados: escalares = 1º item, somas nos campos atuais
    expect(ev.assId).toBe('ass_1');
    expect(ev.sessao.questoes).toEqual({ total: 15, acertos: 11, erros: 4 });
    expect(ev.sessao.paginas).toEqual({ modo: 'simples', total: 7 });
  });

  it('valida questões por item (acertos+erros > total rejeita)', () => {
    setupState();
    document.getElementById('reg-disciplina').value = 'disc_a';

    const result = sessionSave.performSave(
      saveArgs({
        sessionTopicos: [topicoItem({ questoes: { total: 5, acertos: 4, erros: 3 } })],
      })
    );

    expect(result).toBe(false);
    const ev = store.state.eventos.find((e) => e.id === 'ev_multi');
    expect(ev.status).toBe('agendado');
  });

  it('promoção itera itens finalizados: assunto concluído e aula estudada', () => {
    setupState();
    document.getElementById('reg-disciplina').value = 'disc_a';

    sessionSave.performSave(
      saveArgs({
        sessionTopicos: [
          topicoItem({ statusTopico: 'finalizado' }),
          topicoItem({ assId: null, aulaId: 'aula_1', statusTopico: 'finalizado' }),
          topicoItem({ assId: 'ass_2', statusTopico: 'em_andamento' }),
        ],
      })
    );

    const disc = store.state.editais[0].disciplinas[0];
    const ass1 = disc.assuntos.find((a) => a.id === 'ass_1');
    expect(ass1.concluido).toBe(true);
    expect(ass1.dataConclusao).toBe('2026-04-20');
    const aula1 = disc.aulas.find((a) => a.id === 'aula_1');
    expect(aula1.estudada).toBe(true);
    const ass2 = disc.assuntos.find((a) => a.id === 'ass_2');
    expect(ass2.concluido).toBe(false);
    expect(store.state.eventos[0].sessao.statusTopico).toBe('finalizado');
  });

  it('NÃO reseta revisoesFetas de assunto já concluído (guarda de re-edição)', () => {
    setupState({
      assuntoOverrides: {
        concluido: true,
        dataConclusao: '2026-04-01',
        revisoesFetas: [1, 7],
      },
    });
    document.getElementById('reg-disciplina').value = 'disc_a';

    sessionSave.performSave(
      saveArgs({ sessionTopicos: [topicoItem({ statusTopico: 'finalizado' })] })
    );

    const ass1 = store.state.editais[0].disciplinas[0].assuntos.find((a) => a.id === 'ass_1');
    expect(ass1.concluido).toBe(true);
    expect(ass1.dataConclusao).toBe('2026-04-01');
    expect(ass1.revisoesFetas).toEqual([1, 7]);
  });

  it('hábitos usam as somas de questões dos itens', () => {
    setupState();
    document.getElementById('reg-disciplina').value = 'disc_a';

    sessionSave.performSave(
      saveArgs({
        selectedTipos: ['questoes'],
        sessionTopicos: [
          topicoItem({ questoes: { total: 10, acertos: 8, erros: 2 } }),
          topicoItem({ assId: 'ass_2', questoes: { total: 5, acertos: 5, erros: 0 } }),
        ],
      })
    );

    expect(store.state.habitos.questoes).toHaveLength(1);
    expect(store.state.habitos.questoes[0]).toMatchObject({
      total: 15,
      acertos: 13,
      erros: 2,
    });
  });

  it('hábito de páginas usa a soma das páginas dos itens', () => {
    setupState();
    document.getElementById('reg-disciplina').value = 'disc_a';

    sessionSave.performSave(
      saveArgs({
        selectedTipos: ['leitura'],
        sessionTopicos: [
          topicoItem({ paginas: { modo: 'simples', total: 10 } }),
          topicoItem({ assId: 'ass_2', paginas: { modo: 'simples', total: 5 } }),
        ],
      })
    );

    expect(store.state.habitos.paginas).toHaveLength(1);
    expect(store.state.habitos.paginas[0].total).toBe(15);
  });

  it('sem sessionTopicos o fluxo legado segue intacto (sem topicos[] no evento)', () => {
    setupState();
    document.getElementById('reg-disciplina').value = 'disc_a';
    document.getElementById('reg-assunto').value = 'ass_1';
    document.getElementById('reg-q-total').value = '10';
    document.getElementById('reg-q-acertos').value = '9';
    document.getElementById('reg-q-erros').value = '1';
    document.getElementById('reg-status-topico').value = 'em_andamento';

    const result = sessionSave.performSave(saveArgs({ sessionTopicos: null }));

    expect(result).toBe(true);
    const ev = store.state.eventos.find((e) => e.id === 'ev_multi');
    expect(ev.sessao.topicos).toBeUndefined();
    expect(ev.assId).toBe('ass_1');
    expect(ev.sessao.questoes).toEqual({ total: 10, acertos: 9, erros: 1 });
  });

  it('item sem assunto nem aula rejeita o save', () => {
    setupState();
    document.getElementById('reg-disciplina').value = 'disc_a';

    const result = sessionSave.performSave(
      saveArgs({ sessionTopicos: [{ assId: null, aulaId: null, statusTopico: 'em_andamento' }] })
    );

    expect(result).toBe(false);
  });

  it('reedição de sessão multi-tópico não duplica hábitos', () => {
    setupState();
    document.getElementById('reg-disciplina').value = 'disc_a';
    const args = saveArgs({
      sessionTopicos: [topicoItem({ questoes: { total: 10, acertos: 8, erros: 2 } })],
    });
    sessionSave.performSave(args);
    // reedita (evento agora está 'estudei')
    sessionSave.performSave(args);

    expect(store.state.habitos.questoes).toHaveLength(1);
  });
});
