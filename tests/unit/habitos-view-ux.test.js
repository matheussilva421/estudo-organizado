import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('habitos-view UX (modal title + simulado perc)', () => {
  let mod;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('../../src/js/store.js?v=8.37', () => ({
      state: { habitos: {} },
      scheduleSave: vi.fn(),
    }));
    vi.doMock('../../src/js/logic.js?v=8.37', () => ({
      getActiveDisciplinas: vi.fn(() => []),
      getDisc: vi.fn(() => null),
    }));
    vi.doMock('../../src/js/components.js?v=8.37', () => ({ renderCurrentView: vi.fn() }));
    vi.doMock('../../src/js/app.js?v=8.37', () => ({
      showConfirm: vi.fn(),
      showToast: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
    }));

    mod = await import('../../src/js/views/habitos-view.js?v=8.37');
  });

  it('selectHabitType updates the modal title to the selected type', () => {
    document.body.innerHTML = `
      <h3 id="modal-habit-title">Registrar: Questões</h3>
      <div class="event-type-card"><button id="type-btn"></button></div>
    `;
    mod.selectHabitType('simulado', document.getElementById('type-btn'));
    const title = document.getElementById('modal-habit-title').textContent;
    expect(title).toMatch(/^Registrar: /);
    expect(title).not.toContain('Questões');
  });

  it('calcSimuladoPerc clears stale percentage when total is emptied', () => {
    document.body.innerHTML = `
      <input id="habit-total" value="">
      <input id="habit-acertos" value="7">
      <div id="sim-perc"><span>70% de aproveitamento (7/10)</span></div>
    `;
    mod.calcSimuladoPerc();
    expect(document.getElementById('sim-perc').innerHTML).toBe('');
  });

  it('calcSimuladoPerc still renders percentage for valid totals', () => {
    document.body.innerHTML = `
      <input id="habit-total" value="10">
      <input id="habit-acertos" value="7">
      <div id="sim-perc"></div>
    `;
    mod.calcSimuladoPerc();
    expect(document.getElementById('sim-perc').textContent).toContain('70%');
  });
});
