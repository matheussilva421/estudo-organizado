import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock de credentials.js
vi.mock('../../src/js/credentials.js?v=8.31', () => ({
  getCredential: vi.fn().mockResolvedValue(null),
  setCredential: vi.fn().mockResolvedValue(undefined),
  deleteCredential: vi.fn().mockResolvedValue(undefined),
}));

// Mock de app.js
vi.mock('../../src/js/app.js?v=8.31', () => ({
  showToast: vi.fn(),
  showConfirm: vi.fn((msg, cb) => cb()),
  closeModal: vi.fn(),
}));

// Mock de components.js
vi.mock('../../src/js/components.js?v=8.31', () => ({
  renderCurrentView: vi.fn(),
}));

// Mock de sync-center.js
vi.mock('../../src/js/sync/sync-center.js?v=8.31', () => ({
  mergeStudyStates: vi.fn((local, remote) => ({ ...local, ...remote, merged: true })),
}));

// Mock de store.js
vi.mock('../../src/js/store.js?v=8.31', () => {
  const baseState = {
    schemaVersion: 7,
    editais: [],
    eventos: [],
    config: { visualizacao: 'mes' },
    habitos: { videoaula: [] },
    driveFileId: null,
    lastSync: null,
  };
  let currentState = JSON.parse(JSON.stringify(baseState));

  return {
    get state() {
      return currentState;
    },
    setState: vi.fn((newState) => {
      Object.assign(currentState, newState);
    }),
    saveStateToDB: vi.fn().mockResolvedValue(undefined),
    runMigrations: vi.fn(),
    scheduleSave: vi.fn(),
    createExportableState: vi.fn(() => JSON.parse(JSON.stringify(currentState))),
  };
});

// Mock de Google APIs
const mockGoogle = {
  accounts: {
    oauth2: {
      initTokenClient: vi.fn().mockReturnValue({ requestAccessToken: vi.fn() }),
      revoke: vi.fn(),
    },
  },
};
global.google = mockGoogle;

let driveSync;
let credentials;
let app;
let store;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();

  document.body.innerHTML = `
    <div id="drive-dot"></div>
    <div id="drive-label"></div>
    <div id="drive-sublabel"></div>
    <div id="drive-action-btn"></div>
    <div id="drive-status-area"></div>
  `;

  driveSync = await import('../../src/js/drive-sync.js?v=8.31');
  credentials = await import('../../src/js/credentials.js?v=8.31');
  app = await import('../../src/js/app.js?v=8.31');
  store = await import('../../src/js/store.js?v=8.31');

  credentials.getCredential.mockResolvedValue(null);

  // Setup gapi mock properly
  global.gapi = {
    load: vi.fn((api, cb) => cb()),
    client: {
      init: vi.fn().mockResolvedValue({}),
      getToken: vi.fn().mockReturnValue(null),
      setToken: vi.fn(),
      drive: {
        files: {
          get: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
        },
      },
    },
  };
});

describe('drive-sync.js', () => {
  describe('updateDriveUI()', () => {
    it('atualiza UI para estado connected', () => {
      driveSync.updateDriveUI('connected', 'Google Drive');

      const dot = document.getElementById('drive-dot');
      const txt = document.getElementById('drive-label');

      expect(dot.className).toBe('drive-dot connected');
      expect(txt.textContent).toBe('Google Drive');
    });

    it('atualiza UI para estado syncing', () => {
      driveSync.updateDriveUI('syncing', 'Sincronizando...');

      const dot = document.getElementById('drive-dot');
      const btn = document.getElementById('drive-action-btn');

      expect(dot.className).toBe('drive-dot syncing');
      expect(btn.disabled).toBe(true);
    });

    it('atualiza UI para estado disconnected', () => {
      driveSync.updateDriveUI('disconnected', 'Google Drive');

      const dot = document.getElementById('drive-dot');
      const btn = document.getElementById('drive-action-btn');

      expect(dot.className).toBe('drive-dot disconnected');
      expect(btn.textContent).toBe('Conectar');
    });

    it('exibe último sync quando conectado', () => {
      store.state.lastSync = '2026-04-29T10:00:00.000Z';

      driveSync.updateDriveUI('connected', 'Google Drive');

      const sub = document.getElementById('drive-sublabel');
      expect(sub.textContent).toContain('Sincronizado:');
    });

    it('retorna cedo quando elemento drive-dot não existe', () => {
      document.body.innerHTML = '';

      expect(() => {
        driveSync.updateDriveUI('connected', 'Google Drive');
      }).not.toThrow();
    });
  });

  describe('checkDriveStatus()', () => {
    it('mostra disconnected quando sem Client ID', async () => {
      await driveSync.checkDriveStatus();

      const dot = document.getElementById('drive-dot');
      expect(dot.className).toBe('drive-dot disconnected');
    });
  });

  describe('driveAction()', () => {
    it('salva novo Client ID', async () => {
      document.body.innerHTML += '<input id="drive-client-id" value="new-client-id">';

      await driveSync.driveAction();

      expect(credentials.setCredential).toHaveBeenCalledWith('drive_client_id', 'new-client-id');
    });

    it('mostra erro quando sem Client ID', async () => {
      document.body.innerHTML += '<input id="drive-client-id" value="">';

      await driveSync.driveAction();

      expect(app.showToast).toHaveBeenCalledWith('Insira o Client ID primeiro', 'error');
    });
  });

  describe('disconnectDrive()', () => {
    it('limpa credencial salva mesmo quando nao ha token ativo', async () => {
      localStorage.setItem('estudo_drive_client_id', 'saved-client-id');
      store.state.driveFileId = 'drive-file-id';
      store.state.lastSync = '2026-04-29T10:00:00.000Z';
      global.gapi.client.getToken.mockReturnValue(null);

      driveSync.disconnectDrive();

      expect(credentials.deleteCredential).toHaveBeenCalledWith('drive_client_id');
      expect(localStorage.getItem('estudo_drive_client_id')).toBeNull();
      expect(store.state.driveFileId).toBeNull();
      expect(store.state.lastSync).toBeNull();
      expect(global.google.accounts.oauth2.revoke).not.toHaveBeenCalled();
    });
  });

  describe('syncWithDrive()', () => {
    it('retorna quando gapi não inicializado', async () => {
      global.gapi = { client: null };

      await driveSync.syncWithDrive();
    });

    it('cria novo arquivo quando sem driveFileId', async () => {
      global.gapi.client.getToken.mockReturnValue({ access_token: 'token123' });
      store.state.driveFileId = null;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'new-file-123' }),
      });

      await driveSync.syncWithDrive();

      expect(global.fetch).toHaveBeenCalled();
      expect(store.state.driveFileId).toBe('new-file-123');
    });

    it('atualiza arquivo existente quando driveFileId presente', async () => {
      global.gapi.client.drive.files.get.mockResolvedValue({ result: { lastSync: null } });
      global.gapi.client.getToken.mockReturnValue({ access_token: 'token123' });

      store.state.driveFileId = 'existing-file-456';
      store.state.lastSync = '2026-04-29T10:00:00.000Z';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await driveSync.syncWithDrive();

      expect(global.fetch).toHaveBeenCalled();
    });

    it('oferece merge quando remoto mais recente', async () => {
      global.gapi.client.drive.files.get.mockResolvedValue({
        result: { lastSync: '2026-04-30T10:00:00.000Z' },
      });
      global.gapi.client.getToken.mockReturnValue({ access_token: 'token123' });
      app.showConfirm.mockImplementationOnce(() => {});

      store.state.driveFileId = 'file-merge-test';
      store.state.lastSync = '2026-04-28T10:00:00.000Z';

      await driveSync.syncWithDrive();

      expect(app.showConfirm).toHaveBeenCalled();
    });
  });

  describe('pullFromDrive()', () => {
    it('retorna quando APIs não carregadas', async () => {
      global.gapi = { client: null };

      await driveSync.pullFromDrive();

      expect(app.showToast).toHaveBeenCalledWith('APIs do Google não carregadas', 'error');
    });

    it('retorna quando sem driveFileId', async () => {
      store.state.driveFileId = null;

      await driveSync.pullFromDrive();

      expect(app.showToast).toHaveBeenCalledWith(
        'Nenhum arquivo encontrado no Drive. Sincronize primeiro.',
        'error'
      );
    });

    it('importa dados do Drive com sucesso', async () => {
      global.gapi.client.drive.files.get.mockResolvedValue({
        result: {
          config: { _lastUpdated: Date.now() },
          editais: [{ id: 'ed_drive', nome: 'Drive Edital' }],
        },
      });

      store.state.driveFileId = 'file-pull-test';

      await driveSync.pullFromDrive();

      expect(app.showToast).toHaveBeenCalledWith(
        'Dados importados do Drive com sucesso!',
        'success'
      );
    });

    it('rejeita dados inválidos do Drive', async () => {
      global.gapi.client.drive.files.get.mockResolvedValue({ result: null });

      store.state.driveFileId = 'file-invalid-test';

      await driveSync.pullFromDrive();

      expect(app.showToast).toHaveBeenCalledWith('Dados inválidos no Drive', 'error');
    });
  });

  describe('mergeFromDrive()', () => {
    it('retorna false quando APIs não carregadas', async () => {
      global.gapi = { client: null };

      const result = await driveSync.mergeFromDrive();

      expect(result).toBe(false);
    });

    it('retorna false quando sem driveFileId', async () => {
      store.state.driveFileId = null;

      const result = await driveSync.mergeFromDrive();

      expect(result).toBe(false);
    });

    it('mescla dados do Drive com sucesso', async () => {
      global.gapi.client.drive.files.get.mockResolvedValue({
        result: {
          config: { _lastUpdated: Date.now() },
          editais: [{ id: 'ed_merge', nome: 'Merge Edital' }],
        },
      });
      global.gapi.client.getToken.mockReturnValue({ access_token: 'token123' });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      store.state.driveFileId = 'file-merge-test';

      const result = await driveSync.mergeFromDrive();

      expect(result).toBe(true);
      expect(app.showToast).toHaveBeenCalledWith('Drive mesclado com os dados locais.', 'success');
    });
  });

  describe('initGoogleAPIs()', () => {
    it('retorna quando sem Client ID', async () => {
      await driveSync.initGoogleAPIs();

      expect(driveSync.gapiInited).toBe(false);
      expect(driveSync.gisInited).toBe(false);
    });
  });
});
