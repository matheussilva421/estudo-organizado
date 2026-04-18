import { vi } from 'vitest';

class AudioMock {
  play() {
    return Promise.resolve();
  }
}

class NotificationMock {
  static permission = 'denied';
}

function createStorage() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

if (!globalThis.Audio) {
  globalThis.Audio = AudioMock;
}

if (!globalThis.Notification) {
  globalThis.Notification = NotificationMock;
}

if (!globalThis.matchMedia) {
  globalThis.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  }));
}

if (!globalThis.localStorage) {
  globalThis.localStorage = createStorage();
}

if (!globalThis.sessionStorage) {
  globalThis.sessionStorage = createStorage();
}

if (!globalThis.indexedDB) {
  globalThis.indexedDB = {
    open() {
      throw new Error('indexedDB.open mock not configured for this test');
    }
  };
}

if (!globalThis.fetch) {
  globalThis.fetch = vi.fn();
}
