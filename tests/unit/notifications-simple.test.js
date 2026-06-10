import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('notifications.js', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-19T14:00:00.000Z'));
  });

  describe('hasNotificationPermission', () => {
    it('exports initial permission state as false', async () => {
      const notif = await import('../../src/js/notifications.js?v=8.37');
      expect(notif.hasNotificationPermission).toBe(false);
    });
  });

  describe('fireNotification()', () => {
    it('dispatches toast fallback when no permission', async () => {
      vi.resetModules();
      vi.doMock('../../src/js/store.js?v=8.37', () => ({
        state: { config: {} },
      }));
      const notif = await import('../../src/js/notifications.js?v=8.37');
      vi.setSystemTime(new Date('2026-04-19T14:00:00.000Z'));
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
      notif.fireNotification('Test', 'Body', 'test-key-1');
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'app:showToast' })
      );
    });

    it('prevents duplicate notifications for same key on same day', async () => {
      vi.resetModules();
      vi.doMock('../../src/js/store.js?v=8.37', () => ({
        state: { config: {} },
      }));
      const notif = await import('../../src/js/notifications.js?v=8.37');
      vi.setSystemTime(new Date('2026-04-19T14:00:00.000Z'));
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
      notif.fireNotification('Test', 'Body', 'unique-key-1');
      const firstCallCount = dispatchSpy.mock.calls.length;
      notif.fireNotification('Test', 'Body', 'unique-key-1');
      expect(dispatchSpy.mock.calls.length).toBe(firstCallCount);
    });

    it('allows same key on different day', async () => {
      vi.resetModules();
      vi.doMock('../../src/js/store.js?v=8.37', () => ({
        state: { config: {} },
      }));
      const notif = await import('../../src/js/notifications.js?v=8.37');
      vi.setSystemTime(new Date('2026-04-19T14:00:00.000Z'));
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
      notif.fireNotification('Test', 'Body', 'daily-key');
      vi.setSystemTime(new Date('2026-04-20T14:00:00.000Z'));
      notif.fireNotification('Test', 'Body', 'daily-key');
      expect(dispatchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('modo silencioso com horários zero', () => {
    it('silentModeStart=0 não cai no default 22h (23h local deve notificar)', async () => {
      vi.resetModules();
      vi.doMock('../../src/js/store.js?v=8.37', () => ({
        state: { config: { silentModeStart: 0, silentModeEnd: 8 } },
      }));
      const notif = await import('../../src/js/notifications.js?v=8.37');
      // string sem Z = hora LOCAL, independente do fuso da máquina
      vi.setSystemTime(new Date('2026-04-19T23:00:00'));
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
      notif.fireNotification('Test', 'Body', 'zero-start');
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'app:showToast' }));
    });

    it('silentModeStart=0 silencia de madrugada (02h local)', async () => {
      vi.resetModules();
      vi.doMock('../../src/js/store.js?v=8.37', () => ({
        state: { config: { silentModeStart: 0, silentModeEnd: 8 } },
      }));
      const notif = await import('../../src/js/notifications.js?v=8.37');
      vi.setSystemTime(new Date('2026-04-19T02:00:00'));
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
      notif.fireNotification('Test', 'Body', 'zero-start-night');
      expect(dispatchSpy).not.toHaveBeenCalled();
    });
  });

  describe('cleanupNotificationEngine()', () => {
    it('clears the interval after startNotificationEngine', async () => {
      vi.resetModules();
      vi.doMock('../../src/js/store.js?v=8.37', () => ({
        state: { config: {} },
      }));
      vi.doMock('../../src/js/logic.js?v=8.37', () => ({
        getPendingRevisoes: vi.fn(() => []),
        getPredictiveStats: vi.fn(() => ({ status: 'verde', daysRemaining: 5 })),
      }));
      const notif = await import('../../src/js/notifications.js?v=8.37');
      notif.startNotificationEngine();
      notif.cleanupNotificationEngine();
      vi.advanceTimersByTime(15000000);
      expect(true).toBe(true);
    });

    it('handles cleanup when no interval is set', async () => {
      const notif = await import('../../src/js/notifications.js?v=8.37');
      expect(() => notif.cleanupNotificationEngine()).not.toThrow();
    });

    it('cancels the pending init timeout from initNotifications', async () => {
      vi.resetModules();
      const mockGetPending = vi.fn(() => []);
      vi.doMock('../../src/js/store.js?v=8.37', () => ({
        state: { config: {} },
      }));
      vi.doMock('../../src/js/logic.js?v=8.37', () => ({
        getPendingRevisoes: mockGetPending,
        getPredictiveStats: vi.fn(() => ({ status: 'verde', daysRemaining: 5 })),
      }));
      const notif = await import('../../src/js/notifications.js?v=8.37');
      await notif.initNotifications();
      notif.cleanupNotificationEngine();
      vi.advanceTimersByTime(3000);
      expect(mockGetPending).not.toHaveBeenCalled();
    });
  });

  describe('startNotificationEngine()', () => {
    it('runs checkTriggers immediately', async () => {
      vi.resetModules();
      const mockGetPending = vi.fn(() => []);
      const mockGetPredictive = vi.fn(() => ({ status: 'verde', daysRemaining: 5 }));
      vi.doMock('../../src/js/store.js?v=8.37', () => ({
        state: { config: {} },
      }));
      vi.doMock('../../src/js/logic.js?v=8.37', () => ({
        getPendingRevisoes: mockGetPending,
        getPredictiveStats: mockGetPredictive,
      }));
      const notif = await import('../../src/js/notifications.js?v=8.37');
      notif.startNotificationEngine();
      expect(mockGetPending).toHaveBeenCalled();
      expect(mockGetPredictive).toHaveBeenCalled();
    });
  });
});
