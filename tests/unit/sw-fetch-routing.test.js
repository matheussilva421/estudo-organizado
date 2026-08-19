import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let handlers;
let addEventListenerSpy;

function fakeEvent(path, { method = 'GET', destination = '', mode = 'no-cors' } = {}) {
  const url = new URL(path, self.location.origin).toString();
  return {
    request: {
      url,
      method,
      destination,
      mode,
      // sw.js may re-wrap the request via `new Request(evt.request, init)`;
      // undici coerces a non-Request input with String(), so expose the URL.
      toString: () => url,
    },
    respondWith: vi.fn(),
    waitUntil: vi.fn(),
  };
}

async function loadServiceWorker() {
  handlers = {};
  addEventListenerSpy = vi
    .spyOn(self, 'addEventListener')
    .mockImplementation((type, handler) => {
      handlers[type] = handler;
    });

  self.skipWaiting = vi.fn();
  self.clients = { claim: vi.fn(() => Promise.resolve()) };
  global.caches = {
    open: vi.fn(() => Promise.resolve({ addAll: vi.fn(() => Promise.resolve()) })),
    keys: vi.fn(() => Promise.resolve([])),
    delete: vi.fn(() => Promise.resolve()),
    match: vi.fn(() => Promise.resolve(undefined)),
  };
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, clone: () => ({}) }));

  await import('../../src/sw.js?v=routing-test');
  return handlers.fetch;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  addEventListenerSpy?.mockRestore();
  vi.resetModules();
});

describe('service worker fetch routing', () => {
  it('does not intercept the Firebase auth handler navigation', async () => {
    const onFetch = await loadServiceWorker();
    const evt = fakeEvent('/__/auth/handler?apiKey=abc', {
      destination: 'document',
      mode: 'navigate',
    });

    onFetch(evt);

    expect(evt.respondWith).not.toHaveBeenCalled();
  });

  it('does not intercept the Firebase auth iframe', async () => {
    const onFetch = await loadServiceWorker();
    const evt = fakeEvent('/__/auth/iframe?apiKey=abc', { destination: 'iframe' });

    onFetch(evt);

    expect(evt.respondWith).not.toHaveBeenCalled();
  });

  it('does not intercept Firebase reserved init endpoints', async () => {
    const onFetch = await loadServiceWorker();
    const evt = fakeEvent('/__/firebase/init.json');

    onFetch(evt);

    expect(evt.respondWith).not.toHaveBeenCalled();
  });

  it('still handles regular app navigations', async () => {
    const onFetch = await loadServiceWorker();
    const evt = fakeEvent('/index.html', { destination: 'document', mode: 'navigate' });

    onFetch(evt);

    expect(evt.respondWith).toHaveBeenCalledTimes(1);
  });

  it('still handles regular script requests', async () => {
    const onFetch = await loadServiceWorker();
    const evt = fakeEvent('/js/app.js', { destination: 'script' });

    onFetch(evt);

    expect(evt.respondWith).toHaveBeenCalledTimes(1);
  });
});
