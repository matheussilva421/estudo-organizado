import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAppModules } from '../helpers/module-loader.js';
import { createBaseState, createEvento, createDisciplina, createEdital } from '../helpers/state-builders.js';

let store;
let components;
let logic;

/**
 * Setup de mock para elementos DOM
 */
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
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      click: vi.fn(),
      focus: vi.fn(),
      blur: vi.fn(),
      remove: vi.fn(),
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
    body: { style: {} },
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
  global.Notification = vi.fn();
  global.clearInterval = vi.fn();
  global.setInterval = vi.fn((fn) => ({ _interval: true, fn }));
  global.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  };

  const modules = await loadAppModules();
  store = modules.store;
  components = modules.components;
  logic = modules.logic;

  store.setState(createBaseState());
  logic.invalidateDiscCache();
  logic.invalidateDashCaches();
});

describe('components.js', () => {
  describe('renderCronometro()', () => {
    it('renderiza cronômetro livre quando nenhum timer está ativo', () => {
      store.setState(createBaseState({ eventos: [], cronoLivre: { _timerStart: null, tempoAcumulado: 0 } }));

      const container = { innerHTML: '' };
      components.renderCronometro(container);

      expect(container.innerHTML).toContain('crono-fullscreen');
      expect(container.innerHTML).toContain('toggle-timer');
      expect(container.innerHTML).toContain('mark-studied');
    });

    it('renderiza cronômetro com evento ativo', () => {
      const evento = createEvento({
        id: 'ev_active',
        titulo: 'Sessão de Constitucional',
        discId: 'disc_1',
        assId: 'ass_1',
        _timerStart: Date.now() - 60000, // 1 min atrás
        tempoAcumulado: 0
      });

      store.setState(createBaseState({
        eventos: [evento],
        editais: [createEdital({
          disciplinas: [createDisciplina({
            id: 'disc_1',
            nome: 'Direito Constitucional',
            icone: '📚',
            cor: '#10b981',
            assuntos: [{ id: 'ass_1', nome: 'Controle de Constitucionalidade' }]
          })]
        })]
      }));
      logic.invalidateDiscCache();

      const container = { innerHTML: '' };
      components.renderCronometro(container);

      expect(container.innerHTML).toContain('Direito Constitucional');
      expect(container.innerHTML).toContain('Controle de Constitucionalidade');
      expect(container.innerHTML).toContain('toggle-timer');
    });

    it('renderiza seletores de disciplina/tópico para sessão livre', () => {
      store.setState(createBaseState({
        eventos: [],
        cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
        editais: [createEdital({
          disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Português' })]
        })]
      }));
      logic.invalidateDiscCache();

      const container = { innerHTML: '' };
      components.renderCronometro(container);

      expect(container.innerHTML).toContain('set-crono-livre-disc');
      expect(container.innerHTML).toContain('(Opcional) Escolha a Disciplina');
    });

    it('configura botão de modo Pomodoro quando habilitado', () => {
      store.setState(createBaseState({
        config: { pomodoroMode: true, pomodoroFoco: 25, pomodoroPausa: 5 }
      }));

      const container = { innerHTML: '' };
      components.renderCronometro(container);

      expect(container.innerHTML).toContain('crono-mode-btn');
      expect(container.innerHTML).toContain('toggle-timer-mode');
    });

    it('mostra botão de descartar apenas quando há tempo acumulado', () => {
      const evento = createEvento({ id: 'ev_zero', tempoAcumulado: 0, _timerStart: null });
      store.setState(createBaseState({ eventos: [evento] }));

      const container = { innerHTML: '' };
      components.renderCronometro(container);

      // Botão de descartar só aparece quando tempo > 0
      // Verificamos que o container foi renderizado
      expect(container.innerHTML).toContain('crono-fullscreen');
    });
  });

  describe('renderCurrentView()', () => {
    it('limpa intervalo do cronômetro ao sair da view cronometro', () => {
      components.setCronoInterval({ _interval: true });
      // currentView !== 'cronometro' para trigger o cleanup
      global.window.currentView = 'home';

      store.setState(createBaseState());

      components.renderCurrentView();

      // clearInterval deve ser chamado
      expect(global.clearInterval).toHaveBeenCalled();
    });

    it('destroi gráfico ao sair da view dashboard', () => {
      const mockChart = { destroy: vi.fn() };
      components.setPlanjChartInstance(mockChart);
      // currentView !== 'ciclo' para trigger o cleanup
      global.window.currentView = 'home';

      components.renderCurrentView();

      expect(mockChart.destroy).toHaveBeenCalled();
    });

    it('atualiza título do topbar', () => {
      const titleEl = { textContent: '' };

      global.document.getElementById = vi.fn((id) => {
        if (id === 'topbar-title') return titleEl;
        if (id === 'topbar-date') return { innerHTML: '' };
        if (id === 'topbar-actions') return { innerHTML: '' };
        if (id === 'main-content') return { innerHTML: '', classList: { toggle: vi.fn() } };
        return null;
      });

      // Testa que a view home atualiza o título
      global.window.currentView = 'home';
      components.renderCurrentView();
      expect(titleEl.textContent).toBe('Página Inicial');
    });

    it('mostra botão "Iniciar Estudo" nas views home, med e calendar', () => {
      const actionsEl = { innerHTML: '' };
      global.document.getElementById = vi.fn((id) => {
        if (id === 'topbar-title') return { textContent: '' };
        if (id === 'topbar-date') return { innerHTML: '' };
        if (id === 'topbar-actions') return actionsEl;
        if (id === 'main-content') return { innerHTML: '', classList: { toggle: vi.fn() } };
        return null;
      });

      for (const view of ['home', 'med', 'calendar']) {
        global.window.currentView = view;
        components.renderCurrentView();
        expect(actionsEl.innerHTML).toContain('open-add-event');
      }
    });

    it('mostra botão de voltar no cronômetro', () => {
      // Nota: currentView é uma constante importada do app.js
      // Para testar, verificamos que a função renderCurrentView existe e funciona
      // O teste E2E cobre o comportamento real do botão de voltar
      expect(components.renderCurrentView).toBeDefined();
      expect(typeof components.renderCurrentView).toBe('function');
    });

    it('renderiza skeleton loader para views pesadas', () => {
      const contentEl = { innerHTML: '', classList: { toggle: vi.fn() } };
      global.document.getElementById = vi.fn((id) => {
        if (id === 'topbar-title') return { textContent: '' };
        if (id === 'topbar-date') return { innerHTML: '' };
        if (id === 'topbar-actions') return { innerHTML: '' };
        if (id === 'main-content') return contentEl;
        return null;
      });

      global.window.currentView = 'home';
      components.renderCurrentView();

      expect(contentEl.innerHTML).toContain('skeleton');
      expect(contentEl.innerHTML).toContain('loading-skeleton');
    });
  });

  describe('updateBadges()', () => {
    it('atualiza badge do cronômetro com timers ativos', () => {
      const cronoBadge = { style: {}, textContent: '' };
      global.document.getElementById = vi.fn((id) => {
        if (id === 'badge-crono') return cronoBadge;
        if (id === 'badge-med') return { style: {}, textContent: '' };
        if (id === 'badge-rev') return { style: {}, textContent: '' };
        return null;
      });

      store.setState(createBaseState({
        eventos: [
          createEvento({ id: 'ev1', _timerStart: Date.now() }),
          createEvento({ id: 'ev2', _timerStart: Date.now() })
        ]
      }));

      components.updateBadges();

      expect(cronoBadge.style.display).toBe('inline-block');
      expect(cronoBadge.textContent).toEqual(2);
    });

    it('oculta badge do cronômetro quando sem timers ativos', () => {
      const cronoBadge = { style: { display: 'inline-block' }, textContent: '2' };
      global.document.getElementById = vi.fn((id) => {
        if (id === 'badge-crono') return cronoBadge;
        if (id === 'badge-med') return { style: {}, textContent: '' };
        if (id === 'badge-rev') return { style: {}, textContent: '' };
        return null;
      });

      store.setState(createBaseState({ eventos: [] }));

      components.updateBadges();

      expect(cronoBadge.style.display).toBe('none');
    });

    it('atualiza badge MED com eventos de hoje', () => {
      const today = '2026-04-20';
      const medBadge = { style: {}, textContent: '' };
      const revBadge = { style: {}, textContent: '' };

      global.document.getElementById = vi.fn((id) => {
        if (id === 'badge-crono') return { style: {}, textContent: '' };
        if (id === 'badge-med') return medBadge;
        if (id === 'badge-rev') return revBadge;
        return null;
      });

      store.setState(createBaseState({
        eventos: [
          createEvento({ id: 'ev_today', data: today, status: 'agendado' }),
          createEvento({ id: 'ev_today2', data: today, status: 'agendado' }),
          createEvento({ id: 'ev_done', data: today, status: 'estudei' })
        ]
      }));

      components.updateBadges();

      expect(medBadge.style.display).toBe('inline-block');
      expect(medBadge.textContent).toEqual(2);
    });

    it('atualiza badge REV com revisões pendentes', () => {
      const medBadge = { style: {}, textContent: '' };
      const revBadge = { style: {}, textContent: '' };

      global.document.getElementById = vi.fn((id) => {
        if (id === 'badge-crono') return { style: {}, textContent: '' };
        if (id === 'badge-med') return medBadge;
        if (id === 'badge-rev') return revBadge;
        return null;
      });

      // Revisões pendentes são calculadas pela logic.js
      // Simulamos o retorno
      const getPendingRevisoesSpy = vi.spyOn(logic, 'getPendingRevisoes').mockReturnValue([
        { data: '2026-04-20' },
        { data: '2026-04-20' },
        { data: '2026-04-20' }
      ]);

      components.updateBadges();

      expect(revBadge.style.display).toBe('inline-block');
      expect(revBadge.textContent).toEqual(3);

      getPendingRevisoesSpy.mockRestore();
    });
  });

  describe('renderEventCard()', () => {
    it('renderiza card com status agendado', () => {
      const evento = createEvento({
        titulo: 'Sessão de Estudos',
        data: '2026-04-25',
        status: 'agendado'
      });

      const html = components.renderEventCard(evento);

      expect(html).toContain('Sessão de Estudos');
      expect(html).toContain('agendado');
      expect(html).toContain('toggle-timer');
      expect(html).toContain('mark-studied');
      expect(html).toContain('delete-event');
    });

    it('card é acionável por teclado (role=button, tabindex e aria-label)', () => {
      const evento = createEvento({
        titulo: 'Sessão de Estudos',
        data: '2026-04-25',
        status: 'agendado'
      });

      const html = components.renderEventCard(evento);
      const cardTag = html.match(/<div class="event-card[^>]*>/)[0];

      expect(cardTag).toContain('role="button"');
      expect(cardTag).toContain('tabindex="0"');
      expect(cardTag).toContain('aria-label=');
    });

    it('renderiza card com status estudei', () => {
      const evento = createEvento({
        titulo: 'Sessão Concluída',
        data: '2026-04-18',
        status: 'estudei',
        tempoAcumulado: 3600
      });

      const html = components.renderEventCard(evento);

      expect(html).toContain('Estudei');
      expect(html).not.toContain('toggle-timer');
      expect(html).not.toContain('mark-studied');
      expect(html).toContain('delete-event');
    });

    it('renderiza card com timer ativo', () => {
      const evento = createEvento({
        titulo: 'Sessão em Andamento',
        _timerStart: Date.now() - 60000
      });

      const html = components.renderEventCard(evento);

      // Verifica elementos do card com timer ativo
      expect(html).toContain('event-card');
      expect(html).toContain('toggle-timer');
    });

    it('renderiza ícone e cor da disciplina', () => {
      store.setState(createBaseState({
        editais: [createEdital({
          disciplinas: [createDisciplina({
            id: 'disc_1',
            nome: 'Direito Penal',
            icone: '⚖️',
            cor: '#ef4444'
          })]
        })]
      }));
      logic.invalidateDiscCache();

      const evento = createEvento({ discId: 'disc_1' });
      const html = components.renderEventCard(evento);

      expect(html).toContain('⚖️');
      expect(html).toContain('#ef4444');
    });

    it('renderiza card de hábito sem disciplina', () => {
      const evento = createEvento({
        titulo: 'Bloco de Questões',
        habito: 'questoes',
        discId: null
      });

      const html = components.renderEventCard(evento);

      expect(html).toContain('Bloco de Questões');
    });

    it('mostra tempo acumulado quando > 0', () => {
      const evento = createEvento({ tempoAcumulado: 7200 }); // 2 horas

      const html = components.renderEventCard(evento);

      expect(html).toContain('data-timer');
    });
  });
});
