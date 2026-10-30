import { describe, expect, it } from 'vitest';
import { reconcileSessionVersions } from '../../src/domain/session-conflicts';
import { summarizeExecutionLinks } from '../../src/domain/planning-execution-contract';
import type { StudySession } from '../../src/domain/session';

const profileId = 'profile-f4';

function session(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: 'session-1',
    profileId,
    state: 'COMPLETED',
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

describe('F4 offline session conflicts', () => {
  it('two_offline_edits_to_same_duration_preserve_both_versions', () => {
    const base = session({ manualDeclaredMs: 60 * 60_000 });
    const local = session({ manualDeclaredMs: 70 * 60_000, localRevision: 2 });
    const incoming = session({ manualDeclaredMs: 80 * 60_000, localRevision: 2 });
    const result = reconcileSessionVersions(base, local, incoming);
    expect(result.kind).toBe('CONFLICT');
    if (result.kind !== 'CONFLICT') return;
    expect(result.conflict.kind).toBe('SAME_FIELD');
    expect(result.conflict.local.manualDeclaredMs).toBe(70 * 60_000);
    expect(result.conflict.incoming.manualDeclaredMs).toBe(80 * 60_000);
  });

  it('delete_vs_edit_keeps_tombstone_and_variant', () => {
    const base = session();
    const local = session({
      tombstone: true,
      deletedAt: '2026-10-30T10:00:00.000Z',
      localRevision: 2,
    });
    const incoming = session({ note: 'editado offline', localRevision: 2 });
    const result = reconcileSessionVersions(base, local, incoming);
    expect(result.kind).toBe('CONFLICT');
    if (result.kind !== 'CONFLICT') return;
    expect(result.conflict.kind).toBe('DELETE_VS_EDIT');
    expect(result.conflict.local.tombstone).toBe(true);
    expect(result.conflict.incoming.note).toBe('editado offline');
  });

  it('independent_notes_change_merges_only_with_proven_base_and_invariants', () => {
    const base = session();
    const local = session({ note: 'nota local', localRevision: 2 });
    const incoming = session({
      measurements: [
        {
          id: 'measurement-1',
          sessionId: 'session-1',
          questions: 10,
          correctAnswers: 7,
        },
      ],
      localRevision: 2,
    });
    const result = reconcileSessionVersions(base, local, incoming);
    expect(result.kind).toBe('MERGED');
    if (result.kind !== 'MERGED') return;
    expect(result.session.note).toBe('nota local');
    expect(result.session.measurements?.[0]?.questions).toBe(10);
    expect(result.session.localRevision).toBe(3);
  });

  it('conflict_does_not_double_count_global_time', () => {
    const base = session({ manualDeclaredMs: 60 * 60_000 });
    const local = session({ manualDeclaredMs: 70 * 60_000, localRevision: 2 });
    const incoming = session({ manualDeclaredMs: 80 * 60_000, localRevision: 2 });
    const result = reconcileSessionVersions(base, local, incoming);
    expect(result.kind).toBe('CONFLICT');
    if (result.kind !== 'CONFLICT') return;
    expect(
      summarizeExecutionLinks([
        {
          sessionId: result.conflict.local.id,
          editalId: 'edital-1',
          editalDisciplineId: 'link-1',
          durationMinutes: 60,
        },
      ]).uniqueMinutes,
    ).toBe(60);
  });

  it('no_timestamp_last_write_wins', () => {
    const base = session({ note: '' });
    const local = session({ note: 'local', localRevision: 2 });
    const incoming = session({ note: 'incoming', localRevision: 2 });
    const result = reconcileSessionVersions(base, local, incoming);
    expect(result.kind).toBe('CONFLICT');
    if (result.kind !== 'CONFLICT') return;
    expect(result.conflict.kind).toBe('SAME_FIELD');
    expect(result.conflict.local.note).toBe('local');
    expect(result.conflict.incoming.note).toBe('incoming');
  });
});
