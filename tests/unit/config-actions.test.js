import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ui/actions/config.js', () => {
  let registerAction;
  let configView;
  let storeModule;
  let appModule;
  let componentsModule;
  let cloudSync;
  let firestoreSync;
  let syncCoordinator;
  let driveSync;

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
    storeModule = { scheduleSave: vi.fn(), state: { config: {} } };
    appModule = { showToast: vi.fn(), openModal: vi.fn(), showConfirm: vi.fn() };
    componentsModule = { renderCurrentView: vi.fn() };
    cloudSync = {
      forceCloudflareSync: vi.fn(),
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
      getFirestoreSyncStatus: vi.fn(() => ({ configured: true, signedIn: true, enabled: true })),
    };
    syncCoordinator = { flushPrimarySyncNow: vi.fn(() => Promise.resolve(true)) };
    driveSync = {
      syncWithDrive: vi.fn(() => Promise.resolve()),
      pullFromDrive: vi.fn(),
      mergeFromDrive: vi.fn(),
      driveAction: vi.fn(),
    };

    vi.doMock('../../src/js/ui/actions/dispatcher.js', () => ({ registerAction }));
    vi.doMock('../../src/js/views/config-view.js?v=8.32', () => configView);
    vi.doMock('../../src/js/store.js?v=8.32', () => storeModule);
    vi.doMock('../../src/js/app.js?v=8.32', () => appModule);
    vi.doMock('../../src/js/components.js?v=8.32', () => componentsModule);
    vi.doMock('../../src/js/cloud-sync.js?v=8.32', () => cloudSync);
    vi.doMock('../../src/js/sync/firestore-sync-engine.js?v=8.32', () => firestoreSync);
    vi.doMock('../../src/js/sync/sync-coordinator.js?v=8.32', () => syncCoordinator);
    vi.doMock('../../src/js/drive-sync.js?v=8.32', () => driveSync);

    await import('../../src/js/ui/actions/config.js');
  });

  it('registers config actions', () => {
    const calls = registerAction.mock.calls.map((c) => c[0]);
    expect(calls).toContain('update-config');
    expect(calls).toContain('toggle-config');
    expect(calls).toContain('update-frequencia');
    expect(calls).toContain('toggle-password-visibility');
    expect(calls).toContain('toggle-cf-sync');
    expect(calls).toContain('archive-old-events');
    expect(calls).toContain('clear-all-data');
    expect(calls).toContain('set-theme');
    expect(calls).toContain('export-data');
    expect(calls).toContain('restore-backup');
    expect(calls).toContain('open-drive-modal');
    expect(calls).toContain('drive-disconnect');
    expect(calls).toContain('disconnect-drive');
    expect(calls).toContain('request-notification-permission');
    expect(calls).toContain('test-notification');
    expect(calls).toContain('force-cloudflare-sync');
    expect(calls).toContain('cloud-conflict-export-local');
    expect(calls).toContain('cloud-conflict-pull-remote');
    expect(calls).toContain('cloud-conflict-force-push');
    expect(calls).toContain('firestore-sign-in');
    expect(calls).toContain('firestore-sign-out');
    expect(calls).toContain('firestore-enable-primary');
    expect(calls).toContain('firestore-enable-shadow');
    expect(calls).toContain('firestore-disable-sync');
    expect(calls).toContain('firestore-sync-now');
    expect(calls).toContain('firestore-pull-remote');
    expect(calls).toContain('firestore-merge-remote');
    expect(calls).toContain('firestore-force-push');
    expect(calls).toContain('firestore-export-local');
    expect(calls).toContain('cloud-merge-remote');
    expect(calls).toContain('drive-sync-now');
    expect(calls).toContain('pull-from-drive');
    expect(calls).toContain('merge-from-drive');
    expect(calls).toContain('drive-action');
    expect(calls).toContain('sync-center-smart-sync');
    expect(calls).toContain('sync-center-export-local');
    expect(calls).toContain('sync-center-import-local');
    expect(calls).toContain('force-sw-cache-clear');
  });

  it('update-config handler parses number values', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'update-config')[1];
    handler({ dataset: { configKey: 'revisoesIntervalo', valueType: 'number' }, value: '7' });
    expect(configView.updateConfig).toHaveBeenCalledWith('revisoesIntervalo', 7);
  });

  it('update-config handler trims URL values', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'update-config')[1];
    handler({
      dataset: { configKey: 'apiUrl', valueTransform: 'trim-url' },
      value: 'https://api.test/',
    });
    expect(configView.updateConfig).toHaveBeenCalledWith('apiUrl', 'https://api.test');
  });

  it('update-config handler trims plain text values', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'update-config')[1];
    handler({ dataset: { configKey: 'nome', valueTransform: 'trim' }, value: '  test  ' });
    expect(configView.updateConfig).toHaveBeenCalledWith('nome', 'test');
  });

  it('update-config handler skips when no key', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'update-config')[1];
    handler({ dataset: {}, value: 'test' });
    expect(configView.updateConfig).not.toHaveBeenCalled();
  });

  it('toggle-config handler updates aria-pressed', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'toggle-config')[1];
    const el = {
      dataset: { configKey: 'darkMode' },
      classList: { contains: () => true },
      setAttribute: vi.fn(),
    };
    handler(el);
    expect(configView.toggleConfig).toHaveBeenCalledWith('darkMode', el);
    expect(el.setAttribute).toHaveBeenCalledWith('aria-pressed', 'true');
  });

  it('update-frequencia handler passes value', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'update-frequencia')[1];
    handler({ value: '15' });
    expect(configView.updateFrequencia).toHaveBeenCalledWith('15');
  });

  it('toggle-password-visibility toggles input type', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'toggle-password-visibility')[1];
    const input = { type: 'password' };
    vi.spyOn(document, 'getElementById').mockReturnValue(input);
    handler({ dataset: { targetId: 'pwd-input' } });
    expect(input.type).toBe('text');
  });

  it('toggle-cf-sync handler passes checked state', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'toggle-cf-sync')[1];
    handler({ checked: true });
    expect(configView.toggleCfSync).toHaveBeenCalledWith(true);
  });

  it('archive-old-events handler parses days', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'archive-old-events')[1];
    handler({ dataset: { days: '30' } });
    expect(configView.archiveOldEvents).toHaveBeenCalledWith(30);
  });

  it('archive-old-events handler uses default 90 days', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'archive-old-events')[1];
    handler({ dataset: {} });
    expect(configView.archiveOldEvents).toHaveBeenCalledWith(90);
  });

  it('set-theme handler passes value', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'set-theme')[1];
    handler({ value: 'dark' });
    expect(configView.setTheme).toHaveBeenCalledWith('dark');
  });

  it('cloud-conflict-pull-remote shows confirmation', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'cloud-conflict-pull-remote')[1];
    handler({});
    expect(appModule.showConfirm).toHaveBeenCalled();
  });

  it('cloud-conflict-force-push shows confirmation', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'cloud-conflict-force-push')[1];
    handler({});
    expect(appModule.showConfirm).toHaveBeenCalled();
  });

  it('firestore-enable-primary calls enableFirestoreSync with primary', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'firestore-enable-primary')[1];
    handler({});
    expect(firestoreSync.enableFirestoreSync).toHaveBeenCalledWith('primary');
  });

  it('firestore-enable-shadow calls enableFirestoreSync with shadow', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'firestore-enable-shadow')[1];
    handler({});
    expect(firestoreSync.enableFirestoreSync).toHaveBeenCalledWith('shadow');
  });

  it('firestore-pull-remote shows confirmation', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'firestore-pull-remote')[1];
    handler({});
    expect(appModule.showConfirm).toHaveBeenCalled();
  });

  it('firestore-merge-remote shows confirmation', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'firestore-merge-remote')[1];
    handler({});
    expect(appModule.showConfirm).toHaveBeenCalled();
  });

  it('firestore-force-push shows confirmation', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'firestore-force-push')[1];
    handler({});
    expect(appModule.showConfirm).toHaveBeenCalled();
  });

  it('sync-center-smart-sync shows success when configured', async () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'sync-center-smart-sync')[1];
    await handler({});
    expect(appModule.showToast).toHaveBeenCalledWith('Firestore primario sincronizado.', 'success');
  });

  it('sync-center-smart-sync warns on conflict', async () => {
    firestoreSync.getFirestoreSyncStatus.mockReturnValue({ conflict: true });
    const handler = registerAction.mock.calls.find((c) => c[0] === 'sync-center-smart-sync')[1];
    await handler({});
    expect(appModule.showToast).toHaveBeenCalledWith(
      'Firebase tem conflito. Use Mesclar, Baixar ou Enviar local.',
      'info'
    );
  });

  it('sync-center-smart-sync prompts to activate Firestore', async () => {
    firestoreSync.getFirestoreSyncStatus.mockReturnValue({ configured: false });
    const handler = registerAction.mock.calls.find((c) => c[0] === 'sync-center-smart-sync')[1];
    await handler({});
    expect(appModule.showToast).toHaveBeenCalledWith(
      'Ative o Firestore primario para sincronizar entre dispositivos. Cloudflare e Drive ficam como backups manuais.',
      'info'
    );
  });

  it('sync-center-import-local calls importData', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'sync-center-import-local')[1];
    handler({});
    expect(configView.importData).toHaveBeenCalled();
  });

  it('drive-sync-now shows success toast', async () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'drive-sync-now')[1];
    await handler({});
    expect(appModule.showToast).toHaveBeenCalledWith('Sincronizado!', 'success');
  });

  it('drive-sync-now shows error toast on failure', async () => {
    let rejectFn;
    driveSync.syncWithDrive.mockImplementation(() => {
      return new Promise((_, reject) => {
        rejectFn = reject;
      });
    });
    const handler = registerAction.mock.calls.find((c) => c[0] === 'drive-sync-now')[1];
    handler({});
    rejectFn(new Error('fail'));
    await vi.waitFor(() => {
      expect(appModule.showToast).toHaveBeenCalledWith('Erro ao sincronizar', 'error');
    });
  });

  it('merge-from-drive shows confirmation', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'merge-from-drive')[1];
    handler({});
    expect(appModule.showConfirm).toHaveBeenCalled();
  });

  it('cloud-merge-remote shows confirmation', () => {
    const handler = registerAction.mock.calls.find((c) => c[0] === 'cloud-merge-remote')[1];
    handler({});
    expect(appModule.showConfirm).toHaveBeenCalled();
  });
});
