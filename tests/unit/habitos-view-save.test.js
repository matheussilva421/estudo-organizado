import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('habitos-view saveHabit', () => {
  let storeModule;
  let logicModule;
  let appModule;
  let mod;

  beforeEach(async () => {
    vi.resetModules();
    storeModule = { state: { habitos: {} }, scheduleSave: vi.fn() };
    logicModule = { getActiveDisciplinas: vi.fn(() => []), getDisc: vi.fn(() => null) };
    appModule = {
      showConfirm: vi.fn(),
      showToast: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
    };

    vi.doMock('../../src/js/store.js?v=8.37', () => storeModule);
    vi.doMock('../../src/js/logic.js?v=8.37', () => logicModule);
    vi.doMock('../../src/js/components.js?v=8.37', () => ({ renderCurrentView: vi.fn() }));
    vi.doMock('../../src/js/app.js?v=8.37', () => appModule);

    mod = await import('../../src/js/views/habitos-view.js?v=8.37');

    document.body.innerHTML = `
      <div class="event-type-card"><button id="type-btn"></button></div>
      <input id="habit-data" value="2026-06-09">
      <input id="habit-qtd" value="10">
      <input id="habit-acertos" value="7">
      <select id="habit-disc"><option value="disc_x" selected>X</option></select>
    `;
    mod.selectHabitType('questoes', document.getElementById('type-btn'));
  });

  it('does not throw when selected discipline no longer exists', () => {
    logicModule.getDisc.mockReturnValue(null);
    expect(() => mod.saveHabit()).not.toThrow();
    const saved = storeModule.state.habitos.questoes;
    expect(saved).toHaveLength(1);
    expect(saved[0].quantidade).toBe(10);
    expect(saved[0].gabaritoPorDisc).toBeUndefined();
  });

  it('stores gabaritoPorDisc when discipline exists', () => {
    logicModule.getDisc.mockReturnValue({ disc: { nome: 'Direito' } });
    mod.saveHabit();
    const saved = storeModule.state.habitos.questoes;
    expect(saved).toHaveLength(1);
    expect(saved[0].gabaritoPorDisc).toEqual([
      { discId: 'disc_x', discNome: 'Direito', total: 10, acertos: 7 },
    ]);
  });

  it('rejeita quantidade negativa de questões', () => {
    document.getElementById('habit-qtd').value = '-10';
    mod.saveHabit();
    expect(storeModule.state.habitos.questoes).toBeUndefined();
    expect(appModule.showToast).toHaveBeenCalledWith(
      'Quantidade de questões é obrigatória',
      'error'
    );
  });

  it('rejeita acertos negativos ou maiores que a quantidade', () => {
    document.getElementById('habit-acertos').value = '-3';
    mod.saveHabit();
    expect(storeModule.state.habitos.questoes).toBeUndefined();

    document.getElementById('habit-acertos').value = '15';
    mod.saveHabit();
    expect(storeModule.state.habitos.questoes).toBeUndefined();
    expect(appModule.showToast).toHaveBeenCalledWith(
      'Acertos deve estar entre 0 e a quantidade de questões',
      'error'
    );
  });

  it('rejeita acertos por disciplina fora do range no simulado', () => {
    logicModule.getActiveDisciplinas.mockReturnValue([
      { disc: { id: 'disc_x', nome: 'Direito' } },
    ]);
    document.body.innerHTML += `
      <input id="habit-desc" value="Simulado A">
      <input id="habit-total" value="20">
      <input id="sim-total-disc_x" value="10">
      <input id="sim-acertos-disc_x" value="15">
    `;
    document.getElementById('habit-acertos').value = '12';
    mod.selectHabitType('simulado', document.getElementById('type-btn'));

    mod.saveHabit();

    expect(storeModule.state.habitos.simulado).toBeUndefined();
    expect(appModule.showToast).toHaveBeenCalledWith(
      'Acertos de Direito deve estar entre 0 e o total da disciplina',
      'error'
    );
  });

  it('rejeita páginas negativas em leitura', () => {
    document.body.innerHTML += '<input id="habit-paginas" value="-20">';
    mod.selectHabitType('leitura', document.getElementById('type-btn'));
    mod.saveHabit();
    expect(storeModule.state.habitos.leitura).toBeUndefined();
    expect(appModule.showToast).toHaveBeenCalledWith(
      'Páginas não podem ser negativas',
      'error'
    );
  });
});
