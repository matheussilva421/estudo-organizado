import { beforeEach, describe, expect, it, vi } from 'vitest';

let chartState;

beforeEach(async () => {
  vi.resetModules();
  chartState = await import('../../src/js/state/chart-state.js?v=8.36');
});

describe('chart-state.js', () => {
  describe('getDiscChartInstance', () => {
    it('returns null initially', () => {
      expect(chartState.getDiscChartInstance()).toBeNull();
    });

    it('returns set instance', () => {
      const mockInstance = { destroy: vi.fn() };
      chartState.setDiscChartInstance(mockInstance);

      expect(chartState.getDiscChartInstance()).toBe(mockInstance);
    });
  });

  describe('setDiscChartInstance', () => {
    it('stores chart instance', () => {
      const mockInstance = { type: 'bar' };
      chartState.setDiscChartInstance(mockInstance);

      expect(chartState.getDiscChartInstance()).toBe(mockInstance);
    });

    it('allows overwriting instance', () => {
      const instance1 = { type: 'bar' };
      const instance2 = { type: 'line' };
      chartState.setDiscChartInstance(instance1);
      chartState.setDiscChartInstance(instance2);

      expect(chartState.getDiscChartInstance()).toBe(instance2);
    });

    it('allows clearing instance with null', () => {
      chartState.setDiscChartInstance({ type: 'bar' });
      chartState.setDiscChartInstance(null);

      expect(chartState.getDiscChartInstance()).toBeNull();
    });
  });

  describe('getPlanjChartInstance', () => {
    it('returns null initially', () => {
      expect(chartState.getPlanjChartInstance()).toBeNull();
    });

    it('returns set instance', () => {
      const mockInstance = { destroy: vi.fn() };
      chartState.setPlanjChartInstance(mockInstance);

      expect(chartState.getPlanjChartInstance()).toBe(mockInstance);
    });
  });

  describe('setPlanjChartInstance', () => {
    it('stores chart instance', () => {
      const mockInstance = { type: 'doughnut' };
      chartState.setPlanjChartInstance(mockInstance);

      expect(chartState.getPlanjChartInstance()).toBe(mockInstance);
    });

    it('allows overwriting instance', () => {
      const instance1 = { type: 'doughnut' };
      const instance2 = { type: 'pie' };
      chartState.setPlanjChartInstance(instance1);
      chartState.setPlanjChartInstance(instance2);

      expect(chartState.getPlanjChartInstance()).toBe(instance2);
    });

    it('allows clearing instance with null', () => {
      chartState.setPlanjChartInstance({ type: 'doughnut' });
      chartState.setPlanjChartInstance(null);

      expect(chartState.getPlanjChartInstance()).toBeNull();
    });
  });

  describe('independence between instances', () => {
    it('disc and planj instances are independent', () => {
      const discInstance = { type: 'bar' };
      const planjInstance = { type: 'doughnut' };

      chartState.setDiscChartInstance(discInstance);
      chartState.setPlanjChartInstance(planjInstance);

      expect(chartState.getDiscChartInstance()).toBe(discInstance);
      expect(chartState.getPlanjChartInstance()).toBe(planjInstance);
    });
  });
});
