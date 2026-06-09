import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('revisao-view switchRevTab', () => {
  let mod;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('../../src/js/app.js?v=8.37', () => ({
      showConfirm: vi.fn(),
      showToast: vi.fn(),
    }));
    vi.doMock('../../src/js/store.js?v=8.37', () => ({
      scheduleSave: vi.fn(),
      state: { editais: [] },
    }));
    vi.doMock('../../src/js/logic.js?v=8.37', () => ({
      calcRevisionDates: vi.fn(() => []),
      getPendingRevisoes: vi.fn(() => []),
      invalidateRevCache: vi.fn(),
      invalidatePendingRevCache: vi.fn(),
    }));
    vi.doMock('../../src/js/components.js?v=8.37', () => ({ renderCurrentView: vi.fn() }));
    vi.doMock('../../src/js/edital-filter.js?v=8.37', () => ({
      getFilteredActiveDisciplinas: vi.fn(() => []),
      getSelectedEditalId: vi.fn(() => null),
    }));

    mod = await import('../../src/js/views/revisao-view.js?v=8.37');

    document.body.innerHTML = `
      <div class="tabs rev-tabs" role="tablist">
        <button class="tab-btn active" id="tab-pendentes" role="tab" aria-selected="true"></button>
        <button class="tab-btn" id="tab-proximas" role="tab" aria-selected="false"></button>
      </div>
      <div id="rev-tab-pendentes" class="tab-content active"></div>
      <div id="rev-tab-proximas" class="tab-content"></div>
    `;
  });

  it('updates active classes and aria-selected when switching tabs', () => {
    const btnProximas = document.getElementById('tab-proximas');
    mod.switchRevTab('proximas', btnProximas);

    expect(btnProximas.classList.contains('active')).toBe(true);
    expect(btnProximas.getAttribute('aria-selected')).toBe('true');

    const btnPendentes = document.getElementById('tab-pendentes');
    expect(btnPendentes.classList.contains('active')).toBe(false);
    expect(btnPendentes.getAttribute('aria-selected')).toBe('false');

    expect(document.getElementById('rev-tab-proximas').classList.contains('active')).toBe(true);
    expect(document.getElementById('rev-tab-pendentes').classList.contains('active')).toBe(false);
  });
});
