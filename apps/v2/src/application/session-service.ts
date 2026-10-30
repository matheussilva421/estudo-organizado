import {
  SessionValidationError,
  validateSession,
  type ClockObservation,
  type SessionOrigin,
  type SessionOutcome,
  type SessionScope,
  type StudySession,
} from '../domain/session';
import type { ClockPort } from '../domain/session-clock';
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
  constructor(
    private readonly repository: LocalSessionRepository,
    private readonly clock: ClockPort,
  ) {}

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
