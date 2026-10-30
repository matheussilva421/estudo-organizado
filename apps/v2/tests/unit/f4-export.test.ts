import { describe, expect, it } from 'vitest';
import { exportSessionHistory } from '../../src/application/session-portability';
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
    recordedAtCivilDate: '2026-10-30',
    planBlockIds: [],
    editalIds: [],
    intervals: [],
    ...overrides,
  };
}

describe('F4 session export', () => {
  it('csv_multi_edital_rows_do_not_repeat_global_minutes', () => {
    const exported = exportSessionHistory('CSV', { profileId }, [
      session({ editalIds: ['e1', 'e2'], manualDeclaredMs: 60 * 60_000 }),
    ]);
    const lines = exported.content.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(exported.content.match(/3600000/g)).toHaveLength(1);
  });

  it('formula_like_cell_is_escaped', () => {
    const exported = exportSessionHistory('CSV', { profileId }, [
      session({ note: '=SUM(A1)' }),
    ]);
    expect(exported.content).toContain("'=SUM(A1)");
  });

  it('json_has_schema_and_provenance_but_no_credentials_or_other_profile', () => {
    const exported = exportSessionHistory('JSON', { profileId }, [
      session({ note: 'token=abc123' }),
      session({ id: 'other', profileId: 'profile-other' }),
    ]);
    const parsed = JSON.parse(exported.content);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.profileId).toBe(profileId);
    expect(parsed.sessions).toHaveLength(1);
    expect(exported.content).not.toContain('token=abc123');
    expect(exported.content).toContain('[REDACTED]');
  });
});
