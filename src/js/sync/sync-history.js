// Bounded operational summaries for manual sync history. Local plans and
// conflict payloads must never be duplicated into telemetry records.

const MAX_TEXT = 240;

function text(value, max = MAX_TEXT) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, Math.max(0, max - 3)) + '...' : trimmed;
}

function integer(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function identifier(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 ? value : null;
}

function digest(value) {
  return typeof value === 'string' && /^[a-z0-9]{16,128}$/.test(value) ? value : null;
}

/**
 * Keep only metadata useful for diagnosis. Plans, merge entries and any
 * unknown nested payload are deliberately omitted.
 */
export function summarizeSyncConflict(conflict) {
  if (!conflict || typeof conflict !== 'object' || Array.isArray(conflict)) {
    return null;
  }
  return {
    type: text(conflict.type, 80),
    cause: text(conflict.cause, 80),
    detectedAt: text(conflict.detectedAt, 64),
    planId: identifier(conflict.planId),
    baseRevision: integer(conflict.baseRevision),
    localRevision: integer(conflict.localRevision),
    remoteRevision: integer(conflict.remoteRevision),
    remoteUpdatedAt: text(conflict.remoteUpdatedAt, 64),
    localDigest: digest(conflict.localDigest),
    remoteDigest: digest(conflict.remoteDigest),
    remoteSnapshotRevision: integer(conflict.remoteSnapshotRevision),
    reason: text(conflict.reason),
    error: text(conflict.error),
    mergeValid: typeof conflict.mergeValid === 'boolean' ? conflict.mergeValid : null,
    mergeConflictCount: Array.isArray(conflict.mergeConflicts)
      ? conflict.mergeConflicts.length
      : null,
    itemCount: Array.isArray(conflict.items) ? conflict.items.length : null,
    proposedRevision: integer(conflict.proposedPlan?.revision),
    hasLocalPlan: Boolean(conflict.localPlan),
    hasRemotePlan: Boolean(conflict.remotePlan),
    hasBasePlan: Boolean(conflict.basePlan),
    hasProposedPlan: Boolean(conflict.proposedPlan),
  };
}
