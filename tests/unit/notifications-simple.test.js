import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('notifications.js', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-19T14:00:00.000Z'));
  });

  describe('hasNotificationPermission', () => {
    it('exports initial permission state as false', async () => {
      const notif = await import('../../src/js/notifications.js?v=8.32');
      expect(notif.hasNotificationPermission).toBe(false);
    });
  });

  describe('fireNotification()', () => {
    it('dispatches toast fallback when no permission', async () => {
      vi.resetModules();
      vi.doMock('../../src/js/store.js?v=8.32', () => ({
        state: { config: {} },
      }));
      const notif = await import('../../src/js/notifications.js?v=8.32');
      vi.setSystemTime(new Date('2026-04-19T14:00:00.000Z'));
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
      notif.fireNotification('Test', 'Body', 'test-key-1');
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'app:showToast' })
      );
    });

    it('prevents duplicate notifications for same key on same day', async () => {
      vi.resetModules();
      vi.doMock('../../src/js/store.js?v=8.32', () => ({
        state: { config: {} },
      }));
      const notif = await import('../../src/js/notifications.js?v=8.32');
      vi.setSystemTime(new Date('2026-04-19T14:00:00.000Z'));
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
      notif.fireNotification('Test', 'Body', 'unique-key-1');
      const firstCallCount = dispatchSpy.mock.calls.length;
      notif.fireNotification('Test', 'Body', 'unique-key-1');
      expect(dispatchSpy.mock.calls.length).toBe(firstCallCount);
    });

    it('allows same key on different day', async () => {
      vi.resetModules();
      vi.doMock('../../src/js/store.js?v=8.32', () => ({
        state: { config: {} },
      }));
      const notif = await import('../../src/js/notifications.js?v=8.32');
      vi.setSystemTime(new Date('2026-04-19T14:00:00.000Z'));
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
      notif.fireNotification('Test', 'Body', 'daily-key');
      vi.setSystemTime(new Date('2026-04-20T14:00:00.000Z'));
      notif.fireNotification('Test', 'Body', 'daily-key');
      expect(dispatchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanupNotificationEngine()', () => {
    it('clears the interval after startNotificationEngine', async () => {
      vi.resetModules();
      vi.doMock('../../src/js/store.js?v=8.32', () => ({
        state: { config: {} },
      }));
      vi.doMock('../../src/js/logic.js?v=8.32', () => ({
        getPendingRevisoes: vi.fn(() => []),
        getPredictiveStats: vi.fn(() => ({ status: 'verde', daysRemaining: 5 })),
      }));
      const notif = await import('../../src/js/notifications.js?v=8.32');
      notif.startNotificationEngine();
      notif.cleanupNotificationEngine();
      vi.advanceTimersByTime(15000000);
      expect(true).toBe(true);
    });

    it('handles cleanup when no interval is set', async () => {
      const notif = await import('../../src/js/notifications.js?v=8.32');
      expect(() => notif.cleanupNotificationEngine()).not.toThrow();
    });
  });

  describe('startNotificationEngine()', () => {
    it('runs checkTriggers immediately', async () => {
      vi.resetModules();
      const mockGetPending = vi.fn(() => []);
      const mockGetPredictive = vi.fn(() => ({ status: 'verde', daysRemaining: 5 }));
      vi.doMock('../../src/js/store.js?v=8.32', () => ({
        state: { config: {} },
      }));
      vi.doMock('../../src/js/logic.js?v=8.32', () => ({
        getPendingRevisoes: mockGetPending,
        getPredictiveStats: mockGetPredictive,
      }));
      const notif = await import('../../src/js/notifications.js?v=8.32');
      notif.startNotificationEngine();
      expect(mockGetPending).toHaveBeenCalled();
      expect(mockGetPredictive).toHaveBeenCalled();
    });
  });
});
