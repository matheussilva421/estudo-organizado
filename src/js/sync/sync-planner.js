const REASONS_ALLOWING_REMOTE_READ = new Set([
  'auto',
  'foreground',
  'reconnect',
  'signed-in',
  'enabled',
  'requested',
  'manual',
]);

const ACTIONS = {
  NOOP: 'noop',
  OFFLINE: 'offline',
  BLOCKED_CONFLICT: 'blocked_conflict',
  WAIT_BACKOFF: 'wait_backoff',
  PUSH_LOCAL: 'push_local',
  CHECK_REMOTE_THEN_PULL: 'check_remote_then_pull',
  REPAIR_PENDING_STATE: 'repair_pending_state',
  MANUAL_FORCE_PUSH: 'manual_force_push',
  MANUAL_RESTORE_PREVIEW: 'manual_restore_preview',
};

export { ACTIONS };

export function planNextSyncAction(input = {}) {
  const {
    firestoreConfigured = false,
    signedIn = false,
    enabled = false,
    mode = 'off',
    conflict = null,
    offline = false,
    reason = 'unknown',
    backoffActive = false,
    pendingLocal = false,
  } = input;

  if (!firestoreConfigured || !enabled) {
    return {
      action: ACTIONS.NOOP,
      reason,
      canRunNow: false,
      delayMs: 0,
      requiresNetwork: false,
      userActionRequired: false,
      explanation: 'Firestore not configured or not enabled',
    };
  }

  if (!signedIn) {
    return {
      action: ACTIONS.NOOP,
      reason,
      canRunNow: false,
      delayMs: 0,
      requiresNetwork: false,
      userActionRequired: false,
      explanation: 'User not signed in',
    };
  }

  if (conflict) {
    return {
      action: ACTIONS.BLOCKED_CONFLICT,
      reason,
      canRunNow: false,
      delayMs: 0,
      requiresNetwork: false,
      userActionRequired: true,
      explanation: 'Conflict detected, user action required',
    };
  }

  if (offline) {
    return {
      action: ACTIONS.OFFLINE,
      reason,
      canRunNow: false,
      delayMs: 0,
      requiresNetwork: true,
      userActionRequired: false,
      explanation: 'Device is offline',
    };
  }

  if (backoffActive) {
    return {
      action: ACTIONS.WAIT_BACKOFF,
      reason,
      canRunNow: false,
      delayMs: input.backoffRemainingMs || 0,
      requiresNetwork: true,
      userActionRequired: false,
      explanation: 'Backoff active, waiting before retry',
    };
  }

  if (reason === 'manual-force-push') {
    return {
      action: ACTIONS.MANUAL_FORCE_PUSH,
      reason,
      canRunNow: true,
      delayMs: 0,
      requiresNetwork: true,
      userActionRequired: false,
      explanation: 'Manual force push requested',
    };
  }

  if (reason === 'manual-restore-preview') {
    return {
      action: ACTIONS.MANUAL_RESTORE_PREVIEW,
      reason,
      canRunNow: true,
      delayMs: 0,
      requiresNetwork: true,
      userActionRequired: false,
      explanation: 'Manual restore preview requested',
    };
  }

  if (reason === 'local-save') {
    return {
      action: ACTIONS.PUSH_LOCAL,
      reason,
      canRunNow: true,
      delayMs: 0,
      requiresNetwork: true,
      userActionRequired: false,
      explanation: 'local-save never checks remote before pushing queued local changes',
    };
  }

  if (mode === 'primary' && pendingLocal) {
    return {
      action: ACTIONS.PUSH_LOCAL,
      reason,
      canRunNow: true,
      delayMs: 0,
      requiresNetwork: true,
      userActionRequired: false,
      explanation: 'Local data pending, push before checking remote',
    };
  }

  if (REASONS_ALLOWING_REMOTE_READ.has(reason)) {
    return {
      action: ACTIONS.CHECK_REMOTE_THEN_PULL,
      reason,
      canRunNow: true,
      delayMs: 0,
      requiresNetwork: true,
      userActionRequired: false,
      explanation: `${reason}: check remote for newer data before pushing`,
    };
  }

  return {
    action: ACTIONS.PUSH_LOCAL,
    reason,
    canRunNow: true,
    delayMs: 0,
    requiresNetwork: true,
    userActionRequired: false,
    explanation: 'Default: push local changes',
  };
}
