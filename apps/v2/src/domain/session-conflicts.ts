import {
  SessionValidationError,
  validateSession,
  type SessionOutcome,
  type StudySession,
} from './session';

export type SessionConflictKind =
  | 'SAME_FIELD'
  | 'DELETE_VS_EDIT'
  | 'CAUSALITY'
  | 'INVALID_LINK';

export type SessionConflict = {
  id: string;
  profileId: string;
  sessionId: string;
  baseRevision: number;
  local: StudySession;
  incoming: StudySession;
  kind: SessionConflictKind;
  status?: 'OPEN' | 'RESOLVED';
  resolution?: 'LOCAL' | 'INCOMING' | 'KEEP_BOTH';
};

export type ReconcileResult =
  | { kind: 'MERGED'; session: StudySession }
  | { kind: 'CONFLICT'; conflict: SessionConflict };

export type SessionConflictChoice = 'LOCAL' | 'INCOMING' | 'KEEP_BOTH';

const COMPARED_FIELDS = [
  'manualDeclaredMs',
  'recordedAtCivilDate',
  'planBlockIds',
  'editalIds',
  'intervals',
  'measurements',
  'materials',
  'note',
  'planReconciliation',
] as const;

type ComparedField = (typeof COMPARED_FIELDS)[number];

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

function changed(base: StudySession, version: StudySession, field: ComparedField): boolean {
  return stableStringify(base[field]) !== stableStringify(version[field]);
}

function buildConflict(
  base: StudySession,
  local: StudySession,
  incoming: StudySession,
  kind: SessionConflictKind,
): SessionConflict {
  return {
    id: `${local.id}~${base.localRevision}~${local.localRevision}~${incoming.localRevision}`,
    profileId: local.profileId,
    sessionId: local.id,
    baseRevision: base.localRevision,
    local,
    incoming,
    kind,
    status: 'OPEN',
  };
}

/**
 * Reconciles only independent fields with a proven common base. Same-field
 * edits, delete-vs-edit and invalid causality keep both variants for a human
 * decision; timestamps are never used as an arbiter.
 */
export function reconcileSessionVersions(
  base: StudySession,
  local: StudySession,
  incoming: StudySession,
): ReconcileResult {
  const validatedBase = validateSession(base);
  const validatedLocal = validateSession(local);
  const validatedIncoming = validateSession(incoming);

  if (
    validatedLocal.id !== validatedIncoming.id ||
    validatedLocal.profileId !== validatedIncoming.profileId ||
    validatedLocal.id !== validatedBase.id
  ) {
    return {
      kind: 'CONFLICT',
      conflict: buildConflict(
        validatedBase,
        validatedLocal,
        validatedIncoming,
        'INVALID_LINK',
      ),
    };
  }

  if (
    validatedLocal.localRevision === validatedIncoming.localRevision &&
    stableStringify(validatedLocal) === stableStringify(validatedIncoming)
  ) {
    return { kind: 'MERGED', session: validatedLocal };
  }

  if (validatedLocal.tombstone !== validatedIncoming.tombstone) {
    return {
      kind: 'CONFLICT',
      conflict: buildConflict(
        validatedBase,
        validatedLocal,
        validatedIncoming,
        'DELETE_VS_EDIT',
      ),
    };
  }

  const localChanged = new Set(
    COMPARED_FIELDS.filter((field) => changed(validatedBase, validatedLocal, field)),
  );
  const incomingChanged = new Set(
    COMPARED_FIELDS.filter((field) => changed(validatedBase, validatedIncoming, field)),
  );
  const overlapping = [...localChanged].filter((field) => incomingChanged.has(field));
  if (overlapping.length > 0) {
    return {
      kind: 'CONFLICT',
      conflict: buildConflict(
        validatedBase,
        validatedLocal,
        validatedIncoming,
        'SAME_FIELD',
      ),
    };
  }

  const merged: StudySession = {
    ...validatedLocal,
    localRevision:
      Math.max(validatedLocal.localRevision, validatedIncoming.localRevision) + 1,
  };
  for (const field of incomingChanged) {
    (merged as Record<string, unknown>)[field] = validatedIncoming[field];
  }
  try {
    return { kind: 'MERGED', session: validateSession(merged) };
  } catch (error) {
    if (error instanceof SessionValidationError) {
      return {
        kind: 'CONFLICT',
        conflict: buildConflict(
          validatedBase,
          validatedLocal,
          validatedIncoming,
          'CAUSALITY',
        ),
      };
    }
    throw error;
  }
}

export function resolveSessionConflict(
  conflict: SessionConflict,
  choice: SessionConflictChoice,
): SessionOutcome<StudySession> {
  if (choice === 'LOCAL' || choice === 'KEEP_BOTH') {
    return { kind: 'LOCAL_COMMITTED', value: conflict.local };
  }
  if (choice === 'INCOMING') {
    return { kind: 'LOCAL_COMMITTED', value: conflict.incoming };
  }
  return { kind: 'INVALID', code: 'INVALID_CHOICE' };
}
