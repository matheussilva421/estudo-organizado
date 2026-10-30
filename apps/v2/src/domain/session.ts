import { isCivilDate, isValidTimeZone } from './planning-time';

export type SessionState =
  | 'DRAFT'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RECOVERY_REQUIRED';

export type SessionOrigin = 'TIMER' | 'POMODORO' | 'MANUAL';

export type SessionScope = {
  profileId: string;
  operationId: string;
  baseRevision: number | null;
};

export type SessionOutcome<T> =
  | { kind: 'LOCAL_COMMITTED'; value: T }
  | { kind: 'INVALID'; code: string }
  | { kind: 'CONFLICT'; code: string }
  | { kind: 'FAILED'; reason: string };

export type ClockObservation = {
  contextId: string;
  monotonicMs: number;
  wallInstant: string;
};

export type SessionInterval = {
  id: string;
  kind: 'FOCUS' | 'BREAK';
  verifiedMs: number;
  contextId: string | null;
  checkpoint: ClockObservation | null;
  recoveryFlag: boolean;
};

export type StudySession = {
  id: string;
  profileId: string;
  state: SessionState;
  origin: SessionOrigin;
  localRevision: number;
  schemaVersion: number;
  referenceZone: string | null;
  recordedAtCivilDate?: string;
  manualDeclaredMs?: number;
  planBlockIds: string[];
  editalIds: string[];
  intervals: SessionInterval[];
  tombstone?: boolean;
  deletedAt?: string;
  deletedReason?: string;
};

export class SessionValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SessionValidationError';
    this.code = code;
  }
}

const STATES: readonly SessionState[] = [
  'DRAFT',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'RECOVERY_REQUIRED',
];

const ORIGINS: readonly SessionOrigin[] = ['TIMER', 'POMODORO', 'MANUAL'];

const TRANSITIONS: Record<SessionState, readonly SessionState[]> = {
  DRAFT: ['RUNNING', 'COMPLETED', 'CANCELLED'],
  RUNNING: ['PAUSED', 'COMPLETED', 'CANCELLED', 'RECOVERY_REQUIRED'],
  PAUSED: ['RUNNING', 'COMPLETED', 'CANCELLED', 'RECOVERY_REQUIRED'],
  RECOVERY_REQUIRED: ['PAUSED', 'RUNNING', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

function fail(code: string, message: string): never {
  throw new SessionValidationError(code, message);
}

function assertNonEmptyString(value: unknown, code: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(code, 'string is required');
}

function assertFiniteNonNegative(value: unknown, code: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail(code, 'finite non-negative number is required');
  }
}

function assertPositiveInteger(value: unknown, code: string): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    fail(code, 'positive integer is required');
  }
}

function assertStringArray(value: unknown, code: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    fail(code, 'array of non-empty strings is required');
  }
  if (new Set(value).size !== value.length) fail(code, 'duplicate identifiers are not allowed');
}

function validateClockObservation(value: ClockObservation): void {
  assertNonEmptyString(value.contextId, 'INVALID_CHECKPOINT');
  assertFiniteNonNegative(value.monotonicMs, 'INVALID_CHECKPOINT');
  if (typeof value.wallInstant !== 'string' || Number.isNaN(Date.parse(value.wallInstant))) {
    fail('INVALID_CHECKPOINT', 'wallInstant must be an ISO date-time');
  }
}

function validateInterval(interval: SessionInterval): void {
  assertNonEmptyString(interval.id, 'INVALID_INTERVAL');
  if (interval.kind !== 'FOCUS' && interval.kind !== 'BREAK') {
    fail('INVALID_INTERVAL', 'interval kind must be FOCUS or BREAK');
  }
  assertFiniteNonNegative(interval.verifiedMs, 'INVALID_DURATION');
  if (interval.contextId !== null && (typeof interval.contextId !== 'string' || !interval.contextId.trim())) {
    fail('INVALID_INTERVAL', 'contextId must be null or a non-empty string');
  }
  if (interval.checkpoint !== null) validateClockObservation(interval.checkpoint);
  if (typeof interval.recoveryFlag !== 'boolean') fail('INVALID_INTERVAL', 'recoveryFlag is required');
}

export function validateSession(input: StudySession): StudySession {
  if (!input || typeof input !== 'object') fail('INVALID_SESSION', 'session is required');
  assertNonEmptyString(input.id, 'INVALID_IDENTIFIER');
  assertNonEmptyString(input.profileId, 'INVALID_PROFILE');
  if (!STATES.includes(input.state)) fail('INVALID_STATE', 'unknown session state');
  if (!ORIGINS.includes(input.origin)) fail('INVALID_ORIGIN', 'unknown session origin');
  assertPositiveInteger(input.localRevision, 'INVALID_REVISION');
  assertPositiveInteger(input.schemaVersion, 'INVALID_SCHEMA_VERSION');

  if (input.referenceZone !== null) {
    if (typeof input.referenceZone !== 'string' || !isValidTimeZone(input.referenceZone)) {
      fail('INVALID_TIME_ZONE', 'referenceZone must be a valid IANA zone');
    }
  }
  if (input.recordedAtCivilDate !== undefined && !isCivilDate(input.recordedAtCivilDate)) {
    fail('INVALID_CIVIL_DATE', 'recordedAtCivilDate must be a CivilDate');
  }
  if (input.manualDeclaredMs !== undefined) {
    assertFiniteNonNegative(input.manualDeclaredMs, 'INVALID_DURATION');
  }
  assertStringArray(input.planBlockIds, 'INVALID_PLAN_BLOCK_IDS');
  assertStringArray(input.editalIds, 'INVALID_EDITAL_IDS');
  if (!Array.isArray(input.intervals)) fail('INVALID_INTERVAL', 'intervals must be an array');
  for (const interval of input.intervals) validateInterval(interval);
  if (input.origin === 'MANUAL' && input.intervals.length > 0) {
    fail('INVALID_MANUAL_INTERVALS', 'manual sessions cannot contain timer intervals');
  }
  if (input.tombstone !== undefined && typeof input.tombstone !== 'boolean') {
    fail('INVALID_TOMBSTONE', 'tombstone must be boolean');
  }
  if (
    input.deletedAt !== undefined &&
    (typeof input.deletedAt !== 'string' || Number.isNaN(Date.parse(input.deletedAt)))
  ) {
    fail('INVALID_TOMBSTONE', 'deletedAt must be an ISO date-time');
  }
  if (input.deletedReason !== undefined && typeof input.deletedReason !== 'string') {
    fail('INVALID_TOMBSTONE', 'deletedReason must be a string');
  }
  if (input.tombstone === true && input.deletedAt === undefined) {
    fail('INVALID_TOMBSTONE', 'a tombstone requires deletedAt');
  }
  if (input.tombstone !== true && input.deletedAt !== undefined) {
    fail('INVALID_TOMBSTONE', 'deletedAt requires tombstone=true');
  }

  return input;
}

export function transitionSession(session: StudySession, next: SessionState): StudySession {
  const current = validateSession(session);
  if (!STATES.includes(next)) fail('INVALID_STATE', 'unknown target state');
  if (!TRANSITIONS[current.state].includes(next)) {
    fail('INVALID_TRANSITION', `cannot transition from ${current.state} to ${next}`);
  }
  return { ...current, state: next };
}

export function isTerminalSessionState(state: SessionState): boolean {
  return state === 'COMPLETED' || state === 'CANCELLED';
}
