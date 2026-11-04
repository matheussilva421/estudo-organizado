import type { GoogleIdentity } from './google-auth-types';
import type {
  DeliveryConsentProof,
  ProfileRecord,
  ProfileRepository,
} from './profile-service';
import { previewLink, type LinkPreview } from './sync-policy';
import type { CommitResult } from './content-commands';

export type RemoteLibrarySummary = {
  remoteLibraryId: string;
  remoteCount: number;
  conflictCount?: number;
};

export type LinkReview = {
  profileId: string;
  uid: string;
  email: string | null;
  remoteLibraryId: string;
  remoteCount: number;
  conflictCount: number;
  issuedAt: number;
  expiresAt: number;
  generation: string;
  preview: LinkPreview;
  requiresConsent: true;
  destructiveMerge: false;
};

export type GoogleLinkErrorCode =
  | 'INVALID_IDENTITY'
  | 'REMOTE_LIBRARY_REQUIRED'
  | 'PROFILE_MISMATCH'
  | 'CONSENT_REQUIRED'
  | 'STALE_PREVIEW'
  | 'PREVIEW_EXPIRED';

export class GoogleLinkError extends Error {
  readonly code: GoogleLinkErrorCode;

  constructor(code: GoogleLinkErrorCode, message: string) {
    super(message);
    this.name = 'GoogleLinkError';
    this.code = code;
  }
}

export type GoogleLinkServiceOptions = {
  profiles: ProfileRepository;
  now?: () => number;
  previewTtlMs?: number;
  generation?: () => string;
};

function defaultGeneration(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  return `gen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function requireIdentity(identity: GoogleIdentity): GoogleIdentity {
  const uid = typeof identity.uid === 'string' ? identity.uid.trim() : '';
  if (!uid) throw new GoogleLinkError('INVALID_IDENTITY', 'Google uid is required');
  return { uid, email: typeof identity.email === 'string' ? identity.email : null };
}

function requireRemote(remote: RemoteLibrarySummary): RemoteLibrarySummary {
  const remoteLibraryId =
    typeof remote.remoteLibraryId === 'string' ? remote.remoteLibraryId.trim() : '';
  if (!remoteLibraryId) {
    throw new GoogleLinkError('REMOTE_LIBRARY_REQUIRED', 'remoteLibraryId is required');
  }
  if (!Number.isInteger(remote.remoteCount) || remote.remoteCount < 0) {
    throw new GoogleLinkError('REMOTE_LIBRARY_REQUIRED', 'remoteCount must be a non-negative integer');
  }
  const conflictCount = remote.conflictCount ?? 0;
  if (!Number.isInteger(conflictCount) || conflictCount < 0) {
    throw new GoogleLinkError('REMOTE_LIBRARY_REQUIRED', 'conflictCount must be a non-negative integer');
  }
  return { remoteLibraryId, remoteCount: remote.remoteCount, conflictCount };
}

/**
 * Explicit, preview-first binding between a local profile, a Google uid and a
 * remote library. Nothing is merged until `confirm` receives consent for the
 * current preview. Logout invalidates the generation so a late response from
 * the previous uid cannot be applied to the new account.
 */
export class GoogleLinkService {
  private readonly profiles: ProfileRepository;
  private readonly now: () => number;
  private readonly previewTtlMs: number;
  private readonly generation: () => string;
  private readonly pending = new Map<string, LinkReview>();
  private readonly generations = new Map<string, string>();

  constructor(options: GoogleLinkServiceOptions) {
    this.profiles = options.profiles;
    this.now = options.now ?? (() => Date.now());
    this.previewTtlMs = options.previewTtlMs ?? 5 * 60_000;
    this.generation = options.generation ?? defaultGeneration;
  }

  async previewGoogleLink(
    profileId: string,
    identity: GoogleIdentity,
    remote: RemoteLibrarySummary,
  ): Promise<LinkReview> {
    const normalized = requireIdentity(identity);
    const summary = requireRemote(remote);
    const profile = await this.profiles.getProfile(profileId);

    if (profile.uid && profile.uid !== normalized.uid) {
      throw new GoogleLinkError('PROFILE_MISMATCH', 'profile is already bound to another uid');
    }
    if (profile.remoteLibraryId && profile.remoteLibraryId !== summary.remoteLibraryId) {
      throw new GoogleLinkError('PROFILE_MISMATCH', 'profile is already bound to another library');
    }

    const issuedAt = this.now();
    const preview = previewLink(
      profileId,
      normalized.uid,
      { remoteCount: summary.remoteCount },
      issuedAt,
      this.previewTtlMs,
    );
    const token = this.generation();
    const review: LinkReview = {
      profileId,
      uid: normalized.uid,
      email: normalized.email,
      remoteLibraryId: summary.remoteLibraryId,
      remoteCount: summary.remoteCount,
      conflictCount: summary.conflictCount ?? 0,
      issuedAt,
      expiresAt: preview.expiresAt,
      generation: token,
      preview,
      requiresConsent: true,
      destructiveMerge: false,
    };
    this.pending.set(profileId, review);
    this.generations.set(profileId, token);
    return review;
  }

  isCurrentReview(review: LinkReview): boolean {
    const pending = this.pending.get(review.profileId);
    return (
      pending !== undefined &&
      pending.generation === review.generation &&
      pending.preview.previewId === review.preview.previewId &&
      this.generations.get(review.profileId) === review.generation
    );
  }

  async confirmGoogleLink(review: LinkReview, consent: true): Promise<ProfileRecord> {
    if (consent !== true) {
      throw new GoogleLinkError('CONSENT_REQUIRED', 'explicit consent is required');
    }
    if (!this.isCurrentReview(review)) {
      throw new GoogleLinkError('STALE_PREVIEW', 'preview is no longer current');
    }
    if (this.now() > review.expiresAt) {
      this.pending.delete(review.profileId);
      throw new GoogleLinkError('PREVIEW_EXPIRED', 'preview expired before consent');
    }

    const proof: DeliveryConsentProof = {
      profileId: review.profileId,
      uid: review.uid,
      remoteLibraryId: review.remoteLibraryId,
      consent: true,
      preview: review.preview,
    };
    const result: CommitResult<{ adopted: number }> = await this.profiles.adoptLocalOperations(
      review.profileId,
      review.uid,
      review.remoteLibraryId,
      proof,
    );
    if (result.kind !== 'LOCAL_COMMITTED') {
      const code = result.kind === 'INVALID' ? result.code : 'PROFILE_MISMATCH';
      throw new GoogleLinkError('PROFILE_MISMATCH', `link was not adopted: ${code}`);
    }
    this.pending.delete(review.profileId);
    return this.profiles.getProfile(review.profileId);
  }

  /** Logout/UID switch: invalidate the preview generation and clear authority. */
  async invalidateRemoteBinding(profileId: string, previousUid: string): Promise<void> {
    const profile = await this.profiles.getProfile(profileId);
    if (profile.uid && profile.uid !== previousUid) {
      throw new GoogleLinkError('PROFILE_MISMATCH', 'profile is bound to another uid');
    }
    this.pending.delete(profileId);
    this.generations.delete(profileId);
    const result = await this.profiles.logoutRemote(
      profileId,
      `logout:${profileId}:${previousUid}:${this.generation()}`,
    );
    if (result.kind !== 'LOCAL_COMMITTED') {
      throw new GoogleLinkError('PROFILE_MISMATCH', 'remote authority could not be cleared');
    }
  }
}
