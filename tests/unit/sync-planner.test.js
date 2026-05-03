import { describe, expect, it } from 'vitest';

import { planNextSyncAction, ACTIONS } from '../../src/js/sync/sync-planner.js?v=8.33';

const BASE_INPUT = {
  firestoreConfigured: true,
  signedIn: true,
  enabled: true,
  mode: 'primary',
  conflict: null,
  offline: false,
  reason: 'local-save',
  backoffActive: false,
  pendingLocal: false,
};

describe('sync/sync-planner.js', () => {
  it('returns noop when Firestore is not configured', () => {
    const plan = planNextSyncAction({ ...BASE_INPUT, firestoreConfigured: false });
    expect(plan.action).toBe(ACTIONS.NOOP);
    expect(plan.canRunNow).toBe(false);
    expect(plan.requiresNetwork).toBe(false);
  });

  it('returns noop when Firestore is not enabled', () => {
    const plan = planNextSyncAction({ ...BASE_INPUT, enabled: false });
    expect(plan.action).toBe(ACTIONS.NOOP);
    expect(plan.canRunNow).toBe(false);
  });

  it('returns noop when user is not signed in', () => {
    const plan = planNextSyncAction({ ...BASE_INPUT, signedIn: false });
    expect(plan.action).toBe(ACTIONS.NOOP);
    expect(plan.canRunNow).toBe(false);
  });

  it('returns offline when device is offline', () => {
    const plan = planNextSyncAction({ ...BASE_INPUT, offline: true });
    expect(plan.action).toBe(ACTIONS.OFFLINE);
    expect(plan.canRunNow).toBe(false);
    expect(plan.requiresNetwork).toBe(true);
  });

  it('returns blocked_conflict when conflict is active', () => {
    const plan = planNextSyncAction({ ...BASE_INPUT, conflict: { items: [] } });
    expect(plan.action).toBe(ACTIONS.BLOCKED_CONFLICT);
    expect(plan.canRunNow).toBe(false);
    expect(plan.userActionRequired).toBe(true);
  });

  it('returns push_local for local-save reason', () => {
    const plan = planNextSyncAction({ ...BASE_INPUT, reason: 'local-save' });
    expect(plan.action).toBe(ACTIONS.PUSH_LOCAL);
    expect(plan.canRunNow).toBe(true);
    expect(plan.requiresNetwork).toBe(true);
    expect(plan.explanation).toContain('local-save');
  });

  it('returns wait_backoff when backoff is active', () => {
    const plan = planNextSyncAction({
      ...BASE_INPUT,
      backoffActive: true,
      backoffRemainingMs: 5000,
    });
    expect(plan.action).toBe(ACTIONS.WAIT_BACKOFF);
    expect(plan.canRunNow).toBe(false);
    expect(plan.delayMs).toBe(5000);
  });

  it('returns check_remote_then_pull for foreground without pending local', () => {
    const plan = planNextSyncAction({ ...BASE_INPUT, reason: 'foreground' });
    expect(plan.action).toBe(ACTIONS.CHECK_REMOTE_THEN_PULL);
    expect(plan.canRunNow).toBe(true);
  });

  it('returns push_local for reconnect with pending local data', () => {
    const plan = planNextSyncAction({ ...BASE_INPUT, reason: 'reconnect', pendingLocal: true });
    expect(plan.action).toBe(ACTIONS.PUSH_LOCAL);
    expect(plan.canRunNow).toBe(true);
  });

  it('returns check_remote_then_pull for reconnect without pending local', () => {
    const plan = planNextSyncAction({ ...BASE_INPUT, reason: 'reconnect', pendingLocal: false });
    expect(plan.action).toBe(ACTIONS.CHECK_REMOTE_THEN_PULL);
  });

  it('returns check_remote_then_pull for signed-in reason', () => {
    const plan = planNextSyncAction({ ...BASE_INPUT, reason: 'signed-in' });
    expect(plan.action).toBe(ACTIONS.CHECK_REMOTE_THEN_PULL);
  });

  it('returns check_remote_then_pull for enabled reason', () => {
    const plan = planNextSyncAction({ ...BASE_INPUT, reason: 'enabled' });
    expect(plan.action).toBe(ACTIONS.CHECK_REMOTE_THEN_PULL);
  });

  it('returns check_remote_then_pull for requested reason', () => {
    const plan = planNextSyncAction({ ...BASE_INPUT, reason: 'requested' });
    expect(plan.action).toBe(ACTIONS.CHECK_REMOTE_THEN_PULL);
  });

  it('returns manual_force_push for manual-force-push reason', () => {
    const plan = planNextSyncAction({ ...BASE_INPUT, reason: 'manual-force-push' });
    expect(plan.action).toBe(ACTIONS.MANUAL_FORCE_PUSH);
    expect(plan.canRunNow).toBe(true);
  });

  it('returns manual_restore_preview for manual-restore-preview reason', () => {
    const plan = planNextSyncAction({ ...BASE_INPUT, reason: 'manual-restore-preview' });
    expect(plan.action).toBe(ACTIONS.MANUAL_RESTORE_PREVIEW);
    expect(plan.canRunNow).toBe(true);
  });

  it('returns push_local as default for unknown reasons', () => {
    const plan = planNextSyncAction({ ...BASE_INPUT, reason: 'unknown-trigger' });
    expect(plan.action).toBe(ACTIONS.PUSH_LOCAL);
  });

  it('always includes explanation', () => {
    const cases = [
      { ...BASE_INPUT, firestoreConfigured: false },
      { ...BASE_INPUT, signedIn: false },
      { ...BASE_INPUT, offline: true },
      { ...BASE_INPUT, conflict: { items: [] } },
      { ...BASE_INPUT, reason: 'local-save' },
      { ...BASE_INPUT, reason: 'foreground' },
    ];
    for (const input of cases) {
      const plan = planNextSyncAction(input);
      expect(plan.explanation).toBeTruthy();
      expect(plan.reason).toBeDefined();
    }
  });

  it('prioritizes conflict over offline', () => {
    const plan = planNextSyncAction({ ...BASE_INPUT, conflict: { items: [] }, offline: true });
    expect(plan.action).toBe(ACTIONS.BLOCKED_CONFLICT);
  });

  it('prioritizes offline over backoff', () => {
    const plan = planNextSyncAction({ ...BASE_INPUT, offline: true, backoffActive: true });
    expect(plan.action).toBe(ACTIONS.OFFLINE);
  });

  it('prioritizes backoff over push_local', () => {
    const plan = planNextSyncAction({ ...BASE_INPUT, reason: 'local-save', backoffActive: true });
    expect(plan.action).toBe(ACTIONS.WAIT_BACKOFF);
  });
});
