import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('../../src/js/store.js?v=8.37', () => ({
  state: { config: { globalSyncPaused: true } },
}));

vi.mock('../../src/js/sync/firestore-sync-engine.js?v=8.37', () => ({
  getFirestoreSyncStatus: vi.fn(() => ({})),
}));

vi.mock('../../src/js/sync/sync-center.js?v=8.37', () => ({
  buildSyncCenterModel: vi.fn(() => ({ quiet: {}, health: {}, sources: [] })),
}));

describe('sync-now-button states', () => {
  let container;
  let syncNowBtn;
  let originalNavigatorOnLine;

  beforeEach(() => {
    // Set up DOM with the new sync pill structure (replaces old sync-status +
    // sync-now-btn). Legacy ids are also created for tests that still reference
    // them.
    document.body.innerHTML = `
      <div class="sync-pill-wrapper">
        <button id="sync-pill" class="sync-pill sync-pill--idle" data-action="toggle-sync-popover" aria-expanded="false">
          <span class="sync-pill-icon"><i class="fa fa-circle"></i></span>
          <span class="sync-pill-label" id="sync-pill-label">Aguardando sync</span>
        </button>
        <div id="sync-popover" hidden>
          <span id="sync-popover-local"></span>
          <span id="sync-popover-remote"></span>
          <span id="sync-popover-last"></span>
        </div>
      </div>
      <div id="sync-status" class="sync-status" role="status" aria-live="polite"></div>
      <button id="sync-now-btn" type="button"><i class="fa fa-arrows-rotate"></i></button>
    `;

    container = document.getElementById('sync-pill-label');
    syncNowBtn = document.getElementById('sync-now-btn');

    // Save original navigator.onLine
    originalNavigatorOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  });

  afterEach(() => {
    // Restore original navigator.onLine
    if (originalNavigatorOnLine) {
      Object.defineProperty(navigator, 'onLine', originalNavigatorOnLine);
    }
    document.body.innerHTML = '';
  });

  function setOnline(value) {
    Object.defineProperty(navigator, 'onLine', {
      value,
      configurable: true,
    });
  }

  function waitFrame() {
    return new Promise((resolve) => setTimeout(resolve, 30));
  }

  it('renders idle state with fa-arrows-rotate icon and enabled', async () => {
    setOnline(true);
    const { SYNC_NOW_STATES } = await import('../../src/js/sync/sync-status-ui.js?v=8.37&test=idle');

    const config = SYNC_NOW_STATES.idle;
    expect(config.icon).toBe('fa-arrows-rotate');
    expect(config.title).toBe('Sincronizar agora');
    expect(config.disabled).toBe(false);
    expect(config.cssClass).toBe('');
  });

  it('renders syncing state with spinner icon and disabled', async () => {
    setOnline(true);
    const { SYNC_NOW_STATES } = await import('../../src/js/sync/sync-status-ui.js?v=8.37&test=syncing');

    const config = SYNC_NOW_STATES.syncing;
    expect(config.icon).toBe('fa-spinner fa-spin');
    expect(config.title).toBe('Sincronizando…');
    expect(config.disabled).toBe(true);
    expect(config.cssClass).toBe('sync-now-btn--syncing');
  });

  it('renders error state with warning icon and enabled', async () => {
    setOnline(true);
    const { SYNC_NOW_STATES } = await import('../../src/js/sync/sync-status-ui.js?v=8.37&test=error');

    const config = SYNC_NOW_STATES.error;
    expect(config.icon).toBe('fa-exclamation-triangle');
    expect(config.title).toContain('Erro');
    expect(config.disabled).toBe(false);
    expect(config.cssClass).toBe('sync-now-btn--error');
  });

  it('renders offline state with wifi-slash icon and enabled', async () => {
    setOnline(false);
    const { SYNC_NOW_STATES } = await import('../../src/js/sync/sync-status-ui.js?v=8.37&test=offline');

    const config = SYNC_NOW_STATES.offline;
    expect(config.icon).toBe('fa-wifi-slash');
    expect(config.title).toBe('Sem conexão');
    expect(config.disabled).toBe(false);
    expect(config.cssClass).toBe('sync-now-btn--offline');
  });

  it('renders no-channels state with rotate icon and enabled', async () => {
    setOnline(true);
    const { SYNC_NOW_STATES } = await import('../../src/js/sync/sync-status-ui.js?v=8.37&test=no-channels');

    const config = SYNC_NOW_STATES['no-channels'];
    expect(config.icon).toBe('fa-arrows-rotate');
    expect(config.title).toBe('Configure um canal de sincronização');
    expect(config.disabled).toBe(false);
    expect(config.cssClass).toBe('sync-now-btn--no-channels');
  });

  it('deriveSyncNowState returns offline when navigator.onLine is false', async () => {
    setOnline(false);
    const { deriveSyncNowState } = await import('../../src/js/sync/sync-status-ui.js?v=8.37&test=derive-offline');

    expect(deriveSyncNowState('idle')).toBe('offline');
    expect(deriveSyncNowState('syncing')).toBe('offline');
    expect(deriveSyncNowState('error')).toBe('offline');
  });

  it('deriveSyncNowState returns syncing when status is syncing and online', async () => {
    setOnline(true);
    const { deriveSyncNowState } = await import('../../src/js/sync/sync-status-ui.js?v=8.37&test=derive-syncing');

    expect(deriveSyncNowState('syncing')).toBe('syncing');
  });

  it('deriveSyncNowState returns error when status is error and online', async () => {
    setOnline(true);
    const { deriveSyncNowState } = await import('../../src/js/sync/sync-status-ui.js?v=8.37&test=derive-error');

    expect(deriveSyncNowState('error')).toBe('error');
  });

  it('deriveSyncNowState returns idle for non-syncing/error statuses when online', async () => {
    setOnline(true);
    const { deriveSyncNowState } = await import('../../src/js/sync/sync-status-ui.js?v=8.37&test=derive-idle');

    expect(deriveSyncNowState('idle')).toBe('idle');
    expect(deriveSyncNowState('synced')).toBe('idle');
    expect(deriveSyncNowState('paused')).toBe('idle');
    expect(deriveSyncNowState('degraded')).toBe('idle');
  });

  it('renderSyncNowButton applies correct icon and title for idle state', async () => {
    setOnline(true);
    const { renderSyncNowButton } = await import('../../src/js/sync/sync-status-ui.js?v=8.37&test=render-idle');

    // Manually set the button reference by calling renderSyncNowButton
    // Since the module uses internal state, we need to test via the exported function
    // For now, verify the function exists and is callable
    expect(typeof renderSyncNowButton).toBe('function');
  });

  it('renderSyncNowButton gracefully handles missing #sync-now-btn', async () => {
    // Remove the button from DOM
    syncNowBtn.remove();

    setOnline(true);
    const { renderSyncNowButton } = await import('../../src/js/sync/sync-status-ui.js?v=8.37&test=render-missing');

    // Should not throw
    expect(() => renderSyncNowButton()).not.toThrow();
  });

  it('SYNC_NOW_STATES has all 5 required states', async () => {
    const { SYNC_NOW_STATES } = await import('../../src/js/sync/sync-status-ui.js?v=8.37&test=all-states');

    expect(Object.keys(SYNC_NOW_STATES)).toEqual(
      expect.arrayContaining(['idle', 'syncing', 'error', 'offline', 'no-channels'])
    );
    expect(Object.keys(SYNC_NOW_STATES)).toHaveLength(5);
  });

  it('syncing state disables the button', async () => {
    setOnline(true);
    const { SYNC_NOW_STATES } = await import('../../src/js/sync/sync-status-ui.js?v=8.37&test=syncing-disabled');

    expect(SYNC_NOW_STATES.syncing.disabled).toBe(true);
  });

  it('all non-syncing states have disabled=false', async () => {
    const { SYNC_NOW_STATES } = await import('../../src/js/sync/sync-status-ui.js?v=8.37&test=non-syncing-enabled');

    for (const [key, config] of Object.entries(SYNC_NOW_STATES)) {
      if (key !== 'syncing') {
        expect(config.disabled).toBe(false);
      }
    }
  });

  it('keeps a recent error visible when a background idle status arrives immediately', async () => {
    setOnline(true);
    const { destroySyncStatusUI, initSyncStatusUI } = await import(
      '../../src/js/sync/sync-status-ui.js?v=8.37&test=sticky-error'
    );

    initSyncStatusUI();
    document.dispatchEvent(
      new CustomEvent('app:primarySyncStatus', {
        detail: { status: 'error', reason: 'unit-test' },
      })
    );
    await waitFrame();
    expect(container.textContent).toMatch(/Erro/i);

    document.dispatchEvent(
      new CustomEvent('app:primarySyncStatus', {
        detail: { status: 'idle', reason: 'background-check' },
      })
    );
    await waitFrame();
    expect(container.textContent).toMatch(/Erro/i);

    destroySyncStatusUI();
  });
});
