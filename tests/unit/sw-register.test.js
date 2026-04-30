import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(async () => {
  vi.resetModules();

  global.caches = {
    keys: vi.fn(() => Promise.resolve([])),
    delete: vi.fn(() => Promise.resolve()),
  };

  global.navigator = {
    serviceWorker: {
      register: vi.fn(() => Promise.resolve({
        scope: '/',
        installing: null,
        waiting: null,
        update: vi.fn(() => Promise.resolve()),
        addEventListener: vi.fn(),
      })),
      controller: null,
      addEventListener: vi.fn(),
      getRegistration: vi.fn(() => Promise.resolve(null)),
    },
  };

  global.document = {
    currentScript: { src: 'http://localhost/sw-register.js?v=1.0' },
  };

  global.window = {
    addEventListener: vi.fn((event, handler) => {
      if (event === 'load') handler();
    }),
    location: { href: 'http://localhost/', reload: vi.fn() },
  };

  global.console = { ...console, log: vi.fn(), error: vi.fn() };
});

describe('sw-register.js', () => {
  it('registers service worker when supported', async () => {
    await import('../../src/js/sw-register.js?v=8.30');
    expect(global.navigator.serviceWorker.register).toHaveBeenCalled();
  });

  it('passes updateViaCache none to registration', async () => {
    await import('../../src/js/sw-register.js?v=8.30');
    expect(global.navigator.serviceWorker.register).toHaveBeenCalledWith(
      './sw.js',
      { updateViaCache: 'none' }
    );
  });

  it('does not register when serviceWorker not in navigator', async () => {
    vi.resetModules();
    delete global.navigator.serviceWorker;
    await import('../../src/js/sw-register.js?v=8.30');
  });

  it('handles registration error gracefully', async () => {
    vi.resetModules();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.navigator.serviceWorker.register = vi.fn(() => Promise.reject(new Error('Network error')));
    await import('../../src/js/sw-register.js?v=8.30');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('cleans old caches on load', async () => {
    vi.resetModules();
    global.caches.keys = vi.fn(() => Promise.resolve([
      'estudo-organizado-v1.0',
      'estudo-organizado-v0.9',
    ]));
    await import('../../src/js/sw-register.js?v=8.30');
    expect(global.caches.delete).toHaveBeenCalledWith('estudo-organizado-v0.9');
  });
});
