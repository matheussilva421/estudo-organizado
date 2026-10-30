import { describe, expect, it } from 'vitest';
import {
  SessionValidationError,
  transitionSession,
  validateSession,
  type StudySession,
} from '../../src/domain/session';

const profileId = 'profile-f4';

function baseSession(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: 'session-1',
    profileId,
    state: 'DRAFT',
    origin: 'TIMER',
    localRevision: 1,
    schemaVersion: 1,
    referenceZone: 'America/Fortaleza',
    planBlockIds: [],
    editalIds: [],
    intervals: [],
    ...overrides,
  };
}

describe('F4 session domain', () => {
  it('allows_draft_running_paused_running_completed', () => {
    let session = validateSession(baseSession());
    expect(session.state).toBe('DRAFT');
    session = transitionSession(session, 'RUNNING');
    expect(session.state).toBe('RUNNING');
    session = transitionSession(session, 'PAUSED');
    expect(session.state).toBe('PAUSED');
    session = transitionSession(session, 'RUNNING');
    expect(session.state).toBe('RUNNING');
    session = transitionSession(session, 'COMPLETED');
    expect(session.state).toBe('COMPLETED');
  });

  it('rejects_completed_to_running', () => {
    const completed = baseSession({ state: 'COMPLETED' });
    expect(() => transitionSession(completed, 'RUNNING')).toThrowError(
      expect.objectContaining({ code: 'INVALID_TRANSITION' }),
    );
  });

  it.each([Number.NaN, -1, Number.POSITIVE_INFINITY])(
    'rejects_nan_negative_and_infinite_duration_%s',
    (verifiedMs) => {
      const session = baseSession({
        state: 'RUNNING',
        intervals: [
          {
            id: 'interval-1',
            kind: 'FOCUS',
            verifiedMs,
            contextId: 'ctx-1',
            checkpoint: null,
            recoveryFlag: false,
          },
        ],
      });
      expect(() => validateSession(session)).toThrowError(
        expect.objectContaining({ code: 'INVALID_DURATION' }),
      );
    },
  );

  it('manual_completed_without_running', () => {
    const session = validateSession(
      baseSession({
        state: 'COMPLETED',
        origin: 'MANUAL',
        manualDeclaredMs: 45 * 60 * 1000,
        intervals: [],
      }),
    );
    expect(session.origin).toBe('MANUAL');
    expect(session.state).toBe('COMPLETED');
    expect(session.intervals).toEqual([]);
  });

  it('rejects_manual_session_with_timer_intervals', () => {
    const session = baseSession({
      state: 'COMPLETED',
      origin: 'MANUAL',
      intervals: [
        {
          id: 'interval-1',
          kind: 'FOCUS',
          verifiedMs: 1000,
          contextId: 'ctx-1',
          checkpoint: null,
          recoveryFlag: false,
        },
      ],
    });
    expect(() => validateSession(session)).toThrowError(
      expect.objectContaining({ code: 'INVALID_MANUAL_INTERVALS' }),
    );
  });

  it('rejects_invalid_reference_zone', () => {
    expect(() => validateSession(baseSession({ referenceZone: 'Mars/Olympus' }))).toThrowError(
      expect.objectContaining({ code: 'INVALID_TIME_ZONE' }),
    );
  });

  it('recovery_required_requires_explicit_transition', () => {
    const session = baseSession({ state: 'RECOVERY_REQUIRED' });
    expect(() => transitionSession(session, 'RUNNING')).not.toThrow();
    expect(transitionSession(session, 'COMPLETED').state).toBe('COMPLETED');
  });

  it('exports_a_typed_validation_error', () => {
    const error = new SessionValidationError('INVALID_TRANSITION', 'no');
    expect(error.code).toBe('INVALID_TRANSITION');
  });
});
