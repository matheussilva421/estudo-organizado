import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteV2DatabaseForTests,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';
import {
  evaluateHabitOccurrence,
  getHabitEvidence,
  type HabitOccurrence,
  type StudyHabit,
} from '../../src/domain/session-habits';
import { LocalSessionHabitService } from '../../src/application/session-habit-service';
import type { StudySession } from '../../src/domain/session';

const profileId = 'profile-f4';

function habit(overrides: Partial<StudyHabit> = {}): StudyHabit {
  return {
    id: 'habit-1',
    profileId,
    kind: 'TIME',
    target: 2 * 60 * 60_000,
    referenceZone: 'America/Fortaleza',
    recurrence: 'DAILY',
    localRevision: 1,
    ...overrides,
  };
}

function session(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: 'session-1',
    profileId,
    state: 'COMPLETED',
    origin: 'MANUAL',
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

async function seedHabit(value: StudyHabit): Promise<void> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.sessionHabits, 'readwrite');
  transaction.objectStore(STORES.sessionHabits).put(value);
  await transactionDone(transaction);
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F4 habits', () => {
  it('two_hours_reached_only_suggests_confirmation', () => {
    const evidence = getHabitEvidence(
      habit(),
      [session({ manualDeclaredMs: 2 * 60 * 60_000 })],
      '2026-10-30',
    );
    expect(evidence).toEqual({
      progress: 2 * 60 * 60_000,
      targetMet: true,
      needsReview: true,
    });
  });

  it('confirm_occurrence_is_independent_and_idempotent', async () => {
    await seedHabit(habit());
    const service = new LocalSessionHabitService();
    const input = {
      scope: { profileId, operationId: 'op-confirm', baseRevision: null },
      habitId: 'habit-1',
      civilDate: '2026-10-30',
    };
    const first = await service.confirmHabitOccurrence(input);
    const second = await service.confirmHabitOccurrence(input);
    expect(first.kind).toBe('LOCAL_COMMITTED');
    expect(second).toEqual(first);
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.habitOccurrences, 'readonly');
    expect(await requestResult(transaction.objectStore(STORES.habitOccurrences).count())).toBe(1);
  });

  it('evidence_edited_below_target_marks_review_without_erasing_confirmation', () => {
    const occurrence: HabitOccurrence = {
      id: 'habit-1~2026-10-30',
      habitId: 'habit-1',
      profileId,
      civilDate: '2026-10-30',
      confirmed: true,
      localRevision: 1,
      sourceOperationId: 'op-confirm',
    };
    const result = evaluateHabitOccurrence(
      habit(),
      occurrence,
      [session({ manualDeclaredMs: 60 * 60_000 })],
      '2026-10-30',
    );
    expect(result).toEqual({ confirmed: true, targetMet: false, needsReview: true });
  });

  it('subjective_habit_remains_manual', () => {
    expect(
      getHabitEvidence(habit({ kind: 'MANUAL', target: undefined }), [], '2026-10-30'),
    ).toEqual({ progress: 0, targetMet: false, needsReview: false });
  });

  it('midnight_timezone_uses_civil_dates', () => {
    const sessions = [
      session({ id: 's1', manualDeclaredMs: 30 * 60_000, recordedAtCivilDate: '2026-10-30' }),
      session({ id: 's2', manualDeclaredMs: 90 * 60_000, recordedAtCivilDate: '2026-10-31' }),
    ];
    expect(getHabitEvidence(habit(), sessions, '2026-10-30').progress).toBe(30 * 60_000);
    expect(getHabitEvidence(habit(), sessions, '2026-10-31').progress).toBe(90 * 60_000);
  });

  it('cancelled_session_does_not_satisfy_habit', () => {
    expect(
      getHabitEvidence(
        habit(),
        [session({ state: 'CANCELLED', manualDeclaredMs: 2 * 60 * 60_000 })],
        '2026-10-30',
      ),
    ).toEqual({ progress: 0, targetMet: false, needsReview: false });
  });

  it('weekly_habit_uses_civil_week', () => {
    const weekly = habit({ recurrence: 'WEEKLY' });
    expect(
      getHabitEvidence(
        weekly,
        [session({ recordedAtCivilDate: '2026-10-27', manualDeclaredMs: 2 * 60 * 60_000 })],
        '2026-10-30',
      ).progress,
    ).toBe(2 * 60 * 60_000);
  });

  it('other_profile_cannot_confirm', async () => {
    await seedHabit(habit());
    const service = new LocalSessionHabitService();
    const result = await service.confirmHabitOccurrence({
      scope: { profileId: 'profile-other', operationId: 'op-other', baseRevision: null },
      habitId: 'habit-1',
      civilDate: '2026-10-30',
    });
    expect(result.kind).toBe('INVALID');
  });
});
