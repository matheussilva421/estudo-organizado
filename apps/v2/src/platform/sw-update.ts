export type ServiceWorkerState = 'UNSUPPORTED' | 'REGISTERED' | 'IDLE';

export type UpdateSafety = {
  hasActiveSession: boolean;
  hasUnsavedForm: boolean;
  hasPendingRecovery: boolean;
  databaseCompatible: boolean;
  otherTabsReady: boolean;
};

export type UpdateDecision = {
  allowed: boolean;
  reason?: string;
};

export type SafeUpdateResult = 'APPLIED' | 'DEFERRED' | 'INCOMPATIBLE' | 'FAILED';

export function canApplyV2Update(safety: UpdateSafety): UpdateDecision {
  if (!safety || typeof safety !== 'object') {
    return { allowed: false, reason: 'INVALID_SAFETY' };
  }
  if (!safety.databaseCompatible) {
    return { allowed: false, reason: 'INCOMPATIBLE_SCHEMA' };
  }
  if (safety.hasActiveSession) {
    return { allowed: false, reason: 'ACTIVE_SESSION' };
  }
  if (safety.hasUnsavedForm) {
    return { allowed: false, reason: 'UNSAVED_FORM' };
  }
  if (safety.hasPendingRecovery) {
    return { allowed: false, reason: 'PENDING_RECOVERY' };
  }
  if (!safety.otherTabsReady) {
    return { allowed: false, reason: 'OTHER_TABS_NOT_READY' };
  }
  return { allowed: true };
}

export async function requestSafeUpdate(
  registration: ServiceWorkerRegistration,
  safety: UpdateSafety,
): Promise<SafeUpdateResult> {
  const decision = canApplyV2Update(safety);
  if (!decision.allowed) {
    return decision.reason === 'INCOMPATIBLE_SCHEMA' ? 'INCOMPATIBLE' : 'DEFERRED';
  }
  try {
    await registration.update();
  } catch {
    return 'FAILED';
  }
  // A waiting worker means assets are ready, but reload remains a separate
  // safe action; this function never forces skipWaiting or location.reload.
  if (registration.waiting) return 'DEFERRED';
  return 'APPLIED';
}

export async function applyWaitingUpdate(
  registration: ServiceWorkerRegistration,
  safety: UpdateSafety,
): Promise<SafeUpdateResult> {
  const decision = canApplyV2Update(safety);
  if (!decision.allowed) {
    return decision.reason === 'INCOMPATIBLE_SCHEMA' ? 'INCOMPATIBLE' : 'DEFERRED';
  }
  if (!registration.waiting) {
    try {
      await registration.update();
    } catch {
      return 'FAILED';
    }
  }
  if (!registration.waiting) return 'APPLIED';
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  return 'APPLIED';
}

export async function registerV2ServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

export async function updateServiceWorkerWithoutReload(
  registration: ServiceWorkerRegistration,
): Promise<ServiceWorkerState> {
  await registration.update();
  if (registration.waiting) return 'IDLE';
  if (registration.active) return 'REGISTERED';
  return 'IDLE';
}
