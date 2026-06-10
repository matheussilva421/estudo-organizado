import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('banca-view parseBancaText', () => {
  let storeModule;
  let appModule;
  let mod;

  beforeEach(async () => {
    vi.resetModules();
    storeModule = {
      state: { editais: [{ id: 'ed_1' }], bancaRelevance: { hotTopics: [] } },
      scheduleSave: vi.fn(),
    };
    appModule = {
      showToast: vi.fn(),
      showConfirm: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
    };

    vi.doMock('../../src/js/store.js?v=8.37', () => storeModule);
    vi.doMock('../../src/js/app.js?v=8.37', () => appModule);
    vi.doMock('../../src/js/state/dashboard-context.js?v=8.37', () => ({
      getActiveDashboardDiscCtx: vi.fn(() => null),
    }));
    vi.doMock('../../src/js/relevance.js?v=8.37', () => ({
      applyRankingToEdital: vi.fn(() => []),
      commitEditalOrdering: vi.fn(),
      revertEditalOrdering: vi.fn(),
    }));

    mod = await import('../../src/js/views/banca-view.js?v=8.37');
  });

  it('processa linhas válidas e substitui os tópicos da disciplina', () => {
    storeModule.state.bancaRelevance.hotTopics = [
      { id: 'old', nome: 'Velho', disciplinaId: 'd1' },
    ];
    document.body.innerHTML = `
      <select id="banca-disc-select"><option value="d1" selected>⚪ D</option></select>
      <textarea id="banca-input-text">1. Controle de Constitucionalidade (40%)
2. Direitos Fundamentais (30%)</textarea>
      <div id="banca-match-results"></div>
      <div id="banca-match-empty"></div>
      <button id="banca-apply-btn"></button>
      <div id="banca-stats"></div>
    `;

    mod.parseBancaText();

    const topics = storeModule.state.bancaRelevance.hotTopics;
    expect(topics).toHaveLength(2);
    expect(topics[0].nome).toContain('Controle');
    expect(topics[0].weight).toBe(40);
  });

  it('não apaga a análise existente quando nenhum tópico é reconhecido', () => {
    storeModule.state.bancaRelevance.hotTopics = [
      { id: 'old', nome: 'Análise antiga', disciplinaId: 'd1' },
    ];
    document.body.innerHTML = `
      <select id="banca-disc-select"><option value="d1" selected>⚪ D</option></select>
      <textarea id="banca-input-text">ok</textarea>
      <div id="banca-match-results"></div>
      <div id="banca-match-empty"></div>
      <button id="banca-apply-btn"></button>
      <div id="banca-stats"></div>
    `;

    mod.parseBancaText();

    // texto sem linhas reconhecíveis não pode destruir os tópicos salvos
    expect(storeModule.state.bancaRelevance.hotTopics).toHaveLength(1);
    expect(appModule.showToast).toHaveBeenCalledWith(
      expect.stringContaining('Nenhum tópico'),
      'error'
    );
  });
});
