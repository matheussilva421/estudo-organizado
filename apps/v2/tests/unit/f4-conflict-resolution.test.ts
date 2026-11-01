import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildIncomingFactPatch,
  preservedIncomingFields,
  reconcileSessionVersions,
  resolveSessionConflict,
  splitSessionConflicts,
  type SessionConflict,
} from '../../src/domain/session-conflicts';
import { sessionTotalFocusMs } from '../../src/domain/session-accounting';
import type {
  SessionAllocation,
  SessionInterval,
  StudySession,
} from '../../src/domain/session';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';
import { LocalSessionRepository } from '../../src/platform/local-session-repository';

const profileId = 'profile-f4';
const sessionId = 'session-1';

function interval(id: string, verifiedMs: number): SessionInterval {
  return {
    id,
    kind: 'FOCUS',
    verifiedMs,
    contextId: 'ctx-1',
    checkpoint: null,
    recoveryFlag: false,
  };
}

function allocation(allocationId: string, durationMs: number): SessionAllocation {
  return { sessionId, allocationId, durationMs };
}

function session(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: sessionId,
    profileId,
    state: 'COMPLETED',
    origin: 'TIMER',
    localRevision: 1,
    schemaVersion: 1,
    referenceZone: 'America/Fortaleza',
    recordedAtCivilDate: '2026-10-30',
    planBlockIds: [],
    editalIds: [],
    intervals: [],
    ...overrides,
  };
}

/**
 * The fixture deliberately changes the same fields on both sides: focus
 * intervals, allocations and F3/F2 links. There is no independent field to
 * merge, so the reconciliation must keep both complete versions.
 */
function versions(): {
  base: StudySession;
  local: StudySession;
  incoming: StudySession;
} {
  const base = session({
    planBlockIds: ['block-base'],
    editalIds: ['edital-base'],
  });
  const local = session({
    ...base,
    localRevision: 2,
    planBlockIds: ['block-local'],
    editalIds: ['edital-local'],
    intervals: [interval('local-focus', 60 * 60_000)],
    allocations: [allocation('local-allocation', 30 * 60_000)],
    note: 'nota local',
  });
  const incoming = session({
    ...base,
    localRevision: 2,
    planBlockIds: ['block-incoming'],
    editalIds: ['edital-incoming'],
    intervals: [interval('incoming-focus', 90 * 60_000)],
    allocations: [allocation('incoming-allocation', 45 * 60_000)],
    note: 'nota incoming',
  });
  return { base, local, incoming };
}

function conflictFixture(): SessionConflict {
  const { local, incoming } = versions();
  return {
    id: `${sessionId}~1~2~2`,
    profileId,
    sessionId,
    baseRevision: 1,
    local,
    incoming,
    kind: 'SAME_FIELD',
    status: 'OPEN',
  };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F4 conflict resolution integrity', () => {
  it('fixture_preserves_both_versions_for_the_same_fields', () => {
    const { base, local, incoming } = versions();
    const result = reconcileSessionVersions(base, local, incoming);
    expect(result.kind).toBe('CONFLICT');
    if (result.kind !== 'CONFLICT') return;
    expect(result.conflict.kind).toBe('SAME_FIELD');
    expect(result.conflict.local).toEqual(local);
    expect(result.conflict.incoming).toEqual(incoming);
  });

  it('incoming_patch_applies_facts_and_leaves_intervals_and_links_out', () => {
    const conflict = conflictFixture();
    const patch = buildIncomingFactPatch(conflict);
    expect(patch.note).toBe('nota incoming');
    expect(patch.allocations).toEqual([allocation('incoming-allocation', 45 * 60_000)]);
    expect(patch).not.toHaveProperty('intervals');
    expect(patch).not.toHaveProperty('planBlockIds');
    expect(patch).not.toHaveProperty('editalIds');
    expect(preservedIncomingFields(conflict)).toEqual([
      'intervals',
      'planBlockIds',
      'editalIds',
    ]);
  });

  it('keep_both_keeps_the_unselected_variant_and_does_not_sum_time', () => {
    const conflict = conflictFixture();
    const outcome = resolveSessionConflict(conflict, 'KEEP_BOTH');
    expect(outcome.kind).toBe('LOCAL_COMMITTED');
    if (outcome.kind !== 'LOCAL_COMMITTED') return;
    expect(outcome.value).toBe(conflict.local);
    expect(sessionTotalFocusMs(outcome.value)).toBe(60 * 60_000);
    expect(sessionTotalFocusMs(conflict.incoming)).toBe(90 * 60_000);
    expect(conflict.incoming.planBlockIds).toEqual(['block-incoming']);
  });

  it('resolved_entries_remain_available_for_recovery', () => {
    const open = conflictFixture();
    const resolved: SessionConflict = {
      ...open,
      status: 'RESOLVED',
      resolution: 'KEEP_BOTH',
    };
    const split = splitSessionConflicts([open, resolved]);
    expect(split.open).toEqual([open]);
    expect(split.resolved).toEqual([resolved]);
    expect(split.resolved[0]?.incoming.intervals[0]?.verifiedMs).toBe(90 * 60_000);
  });

  it('incoming_does_not_hide_a_pending_tombstone', () => {
    const conflict = conflictFixture();
    const deleted: SessionConflict = {
      ...conflict,
      local: {
        ...conflict.local,
        tombstone: true,
        deletedAt: '2026-10-30T12:00:00.000Z',
      },
      incoming: { ...conflict.incoming, tombstone: false },
    };
    expect(preservedIncomingFields(deleted)).toContain('tombstone');
  });

  it('repository_keeps_the_unselected_variant_without_duplicate_session_time', async () => {
    const repository = new LocalSessionRepository();
    const local = versions().local;
    const created = await repository.commit({
      kind: 'CREATE',
      scope: { profileId, operationId: 'op-create', baseRevision: null },
      sessionId: local.id,
      session: local,
    });
    expect(created.kind).toBe('LOCAL_COMMITTED');

    const edited = await repository.commit({
      kind: 'EDIT_FACTS',
      scope: { profileId, operationId: 'op-edit', baseRevision: 1 },
      sessionId: local.id,
      patch: { note: local.note },
      reason: 'fixture',
    });
    expect(edited.kind).toBe('LOCAL_COMMITTED');

    const current = await repository.load(profileId, local.id);
    if (!current) throw new Error('session missing');
    const conflict: SessionConflict = { ...conflictFixture(), local: current };
    await repository.saveSessionConflict(conflict);

    const resolved = await repository.resolveSessionConflict(
      profileId,
      conflict.id,
      'KEEP_BOTH',
    );
    expect(resolved?.status).toBe('RESOLVED');
    expect(resolved?.resolution).toBe('KEEP_BOTH');

    const conflicts = await repository.listSessionConflicts(profileId);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.local.intervals[0]?.verifiedMs).toBe(60 * 60_000);
    expect(conflicts[0]?.incoming.intervals[0]?.verifiedMs).toBe(90 * 60_000);
    expect(conflicts[0]?.incoming.planBlockIds).toEqual(['block-incoming']);

    const sessions = await repository.listSessions(profileId);
    expect(sessions).toHaveLength(1);
    expect(sessionTotalFocusMs(sessions[0]!)).toBe(60 * 60_000);
  });
});
