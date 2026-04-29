import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseState } from '../helpers/state-builders.js';

function createRequest(method, body = null) {
  return new Request('https://sync.example.test', {
    method,
    headers: {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : null
  });
}

function createRequestWithOrigin(method, origin, body = null) {
  return new Request('https://sync.example.test', {
    method,
    headers: {
      Origin: origin,
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : null
  });
}

function createEnv(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    AUTH_TOKEN: 'test-token',
    ALLOWED_ORIGINS: initial.ALLOWED_ORIGINS,
    ESTUDO_KV: {
      get: vi.fn(async key => values.get(key) ?? null),
      put: vi.fn(async (key, value) => {
        values.set(key, value);
      }),
      values
    }
  };
}

async function importFreshSyncModules() {
  vi.resetModules();
  const store = await import('../../src/js/store.js?v=8.26');
  const cloudSync = await import('../../src/js/cloud-sync.js?v=8.26');
  return { store, cloudSync };
}

describe('Cloudflare sync conflict contract', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-19T12:00:00.000Z'));
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '';
  });

  it('worker rejects stale writes when base remote metadata does not match', async () => {
    const worker = (await import('../../scripts/cloudflare-worker.js')).default;
    const env = createEnv({
      estudo_meta_v1: JSON.stringify({
        updatedAt: '2026-04-19T11:00:00.000Z',
        deviceId: 'device-a',
        version: 2
      })
    });

    const response = await worker.fetch(createRequest('POST', {
      version: 2,
      deviceId: 'device-b',
      baseRemoteUpdatedAt: '2026-04-19T10:00:00.000Z',
      payloadUpdatedAt: '2026-04-19T12:00:00.000Z',
      sentAt: '2026-04-19T12:00:00.000Z',
      payload: createBaseState()
    }), env, {});

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('stale'),
      remoteUpdatedAt: '2026-04-19T11:00:00.000Z'
    });
    expect(env.ESTUDO_KV.put).not.toHaveBeenCalled();
  });

  it('worker accepts writes when base remote metadata matches', async () => {
    const worker = (await import('../../scripts/cloudflare-worker.js')).default;
    const env = createEnv({
      estudo_meta_v1: JSON.stringify({
        updatedAt: '2026-04-19T11:00:00.000Z',
        deviceId: 'device-a',
        version: 2
      })
    });

    const response = await worker.fetch(createRequest('POST', {
      version: 2,
      deviceId: 'device-b',
      baseRemoteUpdatedAt: '2026-04-19T11:00:00.000Z',
      payloadUpdatedAt: '2026-04-19T12:00:00.000Z',
      sentAt: '2026-04-19T12:00:00.000Z',
      payload: createBaseState()
    }), env, {});

    expect(response.status).toBe(200);
    expect(env.ESTUDO_KV.put).toHaveBeenCalledWith('estudo_estado_v1', expect.any(String));
    expect(env.ESTUDO_KV.put).toHaveBeenCalledWith('estudo_meta_v1', expect.stringContaining('2026-04-19T12:00:00.000Z'));
  });

  it('worker accepts explicit forced overwrites even when base metadata is stale', async () => {
    const worker = (await import('../../scripts/cloudflare-worker.js')).default;
    const env = createEnv({
      estudo_meta_v1: JSON.stringify({
        updatedAt: '2026-04-19T11:00:00.000Z',
        deviceId: 'device-a',
        version: 2
      })
    });

    const response = await worker.fetch(createRequest('POST', {
      version: 2,
      deviceId: 'device-b',
      baseRemoteUpdatedAt: '2026-04-19T10:00:00.000Z',
      payloadUpdatedAt: '2026-04-19T12:00:00.000Z',
      sentAt: '2026-04-19T12:00:00.000Z',
      forceOverwrite: true,
      payload: createBaseState()
    }), env, {});

    expect(response.status).toBe(200);
    expect(env.ESTUDO_KV.put).toHaveBeenCalledWith('estudo_estado_v1', expect.any(String));
  });

  it('worker blocks browser requests from origins outside ALLOWED_ORIGINS', async () => {
    const worker = (await import('../../scripts/cloudflare-worker.js')).default;
    const env = createEnv({
      ALLOWED_ORIGINS: 'https://estudo.example.com, http://localhost:8080'
    });

    const response = await worker.fetch(createRequestWithOrigin('POST', 'https://evil.example.com', {
      version: 2,
      deviceId: 'device-b',
      baseRemoteUpdatedAt: null,
      payloadUpdatedAt: '2026-04-19T12:00:00.000Z',
      sentAt: '2026-04-19T12:00:00.000Z',
      payload: createBaseState()
    }), env, {});

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Origin not allowed')
    });
    expect(env.ESTUDO_KV.put).not.toHaveBeenCalled();
  });

  it('worker allows configured browser origins and echoes the request origin', async () => {
    const worker = (await import('../../scripts/cloudflare-worker.js')).default;
    const env = createEnv({
      ALLOWED_ORIGINS: 'https://estudo.example.com, http://localhost:8080'
    });

    const response = await worker.fetch(createRequestWithOrigin('OPTIONS', 'https://estudo.example.com'), env, {});

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://estudo.example.com');
  });

  it('client pushes base remote metadata and strips credentials from payload', async () => {
    const { store, cloudSync } = await importFreshSyncModules();
    store.setState(createBaseState({
      config: {
        cfSyncEnabled: true,
        cfUrl: 'https://sync.example.test',
        cfToken: 'test-token',
        cfRemoteUpdatedAt: '2026-04-19T11:00:00.000Z'
      }
    }));
    localStorage.setItem('estudo_device_id', 'device-b');

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      meta: {
        updatedAt: '2026-04-19T12:00:00.000Z',
        deviceId: 'device-b',
        version: 2
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(cloudSync.pushToCloudflare()).resolves.toBe(true);

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody).toMatchObject({
      version: 2,
      deviceId: 'device-b',
      baseRemoteUpdatedAt: '2026-04-19T11:00:00.000Z',
      payloadUpdatedAt: '2026-04-19T12:00:00.000Z',
      sentAt: '2026-04-19T12:00:00.000Z'
    });
    expect(requestBody.updatedAt).toBeUndefined();
    expect(requestBody.payload.config.cfUrl).toBeUndefined();
    expect(requestBody.payload.config.cfToken).toBeUndefined();
    expect(store.state.config.cfRemoteUpdatedAt).toBe('2026-04-19T12:00:00.000Z');
  });

  it('client can sync using isolated credentials when state config has no token', async () => {
    const { store, cloudSync } = await importFreshSyncModules();
    store.setState(createBaseState({
      config: {
        cfSyncEnabled: true,
        cfRemoteUpdatedAt: null
      }
    }));
    localStorage.setItem('estudo_cred_cloudflare', JSON.stringify({
      enabled: true,
      url: 'https://sync.example.test',
      token: 'isolated-token'
    }));

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      meta: {
        updatedAt: '2026-04-19T12:00:00.000Z',
        deviceId: 'device-b',
        version: 2
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(cloudSync.pushToCloudflare()).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith('https://sync.example.test', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer isolated-token'
      })
    }));
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.payload.config.cfToken).toBeUndefined();
    expect(requestBody.payload.config.cfTokenSaved).toBeUndefined();
  });

  it('preserves isolated token when only sync url changes', async () => {
    const { store, cloudSync } = await importFreshSyncModules();
    store.setState(createBaseState({
      config: {
        cfSyncEnabled: true,
        cfUrl: 'https://old-sync.example.test',
        cfRemoteUpdatedAt: null
      }
    }));
    localStorage.setItem('estudo_cred_cloudflare', JSON.stringify({
      enabled: true,
      url: 'https://old-sync.example.test',
      token: 'isolated-token'
    }));

    await cloudSync.setSyncCreds({
      url: 'https://new-sync.example.test',
      enabled: true
    });

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      meta: {
        updatedAt: '2026-04-19T12:00:00.000Z',
        deviceId: 'device-b',
        version: 2
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(cloudSync.pushToCloudflare()).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith('https://new-sync.example.test', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer isolated-token'
      })
    }));
    expect(store.state.config.cfToken).toBeUndefined();
  });
});
