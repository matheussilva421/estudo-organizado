import type { ProfileBinding, SyncHealth, SyncState } from './sync-types';

export type { ProfileBinding } from './sync-types';

export type SyncEvent =
  | { type: 'START_LINK' }
  | { type: 'CONSENT_LINK'; uid: string; consent: boolean }
  | { type: 'ENABLE_AUTO' }
  | { type: 'DISABLE_AUTO' }
  | { type: 'AUTH_EXPIRED' }
  | { type: 'QUOTA_EXHAUSTED' }
  | { type: 'RECOVERY_REQUIRED' }
  | { type: 'LOGOUT' };

export type LinkPreview = {
  profileId: string;
  remoteCount: number;
  requiresConsent: true;
  destructiveMerge: false;
};

function withState(binding: ProfileBinding, state: SyncState): ProfileBinding {
  return { ...binding, state, syncEnabled: false };
}

export function transitionSync(binding: ProfileBinding, event: SyncEvent): ProfileBinding {
  switch (event.type) {
    case 'START_LINK':
      if (binding.state === 'READY' || binding.state === 'SYNCING') return binding;
      return withState(binding, 'LINKING');
    case 'CONSENT_LINK':
      if (binding.state !== 'LINKING' || !event.consent) return binding;
      if (!event.uid.trim()) return binding;
      return { ...binding, uid: event.uid.trim(), state: 'READY', syncEnabled: true };
    case 'ENABLE_AUTO':
      if (binding.state !== 'READY' || !binding.uid) return binding;
      return { ...binding, syncEnabled: true };
    case 'DISABLE_AUTO':
      if (binding.state !== 'READY') return binding;
      return { ...binding, syncEnabled: false };
    case 'AUTH_EXPIRED':
      return withState(binding, 'PAUSED_AUTH');
    case 'QUOTA_EXHAUSTED':
      return withState(binding, 'PAUSED_QUOTA');
    case 'RECOVERY_REQUIRED':
      return withState(binding, 'RECOVERY_REQUIRED');
    case 'LOGOUT':
      return { profileId: binding.profileId, uid: null, syncEnabled: false, state: 'LOCAL_ONLY' };
  }
}

export function previewLink(
  profileId: string,
  remoteSummary: { remoteCount: number },
): LinkPreview {
  if (!profileId.trim()) throw new Error('PROFILE_REQUIRED');
  return {
    profileId,
    remoteCount: Math.max(0, remoteSummary.remoteCount),
    requiresConsent: true,
    destructiveMerge: false,
  };
}

export function assertProfileMatches(binding: ProfileBinding, profileId: string): void {
  if (binding.profileId !== profileId) throw new Error('PROFILE_MISMATCH');
}

export type SyncHealthInput = {
  localCommitted: boolean;
  remoteCommitted: boolean;
  verifiedCursor: string | null;
  pendingCount: number;
  mode: string;
};

export function assessSyncHealth(input: SyncHealthInput): SyncHealth {
  const verified = typeof input.verifiedCursor === 'string' && input.verifiedCursor.trim().length > 0;
  return {
    localCommitted: input.localCommitted,
    remoteCommitted: input.remoteCommitted,
    converged: input.localCommitted && input.remoteCommitted && verified,
    pendingCount: Math.max(0, input.pendingCount),
    mode: input.mode,
    ...(verified ? { lastVerifiedCursor: input.verifiedCursor ?? undefined } : {}),
  };
}
