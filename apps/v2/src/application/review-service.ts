import {
  applyReviewSuggestion,
  calculateWeakPointProjections,
  cancelCommitment,
  civilToday,
  createDefaultReviewPolicy,
  createReviewTopicLink,
  generateReviewSuggestion,
  matchBoardEvidence,
  nextReviewPolicy,
  parseBoardEvidence,
  previewPriorityReversal,
  rankContextPriorities,
  recordReviewExecution,
  rescheduleCommitment,
  stableStringify,
  type BoardEvidence,
  type ContextPriorityProjection,
  type ReviewAssessment,
  type ReviewCommitment,
  type ReviewCoverage,
  type ReviewExecution,
  type ReviewOutcome,
  type ReviewPolicy,
  type ReviewSuggestion,
  type ReviewTopicLink,
  type TopicMatchDecision,
  type WeakPointProjection,
} from '../domain/review';
import { STORES } from '../platform/indexeddb';
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
  /** Best-effort external notification is never promised while the PWA is closed. */
  externalNotificationPromise: false;
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
    const persisted = await this.repository.listPolicies(profileId);
    const current = persisted.sort((a, b) => b.version - a.version)[0] ?? createDefaultReviewPolicy(profileId);
    const next = nextReviewPolicy(current, changes);
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
      : result as ReviewOutcome<ReviewPolicy>;
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
          durationsMinutes: [],
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
        provenance: input.provenance,
      });
      const result = await this.repository.commit({
        type: 'SAVE_EXECUTION',
        scope: { profileId, operationId, baseRevision: null },
        execution: next.execution,
        commitment: next.commitment,
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
    const [topics, executions, sessions, policy, conflicts] = await Promise.all([
      this.repository.listTopics(profileId),
      this.repository.listExecutions(profileId),
      this.sessions.listSessions(profileId),
      this.getPolicy(profileId),
      this.sessions.listSessionConflicts(profileId),
    ]);
    const uncertain = uncertainTopicKeys(topics, conflicts);
    return calculateWeakPointProjections({
      profileId,
      topics,
      executions,
      sessions,
      policy,
      today,
      uncertainTopicKeys: uncertain,
    }).sort((a, b) => a.label.localeCompare(b.label));
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

  async listBoardEvidence(profileId: string): Promise<BoardEvidence[]> {
    return this.repository.listBoardEvidence(profileId);
  }

  async matchBoardEvidence(profileId: string, evidenceId: string, editalId?: string) {
    const [evidence, topics] = await Promise.all([
      this.repository.listBoardEvidence(profileId),
      this.repository.listTopics(profileId),
    ]);
    const item = evidence.find((candidate) => candidate.id === evidenceId);
    if (!item) return { candidates: [], ambiguous: false };
    return matchBoardEvidence({ evidence: item, topics, editalId });
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
    const result = await this.repository.commit({
      type: 'SAVE_PRIORITY',
      scope: { profileId, operationId, baseRevision: null },
      priority,
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
    const commitments = await this.listCommitments(profileId);
    const overdue = commitments.filter(
      (item) => item.status !== 'CANCELLED' && item.currentDueDate < today,
    );
    const dueToday = commitments.filter(
      (item) => item.status !== 'CANCELLED' && item.currentDueDate === today,
    );
    const upcoming = commitments.filter(
      (item) =>
        item.status !== 'CANCELLED' &&
        item.currentDueDate > today &&
        item.currentDueDate <= addCivilDays(today, 14),
    );
    const message =
      overdue.length + dueToday.length + upcoming.length === 0
        ? 'Nenhuma revisão pendente no horizonte local.'
        : `${overdue.length} atrasada(s), ${dueToday.length} para hoje, ${upcoming.length} próxima(s); a central local permanece disponível offline.`;
    return { overdue, dueToday, upcoming, message, externalNotificationPromise: false };
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
      counts[key] = value.length;
    }
    return { kind: 'READY', counts, data: parsed };
  }

  async applyImport(
    profileId: string,
    preview: ReviewImportPreview,
    operationId: string,
  ): Promise<ReviewOutcome<{ applied: number; partial: boolean }>> {
    if (preview.kind !== 'READY') return { kind: 'INVALID', code: preview.kind };
    const data = preview.data;
    let applied = 0;
    try {
      for (const [index, topic] of ((data.topics as ReviewTopicLink[]) ?? []).entries()) {
        const existing = await this.repository.load<ReviewTopicLink>(profileId, STORES.reviewTopics, topic.id);
        if (existing) {
          if (!sameImportedValue(existing, topic)) return { kind: 'CONFLICT', code: 'IMPORT_CONFLICT' };
          continue;
        }
        const result = await this.repository.commit({
          type: 'SAVE_TOPIC',
          scope: { profileId, operationId: `${operationId}~topic~${index}`, baseRevision: null },
          topic,
        });
        if (result.kind !== 'LOCAL_COMMITTED') return { kind: 'BLOCKED', reason: 'IMPORT_PARTIAL_NOT_COMMITTED' };
        applied += 1;
      }
      for (const [index, policy] of ((data.policies as ReviewPolicy[]) ?? []).entries()) {
        const existing = await this.repository.load<ReviewPolicy>(profileId, STORES.reviewPolicies, policy.id);
        if (existing) {
          if (!sameImportedValue(existing, policy)) return { kind: 'CONFLICT', code: 'IMPORT_CONFLICT' };
          continue;
        }
        const result = await this.repository.commit({
          type: 'SAVE_POLICY',
          scope: { profileId, operationId: `${operationId}~policy~${index}`, baseRevision: null },
          policy,
        });
        if (result.kind !== 'LOCAL_COMMITTED') return { kind: 'BLOCKED', reason: 'IMPORT_PARTIAL_NOT_COMMITTED' };
        applied += 1;
      }
      for (const [index, commitment] of ((data.commitments as ReviewCommitment[]) ?? []).entries()) {
        const existing = await this.repository.load<ReviewCommitment>(profileId, STORES.reviewCommitments, commitment.id);
        if (existing) {
          if (!sameImportedValue(existing, commitment)) return { kind: 'CONFLICT', code: 'IMPORT_CONFLICT' };
          continue;
        }
        const result = await this.repository.commit({
          type: 'SAVE_COMMITMENT',
          scope: { profileId, operationId: `${operationId}~commitment~${index}`, baseRevision: null },
          commitment,
        });
        if (result.kind !== 'LOCAL_COMMITTED') return { kind: 'BLOCKED', reason: 'IMPORT_PARTIAL_NOT_COMMITTED' };
        applied += 1;
      }
      for (const [index, execution] of ((data.executions as ReviewExecution[]) ?? []).entries()) {
        const existing = await this.repository.load<ReviewExecution>(profileId, STORES.reviewExecutions, execution.id);
        if (existing) {
          if (!sameImportedValue(existing, execution)) return { kind: 'CONFLICT', code: 'IMPORT_CONFLICT' };
          continue;
        }
        const result = await this.repository.commit({
          type: 'SAVE_EXECUTION',
          scope: { profileId, operationId: `${operationId}~execution~${index}`, baseRevision: null },
          execution,
        });
        if (result.kind !== 'LOCAL_COMMITTED') return { kind: 'BLOCKED', reason: 'IMPORT_PARTIAL_NOT_COMMITTED' };
        applied += 1;
      }
      for (const [index, evidence] of ((data.board as BoardEvidence[]) ?? []).entries()) {
        const existing = await this.repository.load<BoardEvidence>(profileId, STORES.reviewBoardEvidence, evidence.id);
        if (existing) {
          if (!sameImportedValue(existing, evidence)) return { kind: 'CONFLICT', code: 'IMPORT_CONFLICT' };
          continue;
        }
        const result = await this.repository.commit({
          type: 'SAVE_BOARD',
          scope: { profileId, operationId: `${operationId}~board~${index}`, baseRevision: null },
          evidence,
        });
        if (result.kind !== 'LOCAL_COMMITTED') return { kind: 'BLOCKED', reason: 'IMPORT_PARTIAL_NOT_COMMITTED' };
        applied += 1;
      }
      for (const [index, match] of ((data.matches as TopicMatchDecision[]) ?? []).entries()) {
        const existing = await this.repository.load<TopicMatchDecision>(profileId, STORES.reviewMatches, match.id);
        if (existing) {
          if (!sameImportedValue(existing, match)) return { kind: 'CONFLICT', code: 'IMPORT_CONFLICT' };
          continue;
        }
        const result = await this.repository.commit({
          type: 'SAVE_MATCH',
          scope: { profileId, operationId: `${operationId}~match~${index}`, baseRevision: null },
          match,
        });
        if (result.kind !== 'LOCAL_COMMITTED') return { kind: 'BLOCKED', reason: 'IMPORT_PARTIAL_NOT_COMMITTED' };
        applied += 1;
      }
      for (const [index, priority] of ((data.priorities as ContextPriorityProjection[]) ?? []).entries()) {
        const existing = await this.repository.load<ContextPriorityProjection>(profileId, STORES.reviewPriorities, priority.id);
        if (existing) {
          if (!sameImportedValue(existing, priority)) return { kind: 'CONFLICT', code: 'IMPORT_CONFLICT' };
          continue;
        }
        const result = await this.repository.commit({
          type: 'SAVE_PRIORITY',
          scope: { profileId, operationId: `${operationId}~priority~${index}`, baseRevision: null },
          priority,
        });
        if (result.kind !== 'LOCAL_COMMITTED') return { kind: 'BLOCKED', reason: 'IMPORT_PARTIAL_NOT_COMMITTED' };
        applied += 1;
      }
      return { kind: 'LOCAL_COMMITTED', value: { applied, partial: false } };
    } catch {
      return { kind: 'BLOCKED', reason: 'IMPORT_PARTIAL_NOT_COMMITTED' };
    }
  }
}

function addMinutes(time: string, minutes: number): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const total = Number(match[1]) * 60 + Number(match[2]) + Math.max(1, minutes);
  const bounded = Math.min(total, 23 * 60 + 59);
  return `${String(Math.floor(bounded / 60)).padStart(2, '0')}:${String(bounded % 60).padStart(2, '0')}`;
}

function sameImportedValue(left: unknown, right: unknown): boolean {
  const strip = (value: unknown): unknown => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const copy = { ...(value as Record<string, unknown>) };
    delete copy.localRevision;
    return copy;
  };
  return stableStringify(strip(left)) === stableStringify(strip(right));
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
