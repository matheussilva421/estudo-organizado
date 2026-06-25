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

  it('clampa a página do histórico quando registros são excluídos', async () => {
    const store = await import('../../src/js/store.js?v=8.37');
    const mkRecords = (n) =>
      Array.from({ length: n }, (_, i) => ({
        id: `h${i}`,
        data: `2026-04-${String((i % 28) + 1).padStart(2, '0')}`,
        quantidade: 1,
      }));
    store.state.habitos = { questoes: mkRecords(21) };
    document.body.innerHTML = `
      <div id="habit-hist-count"></div>
      <div id="habit-hist-list"></div>
      <div id="habit-hist-footer"></div>
    `;

    document.getElementById('habit-hist-list').scrollIntoView = vi.fn(); // jsdom não implementa
    mod.setHabitPage(3); // 21 registros / 10 por página = 3 páginas

    // exclusões reduzem para 11 registros (2 páginas); página 3 ficou órfã
    store.state.habitos = { questoes: mkRecords(11) };
    mod.renderHabitHistPage();

    expect(document.getElementById('habit-hist-list').innerHTML).not.toContain('Nenhum hábito');
    expect(document.getElementById('habit-hist-footer').innerHTML).toContain('Página 2 de 2');
  });

  it('mostra % de aproveitamento para registro manual de questões (que usa quantidade, não total)', async () => {
    const store = await import('../../src/js/store.js?v=8.37');
    // saveHabit grava { quantidade, acertos } — sem `total`, que só existe em
    // registros criados pelo registro de sessão.
    store.state.habitos = {
      questoes: [{ id: 'h1', data: '2026-04-10', quantidade: 10, acertos: 7 }],
    };
    document.body.innerHTML = `
      <div id="habit-hist-count"></div>
      <div id="habit-hist-list"></div>
      <div id="habit-hist-footer"></div>
    `;

    mod.renderHabitHistPage();

    expect(document.getElementById('habit-hist-list').innerHTML).toContain('70%');
  });

  it('não mostra NaN% quando o registro de questões não tem acertos', async () => {
    const store = await import('../../src/js/store.js?v=8.37');
    store.state.habitos = {
      questoes: [{ id: 'h1', data: '2026-04-10', total: 10 }],
    };
    document.body.innerHTML = `
      <div id="habit-hist-count"></div>
      <div id="habit-hist-list"></div>
      <div id="habit-hist-footer"></div>
    `;

    mod.renderHabitHistPage();

    expect(document.getElementById('habit-hist-list').innerHTML).not.toContain('NaN');
  });

  it('marca hÃ¡bitos-chave com hierarquia visual sem dar o mesmo peso aos 9 cards', async () => {
    const store = await import('../../src/js/store.js?v=8.37');
    store.state.habitos = {};
    const el = { innerHTML: '' };

    mod.renderHabitos(el);

    const keyCards = el.innerHTML.match(/habit-card--key/g) || [];
    const supportingCards = el.innerHTML.match(/habit-card--supporting/g) || [];

    expect(keyCards).toHaveLength(3);
    expect(supportingCards).toHaveLength(6);
    expect(el.innerHTML).toContain('data-habit-tier="key"');
    expect(el.innerHTML).toContain('data-habit-category="questoes"');
    expect(el.innerHTML).toContain('data-habit-category="paginas"');
    expect(el.innerHTML).toContain('data-habit-category="videoaula"');
  });

  it('calcSimuladoPerc acusa acertos negativos em vez de mostrar percentual absurdo', () => {
    document.body.innerHTML = `
      <input id="habit-total" value="10">
      <input id="habit-acertos" value="-7">
      <div id="sim-perc"></div>
    `;
    mod.calcSimuladoPerc();
    const html = document.getElementById('sim-perc').innerHTML;
    expect(html).not.toContain('-70%');
    expect(html).toContain('negativos');
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
