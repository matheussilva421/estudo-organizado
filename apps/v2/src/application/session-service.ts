import {
  SessionValidationError,
  validateSession,
  type ClockObservation,
  type SessionOrigin,
  type SessionOutcome,
  type SessionScope,
  type SessionInterval,
  type StudySession,
} from '../domain/session';
import {
  inspectContinuity,
  sumVerifiedFocusMs,
  type ClockPort,
  type ContinuityPolicy,
} from '../domain/session-clock';
import { DOMAIN_SCHEMA_VERSION } from '../domain/versions';
import { isCivilDate, isValidTimeZone } from '../domain/planning-time';
import type { PlanBlock } from '../domain/planning';
import { openV2Database, requestResult, STORES } from '../platform/indexeddb';
import {
  nextPomodoroStep,
  type PomodoroStep,
  type PomodoroStepInput,
} from '../domain/session-pomodoro';
import type { LocalSessionRepository } from '../platform/local-session-repository';
import type { SessionFactsPatch } from '../platform/local-session-repository';
import type { SessionAuditRecord } from '../platform/local-session-repository';
import {
  validateMaterialRef,
  validateMeasurement,
} from '../domain/session-measurements';
import { allocateFocus } from '../domain/session-accounting';
import type { SessionAuthority } from '../platform/session-coordination';

export type StartSessionInput = {
  scope: SessionScope;
  sessionId: string;
  origin: Exclude<SessionOrigin, 'MANUAL'>;
  authority: SessionAuthority;
  referenceZone?: string | null;
  recordedAtCivilDate?: string;
  planBlockIds?: string[];
  editalIds?: string[];
};

export type SessionControlInput = {
  scope: SessionScope;
  sessionId: string;
  authority: SessionAuthority;
  checkpoint?: {
    intervalId: string;
    verifiedMs: number;
    checkpoint: ClockObservation;
    endedAt?: string;
  };
};

export type SwitchActiveSessionInput = {
  scope: SessionScope;
  fromSessionId: string;
  toSessionId: string;
  authority: SessionAuthority;
  origin?: Exclude<SessionOrigin, 'MANUAL'>;
  referenceZone?: string | null;
  recordedAtCivilDate?: string;
  planBlockIds?: string[];
  editalIds?: string[];
};

export type CheckpointSessionInput = {
  scope: SessionScope;
  sessionId: string;
  authority: SessionAuthority;
  intervalId: string;
  verifiedMs: number;
  checkpoint: ClockObservation;
};

export type RecoveryDecision =
  | 'RESUME'
  | 'COMPLETE'
  | 'CORRECT_MANUALLY'
  | 'KEEP_PENDING';

export type RecoveryPreview = {
  durableVerifiedMs: number;
  uncertainIntervals: SessionInterval[];
  lastCheckpoint: ClockObservation | null;
  allowedActions: RecoveryDecision[];
};

export type RecoverSessionInput = {
  scope: SessionScope;
  sessionId: string;
  decision: RecoveryDecision;
  manualAdjustmentMs?: number;
  authority: SessionAuthority;
};

export type StudySessionServiceOptions = {
  recoveryPolicy?: ContinuityPolicy;
};

export type FlagInactiveSessionInput = {
  scope: SessionScope;
  sessionId: string;
  authority: SessionAuthority;
  observation: ClockObservation;
};

export type RegisterManualSessionInput = {
  scope: SessionScope;
  sessionId: string;
  civilDate: string;
  referenceZone: string;
  durationMs: number;
  note?: string;
  authority: SessionAuthority;
};

export type LinkSessionToPlanInput = {
  scope: SessionScope;
  sessionId: string;
  blockIds: string[];
  authority: SessionAuthority;
};

export type PlanProgressChoice = 'CONCLUDED' | 'PARTIAL' | 'NOT_APPLIED';

export type ReconcilePlanProgressInput = {
  scope: SessionScope;
  sessionId: string;
  blockId: string;
  choice: PlanProgressChoice;
  planningBaseRevision: number;
  authority: SessionAuthority;
};

export type ReconcilePlanProgressResult = {
  kind: 'LOCAL_COMMITTED' | 'CONFLICT' | 'FAILED';
  planApplied: boolean;
  code?: string;
};

export type EditSessionFactsInput = {
  scope: SessionScope;
  sessionId: string;
  authority: SessionAuthority;
  patch: SessionFactsPatch;
  reason?: string;
};

export type DeleteSessionInput = {
  scope: SessionScope;
  sessionId: string;
  authority: SessionAuthority;
  reason?: string;
};

function invalid<T = StudySession>(code: string): SessionOutcome<T> {
  return { kind: 'INVALID', code };
}

function validationFailure<T = StudySession>(error: unknown): SessionOutcome<T> {
  if (error instanceof SessionValidationError) {
    return { kind: 'INVALID', code: error.code };
  }
  return { kind: 'FAILED', reason: 'VALIDATION' };
}

export class StudySessionService {
  private readonly recoveryPolicy: ContinuityPolicy;

  constructor(
    private readonly repository: LocalSessionRepository,
    private readonly clock: ClockPort,
    options: StudySessionServiceOptions = {},
  ) {
    this.recoveryPolicy = options.recoveryPolicy ?? {
      maxUnobservedGapMs: 60_000,
      maxWallClockDriftMs: 5_000,
    };
  }

  async loadSession(profileId: string, sessionId: string): Promise<StudySession | null> {
    return this.repository.load(profileId, sessionId);
  }

  async startSession(input: StartSessionInput): Promise<SessionOutcome<StudySession>> {
    let session: StudySession;
    try {
      session = this.buildTimerSession({
        sessionId: input.sessionId,
        profileId: input.scope.profileId,
        origin: input.origin,
        referenceZone: input.referenceZone,
        recordedAtCivilDate: input.recordedAtCivilDate,
        planBlockIds: input.planBlockIds,
        editalIds: input.editalIds,
      });
    } catch (error) {
      return validationFailure(error);
    }
    return this.repository.commit({
      kind: 'CREATE',
      scope: input.scope,
      sessionId: input.sessionId,
      authority: input.authority,
      session,
    });
  }

  async pauseSession(input: SessionControlInput): Promise<SessionOutcome<StudySession>> {
    const current = await this.repository.load(input.scope.profileId, input.sessionId);
    if (!current) return invalid('SESSION_NOT_FOUND');
    if (current.state === 'PAUSED') {
      return { kind: 'LOCAL_COMMITTED', value: current };
    }
    if (current.state !== 'RUNNING') return invalid('INVALID_TRANSITION');
    return this.repository.commit({
      kind: 'TRANSITION',
      scope: {
        ...input.scope,
        baseRevision: input.scope.baseRevision ?? current.localRevision,
      },
      sessionId: input.sessionId,
      authority: input.authority,
      nextState: 'PAUSED',
      checkpoint: input.checkpoint,
    });
  }

  async resumeSession(input: SessionControlInput): Promise<SessionOutcome<StudySession>> {
    const current = await this.repository.load(input.scope.profileId, input.sessionId);
    if (!current) return invalid('SESSION_NOT_FOUND');
    if (current.state === 'RUNNING') {
      return { kind: 'LOCAL_COMMITTED', value: current };
    }
    if (current.state !== 'PAUSED') return invalid('INVALID_TRANSITION');
    const observation = this.clock.observe();
    const newInterval: SessionInterval = {
      id: `${input.sessionId}~interval~${current.intervals.length + 1}`,
      kind: 'FOCUS',
      verifiedMs: 0,
      contextId: observation.contextId,
      checkpoint: observation,
      recoveryFlag: false,
      startedAt: observation.wallInstant,
    };
    return this.repository.commit({
      kind: 'TRANSITION',
      scope: {
        ...input.scope,
        baseRevision: input.scope.baseRevision ?? current.localRevision,
      },
      sessionId: input.sessionId,
      authority: input.authority,
      nextState: 'RUNNING',
      newInterval,
    });
  }

  async completeSession(input: SessionControlInput): Promise<SessionOutcome<StudySession>> {
    const current = await this.repository.load(input.scope.profileId, input.sessionId);
    if (!current) return invalid('SESSION_NOT_FOUND');
    if (current.state === 'COMPLETED') {
      return { kind: 'LOCAL_COMMITTED', value: current };
    }
    if (current.state === 'CANCELLED') return invalid('INVALID_TRANSITION');
    return this.repository.commit({
      kind: 'TRANSITION',
      scope: {
        ...input.scope,
        baseRevision: input.scope.baseRevision ?? current.localRevision,
      },
      sessionId: input.sessionId,
      authority: input.authority,
      nextState: 'COMPLETED',
      checkpoint: input.checkpoint,
    });
  }

  async checkpointSession(input: CheckpointSessionInput): Promise<SessionOutcome<StudySession>> {
    return this.repository.commit({
      kind: 'CHECKPOINT',
      scope: input.scope,
      sessionId: input.sessionId,
      authority: input.authority,
      intervalId: input.intervalId,
      verifiedMs: input.verifiedMs,
      checkpoint: input.checkpoint,
    });
  }

  async evaluatePomodoro(input: PomodoroStepInput): Promise<{ kind: PomodoroStep }> {
    return nextPomodoroStep(input);
  }

  async flagInactiveSession(
    input: FlagInactiveSessionInput,
  ): Promise<SessionOutcome<StudySession>> {
    const current = await this.repository.load(input.scope.profileId, input.sessionId);
    if (!current) return invalid('SESSION_NOT_FOUND');
    if (current.state === 'COMPLETED' || current.state === 'CANCELLED') {
      return invalid('INVALID_TRANSITION');
    }
    const intervals = current.intervals.map((interval, index) =>
      index === current.intervals.length - 1
        ? {
            ...interval,
            recoveryFlag: true,
            contextId: input.observation.contextId,
            checkpoint: input.observation,
          }
        : interval,
    );
    return this.repository.commit({
      kind: 'EDIT_FACTS',
      scope: {
        ...input.scope,
        baseRevision: input.scope.baseRevision ?? current.localRevision,
      },
      sessionId: input.sessionId,
      authority: input.authority,
      patch: { intervals },
      reason: 'INACTIVITY_REVIEW',
    });
  }

  async registerManualSession(
    input: RegisterManualSessionInput,
  ): Promise<SessionOutcome<StudySession>> {
    if (!isCivilDate(input.civilDate)) return invalid('INVALID_CIVIL_DATE');
    if (!isValidTimeZone(input.referenceZone)) return invalid('INVALID_TIME_ZONE');
    if (
      typeof input.durationMs !== 'number' ||
      !Number.isFinite(input.durationMs) ||
      input.durationMs < 0
    ) {
      return invalid('INVALID_DURATION');
    }
    let session: StudySession;
    try {
      session = validateSession({
        id: input.sessionId,
        profileId: input.scope.profileId,
        state: 'COMPLETED',
        origin: 'MANUAL',
        localRevision: 1,
        schemaVersion: DOMAIN_SCHEMA_VERSION,
        referenceZone: input.referenceZone,
        recordedAtCivilDate: input.civilDate,
        manualDeclaredMs: input.durationMs,
        note: input.note,
        planBlockIds: [],
        editalIds: [],
        intervals: [],
      });
    } catch (error) {
      return validationFailure(error);
    }
    return this.repository.commit({
      kind: 'CREATE',
      scope: input.scope,
      sessionId: input.sessionId,
      authority: input.authority,
      session,
    });
  }

  async findPotentialOverlaps(
    profileId: string,
    civilDate: string,
  ): Promise<StudySession[]> {
    if (!isCivilDate(civilDate)) return [];
    return this.repository.listByCivilDate(profileId, civilDate);
  }

  async linkSessionToPlan(
    input: LinkSessionToPlanInput,
  ): Promise<SessionOutcome<StudySession>> {
    const current = await this.repository.load(input.scope.profileId, input.sessionId);
    if (!current) return invalid('SESSION_NOT_FOUND');
    if (
      !Array.isArray(input.blockIds) ||
      input.blockIds.length === 0 ||
      input.blockIds.some((blockId) => typeof blockId !== 'string' || !blockId.trim()) ||
      new Set(input.blockIds).size !== input.blockIds.length
    ) {
      return invalid('INVALID_BLOCK_IDS');
    }

    const database = await openV2Database(input.scope.profileId);
    const transaction = database.transaction(
      [STORES.planningBlocks, STORES.editalDisciplines],
      'readonly',
    );
    for (const blockId of input.blockIds) {
      const block = (await requestResult(
        transaction
          .objectStore(STORES.planningBlocks)
          .get([input.scope.profileId, blockId]),
      )) as PlanBlock | undefined;
      if (!block) return invalid('BLOCK_NOT_FOUND');
      const link = (await requestResult(
        transaction
          .objectStore(STORES.editalDisciplines)
          .get([input.scope.profileId, block.editalDisciplineId]),
      )) as { status?: string } | undefined;
      if (!link || link.status !== 'ACTIVE') {
        return invalid('CONTENT_RECONCILIATION_REQUIRED');
      }
    }

    return this.repository.commit({
      kind: 'EDIT_FACTS',
      scope: {
        ...input.scope,
        baseRevision: input.scope.baseRevision ?? current.localRevision,
      },
      sessionId: input.sessionId,
      authority: input.authority,
      patch: { planBlockIds: input.blockIds },
      reason: 'PLAN_LINK',
    });
  }

  async reconcilePlanProgress(
    input: ReconcilePlanProgressInput,
  ): Promise<ReconcilePlanProgressResult> {
    const current = await this.repository.load(input.scope.profileId, input.sessionId);
    if (!current) {
      return { kind: 'FAILED', planApplied: false, code: 'SESSION_NOT_FOUND' };
    }
    if (
      input.choice !== 'CONCLUDED' &&
      input.choice !== 'PARTIAL' &&
      input.choice !== 'NOT_APPLIED'
    ) {
      return { kind: 'FAILED', planApplied: false, code: 'INVALID_CHOICE' };
    }
    const database = await openV2Database(input.scope.profileId);
    const transaction = database.transaction(STORES.planningBlocks, 'readonly');
    const block = (await requestResult(
      transaction
        .objectStore(STORES.planningBlocks)
        .get([input.scope.profileId, input.blockId]),
    )) as PlanBlock | undefined;
    if (!block) {
      return { kind: 'FAILED', planApplied: false, code: 'BLOCK_NOT_FOUND' };
    }
    if (block.localRevision !== input.planningBaseRevision) {
      return { kind: 'CONFLICT', planApplied: false, code: 'STALE_PLANNING_REVISION' };
    }
    if (input.choice === 'NOT_APPLIED') {
      return { kind: 'LOCAL_COMMITTED', planApplied: false };
    }

    const edited = await this.repository.commit({
      kind: 'EDIT_FACTS',
      scope: {
        ...input.scope,
        baseRevision: input.scope.baseRevision ?? current.localRevision,
      },
      sessionId: input.sessionId,
      authority: input.authority,
      patch: {
        planReconciliation: {
          blockId: input.blockId,
          choice: input.choice,
          planningBaseRevision: input.planningBaseRevision,
          reconciledAt: new Date().toISOString(),
        },
      },
      reason: 'PLAN_RECONCILIATION',
    });
    if (edited.kind === 'LOCAL_COMMITTED') {
      return { kind: 'LOCAL_COMMITTED', planApplied: false };
    }
    if (edited.kind === 'CONFLICT') {
      return { kind: 'CONFLICT', planApplied: false, code: edited.code };
    }
    return {
      kind: 'FAILED',
      planApplied: false,
      code: edited.kind === 'INVALID' ? edited.code : edited.reason,
    };
  }

  async editSessionFacts(
    input: EditSessionFactsInput,
  ): Promise<SessionOutcome<StudySession>> {
    const current = await this.repository.load(input.scope.profileId, input.sessionId);
    if (!current) return invalid('SESSION_NOT_FOUND');
    try {
      for (const measurement of input.patch.measurements ?? []) {
        validateMeasurement(measurement);
      }
      for (const material of input.patch.materials ?? []) {
        validateMaterialRef(material);
      }
      if (input.patch.allocations) {
        const totalValidMs =
          current.manualDeclaredMs ?? sumVerifiedFocusMs(current.intervals);
        allocateFocus(totalValidMs, input.patch.allocations);
      }
    } catch (error) {
      return validationFailure(error);
    }
    return this.repository.commit({
      kind: 'EDIT_FACTS',
      scope: {
        ...input.scope,
        baseRevision: input.scope.baseRevision ?? current.localRevision,
      },
      sessionId: input.sessionId,
      authority: input.authority,
      patch: input.patch,
      reason: input.reason,
    });
  }

  async deleteSession(
    input: DeleteSessionInput,
  ): Promise<SessionOutcome<StudySession>> {
    return this.repository.commit({
      kind: 'TOMBSTONE',
      scope: input.scope,
      sessionId: input.sessionId,
      authority: input.authority,
      reason: input.reason,
    });
  }

  async listSessionRevisions(
    profileId: string,
    sessionId: string,
  ): Promise<SessionAuditRecord[]> {
    return this.repository.listSessionRevisions(profileId, sessionId);
  }

  async getRecoveryPreview(
    profileId: string,
    sessionId: string,
  ): Promise<RecoveryPreview | null> {
    const session = await this.repository.load(profileId, sessionId);
    if (!session) return null;
    const lastCheckpoint =
      [...session.intervals].reverse().find((interval) => interval.checkpoint !== null)
        ?.checkpoint ?? null;
    const uncertainIntervals = session.intervals.filter(
      (interval) => interval.recoveryFlag,
    );
    if (lastCheckpoint) {
      const current = this.clock.observe();
      const continuity = inspectContinuity(lastCheckpoint, current, this.recoveryPolicy);
      if (continuity.kind === 'UNCERTAIN') {
        uncertainIntervals.push({
          id: `${sessionId}~uncertain~${current.monotonicMs}`,
          kind: 'FOCUS',
          verifiedMs: 0,
          contextId: current.contextId,
          checkpoint: current,
          recoveryFlag: true,
        });
      }
    }
    return {
      durableVerifiedMs: sumVerifiedFocusMs(session.intervals),
      uncertainIntervals,
      lastCheckpoint,
      allowedActions:
        session.state === 'COMPLETED' || session.state === 'CANCELLED'
          ? []
          : ['RESUME', 'COMPLETE', 'CORRECT_MANUALLY', 'KEEP_PENDING'],
    };
  }

  async recoverSession(input: RecoverSessionInput): Promise<SessionOutcome<StudySession>> {
    const current = await this.repository.load(input.scope.profileId, input.sessionId);
    if (!current) return invalid('SESSION_NOT_FOUND');

    if (input.decision === 'KEEP_PENDING') {
      if (current.state === 'COMPLETED' || current.state === 'CANCELLED') {
        return invalid('INVALID_TRANSITION');
      }
      const intervals = current.intervals.map((interval, index) =>
        index === current.intervals.length - 1
          ? { ...interval, recoveryFlag: true }
          : interval,
      );
      const edited = await this.repository.commit({
        kind: 'EDIT_FACTS',
        scope: {
          ...input.scope,
          baseRevision: input.scope.baseRevision ?? current.localRevision,
        },
        sessionId: input.sessionId,
        authority: input.authority,
        patch: { intervals },
        reason: 'RECOVERY_PENDING',
      });
      if (edited.kind !== 'LOCAL_COMMITTED') return edited;
      return this.repository.commit({
        kind: 'TRANSITION',
        scope: {
          ...input.scope,
          operationId: `${input.scope.operationId}~transition`,
          baseRevision: edited.value.localRevision,
        },
        sessionId: input.sessionId,
        authority: input.authority,
        nextState: 'RECOVERY_REQUIRED',
      });
    }

    if (input.decision === 'CORRECT_MANUALLY') {
      if (
        typeof input.manualAdjustmentMs !== 'number' ||
        !Number.isFinite(input.manualAdjustmentMs) ||
        input.manualAdjustmentMs < 0
      ) {
        return invalid('INVALID_DURATION');
      }
      return this.repository.commit({
        kind: 'EDIT_FACTS',
        scope: {
          ...input.scope,
          baseRevision: input.scope.baseRevision ?? current.localRevision,
        },
        sessionId: input.sessionId,
        authority: input.authority,
        patch: {
          manualDeclaredMs:
            (current.manualDeclaredMs ?? 0) + input.manualAdjustmentMs,
        },
        reason: 'MANUAL_RECOVERY',
      });
    }

    if (input.decision === 'RESUME') {
      if (current.state === 'RUNNING') {
        return { kind: 'LOCAL_COMMITTED', value: current };
      }
      if (current.state === 'COMPLETED' || current.state === 'CANCELLED') {
        return invalid('INVALID_TRANSITION');
      }
      return this.repository.commit({
        kind: 'TRANSITION',
        scope: {
          ...input.scope,
          baseRevision: input.scope.baseRevision ?? current.localRevision,
        },
        sessionId: input.sessionId,
        authority: input.authority,
        nextState: 'RUNNING',
      });
    }

    if (input.decision === 'COMPLETE') {
      if (current.state === 'COMPLETED') {
        return { kind: 'LOCAL_COMMITTED', value: current };
      }
      if (current.state === 'CANCELLED') return invalid('INVALID_TRANSITION');
      return this.repository.commit({
        kind: 'TRANSITION',
        scope: {
          ...input.scope,
          baseRevision: input.scope.baseRevision ?? current.localRevision,
        },
        sessionId: input.sessionId,
        authority: input.authority,
        nextState: 'COMPLETED',
      });
    }

    return invalid('INVALID_DECISION');
  }

  async switchActiveSession(
    input: SwitchActiveSessionInput,
  ): Promise<SessionOutcome<StudySession>> {
    let toSession: StudySession;
    try {
      toSession = this.buildTimerSession({
        sessionId: input.toSessionId,
        profileId: input.scope.profileId,
        origin: input.origin ?? 'TIMER',
        referenceZone: input.referenceZone,
        recordedAtCivilDate: input.recordedAtCivilDate,
        planBlockIds: input.planBlockIds,
        editalIds: input.editalIds,
      });
    } catch (error) {
      return validationFailure(error);
    }
    const result = await this.repository.switchTimerAtomic({
      scope: input.scope,
      fromSessionId: input.fromSessionId,
      toSession,
      authority: input.authority,
    });
    if (result.kind === 'LOCAL_COMMITTED') {
      return { kind: 'LOCAL_COMMITTED', value: result.value.to };
    }
    return result;
  }

  private buildTimerSession(input: {
    sessionId: string;
    profileId: string;
    origin: Exclude<SessionOrigin, 'MANUAL'>;
    referenceZone?: string | null;
    recordedAtCivilDate?: string;
    planBlockIds?: string[];
    editalIds?: string[];
  }): StudySession {
    const observation = this.clock.observe();
    return validateSession({
      id: input.sessionId,
      profileId: input.profileId,
      state: 'RUNNING',
      origin: input.origin,
      localRevision: 1,
      schemaVersion: DOMAIN_SCHEMA_VERSION,
      referenceZone: input.referenceZone ?? null,
      recordedAtCivilDate: input.recordedAtCivilDate,
      planBlockIds: input.planBlockIds ?? [],
      editalIds: input.editalIds ?? [],
      intervals: [
        {
          id: `${input.sessionId}~interval~1`,
          kind: 'FOCUS',
          verifiedMs: 0,
          contextId: observation.contextId,
          checkpoint: observation,
          recoveryFlag: false,
          startedAt: observation.wallInstant,
        },
      ],
    });
  }
}
