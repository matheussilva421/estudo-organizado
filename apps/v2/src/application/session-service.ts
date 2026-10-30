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
import type { LocalSessionRepository } from '../platform/local-session-repository';
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
    });
  }

  async resumeSession(input: SessionControlInput): Promise<SessionOutcome<StudySession>> {
    const current = await this.repository.load(input.scope.profileId, input.sessionId);
    if (!current) return invalid('SESSION_NOT_FOUND');
    if (current.state === 'RUNNING') {
      return { kind: 'LOCAL_COMMITTED', value: current };
    }
    if (current.state !== 'PAUSED') return invalid('INVALID_TRANSITION');
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
        },
      ],
    });
  }
}
