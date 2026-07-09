import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Pré-requisitos da ação rápida da aba Pontos Fracos:
// 1) addEventoParaAssunto precisa pré-selecionar também assuntos CONCLUÍDOS
//    (loadAssuntos só popula pendentes — a option precisa ser inserida);
// 2) o modal de evento precisa listar disciplinas de TODOS os editais quando
//    aberto a partir da view pontos-fracos (allowAllEditaisInEventModal).

describe('views.js - addEventoParaAssunto com assunto concluído', () => {
  let views;
  let logicModule;
  let eventModalsModule;

  const assuntoPendente = { id: 'ass_pend', nome: 'Assunto Pendente', concluido: false };
  const assuntoConcluido = { id: 'ass_done', nome: 'Assunto Concluído', concluido: true };

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();

    logicModule = {
      getDisc: vi.fn(() => ({
        disc: {
          id: 'disc_1',
          nome: 'Direito',
          cor: '#ff0000',
          icone: '📚',
          assuntos: [assuntoPendente, assuntoConcluido],
          aulas: [],
        },
        edital: { id: 'ed_1', nome: 'Edital A', cor: '#00ff00' },
      })),
      invalidateDiscCache: vi.fn(),
      invalidateDashCaches: vi.fn(),
      invalidateRevCache: vi.fn(),
      invalidatePendingRevCache: vi.fn(),
      syncCicloToEventos: vi.fn(),
    };

    // Mock fiel ao comportamento real: só popula assuntos PENDENTES
    eventModalsModule = {
      openAddEventModal: vi.fn(),
      loadAssuntos: vi.fn(() => {
        const sel = document.getElementById('event-assunto');
        sel.innerHTML =
          '<option value="">Sem tópico específico</option>' +
          `<option value="${assuntoPendente.id}">${assuntoPendente.nome}</option>`;
        document.getElementById('event-assunto-group').style.display = '';
      }),
    };

    vi.doMock('../../src/js/store.js?v=8.37', () => ({
      state: {
        config: {},
        editais: [],
        eventos: [],
        arquivo: [],
        revisoes: [],
        habitos: { questoes: [], simulado: [] },
        planejamento: { ativo: false, sequencia: [] },
      },
      scheduleSave: vi.fn(),
    }));
    vi.doMock('../../src/js/app.js?v=8.37', () => ({
      showToast: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      showConfirm: vi.fn(),
      getLastSaveStatus: vi.fn(() => ({ status: 'ok' })),
      THEME_OPTIONS: [{ value: 'dark', label: 'Dark' }],
      normalizeTheme: vi.fn((t) => t || 'dark'),
      applyTheme: vi.fn(),
    }));
    vi.doMock('../../src/js/logic.js?v=8.37', () => logicModule);
    vi.doMock('../../src/js/components.js?v=8.37', () => ({
      renderCurrentView: vi.fn(),
      renderEventCard: vi.fn(() => '<div></div>'),
    }));
    vi.doMock('../../src/js/utils.js?v=8.37', () => ({
      esc: vi.fn((s) => s || ''),
      todayStr: vi.fn(() => '2026-07-09'),
      formatDate: vi.fn((s) => s),
      formatTime: vi.fn(() => '0h'),
      uid: vi.fn(() => 'abc123'),
      addCleanupListener: vi.fn(),
    }));
    vi.doMock('../../src/js/ui/event-modals.js?v=8.37', () => eventModalsModule);

    document.body.innerHTML = `
      <select id="event-disc"><option value="disc_1">Direito</option></select>
      <div id="event-assunto-group" style="display:none">
        <select id="event-assunto"></select>
      </div>
      <input id="event-titulo">
    `;

    views = await import('../../src/js/views.js?v=8.37');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pré-seleciona assunto pendente (comportamento existente)', () => {
    views.addEventoParaAssunto('ed_1', 'disc_1', 'ass_pend');
    vi.advanceTimersByTime(200);

    expect(document.getElementById('event-assunto').value).toBe('ass_pend');
    expect(document.getElementById('event-titulo').value).toBe('Assunto Pendente');
  });

  it('insere a option e pré-seleciona assunto concluído', () => {
    views.addEventoParaAssunto('ed_1', 'disc_1', 'ass_done');
    vi.advanceTimersByTime(200);

    const assSel = document.getElementById('event-assunto');
    expect(assSel.value).toBe('ass_done');
    expect(assSel.querySelector('option[value="ass_done"]')).not.toBeNull();
    // grupo visível mesmo que loadAssuntos o tivesse escondido
    expect(document.getElementById('event-assunto-group').style.display).not.toBe('none');
    expect(document.getElementById('event-titulo').value).toBe('Assunto Concluído');
  });
});

describe('ui/event-modals.js - editais permitidos por view', () => {
  let getSelectedEditalId;

  async function loadWithView(view) {
    vi.resetModules();
    // o describe anterior mocka o próprio event-modals — aqui precisamos do real
    vi.doUnmock('../../src/js/ui/event-modals.js?v=8.37');
    getSelectedEditalId = vi.fn(() => null);

    vi.doMock('../../src/js/store.js?v=8.37', () => ({
      state: { eventos: [] },
      scheduleSave: vi.fn(),
    }));
    vi.doMock('../../src/js/utils.js?v=8.37', () => ({
      esc: (s) => s,
      todayStr: () => '2026-07-09',
      trunc: (s) => s,
      uid: () => 'XYZ',
      getEventStatus: () => 'agendado',
      addCleanupListener: vi.fn(),
    }));
    vi.doMock('../../src/js/logic.js?v=8.37', () => ({
      getDisc: vi.fn(() => null),
      getActiveDisciplinas: vi.fn(() => []),
      reattachTimers: vi.fn(),
    }));
    vi.doMock('../../src/js/edital-filter.js?v=8.37', () => ({
      filterEventsBySelectedEdital: (evts) => evts,
      getSelectedEditalId,
    }));
    vi.doMock('../../src/js/components.js?v=8.37', () => ({
      renderCurrentView: vi.fn(),
      renderEventCard: vi.fn(() => '<div></div>'),
    }));
    vi.doMock('../../src/js/app.js?v=8.37', () => ({
      currentView: view,
      openModal: vi.fn(),
      closeModal: vi.fn(),
      showConfirm: vi.fn(),
      showToast: vi.fn(),
    }));
    vi.doMock('../../src/js/registro-sessao.js?v=8.37', () => ({
      openRegistroSessao: vi.fn(),
    }));

    document.body.innerHTML = `
      <h2 id="modal-event-title"></h2>
      <div id="modal-event-body"></div>
    `;

    return import('../../src/js/ui/event-modals.js?v=8.37');
  }

  it('pontos-fracos permite disciplinas de todos os editais', async () => {
    const eventModals = await loadWithView('pontos-fracos');
    eventModals.openAddEventModal();
    expect(getSelectedEditalId).toHaveBeenCalledWith({ allowAll: true });
  });

  it('home continua permitindo todos os editais', async () => {
    const eventModals = await loadWithView('home');
    eventModals.openAddEventModal();
    expect(getSelectedEditalId).toHaveBeenCalledWith({ allowAll: true });
  });

  it('dashboard continua restrito ao edital selecionado', async () => {
    const eventModals = await loadWithView('dashboard');
    eventModals.openAddEventModal();
    expect(getSelectedEditalId).toHaveBeenCalledWith({ allowAll: false });
  });
});
