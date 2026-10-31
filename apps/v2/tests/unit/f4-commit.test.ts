import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteV2DatabaseForTests,
  openV2Database,
  requestResult,
  STORES,
} from '../../src/platform/indexeddb';
import { subscribeSessionChanges } from '../../src/platform/local-events';
import { LocalSessionRepository } from '../../src/platform/local-session-repository';
import type { StudySession } from '../../src/domain/session';

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

async function counts(): Promise<{ sessions: number; outbox: number; operations: number }> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(
    [STORES.sessions, STORES.outbox, STORES.operations],
    'readonly',
  );
  return {
    sessions: await requestResult(transaction.objectStore(STORES.sessions).count()),
    outbox: await requestResult(transaction.objectStore(STORES.outbox).count()),
    operations: await requestResult(transaction.objectStore(STORES.operations).count()),
  };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F4 local session repository', () => {
  it('replay_same_id_payload_creates_one_session_and_one_semantic_outbox', async () => {
    const repository = new LocalSessionRepository();
    const input = {
      kind: 'CREATE' as const,
      scope: { profileId, operationId: 'op-create-1', baseRevision: null },
      sessionId: 'session-1',
      session: baseSession(),
    };
    const first = await repository.commit(input);
    const second = await repository.commit(input);
    expect(first.kind).toBe('LOCAL_COMMITTED');
    expect(second).toEqual(first);
    expect(await counts()).toEqual({ sessions: 1, outbox: 1, operations: 1 });
  });

  it('same_id_different_payload_returns_INVALID_OPERATION_ID_REUSED', async () => {
    const repository = new LocalSessionRepository();
    await repository.commit({
      kind: 'CREATE',
      scope: { profileId, operationId: 'op-create-1', baseRevision: null },
      sessionId: 'session-1',
      session: baseSession(),
    });
    const result = await repository.commit({
      kind: 'CREATE',
      scope: { profileId, operationId: 'op-create-1', baseRevision: null },
      sessionId: 'session-1',
      session: baseSession({ manualDeclaredMs: 1_000 }),
    });
    expect(result).toEqual({ kind: 'INVALID', code: 'INVALID_OPERATION_ID_REUSED' });
    expect(await counts()).toEqual({ sessions: 1, outbox: 1, operations: 1 });
  });

  it('stale_revision_returns_CONFLICT_without_write', async () => {
    const repository = new LocalSessionRepository();
    await repository.commit({
      kind: 'CREATE',
      scope: { profileId, operationId: 'op-create-1', baseRevision: null },
      sessionId: 'session-1',
      session: baseSession(),
    });
    const result = await repository.commit({
      kind: 'TRANSITION',
      scope: { profileId, operationId: 'op-transition-stale', baseRevision: 99 },
      sessionId: 'session-1',
      nextState: 'RUNNING',
    });
    expect(result).toEqual({ kind: 'CONFLICT', code: 'STALE_REVISION' });
    const loaded = await repository.load(profileId, 'session-1');
    expect(loaded?.state).toBe('DRAFT');
    expect(await counts()).toEqual({ sessions: 1, outbox: 1, operations: 1 });
  });

  it('abort_and_quota_do_not_notify_or_claim_local_committed', async () => {
    for (const fault of ['abort', 'quota'] as const) {
      await deleteV2DatabaseForTests();
      const events: string[] = [];
      const unsubscribe = subscribeSessionChanges(profileId, (change) => {
        events.push(change.sessionId);
      });
      const repository = new LocalSessionRepository({ fault });
      const result = await repository.commit({
        kind: 'CREATE',
        scope: { profileId, operationId: `op-${fault}`, baseRevision: null },
        sessionId: 'session-1',
        session: baseSession(),
      });
      unsubscribe();
      expect(result).toEqual({
        kind: 'FAILED',
        reason: fault === 'abort' ? 'ABORT' : 'QUOTA',
      });
      expect(await counts()).toEqual({ sessions: 0, outbox: 0, operations: 0 });
      expect(events).toEqual([]);
    }
  });

  it('checkpoint_does_not_enqueue_remote_mutation', async () => {
    const repository = new LocalSessionRepository();
    const checkpoint = {
      contextId: 'ctx-1',
      monotonicMs: 1_000,
      wallInstant: '2026-10-30T10:00:00.000Z',
    };
    await repository.commit({
      kind: 'CREATE',
      scope: { profileId, operationId: 'op-create-1', baseRevision: null },
      sessionId: 'session-1',
      session: baseSession({
        intervals: [
          {
            id: 'interval-1',
            kind: 'FOCUS',
            verifiedMs: 0,
            contextId: 'ctx-1',
            checkpoint,
            recoveryFlag: false,
          },
        ],
      }),
    });
    const result = await repository.commit({
      kind: 'CHECKPOINT',
      scope: { profileId, operationId: 'op-checkpoint-1', baseRevision: 1 },
      sessionId: 'session-1',
      intervalId: 'interval-1',
      verifiedMs: 5_000,
      checkpoint: { ...checkpoint, monotonicMs: 6_000, wallInstant: '2026-10-30T10:00:06.000Z' },
    });
    expect(result.kind).toBe('LOCAL_COMMITTED');
    const loaded = await repository.load(profileId, 'session-1');
    expect(loaded?.intervals[0]?.verifiedMs).toBe(5_000);
    expect(loaded?.localRevision).toBe(1);
    expect(await counts()).toEqual({ sessions: 1, outbox: 1, operations: 2 });
  });

  it('transition_updates_state_and_revision', async () => {
    const repository = new LocalSessionRepository();
    await repository.commit({
      kind: 'CREATE',
      scope: { profileId, operationId: 'op-create-1', baseRevision: null },
      sessionId: 'session-1',
      session: baseSession(),
    });
    const result = await repository.commit({
      kind: 'TRANSITION',
      scope: { profileId, operationId: 'op-transition-1', baseRevision: 1 },
      sessionId: 'session-1',
      nextState: 'RUNNING',
    });
    expect(result.kind).toBe('LOCAL_COMMITTED');
    const loaded = await repository.load(profileId, 'session-1');
    expect(loaded?.state).toBe('RUNNING');
    expect(loaded?.localRevision).toBe(2);
    expect(await counts()).toEqual({ sessions: 1, outbox: 2, operations: 2 });
  });

  it('tombstone_is_soft_delete_and_enqueues_delete', async () => {
    const repository = new LocalSessionRepository();
    await repository.commit({
      kind: 'CREATE',
      scope: { profileId, operationId: 'op-create-1', baseRevision: null },
      sessionId: 'session-1',
      session: baseSession(),
    });
    const result = await repository.commit({
      kind: 'TOMBSTONE',
      scope: { profileId, operationId: 'op-delete-1', baseRevision: 1 },
      sessionId: 'session-1',
      reason: 'duplicate',
    });
    expect(result.kind).toBe('LOCAL_COMMITTED');
    const loaded = await repository.load(profileId, 'session-1');
    expect(loaded?.tombstone).toBe(true);
    expect(loaded?.state).toBe('DRAFT');
    expect(await counts()).toEqual({ sessions: 1, outbox: 2, operations: 2 });
  });

  it('transition_with_checkpoint_updates_interval_and_state_atomically', async () => {
    const repository = new LocalSessionRepository();
    const checkpoint = {
      contextId: 'ctx-1',
      monotonicMs: 1_000,
      wallInstant: '2026-10-30T10:00:00.000Z',
    };
    await repository.commit({
      kind: 'CREATE',
      scope: { profileId, operationId: 'op-create', baseRevision: null },
      sessionId: 'session-1',
      session: baseSession({
        state: 'RUNNING',
        intervals: [
          {
            id: 'interval-1',
            kind: 'FOCUS',
            verifiedMs: 0,
            contextId: 'ctx-1',
            checkpoint,
            recoveryFlag: false,
          },
        ],
      }),
    });
    const result = await repository.commit({
      kind: 'TRANSITION',
      scope: { profileId, operationId: 'op-pause', baseRevision: 1 },
      sessionId: 'session-1',
      nextState: 'PAUSED',
      checkpoint: {
        intervalId: 'interval-1',
        verifiedMs: 5_000,
        checkpoint: {
          ...checkpoint,
          monotonicMs: 6_000,
          wallInstant: '2026-10-30T10:00:06.000Z',
        },
        endedAt: '2026-10-30T10:00:06.000Z',
      },
    });
    expect(result.kind).toBe('LOCAL_COMMITTED');
    const loaded = await repository.load(profileId, 'session-1');
    expect(loaded?.state).toBe('PAUSED');
    expect(loaded?.intervals[0]?.verifiedMs).toBe(5_000);
    expect(loaded?.intervals[0]?.endedAt).toBe('2026-10-30T10:00:06.000Z');
    expect(await counts()).toEqual({ sessions: 1, outbox: 2, operations: 2 });
  });

  it('transition_with_new_interval_resumes_in_one_transaction', async () => {
    const repository = new LocalSessionRepository();
    await repository.commit({
      kind: 'CREATE',
      scope: { profileId, operationId: 'op-create', baseRevision: null },
      sessionId: 'session-1',
      session: baseSession({
        state: 'PAUSED',
        intervals: [
          {
            id: 'interval-1',
            kind: 'FOCUS',
            verifiedMs: 1_000,
            contextId: 'ctx-1',
            checkpoint: null,
            recoveryFlag: false,
          },
        ],
      }),
    });
    const result = await repository.commit({
      kind: 'TRANSITION',
      scope: { profileId, operationId: 'op-resume', baseRevision: 1 },
      sessionId: 'session-1',
      nextState: 'RUNNING',
      newInterval: {
        id: 'interval-2',
        kind: 'FOCUS',
        verifiedMs: 0,
        contextId: 'ctx-1',
        checkpoint: null,
        recoveryFlag: false,
        startedAt: '2026-10-30T10:00:10.000Z',
      },
    });
    expect(result.kind).toBe('LOCAL_COMMITTED');
    const loaded = await repository.load(profileId, 'session-1');
    expect(loaded?.state).toBe('RUNNING');
    expect(loaded?.intervals).toHaveLength(2);
    expect(loaded?.intervals[1]?.kind).toBe('FOCUS');
    expect(await counts()).toEqual({ sessions: 1, outbox: 2, operations: 2 });
  });

  it('abort_during_atomic_transition_leaves_original_state', async () => {
    const repository = new LocalSessionRepository();
    const checkpoint = {
      contextId: 'ctx-1',
      monotonicMs: 1_000,
      wallInstant: '2026-10-30T10:00:00.000Z',
    };
    await repository.commit({
      kind: 'CREATE',
      scope: { profileId, operationId: 'op-create', baseRevision: null },
      sessionId: 'session-1',
      session: baseSession({
        state: 'RUNNING',
        intervals: [
          {
            id: 'interval-1',
            kind: 'FOCUS',
            verifiedMs: 0,
            contextId: 'ctx-1',
            checkpoint,
            recoveryFlag: false,
          },
        ],
      }),
    });
    const failing = new LocalSessionRepository({ fault: 'abort' });
    const result = await failing.commit({
      kind: 'TRANSITION',
      scope: { profileId, operationId: 'op-pause-fail', baseRevision: 1 },
      sessionId: 'session-1',
      nextState: 'PAUSED',
      checkpoint: {
        intervalId: 'interval-1',
        verifiedMs: 5_000,
        checkpoint,
        endedAt: '2026-10-30T10:00:06.000Z',
      },
    });
    expect(result).toEqual({ kind: 'FAILED', reason: 'ABORT' });
    const loaded = await repository.load(profileId, 'session-1');
    expect(loaded?.state).toBe('RUNNING');
    expect(loaded?.intervals[0]?.verifiedMs).toBe(0);
    expect(await counts()).toEqual({ sessions: 1, outbox: 1, operations: 1 });
  });
});
