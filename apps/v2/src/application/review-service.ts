import {
  applyReviewSuggestion,
  calculateWeakPointProjections,
  cancelCommitment,
  civilToday,
  createDefaultReviewPolicy,
  createDefaultReviewReminderSettings,
  createReviewTopicLink,
  generateReviewSuggestion,
  matchBoardEvidence,
  nextReviewPolicy,
  parseBoardEvidence,
  previewReviewPolicyImpact,
  previewPriorityReversal,
  rankContextPriorities,
  recordReviewExecution,
  isReminderQuietHours,
  reminderNotificationKey,
  rescheduleCommitment,
  REVIEW_PROJECTION_ALGORITHM_VERSION,
  stableStringify,
  type BoardEvidence,
  type ContextPriorityProjection,
  type MaterializedReviewProjection,
  type ReviewAssessment,
  type ReviewCommitment,
  type ReviewCoverage,
  type ReviewExecution,
  type ReviewOutcome,
  type ReviewPolicy,
  type ReviewPolicyImpactPreview,
  type ReviewReminderSettings,
  type ReviewTopicOverride,
  type ReviewSuggestion,
  type ReviewTopicLink,
  type TopicMatchDecision,
  type WeakPointProjection,
} from '../domain/review';
import type { LocalReviewRepository } from '../platform/local-review-repository';
import type { LocalSessionRepository } from '../platform/local-session-repository';
import type { LocalPlanningRepository } from '../platform/local-planning-repository';
import type { SessionConflict } from '../domain/session-conflicts';
import type { PlanBlock } from '../domain/planning';
import {
  evaluateDailyCapacity,
  selectOfficialReservations,
  type WeeklyAvailability,
} from '../domain/planning-capacity';
import { addCivilDays } from '../domain/planning-time';

export type ReviewServiceOptions = {
  now?: () => string;
  zone?: string;
};

const REVIEW_WEEKLY: WeeklyAvailability = {
  timeZone: 'America/Fortaleza',
  days: {
    MON: [{ start: '08:00', end: '11:00' }],
    TUE: [{ start: '08:00', end: '11:00' }],
    WED: [{ start: '08:00', end: '11:00' }],
    THU: [{ start: '08:00', end: '11:00' }],
    FRI: [{ start: '08:00', end: '11:00' }],
    SAT: [{ start: '08:00', end: '10:00' }],
  },
};

export type ReviewPlacementPreview =
  | {
      kind: 'READY';
      civilDate: string;
      durationMinutes: number;
      remainingMinutes: number;
      scenarioId: string;
      block: PlanBlock;
      explanation: string;
    }
  | {
      kind: 'UNALLOCATED';
      civilDate: string;
      durationMinutes: number;
      remainingMinutes: number;
      explanation: string;
    }
  | { kind: 'BLOCKED'; reason: string };

export type ReviewImportPreview =
  | {
      kind: 'READY';
      counts: Record<string, number>;
      data: Record<string, unknown>;
    }
  | { kind: 'INVALID'; reason: string }
  | { kind: 'CONFLICT'; reason: string };

export type ReviewReminderSummary = {
  overdue: ReviewCommitment[];
  dueToday: ReviewCommitment[];
  upcoming: ReviewCommitment[];
  message: string;
  settings: ReviewReminderSettings;
  dismissedIds: string[];
  quietActive: boolean;
  /** Best-effort external notification is never promised while the PWA is closed. */
  externalNotificationPromise: false;
};

export type ExternalNotificationClaim =
  | 'CLAIMED'
  | 'DUPLICATE'
  | 'DISABLED'
  | 'SUPPRESSED_QUIET';

export type ReviewPolicyPreviewResult =
  | ReviewPolicyImpactPreview
  | { kind: 'INVALID'; code: string };

export type WeakPointProjectionStatus = {
  kind: 'MISSING' | 'READY' | 'STALE';
  fingerprint: string;
  rows: number;
  reason?: string;
  projection: MaterializedReviewProjection | null;
};

export type WeakPointProjectionBuild = {
  projection: MaterializedReviewProjection;
  batches: number;
  rows: number;
};

export class ReviewService {
  private readonly repository: LocalReviewRepository;
  private readonly sessions: LocalSessionRepository;
  private readonly planning: LocalPlanningRepository;
  private readonly now: () => string;
  private readonly zone: string;

  constructor(
    repository: LocalReviewRepository,
    sessions: LocalSessionRepository,
    planning: LocalPlanningRepository,
    options: ReviewServiceOptions = {},
  ) {
    this.repository = repository;
    this.sessions = sessions;
    this.planning = planning;
    this.now = options.now ?? (() => new Date().toISOString());
    this.zone = options.zone ?? 'America/Fortaleza';
  }

  today(): string {
    return civilToday(this.zone, new Date(this.now()));
  }

  private async replay<T>(
    operationId: string,
    matches: (command: Record<string, unknown>) => boolean,
  ): Promise<ReviewOutcome<T> | null> {
    const existing = await this.repository.getOperation(operationId);
    if (!existing) return null;
    if (!matches(existing.command as Record<string, unknown>)) {
      return { kind: 'INVALID', code: 'OPERATION_ID_REUSED' };
    }
    return existing.outcome as ReviewOutcome<T>;
  }

  async ensurePolicy(profileId: string, operationId: string): Promise<ReviewPolicy> {
    const policies = await this.repository.listPolicies(profileId);
    if (policies.length > 0) return policies.sort((a, b) => b.version - a.version)[0]!;
    const policy = createDefaultReviewPolicy(profileId);
    await this.repository.commit({ type: 'SAVE_POLICY', scope: { profileId, operationId, baseRevision: null }, policy });
    return policy;
  }

  async getPolicy(profileId: string): Promise<ReviewPolicy> {
    const policies = await this.repository.listPolicies(profileId);
    return policies.sort((a, b) => b.version - a.version)[0] ?? createDefaultReviewPolicy(profileId);
  }

  async updatePolicy(
    profileId: string,
    changes: Partial<Omit<ReviewPolicy, 'id' | 'profileId' | 'localRevision' | 'version'>>,
    operationId: string,
  ): Promise<ReviewOutcome<ReviewPolicy>> {
    const preview = await this.previewPolicyChange(profileId, changes);
    if (preview.kind !== 'READY') return preview;
    return this.applyPolicyChange(profileId, preview, operationId);
  }

  async previewPolicyChange(
    profileId: string,
    changes: Partial<Omit<ReviewPolicy, 'id' | 'profileId' | 'localRevision' | 'version'>>,
  ): Promise<ReviewPolicyPreviewResult> {
    try {
      const persisted = await this.repository.listPolicies(profileId);
      const current =
        persisted.sort((a, b) => b.version - a.version)[0] ??
        createDefaultReviewPolicy(profileId);
      const next = nextReviewPolicy(current, changes);
      const [topics, executions] = await Promise.all([
        this.repository.listTopics(profileId),
        this.repository.listExecutions(profileId),
      ]);
      const preview = previewReviewPolicyImpact({
        current,
        next,
        topics,
        executions,
        today: this.today(),
      });
      return {
        ...preview,
        baseRevision: persisted.length > 0 ? current.localRevision : null,
      };
    } catch (error) {
      return {
        kind: 'INVALID',
        code:
          error instanceof Error && 'code' in error
            ? String((error as { code: unknown }).code)
            : 'INVALID_POLICY',
      };
    }
  }

  async applyPolicyChange(
    profileId: string,
    preview: ReviewPolicyImpactPreview,
    operationId: string,
  ): Promise<ReviewOutcome<ReviewPolicy>> {
    const persisted = await this.repository.listPolicies(profileId);
    const current =
      persisted.sort((a, b) => b.version - a.version)[0] ??
      createDefaultReviewPolicy(profileId);
    const expectedRevision = persisted.length > 0 ? current.localRevision : null;
    if (expectedRevision !== preview.baseRevision || current.version !== preview.baseVersion) {
      return { kind: 'CONFLICT', code: 'STALE_POLICY' };
    }
    const result = await this.repository.commit({
      type: 'SAVE_POLICY',
      scope: {
        profileId,
        operationId,
        baseRevision: expectedRevision,
      },
      policy: preview.nextPolicy,
    });
    return result.kind === 'LOCAL_COMMITTED'
      ? { kind: 'LOCAL_COMMITTED', value: result.value as ReviewPolicy }
      : (result as ReviewOutcome<ReviewPolicy>);
  }

  /**
   * Applies one subject override against the latest persisted policy. Other
   * subjects' overrides are merged, so a stale tab cannot delete them; the
   * specific key is still guarded by its last update timestamp.
   */
  async applyPolicyOverride(
    profileId: string,
    canonicalTopicKey: string,
    override: ReviewTopicOverride | null,
    expectedUpdatedAt: string | null,
    operationId: string,
  ): Promise<ReviewOutcome<ReviewPolicy>> {
    const persisted = await this.repository.listPolicies(profileId);
    const current =
      persisted.sort((a, b) => b.version - a.version)[0] ??
      createDefaultReviewPolicy(profileId);
    const actualUpdatedAt = current.overrides?.[canonicalTopicKey]?.updatedAt ?? null;
    if (actualUpdatedAt !== expectedUpdatedAt) {
      return { kind: 'CONFLICT', code: 'STALE_OVERRIDE' };
    }
    const overrides = { ...(current.overrides ?? {}) };
    if (override) overrides[canonicalTopicKey] = override;
    else delete overrides[canonicalTopicKey];
    const next = nextReviewPolicy(current, { overrides });
    const result = await this.repository.commit({
      type: 'SAVE_POLICY',
      scope: {
        profileId,
        operationId,
        baseRevision: persisted.length > 0 ? current.localRevision : null,
      },
      policy: next,
    });
    return result.kind === 'LOCAL_COMMITTED'
      ? { kind: 'LOCAL_COMMITTED', value: result.value as ReviewPolicy }
      : (result as ReviewOutcome<ReviewPolicy>);
  }

  async createTopic(
    profileId: string,
    input: Omit<Parameters<typeof createReviewTopicLink>[0], 'profileId' | 'id'>,
    operationId: string,
  ): Promise<ReviewOutcome<ReviewTopicLink>> {
    const replay = await this.replay<ReviewTopicLink>(operationId, (command) => {
      const topic = command.topic as Record<string, unknown> | undefined;
      return (
        command.commandType === 'SAVE_TOPIC' &&
        topic?.editalDisciplineId === input.editalDisciplineId &&
        topic?.assuntoId === input.assuntoId &&
        (topic?.aulaId ?? '') === (input.aulaId ?? '')
      );
    });
    if (replay) return replay;
    const existing = await this.repository.listTopics(profileId);
    const duplicate = existing.find(
      (topic) =>
        topic.editalDisciplineId === input.editalDisciplineId &&
        topic.assuntoId === input.assuntoId &&
        (topic.aulaId ?? '') === (input.aulaId ?? ''),
    );
    if (duplicate) return { kind: 'LOCAL_COMMITTED', value: duplicate };
    const topic = createReviewTopicLink({ ...input, profileId, id: crypto.randomUUID() });
    const result = await this.repository.commit({
      type: 'SAVE_TOPIC',
      scope: { profileId, operationId, baseRevision: null },
      topic,
    });
    return result.kind === 'LOCAL_COMMITTED'
      ? { kind: 'LOCAL_COMMITTED', value: result.value as ReviewTopicLink }
      : result as ReviewOutcome<ReviewTopicLink>;
  }

  async listTopics(profileId: string): Promise<ReviewTopicLink[]> {
    return this.repository.listTopics(profileId);
  }

  async generateSuggestions(profileId: string, today = this.today()): Promise<ReviewSuggestion[]> {
    const [topics, executions, policy] = await Promise.all([
      this.repository.listTopics(profileId),
      this.repository.listExecutions(profileId),
      this.getPolicy(profileId),
    ]);
    return topics
      .map((topic) => {
        const topicExecutions = executions
          .filter((item) => item.canonicalTopicKey === topic.canonicalTopicKey)
          .sort((a, b) => a.civilDate.localeCompare(b.civilDate));
        return generateReviewSuggestion({
          topic,
          policy,
          today,
          stage: topicExecutions.length,
          lastExecution: topicExecutions.at(-1) ?? null,
          durationsMinutes: topicExecutions
            .map((item) => item.durationMinutes)
            .filter((value): value is number => typeof value === 'number'),
        });
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.label.localeCompare(b.label));
  }

  async applySuggestion(
    profileId: string,
    suggestion: ReviewSuggestion,
    operationId: string,
    source: 'MANUAL' | 'OPT_IN' = 'MANUAL',
  ): Promise<ReviewOutcome<ReviewCommitment>> {
    const replay = await this.replay<ReviewCommitment>(operationId, (command) => {
      const commitment = command.commitment as Record<string, unknown> | undefined;
      return (
        command.commandType === 'SAVE_COMMITMENT' &&
        commitment?.canonicalTopicKey === suggestion.canonicalTopicKey &&
        commitment?.currentDueDate === suggestion.dueDate
      );
    });
    if (replay) return replay;
    const commitment = applyReviewSuggestion({
      suggestion,
      id: crypto.randomUUID(),
      source,
      at: this.now(),
    });
    const result = await this.repository.commit({
      type: 'SAVE_COMMITMENT',
      scope: { profileId, operationId, baseRevision: null },
      commitment,
    });
    return result.kind === 'LOCAL_COMMITTED'
      ? { kind: 'LOCAL_COMMITTED', value: result.value as ReviewCommitment }
      : result as ReviewOutcome<ReviewCommitment>;
  }

  async applyAutoApproved(
    profileId: string,
    operationId: string,
  ): Promise<ReviewOutcome<ReviewCommitment[]>> {
    const policy = await this.getPolicy(profileId);
    if (!policy.autoApprove) return { kind: 'INVALID', code: 'AUTO_APPROVE_DISABLED' };
    const suggestions = await this.generateSuggestions(profileId);
    const horizon = addCivilDays(this.today(), policy.autoApproveHorizonDays);
    const approved: ReviewCommitment[] = [];
    for (const [index, suggestion] of suggestions.entries()) {
      if (suggestion.dueDate > horizon) continue;
      const result = await this.applySuggestion(
        profileId,
        suggestion,
        `${operationId}~${index}`,
        'OPT_IN',
      );
      if (result.kind === 'LOCAL_COMMITTED') approved.push(result.value);
      else if (result.kind === 'CONFLICT' && result.code === 'DUPLICATE_COMMITMENT') continue;
      else return result as ReviewOutcome<ReviewCommitment[]>;
    }
    return { kind: 'LOCAL_COMMITTED', value: approved };
  }

  async listCommitments(profileId: string): Promise<ReviewCommitment[]> {
    return (await this.repository.listCommitments(profileId)).sort(
      (a, b) => a.currentDueDate.localeCompare(b.currentDueDate) || a.label.localeCompare(b.label),
    );
  }

  async recordExecution(
    profileId: string,
    input: {
      commitmentId?: string;
      canonicalTopicKey: string;
      civilDate: string;
      assessment: ReviewAssessment;
      coverage: ReviewCoverage;
      source?: 'F5' | 'F4';
      sessionId?: string;
      allocationId?: string;
      durationMinutes?: number;
      provenance: string;
    },
    operationId: string,
  ): Promise<ReviewOutcome<{ execution: ReviewExecution; commitment: ReviewCommitment | null }>> {
    const replay = await this.replay<{ execution: ReviewExecution; commitment: ReviewCommitment | null }>(
      operationId,
      (command) => {
        const execution = command.execution as Record<string, unknown> | undefined;
        return (
          command.commandType === 'SAVE_EXECUTION' &&
          execution?.canonicalTopicKey === input.canonicalTopicKey &&
          (execution?.commitmentId ?? undefined) === (input.commitmentId ?? undefined) &&
          execution?.civilDate === input.civilDate &&
          execution?.assessment === input.assessment &&
          execution?.coverage === input.coverage
        );
      },
    );
    if (replay) return replay;
    const commitment = input.commitmentId
      ? (await this.repository.listCommitments(profileId)).find((item) => item.id === input.commitmentId)
      : null;
    try {
      const next = recordReviewExecution({
        id: crypto.randomUUID(),
        profileId,
        canonicalTopicKey: input.canonicalTopicKey,
        commitment,
        civilDate: input.civilDate,
        assessment: input.assessment,
        coverage: input.coverage,
        source: input.source,
        sessionId: input.sessionId,
        allocationId: input.allocationId,
        durationMinutes: input.durationMinutes,
        provenance: input.provenance,
      });
      const result = await this.repository.commit({
        type: 'SAVE_EXECUTION',
        scope: { profileId, operationId, baseRevision: null },
        execution: next.execution,
        commitment: next.commitment,
        commitmentBaseRevision: commitment?.localRevision ?? null,
      });
      return result.kind === 'LOCAL_COMMITTED'
        ? { kind: 'LOCAL_COMMITTED', value: next }
        : result as ReviewOutcome<{ execution: ReviewExecution; commitment: ReviewCommitment | null }>;
    } catch (error) {
      return { kind: 'INVALID', code: error instanceof Error && 'code' in error ? String((error as { code: unknown }).code) : 'INVALID_EXECUTION' };
    }
  }

  async reschedule(
    profileId: string,
    commitmentId: string,
    dueDate: string,
    operationId: string,
  ): Promise<ReviewOutcome<ReviewCommitment>> {
    const replay = await this.replay<ReviewCommitment>(operationId, (command) => {
      const commitment = command.commitment as Record<string, unknown> | undefined;
      return (
        command.commandType === 'SAVE_COMMITMENT' &&
        commitment?.id === commitmentId &&
        commitment?.currentDueDate === dueDate
      );
    });
    if (replay) return replay;
    const current = (await this.repository.listCommitments(profileId)).find((item) => item.id === commitmentId);
    if (!current) return { kind: 'INVALID', code: 'COMMITMENT_NOT_FOUND' };
    try {
      const next = rescheduleCommitment({ commitment: current, dueDate, at: this.now() });
      const result = await this.repository.commit({
        type: 'SAVE_COMMITMENT',
        scope: { profileId, operationId, baseRevision: current.localRevision },
        commitment: next,
      });
      return result.kind === 'LOCAL_COMMITTED'
        ? { kind: 'LOCAL_COMMITTED', value: result.value as ReviewCommitment }
        : result as ReviewOutcome<ReviewCommitment>;
    } catch (error) {
      return { kind: 'INVALID', code: error instanceof Error && 'code' in error ? String((error as { code: unknown }).code) : 'INVALID_TRANSITION' };
    }
  }

  async cancel(profileId: string, commitmentId: string, operationId: string): Promise<ReviewOutcome<ReviewCommitment>> {
    const replay = await this.replay<ReviewCommitment>(operationId, (command) => {
      const commitment = command.commitment as Record<string, unknown> | undefined;
      return command.commandType === 'SAVE_COMMITMENT' && commitment?.id === commitmentId && commitment?.status === 'CANCELLED';
    });
    if (replay) return replay;
    const current = (await this.repository.listCommitments(profileId)).find((item) => item.id === commitmentId);
    if (!current) return { kind: 'INVALID', code: 'COMMITMENT_NOT_FOUND' };
    const next = cancelCommitment({ commitment: current, at: this.now() });
    const result = await this.repository.commit({
      type: 'SAVE_COMMITMENT',
      scope: { profileId, operationId, baseRevision: current.localRevision },
      commitment: next,
    });
    return result.kind === 'LOCAL_COMMITTED'
      ? { kind: 'LOCAL_COMMITTED', value: result.value as ReviewCommitment }
      : result as ReviewOutcome<ReviewCommitment>;
  }

  async weakPoints(profileId: string, today = this.today()): Promise<WeakPointProjection[]> {
    return (await this.weakPointInputs(profileId, today)).rows;
  }

  private async weakPointInputs(profileId: string, today = this.today()) {
    const [topics, executions, sessions, policy, conflicts] = await Promise.all([
      this.repository.listTopics(profileId),
      this.repository.listExecutions(profileId),
      this.sessions.listSessions(profileId),
      this.getPolicy(profileId),
      this.sessions.listSessionConflicts(profileId),
    ]);
    const uncertain = uncertainTopicKeys(topics, conflicts);
    const rows = calculateWeakPointProjections({
      profileId,
      topics,
      executions,
      sessions,
      policy,
      today,
      uncertainTopicKeys: uncertain,
    }).sort((a, b) => a.label.localeCompare(b.label));
    return {
      topics,
      executions,
      sessions,
      policy,
      conflicts,
      uncertain,
      today,
      rows,
      fingerprint: weakPointsFingerprint({
        policy,
        topics,
        executions,
        sessions,
        conflicts,
        rows,
        today,
      }),
    };
  }

  async weakPointProjectionStatus(profileId: string): Promise<WeakPointProjectionStatus> {
    const inputs = await this.weakPointInputs(profileId);
    const projection = await this.repository.loadProjection(
      profileId,
      `weak-points:${profileId}`,
    );
    if (!projection) {
      return { kind: 'MISSING', fingerprint: inputs.fingerprint, rows: inputs.rows.length, projection: null };
    }
    if (projection.status !== 'READY') {
      return {
        kind: 'STALE',
        fingerprint: inputs.fingerprint,
        rows: inputs.rows.length,
        reason: 'STORED_STALE',
        projection,
      };
    }
    if (projection.algorithmVersion !== REVIEW_PROJECTION_ALGORITHM_VERSION) {
      return {
        kind: 'STALE',
        fingerprint: inputs.fingerprint,
        rows: inputs.rows.length,
        reason: 'ALGORITHM_CHANGED',
        projection,
      };
    }
    if (
      projection.fingerprint !== inputs.fingerprint ||
      projection.policyVersion !== inputs.policy.version
    ) {
      return {
        kind: 'STALE',
        fingerprint: inputs.fingerprint,
        rows: inputs.rows.length,
        reason: 'INPUTS_CHANGED',
        projection,
      };
    }
    return {
      kind: 'READY',
      fingerprint: inputs.fingerprint,
      rows: inputs.rows.length,
      projection,
    };
  }

  /**
   * Rebuilds in bounded topic batches. Rows are only published after a second
   * fingerprint read proves that no dependency changed during the build, and
   * the repository CAS refuses a generation that lost the publication race.
   */
  async rebuildWeakPointsProjection(
    profileId: string,
    options: {
      batchSize?: number;
      /** Deterministic progress hook used by tests and long-running callers. */
      onBatch?: (batch: number) => void | Promise<void>;
    } = {},
  ): Promise<ReviewOutcome<WeakPointProjectionBuild>> {
    const batchSize = Math.max(
      1,
      Math.min(200, Math.floor(options.batchSize ?? 50) || 50),
    );
    const current = await this.repository.loadProjection(
      profileId,
      `weak-points:${profileId}`,
    );
    const before = await this.weakPointInputs(profileId);
    const rows: WeakPointProjection[] = [];
    let batches = 0;
    for (let offset = 0; offset < before.topics.length; offset += batchSize) {
      const chunk = before.topics.slice(offset, offset + batchSize);
      batches += 1;
      rows.push(
        ...calculateWeakPointProjections({
          profileId,
          topics: chunk,
          executions: before.executions,
          sessions: before.sessions,
          policy: before.policy,
          today: before.today,
          uncertainTopicKeys: before.uncertain,
        }),
      );
      await options.onBatch?.(batches);
    }
    rows.sort((a, b) => a.label.localeCompare(b.label));
    const after = await this.weakPointInputs(profileId);
    if (after.fingerprint !== before.fingerprint) {
      return { kind: 'BLOCKED', reason: 'INPUTS_CHANGED_DURING_BUILD' };
    }
    const record: MaterializedReviewProjection = {
      id: `weak-points:${profileId}`,
      profileId,
      kind: 'WEAK_POINTS',
      scopeKey: 'profile',
      algorithmVersion: REVIEW_PROJECTION_ALGORITHM_VERSION,
      policyVersion: before.policy.version,
      inputRevision: Math.max(
        0,
        ...before.topics.map((item) => item.localRevision),
        ...before.executions.map((item) => item.localRevision),
        ...before.sessions.map((item) => item.localRevision),
      ),
      fingerprint: before.fingerprint,
      generationId: crypto.randomUUID(),
      generatedAt: this.now(),
      status: 'READY',
      payload: rows,
    };
    const published = await this.repository.publishProjection({
      record,
      expectedGenerationId: current?.generationId ?? null,
      expectedFingerprint: current?.fingerprint ?? null,
    });
    if (published.kind !== 'LOCAL_COMMITTED') {
      return published as ReviewOutcome<WeakPointProjectionBuild>;
    }
    return {
      kind: 'LOCAL_COMMITTED',
      value: { projection: published.value, batches: Math.max(1, batches), rows: rows.length },
    };
  }

  async saveBoardEvidence(
    profileId: string,
    input: Omit<Parameters<typeof parseBoardEvidence>[0], 'id' | 'profileId'>,
    operationId: string,
  ): Promise<ReviewOutcome<BoardEvidence>> {
    const replay = await this.replay<BoardEvidence>(operationId, (command) => {
      const evidence = command.evidence as Record<string, unknown> | undefined;
      return command.commandType === 'SAVE_BOARD' && evidence?.text === input.text;
    });
    if (replay) return replay;
    try {
      const evidence = parseBoardEvidence({ ...input, id: crypto.randomUUID(), profileId });
      const result = await this.repository.commit({
        type: 'SAVE_BOARD',
        scope: { profileId, operationId, baseRevision: null },
        evidence,
      });
      return result.kind === 'LOCAL_COMMITTED'
        ? { kind: 'LOCAL_COMMITTED', value: result.value as BoardEvidence }
        : result as ReviewOutcome<BoardEvidence>;
    } catch (error) {
      return { kind: 'INVALID', code: error instanceof Error && 'code' in error ? String((error as { code: unknown }).code) : 'INVALID_EVIDENCE' };
    }
  }

  async saveBoardEvidenceVersion(
    profileId: string,
    previousId: string,
    input: Omit<Parameters<typeof parseBoardEvidence>[0], 'id' | 'profileId' | 'version' | 'supersedes'>,
    operationId: string,
  ): Promise<ReviewOutcome<BoardEvidence>> {
    const previous = (await this.repository.listBoardEvidence(profileId)).find(
      (item) => item.id === previousId,
    );
    if (!previous) return { kind: 'INVALID', code: 'EVIDENCE_NOT_FOUND' };
    try {
      const evidence = parseBoardEvidence({
        ...input,
        id: crypto.randomUUID(),
        profileId,
        version: previous.version + 1,
        supersedes: previous.id,
      });
      const result = await this.repository.commit({
        type: 'SAVE_BOARD',
        scope: { profileId, operationId, baseRevision: null },
        evidence,
      });
      return result.kind === 'LOCAL_COMMITTED'
        ? { kind: 'LOCAL_COMMITTED', value: result.value as BoardEvidence }
        : result as ReviewOutcome<BoardEvidence>;
    } catch (error) {
      return { kind: 'INVALID', code: error instanceof Error && 'code' in error ? String((error as { code: unknown }).code) : 'INVALID_EVIDENCE' };
    }
  }

  async listBoardEvidence(profileId: string): Promise<BoardEvidence[]> {
    return this.repository.listBoardEvidence(profileId);
  }

  async matchBoardEvidence(
    profileId: string,
    evidenceId: string,
    editalId?: string,
    excludedEditalIds: string[] = [],
  ) {
    const [evidence, topics] = await Promise.all([
      this.repository.listBoardEvidence(profileId),
      this.repository.listTopics(profileId),
    ]);
    const item = evidence.find((candidate) => candidate.id === evidenceId);
    if (!item) return { candidates: [], ambiguous: false };
    const result = matchBoardEvidence({ evidence: item, topics, editalId });
    const excluded = new Set(excludedEditalIds);
    if (excluded.size === 0) return result;
    return {
      ...result,
      candidates: result.candidates.filter(
        (candidate) => !excluded.has(candidate.topic.editalId),
      ),
    };
  }

  async confirmMatch(
    profileId: string,
    input: {
      evidenceId: string;
      topicLinkId: string;
      canonicalTopicKey: string;
      editalId: string;
      assuntoId: string;
      decision: 'ACCEPTED' | 'REJECTED' | 'PENDING';
      score: number;
      reason: string;
    },
    operationId: string,
  ): Promise<ReviewOutcome<TopicMatchDecision>> {
    const replay = await this.replay<TopicMatchDecision>(operationId, (command) => {
      const match = command.match as Record<string, unknown> | undefined;
      return (
        command.commandType === 'SAVE_MATCH' &&
        match?.evidenceId === input.evidenceId &&
        match?.topicLinkId === input.topicLinkId &&
        match?.decision === input.decision
      );
    });
    if (replay) return replay;
    const match: TopicMatchDecision = {
      id: crypto.randomUUID(),
      profileId,
      evidenceId: input.evidenceId,
      topicLinkId: input.topicLinkId,
      canonicalTopicKey: input.canonicalTopicKey,
      editalId: input.editalId,
      assuntoId: input.assuntoId,
      decision: input.decision,
      score: input.score,
      reason: input.reason,
      localRevision: 1,
    };
    const result = await this.repository.commit({
      type: 'SAVE_MATCH',
      scope: { profileId, operationId, baseRevision: null },
      match,
    });
    return result.kind === 'LOCAL_COMMITTED'
      ? { kind: 'LOCAL_COMMITTED', value: result.value as TopicMatchDecision }
      : result as ReviewOutcome<TopicMatchDecision>;
  }

  async previewPriorities(profileId: string, editalId: string, today = this.today()): Promise<ContextPriorityProjection> {
    const [topics, weakPoints, evidence, matches, policy, scenarios] = await Promise.all([
      this.repository.listTopics(profileId),
      this.weakPoints(profileId, today),
      this.repository.listBoardEvidence(profileId),
      this.repository.listMatches(profileId),
      this.getPolicy(profileId),
      this.planning.listScenarios(profileId, editalId),
    ]);
    const active = scenarios.find((scenario) => scenario.status === 'ACTIVE');
    return rankContextPriorities({
      profileId,
      editalId,
      topics,
      weakPoints,
      evidence,
      matches,
      examDate: active?.examDate ?? null,
      today,
      policy,
      generatedAt: this.now(),
    });
  }

  async savePriority(profileId: string, priority: ContextPriorityProjection, operationId: string): Promise<ReviewOutcome<ContextPriorityProjection>> {
    const expected = await this.previewPriorities(profileId, priority.editalId, this.today());
    if (priority.profileId !== profileId || priority.editalId !== expected.editalId) {
      return { kind: 'INVALID', code: 'INVALID_PROJECTION_SCOPE' };
    }
    if (priority.fingerprint !== expected.fingerprint) {
      return { kind: 'CONFLICT', code: 'STALE_PROJECTION' };
    }
    const result = await this.repository.commit({
      type: 'SAVE_PRIORITY',
      scope: { profileId, operationId, baseRevision: null },
      priority: expected,
    });
    return result.kind === 'LOCAL_COMMITTED'
      ? { kind: 'LOCAL_COMMITTED', value: result.value as ContextPriorityProjection }
      : result as ReviewOutcome<ContextPriorityProjection>;
  }

  async previewPriorityReversal(profileId: string, editalId: string, previousId: string) {
    const priorities = (await this.repository.listPriorities(profileId))
      .filter((item) => item.editalId === editalId)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    const current = priorities[0];
    const previous = priorities.find((item) => item.id === previousId);
    if (!current || !previous) {
      return { kind: 'CONFLICT' as const, reason: 'RANKING_NOT_FOUND', affectedCanonicalTopicKeys: [] };
    }
    return previewPriorityReversal({ current, previous });
  }

  async previewPlacement(
    profileId: string,
    commitmentId: string,
    civilDate: string,
    start = '08:00',
    durationMinutes?: number,
  ): Promise<ReviewPlacementPreview> {
    const commitment = (await this.repository.listCommitments(profileId)).find(
      (item) => item.id === commitmentId,
    );
    if (!commitment) return { kind: 'BLOCKED', reason: 'COMMITMENT_NOT_FOUND' };
    const topics = await this.repository.listTopics(profileId);
    const topic = topics.find((item) => item.id === commitment.topicLinkId);
    if (!topic) return { kind: 'BLOCKED', reason: 'TOPIC_NOT_FOUND' };
    const scenarios = await this.planning.listScenarios(profileId, commitment.editalId);
    const active = scenarios.find((scenario) => scenario.status === 'ACTIVE');
    if (!active) {
      return { kind: 'BLOCKED', reason: 'NO_ACTIVE_SCENARIO' };
    }
    const allScenarios = await this.planning.listScenarios(profileId);
    const blocks = await this.planning.listBlocks(profileId);
    const official = selectOfficialReservations(allScenarios, blocks, profileId);
    const duration = durationMinutes ?? (await this.getPolicy(profileId)).defaultDurationMinutes;
    const capacity = evaluateDailyCapacity({
      date: civilDate,
      zone: this.zone,
      weekly: REVIEW_WEEKLY,
      exceptions: [],
      reservations: official,
    });
    if (capacity.remainingMinutes < duration) {
      return {
        kind: 'UNALLOCATED',
        civilDate,
        durationMinutes: duration,
        remainingMinutes: capacity.remainingMinutes,
        explanation: `Capacidade global insuficiente: ${capacity.remainingMinutes} min disponíveis para ${duration} min.`,
      };
    }
    const block: PlanBlock = {
      id: `review-block-${commitment.id}-${civilDate}`,
      profileId,
      editalId: commitment.editalId,
      scenarioId: active.id,
      editalDisciplineId: topic.editalDisciplineId,
      assuntoId: commitment.assuntoId,
      plannedMinutes: duration,
      allocation: 'CONFIRMED_DAY',
      civilDate,
      localStart: start,
      localEnd: addMinutes(start, duration),
      timeZone: this.zone,
      priority: 0,
      localRevision: 1,
      sourceOperationId: `review-placement-${commitment.id}`,
      label: commitment.label,
    };
    return {
      kind: 'READY',
      civilDate,
      durationMinutes: duration,
      remainingMinutes: capacity.remainingMinutes,
      scenarioId: active.id,
      block,
      explanation: `Encaixe em ${civilDate} ${start}; capacidade global ${capacity.availableMinutes} min, ${capacity.remainingMinutes} livres.`,
    };
  }

  async applyPlacement(
    profileId: string,
    commitmentId: string,
    preview: ReviewPlacementPreview,
    operationId: string,
  ): Promise<ReviewOutcome<ReviewCommitment>> {
    if (preview.kind !== 'READY') return { kind: 'BLOCKED', reason: preview.kind };
    const commitment = (await this.repository.listCommitments(profileId)).find(
      (item) => item.id === commitmentId,
    );
    if (!commitment) return { kind: 'INVALID', code: 'COMMITMENT_NOT_FOUND' };
    const snapshot = await this.planning.loadScenario(profileId, preview.scenarioId);
    if (!snapshot) return { kind: 'BLOCKED', reason: 'NO_ACTIVE_SCENARIO' };
    const planningResult = await this.planning.commit({
      scope: { profileId, operationId, baseRevision: snapshot.scenario.localRevision },
      scenarioId: preview.scenarioId,
      baseRevision: snapshot.scenario.localRevision,
      changes: { upsertBlocks: [preview.block] },
      summary: 'F5 review placement',
    });
    if (planningResult.kind !== 'LOCAL_COMMITTED') {
      return planningResult.kind === 'CONFLICT'
        ? { kind: 'CONFLICT', code: 'PLANNING_CONFLICT' }
        : { kind: 'BLOCKED', reason: planningResult.kind };
    }
    const next: ReviewCommitment = {
      ...commitment,
      planBlockId: preview.block.id,
      localRevision: commitment.localRevision + 1,
      history: [
        ...commitment.history,
        { type: 'RECONCILED', at: this.now(), dueDate: preview.civilDate, note: 'F3_APPLIED' },
      ],
    };
    const saved = await this.repository.commit({
      type: 'SAVE_COMMITMENT',
      scope: { profileId, operationId: `${operationId}~review`, baseRevision: commitment.localRevision },
      commitment: next,
    });
    if (saved.kind !== 'LOCAL_COMMITTED') {
      // The F3 block exists; never report a joint success. The commitment keeps
      // its prior state and the UI can reconcile the link explicitly.
      return { kind: 'BLOCKED', reason: 'PLAN_BLOCK_CREATED_LINK_PENDING' };
    }
    return { kind: 'LOCAL_COMMITTED', value: saved.value as ReviewCommitment };
  }

  async reminders(profileId: string, today = this.today()): Promise<ReviewReminderSummary> {
    const [commitments, settings] = await Promise.all([
      this.listCommitments(profileId),
      this.getReminderSettings(profileId),
    ]);
    const overdue = commitments.filter(
      (item) =>
        item.status !== 'CANCELLED' &&
        item.status !== 'FULFILLED' &&
        item.currentDueDate < today,
    );
    const dueToday = commitments.filter(
      (item) =>
        item.status !== 'CANCELLED' &&
        item.status !== 'FULFILLED' &&
        item.currentDueDate === today,
    );
    const upcoming = commitments.filter(
      (item) =>
        item.status !== 'CANCELLED' &&
        item.status !== 'FULFILLED' &&
        item.currentDueDate > today &&
        item.currentDueDate <= addCivilDays(today, 14),
    );
    const message =
      overdue.length + dueToday.length + upcoming.length === 0
        ? 'Nenhuma revisão pendente no horizonte local.'
        : `${overdue.length} atrasada(s), ${dueToday.length} para hoje, ${upcoming.length} próxima(s); a central local permanece disponível offline.`;
    const dismissedIds = commitments
      .filter(
        (item) =>
          settings.dismissed[item.id]?.dueDate === item.currentDueDate,
      )
      .map((item) => item.id);
    const quietActive = isReminderQuietHours(
      settings,
      localClock(this.zone, new Date(this.now())),
    );
    return {
      overdue,
      dueToday,
      upcoming,
      message,
      settings,
      dismissedIds,
      quietActive,
      externalNotificationPromise: false,
    };
  }

  async getReminderSettings(profileId: string): Promise<ReviewReminderSettings> {
    return (
      (await this.repository.getReminderSettings(profileId)) ??
      createDefaultReviewReminderSettings(profileId)
    );
  }

  async updateReminderSettings(
    profileId: string,
    changes: Partial<
      Pick<
        ReviewReminderSettings,
        'externalNotifications' | 'quietStart' | 'quietEnd'
      >
    >,
  ): Promise<ReviewOutcome<ReviewReminderSettings>> {
    const stored = await this.repository.getReminderSettings(profileId);
    const current = stored ?? createDefaultReviewReminderSettings(profileId);
    return this.repository.saveReminderSettings({
      settings: {
        ...current,
        ...changes,
        updatedAt: this.now(),
      },
      expectedRevision: stored?.localRevision ?? null,
    });
  }

  /** Dismissal only hides the external notice; it never fulfils or cancels. */
  async dismissReminder(
    profileId: string,
    commitmentId: string,
  ): Promise<ReviewOutcome<ReviewReminderSettings>> {
    const commitment = (await this.listCommitments(profileId)).find(
      (item) => item.id === commitmentId,
    );
    if (!commitment) return { kind: 'INVALID', code: 'COMMITMENT_NOT_FOUND' };
    const stored = await this.repository.getReminderSettings(profileId);
    const current = stored ?? createDefaultReviewReminderSettings(profileId);
    return this.repository.saveReminderSettings({
      settings: {
        ...current,
        dismissed: {
          ...current.dismissed,
          [commitment.id]: {
            dueDate: commitment.currentDueDate,
            at: this.now(),
          },
        },
        updatedAt: this.now(),
      },
      expectedRevision: stored?.localRevision ?? null,
    });
  }

  async claimExternalNotification(
    profileId: string,
    commitment: Pick<ReviewCommitment, 'id' | 'profileId' | 'currentDueDate'>,
  ): Promise<ExternalNotificationClaim> {
    const settings = await this.repository.getReminderSettings(profileId);
    if (!settings || !settings.externalNotifications) return 'DISABLED';
    if (
      isReminderQuietHours(
        settings,
        localClock(this.zone, new Date(this.now())),
      )
    ) {
      return 'SUPPRESSED_QUIET';
    }
    const key = reminderNotificationKey(commitment, this.today());
    const claimed = await this.repository.claimNotification(
      profileId,
      key,
      this.now(),
    );
    return claimed ? 'CLAIMED' : 'DUPLICATE';
  }

  /**
   * Test claim uses an isolated lease. It never consumes the real reminder
   * key, so a failed Notification constructor cannot silence a commitment.
   */
  async claimTestNotification(profileId: string): Promise<ExternalNotificationClaim> {
    const settings = await this.repository.getReminderSettings(profileId);
    if (!settings || !settings.externalNotifications) return 'DISABLED';
    if (
      isReminderQuietHours(
        settings,
        localClock(this.zone, new Date(this.now())),
      )
    ) {
      return 'SUPPRESSED_QUIET';
    }
    const claimed = await this.repository.claimNotification(
      profileId,
      `test:${profileId}:${this.today()}`,
      this.now(),
    );
    return claimed ? 'CLAIMED' : 'DUPLICATE';
  }

  async exportData(profileId: string): Promise<string> {
    const [topics, policies, commitments, executions, board, matches, priorities] =
      await Promise.all([
        this.repository.listTopics(profileId),
        this.repository.listPolicies(profileId),
        this.repository.listCommitments(profileId),
        this.repository.listExecutions(profileId),
        this.repository.listBoardEvidence(profileId),
        this.repository.listMatches(profileId),
        this.repository.listPriorities(profileId),
      ]);
    return JSON.stringify({
      schemaVersion: 1,
      kind: 'F5_ACADEMIC_DATA',
      profileId,
      generatedAt: this.now(),
      topics,
      policies,
      commitments,
      executions,
      board,
      matches,
      priorities,
    }, null, 2);
  }

  async exportCsv(profileId: string): Promise<string> {
    const [commitments, weak] = await Promise.all([
      this.listCommitments(profileId),
      this.weakPoints(profileId),
    ]);
    const rows: unknown[][] = [
      ['tipo', 'assunto', 'vencimento', 'status', 'questoes', 'acertos'],
      ...commitments.map((item) => [
        'compromisso',
        item.label,
        item.currentDueDate,
        item.status,
        '',
        '',
      ]),
      ...weak.map((item) => [
        'ponto_fraco',
        item.label,
        '',
        item.status,
        item.questions,
        item.correctAnswers,
      ]),
    ];
    return rows.map((row) => row.map(csvCell).join(',')).join('\n');
  }

  previewImport(profileId: string, raw: string): ReviewImportPreview {
    if (typeof raw !== 'string' || raw.length > 5_000_000) {
      return { kind: 'INVALID', reason: 'FILE_TOO_LARGE' };
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { kind: 'INVALID', reason: 'INVALID_JSON' };
    }
    if (parsed.schemaVersion !== 1 || parsed.kind !== 'F5_ACADEMIC_DATA') {
      return { kind: 'INVALID', reason: 'UNSUPPORTED_FORMAT' };
    }
    if (parsed.profileId !== profileId) {
      return { kind: 'CONFLICT', reason: 'PROFILE_MISMATCH_REQUIRES_REMAP' };
    }
    const counts: Record<string, number> = {};
    for (const key of ['topics', 'policies', 'commitments', 'executions', 'board', 'matches', 'priorities']) {
      const value = parsed[key];
      if (!Array.isArray(value)) return { kind: 'INVALID', reason: `INVALID_${key.toUpperCase()}` };
      for (const item of value) {
        if (
          !item ||
          typeof item !== 'object' ||
          (item as { profileId?: unknown }).profileId !== profileId
        ) {
          return { kind: 'CONFLICT', reason: 'PROFILE_MISMATCH_REQUIRES_REMAP' };
        }
      }
      counts[key] = value.length;
    }
    return { kind: 'READY', counts, data: parsed };
  }

  async applyImport(
    profileId: string,
    preview: ReviewImportPreview,
    operationId: string,
  ): Promise<ReviewOutcome<{ applied: number; duplicate: number; receiptId: string }>> {
    if (preview.kind === 'INVALID') return { kind: 'INVALID', code: preview.reason };
    if (preview.kind === 'CONFLICT') return { kind: 'CONFLICT', code: preview.reason };
    return this.repository.commitImport({
      profileId,
      operationId,
      data: preview.data,
    });
  }
}

function addMinutes(time: string, minutes: number): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const total = Number(match[1]) * 60 + Number(match[2]) + Math.max(1, minutes);
  const bounded = Math.min(total, 23 * 60 + 59);
  return `${String(Math.floor(bounded / 60)).padStart(2, '0')}:${String(bounded % 60).padStart(2, '0')}`;
}

function localClock(zone: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(now);
  } catch {
    return now.toISOString().slice(11, 16);
  }
}

function csvCell(value: unknown): string {
  let text = value === undefined || value === null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function uncertainTopicKeys(topics: ReviewTopicLink[], conflicts: SessionConflict[]): Set<string> {
  const byScope = new Map<string, string>();
  for (const topic of topics) {
    byScope.set(`${topic.editalDisciplineId}::${topic.assuntoId}`, topic.canonicalTopicKey);
  }
  const result = new Set<string>();
  for (const conflict of conflicts) {
    if (conflict.status === 'RESOLVED' && conflict.resolution !== 'INCOMING') continue;
    for (const allocation of [...conflict.local.allocations ?? [], ...conflict.incoming.allocations ?? []]) {
      if (!allocation.assuntoId || !allocation.editalDisciplineId) continue;
      const key = byScope.get(`${allocation.editalDisciplineId}::${allocation.assuntoId}`);
      if (key) result.add(key);
    }
  }
  return result;
}

/**
 * Dependency fingerprint for the weak-point cache. It intentionally includes
 * only fields that can change the projection: F2 topic identity/labels, F5
 * executions, F4 sessions/allocations/measurements, conflicts and the policy.
 */
function weakPointsFingerprint(input: {
  policy: ReviewPolicy;
  topics: ReviewTopicLink[];
  executions: ReviewExecution[];
  sessions: Awaited<ReturnType<LocalSessionRepository['listSessions']>>;
  conflicts: SessionConflict[];
  rows: WeakPointProjection[];
  today: string;
}): string {
  return stableStringify({
    algorithm: REVIEW_PROJECTION_ALGORITHM_VERSION,
    today: input.today,
    policy: input.policy,
    topics: input.topics
      .map((item) => [
        item.id,
        item.canonicalTopicKey,
        item.label,
        item.localRevision,
        item.tombstone === true,
      ])
      .sort(),
    executions: input.executions
      .map((item) => [
        item.id,
        item.canonicalTopicKey,
        item.civilDate,
        item.assessment,
        item.coverage,
        item.durationMinutes ?? null,
        item.localRevision,
        item.tombstone === true,
      ])
      .sort(),
    sessions: input.sessions
      .map((item) => [
        item.id,
        item.localRevision,
        item.state,
        item.recordedAtCivilDate ?? null,
        item.tombstone === true,
        (item.allocations ?? [])
          .map((allocation) => [
            allocation.allocationId,
            allocation.editalDisciplineId,
            allocation.assuntoId,
            allocation.durationMs,
          ])
          .sort(),
        (item.measurements ?? [])
          .map((measurement) => [
            measurement.id,
            measurement.allocationId ?? null,
            measurement.questions,
            measurement.correctAnswers,
          ])
          .sort(),
      ])
      .sort(),
    conflicts: input.conflicts
      .map((item) => [
        item.id,
        item.status,
        item.local.localRevision,
        item.incoming.localRevision,
        item.resolution ?? null,
      ])
      .sort(),
    rows: input.rows.map((item) => item.fingerprint).sort(),
  });
}
