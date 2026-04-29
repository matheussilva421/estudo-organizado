import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock de credentials.js
vi.mock('../../src/js/credentials.js?v=8.29', () => ({
  getCredential: vi.fn().mockResolvedValue(null),
  setCredential: vi.fn().mockResolvedValue(undefined),
  deleteCredential: vi.fn().mockResolvedValue(undefined)
}));

// Mock de sync-center.js
vi.mock('../../src/js/sync/sync-center.js?v=8.29', () => ({
  mergeStudyStates: vi.fn((local, remote) => ({ ...local, ...remote, merged: true }))
}));

// Mock de store.js
vi.mock('../../src/js/store.js?v=8.29', () => {
  const baseState = {
    schemaVersion: 7,
    editais: [],
    eventos: [],
    config: { visualizacao: 'mes' },
    habitos: { videoaula: [] }
  };
  let currentState = JSON.parse(JSON.stringify(baseState));

  return {
    get state() { return currentState; },
    setState: vi.fn((newState) => { Object.assign(currentState, newState); }),
    SyncQueue: {
      add: vi.fn(async (fn) => fn()),
      isProcessing: false,
      tasks: []
    },
    saveStateToDB: vi.fn().mockResolvedValue(undefined),
    createExportableState: vi.fn(() => JSON.parse(JSON.stringify(currentState)))
  };
});

let cloudSync;
let credentials;
let syncCenter;
let store;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();

  document.body.innerHTML = '<div id="cf-sync-status"></div>';

  cloudSync = await import('../../src/js/cloud-sync.js?v=8.29');
  credentials = await import('../../src/js/credentials.js?v=8.29');
  syncCenter = await import('../../src/js/sync/sync-center.js?v=8.29');
  store = await import('../../src/js/store.js?v=8.29');

  global.fetch = vi.fn();
});

describe('cloud-sync.js', () => {
  describe('setSyncCreds()', () => {
    it('salva credenciais no IndexedDB', async () => {
      await cloudSync.setSyncCreds({
        url: 'https://api.example.com',
        token: 'test-token',
        enabled: true
      });

      expect(credentials.setCredential).toHaveBeenCalledWith('cloudflare', {
        url: 'https://api.example.com',
        token: 'test-token',
        enabled: true
      });
    });

    it('atualiza state.config com as credenciais', async () => {
      await cloudSync.setSyncCreds({
        url: 'https://sync.test',
        token: 'secret',
        enabled: true
      });

      expect(store.state.config.cfUrl).toBe('https://sync.test');
      expect(store.state.config.cfSyncEnabled).toBe(true);
      expect(store.state.config.cfTokenSaved).toBe(true);
    });

    it('não expõe cfToken no state.config', async () => {
      await cloudSync.setSyncCreds({
        url: 'https://sync.test',
        token: 'secret',
        enabled: true
      });

      expect(store.state.config.cfToken).toBeUndefined();
    });

    it('mantém credenciais existentes quando não fornecidas', async () => {
      credentials.getCredential.mockResolvedValue({
        url: 'https://existing.test',
        token: 'existing-token',
        enabled: false
      });

      await cloudSync.setSyncCreds({ enabled: true });

      expect(credentials.setCredential).toHaveBeenCalledWith('cloudflare', {
        url: 'https://existing.test',
        token: 'existing-token',
        enabled: true
      });
    });
  });

  describe('pushToCloudflare()', () => {
    it('retorna false quando sem configuração de sync', async () => {
      const result = await cloudSync.pushToCloudflare();
      expect(result).toBe(false);
    });

    it('envia envelope com versão e deviceId', async () => {
      credentials.getCredential.mockResolvedValue({
        url: 'https://api.test',
        token: 'token',
        enabled: true
      });

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ meta: { updatedAt: '2026-04-29T10:00:00.000Z' } })
      });

      await cloudSync.pushToCloudflare();

      const callArgs = global.fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.version).toBe(2);
      expect(body.deviceId).toMatch(/^web-/);
      expect(body.payload).toBeDefined();
      expect(body.sentAt).toBeDefined();
    });

    it('registra conflito quando recebe 409', async () => {
      credentials.getCredential.mockResolvedValue({
        url: 'https://api.test',
        token: 'token',
        enabled: true
      });

      global.fetch.mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({
          error: 'Conflict',
          remoteUpdatedAt: '2026-04-29T09:00:00.000Z',
          remoteDeviceId: 'other-device'
        })
      });

      const result = await cloudSync.pushToCloudflare();

      expect(result).toBe(false);
      expect(store.state.config.cfConflict).toBeDefined();
      expect(store.state.config.cfConflict.remoteDeviceId).toBe('other-device');
    });

    it('forceOverwrite inclui flag no envelope', async () => {
      credentials.getCredential.mockResolvedValue({
        url: 'https://api.test',
        token: 'token',
        enabled: true
      });

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ meta: { updatedAt: '2026-04-29T10:00:00.000Z' } })
      });

      await cloudSync.pushToCloudflare(true);

      const callArgs = global.fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.forceOverwrite).toBe(true);
    });

    it('retorna false em caso de erro HTTP', async () => {
      credentials.getCredential.mockResolvedValue({
        url: 'https://api.test',
        token: 'token',
        enabled: true
      });

      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal Server Error' })
      });

      const result = await cloudSync.pushToCloudflare();
      expect(result).toBe(false);
    });
  });

  describe('pullFromCloudflare()', () => {
    it('retorna false quando sem configuração', async () => {
      const result = await cloudSync.pullFromCloudflare();
      expect(result).toBe(false);
    });

    it('retorna true quando remoto está vazio', async () => {
      credentials.getCredential.mockResolvedValue({
        url: 'https://api.test',
        token: 'token',
        enabled: true
      });

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(null)
      });

      const result = await cloudSync.pullFromCloudflare();
      expect(result).toBe(true);
    });

    it('retorna false em caso de erro HTTP', async () => {
      credentials.getCredential.mockResolvedValue({
        url: 'https://api.test',
        token: 'token',
        enabled: true
      });

      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal Server Error' })
      });

      const result = await cloudSync.pullFromCloudflare();
      expect(result).toBe(false);
    });
  });

  describe('mergeFromCloudflare()', () => {
    it('retorna false quando sem configuração', async () => {
      const result = await cloudSync.mergeFromCloudflare();
      expect(result).toBe(false);
    });
  });

  describe('updateSyncStatus()', () => {
    it('atualiza elemento de status com sucesso', async () => {
      credentials.getCredential.mockResolvedValue({
        url: 'https://api.test',
        token: 'token',
        enabled: true
      });

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ meta: { updatedAt: new Date().toISOString() } })
      });

      await cloudSync.pushToCloudflare();

      const el = document.getElementById('cf-sync-status');
      expect(el.textContent).toContain('Nuvem atualizada em');
    });

    it('define cor vermelha para erros', async () => {
      credentials.getCredential.mockResolvedValue({
        url: 'https://api.test',
        token: 'token',
        enabled: true
      });

      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server Error' })
      });

      await cloudSync.pushToCloudflare();

      const el = document.getElementById('cf-sync-status');
      expect(el.style.color).toBe('var(--red)');
    });
  });
});
