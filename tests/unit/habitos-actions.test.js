import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ui/actions/habitos.js', () => {
  let registerAction;
  let habitosView;

  beforeEach(async () => {
    vi.resetModules();
    registerAction = vi.fn();
    habitosView = {
      openHabitModal: vi.fn(),
      saveHabit: vi.fn(),
      deleteHabito: vi.fn(),
      selectHabitType: vi.fn(),
      setHabitPage: vi.fn(),
      calcSimuladoPerc: vi.fn(),
      editHabit: vi.fn(),
    };

    vi.doMock('../../src/js/ui/actions/dispatcher.js', () => ({ registerAction }));
    vi.doMock('../../src/js/views/habitos-view.js?v=8.36', () => habitosView);

    await import('../../src/js/ui/actions/habitos.js');
  });

  it('registers all habit actions', () => {
    const calls = registerAction.mock.calls.map(c => c[0]);
    expect(calls).toContain('open-habit-modal');
    expect(calls).toContain('save-habit');
    expect(calls).toContain('edit-habit');
    expect(calls).toContain('delete-habit');
    expect(calls).toContain('select-habit-type');
    expect(calls).toContain('set-habit-page');
    expect(calls).toContain('calc-simulado-perc');
  });

  it('open-habit-modal handler calls openHabitModal with habitKey', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'open-habit-modal')[1];
    handler({ dataset: { habitKey: 'habit_1' } });
    expect(habitosView.openHabitModal).toHaveBeenCalledWith('habit_1');
  });

  it('set-habit-page handler parses page number', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'set-habit-page')[1];
    handler({ dataset: { page: '2' } });
    expect(habitosView.setHabitPage).toHaveBeenCalledWith(2);
  });

  it('save-habit handler is saveHabit directly', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'save-habit')[1];
    expect(handler).toBe(habitosView.saveHabit);
  });

  it('calc-simulado-perc handler is calcSimuladoPerc directly', () => {
    const handler = registerAction.mock.calls.find(c => c[0] === 'calc-simulado-perc')[1];
    expect(handler).toBe(habitosView.calcSimuladoPerc);
  });
});
