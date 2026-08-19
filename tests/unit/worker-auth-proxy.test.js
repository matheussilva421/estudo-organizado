import { beforeEach, describe, expect, it, vi } from 'vitest';

const FIREBASE_AUTH_HOST = 'app-de-estudos-14564.firebaseapp.com';

let worker;
let assetsFetch;
let env;

class FakeRequest {
  constructor(input, init = {}) {
    this.url = typeof input === 'string' ? input : input.url;
    this.method = init.method || input?.method || 'GET';
    this.headers = init.headers || input?.headers || {};
  }
}

beforeEach(async () => {
  vi.resetModules();
  global.Request = FakeRequest;
  global.fetch = vi.fn(() => Promise.resolve({ status: 200 }));
  assetsFetch = vi.fn(() => Promise.resolve({ status: 200 }));
  env = { ASSETS: { fetch: assetsFetch } };
  worker = (await import('../../worker/index.js')).default;
});

describe('Cloudflare worker Firebase auth proxy', () => {
  it('proxies /__/auth/handler to the Firebase auth host preserving path and query', async () => {
    const request = new FakeRequest(
      'https://estudo-organizado.matheussilva421.workers.dev/__/auth/handler?apiKey=abc&providerId=google.com'
    );

    await worker.fetch(request, env);

    expect(assetsFetch).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [proxied, init] = global.fetch.mock.calls[0];
    const proxiedUrl = new URL(typeof proxied === 'string' ? proxied : proxied.url);
    expect(proxiedUrl.host).toBe(FIREBASE_AUTH_HOST);
    expect(proxiedUrl.protocol).toBe('https:');
    expect(proxiedUrl.pathname).toBe('/__/auth/handler');
    expect(proxiedUrl.searchParams.get('apiKey')).toBe('abc');
    expect(proxiedUrl.searchParams.get('providerId')).toBe('google.com');
    expect(init).toMatchObject({ redirect: 'manual' });
  });

  it('proxies /__/firebase/init.json as well', async () => {
    const request = new FakeRequest(
      'https://estudo-organizado.matheussilva421.workers.dev/__/firebase/init.json'
    );

    await worker.fetch(request, env);

    const [proxied] = global.fetch.mock.calls[0];
    const proxiedUrl = new URL(typeof proxied === 'string' ? proxied : proxied.url);
    expect(proxiedUrl.host).toBe(FIREBASE_AUTH_HOST);
    expect(proxiedUrl.pathname).toBe('/__/firebase/init.json');
  });

  it('preserves the request method when proxying', async () => {
    const request = new FakeRequest(
      'https://estudo-organizado.matheussilva421.workers.dev/__/auth/handler',
      { method: 'POST' }
    );

    await worker.fetch(request, env);

    const [proxied] = global.fetch.mock.calls[0];
    expect(proxied.method).toBe('POST');
  });

  it('delegates every other request to the static assets binding', async () => {
    const request = new FakeRequest(
      'https://estudo-organizado.matheussilva421.workers.dev/index.html'
    );

    await worker.fetch(request, env);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(assetsFetch).toHaveBeenCalledWith(request);
  });

  it('does not proxy paths that merely contain __ elsewhere', async () => {
    const request = new FakeRequest(
      'https://estudo-organizado.matheussilva421.workers.dev/js/__tests__/foo.js'
    );

    await worker.fetch(request, env);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(assetsFetch).toHaveBeenCalledWith(request);
  });
});
