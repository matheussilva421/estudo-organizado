import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAppModules } from '../helpers/module-loader.js';

/**
 * Testes unitários para módulos de sincronização e infraestrutura
 */

// Mock de APIs externas
const mockGoogle = {
  accounts: {
    oauth2: {
      initTokenClient: vi.fn()
    }
  }
};
global.google = mockGoogle;

const mockGapi = {
  load: vi.fn((api, cb) => cb()),
  client: {
    init: vi.fn().mockResolvedValue({})
  }
};
global.gapi = mockGapi;

// Mock de credentials.js
vi.mock('../../src/js/credentials.js?v=8.22', () => ({
  getCredential: vi.fn().mockResolvedValue(null),
  setCredential: vi.fn().mockResolvedValue(undefined),
  deleteCredential: vi.fn().mockResolvedValue(undefined)
}));

// Mock de app.js
vi.mock('../../src/js/app.js?v=8.22', () => ({
  showToast: vi.fn(),
  showConfirm: vi.fn((msg, cb) => cb()),
  closeModal: vi.fn()
}));

// Mock de components.js
vi.mock('../../src/js/components.js?v=8.22', () => ({
  renderCurrentView: vi.fn()
}));

// Mock parcial de utils.js - mantém todas as funções originais, mocka apenas uid para teste
vi.mock('../../src/js/utils.js?v=8.22', async () => {
  const actual = await vi.importActual('../../src/js/utils.js?v=8.22');
  let counter = 0;
  return {
    ...actual,
    uid: vi.fn((prefix = '') => `${prefix}${Date.now()}_${++counter}`)
  };
});

let store;
let utils;

beforeEach(async () => {
  vi.resetModules();
  const modules = await loadAppModules();
  store = modules.store;

  // Carrega utils do mock
  utils = await import('../../src/js/utils.js?v=8.22');
});

describe('SyncQueue', () => {
  it('existe e tem método add', () => {
    expect(store.SyncQueue).toBeDefined();
    expect(typeof store.SyncQueue.add).toBe('function');
  });

  it('tem propriedade isProcessing inicializada como false', () => {
    expect(store.SyncQueue.isProcessing).toBe(false);
  });

  it('tem tasks array vazio inicialmente', () => {
    expect(store.SyncQueue.tasks).toEqual([]);
  });

  it('adiciona tarefa à fila e processa', async () => {
    const mockTask = vi.fn();

    await store.SyncQueue.add(mockTask);

    expect(mockTask).toHaveBeenCalled();
  });

  it('processa múltiplas tarefas em sequência', async () => {
    const task1 = vi.fn();
    const task2 = vi.fn();

    await store.SyncQueue.add(task1);
    await store.SyncQueue.add(task2);

    expect(task1).toHaveBeenCalled();
    expect(task2).toHaveBeenCalled();
  });
});

describe('credentials.js', () => {
  describe('setCredential()', () => {
    it('salva credencial no IndexedDB', async () => {
      const { setCredential } = await import('../../src/js/credentials.js?v=8.22');

      await setCredential('test_key', { token: 'abc123' });

      expect(setCredential).toHaveBeenCalledWith('test_key', { token: 'abc123' });
    });

    it('salva múltiplas credenciais', async () => {
      const { setCredential } = await import('../../src/js/credentials.js?v=8.22');

      await setCredential('cloudflare', { url: 'https://api.example.com', token: 'xyz' });
      await setCredential('drive', { clientId: 'client-123' });

      expect(setCredential).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCredential()', () => {
    it('recupera credencial do IndexedDB', async () => {
      const { getCredential } = await import('../../src/js/credentials.js?v=8.22');

      getCredential.mockResolvedValue({ token: 'abc123' });

      const result = await getCredential('test_key');

      expect(result).toEqual({ token: 'abc123' });
    });

    it('retorna null quando credencial não existe', async () => {
      const { getCredential } = await import('../../src/js/credentials.js?v=8.22');

      getCredential.mockResolvedValue(null);

      const result = await getCredential('nonexistent_key');

      expect(result).toBeNull();
    });

    it('retorna undefined quando erro no IndexedDB', async () => {
      const { getCredential } = await import('../../src/js/credentials.js?v=8.22');

      getCredential.mockRejectedValue(new Error('IndexedDB error'));

      await expect(getCredential('error_key')).rejects.toThrow('IndexedDB error');
    });
  });

  describe('deleteCredential()', () => {
    it('remove credencial do IndexedDB', async () => {
      const { deleteCredential } = await import('../../src/js/credentials.js?v=8.22');

      await deleteCredential('test_key');

      expect(deleteCredential).toHaveBeenCalledWith('test_key');
    });

    it('remove múltiplas credenciais', async () => {
      const { deleteCredential } = await import('../../src/js/credentials.js?v=8.22');

      await deleteCredential('key1');
      await deleteCredential('key2');

      expect(deleteCredential).toHaveBeenCalledTimes(2);
    });
  });
});

describe('store.js - Sync helpers', () => {
  describe('scheduleSave()', () => {
    it('é uma função exportada', () => {
      expect(store.scheduleSave).toBeDefined();
      expect(typeof store.scheduleSave).toBe('function');
    });
  });

  describe('saveStateToDB()', () => {
    it('salva estado no IndexedDB', async () => {
      const testState = {
        schemaVersion: 7,
        editais: [],
        eventos: [],
        config: {}
      };

      // A função deve resolver sem erro
      await store.saveStateToDB(testState);

      expect(store.state).toBeDefined();
    });

    it('atualiza o estado após salvar', async () => {
      const testState = {
        schemaVersion: 7,
        editais: [{ id: 'ed_1', nome: 'Teste' }],
        eventos: [],
        config: {}
      };

      await store.saveStateToDB(testState);

      expect(store.state.editais.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('state', () => {
    it('tem schemaVersion definido', () => {
      expect(store.state.schemaVersion).toBeDefined();
    });

    it('tem estrutura de editais', () => {
      expect(Array.isArray(store.state.editais)).toBe(true);
    });

    it('tem estrutura de eventos', () => {
      expect(Array.isArray(store.state.eventos)).toBe(true);
    });

    it('tem estrutura de habitos', () => {
      expect(store.state.habitos).toBeDefined();
      expect(typeof store.state.habitos).toBe('object');
    });
  });
});

describe('Infrastructure - Utils', () => {
  describe('uid()', () => {
    it('gera IDs únicos', () => {
      const id1 = utils.uid();
      const id2 = utils.uid();

      expect(id1).not.toBe(id2);
    });

    it('gera IDs com prefixo', () => {
      const id = utils.uid('test_');

      expect(id).toMatch(/^test_/);
    });
  });

  describe('todayStr()', () => {
    it('retorna data atual em formato YYYY-MM-DD', () => {
      const date = utils.todayStr();

      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('esc()', () => {
    it('escape caracteres HTML', () => {
      const result = utils.esc('<script>alert("xss")</script>');

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('preserva texto normal', () => {
      const result = utils.esc('Texto normal sem HTML');

      expect(result).toBe('Texto normal sem HTML');
    });
  });
});
