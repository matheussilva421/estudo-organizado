import { beforeEach, describe, expect, it, vi } from 'vitest';

function createIndexedDBMock({ putError = null } = {}) {
  const fakeDb = {
    objectStoreNames: { contains: () => true },
    createObjectStore: vi.fn(),
    transaction: vi.fn(() => ({
      objectStore: () => ({
        get: () => {
          const req = {};
          queueMicrotask(() => {
            req.result = null;
            req.onsuccess?.({ target: req });
          });
          return req;
        },
        put: () => {
          const req = {};
          queueMicrotask(() => {
            if (putError) {
              req.error = putError;
              req.onerror?.({ target: req });
            } else {
              req.onsuccess?.({ target: req });
            }
          });
          return req;
        }
      })
    }))
  };

  return {
    open: vi.fn(() => {
      const req = {};
      queueMicrotask(() => {
        req.result = fakeDb;
        req.onsuccess?.({ target: req });
      });
      return req;
    })
  };
}

async function importStoreWithDB(options) {
  vi.resetModules();
  globalThis.indexedDB = createIndexedDBMock(options);
  const store = await import('../../src/js/store.js?v=8.17');
  await store.initDB();
  return store;
}

describe('save status indicator contract', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '';
  });

  it('emits saving and saved states around debounced persistence', async () => {
    const store = await importStoreWithDB();
    const events = [];
    document.addEventListener('app:saveStatus', (event) => events.push(event.detail));

    store.scheduleSave();

    expect(events.at(-1)).toMatchObject({ status: 'saving', message: 'Salvando...' });

    vi.advanceTimersByTime(2000);
    await vi.runAllTimersAsync();

    expect(events.at(-1)).toMatchObject({ status: 'saved', message: 'Salvo localmente' });
  });

  it('emits specific failure details when IndexedDB save fails', async () => {
    const store = await importStoreWithDB({
      putError: new DOMException('Storage quota exceeded', 'QuotaExceededError')
    });
    const events = [];
    document.addEventListener('app:saveStatus', (event) => events.push(event.detail));

    await expect(store.saveStateToDB()).rejects.toBeInstanceOf(DOMException);

    expect(events.at(-1)).toMatchObject({
      status: 'error',
      message: 'Erro ao salvar'
    });
    expect(events.at(-1).detail).toContain('Espaço de armazenamento insuficiente');
    expect(events.at(-1).detail).toContain('QuotaExceededError');
  });

  it('shows the save failure reason inside settings when config status exists', async () => {
    vi.resetModules();
    document.body.innerHTML = `
      <div id="save-status"></div>
      <div id="config-save-status-detail"></div>
    `;
    const app = await import('../../src/js/app.js?v=8.17');
    app.initSaveStatusIndicator();

    document.dispatchEvent(new CustomEvent('app:saveStatus', {
      detail: {
        status: 'error',
        message: 'Erro ao salvar',
        detail: 'IndexedDB indisponível: InvalidStateError'
      }
    }));

    expect(document.getElementById('save-status').textContent).toContain('Erro ao salvar');
    expect(document.getElementById('config-save-status-detail').textContent)
      .toContain('IndexedDB indisponível: InvalidStateError');
  });
});
