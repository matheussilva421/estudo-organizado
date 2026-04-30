import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('views.js - state and utilities', () => {
  let views;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('../../src/js/store.js?v=8.32', () => ({
      state: {
        config: {},
        editais: [],
        disciplinas: [],
        eventos: [],
        revisoes: [],
        planejamento: { ativo: false, sequencia: [] },
        cronoLivre: {},
      },
      scheduleSave: vi.fn(),
    }));
    vi.doMock('../../src/js/app.js?v=8.32', () => ({
      showToast: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      showConfirm: vi.fn((msg, cb) => cb()),
    }));
    vi.doMock('../../src/js/logic.js?v=8.32', () => ({
      getDisciplinaById: vi.fn(() => ({ id: 'disc_1', nome: 'Test', assuntos: [] })),
      invalidateDiscCache: vi.fn(),
      invalidateDashCaches: vi.fn(),
      invalidateRevCache: vi.fn(),
    }));
    vi.doMock('../../src/js/components.js?v=8.32', () => ({ renderCurrentView: vi.fn() }));
    vi.doMock('../../src/js/utils.js?v=8.32', () => ({
      esc: vi.fn((s) => s || ''),
      todayStr: vi.fn(() => '2026-04-29'),
      addCleanupListener: vi.fn(),
    }));
    vi.doMock('../../src/js/state/dashboard-context.js?v=8.32', () => ({
      getActiveDashboardDiscCtx: vi.fn(() => null),
      setActiveDashboardDiscCtx: vi.fn(),
    }));
    vi.doMock('../../src/js/ui/event-modals.js?v=8.32', () => ({
      openAddEventModal: vi.fn(),
      loadAssuntos: vi.fn(),
    }));

    views = await import('../../src/js/views.js?v=8.32');
  });

  describe('manager tab state', () => {
    it('getActiveDiscManagerTab returns default', () => {
      expect(views.getActiveDiscManagerTab()).toBe('topicos');
    });

    it('setActiveDiscManagerTab updates tab', () => {
      views.setActiveDiscManagerTab('aulas');
      expect(views.getActiveDiscManagerTab()).toBe('aulas');
    });
  });

  describe('sequence editing state', () => {
    it('getTempSequencia returns default null', () => {
      expect(views.getTempSequencia()).toBeNull();
    });

    it('setTempSequencia updates sequence', () => {
      const seq = [{ id: 's1' }];
      views.setTempSequencia(seq);
      expect(views.getTempSequencia()).toBe(seq);
    });

    it('getIsEditingSequence returns default false', () => {
      expect(views.getIsEditingSequence()).toBe(false);
    });

    it('setIsEditingSequence updates state', () => {
      views.setIsEditingSequence(true);
      expect(views.getIsEditingSequence()).toBe(true);
    });
  });

  describe('skeleton loaders', () => {
    it('renderSkeletonLoader returns HTML', () => {
      const html = views.renderSkeletonLoader();
      expect(html).toContain('loading-skeleton');
    });

    it('renderSkeletonList returns HTML with correct count', () => {
      const html = views.renderSkeletonList(3);
      expect(html).toContain('skeleton-list-item');
    });

    it('renderSkeletonTable returns HTML with table structure', () => {
      const html = views.renderSkeletonTable(2, 3);
      expect(html).toContain('skeleton-table');
      expect(html).toContain('tr');
    });
  });
});
