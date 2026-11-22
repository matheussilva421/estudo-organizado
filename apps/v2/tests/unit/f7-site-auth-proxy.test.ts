import { afterEach, describe, expect, it, vi } from 'vitest';
import siteWorker, { type SiteWorkerEnv } from '../../cloudflare/site-worker';

function environment(): SiteWorkerEnv {
  return {
    FIREBASE_PROJECT_ID: 'eo-v2-f7-test-20261117',
    ASSETS: { fetch: vi.fn(async () => new Response('asset', { status: 200 })) },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('site Worker Firebase auth proxy', () => {
  it('proxies the reserved auth handler to the isolated Firebase host', async () => {
    const env = environment();
    const proxy = vi.fn(async () => new Response('handler', { status: 200 }));
    vi.stubGlobal('fetch', proxy);

    const response = await siteWorker.fetch(
      new Request('https://estudo-organizado-v2-f7-test.example/__/auth/handler?foo=1', {
        headers: { 'x-test-header': 'preserved' },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
    expect(proxy).toHaveBeenCalledTimes(1);
    const [forwarded, init] = proxy.mock.calls[0] as unknown as [string, RequestInit];
    expect(forwarded).toBe(
      'https://eo-v2-f7-test-20261117.firebaseapp.com/__/auth/handler?foo=1',
    );
    expect(new Headers(init.headers).get('x-test-header')).toBe('preserved');
    expect(init.method).toBe('GET');
    expect(init.redirect).toBe('manual');
  });

  it('proxies reserved Firebase config paths and preserves POST bodies', async () => {
    const env = environment();
    const proxy = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', proxy);

    await siteWorker.fetch(
      new Request('https://staging.example/__/firebase/init.json', {
        method: 'POST',
        body: 'synthetic-body',
      }),
      env,
    );

    const [forwarded, init] = proxy.mock.calls[0] as unknown as [string, RequestInit];
    expect(forwarded).toBe(
      'https://eo-v2-f7-test-20261117.firebaseapp.com/__/firebase/init.json',
    );
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('manual');
    expect(await new Response(init.body).text()).toBe('synthetic-body');
  });

  it('serves non-reserved requests from the static assets binding', async () => {
    const env = environment();
    const proxy = vi.fn(async () => new Response('should-not-run', { status: 500 }));
    vi.stubGlobal('fetch', proxy);

    const request = new Request('https://staging.example/assets/app.js');
    const response = await siteWorker.fetch(request, env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('asset');
    expect(proxy).not.toHaveBeenCalled();
    expect(env.ASSETS.fetch).toHaveBeenCalledWith(request);
  });

  it('fails closed for reserved paths when the isolated project is missing', async () => {
    const env = environment();
    delete env.FIREBASE_PROJECT_ID;
    const proxy = vi.fn(async () => new Response('should-not-run', { status: 500 }));
    vi.stubGlobal('fetch', proxy);

    const response = await siteWorker.fetch(
      new Request('https://staging.example/__/auth/handler'),
      env,
    );

    expect(response.status).toBe(500);
    expect(proxy).not.toHaveBeenCalled();
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it('fails closed for the productive V1 project', async () => {
    const env = environment();
    env.FIREBASE_PROJECT_ID = 'app-de-estudos-14564';
    const proxy = vi.fn(async () => new Response('should-not-run', { status: 500 }));
    vi.stubGlobal('fetch', proxy);

    const response = await siteWorker.fetch(
      new Request('https://staging.example/__/auth/handler'),
      env,
    );

    expect(response.status).toBe(500);
    expect(proxy).not.toHaveBeenCalled();
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it('fails closed for any project outside the positive allowlist', async () => {
    const env = environment();
    env.FIREBASE_PROJECT_ID = 'another-project';
    const proxy = vi.fn(async () => new Response('should-not-run', { status: 500 }));
    vi.stubGlobal('fetch', proxy);

    const response = await siteWorker.fetch(
      new Request('https://staging.example/__/auth/handler'),
      env,
    );

    expect(response.status).toBe(500);
    expect(proxy).not.toHaveBeenCalled();
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });
});
