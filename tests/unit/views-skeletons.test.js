import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('views.js - skeleton loaders', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('renderSkeletonLoader()', () => {
    it('returns HTML string with skeleton structure', async () => {
      const views = await import('../../src/js/views.js?v=8.34');
      const html = views.renderSkeletonLoader();
      expect(typeof html).toBe('string');
      expect(html).toContain('loading-skeleton');
      expect(html).toContain('skeleton-stat-card');
    });
  });

  describe('renderSkeletonList()', () => {
    it('returns HTML string with specified count', async () => {
      const views = await import('../../src/js/views.js?v=8.34');
      const html = views.renderSkeletonList(3);
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
    });

    it('uses default count of 5', async () => {
      const views = await import('../../src/js/views.js?v=8.34');
      const html = views.renderSkeletonList();
      expect(typeof html).toBe('string');
    });
  });
});

describe('views.js - module state getters/setters', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('active disc manager tab', () => {
    it('getActiveDiscManagerTab returns default', async () => {
      const views = await import('../../src/js/views.js?v=8.34');
      expect(views.getActiveDiscManagerTab()).toBe('topicos');
    });

    it('setActiveDiscManagerTab updates value', async () => {
      const views = await import('../../src/js/views.js?v=8.34');
      views.setActiveDiscManagerTab('questoes');
      expect(views.getActiveDiscManagerTab()).toBe('questoes');
    });
  });

  describe('temp sequencia', () => {
    it('getTempSequencia returns null initially', async () => {
      const views = await import('../../src/js/views.js?v=8.34');
      expect(views.getTempSequencia()).toBeNull();
    });

    it('setTempSequencia updates value', async () => {
      const views = await import('../../src/js/views.js?v=8.34');
      views.setTempSequencia([{ id: '1' }]);
      expect(views.getTempSequencia()).toEqual([{ id: '1' }]);
    });
  });

  describe('editing sequence flag', () => {
    it('getIsEditingSequence returns false initially', async () => {
      const views = await import('../../src/js/views.js?v=8.34');
      expect(views.getIsEditingSequence()).toBe(false);
    });

    it('setIsEditingSequence updates value', async () => {
      const views = await import('../../src/js/views.js?v=8.34');
      views.setIsEditingSequence(true);
      expect(views.getIsEditingSequence()).toBe(true);
    });
  });
});
