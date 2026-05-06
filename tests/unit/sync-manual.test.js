import { describe, it, expect, vi, beforeEach } from 'vitest';

// Tests for the manual sync orchestrator (`src/js/sync/manual-sync.js`) and the
// thin action handler that wires it to the UI button. Auto-sync was removed —
// these tests cover the single user-initiated sync flow.

describe('manual-sync orchestrator', () => {
  let storeModule;
  let firestoreSync;
  let cloudSync;
  let driveSync;

  async function loadOrchestrator() {
    vi.resetModules();
    storeModule = {
      state: { config: {}, driveFileId: null },
      saveStateToDB: vi.fn(() => Promise.resolve()),
    };
    firestoreSync = {
      getFirestoreSyncStatus: vi.fn(() => ({
        configured: false,
        signedIn: false,
        enabled: false,
        mode: 'shadow',
        conflict: null,
      })),
      syncFirestoreNow: vi.fn(() => Promise.resolve(true)),
    };
    cloudSync = {
      forceCloudflareSync: vi.fn(() => Promise.resolve()),
    };
    driveSync = {
      syncWithDrive: vi.fn(() => Promise.resolve()),
    };
    vi.doMock('../../src/js/store.js?v=8.37', () => storeModule);
    vi.doMock('../../src/js/sync/firestore-sync-engine.js?v=8.37', () => firestoreSync);
    vi.doMock('../../src/js/cloud-sync.js?v=8.37', () => cloudSync);
    vi.doMock('../../src/js/drive-sync.js?v=8.37', () => driveSync);
    return import('../../src/js/sync/manual-sync.js');
  }

  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
    if (typeof globalThis.gapi !== 'undefined') delete globalThis.gapi;
  });

  it('returns "no-channels" when nothing is configured', async () => {
    const mod = await loadOrchestrator();
    const result = await mod.syncAllChannels({ trigger: 'test' });
    expect(result.summary.overall).toBe('no-channels');
    expect(firestoreSync.syncFirestoreNow).not.toHaveBeenCalled();
    expect(cloudSync.forceCloudflareSync).not.toHaveBeenCalled();
    expect(driveSync.syncWithDrive).not.toHaveBeenCalled();
  });

  it('returns "offline" when navigator is offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });
    const mod = await loadOrchestrator();
    storeModule.state.config.cfUrl = 'https://w.dev';
    storeModule.state.config.cfToken = 't';
    storeModule.state.config.cfSyncEnabled = true;
    const result = await mod.syncAllChannels();
    expect(result.summary.overall).toBe('offline');
    expect(cloudSync.forceCloudflareSync).not.toHaveBeenCalled();
  });

  it('runs Firestore when eligible and reports ok', async () => {
    const mod = await loadOrchestrator();
    firestoreSync.getFirestoreSyncStatus.mockReturnValue({
      configured: true,
      signedIn: true,
      enabled: true,
      mode: 'primary',
      conflict: null,
      lastError: null,
    });
    const result = await mod.syncAllChannels();
    expect(firestoreSync.syncFirestoreNow).toHaveBeenCalled();
    expect(result.firestore.status).toBe('ok');
    expect(result.summary.overall).toBe('synced');
  });

  it('reports firestore conflict', async () => {
    const mod = await loadOrchestrator();
    let firstCall = true;
    firestoreSync.getFirestoreSyncStatus.mockImplementation(() => ({
      configured: true,
      signedIn: true,
      enabled: true,
      mode: 'primary',
      // First call (eligibility) returns no conflict; later calls return conflict
      conflict: firstCall ? null : { detectedAt: '2026-05-06' },
      lastError: null,
    }));
    firestoreSync.syncFirestoreNow.mockImplementation(async () => {
      firstCall = false;
      return false;
    });
    const result = await mod.syncAllChannels();
    expect(result.firestore.status).toBe('conflict');
    expect(result.summary.overall).toBe('conflict');
  });

  it('runs Cloudflare with overwriteRemote=false (safe push)', async () => {
    const mod = await loadOrchestrator();
    storeModule.state.config = {
      cfUrl: 'https://w.dev',
      cfToken: 't',
      cfSyncEnabled: true,
    };
    await mod.syncAllChannels();
    expect(cloudSync.forceCloudflareSync).toHaveBeenCalledWith({
      overwriteRemote: false,
    });
  });

  it('runs Cloudflare and Firestore in parallel', async () => {
    const mod = await loadOrchestrator();
    firestoreSync.getFirestoreSyncStatus.mockReturnValue({
      configured: true,
      signedIn: true,
      enabled: true,
      mode: 'primary',
      conflict: null,
    });
    storeModule.state.config = {
      cfUrl: 'https://w.dev',
      cfToken: 't',
      cfSyncEnabled: true,
    };

    let fsResolve;
    let cfResolve;
    firestoreSync.syncFirestoreNow.mockReturnValue(
      new Promise((r) => {
        fsResolve = r;
      })
    );
    cloudSync.forceCloudflareSync.mockReturnValue(
      new Promise((r) => {
        cfResolve = r;
      })
    );

    const promise = mod.syncAllChannels();
    // Both should be invoked before either resolves
    await vi.waitFor(() => {
      expect(firestoreSync.syncFirestoreNow).toHaveBeenCalled();
      expect(cloudSync.forceCloudflareSync).toHaveBeenCalled();
    });

    fsResolve(true);
    cfResolve();
    await promise;
  });

  it('skips Drive silently when no GAPI token is in memory', async () => {
    const mod = await loadOrchestrator();
    storeModule.state.driveFileId = 'fileId123';
    // gapi is undefined
    const result = await mod.syncAllChannels();
    expect(driveSync.syncWithDrive).not.toHaveBeenCalled();
    expect(result.drive.status).toBe('skipped');
  });

  it('runs Drive with autoMerge when token is present and fileId set', async () => {
    const mod = await loadOrchestrator();
    storeModule.state.driveFileId = 'file-x';
    globalThis.gapi = {
      client: { getToken: () => ({ access_token: 'tok' }) },
    };
    const result = await mod.syncAllChannels();
    expect(driveSync.syncWithDrive).toHaveBeenCalledWith(0, { autoMerge: true });
    expect(result.drive.status).toBe('ok');
  });

  it('persists lastManualSyncAt after a successful run', async () => {
    const mod = await loadOrchestrator();
    firestoreSync.getFirestoreSyncStatus.mockReturnValue({
      configured: true,
      signedIn: true,
      enabled: true,
      mode: 'primary',
      conflict: null,
    });
    await mod.syncAllChannels();
    expect(storeModule.state.config.lastManualSyncAt).toBeTruthy();
    expect(storeModule.saveStateToDB).toHaveBeenCalled();
  });

  it('emits app:manualSyncStatus events with status transitions', async () => {
    const mod = await loadOrchestrator();
    firestoreSync.getFirestoreSyncStatus.mockReturnValue({
      configured: true,
      signedIn: true,
      enabled: true,
      mode: 'primary',
      conflict: null,
    });
    const events = [];
    const handler = (e) => events.push(e.detail.status);
    document.addEventListener('app:manualSyncStatus', handler);
    try {
      await mod.syncAllChannels();
    } finally {
      document.removeEventListener('app:manualSyncStatus', handler);
    }
    expect(events).toContain('syncing');
    expect(events).toContain('synced');
  });

  it('is re-entrant: concurrent calls share the same in-flight promise', async () => {
    const mod = await loadOrchestrator();
    firestoreSync.getFirestoreSyncStatus.mockReturnValue({
      configured: true,
      signedIn: true,
      enabled: true,
      mode: 'primary',
      conflict: null,
    });
    let resolve;
    firestoreSync.syncFirestoreNow.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );

    const p1 = mod.syncAllChannels();
    const p2 = mod.syncAllChannels();
    expect(firestoreSync.syncFirestoreNow).toHaveBeenCalledTimes(1);
    resolve(true);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(r2);
  });
});

describe('runManualSync action handler', () => {
  let registerAction;
  let appModule;
  let manualSync;
  let componentsModule;
  let handler;

  beforeEach(async () => {
    vi.resetModules();
    registerAction = vi.fn();
    appModule = { showToast: vi.fn(), openModal: vi.fn(), showConfirm: vi.fn() };
    componentsModule = { renderCurrentView: vi.fn() };
    manualSync = {
      syncAllChannels: vi.fn(() =>
        Promise.resolve({
          firestore: { status: 'ok' },
          cloudflare: { status: 'ok' },
          drive: { status: 'skipped' },
          summary: { ok: 2, conflict: 0, error: 0, skipped: 1, overall: 'synced' },
        })
      ),
      isManualSyncRunning: vi.fn(() => false),
    };

    vi.doMock('../../src/js/ui/actions/dispatcher.js', () => ({ registerAction }));
    vi.doMock('../../src/js/views/config-view.js?v=8.37', () => ({
      updateConfig: vi.fn(),
      toggleConfig: vi.fn(),
      updateFrequencia: vi.fn(),
      toggleCfSync: vi.fn(),
      archiveOldEvents: vi.fn(),
      clearAllData: vi.fn(),
      setTheme: vi.fn(),
      exportData: vi.fn(),
      importData: vi.fn(),
      restoreBackupFromSelectedSource: vi.fn(),
      openDriveModal: vi.fn(),
      driveDisconnect: vi.fn(),
    }));
    vi.doMock('../../src/js/store.js?v=8.37', () => ({
      scheduleSave: vi.fn(),
      state: { config: {} },
    }));
    vi.doMock('../../src/js/app.js?v=8.37', () => appModule);
    vi.doMock('../../src/js/components.js?v=8.37', () => componentsModule);
    vi.doMock('../../src/js/cloud-sync.js?v=8.37', () => ({
      forceCloudflareSync: vi.fn(),
      pullFromCloudflare: vi.fn(),
      pushToCloudflare: vi.fn(),
      mergeFromCloudflare: vi.fn(),
    }));
    vi.doMock('../../src/js/sync/firestore-sync-engine.js?v=8.37', () => ({
      firestoreSignIn: vi.fn(),
      firestoreSignOut: vi.fn(),
      enableFirestoreSync: vi.fn(),
      disableFirestoreSync: vi.fn(),
      syncFirestoreNow: vi.fn(),
      pullFromFirestore: vi.fn(),
      mergeFromFirestore: vi.fn(),
      forcePushFirestore: vi.fn(),
      getFirestoreSyncStatus: vi.fn(() => ({
        configured: false,
        signedIn: false,
        enabled: false,
        mode: 'shadow',
        conflict: null,
      })),
      downloadSyncDiagnosticLog: vi.fn(),
      resolveEntityConflictKeepLocal: vi.fn(),
      resolveEntityConflictKeepRemote: vi.fn(),
    }));
    vi.doMock('../../src/js/sync/sync-coordinator.js?v=8.37', () => ({
      flushPrimarySyncNow: vi.fn(),
    }));
    vi.doMock('../../src/js/sync/manual-sync.js?v=8.37', () => manualSync);
    vi.doMock('../../src/js/drive-sync.js?v=8.37', () => ({
      syncWithDrive: vi.fn(),
      pullFromDrive: vi.fn(),
      mergeFromDrive: vi.fn(),
      driveAction: vi.fn(),
    }));

    await import('../../src/js/ui/actions/config.js');

    const calls = registerAction.mock.calls.filter((c) => c[0] === 'sync-now');
    handler = calls.length > 0 ? calls[0][1] : null;
  });

  it('registers both sync-now and manual-sync-all actions', () => {
    const names = registerAction.mock.calls.map((c) => c[0]);
    expect(names).toContain('sync-now');
    expect(names).toContain('manual-sync-all');
  });

  it('shows offline toast when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    await handler();
    expect(appModule.showToast).toHaveBeenCalledWith(
      expect.stringContaining('Sem conexão'),
      'info'
    );
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('shows "in progress" toast when a sync is already running', async () => {
    manualSync.isManualSyncRunning.mockReturnValue(true);
    await handler();
    expect(appModule.showToast).toHaveBeenCalledWith(
      expect.stringContaining('em andamento'),
      'info'
    );
    expect(manualSync.syncAllChannels).not.toHaveBeenCalled();
  });

  it('shows success toast when summary.overall is synced', async () => {
    await handler();
    expect(appModule.showToast).toHaveBeenCalledWith('Sincronização concluída.', 'success');
  });

  it('shows partial toast when some channels fail', async () => {
    manualSync.syncAllChannels.mockResolvedValue({
      firestore: { status: 'ok' },
      cloudflare: { status: 'error', error: 'boom' },
      drive: { status: 'skipped' },
      summary: { ok: 1, conflict: 0, error: 1, skipped: 1, overall: 'partial' },
    });
    await handler();
    expect(appModule.showToast).toHaveBeenCalledWith(
      expect.stringContaining('parcial'),
      'info'
    );
  });

  it('shows conflict toast when overall is conflict', async () => {
    manualSync.syncAllChannels.mockResolvedValue({
      firestore: { status: 'conflict', conflict: {} },
      cloudflare: { status: 'skipped' },
      drive: { status: 'skipped' },
      summary: { ok: 0, conflict: 1, error: 0, skipped: 2, overall: 'conflict' },
    });
    await handler();
    expect(appModule.showToast).toHaveBeenCalledWith(
      expect.stringContaining('Conflito'),
      'error'
    );
  });

  it('shows no-channels toast when nothing is configured', async () => {
    manualSync.syncAllChannels.mockResolvedValue({
      firestore: { status: 'skipped' },
      cloudflare: { status: 'skipped' },
      drive: { status: 'skipped' },
      summary: { ok: 0, conflict: 0, error: 0, skipped: 3, overall: 'no-channels' },
    });
    await handler();
    expect(appModule.showToast).toHaveBeenCalledWith(
      expect.stringContaining('Nenhum canal'),
      'info'
    );
  });
});
