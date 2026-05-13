/**
 * Import verification tests for editais/ sub-modules
 * Ensures all extracted modules are importable and re-exports work correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('editais/ sub-module imports', () => {
  beforeEach(() => {
    vi.resetModules();

    // Mock dependencies needed by sub-modules
    vi.doMock('../../src/js/app.js?v=8.37', () => ({
      closeModal: vi.fn(),
      showConfirm: vi.fn(),
      showToast: vi.fn(),
      openModal: vi.fn(),
    }));
    vi.doMock('../../src/js/utils.js?v=8.37', () => ({
      esc: vi.fn((s) => s),
      formatDate: vi.fn(),
      formatTime: vi.fn(),
      todayStr: vi.fn(() => '2026-01-01'),
      uid: vi.fn(() => 'mock_uid'),
    }));
    vi.doMock('../../src/js/store.js?v=8.37', () => ({
      scheduleSave: vi.fn(),
      state: { editais: [], eventos: [], planejamento: null },
    }));
    vi.doMock('../../src/js/logic.js?v=8.37', () => ({
      getDisc: vi.fn(),
      invalidateDiscCache: vi.fn(),
      invalidateDashCaches: vi.fn(),
    }));
    vi.doMock('../../src/js/components.js?v=8.37', () => ({
      renderCurrentView: vi.fn(),
    }));
    vi.doMock('../../src/js/ui-state.js?v=8.37', () => ({
      getUiSection: vi.fn(() => ({})),
      setUiSection: vi.fn(),
    }));
    vi.doMock('../../src/js/state/dashboard-context.js?v=8.37', () => ({
      setActiveDashboardDiscCtx: vi.fn(),
      clearActiveDashboardDiscCtx: vi.fn(),
      getActiveDashboardDiscCtx: vi.fn(() => null),
      setActiveDashboardTab: vi.fn(),
      resetActiveDashboardTab: vi.fn(),
    }));
    vi.doMock('../../src/js/views/state/disc-manager-state.js', () => ({
      getActiveDiscManagerTab: vi.fn(() => 'topicos'),
      setActiveDiscManagerTab: vi.fn(),
    }));
    vi.doMock('../../src/js/views/dashboard-view.js', () => ({
      initDiscDashboardChart: vi.fn(),
      renderDisciplinaDashboard: vi.fn(() => '<div></div>'),
    }));
    vi.doMock('../../src/js/lesson-mapper.js?v=8.37', () => ({
      mapAulasToAssuntos: vi.fn(() => 0),
    }));
  });

  describe('shared-state.js', () => {
    it('exports COLORS array', async () => {
      const mod = await import('../../src/js/views/editais/shared-state.js');
      expect(mod.COLORS).toBeDefined();
      expect(Array.isArray(mod.COLORS)).toBe(true);
      expect(mod.COLORS.length).toBeGreaterThan(0);
    });

    it('exports DISC_ICONS array', async () => {
      const mod = await import('../../src/js/views/editais/shared-state.js');
      expect(mod.DISC_ICONS).toBeDefined();
      expect(Array.isArray(mod.DISC_ICONS)).toBe(true);
      expect(mod.DISC_ICONS.length).toBeGreaterThan(0);
    });

    it('exports getEditingSubjectCtx/setEditingSubjectCtx functions', async () => {
      const mod = await import('../../src/js/views/editais/shared-state.js');
      expect(mod.getEditingSubjectCtx).toBeInstanceOf(Function);
      expect(mod.setEditingSubjectCtx).toBeInstanceOf(Function);
    });

    it('exports getEditingDiscCtx/setEditingDiscCtx functions', async () => {
      const mod = await import('../../src/js/views/editais/shared-state.js');
      expect(mod.getEditingDiscCtx).toBeInstanceOf(Function);
      expect(mod.setEditingDiscCtx).toBeInstanceOf(Function);
    });
  });

  describe('delete-operations.js', () => {
    it('exports deleteAssunto', async () => {
      const mod = await import('../../src/js/views/editais/delete-operations.js');
      expect(mod.deleteAssunto).toBeInstanceOf(Function);
    });

    it('exports deleteDisc', async () => {
      const mod = await import('../../src/js/views/editais/delete-operations.js');
      expect(mod.deleteDisc).toBeInstanceOf(Function);
    });

    it('exports deleteEdital', async () => {
      const mod = await import('../../src/js/views/editais/delete-operations.js');
      expect(mod.deleteEdital).toBeInstanceOf(Function);
    });
  });

  describe('disc-crud.js', () => {
    it('exports openDiscModal', async () => {
      const mod = await import('../../src/js/views/editais/disc-crud.js');
      expect(mod.openDiscModal).toBeInstanceOf(Function);
    });

    it('exports selectIcon', async () => {
      const mod = await import('../../src/js/views/editais/disc-crud.js');
      expect(mod.selectIcon).toBeInstanceOf(Function);
    });

    it('exports selectDiscColor', async () => {
      const mod = await import('../../src/js/views/editais/disc-crud.js');
      expect(mod.selectDiscColor).toBeInstanceOf(Function);
    });

    it('exports saveDisc', async () => {
      const mod = await import('../../src/js/views/editais/disc-crud.js');
      expect(mod.saveDisc).toBeInstanceOf(Function);
    });

    it('exports saveDiscManager', async () => {
      const mod = await import('../../src/js/views/editais/disc-crud.js');
      expect(mod.saveDiscManager).toBeInstanceOf(Function);
    });

    it('exports moveSubject', async () => {
      const mod = await import('../../src/js/views/editais/disc-crud.js');
      expect(mod.moveSubject).toBeInstanceOf(Function);
    });
  });

  describe('disc-manager.js', () => {
    it('exports openDiscManager', async () => {
      const mod = await import('../../src/js/views/editais/disc-manager.js');
      expect(mod.openDiscManager).toBeInstanceOf(Function);
    });

    it('exports switchManagerTab', async () => {
      const mod = await import('../../src/js/views/editais/disc-manager.js');
      expect(mod.switchManagerTab).toBeInstanceOf(Function);
    });
  });

  describe('inline-editing.js', () => {
    it('exports editSubjectInline', async () => {
      const mod = await import('../../src/js/views/editais/inline-editing.js');
      expect(mod.editSubjectInline).toBeInstanceOf(Function);
    });

    it('exports editLessonInline', async () => {
      const mod = await import('../../src/js/views/editais/inline-editing.js');
      expect(mod.editLessonInline).toBeInstanceOf(Function);
    });
  });

  describe('aula-operations.js', () => {
    it('exports toggleAulaEstudada', async () => {
      const mod = await import('../../src/js/views/editais/aula-operations.js');
      expect(mod.toggleAulaEstudada).toBeInstanceOf(Function);
    });

    it('exports addBulkAulas', async () => {
      const mod = await import('../../src/js/views/editais/aula-operations.js');
      expect(mod.addBulkAulas).toBeInstanceOf(Function);
    });

    it('exports addAssunto', async () => {
      const mod = await import('../../src/js/views/editais/aula-operations.js');
      expect(mod.addAssunto).toBeInstanceOf(Function);
    });

    it('exports deleteAula', async () => {
      const mod = await import('../../src/js/views/editais/aula-operations.js');
      expect(mod.deleteAula).toBeInstanceOf(Function);
    });

    it('exports runLessonMapperUI', async () => {
      const mod = await import('../../src/js/views/editais/aula-operations.js');
      expect(mod.runLessonMapperUI).toBeInstanceOf(Function);
    });
  });

  describe('editais-crud.js barrel re-exports', () => {
    it('re-exports all functions from sub-modules', async () => {
      // Delay mock setup until sub-module mocks are in place
      const mod = await import('../../src/js/views/editais-crud.js');

      // Shared state
      expect(mod.COLORS).toBeDefined();
      expect(mod.DISC_ICONS).toBeDefined();
      expect(mod.getEditingSubjectCtx).toBeInstanceOf(Function);
      expect(mod.setEditingSubjectCtx).toBeInstanceOf(Function);
      expect(mod.getEditingDiscCtx).toBeInstanceOf(Function);
      expect(mod.setEditingDiscCtx).toBeInstanceOf(Function);

      // Delete operations
      expect(mod.deleteAssunto).toBeInstanceOf(Function);
      expect(mod.deleteDisc).toBeInstanceOf(Function);
      expect(mod.deleteEdital).toBeInstanceOf(Function);

      // Disc CRUD
      expect(mod.openDiscModal).toBeInstanceOf(Function);
      expect(mod.selectIcon).toBeInstanceOf(Function);
      expect(mod.selectDiscColor).toBeInstanceOf(Function);
      expect(mod.saveDisc).toBeInstanceOf(Function);
      expect(mod.saveDiscManager).toBeInstanceOf(Function);
      expect(mod.moveSubject).toBeInstanceOf(Function);

      // Disc manager
      expect(mod.openDiscManager).toBeInstanceOf(Function);
      expect(mod.switchManagerTab).toBeInstanceOf(Function);

      // Inline editing
      expect(mod.editSubjectInline).toBeInstanceOf(Function);
      expect(mod.editLessonInline).toBeInstanceOf(Function);

      // Aula operations
      expect(mod.toggleAulaEstudada).toBeInstanceOf(Function);
      expect(mod.addBulkAulas).toBeInstanceOf(Function);
      expect(mod.addAssunto).toBeInstanceOf(Function);
      expect(mod.deleteAula).toBeInstanceOf(Function);
      expect(mod.runLessonMapperUI).toBeInstanceOf(Function);

      // Kept functions still exported directly
      expect(mod.toggleEdital).toBeInstanceOf(Function);
      expect(mod.toggleAssunto).toBeInstanceOf(Function);
      expect(mod.openDiscDashboard).toBeInstanceOf(Function);
      expect(mod.openEditaModal).toBeInstanceOf(Function);
      expect(mod.saveEdital).toBeInstanceOf(Function);
    });
  });
});
