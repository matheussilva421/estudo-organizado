import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('cloud-sync.js', () => {
  let storeModule;
  let credentialsModule;
  let syncCenter;
  let cloudSync;

  beforeEach(async () => {
    vi.resetModules();
    storeModule = {
      state: {
        config: {
          cfUrl: 'https://worker.test',
          cfToken: 'token123',
          cfSyncEnabled: true,
        },
        eventos: [],
        editais: [],
        disciplinas: [],
        revisoes: [],
        planejamento: { ativo: false },
      },
      setState: vi.fn(),
      SyncQueue: { add: vi.fn() },
      saveStateToDB: vi.fn(() => Promise.resolve()),
      createExportableState: vi.fn(() => ({ config: {}, eventos: [] })),
    };
    credentialsModule = {
      setCredential: vi.fn(() => Promise.resolve()),
      getCredential: vi.fn(() => Promise.resolve(null)),
      deleteCredential: vi.fn(() => Promise.resolve()),
    };
    syncCenter = {
      mergeStudyStates: vi.fn((local, remote) => local),
    };

    vi.doMock('../../src/js/store.js?v=8.30', () => storeModule);
    vi.doMock('../../src/js/credentials.js?v=8.30', () => credentialsModule);
    vi.doMock('../../src/js/sync/sync-center.js?v=8.30', () => syncCenter);

    vi.stubGlobal('fetch', vi.fn());

    cloudSync = await import('../../src/js/cloud-sync.js?v=8.30');
  });

  describe('setSyncCreds()', () => {
    it('saves credentials to IndexedDB', async () => {
      await cloudSync.setSyncCreds({
        url: 'https://new-worker.test',
        token: 'new-token',
        enabled: true,
      });
      expect(credentialsModule.setCredential).toHaveBeenCalledWith(
        'cloudflare',
        expect.objectContaining({
          url: 'https://new-worker.test',
          token: 'new-token',
          enabled: true,
        })
      );
    });

    it('updates state.config for backward compat', async () => {
      await cloudSync.setSyncCreds({
        url: 'https://new-worker.test',
        token: 'new-token',
        enabled: true,
      });
      expect(storeModule.state.config.cfUrl).toBe('https://new-worker.test');
      expect(storeModule.state.config.cfSyncEnabled).toBe(true);
      expect(storeModule.state.config.cfTokenSaved).toBe(true);
    });
  });

  describe('forceCloudflareSync()', () => {
    it('returns early when not configured', async () => {
      credentialsModule.getCredential.mockResolvedValue(null);
      storeModule.state.config.cfSyncEnabled = false;
      storeModule.state.config.cfUrl = '';
      storeModule.state.config.cfToken = '';
      const result = await cloudSync.forceCloudflareSync();
      expect(result).toBeFalsy();
    });
  });

  describe('pullFromCloudflare()', () => {
    it('returns early when not configured', async () => {
      credentialsModule.getCredential.mockResolvedValue(null);
      storeModule.state.config.cfSyncEnabled = false;
      const result = await cloudSync.pullFromCloudflare();
      expect(result).toBe(false);
    });

    it('fetches remote data when configured', async () => {
      credentialsModule.getCredential.mockResolvedValue({
        url: 'https://worker.test',
        token: 'token123',
        enabled: true,
      });
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          payload: { config: {}, eventos: [] },
        }),
      });
      const result = await cloudSync.pullFromCloudflare();
      expect(fetch).toHaveBeenCalled();
    });
  });

  describe('pushToCloudflare()', () => {
    it('returns early when not configured', async () => {
      credentialsModule.getCredential.mockResolvedValue(null);
      storeModule.state.config.cfSyncEnabled = false;
      const result = await cloudSync.pushToCloudflare();
      expect(result).toBe(false);
    });

    it('sends local data when configured', async () => {
      credentialsModule.getCredential.mockResolvedValue({
        url: 'https://worker.test',
        token: 'token123',
        enabled: true,
      });
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      const result = await cloudSync.pushToCloudflare();
      expect(fetch).toHaveBeenCalled();
    });
  });

  describe('mergeFromCloudflare()', () => {
    it('returns early when not configured', async () => {
      credentialsModule.getCredential.mockResolvedValue(null);
      storeModule.state.config.cfSyncEnabled = false;
      const result = await cloudSync.mergeFromCloudflare();
      expect(result).toBe(false);
    });

    it('merges remote with local data', async () => {
      credentialsModule.getCredential.mockResolvedValue({
        url: 'https://worker.test',
        token: 'token123',
        enabled: true,
      });
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          payload: { config: {}, eventos: [{ id: 'remote' }] },
        }),
      });
      await cloudSync.mergeFromCloudflare();
      expect(syncCenter.mergeStudyStates).toHaveBeenCalled();
    });
  });
});
