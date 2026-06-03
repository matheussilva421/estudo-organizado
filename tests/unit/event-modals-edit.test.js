import { describe, it, expect, vi, beforeEach } from 'vitest';

// Exercises the edit-mode behaviour of openAddEventModal/saveEvent in
// src/js/ui/event-modals.js. Regression cover for the bug where clicking
// "Editar" opened a blank "Iniciar Estudo" form (eventId was passed as the
// date) instead of editing the existing event in place.

describe('ui/event-modals.js - edit mode', () => {
  let eventModals;
  let store;
  let openModal;
  let closeModal;
  let showToast;
  let renderCurrentView;

  beforeEach(async () => {
    vi.resetModules();

    store = {
      state: {
        eventos: [
          {
            id: 'ev_1',
            titulo: 'Estudar Direito Ambiental',
            data: '2026-06-03',
            duracao: 120,
            notas: 'nota antiga',
            fontes: '',
            legislacao: '',
            status: 'agendado',
            tempoAcumulado: 0,
            tipo: 'conteudo',
            discId: null,
            assId: null,
            aulaId: null,
            criadoEm: '2026-06-01T00:00:00.000Z',
          },
        ],
      },
      scheduleSave: vi.fn(),
    };
    openModal = vi.fn();
    closeModal = vi.fn();
    showToast = vi.fn();
    renderCurrentView = vi.fn();

    vi.doMock('../../src/js/store.js?v=8.37', () => store);
    vi.doMock('../../src/js/utils.js?v=8.37', () => ({
      esc: (s) => s,
      todayStr: () => '2026-06-03',
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
      getSelectedEditalId: () => null,
    }));
    vi.doMock('../../src/js/components.js?v=8.37', () => ({
      renderCurrentView,
      renderEventCard: vi.fn(() => '<div></div>'),
    }));
    vi.doMock('../../src/js/app.js?v=8.37', () => ({
      currentView: 'home',
      openModal,
      closeModal,
      showConfirm: vi.fn(),
      showToast,
    }));
    vi.doMock('../../src/js/registro-sessao.js?v=8.37', () => ({
      openRegistroSessao: vi.fn(),
    }));

    document.body.innerHTML = `
      <h2 id="modal-event-title"></h2>
      <div id="modal-event-body"></div>
    `;

    eventModals = await import('../../src/js/ui/event-modals.js?v=8.37');
  });

  it('opens the modal in edit mode pre-filled with the event data', () => {
    eventModals.openAddEventModal(null, 'ev_1');

    expect(document.getElementById('modal-event-title').textContent).toBe('Editar Estudo');
    expect(document.getElementById('event-titulo').value).toBe('Estudar Direito Ambiental');
    expect(document.getElementById('event-data').value).toBe('2026-06-03');
    expect(document.getElementById('event-duracao').value).toBe('120');
    expect(document.getElementById('event-notas').value).toBe('nota antiga');
    // Save button reflects edit (not "Salvar / Iniciar").
    expect(document.getElementById('modal-event-body').innerHTML).toContain('>Salvar<');
  });

  it('saveEvent updates the existing event in place without creating a new one', () => {
    eventModals.openAddEventModal(null, 'ev_1');

    document.getElementById('event-titulo').value = 'Estudar Direito Ambiental (revisado)';
    document.getElementById('event-duracao').value = '180';
    document.getElementById('event-notas').value = 'nota nova';

    eventModals.saveEvent();

    expect(store.state.eventos).toHaveLength(1);
    const ev = store.state.eventos[0];
    expect(ev.id).toBe('ev_1');
    expect(ev.titulo).toBe('Estudar Direito Ambiental (revisado)');
    expect(ev.duracao).toBe(180);
    expect(ev.notas).toBe('nota nova');
    // Existing fields preserved.
    expect(ev.criadoEm).toBe('2026-06-01T00:00:00.000Z');
    expect(store.scheduleSave).toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalledWith('modal-event');
    expect(showToast).toHaveBeenCalledWith('Evento atualizado!', 'success');
  });

  it('after editing, a subsequent create does not fall back into edit mode', () => {
    eventModals.openAddEventModal(null, 'ev_1');
    eventModals.saveEvent();

    // New create flow.
    eventModals.openAddEventModal();
    document.getElementById('event-titulo').value = 'Novo evento';
    eventModals.saveEvent();

    expect(store.state.eventos).toHaveLength(2);
    expect(store.state.eventos[1].titulo).toBe('Novo evento');
  });
});
