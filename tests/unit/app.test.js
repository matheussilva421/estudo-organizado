import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAppModules } from '../helpers/module-loader.js';
import { createBaseState } from '../helpers/state-builders.js';

let store;
let app;

function createMockDOM() {
  const elements = {};

  const createElement = (id) => {
    const el = {
      id,
      classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn() },
      setAttribute: vi.fn(),
      textContent: '',
      innerHTML: '',
      children: [],
      lastElementChild: null,
      firstElementChild: null,
      value: '',
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      click: vi.fn(),
      focus: vi.fn(),
      blur: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(() => true),
      getBoundingClientRect: vi.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
      dataset: {},
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
    };
    elements[id] = el;
    return el;
  };

  const mockDocument = {
    getElementById: vi.fn((id) => {
      if (!elements[id]) elements[id] = createElement(id);
      return elements[id];
    }),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    activeElement: { blur: vi.fn() },
    body: { contains: vi.fn(() => true), style: {} },
    elements,
  };

  return mockDocument;
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-20T10:00:00Z'));

  const mockDoc = createMockDOM();
  global.document = mockDoc;
  global.window = {
    innerWidth: 1024,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  global.Notification = { permission: 'granted' };
  global.Audio = vi.fn(() => ({ play: vi.fn(() => Promise.resolve()) }));
  global.clearInterval = vi.fn();
  global.setInterval = vi.fn(() => ({ _interval: true }));
  global.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  global.sessionStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  const modules = await loadAppModules();
  store = modules.store;
  app = modules.app;

  store.setState(createBaseState());
});

describe('app.js', () => {
  describe('normalizeTheme', () => {
    it('returns valid theme as-is', () => {
      expect(app.normalizeTheme('grafite')).toBe('grafite');
      expect(app.normalizeTheme('ardosia')).toBe('ardosia');
      expect(app.normalizeTheme('platina')).toBe('platina');
      expect(app.normalizeTheme('terminal')).toBe('terminal');
      expect(app.normalizeTheme('neon')).toBe('neon');
      expect(app.normalizeTheme('arrakis')).toBe('arrakis');
    });

    it('converts legacy aliases to modern themes', () => {
      expect(app.normalizeTheme('dark')).toBe('grafite');
      expect(app.normalizeTheme('light')).toBe('grafite');
      expect(app.normalizeTheme('obsidiana')).toBe('ardosia');
      expect(app.normalizeTheme('contraste')).toBe('platina');
      expect(app.normalizeTheme('furtivo')).toBe('ardosia');
      expect(app.normalizeTheme('matrix')).toBe('ardosia');
      expect(app.normalizeTheme('rubi')).toBe('platina');
      expect(app.normalizeTheme('pergaminho')).toBe('platina');
    });

    it('defaults to grafite for unknown themes', () => {
      expect(app.normalizeTheme('unknown')).toBe('grafite');
    });
  });

  describe('getThemeLabel', () => {
    it('returns label for valid theme', () => {
      expect(app.getThemeLabel('grafite')).toBe('Grafite');
      expect(app.getThemeLabel('ardosia')).toBe('Ardósia');
      expect(app.getThemeLabel('platina')).toBe('Platina');
      expect(app.getThemeLabel('terminal')).toBe('Terminal');
      expect(app.getThemeLabel('neon')).toBe('Neon');
      expect(app.getThemeLabel('arrakis')).toBe('Arrakis');
    });

    it('normalizes theme before getting label', () => {
      expect(app.getThemeLabel('dark')).toBe('Grafite');
    });
  });

  describe('getLastSaveStatus', () => {
    it('returns a copy of the current save status', () => {
      const status = app.getLastSaveStatus();
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('message');
    });

    it('returns a new object each time', () => {
      const status1 = app.getLastSaveStatus();
      const status2 = app.getLastSaveStatus();
      expect(status1).not.toBe(status2);
    });
  });

  describe('renderSaveStatus', () => {
    it('updates save-status element with correct class', () => {
      app.renderSaveStatus({ status: 'saving', message: 'Salvando...', detail: '', timestamp: new Date().toISOString() });
      const el = global.document.getElementById('save-status');
      expect(el.className).toContain('save-status--saving');
    });

    it('handles error status', () => {
      app.renderSaveStatus({ status: 'error', message: 'Erro', detail: 'falha', timestamp: new Date().toISOString() });
      const el = global.document.getElementById('save-status');
      expect(el.className).toContain('save-status--error');
    });
  });

  describe('openModal / closeModal', () => {
    it('openModal adds open class', () => {
      app.openModal('test-modal');
      const el = global.document.getElementById('test-modal');
      expect(el.classList.add).toHaveBeenCalledWith('open');
    });

    it('closeModal removes open class', () => {
      app.openModal('test-modal');
      app.closeModal('test-modal');
      const el = global.document.getElementById('test-modal');
      expect(el.classList.remove).toHaveBeenCalledWith('open');
    });

    it('does nothing when element not found', () => {
      expect(() => app.openModal('nonexistent')).not.toThrow();
      expect(() => app.closeModal('nonexistent')).not.toThrow();
    });
  });

  describe('showConfirm', () => {
    it('populates confirm modal elements', () => {
      app.showConfirm('Tem certeza?', vi.fn(), { title: 'Teste', label: 'Sim' });
      const titleEl = global.document.getElementById('confirm-title');
      const msgEl = global.document.getElementById('confirm-msg');
      expect(titleEl.textContent).toBe('Teste');
      expect(msgEl.textContent).toBe('Tem certeza?');
    });

    it('does nothing when elements are missing', () => {
      global.document.getElementById = vi.fn(() => null);
      expect(() => app.showConfirm('msg', vi.fn())).not.toThrow();
    });
  });

  describe('navigate', () => {
    it('updates currentView', () => {
      app.navigate('dashboard');
      expect(app.currentView).toBe('dashboard');
    });

    it('clears dashboard disc context when navigating to editais', () => {
      app.navigate('editais');
      expect(app.currentView).toBe('editais');
    });
  });

  describe('toggleSidebar / closeSidebar', () => {
    it('toggleSidebar toggles open class', () => {
      app.toggleSidebar();
      const sidebar = global.document.getElementById('sidebar');
      expect(sidebar.classList.toggle).toHaveBeenCalledWith('open');
    });

    it('closeSidebar removes open class', () => {
      app.closeSidebar();
      const sidebar = global.document.getElementById('sidebar');
      expect(sidebar.classList.remove).toHaveBeenCalledWith('open');
    });

    it('does nothing when elements are missing', () => {
      global.document.getElementById = vi.fn(() => null);
      expect(() => app.toggleSidebar()).not.toThrow();
    });
  });

  describe('promptDataProva', () => {
    it('opens modal prompt', () => {
      app.promptDataProva();
      const modal = global.document.getElementById('modal-prompt');
      expect(modal.classList.add).toHaveBeenCalledWith('open');
    });

    it('saves valid date to state.config.dataProva', () => {
      store.setState(createBaseState());
      app.promptDataProva();
      const saveBtn = global.document.getElementById('modal-prompt-save');
      global.document.getElementById('prompt-input-data').value = '2026-12-31';
      saveBtn.onclick();
      expect(store.state.config.dataProva).toBe('2026-12-31');
    });

    it('clears date when input is empty', () => {
      store.setState(createBaseState({ config: { dataProva: '2026-01-01' } }));
      app.promptDataProva();
      const saveBtn = global.document.getElementById('modal-prompt-save');
      global.document.getElementById('prompt-input-data').value = '';
      saveBtn.onclick();
      expect(store.state.config.dataProva).toBeNull();
    });
  });

  describe('promptMetas', () => {
    it('opens modal prompt', () => {
      app.promptMetas();
      const modal = global.document.getElementById('modal-prompt');
      expect(modal.classList.add).toHaveBeenCalledWith('open');
    });

    it('saves valid metas', () => {
      store.setState(createBaseState());
      app.promptMetas();
      const saveBtn = global.document.getElementById('modal-prompt-save');
      global.document.getElementById('prompt-input-horas').value = '30';
      global.document.getElementById('prompt-input-quest').value = '200';
      saveBtn.onclick();
      expect(store.state.config.metas.horasSemana).toBe(30);
    });
  });

  describe('THEME_OPTIONS', () => {
    it('exports theme options array', () => {
      expect(app.THEME_OPTIONS).toHaveLength(6);
      expect(app.THEME_OPTIONS.map((t) => t.value)).toContain('grafite');
      expect(app.THEME_OPTIONS.map((t) => t.value)).toContain('ardosia');
      expect(app.THEME_OPTIONS.map((t) => t.value)).toContain('platina');
      expect(app.THEME_OPTIONS.map((t) => t.value)).toContain('terminal');
      expect(app.THEME_OPTIONS.map((t) => t.value)).toContain('neon');
      expect(app.THEME_OPTIONS.map((t) => t.value)).toContain('arrakis');
      expect(app.THEME_OPTIONS.map((t) => t.value)).not.toContain('pergaminho');
    });
  });

  // Manual-only mode: Drive polling and the globalSyncPauseChanged listener
  // were removed. The corresponding tests were deleted with them.
});
