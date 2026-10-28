import type { ProfileBinding, SyncHealth, SyncState } from './sync-types';

export type { ProfileBinding } from './sync-types';

export type SyncEvent =
  | { type: 'START_LINK' }
  | { type: 'CONSENT_LINK'; uid: string; consent: boolean; preview: LinkPreview }
  | { type: 'ENABLE_AUTO' }
  | { type: 'DISABLE_AUTO' }
  | { type: 'AUTH_EXPIRED' }
  | { type: 'QUOTA_EXHAUSTED' }
  | { type: 'RECOVERY_REQUIRED' }
  | { type: 'LOGOUT' };

export type LinkPreview = {
  profileId: string;
  uid: string;
  remoteCount: number;
  previewId: string;
  issuedAt: number;
  expiresAt: number;
  requiresConsent: true;
  destructiveMerge: false;
};

function previewToken(preview: Omit<LinkPreview, 'previewId'>): string {
  return `link:${preview.profileId}:${preview.uid}:${preview.remoteCount}:${preview.issuedAt}`;
}

function isValidPreview(preview: LinkPreview, profileId: string, uid: string, now: number): boolean {
  if (
    preview.profileId !== profileId ||
    preview.uid !== uid ||
    preview.requiresConsent !== true ||
    preview.destructiveMerge !== false
  ) {
    return false;
  }
  if (
    !Number.isInteger(preview.issuedAt) ||
    !Number.isInteger(preview.expiresAt) ||
    preview.issuedAt > now ||
    preview.expiresAt < now
  ) {
    return false;
  }
  return preview.previewId === previewToken(preview);
}

function withState(binding: ProfileBinding, state: SyncState): ProfileBinding {
  return { ...binding, state, syncEnabled: false };
}

export function transitionSync(
  binding: ProfileBinding,
  event: SyncEvent,
  now = Date.now(),
): ProfileBinding {
  switch (event.type) {
    case 'START_LINK':
      if (binding.state === 'READY' || binding.state === 'SYNCING') return binding;
      return withState(binding, 'LINKING');
    case 'CONSENT_LINK': {
      if (binding.state !== 'LINKING' || !event.consent) return binding;
      const uid = event.uid.trim();
      if (!uid) return binding;
      if (!isValidPreview(event.preview, binding.profileId, uid, now)) return binding;
      if (binding.uid && binding.uid !== uid) return binding;
      return { ...binding, uid, state: 'READY', syncEnabled: true };
    }
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
  uid: string,
  remoteSummary: { remoteCount: number },
  now = Date.now(),
  ttlMs = 5 * 60_000,
): LinkPreview {
  if (!profileId.trim()) throw new Error('PROFILE_REQUIRED');
  if (!uid.trim()) throw new Error('UID_REQUIRED');
  if (!Number.isInteger(now) || !Number.isInteger(ttlMs) || ttlMs <= 0) {
    throw new Error('INVALID_PREVIEW_CLOCK');
  }
  const base = {
    profileId,
    uid: uid.trim(),
    remoteCount: Math.max(0, remoteSummary.remoteCount),
    issuedAt: now,
    expiresAt: now + ttlMs,
    requiresConsent: true as const,
    destructiveMerge: false as const,
  };
  return { ...base, previewId: previewToken(base) };
}

export function assertProfileMatches(
  binding: ProfileBinding,
  profileId: string,
  uid?: string,
): void {
  if (binding.profileId !== profileId) throw new Error('PROFILE_MISMATCH');
  if (uid !== undefined && binding.uid !== uid) throw new Error('PROFILE_MISMATCH');
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
    converged:
      input.localCommitted && input.remoteCommitted && verified && Math.max(0, input.pendingCount) === 0,
    pendingCount: Math.max(0, input.pendingCount),
    mode: input.mode,
    ...(verified ? { lastVerifiedCursor: input.verifiedCursor ?? undefined } : {}),
  };
}
