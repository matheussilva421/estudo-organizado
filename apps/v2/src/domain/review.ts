import type { CivilDate } from './planning';
import { addCivilDays, compareCivilDate, isCivilDate } from './planning-time';
import type { StudySession } from './session';

/**
 * F5 pure review domain.
 *
 * Suggestions are projections, commitments are durable decisions, and
 * executions are facts. No function here writes to IndexedDB, React or the
 * outbox; the application layer owns those transitions.
 */

export type ReviewOutcome<T> =
  | { kind: 'LOCAL_COMMITTED'; value: T }
  | { kind: 'INVALID'; code: string }
  | { kind: 'CONFLICT'; code: string }
  | { kind: 'BLOCKED'; reason: string }
  | { kind: 'FAILED'; reason: string };

export type ReviewScope = {
  profileId: string;
  operationId: string;
  baseRevision?: number | null;
};

export type ReviewAssessment = 'FORGOT' | 'PARTIAL' | 'GOOD' | 'UNRATED';
export type ReviewCoverage = 'FULL' | 'PARTIAL' | 'UNKNOWN';
export type ReviewCommitmentStatus =
  | 'PENDING'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'CANCELLED';
export type ReviewEvidenceKind = 'QUANTITATIVE' | 'QUALITATIVE' | 'PREFERENCE';
export type ReviewProjectionStatus =
  | 'INSUFFICIENT_DATA'
  | 'DESCRIPTIVE_ONLY'
  | 'TREND_SUPPORTED';

export class ReviewValidationError extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'ReviewValidationError';
    this.code = code;
  }
}

function fail(code: string, message?: string): never {
  throw new ReviewValidationError(code, message);
}

function requireId(value: unknown, code = 'IDENTIFIER_REQUIRED'): string {
  if (typeof value !== 'string' || !value.trim()) fail(code);
  return value.trim();
}

function requireCivilDate(value: unknown, code = 'INVALID_CIVIL_DATE'): CivilDate {
  if (typeof value !== 'string' || !isCivilDate(value)) fail(code);
  return value;
}

function finiteNonNegative(value: unknown, code = 'INVALID_NUMBER'): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) fail(code);
  return value;
}

function positiveInteger(value: unknown, code = 'INVALID_NUMBER'): number {
  if (!Number.isInteger(value) || (value as number) < 1) fail(code);
  return value as number;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

export function civilToday(zone: string, now = new Date()): CivilDate {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export type ReviewPolicy = {
  id: string;
  profileId: string;
  localRevision: number;
  version: number;
  initialIntervalDays: number;
  goodMultiplier: number;
  partialMultiplier: number;
  forgotMultiplier: number;
  unratedMultiplier: number;
  minIntervalDays: number;
  maxIntervalDays: number;
  sufficientSample: number;
  recentWindowDays: number;
  defaultDurationMinutes: number;
  autoApprove: boolean;
  autoApproveHorizonDays: number;
  quietStart: string;
  quietEnd: string;
};

export const REVIEW_POLICY_VERSION = 1;

export function createDefaultReviewPolicy(profileId: string): ReviewPolicy {
  return {
    id: 'review-policy',
    profileId: requireId(profileId, 'INVALID_PROFILE'),
    localRevision: 1,
    version: REVIEW_POLICY_VERSION,
    // Conservative, reversible defaults. They are product candidates, not
    // scientific claims; the UI explains fallback and small-sample behavior.
    initialIntervalDays: 3,
    goodMultiplier: 2.5,
    partialMultiplier: 1.5,
    forgotMultiplier: 0.5,
    unratedMultiplier: 1.2,
    minIntervalDays: 1,
    maxIntervalDays: 365,
    sufficientSample: 5,
    recentWindowDays: 30,
    defaultDurationMinutes: 20,
    autoApprove: false,
    autoApproveHorizonDays: 14,
    quietStart: '22:00',
    quietEnd: '07:00',
  };
}

export function validateReviewPolicy(input: ReviewPolicy): ReviewPolicy {
  if (!input || typeof input !== 'object') fail('INVALID_POLICY');
  requireId(input.id);
  requireId(input.profileId, 'INVALID_PROFILE');
  positiveInteger(input.localRevision);
  positiveInteger(input.version);
  for (const key of [
    'initialIntervalDays',
    'goodMultiplier',
    'partialMultiplier',
    'forgotMultiplier',
    'unratedMultiplier',
    'minIntervalDays',
    'maxIntervalDays',
    'sufficientSample',
    'recentWindowDays',
    'defaultDurationMinutes',
    'autoApproveHorizonDays',
  ] as const) {
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key] <= 0) {
      fail('INVALID_POLICY');
    }
  }
  if (input.minIntervalDays > input.maxIntervalDays) fail('INVALID_POLICY');
  if (typeof input.autoApprove !== 'boolean') fail('INVALID_POLICY');
  if (typeof input.quietStart !== 'string' || typeof input.quietEnd !== 'string') {
    fail('INVALID_POLICY');
  }
  return { ...input };
}

export function nextReviewPolicy(
  current: ReviewPolicy,
  changes: Partial<Omit<ReviewPolicy, 'id' | 'profileId' | 'localRevision' | 'version'>>,
): ReviewPolicy {
  return validateReviewPolicy({
    ...current,
    ...changes,
    localRevision: current.localRevision + 1,
    version: current.version + 1,
  });
}

export type ReviewTopicLink = {
  id: string;
  profileId: string;
  canonicalTopicKey: string;
  editalId: string;
  editalDisciplineId: string;
  assuntoId: string;
  aulaId?: string;
  label: string;
  provenance: 'MANUAL' | 'IMPORT';
  localRevision: number;
  tombstone?: boolean;
};

/** A stable local review group, never derived from a title or StudySubject. */
export function defaultCanonicalTopicKey(
  editalDisciplineId: string,
  assuntoId: string,
): string {
  return `${requireId(editalDisciplineId)}::${requireId(assuntoId)}`;
}

export function createReviewTopicLink(input: {
  id: string;
  profileId: string;
  editalId: string;
  editalDisciplineId: string;
  assuntoId: string;
  aulaId?: string;
  label: string;
  canonicalTopicKey?: string;
  provenance?: 'MANUAL' | 'IMPORT';
}): ReviewTopicLink {
  return {
    id: requireId(input.id),
    profileId: requireId(input.profileId, 'INVALID_PROFILE'),
    canonicalTopicKey:
      input.canonicalTopicKey?.trim() ||
      defaultCanonicalTopicKey(input.editalDisciplineId, input.assuntoId),
    editalId: requireId(input.editalId),
    editalDisciplineId: requireId(input.editalDisciplineId),
    assuntoId: requireId(input.assuntoId),
    ...(input.aulaId && input.aulaId.trim() ? { aulaId: input.aulaId.trim() } : {}),
    label: input.label.trim() || input.assuntoId,
    provenance: input.provenance ?? 'MANUAL',
    localRevision: 1,
  };
}

export function validateReviewTopicLink(input: ReviewTopicLink): ReviewTopicLink {
  if (!input || typeof input !== 'object') fail('INVALID_TOPIC');
  requireId(input.id);
  requireId(input.profileId, 'INVALID_PROFILE');
  requireId(input.canonicalTopicKey);
  requireId(input.editalId);
  requireId(input.editalDisciplineId);
  requireId(input.assuntoId);
  if (input.label !== undefined && typeof input.label !== 'string') fail('INVALID_TOPIC');
  if (input.tombstone !== undefined && typeof input.tombstone !== 'boolean') fail('INVALID_TOPIC');
  positiveInteger(input.localRevision);
  return { ...input };
}

export type ReviewSuggestion = {
  key: string;
  profileId: string;
  canonicalTopicKey: string;
  topicLinkId: string;
  editalId: string;
  assuntoId: string;
  label: string;
  dueDate: CivilDate;
  intervalDays: number;
  durationMinutes: number;
  durationSource: 'HISTORY' | 'FALLBACK';
  policyVersion: number;
  fingerprint: string;
  explanation: string;
  status: 'PROPOSED' | 'STALE' | 'DISMISSED';
};

export type ReviewCommitment = {
  id: string;
  profileId: string;
  canonicalTopicKey: string;
  topicLinkId: string;
  editalId: string;
  assuntoId: string;
  label: string;
  originalDueDate: CivilDate;
  currentDueDate: CivilDate;
  status: ReviewCommitmentStatus;
  coverage: ReviewCoverage;
  policyVersion: number;
  source: 'MANUAL' | 'OPT_IN';
  planBlockId?: string;
  localRevision: number;
  history: {
    type: 'CREATED' | 'RESCHEDULED' | 'EXECUTED' | 'CANCELLED' | 'RECONCILED';
    at: string;
    dueDate?: CivilDate;
    note?: string;
  }[];
  tombstone?: boolean;
};

export type ReviewExecution = {
  id: string;
  profileId: string;
  canonicalTopicKey: string;
  commitmentId?: string;
  civilDate: CivilDate;
  assessment: ReviewAssessment;
  coverage: ReviewCoverage;
  source: 'F5' | 'F4';
  sessionId?: string;
  allocationId?: string;
  localRevision: number;
  provenance: string;
  tombstone?: boolean;
};

export function estimateReviewDuration(input: {
  durationsMinutes: number[];
  policy: ReviewPolicy;
}): { minutes: number; source: 'HISTORY' | 'FALLBACK'; samples: number } {
  const valid = input.durationsMinutes.filter(
    (value) => Number.isFinite(value) && value > 0 && value <= 12 * 60,
  );
  if (valid.length === 0) {
    return {
      minutes: input.policy.defaultDurationMinutes,
      source: 'FALLBACK',
      samples: 0,
    };
  }
  const sorted = [...valid].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1]! + sorted[middle]!) / 2
      : sorted[middle]!;
  return {
    minutes: Math.max(5, Math.min(180, Math.round(median))),
    source: 'HISTORY',
    samples: sorted.length,
  };
}

function policyMultiplier(
  assessment: ReviewAssessment,
  stage: number,
  policy: ReviewPolicy,
): number {
  const boundedStage = Math.max(0, Math.min(12, stage));
  switch (assessment) {
    case 'FORGOT':
      return Math.max(0.25, policy.forgotMultiplier - boundedStage * 0.03);
    case 'PARTIAL':
      return policy.partialMultiplier + boundedStage * 0.05;
    case 'GOOD':
      return policy.goodMultiplier + boundedStage * 0.1;
    default:
      return policy.unratedMultiplier;
  }
}

export function generateReviewSuggestion(input: {
  topic: ReviewTopicLink;
  policy: ReviewPolicy;
  today: CivilDate;
  stage?: number;
  lastExecution?: ReviewExecution | null;
  durationsMinutes?: number[];
}): ReviewSuggestion {
  const topic = validateReviewTopicLink(input.topic);
  const policy = validateReviewPolicy(input.policy);
  const today = requireCivilDate(input.today);
  const stage = Math.max(0, input.stage ?? 0);
  const assessment = input.lastExecution?.assessment ?? 'UNRATED';
  const anchor = input.lastExecution?.civilDate ?? today;
  const multiplier = input.lastExecution
    ? policyMultiplier(assessment, stage, policy)
    : 1;
  const intervalDays = Math.max(
    policy.minIntervalDays,
    Math.min(
      policy.maxIntervalDays,
      Math.round(policy.initialIntervalDays * multiplier),
    ),
  );
  const dueDate = addCivilDays(anchor, intervalDays);
  const duration = estimateReviewDuration({
    durationsMinutes: input.durationsMinutes ?? [],
    policy,
  });
  const fingerprint = stableStringify({
    topic: topic.canonicalTopicKey,
    anchor,
    assessment,
    stage,
    policy: policy.version,
    intervalDays,
  });
  return {
    key: `${topic.profileId}::${topic.canonicalTopicKey}::${fingerprint.slice(0, 16)}`,
    profileId: topic.profileId,
    canonicalTopicKey: topic.canonicalTopicKey,
    topicLinkId: topic.id,
    editalId: topic.editalId,
    assuntoId: topic.assuntoId,
    label: topic.label,
    dueDate,
    intervalDays,
    durationMinutes: duration.minutes,
    durationSource: duration.source,
    policyVersion: policy.version,
    fingerprint,
    explanation: input.lastExecution
      ? `${assessment} em ${anchor}; intervalo ${intervalDays}d pela política v${policy.version}; duração ${duration.source === 'HISTORY' ? 'medida' : 'fallback'}.`
      : `Primeira revisão em ${intervalDays}d; duração ${duration.source === 'HISTORY' ? 'medida' : 'fallback'}.`,
    status: 'PROPOSED',
  };
}

export function applyReviewSuggestion(input: {
  suggestion: ReviewSuggestion;
  id: string;
  source: 'MANUAL' | 'OPT_IN';
  at: string;
}): ReviewCommitment {
  const suggestion = input.suggestion;
  const id = requireId(input.id);
  const at = requireId(input.at);
  if (!isCivilDate(suggestion.dueDate)) fail('INVALID_CIVIL_DATE');
  return {
    id,
    profileId: requireId(suggestion.profileId, 'INVALID_PROFILE'),
    canonicalTopicKey: requireId(suggestion.canonicalTopicKey),
    topicLinkId: requireId(suggestion.topicLinkId),
    editalId: requireId(suggestion.editalId),
    assuntoId: requireId(suggestion.assuntoId),
    label: suggestion.label,
    originalDueDate: suggestion.dueDate,
    currentDueDate: suggestion.dueDate,
    status: 'PENDING',
    coverage: 'UNKNOWN',
    policyVersion: suggestion.policyVersion,
    source: input.source,
    localRevision: 1,
    history: [{ type: 'CREATED', at, dueDate: suggestion.dueDate }],
  };
}

export function commitmentSemanticKey(commitment: ReviewCommitment): string {
  return `${commitment.profileId}::${commitment.canonicalTopicKey}::${commitment.currentDueDate}`;
}

export function recordReviewExecution(input: {
  id: string;
  profileId: string;
  canonicalTopicKey: string;
  commitment?: ReviewCommitment | null;
  civilDate: CivilDate;
  assessment: ReviewAssessment;
  coverage: ReviewCoverage;
  source?: 'F5' | 'F4';
  sessionId?: string;
  allocationId?: string;
  provenance: string;
}): { execution: ReviewExecution; commitment: ReviewCommitment | null } {
  const assessment = input.assessment;
  if (!['FORGOT', 'PARTIAL', 'GOOD', 'UNRATED'].includes(assessment)) {
    fail('INVALID_ASSESSMENT');
  }
  if (input.commitment) {
    if (input.commitment.tombstone === true) fail('COMMITMENT_DELETED');
    if (input.commitment.status === 'CANCELLED') fail('COMMITMENT_CANCELLED');
    if (
      input.commitment.status === 'FULFILLED' &&
      input.coverage === 'FULL'
    ) {
      fail('COVERAGE_ALREADY_FULFILLED');
    }
  }
  const execution: ReviewExecution = {
    id: requireId(input.id),
    profileId: requireId(input.profileId, 'INVALID_PROFILE'),
    canonicalTopicKey: requireId(input.canonicalTopicKey),
    ...(input.commitment ? { commitmentId: input.commitment.id } : {}),
    civilDate: requireCivilDate(input.civilDate),
    assessment,
    coverage: input.coverage,
    source: input.source ?? 'F5',
    ...(input.sessionId ? { sessionId: requireId(input.sessionId) } : {}),
    ...(input.allocationId ? { allocationId: requireId(input.allocationId) } : {}),
    localRevision: 1,
    provenance: input.provenance.trim() || 'manual',
  };
  if (!input.commitment) return { execution, commitment: null };
  const status: ReviewCommitmentStatus =
    input.coverage === 'FULL'
      ? 'FULFILLED'
      : input.coverage === 'PARTIAL'
        ? 'PARTIALLY_FULFILLED'
        : input.commitment.status;
  const commitment: ReviewCommitment = {
    ...input.commitment,
    status,
    coverage:
      input.coverage === 'FULL'
        ? 'FULL'
        : input.coverage === 'PARTIAL'
          ? 'PARTIAL'
          : input.commitment.coverage,
    localRevision: input.commitment.localRevision + 1,
    history: [
      ...input.commitment.history,
      { type: 'EXECUTED', at: input.civilDate, note: `${input.coverage}/${assessment}` },
    ],
  };
  return { execution, commitment };
}

export function rescheduleCommitment(input: {
  commitment: ReviewCommitment;
  dueDate: CivilDate;
  at: string;
}): ReviewCommitment {
  if (input.commitment.status === 'CANCELLED' || input.commitment.status === 'FULFILLED') {
    fail('INVALID_TRANSITION');
  }
  const dueDate = requireCivilDate(input.dueDate);
  return {
    ...input.commitment,
    currentDueDate: dueDate,
    localRevision: input.commitment.localRevision + 1,
    history: [
      ...input.commitment.history,
      { type: 'RESCHEDULED', at: requireId(input.at), dueDate },
    ],
  };
}

export function cancelCommitment(input: {
  commitment: ReviewCommitment;
  at: string;
}): ReviewCommitment {
  if (input.commitment.status === 'CANCELLED') return input.commitment;
  return {
    ...input.commitment,
    status: 'CANCELLED',
    localRevision: input.commitment.localRevision + 1,
    history: [
      ...input.commitment.history,
      { type: 'CANCELLED', at: requireId(input.at) },
    ],
  };
}

export type WeakPointProjection = {
  profileId: string;
  canonicalTopicKey: string;
  assuntoId: string;
  editalId?: string;
  label: string;
  questions: number;
  correctAnswers: number;
  accuracy: number | null;
  retention: { forgot: number; partial: number; good: number; unrated: number };
  executions: number;
  insurance: number;
  status: ReviewProjectionStatus;
  trend: 'IMPROVING' | 'WORSENING' | 'STABLE' | 'INSUFFICIENT';
  evidence: string[];
  conflicts: string[];
  policyVersion: number;
  fingerprint: string;
};

export function calculateWeakPointProjections(input: {
  profileId: string;
  topics: ReviewTopicLink[];
  executions: ReviewExecution[];
  sessions: StudySession[];
  policy: ReviewPolicy;
  today: CivilDate;
  uncertainTopicKeys?: Set<string>;
}): WeakPointProjection[] {
  const profileId = requireId(input.profileId, 'INVALID_PROFILE');
  const policy = validateReviewPolicy(input.policy);
  const topics = input.topics.filter(
    (topic) => topic.profileId === profileId && topic.tombstone !== true,
  );
  const topicByScope = new Map<string, ReviewTopicLink>();
  for (const topic of topics) {
    topicByScope.set(`${topic.editalDisciplineId}::${topic.assuntoId}`, topic);
  }
  type Bucket = {
    topic: ReviewTopicLink;
    questions: number;
    correct: number;
    recentQuestions: number;
    recentCorrect: number;
    olderQuestions: number;
    olderCorrect: number;
    retention: { forgot: number; partial: number; good: number; unrated: number };
    executions: number;
    evidence: string[];
    conflicts: string[];
  };
  const buckets = new Map<string, Bucket>();
  const ensure = (topic: ReviewTopicLink): Bucket => {
    const key = topic.canonicalTopicKey;
    const existing = buckets.get(key);
    if (existing) return existing;
    const created: Bucket = {
      topic,
      questions: 0,
      correct: 0,
      recentQuestions: 0,
      recentCorrect: 0,
      olderQuestions: 0,
      olderCorrect: 0,
      retention: { forgot: 0, partial: 0, good: 0, unrated: 0 },
      executions: 0,
      evidence: [],
      conflicts: [],
    };
    buckets.set(key, created);
    return created;
  };
  // A topic without evidence is still visible as INSUFFICIENT_DATA; it is
  // never silently omitted from the insights screen.
  for (const topic of topics) ensure(topic);

  for (const session of input.sessions) {
    if (session.profileId !== profileId || session.tombstone === true) continue;
    if (session.state !== 'COMPLETED' && session.state !== 'PAUSED') continue;
    const sessionDate = session.recordedAtCivilDate;
    const recent =
      sessionDate && isCivilDate(sessionDate)
        ? compareCivilDate(sessionDate, addCivilDays(input.today, -policy.recentWindowDays)) >= 0
        : false;
    for (const measurement of session.measurements ?? []) {
      if (
        !Number.isInteger(measurement.questions) ||
        !Number.isInteger(measurement.correctAnswers) ||
        measurement.questions < 0 ||
        measurement.correctAnswers < 0 ||
        measurement.correctAnswers > measurement.questions
      ) {
        continue;
      }
      const allocation = measurement.allocationId
        ? (session.allocations ?? []).find((item) => item.allocationId === measurement.allocationId)
        : undefined;
      if (!allocation?.assuntoId || !allocation.editalDisciplineId) continue;
      const topic = topicByScope.get(`${allocation.editalDisciplineId}::${allocation.assuntoId}`);
      if (!topic) continue;
      const bucket = ensure(topic);
      bucket.questions += measurement.questions;
      bucket.correct += measurement.correctAnswers;
      if (recent) {
        bucket.recentQuestions += measurement.questions;
        bucket.recentCorrect += measurement.correctAnswers;
      } else {
        bucket.olderQuestions += measurement.questions;
        bucket.olderCorrect += measurement.correctAnswers;
      }
      bucket.evidence.push(`F4:${session.id}:${measurement.id}`);
      if (input.uncertainTopicKeys?.has(topic.canonicalTopicKey)) {
        bucket.conflicts.push(`F4_CONFLICT:${session.id}`);
      }
    }
  }

  for (const execution of input.executions) {
    if (execution.profileId !== profileId || execution.tombstone === true) continue;
    const topic = topics.find((item) => item.canonicalTopicKey === execution.canonicalTopicKey);
    if (!topic) continue;
    const bucket = ensure(topic);
    bucket.executions += 1;
    if (execution.assessment === 'FORGOT') bucket.retention.forgot += 1;
    else if (execution.assessment === 'PARTIAL') bucket.retention.partial += 1;
    else if (execution.assessment === 'GOOD') bucket.retention.good += 1;
    else bucket.retention.unrated += 1;
    bucket.evidence.push(`F5:${execution.id}`);
  }

  return [...buckets.values()].map((bucket) => {
    const totalRetention =
      bucket.retention.forgot +
      bucket.retention.partial +
      bucket.retention.good +
      bucket.retention.unrated;
    const enoughQuestions = bucket.questions >= policy.sufficientSample;
    const enoughRetention = totalRetention >= 2;
    const recentEnough = bucket.recentQuestions >= Math.max(2, Math.ceil(policy.sufficientSample / 2));
    const olderEnough = bucket.olderQuestions >= Math.max(2, Math.ceil(policy.sufficientSample / 2));
    let status: ReviewProjectionStatus = 'INSUFFICIENT_DATA';
    if (enoughQuestions) status = 'DESCRIPTIVE_ONLY';
    if (enoughQuestions && recentEnough && olderEnough) status = 'TREND_SUPPORTED';
    let trend: WeakPointProjection['trend'] = 'INSUFFICIENT';
    if (status === 'TREND_SUPPORTED') {
      const recentAccuracy = bucket.recentCorrect / bucket.recentQuestions;
      const olderAccuracy = bucket.olderCorrect / bucket.olderQuestions;
      trend =
        recentAccuracy > olderAccuracy + 0.05
          ? 'IMPROVING'
          : recentAccuracy < olderAccuracy - 0.05
            ? 'WORSENING'
            : 'STABLE';
    } else if (bucket.questions > 0) {
      trend = 'INSUFFICIENT';
    }
    const fingerprint = stableStringify({
      policy: policy.version,
      questions: bucket.questions,
      correct: bucket.correct,
      retention: bucket.retention,
      executions: bucket.executions,
      conflicts: bucket.conflicts,
    });
    return {
      profileId,
      canonicalTopicKey: bucket.topic.canonicalTopicKey,
      assuntoId: bucket.topic.assuntoId,
      editalId: bucket.topic.editalId,
      label: bucket.topic.label,
      questions: bucket.questions,
      correctAnswers: bucket.correct,
      accuracy: bucket.questions > 0 ? bucket.correct / bucket.questions : null,
      retention: bucket.retention,
      executions: bucket.executions,
      insurance: enoughRetention ? 1 : 0,
      status,
      trend,
      evidence: [...new Set(bucket.evidence)].sort(),
      conflicts: [...new Set(bucket.conflicts)].sort(),
      policyVersion: policy.version,
      fingerprint,
    };
  });
}

export type BoardEvidence = {
  id: string;
  profileId: string;
  editalId?: string;
  kind: ReviewEvidenceKind;
  title: string;
  text: string;
  uri?: string;
  period?: string;
  sampleSize?: number;
  denominator?: number;
  supersedes?: string;
  limitations: string[];
  version: number;
  localRevision: number;
  fingerprint: string;
};

function sanitizeUri(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const uri = value.trim();
  if (!uri) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    fail('UNSAFE_URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    fail('UNSAFE_URL');
  }
  return parsed.toString();
}

export function parseBoardEvidence(input: {
  id: string;
  profileId: string;
  title: string;
  text: string;
  kind?: ReviewEvidenceKind;
  editalId?: string;
  uri?: string;
  period?: string;
  sampleSize?: number;
  denominator?: number;
  limitations?: string[];
  version?: number;
  supersedes?: string;
}): BoardEvidence {
  const text = input.text.trim();
  if (!text) fail('INVALID_EVIDENCE');
  if (text.length > 20_000) fail('EVIDENCE_TOO_LARGE');
  if (/<script\b|javascript:|data:text\/html/i.test(text)) fail('UNSAFE_EVIDENCE');
  const sampleSize =
    input.sampleSize === undefined ? undefined : finiteNonNegative(input.sampleSize);
  const denominator =
    input.denominator === undefined ? undefined : finiteNonNegative(input.denominator);
  if (sampleSize !== undefined && denominator !== undefined && sampleSize > denominator) {
    fail('INVALID_SAMPLE');
  }
  let kind = input.kind;
  if (!kind) {
    kind =
      sampleSize !== undefined && denominator !== undefined ? 'QUANTITATIVE' : 'QUALITATIVE';
  }
  const evidence: BoardEvidence = {
    id: requireId(input.id),
    profileId: requireId(input.profileId, 'INVALID_PROFILE'),
    ...(input.editalId ? { editalId: requireId(input.editalId) } : {}),
    kind,
    title: input.title.trim() || 'Evidência de banca',
    text,
    ...(input.uri ? { uri: sanitizeUri(input.uri) } : {}),
    ...(input.period ? { period: input.period.trim() } : {}),
    ...(sampleSize !== undefined ? { sampleSize } : {}),
    ...(denominator !== undefined ? { denominator } : {}),
    ...(input.supersedes ? { supersedes: requireId(input.supersedes) } : {}),
    limitations: [...(input.limitations ?? [])],
    version:
      input.version === undefined ? 1 : positiveInteger(input.version, 'INVALID_VERSION'),
    localRevision: 1,
    fingerprint: stableStringify({ text, kind, sampleSize, denominator, period: input.period }),
  };
  return evidence;
}

type MatchCandidate = {
  topic: ReviewTopicLink;
  score: number;
  reason: string;
};

function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function matchBoardEvidence(input: {
  evidence: BoardEvidence;
  topics: ReviewTopicLink[];
  editalId?: string;
}): { candidates: MatchCandidate[]; ambiguous: boolean } {
  const needle = normalizeForMatch(`${input.evidence.title} ${input.evidence.text}`);
  const candidates: MatchCandidate[] = [];
  for (const topic of input.topics) {
    if (topic.profileId !== input.evidence.profileId) continue;
    if (input.editalId && topic.editalId !== input.editalId) continue;
    const label = normalizeForMatch(topic.label);
    if (!label) continue;
    const exact = needle === label;
    const included = needle.includes(label) || label.includes(needle);
    if (!exact && !included) continue;
    candidates.push({
      topic,
      score: exact ? 1 : 0.6,
      reason: exact ? 'exact-label' : 'text-contains-label',
    });
  }
  const byLabel = new Map<string, number>();
  for (const candidate of candidates) {
    const key = normalizeForMatch(candidate.topic.label);
    byLabel.set(key, (byLabel.get(key) ?? 0) + 1);
  }
  const ambiguous = [...byLabel.values()].some((count) => count > 1);
  candidates.sort((a, b) => b.score - a.score || a.topic.label.localeCompare(b.topic.label));
  return { candidates, ambiguous };
}

export type TopicMatchDecision = {
  id: string;
  profileId: string;
  evidenceId: string;
  topicLinkId: string;
  canonicalTopicKey: string;
  editalId: string;
  assuntoId: string;
  decision: 'ACCEPTED' | 'REJECTED' | 'PENDING';
  score: number;
  reason: string;
  localRevision: number;
};

export type PriorityFactor = {
  name: 'deficiency' | 'board' | 'urgency' | 'override';
  value: number;
  explanation: string;
};

export type ContextPriorityRow = {
  canonicalTopicKey: string;
  assuntoId: string;
  label: string;
  score: number;
  rank: number;
  factors: PriorityFactor[];
  explanation: string;
  insufficient: boolean;
};

export type ContextPriorityProjection = {
  id: string;
  profileId: string;
  editalId: string;
  policyVersion: number;
  rows: ContextPriorityRow[];
  fingerprint: string;
  generatedAt: string;
  valid: boolean;
};

export function rankContextPriorities(input: {
  profileId: string;
  editalId: string;
  topics: ReviewTopicLink[];
  weakPoints: WeakPointProjection[];
  evidence: BoardEvidence[];
  matches: TopicMatchDecision[];
  examDate?: CivilDate | null;
  today: CivilDate;
  policy: ReviewPolicy;
  overrides?: Record<string, number>;
  generatedAt: string;
}): ContextPriorityProjection {
  const evidenceByTopic = new Map<string, BoardEvidence[]>();
  for (const decision of input.matches) {
    if (decision.decision !== 'ACCEPTED') continue;
    const item = input.evidence.find((evidence) => evidence.id === decision.evidenceId);
    if (!item) continue;
    const list = evidenceByTopic.get(decision.canonicalTopicKey) ?? [];
    list.push(item);
    evidenceByTopic.set(decision.canonicalTopicKey, list);
  }
  const rows: ContextPriorityRow[] = input.topics
    .filter((topic) => topic.profileId === input.profileId && topic.editalId === input.editalId)
    .map((topic) => {
      const weak = input.weakPoints.find(
        (item) => item.canonicalTopicKey === topic.canonicalTopicKey,
      );
      const deficiency =
        weak?.accuracy === null || weak?.accuracy === undefined ? 0 : Math.max(0, 1 - weak.accuracy);
      const boardItems = evidenceByTopic.get(topic.canonicalTopicKey) ?? [];
      const board = boardItems.reduce(
        (sum, item) => sum + (item.kind === 'QUANTITATIVE' ? 1 : item.kind === 'QUALITATIVE' ? 0.5 : 0.25),
        0,
      );
      const urgency =
        input.examDate && isCivilDate(input.examDate)
          ? Math.max(0, 1 - Math.max(0, compareCivilDate(input.examDate, input.today)) / 365)
          : 0;
      const override = input.overrides?.[topic.canonicalTopicKey] ?? 1;
      const score = Math.round((deficiency * 1.2 + Math.min(1, board) * 0.8 + urgency * 0.5) * override * 1000) / 1000;
      const factors: PriorityFactor[] = [
        { name: 'deficiency', value: deficiency, explanation: weak ? `${weak.status}; acertos ${weak.correctAnswers}/${weak.questions}` : 'sem evidência F4' },
        { name: 'board', value: Math.min(1, board), explanation: boardItems.length > 0 ? `${boardItems.length} fonte(s) confirmada(s)` : 'sem fonte de banca confirmada' },
        { name: 'urgency', value: urgency, explanation: input.examDate ? `prova ${input.examDate}` : 'sem data de prova' },
        ...(override !== 1 ? [{ name: 'override' as const, value: override, explanation: 'preferência local' }] : []),
      ];
      return {
        canonicalTopicKey: topic.canonicalTopicKey,
        assuntoId: topic.assuntoId,
        label: topic.label,
        score,
        rank: 0,
        factors,
        explanation: factors.map((factor) => `${factor.name}=${factor.value.toFixed(3)}`).join(' '),
        insufficient: weak?.status !== 'TREND_SUPPORTED' && (weak?.questions ?? 0) < input.policy.sufficientSample,
      };
    });
  rows.sort((a, b) => b.score - a.score || a.canonicalTopicKey.localeCompare(b.canonicalTopicKey));
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });
  return {
    id: `priority-${input.profileId}-${input.editalId}-${stableStringify({
      policy: input.policy.version,
      rows: rows.map((row) => [row.canonicalTopicKey, row.score]),
      evidence: input.evidence.map((item) => item.fingerprint),
    }).slice(0, 16)}`,
    profileId: input.profileId,
    editalId: input.editalId,
    policyVersion: input.policy.version,
    rows,
    fingerprint: stableStringify({
      policy: input.policy.version,
      rows: rows.map((row) => [row.canonicalTopicKey, row.score]),
      evidence: input.evidence.map((item) => item.fingerprint),
    }),
    generatedAt: input.generatedAt,
    valid: true,
  };
}

export function isReviewProjectionCurrent(
  projection: { fingerprint: string; policyVersion: number },
  input: { fingerprint: string; policyVersion: number },
): boolean {
  return projection.fingerprint === input.fingerprint && projection.policyVersion === input.policyVersion;
}

export type PriorityReversalPreview =
  | {
      kind: 'READY';
      priority: ContextPriorityProjection;
      affectedCanonicalTopicKeys: string[];
      explanation: string;
    }
  | {
      kind: 'CONFLICT';
      reason: string;
      affectedCanonicalTopicKeys: string[];
    };

/**
 * Reversal is compensatory, never a destructive rollback. If a newer ranking
 * exists, the caller must resolve the conflict instead of deleting decisions.
 */
export function previewPriorityReversal(input: {
  current: ContextPriorityProjection;
  previous: ContextPriorityProjection;
}): PriorityReversalPreview {
  const affected = [...new Set([
    ...input.current.rows.map((row) => row.canonicalTopicKey),
    ...input.previous.rows.map((row) => row.canonicalTopicKey),
  ])].sort();
  if (input.current.fingerprint !== input.previous.fingerprint) {
    return {
      kind: 'CONFLICT',
      reason: 'NEWER_RANKING_OR_DECISIONS_PRESENT',
      affectedCanonicalTopicKeys: affected,
    };
  }
  return {
    kind: 'READY',
    priority: input.previous,
    affectedCanonicalTopicKeys: affected,
    explanation: 'Projeção idêntica; reversão é um no-op auditável.',
  };
}
