import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('views/config-view.js', () => {
  let appModule;
  let storeModule;
  let logicModule;
  let componentsModule;
  let syncCenter;
  let firestoreSync;
  let cloudSync;
  let driveSync;
  let configView;

  beforeEach(async () => {
    vi.resetModules();
    appModule = {
      THEME_OPTIONS: [
        { value: 'dark', label: 'Grafite' },
        { value: 'light', label: 'Claro' },
        { value: 'auto', label: 'Automático' },
      ],
      applyTheme: vi.fn(),
      normalizeTheme: vi.fn((t) => t || 'dark'),
      showConfirm: vi.fn((msg, cb) => cb()),
      showToast: vi.fn(),
      openModal: vi.fn(),
      getLastSaveStatus: vi.fn(() => null),
    };
    storeModule = {
      scheduleSave: vi.fn(),
      state: {
        config: {
          darkMode: true,
          tema: 'dark',
          revisoesIntervalo: 7,
          metas: { horasSemana: 20 },
        },
        eventos: [],
        arquivo: [],
        editais: [],
        disciplinas: [],
        revisoes: [],
        planejamento: { ativo: false },
      },
      setState: vi.fn(),
      runMigrations: vi.fn(),
      createExportableState: vi.fn(() => ({ config: {}, eventos: [] })),
      clearData: vi.fn(() => Promise.resolve()),
    };
    logicModule = {
      syncCicloToEventos: vi.fn(),
      invalidateDiscCache: vi.fn(),
      invalidateDashCaches: vi.fn(),
      invalidateRevCache: vi.fn(),
    };
    componentsModule = { renderCurrentView: vi.fn() };
    syncCenter = {
      buildSyncCenterModel: vi.fn(() => ({
        health: { status: 'synced', metrics: {} },
        quiet: {
          title: 'Tudo salvo automaticamente',
          detail: 'Suas alterações ficam salvas neste dispositivo.',
          tone: 'ok',
          primaryAction: null,
        },
        performanceMetrics: [],
        sources: [],
      })),
    };
    firestoreSync = {
      getFirestoreSyncStatus: vi.fn(() => ({ configured: false })),
      previewFirestoreRestore: vi.fn(() => Promise.resolve({ eventos: [{ id: 'fs_remote' }], config: {} })),
      pullFromFirestore: vi.fn(),
    };
    cloudSync = {
      setSyncCreds: vi.fn(() => Promise.resolve()),
      forceCloudflareSync: vi.fn(() => Promise.resolve()),
      previewCloudflareRestore: vi.fn(() => Promise.resolve({ eventos: [{ id: 'cf_remote' }], config: {} })),
      pullFromCloudflare: vi.fn(),
    };
    driveSync = {
      disconnectDrive: vi.fn(),
      previewDriveRestore: vi.fn(() => Promise.resolve({ eventos: [{ id: 'drive_remote' }], config: {} })),
      pullFromDrive: vi.fn(),
    };
    vi.doMock('../../src/js/backup-restore.js?v=8.36', () => ({
      previewRestoreImpact: vi.fn(() => ({
        totals: { added: 2, removed: 1, changed: 1, preserved: 3 },
        byCollection: {
          eventos: { added: 1, removed: 1, changed: 0, preserved: 2 },
          habitos: { added: 1, removed: 0, changed: 1, preserved: 1 },
        },
        risks: ['remove-data'],
      })),
      validateBackupPayload: vi.fn(() => ({ ok: true, issues: [] })),
    }));

    vi.doMock('../../src/js/app.js?v=8.36', () => appModule);
    vi.doMock('../../src/js/utils.js?v=8.36', () => ({
      cutoffDateStr: vi.fn((d) => {
        const dt = new Date();
        dt.setDate(dt.getDate() - d);
        return dt.toISOString().slice(0, 10);
      }),
      esc: vi.fn((s) => s || ''),
      todayStr: vi.fn(() => '2026-04-29'),
      invalidateTodayCache: vi.fn(),
    }));
    vi.doMock('../../src/js/store.js?v=8.36', () => storeModule);
    vi.doMock('../../src/js/logic.js?v=8.36', () => logicModule);
    vi.doMock('../../src/js/components.js?v=8.36', () => componentsModule);
    vi.doMock('../../src/js/sync/sync-center.js?v=8.36', () => syncCenter);
    vi.doMock('../../src/js/sync/firestore-sync-engine.js?v=8.36', () => firestoreSync);
    vi.doMock('../../src/js/cloud-sync.js?v=8.36', () => cloudSync);
    vi.doMock('../../src/js/drive-sync.js?v=8.36', () => driveSync);

    configView = await import('../../src/js/views/config-view.js?v=8.36');
  });

  describe('setTheme()', () => {
    it('updates theme state and applies it', () => {
      configView.setTheme('dark');
      expect(storeModule.state.config.tema).toBe('dark');
      expect(storeModule.state.config.darkMode).toBe(true);
      expect(appModule.applyTheme).toHaveBeenCalled();
      expect(storeModule.scheduleSave).toHaveBeenCalled();
      expect(componentsModule.renderCurrentView).toHaveBeenCalled();
    });
  });

  describe('updateConfig()', () => {
    it('sets config key for regular keys', () => {
      configView.updateConfig('revisoesIntervalo', 14);
      expect(storeModule.state.config.revisoesIntervalo).toBe(14);
      expect(storeModule.scheduleSave).toHaveBeenCalled();
      expect(componentsModule.renderCurrentView).toHaveBeenCalled();
    });

    it('calls syncCicloToEventos for materiasPorDia', () => {
      configView.updateConfig('materiasPorDia', 5);
      expect(logicModule.syncCicloToEventos).toHaveBeenCalled();
    });

    it('stores cfToken directly in state.config', () => {
      configView.updateConfig('cfToken', 'new-token');
      expect(storeModule.state.config.cfToken).toBe('new-token');
      expect(storeModule.scheduleSave).toHaveBeenCalled();
    });
  });

  describe('toggleConfig()', () => {
    it('toggles boolean config value', () => {
      storeModule.state.config.darkMode = true;
      const el = { classList: { toggle: vi.fn() } };
      configView.toggleConfig('darkMode', el);
      expect(storeModule.state.config.darkMode).toBe(false);
      expect(el.classList.toggle).toHaveBeenCalledWith('on', false);
      expect(storeModule.scheduleSave).toHaveBeenCalled();
    });

    it('turns on when was off', () => {
      storeModule.state.config.darkMode = false;
      const el = { classList: { toggle: vi.fn() } };
      configView.toggleConfig('darkMode', el);
      expect(storeModule.state.config.darkMode).toBe(true);
      expect(el.classList.toggle).toHaveBeenCalledWith('on', true);
    });
  });

  describe('updateFrequencia()', () => {
    it('parses comma-separated numbers', () => {
      configView.updateFrequencia('1, 3, 7, 14');
      expect(storeModule.state.config.frequenciaRevisao).toEqual([1, 3, 7, 14]);
      expect(storeModule.scheduleSave).toHaveBeenCalled();
    });

    it('filters out invalid numbers', () => {
      configView.updateFrequencia('1, abc, 0, -5, 7');
      expect(storeModule.state.config.frequenciaRevisao).toEqual([1, 7]);
    });

    it('does nothing for empty input', () => {
      configView.updateFrequencia('');
      expect(storeModule.scheduleSave).not.toHaveBeenCalled();
    });
  });

  describe('openDriveModal()', () => {
    it('opens the drive modal', () => {
      configView.openDriveModal();
      expect(appModule.openModal).toHaveBeenCalledWith('modal-drive');
    });
  });

  describe('driveDisconnect()', () => {
    it('calls disconnectDrive', () => {
      configView.driveDisconnect();
      expect(driveSync.disconnectDrive).toHaveBeenCalled();
    });
  });

  describe('archiveOldEvents()', () => {
    it('shows info toast when no events to archive', () => {
      storeModule.state.eventos = [];
      configView.archiveOldEvents(90);
      expect(appModule.showToast).toHaveBeenCalledWith('Nenhum evento para arquivar.', 'info');
    });

    it('archives old completed events', () => {
      const oldDate = '2025-01-01';
      storeModule.state.eventos = [
        { id: 'e1', status: 'estudei', data: oldDate },
        { id: 'e2', status: 'pendente', data: oldDate },
        { id: 'e3', status: 'estudei', data: '2026-04-28' },
      ];
      configView.archiveOldEvents(90);
      expect(appModule.showConfirm).toHaveBeenCalled();
    });
  });

  describe('exportData()', () => {
    it('creates downloadable JSON blob', () => {
      const mockCreateObjectURL = vi.fn(() => 'blob:url');
      const mockRevokeObjectURL = vi.fn();
      vi.stubGlobal('URL', { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL });
      const mockClick = vi.fn();
      vi.spyOn(document, 'createElement').mockReturnValue({ click: mockClick, href: '', download: '' });

      configView.exportData();
      expect(storeModule.createExportableState).toHaveBeenCalled();
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(appModule.showToast).toHaveBeenCalledWith('Dados exportados!', 'success');
    });
  });

  describe('clearAllData()', () => {
    it('calls clearData and resets state', async () => {
      await configView.clearAllData();
      expect(storeModule.clearData).toHaveBeenCalled();
    });
  });

  describe('toggleCfSync()', () => {
    it('shows error when URL is missing', async () => {
      const el = { value: '' };
      vi.spyOn(document, 'getElementById').mockReturnValue(el);
      storeModule.state.config.cfTokenSaved = false;
      await configView.toggleCfSync(true);
      expect(appModule.showToast).toHaveBeenCalledWith(
        'Preencha a URL do Worker e o Token antes de ativar.',
        'error'
      );
    });

    it('disables sync without validation', async () => {
      await configView.toggleCfSync(false);
      expect(storeModule.state.config.cfSyncEnabled).toBe(false);
      expect(storeModule.scheduleSave).toHaveBeenCalled();
      expect(componentsModule.renderCurrentView).toHaveBeenCalled();
    });
  });

  describe('restoreBackupFromSelectedSource()', () => {
    it('calls importData for local source', () => {
      vi.spyOn(document, 'getElementById').mockReturnValue({ value: 'local' });
      configView.restoreBackupFromSelectedSource();
      expect(appModule.openModal).not.toHaveBeenCalled();
    });

    it('shows error when Firestore not enabled', () => {
      vi.spyOn(document, 'getElementById').mockReturnValue({ value: 'firestore' });
      storeModule.state.config.firestoreSync = { enabled: false };
      configView.restoreBackupFromSelectedSource();
      expect(appModule.showToast).toHaveBeenCalledWith(
        'Ative o Firestore e entre com Google antes de restaurar por ele.',
        'error'
      );
    });

    it('shows error when Cloudflare not configured', () => {
      vi.spyOn(document, 'getElementById').mockReturnValue({ value: 'cloudflare' });
      storeModule.state.config.cfSyncEnabled = false;
      configView.restoreBackupFromSelectedSource();
      expect(appModule.showToast).toHaveBeenCalledWith(
        'Configure a sincronização Cloudflare antes de restaurar por ela.',
        'error'
      );
    });

    it('shows error when Drive not connected', () => {
      vi.spyOn(document, 'getElementById').mockReturnValue({ value: 'drive' });
      storeModule.state.driveFileId = null;
      configView.restoreBackupFromSelectedSource();
      expect(appModule.showToast).toHaveBeenCalledWith(
        'Conecte o Google Drive antes de restaurar por ele.',
        'error'
      );
    });

    it('previews Firestore remote data before pulling it', async () => {
      document.body.innerHTML = `
        <div id="modal-prompt">
          <h2 id="modal-prompt-title"></h2>
          <div id="modal-prompt-body"></div>
          <button id="modal-prompt-save"></button>
        </div>
      `;
      vi.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'backup-restore-source') return { value: 'firestore' };
        return document.querySelector(`#${id}`);
      });
      storeModule.state.config.firestoreSync = { enabled: true };

      await configView.restoreBackupFromSelectedSource();

      expect(firestoreSync.previewFirestoreRestore).toHaveBeenCalled();
      expect(firestoreSync.pullFromFirestore).not.toHaveBeenCalled();
      expect(appModule.openModal).toHaveBeenCalledWith('modal-prompt');

      document.getElementById('modal-prompt-save').onclick();
      expect(firestoreSync.pullFromFirestore).toHaveBeenCalledWith(true);
    });

    it('previews Cloudflare remote data before pulling it', async () => {
      document.body.innerHTML = `
        <div id="modal-prompt">
          <h2 id="modal-prompt-title"></h2>
          <div id="modal-prompt-body"></div>
          <button id="modal-prompt-save"></button>
        </div>
      `;
      vi.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'backup-restore-source') return { value: 'cloudflare' };
        return document.querySelector(`#${id}`);
      });
      storeModule.state.config.cfSyncEnabled = true;
      storeModule.state.config.cfUrl = 'https://worker.example';
      storeModule.state.config.cfToken = 'saved-token';

      await configView.restoreBackupFromSelectedSource();

      expect(cloudSync.previewCloudflareRestore).toHaveBeenCalled();
      expect(cloudSync.pullFromCloudflare).not.toHaveBeenCalled();
      expect(appModule.openModal).toHaveBeenCalledWith('modal-prompt');
    });

    it('previews Drive remote data before pulling it', async () => {
      document.body.innerHTML = `
        <div id="modal-prompt">
          <h2 id="modal-prompt-title"></h2>
          <div id="modal-prompt-body"></div>
          <button id="modal-prompt-save"></button>
        </div>
      `;
      vi.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'backup-restore-source') return { value: 'drive' };
        return document.querySelector(`#${id}`);
      });
      storeModule.state.driveFileId = 'drive-file';

      await configView.restoreBackupFromSelectedSource();

      expect(driveSync.previewDriveRestore).toHaveBeenCalled();
      expect(driveSync.pullFromDrive).not.toHaveBeenCalled();
      expect(appModule.openModal).toHaveBeenCalledWith('modal-prompt');
    });
  });

  describe('renderConfig()', () => {
    it('renders sync labels with Portuguese accents', () => {
      const el = document.createElement('div');

      configView.renderConfig(el);

      expect(el.innerHTML).toContain('Sincronização automática');
      expect(el.innerHTML).toContain('Opções avançadas de sync');
      expect(el.innerHTML).not.toContain('Sincronizacao automatica');
      expect(el.innerHTML).not.toContain('Opcoes avancadas');
    });
  });

  describe('renderConfig()', () => {
    it('renders a dedicated Backup Center with source history and safe restore actions', () => {
      storeModule.state.config.localBackupAt = '2026-04-30T10:00:00.000Z';
      storeModule.state.config.firestoreSync = { remoteUpdatedAt: '2026-04-30T10:05:00.000Z' };
      storeModule.state.config.cfLastSyncAt = '2026-04-30T10:10:00.000Z';
      storeModule.state.lastSync = '2026-04-30T10:15:00.000Z';
      const el = document.createElement('div');

      configView.renderConfig(el);

      expect(el.innerHTML).toContain('Backup Center');
      expect(el.innerHTML).toContain('data-testid="backup-center"');
      expect(el.innerHTML).toContain('data-testid="sync-center"');
      expect(el.innerHTML).toContain('data-testid="sync-quiet-panel"');
      expect(el.innerHTML).toContain('Sincronização automática');
      expect(el.innerHTML).toContain('data-testid="sync-advanced-panel"');
      expect(el.innerHTML).toContain('data-action="open-restore-preview"');
      expect(el.innerHTML).toContain('Exportar antes de restaurar');
    });
  });

  describe('openRestorePreviewModal()', () => {
    it('opens a restore preview modal with impact totals and export-before-restore action', () => {
      document.body.innerHTML = `
        <div id="modal-prompt">
          <h2 id="modal-prompt-title"></h2>
          <div id="modal-prompt-body"></div>
          <button id="modal-prompt-save"></button>
        </div>
      `;
      const onConfirm = vi.fn();

      configView.openRestorePreviewModal({ eventos: [{ id: 'novo' }], config: {} }, {
        sourceLabel: 'JSON local',
        onConfirm,
      });

      expect(document.getElementById('modal-prompt-title').textContent).toBe('Prévia de restauração');
      expect(document.getElementById('modal-prompt-body').innerHTML).toContain('2 adicionados');
      expect(document.getElementById('modal-prompt-body').innerHTML).toContain('Exportar antes de restaurar');
      expect(appModule.openModal).toHaveBeenCalledWith('modal-prompt');
    });
  });
});
