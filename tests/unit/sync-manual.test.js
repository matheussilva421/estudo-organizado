import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('sync-now action', () => {
  let registerAction;
  let configView;
  let storeModule;
  let appModule;
  let componentsModule;
  let cloudSync;
  let firestoreSync;
  let syncCoordinator;
  let syncLockModule;
  let driveSync;
  let handler;

  beforeEach(async () => {
    vi.resetModules();
    registerAction = vi.fn();
    configView = {
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
    };
    storeModule = {
      scheduleSave: vi.fn(),
      state: {
        config: { cfUrl: '', cfToken: '', cfSyncEnabled: false },
      },
    };
    appModule = { showToast: vi.fn(), openModal: vi.fn(), showConfirm: vi.fn() };
    componentsModule = { renderCurrentView: vi.fn() };
    cloudSync = {
      forceCloudflareSync: vi.fn(() => Promise.resolve()),
      pullFromCloudflare: vi.fn(),
      pushToCloudflare: vi.fn(),
      mergeFromCloudflare: vi.fn(),
    };
    firestoreSync = {
      firestoreSignIn: vi.fn(),
      firestoreSignOut: vi.fn(),
      enableFirestoreSync: vi.fn(),
      disableFirestoreSync: vi.fn(),
      syncFirestoreNow: vi.fn(),
      pullFromFirestore: vi.fn(),
      mergeFromFirestore: vi.fn(),
      forcePushFirestore: vi.fn(),
      getFirestoreSyncStatus: vi.fn(() => ({
        configured: true,
        signedIn: true,
        enabled: true,
        mode: 'primary',
        conflict: null,
      })),
    };
    syncCoordinator = { flushPrimarySyncNow: vi.fn(() => Promise.resolve(true)) };
    syncLockModule = {
      primarySyncLock: { isLocked: false },
      cloudflareLock: { isLocked: false },
    };
    driveSync = {
      syncWithDrive: vi.fn(() => Promise.resolve()),
      pullFromDrive: vi.fn(),
      mergeFromDrive: vi.fn(),
      driveAction: vi.fn(),
    };

    vi.doMock('../../src/js/ui/actions/dispatcher.js', () => ({ registerAction }));
    vi.doMock('../../src/js/views/config-view.js?v=8.37', () => configView);
    vi.doMock('../../src/js/store.js?v=8.37', () => storeModule);
    vi.doMock('../../src/js/app.js?v=8.37', () => appModule);
    vi.doMock('../../src/js/components.js?v=8.37', () => componentsModule);
    vi.doMock('../../src/js/cloud-sync.js?v=8.37', () => cloudSync);
    vi.doMock('../../src/js/sync/firestore-sync-engine.js?v=8.37', () => firestoreSync);
    vi.doMock('../../src/js/sync/sync-coordinator.js?v=8.37', () => syncCoordinator);
    vi.doMock('../../src/js/sync/sync-lock.js?v=8.37', () => syncLockModule);
    vi.doMock('../../src/js/drive-sync.js?v=8.37', () => driveSync);

    await import('../../src/js/ui/actions/config.js');

    const calls = registerAction.mock.calls.filter((c) => c[0] === 'sync-now');
    handler = calls.length > 0 ? calls[0][1] : null;
  });

  // --- Registration ---
  it('registers the sync-now action', () => {
    const calls = registerAction.mock.calls.map((c) => c[0]);
    expect(calls).toContain('sync-now');
    expect(handler).not.toBeNull();
  });

  // --- Offline guard ---
  it('shows offline toast when navigator.onLine is false', async () => {
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });

    await handler();

    expect(appModule.showToast).toHaveBeenCalledWith(
      'Sem conexão. Sincronize quando estiver online.',
      'info'
    );

    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      writable: true,
      configurable: true,
    });
  });

  it('does not call sync when offline even if channels are available', async () => {
    storeModule.state.config = {
      cfUrl: 'https://worker.example.com',
      cfToken: 'secret-token',
      cfSyncEnabled: true,
    };

    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });

    await handler();

    expect(syncCoordinator.flushPrimarySyncNow).not.toHaveBeenCalled();
    expect(cloudSync.forceCloudflareSync).not.toHaveBeenCalled();
    expect(appModule.showToast).toHaveBeenCalledWith(
      'Sem conexão. Sincronize quando estiver online.',
      'info'
    );

    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      writable: true,
      configurable: true,
    });
  });

  // --- No channels guard ---
  it('shows no channel toast when no sync channel is available', async () => {
    firestoreSync.getFirestoreSyncStatus.mockReturnValue({
      configured: false,
      signedIn: false,
      enabled: false,
      mode: 'shadow',
      conflict: null,
    });
    storeModule.state.config = { cfUrl: '', cfToken: '', cfSyncEnabled: false };

    await handler();

    expect(appModule.showToast).toHaveBeenCalledWith(
      'Nenhum canal de sincronização configurado. Vá em Configurações → Central de Sincronização.',
      'info'
    );
  });

  // --- Double-click protection ---
  it('shows "already in progress" toast when primarySyncLock is locked', async () => {
    syncLockModule.primarySyncLock.isLocked = true;
    storeModule.state.config = {
      cfUrl: 'https://worker.example.com',
      cfToken: 'secret-token',
      cfSyncEnabled: true,
    };

    await handler();

    expect(appModule.showToast).toHaveBeenCalledWith(
      'Sincronização já em andamento.',
      'info'
    );
    expect(syncCoordinator.flushPrimarySyncNow).not.toHaveBeenCalled();
    expect(cloudSync.forceCloudflareSync).not.toHaveBeenCalled();
  });

  it('does not block sync when lock is free', async () => {
    syncLockModule.primarySyncLock.isLocked = false;

    await handler();

    expect(syncCoordinator.flushPrimarySyncNow).toHaveBeenCalled();
    expect(appModule.showToast).not.toHaveBeenCalledWith(
      'Sincronização já em andamento.',
      'info'
    );
  });

  // --- Firestore-only (no Cloudflare) ---
  it('calls flushPrimarySyncNow with ignoreGlobalPause when Firestore is available', async () => {
    await handler();

    expect(syncCoordinator.flushPrimarySyncNow).toHaveBeenCalledWith({
      manual: true,
      ignoreGlobalPause: true,
      reason: 'manual-button',
    });
  });

  it('does not call forceCloudflareSync when Cloudflare is not configured', async () => {
    storeModule.state.config = { cfUrl: '', cfToken: '', cfSyncEnabled: false };

    await handler();

    expect(cloudSync.forceCloudflareSync).not.toHaveBeenCalled();
  });

  it('shows success toast when only Firestore sync succeeds', async () => {
    syncCoordinator.flushPrimarySyncNow.mockResolvedValue(true);

    await handler();

    expect(appModule.showToast).toHaveBeenCalledWith(
      'Sincronização manual concluída.',
      'success'
    );
  });

  it('shows error toast when only Firestore sync fails', async () => {
    syncCoordinator.flushPrimarySyncNow.mockResolvedValue(false);

    await handler();

    expect(appModule.showToast).toHaveBeenCalledWith(
      'Sincronização manual falhou. Verifique o log.',
      'error'
    );
  });

  it('does not require Firestore enabled flag for manual sync-now', async () => {
    firestoreSync.getFirestoreSyncStatus.mockReturnValue({
      configured: true,
      signedIn: true,
      enabled: false,
      mode: 'shadow',
      conflict: null,
    });

    await handler();

    expect(syncCoordinator.flushPrimarySyncNow).toHaveBeenCalledWith({
      manual: true,
      ignoreGlobalPause: true,
      reason: 'manual-button',
    });
  });

  // --- Cloudflare-only (no Firestore) ---
  it('shows success toast when only Cloudflare is available', async () => {
    firestoreSync.getFirestoreSyncStatus.mockReturnValue({
      configured: false,
      signedIn: false,
      enabled: false,
      mode: 'shadow',
      conflict: null,
    });
    storeModule.state.config = {
      cfUrl: 'https://worker.example.com',
      cfToken: 'secret-token',
      cfSyncEnabled: true,
    };

    await handler();

    expect(cloudSync.forceCloudflareSync).toHaveBeenCalled();
    expect(syncCoordinator.flushPrimarySyncNow).not.toHaveBeenCalled();
    expect(appModule.showToast).toHaveBeenCalledWith(
      'Sincronização manual concluída.',
      'success'
    );
  });

  it('shows error toast when only Cloudflare fails', async () => {
    firestoreSync.getFirestoreSyncStatus.mockReturnValue({
      configured: false,
      signedIn: false,
      enabled: false,
      mode: 'shadow',
      conflict: null,
    });
    cloudSync.forceCloudflareSync.mockRejectedValue(new Error('CF failure'));
    storeModule.state.config = {
      cfUrl: 'https://worker.example.com',
      cfToken: 'secret-token',
      cfSyncEnabled: true,
    };

    await handler();

    expect(cloudSync.forceCloudflareSync).toHaveBeenCalled();
    expect(appModule.showToast).toHaveBeenCalledWith(
      'Sincronização manual falhou. Verifique o log.',
      'error'
    );
  });

  // --- Both channels available ---
  it('calls both Firestore and Cloudflare when both are available', async () => {
    storeModule.state.config = {
      cfUrl: 'https://worker.example.com',
      cfToken: 'secret-token',
      cfSyncEnabled: true,
    };

    await handler();

    expect(syncCoordinator.flushPrimarySyncNow).toHaveBeenCalledWith({
      manual: true,
      ignoreGlobalPause: true,
      reason: 'manual-button',
    });
    expect(cloudSync.forceCloudflareSync).toHaveBeenCalled();
  });

  // --- Parallel execution ---
  it('runs Firestore and Cloudflare in parallel (not sequentially)', async () => {
    let fsResolve;
    let cfResolve;
    const fsPromise = new Promise((r) => { fsResolve = r; });
    const cfPromise = new Promise((r) => { cfResolve = r; });

    syncCoordinator.flushPrimarySyncNow.mockReturnValue(fsPromise);
    cloudSync.forceCloudflareSync.mockReturnValue(cfPromise);

    storeModule.state.config = {
      cfUrl: 'https://worker.example.com',
      cfToken: 'secret-token',
      cfSyncEnabled: true,
    };

    // Start the handler but don't await it
    const handlerPromise = handler();

    // Both should have been called even though neither has resolved yet
    await vi.waitFor(() => {
      expect(syncCoordinator.flushPrimarySyncNow).toHaveBeenCalled();
      expect(cloudSync.forceCloudflareSync).toHaveBeenCalled();
    });

    // Clean up
    fsResolve(true);
    cfResolve();
    await handlerPromise;
  });

  // --- Partial failure ---
  it('shows partial success toast when Firestore succeeds but Cloudflare fails', async () => {
    syncCoordinator.flushPrimarySyncNow.mockResolvedValue(true);
    cloudSync.forceCloudflareSync.mockRejectedValue(new Error('Cloudflare error'));
    storeModule.state.config = {
      cfUrl: 'https://worker.example.com',
      cfToken: 'secret-token',
      cfSyncEnabled: true,
    };

    await handler();

    expect(appModule.showToast).toHaveBeenCalledWith(
      'Sincronização parcial: Cloudflare falhou. Verifique o log.',
      'info'
    );
  });

  it('shows partial success toast when Cloudflare succeeds but Firestore fails', async () => {
    syncCoordinator.flushPrimarySyncNow.mockResolvedValue(false);
    cloudSync.forceCloudflareSync.mockResolvedValue();
    storeModule.state.config = {
      cfUrl: 'https://worker.example.com',
      cfToken: 'secret-token',
      cfSyncEnabled: true,
    };

    await handler();

    expect(appModule.showToast).toHaveBeenCalledWith(
      'Sincronização parcial: Firestore falhou. Verifique o log.',
      'info'
    );
  });

  it('shows error toast when both Firestore and Cloudflare fail', async () => {
    syncCoordinator.flushPrimarySyncNow.mockResolvedValue(false);
    cloudSync.forceCloudflareSync.mockRejectedValue(new Error('Cloudflare error'));
    storeModule.state.config = {
      cfUrl: 'https://worker.example.com',
      cfToken: 'secret-token',
      cfSyncEnabled: true,
    };

    await handler();

    expect(appModule.showToast).toHaveBeenCalledWith(
      'Sincronização manual falhou em todos os canais. Verifique o log.',
      'error'
    );
  });

  it('shows success toast when both channels succeed', async () => {
    syncCoordinator.flushPrimarySyncNow.mockResolvedValue(true);
    cloudSync.forceCloudflareSync.mockResolvedValue();
    storeModule.state.config = {
      cfUrl: 'https://worker.example.com',
      cfToken: 'secret-token',
      cfSyncEnabled: true,
    };

    await handler();

    expect(appModule.showToast).toHaveBeenCalledWith(
      'Sincronização manual concluída.',
      'success'
    );
  });

  // --- Edge: Firestore fails alone (no Cloudflare) ---
  it('shows error toast when Firestore fails and Cloudflare is not enabled', async () => {
    syncCoordinator.flushPrimarySyncNow.mockResolvedValue(false);
    storeModule.state.config = { cfUrl: '', cfToken: '', cfSyncEnabled: false };

    await handler();

    expect(appModule.showToast).toHaveBeenCalledWith(
      'Sincronização manual falhou. Verifique o log.',
      'error'
    );
  });
});
