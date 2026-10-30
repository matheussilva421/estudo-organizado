import { describe, expect, it } from 'vitest';
import {
  canApplyV2Update,
  requestSafeUpdate,
  type UpdateSafety,
} from '../../src/platform/sw-update';

const safe: UpdateSafety = {
  hasActiveSession: false,
  hasUnsavedForm: false,
  hasPendingRecovery: false,
  databaseCompatible: true,
  otherTabsReady: true,
};

function registration(update: () => Promise<void>, waiting: object | null = null) {
  return {
    update,
    waiting,
    active: {},
  } as unknown as ServiceWorkerRegistration;
}

describe('F4 PWA update safety', () => {
  it('active_session_defers_reload', () => {
    expect(canApplyV2Update({ ...safe, hasActiveSession: true })).toEqual({
      allowed: false,
      reason: 'ACTIVE_SESSION',
    });
  });

  it('unsaved_form_defers_update', () => {
    expect(canApplyV2Update({ ...safe, hasUnsavedForm: true })).toEqual({
      allowed: false,
      reason: 'UNSAVED_FORM',
    });
  });

  it('incompatible_schema_disables_unsafe_writes', () => {
    expect(canApplyV2Update({ ...safe, databaseCompatible: false })).toEqual({
      allowed: false,
      reason: 'INCOMPATIBLE_SCHEMA',
    });
  });

  it('other_tab_not_ready_defers_update', () => {
    expect(canApplyV2Update({ ...safe, otherTabsReady: false })).toEqual({
      allowed: false,
      reason: 'OTHER_TABS_NOT_READY',
    });
  });

  it('safe_idle_update_can_proceed', async () => {
    expect(canApplyV2Update(safe)).toEqual({ allowed: true });
    expect(await requestSafeUpdate(registration(async () => undefined), safe)).toBe(
      'APPLIED',
    );
  });

  it('sw_fetch_failure_does_not_end_session', async () => {
    const result = await requestSafeUpdate(
      registration(async () => {
        throw new Error('offline');
      }),
      safe,
    );
    expect(result).toBe('FAILED');
  });

  it('waiting_worker_defers_until_safe_reload', async () => {
    expect(
      await requestSafeUpdate(registration(async () => undefined, {}), safe),
    ).toBe('DEFERRED');
  });
});
