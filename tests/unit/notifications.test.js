import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/js/store.js?v=8.29', () => ({
  state: {
    config: {
      silentModeStart: 22,
      silentModeEnd: 8,
      metas: { horasSemana: 20 }
    }
  }
}));

vi.mock('../../src/js/logic.js?v=8.29', () => ({
  getPendingRevisoes: vi.fn(() => []),
  getPredictiveStats: vi.fn(() => ({ status: 'verde', daysRemaining: 5, suggestion: '' }))
}));

const notifications = await import('../../src/js/notifications.js?v=8.29');
const { state } = await import('../../src/js/store.js?v=8.29');
const logic = await import('../../src/js/logic.js?v=8.29');

describe('notifications.js - fireNotification', () => {
  let dispatchSpy;
  let notifMock;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    dispatchSpy = vi.fn();
    notifMock = vi.fn();
    global.document = { dispatchEvent: dispatchSpy };
    global.Notification = notifMock;
    state.config = { silentModeStart: 22, silentModeEnd: 8, metas: { horasSemana: 20 } };
    vi.setSystemTime(new Date('2026-04-19T12:00:00.000Z'));
    vi.mocked(logic.getPendingRevisoes).mockReturnValue([]);
    vi.mocked(logic.getPredictiveStats).mockReturnValue({ status: 'verde', daysRemaining: 5, suggestion: '' });
  });

  afterEach(() => {
    notifications.cleanupNotificationEngine();
    vi.useRealTimers();
  });

  it('fires toast notification when permission not granted', async () => {
    vi.doMock('../../src/js/notifications.js?v=8.29', () => ({
      ...notifications,
      hasNotificationPermission: false
    }));
    const mod = await import('../../src/js/notifications.js?v=8.29');
    mod.fireNotification('Test Title', 'Test Body', 'test_key');
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0][0];
    expect(event.detail.msg).toContain('Test Title');
    expect(event.detail.type).toBe('info');
  });

  it('deduplicates notifications with same key on same day', () => {
    notifications.fireNotification('Test', 'Body', 'same_key');
    notifications.fireNotification('Test', 'Body', 'same_key');
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });

  it('allows different keys on same day', () => {
    notifications.fireNotification('Test', 'Body', 'key_1');
    notifications.fireNotification('Test', 'Body', 'key_2');
    expect(dispatchSpy).toHaveBeenCalledTimes(2);
  });
});

describe('notifications.js - startNotificationEngine', () => {
  let setIntervalSpy;
  let clearIntervalSpy;

  beforeEach(() => {
    setIntervalSpy = vi.fn(() => 123);
    clearIntervalSpy = vi.fn();
    global.setInterval = setIntervalSpy;
    global.clearInterval = clearIntervalSpy;
    global.document = { dispatchEvent: vi.fn() };
    global.Notification = vi.fn();
    state.config = { silentModeStart: 22, silentModeEnd: 8, metas: { horasSemana: 20 } };
    vi.mocked(logic.getPendingRevisoes).mockReturnValue([]);
    vi.mocked(logic.getPredictiveStats).mockReturnValue({ status: 'verde', daysRemaining: 5, suggestion: '' });
    vi.setSystemTime(new Date('2026-04-19T12:00:00.000Z'));
  });

  afterEach(() => {
    notifications.cleanupNotificationEngine();
    vi.useRealTimers();
  });

  it('sets interval to 4 hours (14400000ms)', () => {
    notifications.startNotificationEngine();
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 14400000);
  });

  it('clears previous interval before setting new one', () => {
    notifications.startNotificationEngine();
    notifications.startNotificationEngine();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
});

describe('notifications.js - cleanupNotificationEngine', () => {
  let clearIntervalSpy;

  beforeEach(() => {
    clearIntervalSpy = vi.fn();
    global.clearInterval = clearIntervalSpy;
    global.document = { dispatchEvent: vi.fn() };
    global.Notification = vi.fn();
    state.config = { silentModeStart: 22, silentModeEnd: 8, metas: { horasSemana: 20 } };
    vi.mocked(logic.getPendingRevisoes).mockReturnValue([]);
    vi.mocked(logic.getPredictiveStats).mockReturnValue({ status: 'verde', daysRemaining: 5, suggestion: '' });
  });

  it('clears the interval', () => {
    notifications.startNotificationEngine();
    notifications.cleanupNotificationEngine();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('does not throw when no interval exists', () => {
    expect(() => notifications.cleanupNotificationEngine()).not.toThrow();
  });

  it('sets interval to null after cleanup', () => {
    notifications.startNotificationEngine();
    notifications.cleanupNotificationEngine();
    notifications.cleanupNotificationEngine();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
});

describe('notifications.js - initNotifications', () => {
  let setTimeoutSpy;

  beforeEach(() => {
    setTimeoutSpy = vi.fn();
    global.setTimeout = setTimeoutSpy;
    global.document = { dispatchEvent: vi.fn() };
  });

  it('does not throw when Notification API not available', async () => {
    const originalNotification = global.Notification;
    delete global.Notification;
    await expect(notifications.initNotifications()).resolves.not.toThrow();
    global.Notification = originalNotification;
  });

  it('schedules engine start after 2 seconds when permission granted', async () => {
    global.Notification = { permission: 'granted' };
    await notifications.initNotifications();
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
  });
});
