import { beforeEach, describe, expect, it, vi } from 'vitest';

let dashboardContext;

beforeEach(async () => {
  vi.resetModules();
  dashboardContext = await import('../../src/js/state/dashboard-context.js?v=8.36');
});

describe('dashboard-context.js', () => {
  describe('getActiveDashboardDiscCtx', () => {
    it('returns null initially', () => {
      expect(dashboardContext.getActiveDashboardDiscCtx()).toBeNull();
    });

    it('returns set context', () => {
      const ctx = { discId: 'disc_1', editalId: 'ed_1' };
      dashboardContext.setActiveDashboardDiscCtx(ctx);

      expect(dashboardContext.getActiveDashboardDiscCtx()).toBe(ctx);
    });
  });

  describe('setActiveDashboardDiscCtx', () => {
    it('stores dashboard context', () => {
      const ctx = { discId: 'disc_2', editalId: 'ed_2' };
      dashboardContext.setActiveDashboardDiscCtx(ctx);

      expect(dashboardContext.getActiveDashboardDiscCtx()).toBe(ctx);
    });

    it('allows overwriting context', () => {
      const ctx1 = { discId: 'disc_1' };
      const ctx2 = { discId: 'disc_2' };
      dashboardContext.setActiveDashboardDiscCtx(ctx1);
      dashboardContext.setActiveDashboardDiscCtx(ctx2);

      expect(dashboardContext.getActiveDashboardDiscCtx()).toBe(ctx2);
    });
  });

  describe('clearActiveDashboardDiscCtx', () => {
    it('clears dashboard context', () => {
      dashboardContext.setActiveDashboardDiscCtx({ discId: 'disc_1' });
      dashboardContext.clearActiveDashboardDiscCtx();

      expect(dashboardContext.getActiveDashboardDiscCtx()).toBeNull();
    });
  });

  describe('getActiveDashboardTab', () => {
    it('returns default tab "topicos"', () => {
      expect(dashboardContext.getActiveDashboardTab()).toBe('topicos');
    });

    it('returns set tab', () => {
      dashboardContext.setActiveDashboardTab('assuntos');

      expect(dashboardContext.getActiveDashboardTab()).toBe('assuntos');
    });
  });

  describe('setActiveDashboardTab', () => {
    it('stores active tab', () => {
      dashboardContext.setActiveDashboardTab('revisoes');

      expect(dashboardContext.getActiveDashboardTab()).toBe('revisoes');
    });

    it('allows any tab value', () => {
      dashboardContext.setActiveDashboardTab('custom-tab');

      expect(dashboardContext.getActiveDashboardTab()).toBe('custom-tab');
    });
  });

  describe('resetActiveDashboardTab', () => {
    it('resets tab to default "topicos"', () => {
      dashboardContext.setActiveDashboardTab('assuntos');
      dashboardContext.resetActiveDashboardTab();

      expect(dashboardContext.getActiveDashboardTab()).toBe('topicos');
    });
  });
});
