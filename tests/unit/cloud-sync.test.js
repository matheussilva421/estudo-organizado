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

    vi.doMock('../../src/js/store.js?v=8.36', () => storeModule);
    vi.doMock('../../src/js/credentials.js?v=8.36', () => credentialsModule);
    vi.doMock('../../src/js/sync/sync-center.js?v=8.36', () => syncCenter);

    vi.stubGlobal('fetch', vi.fn());

    cloudSync = await import('../../src/js/cloud-sync.js?v=8.36');
  });

  describe('setSyncCreds()', () => {
    it('writes credentials directly to state.config', async () => {
      await cloudSync.setSyncCreds({
        url: 'https://new-worker.test',
        token: 'new-token',
        enabled: true,
      });
      expect(storeModule.state.config.cfUrl).toBe('https://new-worker.test');
      expect(storeModule.state.config.cfToken).toBe('new-token');
      expect(storeModule.state.config.cfSyncEnabled).toBe(true);
    });

    it('preserves existing values when partial update', async () => {
      storeModule.state.config.cfUrl = 'https://existing.test';
      storeModule.state.config.cfToken = 'existing-token';
      storeModule.state.config.cfSyncEnabled = true;
      await cloudSync.setSyncCreds({ url: 'https://updated.test' });
      expect(storeModule.state.config.cfUrl).toBe('https://updated.test');
      expect(storeModule.state.config.cfToken).toBe('existing-token');
      expect(storeModule.state.config.cfSyncEnabled).toBe(true);
    });
  });

  describe('forceCloudflareSync()', () => {
    it('returns early when not configured', async () => {
      storeModule.state.config.cfSyncEnabled = false;
      storeModule.state.config.cfUrl = '';
      storeModule.state.config.cfToken = '';
      const result = await cloudSync.forceCloudflareSync();
      expect(result).toBeFalsy();
    });
  });

  describe('pullFromCloudflare()', () => {
    it('returns early when not configured', async () => {
      storeModule.state.config.cfSyncEnabled = false;
      const result = await cloudSync.pullFromCloudflare();
      expect(result).toBe(false);
    });

    it('fetches remote data when configured', async () => {
      storeModule.state.config.cfSyncEnabled = true;
      storeModule.state.config.cfUrl = 'https://worker.test';
      storeModule.state.config.cfToken = 'token123';
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
      storeModule.state.config.cfSyncEnabled = false;
      const result = await cloudSync.pushToCloudflare();
      expect(result).toBe(false);
    });

    it('sends local data when configured', async () => {
      storeModule.state.config.cfSyncEnabled = true;
      storeModule.state.config.cfUrl = 'https://worker.test';
      storeModule.state.config.cfToken = 'token123';
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
      storeModule.state.config.cfSyncEnabled = false;
      const result = await cloudSync.mergeFromCloudflare();
      expect(result).toBe(false);
    });

    it('merges remote with local data', async () => {
      storeModule.state.config.cfSyncEnabled = true;
      storeModule.state.config.cfUrl = 'https://worker.test';
      storeModule.state.config.cfToken = 'token123';
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
