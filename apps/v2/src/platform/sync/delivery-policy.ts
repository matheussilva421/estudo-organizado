import type { OutboxOperation } from '../../application/sync-types';
import type {
  DeliveryConsentProof,
  ProfileRecord,
} from '../../application/profile-service';
import { isValidPreview, type LinkPreview } from '../../application/sync-policy';
import { ContentValidationError, type Id } from '../../domain/edital';

/**
 * Delivery metadata of one outbox row. It is assigned only after explicit
 * consent and never rewrites the immutable command or its `operationId`.
 */
export type DeliveryBinding = {
  operationId: Id;
  profileId: Id;
  deliveryUid: string | null;
  remoteLibraryId: string | null;
  attempts: number;
  nextRetryAt: number | null;
};

export { type DeliveryConsentProof };

const DELIVERABLE_STATES = new Set(['READY', 'SYNCING', 'PENDING_OFFLINE']);

const PLANNING_ENTITY_TYPES = new Set(['planning-scenario', 'plan-block']);

/**
 * A local operation is deliverable only when profile, binding and operation
 * agree on the same account/library. Anything else stays local and visible.
 */
export function canDeliver(
  operation: OutboxOperation,
  binding: DeliveryBinding,
  profile: ProfileRecord,
): boolean {
  if (operation.profileId !== profile.profileId) return false;
  if (binding.profileId !== profile.profileId) return false;
  if (operation.status !== 'PENDING') return false;

  // Fail closed: F3 planning envelopes are local intents until F7 homologates
  // a real remote contract. Their presence never enables delivery.
  if (operation.deliveryMode === 'BLOCKED') return false;
  if (PLANNING_ENTITY_TYPES.has(operation.entityType)) return false;

  const uid = profile.uid;
  if (!uid || !uid.trim()) return false;
  if (binding.deliveryUid !== uid) return false;
  if (operation.deliveryUid !== uid) return false;

  const library = profile.remoteLibraryId;
  if (!library || !library.trim()) return false;
  if (binding.remoteLibraryId !== library) return false;
  if (operation.remoteLibraryId !== library) return false;

  if (!profile.syncEnabled) return false;
  return DELIVERABLE_STATES.has(profile.state);
}

/**
 * Consent is proven by the F1 link preview (profile + uid + count + clock).
 * A local token is never treated as real authentication.
 */
export function assertDeliveryConsent(
  profile: ProfileRecord,
  proof: DeliveryConsentProof,
  expected: { uid: string; library: string },
  now = Date.now(),
): void {
  if (!proof || proof.consent !== true) {
    throw new ContentValidationError('INVALID_COMMAND', 'explicit consent is required');
  }
  if (proof.profileId !== profile.profileId) {
    throw new ContentValidationError('PROFILE_MISMATCH', 'consent belongs to another profile');
  }
  const uid = typeof proof.uid === 'string' ? proof.uid.trim() : '';
  if (!uid) throw new ContentValidationError('IDENTIFIER_REQUIRED', 'uid is required');
  if (uid !== expected.uid.trim()) {
    throw new ContentValidationError('PROFILE_MISMATCH', 'consent belongs to another uid');
  }
  if (profile.uid && profile.uid !== uid) {
    throw new ContentValidationError('PROFILE_MISMATCH', 'profile is bound to another uid');
  }
  const library = typeof proof.remoteLibraryId === 'string' ? proof.remoteLibraryId.trim() : '';
  if (!library) {
    throw new ContentValidationError('IDENTIFIER_REQUIRED', 'remoteLibraryId is required');
  }
  if (library !== expected.library.trim()) {
    throw new ContentValidationError('PROFILE_MISMATCH', 'consent belongs to another library');
  }
  if (profile.remoteLibraryId && profile.remoteLibraryId !== library) {
    throw new ContentValidationError('PROFILE_MISMATCH', 'profile is bound to another library');
  }
  if (!isValidPreview(proof.preview as LinkPreview, profile.profileId, uid, now)) {
    throw new ContentValidationError('INVALID_COMMAND', 'link preview is expired or forged');
  }
}
