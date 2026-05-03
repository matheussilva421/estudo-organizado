import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseState, createEvento } from '../helpers/state-builders.js';

async function importCloudSync({ credential = null, fetchImpl } = {}) {
  vi.resetModules();
  vi.doMock('../../src/js/credentials.js?v=8.33', () => ({
    setCredential: vi.fn(() => Promise.resolve()),
    getCredential: vi.fn(() => Promise.resolve(credential)),
    deleteCredential: vi.fn(() => Promise.resolve())
  }));
  vi.doMock('../../src/js/sync/sync-center.js?v=8.33', () => ({
    mergeStudyStates: vi.fn((local, remote) => ({
      ...local,
      eventos: [...(local.eventos || []), ...(remote.eventos || [])]
    }))
  }));
  vi.stubGlobal('fetch', fetchImpl || vi.fn());

  const store = await import('../../src/js/store.js?v=8.33');
  const cloudSync = await import('../../src/js/cloud-sync.js?v=8.33');
  return { store, cloudSync };
}

describe('sync simulation contracts', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '<p id="cf-sync-status"></p>';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T21:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('pushes a sanitized Cloudflare envelope using isolated credentials', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      meta: {
        updatedAt: '2026-04-29T21:31:00.000Z',
        deviceId: 'remote-device',
        version: 2
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const { store, cloudSync } = await importCloudSync({
      credential: {
        enabled: true,
        url: 'https://sync.example.test',
        token: 'isolated-token'
      },
      fetchImpl: fetchMock
    });

    store.setState(createBaseState({
      eventos: [createEvento({ id: 'ev_sync', titulo: 'Evento sync' })],
      config: {
        cfSyncEnabled: true,
        cfUrl: 'https://legacy-url.example.test',
        cfToken: 'legacy-token',
        cfRemoteUpdatedAt: '2026-04-29T20:00:00.000Z'
      }
    }));

    await expect(cloudSync.pushToCloudflare(true)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith('https://sync.example.test', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer isolated-token' })
    }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      version: 2,
      baseRemoteUpdatedAt: '2026-04-29T20:00:00.000Z',
      payload: {
        eventos: [expect.objectContaining({ id: 'ev_sync' })]
      }
    });
    expect(body.payload.config.cfUrl).toBeUndefined();
    expect(body.payload.config.cfToken).toBeUndefined();
    expect(body.payload.config.cfSyncEnabled).toBe(false);
  });

  it('surfaces Cloudflare pull network failures in the config status element', async () => {
    vi.useRealTimers();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      error: 'service unavailable'
    }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
    const { store, cloudSync } = await importCloudSync({
      credential: {
        enabled: true,
        url: 'https://sync.example.test',
        token: 'isolated-token'
      },
      fetchImpl: fetchMock
    });
    store.setState(createBaseState({ config: { cfSyncEnabled: true } }));

    await expect(cloudSync.pullFromCloudflare()).resolves.toBe(false);

    expect(document.getElementById('cf-sync-status').textContent)
      .toContain('Erro 503: service unavailable');
  }, 90000);

  it('records remote conflict metadata when Cloudflare rejects stale push', async () => {
    vi.useRealTimers();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      error: 'stale write',
      remoteUpdatedAt: '2026-04-29T22:00:00.000Z',
      remoteDeviceId: 'remote-device'
    }), { status: 409, headers: { 'Content-Type': 'application/json' } }));
    const { store, cloudSync } = await importCloudSync({
      credential: {
        enabled: true,
        url: 'https://sync.example.test',
        token: 'isolated-token'
      },
      fetchImpl: fetchMock
    });
    store.setState(createBaseState({
      config: {
        cfSyncEnabled: true,
        cfRemoteUpdatedAt: '2026-04-29T20:00:00.000Z'
      }
    }));

    await expect(cloudSync.pushToCloudflare(true)).resolves.toBe(false);

    expect(store.state.config.cfConflict).toMatchObject({
      remoteUpdatedAt: '2026-04-29T22:00:00.000Z',
      remoteDeviceId: 'remote-device',
    });
    expect(store.state.config.cfConflict.detectedAt).toBeDefined();
    expect(document.getElementById('cf-sync-status').textContent).toContain('Erro 409: stale write');
  }, 90000);
});
