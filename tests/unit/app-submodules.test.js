/**
 * Import verification tests for app/ sub-modules
 * Ensures all extracted modules are importable and re-exports work correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
      contains: vi.fn(() => false),
      getBoundingClientRect: vi.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
      dataset: {},
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
    };
    elements[id] = el;
    return el;
  };

  return {
    getElementById: vi.fn((id) => {
      if (!elements[id]) elements[id] = createElement(id);
      return elements[id];
    }),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    createElement: vi.fn((tag) => {
      const el = createElement('created-' + tag);
      el.tagName = tag.toUpperCase();
      el.appendChild = vi.fn();
      el.createTextNode = vi.fn((text) => ({ textContent: text }));
      return el;
    }),
    createTextNode: vi.fn((text) => ({ textContent: text, nodeType: 3 })),
    activeElement: { blur: vi.fn() },
    body: {
      style: {},
      contains: vi.fn(() => false),
    },
    documentElement: {
      setAttribute: vi.fn(),
    },
    elements,
  };
}

describe('app/ sub-module imports', () => {
  beforeEach(() => {
    vi.resetModules();

    const mockDoc = createMockDOM();
    global.document = mockDoc;
    global.window = {
      innerWidth: 1024,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    global.localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    global.requestAnimationFrame = vi.fn((cb) => cb());

    // Mock dependencies for sub-modules
    vi.doMock('../../src/js/store.js?v=8.37', () => ({
      scheduleSave: vi.fn(),
      state: {
        config: {
          tema: 'grafite',
          darkMode: false,
          lastTheme: null,
          dataProva: null,
          metas: { horasSemana: 20, questoesSemana: 150 },
        },
      },
      initDB: vi.fn(() => Promise.resolve()),
    }));

    vi.doMock('../../src/js/components.js?v=8.37', () => ({
      renderCurrentView: vi.fn(),
    }));

    vi.doMock('../../src/js/state/dashboard-context.js?v=8.37', () => ({
      clearActiveDashboardDiscCtx: vi.fn(),
      setActiveDashboardDiscCtx: vi.fn(),
      getActiveDashboardDiscCtx: vi.fn(() => null),
    }));

    vi.doMock('../../src/js/utils.js?v=8.37', () => ({
      esc: vi.fn((s) => String(s)),
      todayStr: vi.fn(() => '2026-01-01'),
    }));

    vi.doMock('../../src/js/drive-sync.js?v=8.37', () => ({
      initGoogleAPIs: vi.fn(),
      updateDriveUI: vi.fn(),
    }));

    vi.doMock('../../src/js/notifications.js?v=8.37', () => ({
      initNotifications: vi.fn(),
    }));

    vi.doMock('../../src/js/sync/firestore-sync-engine.js?v=8.37', () => ({
      initFirestoreSync: vi.fn(),
    }));

    vi.doMock('../../src/js/sync/sync-coordinator.js?v=8.37', () => ({
      initSyncCoordinator: vi.fn(),
    }));

    vi.doMock('../../src/js/views/ciclo-view.js?v=8.37', () => ({
      setHideConcluidosCiclo: vi.fn(),
    }));
  });

  // ── Themes module ──────────────────────────────────────────────

  describe('app/themes.js', () => {
    it('exports THEME_OPTIONS with 6 themes', async () => {
      const mod = await import('../../src/js/app/themes.js');
      expect(mod.THEME_OPTIONS).toBeDefined();
      expect(mod.THEME_OPTIONS).toHaveLength(6);
      expect(mod.THEME_OPTIONS.map((t) => t.value)).toEqual([
        'grafite', 'ardosia', 'platina', 'terminal', 'neon', 'arrakis',
      ]);
    });

    it('normalizeTheme returns valid theme as-is', async () => {
      const mod = await import('../../src/js/app/themes.js');
      expect(mod.normalizeTheme('grafite')).toBe('grafite');
      expect(mod.normalizeTheme('neon')).toBe('neon');
    });

    it('normalizeTheme converts legacy aliases', async () => {
      const mod = await import('../../src/js/app/themes.js');
      expect(mod.normalizeTheme('dark')).toBe('grafite');
      expect(mod.normalizeTheme('obsidiana')).toBe('ardosia');
      expect(mod.normalizeTheme('furtivo')).toBe('ardosia');
      expect(mod.normalizeTheme('rubi')).toBe('platina');
    });

    it('normalizeTheme defaults to grafite for unknown', async () => {
      const mod = await import('../../src/js/app/themes.js');
      expect(mod.normalizeTheme('unknown')).toBe('grafite');
    });

    it('getThemeLabel returns label for valid theme', async () => {
      const mod = await import('../../src/js/app/themes.js');
      expect(mod.getThemeLabel('grafite')).toBe('Grafite');
      expect(mod.getThemeLabel('terminal')).toBe('Terminal');
    });

    it('applyTheme sets data-theme on document element', async () => {
      const mod = await import('../../src/js/app/themes.js');
      mod.applyTheme();
      expect(global.document.documentElement.setAttribute).toHaveBeenCalledWith(
        'data-theme',
        'grafite',
      );
    });
  });

  // ── Modals module ──────────────────────────────────────────────

  describe('app/modals.js', () => {
    it('exports openModal, closeModal, showConfirm, setupConfirmHandlers, cancelConfirm', async () => {
      const mod = await import('../../src/js/app/modals.js');
      expect(mod.openModal).toBeInstanceOf(Function);
      expect(mod.closeModal).toBeInstanceOf(Function);
      expect(mod.showConfirm).toBeInstanceOf(Function);
      expect(mod.setupConfirmHandlers).toBeInstanceOf(Function);
      expect(mod.cancelConfirm).toBeInstanceOf(Function);
    });

    it('exports _confirmCallback (initially null)', async () => {
      const mod = await import('../../src/js/app/modals.js');
      expect(mod._confirmCallback).toBeNull();
    });

    it('openModal adds open class and sets aria-hidden', async () => {
      const mod = await import('../../src/js/app/modals.js');
      mod.openModal('test-modal');
      const el = global.document.getElementById('test-modal');
      expect(el.classList.add).toHaveBeenCalledWith('open');
      expect(el.setAttribute).toHaveBeenCalledWith('aria-hidden', 'false');
    });

    it('closeModal removes open class', async () => {
      const mod = await import('../../src/js/app/modals.js');
      mod.openModal('test-modal');
      mod.closeModal('test-modal');
      const el = global.document.getElementById('test-modal');
      expect(el.classList.remove).toHaveBeenCalledWith('open');
    });

    it('openModal/closeModal return early when element not found', async () => {
      const mod = await import('../../src/js/app/modals.js');
      expect(() => mod.openModal('nonexistent')).not.toThrow();
      expect(() => mod.closeModal('nonexistent')).not.toThrow();
    });

    it('showConfirm populates confirm modal elements', async () => {
      const mod = await import('../../src/js/app/modals.js');
      const onYes = vi.fn();
      mod.showConfirm('Tem certeza?', onYes, { title: 'Teste', label: 'Sim' });
      const titleEl = global.document.getElementById('confirm-title');
      const msgEl = global.document.getElementById('confirm-msg');
      expect(titleEl.textContent).toBe('Teste');
      expect(msgEl.textContent).toBe('Tem certeza?');
    });
  });

  // ── Navigation module ──────────────────────────────────────────

  describe('app/navigation.js', () => {
    it('exports navigate, toggleSidebar, closeSidebar, toggleSidebarCollapse, currentView', async () => {
      const mod = await import('../../src/js/app/navigation.js');
      expect(mod.navigate).toBeInstanceOf(Function);
      expect(mod.toggleSidebar).toBeInstanceOf(Function);
      expect(mod.closeSidebar).toBeInstanceOf(Function);
      expect(mod.toggleSidebarCollapse).toBeInstanceOf(Function);
      expect(mod.currentView).toBe('home');
    });

    it('navigate updates currentView', async () => {
      const mod = await import('../../src/js/app/navigation.js');
      mod.navigate('dashboard');
      expect(mod.currentView).toBe('dashboard');
    });

    it('toggleSidebar toggles sidebar open class', async () => {
      const mod = await import('../../src/js/app/navigation.js');
      mod.toggleSidebar();
      const sidebar = global.document.getElementById('sidebar');
      expect(sidebar.classList.toggle).toHaveBeenCalledWith('open');
    });

    it('closeSidebar removes open class from sidebar', async () => {
      const mod = await import('../../src/js/app/navigation.js');
      mod.closeSidebar();
      const sidebar = global.document.getElementById('sidebar');
      expect(sidebar.classList.remove).toHaveBeenCalledWith('open');
    });
  });

  // ── Toast module ───────────────────────────────────────────────

  describe('app/toast.js', () => {
    it('exports showToast function', async () => {
      const mod = await import('../../src/js/app/toast.js');
      expect(mod.showToast).toBeInstanceOf(Function);
    });

    it('showToast creates toast element in container without throwing', async () => {
      // Fix mock: container needs appendChild and standard DOM props
      const container = global.document.getElementById('toast-container');
      container.appendChild = vi.fn();
      container.firstElementChild = null;
      container.lastElementChild = null;
      Object.defineProperty(container, 'children', { value: [], writable: true, configurable: true });

      const mod = await import('../../src/js/app/toast.js');
      expect(() => mod.showToast('Test message', 'success')).not.toThrow();
      expect(container.appendChild).toHaveBeenCalled();
    });

    it('showToast returns early when container missing', async () => {
      const oldDoc = global.document;
      const emptyDoc = createMockDOM();
      emptyDoc.getElementById = vi.fn(() => null);
      global.document = emptyDoc;
      const mod = await import('../../src/js/app/toast.js');
      expect(() => mod.showToast('msg')).not.toThrow();
      global.document = oldDoc;
    });
  });

  // ── Save-status module ─────────────────────────────────────────

  describe('app/save-status.js', () => {
    it('exports getLastSaveStatus, renderSaveStatus, initSaveStatusIndicator', async () => {
      const mod = await import('../../src/js/app/save-status.js');
      expect(mod.getLastSaveStatus).toBeInstanceOf(Function);
      expect(mod.renderSaveStatus).toBeInstanceOf(Function);
      expect(mod.initSaveStatusIndicator).toBeInstanceOf(Function);
    });

    it('getLastSaveStatus returns object with status and message', async () => {
      const mod = await import('../../src/js/app/save-status.js');
      const status = mod.getLastSaveStatus();
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('message');
    });

    it('getLastSaveStatus returns a new object each call', async () => {
      const mod = await import('../../src/js/app/save-status.js');
      const s1 = mod.getLastSaveStatus();
      const s2 = mod.getLastSaveStatus();
      expect(s1).not.toBe(s2);
    });

    it('renderSaveStatus updates save-status element', async () => {
      const mod = await import('../../src/js/app/save-status.js');
      mod.renderSaveStatus({ status: 'saving', message: 'Salvando...', detail: '', timestamp: new Date().toISOString() });
      const el = global.document.getElementById('save-status');
      expect(el.className).toContain('save-status--saving');
    });
  });
});

describe('app.js re-exports', () => {
  beforeEach(() => {
    vi.resetModules();

    const mockDoc = createMockDOM();
    global.document = mockDoc;
    global.window = {
      innerWidth: 1024,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    global.localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    global.requestAnimationFrame = vi.fn((cb) => cb());

    vi.doMock('../../src/js/store.js?v=8.37', () => ({
      scheduleSave: vi.fn(),
      state: {
        config: {
          tema: 'grafite',
          darkMode: false,
          lastTheme: null,
          dataProva: null,
          metas: { horasSemana: 20, questoesSemana: 150 },
        },
      },
      initDB: vi.fn(() => Promise.resolve()),
    }));

    vi.doMock('../../src/js/components.js?v=8.37', () => ({
      renderCurrentView: vi.fn(),
    }));

    vi.doMock('../../src/js/state/dashboard-context.js?v=8.37', () => ({
      clearActiveDashboardDiscCtx: vi.fn(),
    }));

    vi.doMock('../../src/js/utils.js?v=8.37', () => ({
      esc: vi.fn((s) => String(s)),
    }));

    vi.doMock('../../src/js/drive-sync.js?v=8.37', () => ({
      initGoogleAPIs: vi.fn(),
      updateDriveUI: vi.fn(),
    }));

    vi.doMock('../../src/js/notifications.js?v=8.37', () => ({
      initNotifications: vi.fn(),
    }));

    vi.doMock('../../src/js/sync/firestore-sync-engine.js?v=8.37', () => ({
      initFirestoreSync: vi.fn(),
    }));

    vi.doMock('../../src/js/sync/sync-coordinator.js?v=8.37', () => ({
      initSyncCoordinator: vi.fn(),
    }));

    vi.doMock('../../src/js/views/ciclo-view.js?v=8.37', () => ({
      setHideConcluidosCiclo: vi.fn(),
    }));
  });

  it('re-exports THEME_OPTIONS from themes sub-module', async () => {
    const app = await import('../../src/js/app.js?v=8.37');
    expect(app.THEME_OPTIONS).toBeDefined();
    expect(app.THEME_OPTIONS).toHaveLength(6);
  });

  it('re-exports normalizeTheme from themes sub-module', async () => {
    const app = await import('../../src/js/app.js?v=8.37');
    expect(app.normalizeTheme('grafite')).toBe('grafite');
    expect(app.normalizeTheme('dark')).toBe('grafite');
  });

  it('re-exports getThemeLabel from themes sub-module', async () => {
    const app = await import('../../src/js/app.js?v=8.37');
    expect(app.getThemeLabel('grafite')).toBe('Grafite');
  });

  it('re-exports applyTheme from themes sub-module', async () => {
    const app = await import('../../src/js/app.js?v=8.37');
    expect(app.applyTheme).toBeInstanceOf(Function);
  });

  it('re-exports openModal, closeModal from modals sub-module', async () => {
    const app = await import('../../src/js/app.js?v=8.37');
    expect(app.openModal).toBeInstanceOf(Function);
    expect(app.closeModal).toBeInstanceOf(Function);
  });

  it('re-exports showConfirm, _confirmCallback, setupConfirmHandlers, cancelConfirm from modals', async () => {
    const app = await import('../../src/js/app.js?v=8.37');
    expect(app.showConfirm).toBeInstanceOf(Function);
    expect(app.setupConfirmHandlers).toBeInstanceOf(Function);
    expect(app.cancelConfirm).toBeInstanceOf(Function);
    expect(app._confirmCallback).toBeNull();
  });

  it('re-exports currentView, navigate from navigation sub-module', async () => {
    const app = await import('../../src/js/app.js?v=8.37');
    expect(app.currentView).toBe('home');
    expect(app.navigate).toBeInstanceOf(Function);
  });

  it('re-exports sidebar functions from navigation sub-module', async () => {
    const app = await import('../../src/js/app.js?v=8.37');
    expect(app.toggleSidebar).toBeInstanceOf(Function);
    expect(app.closeSidebar).toBeInstanceOf(Function);
    expect(app.toggleSidebarCollapse).toBeInstanceOf(Function);
  });

  it('re-exports showToast from toast sub-module', async () => {
    const app = await import('../../src/js/app.js?v=8.37');
    expect(app.showToast).toBeInstanceOf(Function);
  });

  it('re-exports save status functions from save-status sub-module', async () => {
    const app = await import('../../src/js/app.js?v=8.37');
    expect(app.getLastSaveStatus).toBeInstanceOf(Function);
    expect(app.renderSaveStatus).toBeInstanceOf(Function);
    expect(app.initSaveStatusIndicator).toBeInstanceOf(Function);
  });

  it('exports init function', async () => {
    const app = await import('../../src/js/app.js?v=8.37');
    expect(app.init).toBeInstanceOf(Function);
  });

  it('exports promptDataProva and promptMetas', async () => {
    const app = await import('../../src/js/app.js?v=8.37');
    expect(app.promptDataProva).toBeInstanceOf(Function);
    expect(app.promptMetas).toBeInstanceOf(Function);
  });

  it('exports toggleCicloFin', async () => {
    const app = await import('../../src/js/app.js?v=8.37');
    expect(app.toggleCicloFin).toBeInstanceOf(Function);
  });

  it('navigate updates currentView (confirm live binding)', async () => {
    const app = await import('../../src/js/app.js?v=8.37');
    app.navigate('dashboard');
    expect(app.currentView).toBe('dashboard');
  });

  it('_confirmCallback is a live binding from modals sub-module', async () => {
    const app = await import('../../src/js/app.js?v=8.37');
    // ES modules are immutable — external code cannot assign to exports.
    // But the live binding means internal changes propagate.
    expect(app._confirmCallback).toBeNull();

    // Verify the binding works by calling showConfirm which sets it internally
    const mockFn = vi.fn();
    app.showConfirm('test', mockFn);
    expect(app._confirmCallback).toBe(mockFn);

    // Reset via cancelConfirm
    app.cancelConfirm();
    expect(app._confirmCallback).toBeNull();
  });
});
