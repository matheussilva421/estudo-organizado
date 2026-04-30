import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAppModules } from '../helpers/module-loader.js';
import { createBaseState, createEvento, createDisciplina, createEdital, createAssunto } from '../helpers/state-builders.js';

vi.mock('../../src/js/app.js?v=8.30', () => ({
  openModal: vi.fn(),
  closeModal: vi.fn(),
  showToast: vi.fn(),
  showConfirm: vi.fn((msg, callback) => { if (callback) callback(); }),
  navigate: vi.fn(),
  renderCurrentView: vi.fn(),
  updateBadges: vi.fn(),
  currentView: 'home'
}));

let store;
let logic;
let app;
let registroSessao;

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
      lastElementChild: null,
      firstElementChild: null,
      value: '',
      style: { display: '' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      click: vi.fn(),
      focus: vi.fn(),
      blur: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(() => true),
      getBoundingClientRect: vi.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 }))
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
    elements
  };

  return mockDocument;
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
    _cronoInterval: null,
    _discChartInstance: null,
    _planjChartInstance: null,
    activeDashboardDiscCtx: null,
    navigate: vi.fn(),
    openDiscDashboard: vi.fn(),
    currentView: 'home'
  };
  global.Notification = { permission: 'granted' };
  global.Audio = vi.fn(() => ({ play: vi.fn(() => Promise.resolve()) }));
  global.clearInterval = vi.fn();
  global.setInterval = vi.fn((fn) => ({ _interval: true, fn }));
  global.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  };
  global.sessionStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  };

  const modules = await loadAppModules();
  store = modules.store;
  logic = modules.logic;
  app = modules.app;
  registroSessao = await import('../../src/js/registro-sessao.js?v=8.30');

  store.setState(createBaseState());
  logic.invalidateDiscCache();
  logic.invalidateRevCache();
  logic.invalidatePendingRevCache();
  logic.invalidateDashCaches();
  logic.invalidateStreakCache();

  Object.keys(logic.timerIntervals).forEach(id => {
    delete logic.timerIntervals[id];
  });
});

describe('registro-sessao.js', () => {
  describe('openRegistroSessao', () => {
    it('opens modal for a regular event', () => {
      const evento = createEvento({
        id: 'ev_1',
        discId: 'disc_1',
        assId: 'ass_1',
        tempoAcumulado: 1800,
        sessao: {}
      });
      const disc = createDisciplina({ id: 'disc_1', assuntos: [createAssunto({ id: 'ass_1' })] });
      const edital = createEdital({ disciplinas: [disc] });
      store.setState(createBaseState({ eventos: [evento], editais: [edital] }));

      registroSessao.openRegistroSessao('ev_1');

      expect(app.openModal).toHaveBeenCalledWith('modal-registro-sessao');
    });

    it('opens modal for crono_livre', () => {
      store.setState(createBaseState({
        cronoLivre: { _timerStart: null, tempoAcumulado: 600 }
      }));

      registroSessao.openRegistroSessao('crono_livre');

      expect(app.openModal).toHaveBeenCalledWith('modal-registro-sessao');
    });

    it('shows error toast when event not found', () => {
      store.setState(createBaseState({ eventos: [] }));

      registroSessao.openRegistroSessao('ev_nonexistent');

      expect(app.showToast).toHaveBeenCalledWith('Evento não encontrado', 'error');
      expect(app.openModal).not.toHaveBeenCalled();
    });

    it('stops running timer and captures start time', () => {
      const startTime = Date.now() - 30000;
      const evento = createEvento({
        id: 'ev_1',
        _timerStart: startTime,
        tempoAcumulado: 0,
        sessao: {}
      });
      store.setState(createBaseState({ eventos: [evento] }));
      logic.timerIntervals['ev_1'] = { _mock: true };

      registroSessao.openRegistroSessao('ev_1');

      const ev = store.state.eventos.find(e => e.id === 'ev_1');
      expect(ev._timerStart).toBeNull();
      expect(ev.tempoAcumulado).toBeGreaterThan(0);
      expect(global.clearInterval).toHaveBeenCalled();
    });

    it('pre-fills discipline when event has discId', async () => {
      const evento = createEvento({
        id: 'ev_1',
        discId: 'disc_1',
        assId: 'ass_1',
        tempoAcumulado: 0,
        sessao: {}
      });
      const disc = createDisciplina({ id: 'disc_1', assuntos: [createAssunto({ id: 'ass_1' })] });
      const edital = createEdital({ disciplinas: [disc] });
      store.setState(createBaseState({ eventos: [evento], editais: [edital] }));

      registroSessao.openRegistroSessao('ev_1');

      await vi.advanceTimersByTimeAsync(150);

      const discSelect = global.document.getElementById('reg-disciplina');
      expect(discSelect.value).toBe('disc_1');
    });
  });

  describe('cancelRegistro', () => {
    it('closes modal', () => {
      const evento = createEvento({
        id: 'ev_1',
        _timerStart: Date.now() - 5000,
        tempoAcumulado: 10,
        sessao: {}
      });
      store.setState(createBaseState({ eventos: [evento] }));

      registroSessao.openRegistroSessao('ev_1');
      registroSessao.cancelRegistro();

      expect(app.closeModal).toHaveBeenCalledWith('modal-registro-sessao');
    });

    it('removes past session event when cancelled', () => {
      const pastEvento = createEvento({
        id: 'ev_past',
        _isPastSession: true,
        discId: 'disc_1',
        tempoAcumulado: 1800,
        sessao: {}
      });
      const disc = createDisciplina({ id: 'disc_1' });
      const edital = createEdital({ disciplinas: [disc] });
      store.setState(createBaseState({ eventos: [pastEvento], editais: [edital] }));

      registroSessao.openRegistroSessao('ev_past');
      registroSessao.cancelRegistro();

      expect(store.state.eventos).toHaveLength(0);
    });
  });

  describe('discardTimerUI', () => {
    it('closes modal and calls discardTimer after delay', () => {
      const evento = createEvento({
        id: 'ev_1',
        _timerStart: Date.now() - 5000,
        tempoAcumulado: 10,
        sessao: {}
      });
      store.setState(createBaseState({ eventos: [evento] }));

      registroSessao.discardTimerUI('ev_1');

      expect(app.closeModal).toHaveBeenCalledWith('modal-registro-sessao');
    });
  });

  describe('deleteCompletedSession', () => {
    it('shows confirmation and deletes session', () => {
      const evento = createEvento({
        id: 'ev_completed',
        status: 'estudei',
        discId: 'disc_1',
        tempoAcumulado: 3600,
        sessao: { tiposEstudo: ['leitura'] }
      });
      store.setState(createBaseState({
        eventos: [evento],
        habitos: {
          leitura: [{ id: 'hab_1', data: '2026-04-20', eventoId: 'ev_completed', tempoMin: 60 }],
          questoes: [],
          revisao: [],
          discursiva: [],
          simulado: [],
          informativo: [],
          sumula: [],
          videoaula: [],
          paginas: []
        }
      }));

      registroSessao.deleteCompletedSession('ev_completed');

      expect(app.showConfirm).toHaveBeenCalled();
      const confirmCall = app.showConfirm.mock.calls[0];
      expect(confirmCall[0]).toContain('excluir permanentemente');
    });

    it('removes event and habit entries when confirmed', () => {
      const evento = createEvento({
        id: 'ev_completed',
        status: 'estudei',
        discId: 'disc_1',
        tempoAcumulado: 3600,
        sessao: { tiposEstudo: ['leitura'] }
      });
      store.setState(createBaseState({
        eventos: [evento],
        habitos: {
          leitura: [{ id: 'hab_1', data: '2026-04-20', eventoId: 'ev_completed', tempoMin: 60 }],
          questoes: [],
          revisao: [],
          discursiva: [],
          simulado: [],
          informativo: [],
          sumula: [],
          videoaula: [],
          paginas: []
        }
      }));

      registroSessao.deleteCompletedSession('ev_completed');

      const confirmCallback = app.showConfirm.mock.calls[0][1];
      confirmCallback();

      expect(store.state.eventos).toHaveLength(0);
      expect(store.state.habitos.leitura).toHaveLength(0);
      expect(app.closeModal).toHaveBeenCalledWith('modal-registro-sessao');
    });
  });

  describe('toggleStudyType', () => {
    it('toggles study type selection', () => {
      const evento = createEvento({ id: 'ev_1', tempoAcumulado: 0, sessao: {} });
      store.setState(createBaseState({ eventos: [evento] }));
      registroSessao.openRegistroSessao('ev_1');

      registroSessao.toggleStudyType('leitura');

      const container = global.document.getElementById('reg-resultados');
      expect(container).toBeDefined();
    });

    it('re-renders conditional results fields', () => {
      const evento = createEvento({ id: 'ev_1', tempoAcumulado: 0, sessao: {} });
      store.setState(createBaseState({ eventos: [evento] }));
      registroSessao.openRegistroSessao('ev_1');

      registroSessao.toggleStudyType('questoes');

      const container = global.document.getElementById('reg-resultados');
      expect(container).toBeDefined();
    });
  });

  describe('toggleMaterial', () => {
    it('toggles material selection', () => {
      const evento = createEvento({ id: 'ev_1', tempoAcumulado: 0, sessao: {} });
      store.setState(createBaseState({ eventos: [evento] }));
      registroSessao.openRegistroSessao('ev_1');

      registroSessao.toggleMaterial('pdf');

      const container = global.document.getElementById('reg-resultados');
      expect(container).toBeDefined();
    });

    it('re-renders conditional results fields', () => {
      const evento = createEvento({ id: 'ev_1', tempoAcumulado: 0, sessao: {} });
      store.setState(createBaseState({ eventos: [evento] }));
      registroSessao.openRegistroSessao('ev_1');

      registroSessao.toggleMaterial('livro');

      const container = global.document.getElementById('reg-resultados');
      expect(container).toBeDefined();
    });
  });

  describe('onDisciplinaChange', () => {
    it('populates assunto select when discipline has topics', () => {
      const disc = createDisciplina({
        id: 'disc_1',
        assuntos: [
          createAssunto({ id: 'ass_1', nome: 'Topic One', concluido: false }),
          createAssunto({ id: 'ass_2', nome: 'Topic Two', concluido: true })
        ]
      });
      const edital = createEdital({ disciplinas: [disc] });
      store.setState(createBaseState({ editais: [edital] }));
      logic.invalidateDiscCache();

      const discSelect = global.document.getElementById('reg-disciplina');
      discSelect.value = 'disc_1';

      registroSessao.onDisciplinaChange();

      const assSelect = global.document.getElementById('reg-assunto');
      expect(assSelect.innerHTML).toContain('ass_1');
      expect(assSelect.innerHTML).toContain('ass_2');
    });

    it('shows aula select when discipline has aulas', () => {
      const disc = createDisciplina({
        id: 'disc_1',
        aulas: [{ id: 'aula_1', nome: 'Aula 01', estudada: false }]
      });
      const edital = createEdital({ disciplinas: [disc] });
      store.setState(createBaseState({ editais: [edital] }));
      logic.invalidateDiscCache();

      const discSelect = global.document.getElementById('reg-disciplina');
      discSelect.value = 'disc_1';

      registroSessao.onDisciplinaChange();

      const aulaContainer = global.document.getElementById('reg-aula-container');
      expect(aulaContainer.style.display).toBe('');
    });

    it('clears selects when no discipline selected', () => {
      const discSelect = global.document.getElementById('reg-disciplina');
      discSelect.value = '';

      registroSessao.onDisciplinaChange();

      const assSelect = global.document.getElementById('reg-assunto');
      expect(assSelect.innerHTML).toContain('Selecione a disciplina primeiro');
    });
  });

  describe('validateQuestoes', () => {
    it('shows feedback when acertos + erros > total', () => {
      const totalEl = global.document.getElementById('reg-q-total');
      totalEl.value = '5';
      const acertosEl = global.document.getElementById('reg-q-acertos');
      acertosEl.value = '4';
      const errosEl = global.document.getElementById('reg-q-erros');
      errosEl.value = '3';

      registroSessao.validateQuestoes();

      const fb = global.document.getElementById('reg-q-feedback');
      expect(fb.innerHTML).toContain('não pode ser maior');
    });

    it('shows percentage when valid', () => {
      const totalEl = global.document.getElementById('reg-q-total');
      totalEl.value = '10';
      const acertosEl = global.document.getElementById('reg-q-acertos');
      acertosEl.value = '8';
      const errosEl = global.document.getElementById('reg-q-erros');
      errosEl.value = '2';

      registroSessao.validateQuestoes();

      const fb = global.document.getElementById('reg-q-feedback');
      expect(fb.innerHTML).toContain('80%');
    });

    it('clears feedback when total is zero', () => {
      const totalEl = global.document.getElementById('reg-q-total');
      totalEl.value = '0';
      const acertosEl = global.document.getElementById('reg-q-acertos');
      acertosEl.value = '0';
      const errosEl = global.document.getElementById('reg-q-erros');
      errosEl.value = '0';

      registroSessao.validateQuestoes();

      const fb = global.document.getElementById('reg-q-feedback');
      expect(fb.innerHTML).toBe('');
    });
  });

  describe('setPaginaMode', () => {
    it('switches to simple mode', () => {
      registroSessao.setPaginaMode('simples');

      const simples = global.document.getElementById('pag-simples');
      const detalhado = global.document.getElementById('pag-detalhado');
      expect(simples.style.display).toBe('');
      expect(detalhado.style.display).toBe('none');
    });

    it('switches to detailed mode', () => {
      registroSessao.setPaginaMode('detalhado');

      const simples = global.document.getElementById('pag-simples');
      const detalhado = global.document.getElementById('pag-detalhado');
      expect(simples.style.display).toBe('none');
      expect(detalhado.style.display).toBe('');
    });
  });

  describe('saveRegistroSessao', () => {
    it('returns false when no study type selected', () => {
      const evento = createEvento({
        id: 'ev_1',
        discId: 'disc_1',
        tempoAcumulado: 1800,
        sessao: {}
      });
      store.setState(createBaseState({ eventos: [evento] }));

      registroSessao.openRegistroSessao('ev_1');

      const result = registroSessao.saveRegistroSessao();

      expect(result).toBe(false);
      expect(app.showToast).toHaveBeenCalledWith('Selecione ao menos um tipo de estudo', 'error');
    });

    it('validates questões when questoes type selected', () => {
      const evento = createEvento({
        id: 'ev_1',
        discId: 'disc_1',
        tempoAcumulado: 1800,
        sessao: {}
      });
      const disc = createDisciplina({ id: 'disc_1' });
      const edital = createEdital({ disciplinas: [disc] });
      store.setState(createBaseState({ eventos: [evento], editais: [edital] }));
      logic.invalidateDiscCache();

      registroSessao.openRegistroSessao('ev_1');
      registroSessao.toggleStudyType('questoes');

      const result = registroSessao.saveRegistroSessao();

      expect(result).toBe(false);
      expect(app.showToast).toHaveBeenCalledWith('Informe o total de questões', 'error');
    });

    it('sets event status to estudei on save', () => {
      const assunto = createAssunto({ id: 'ass_1', nome: 'Topic', concluido: false });
      const disc = createDisciplina({
        id: 'disc_1',
        nome: 'Disc',
        assuntos: [assunto]
      });
      const edital = createEdital({ disciplinas: [disc] });
      const evento = createEvento({
        id: 'ev_1',
        discId: 'disc_1',
        assId: 'ass_1',
        tempoAcumulado: 1800,
        sessao: {}
      });
      store.setState(createBaseState({ eventos: [evento], editais: [edital] }));
      logic.invalidateDiscCache();

      registroSessao.openRegistroSessao('ev_1');
      registroSessao.toggleStudyType('leitura');

      const result = registroSessao.saveRegistroSessao();

      expect(result).toBe(true);
      const savedEv = store.state.eventos.find(e => e.id === 'ev_1');
      expect(savedEv.status).toBe('estudei');
    });

    it('registers habit entries for selected types', () => {
      const evento = createEvento({
        id: 'ev_1',
        discId: 'disc_1',
        tempoAcumulado: 1800,
        sessao: {}
      });
      const disc = createDisciplina({ id: 'disc_1' });
      const edital = createEdital({ disciplinas: [disc] });
      store.setState(createBaseState({ eventos: [evento], editais: [edital] }));
      logic.invalidateDiscCache();

      registroSessao.openRegistroSessao('ev_1');
      registroSessao.toggleStudyType('leitura');
      registroSessao.saveRegistroSessao();

      expect(store.state.habitos.leitura.length).toBeGreaterThan(0);
    });

    it('registers habit entries for selected types', () => {
      const evento = createEvento({
        id: 'ev_1',
        discId: 'disc_1',
        tempoAcumulado: 1800,
        sessao: {}
      });
      const disc = createDisciplina({ id: 'disc_1' });
      const edital = createEdital({ disciplinas: [disc] });
      store.setState(createBaseState({ eventos: [evento], editais: [edital] }));
      logic.invalidateDiscCache();

      registroSessao.openRegistroSessao('ev_1');
      registroSessao.toggleStudyType('leitura');
      registroSessao.saveRegistroSessao();

      expect(store.state.habitos.leitura.length).toBeGreaterThan(0);
      expect(store.state.habitos.leitura[0].eventoId).toBe('ev_1');
    });
  });

  describe('saveAndStartNew', () => {
    it('saves and navigates to MED view', async () => {
      const evento = createEvento({
        id: 'ev_1',
        discId: 'disc_1',
        tempoAcumulado: 1800,
        sessao: {}
      });
      const disc = createDisciplina({ id: 'disc_1' });
      const edital = createEdital({ disciplinas: [disc] });
      store.setState(createBaseState({ eventos: [evento], editais: [edital] }));
      logic.invalidateDiscCache();

      registroSessao.openRegistroSessao('ev_1');
      registroSessao.toggleStudyType('leitura');

      registroSessao.saveAndStartNew();

      await vi.advanceTimersByTimeAsync(600);

      expect(app.navigate).toHaveBeenCalledWith('med');
    });
  });

  describe('voltarPastSessionUI', () => {
    it('removes past session and closes modal', () => {
      const pastEvento = createEvento({
        id: 'ev_past',
        _isPastSession: true,
        discId: 'disc_1',
        tempoAcumulado: 1800,
        sessao: {}
      });
      store.setState(createBaseState({ eventos: [pastEvento] }));

      registroSessao.voltarPastSessionUI('ev_past', 'disc_1');

      expect(store.state.eventos).toHaveLength(0);
      expect(app.closeModal).toHaveBeenCalledWith('modal-registro-sessao');
    });
  });
});
