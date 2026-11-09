// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyWaitingUpdate,
  canApplyV2Update,
  type UpdateSafety,
} from '../../src/platform/sw-update';

const safe: UpdateSafety = {
  hasActiveSession: false,
  hasUnsavedForm: false,
  hasPendingRecovery: false,
  databaseCompatible: true,
  otherTabsReady: true,
};

describe('F7 PWA safe update', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it('f7_active_timer_blocks_sw_update', () => {
    expect(canApplyV2Update({ ...safe, hasActiveSession: true })).toEqual({
      allowed: false,
      reason: 'ACTIVE_SESSION',
    });
  });

  it('f7_unsaved_form_in_other_tab_blocks_update', () => {
    expect(canApplyV2Update({ ...safe, hasUnsavedForm: true })).toEqual({
      allowed: false,
      reason: 'UNSAVED_FORM',
    });
    expect(canApplyV2Update({ ...safe, otherTabsReady: false })).toEqual({
      allowed: false,
      reason: 'OTHER_TABS_NOT_READY',
    });
  });

  it('f7_pending_restore_blocks_update', () => {
    expect(canApplyV2Update({ ...safe, hasPendingRecovery: true })).toEqual({
      allowed: false,
      reason: 'PENDING_RECOVERY',
    });
  });

  it('f7_old_and_new_client_never_mix_incompatible_assets', () => {
    expect(canApplyV2Update({ ...safe, databaseCompatible: false })).toEqual({
      allowed: false,
      reason: 'INCOMPATIBLE_SCHEMA',
    });
    expect(canApplyV2Update(safe)).toEqual({ allowed: true });
  });

  it('f7_sw_cache_does_not_include_v1', () => {
    const source = readFileSync(resolve('public/sw.js'), 'utf8');
    expect(source).not.toContain('app-de-estudos-14564');
    expect(source).not.toContain('estudo-organizado.matheussilva421.workers.dev');
    expect(source).not.toContain('/js/');
    expect(source).toContain("estudo-organizado-v2-shell");
    expect(source).toContain('__PRECACHE__');
  });

  it('f7_update_without_a_waiting_worker_is_deferred', async () => {
    const registration = {
      waiting: null,
      update: async () => undefined,
    } as unknown as ServiceWorkerRegistration;
    await expect(applyWaitingUpdate(registration, safe)).resolves.toBe('DEFERRED');
  });

  it('f7_update_reports_applied_only_after_controllerchange', async () => {
    vi.stubGlobal('navigator', {
      serviceWorker: {
        addEventListener: (event: string, listener: () => void) => {
          if (event === 'controllerchange') setTimeout(listener, 0);
        },
      },
    });
    const postMessage = vi.fn();
    const registration = {
      waiting: { postMessage },
      update: async () => undefined,
      active: {},
    } as unknown as ServiceWorkerRegistration;
    await expect(applyWaitingUpdate(registration, safe)).resolves.toBe('APPLIED');
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });
});
