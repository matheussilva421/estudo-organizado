import { beforeEach, describe, expect, it } from 'vitest';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';
import { LocalPlanningRepository } from '../../src/platform/local-planning-repository';
import {
  DEFAULT_PLANNING_AVAILABILITY,
  type PlanningAvailability,
} from '../../src/domain/planning-capacity';

const profileId = 'profile-f7-ux-availability';

function availability(overrides: Partial<PlanningAvailability> = {}): PlanningAvailability {
  return {
    ...DEFAULT_PLANNING_AVAILABILITY,
    weekly: {
      ...DEFAULT_PLANNING_AVAILABILITY.weekly,
      days: {
        MON: [{ start: '07:30', end: '09:15' }],
        WED: [{ start: '19:00', end: '22:00' }],
        SAT: [{ start: '08:00', end: '12:00' }],
      },
    },
    exceptions: [
      {
        exceptionId: 'holiday-1',
        kind: 'DATE',
        startDate: '2027-01-25',
        closed: true,
        note: 'Feriado local',
      },
    ],
    goals: { weeklyMinutes: 600, disciplineMinutes: { 'disc-1': 90 } },
    ...overrides,
  };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7-UX planning availability persistence', () => {
  it('returns null for a legacy profile without configuration', async () => {
    const repository = new LocalPlanningRepository();
    expect(await repository.loadAvailability(profileId)).toBeNull();
  });

  it('persists weekly windows, exceptions and goals with a revision', async () => {
    const repository = new LocalPlanningRepository();
    const saved = await repository.saveAvailability({
      profileId,
      availability: availability(),
      expectedRevision: null,
    });
    expect(saved.kind).toBe('LOCAL_COMMITTED');
    if (saved.kind !== 'LOCAL_COMMITTED') return;
    expect(saved.value.localRevision).toBe(1);
    expect(saved.value.weekly.days.MON?.[0]).toEqual({ start: '07:30', end: '09:15' });
    expect(saved.value.exceptions[0]?.closed).toBe(true);
    expect(saved.value.goals?.weeklyMinutes).toBe(600);

    const loaded = await repository.loadAvailability(profileId);
    expect(loaded?.localRevision).toBe(1);
    expect(loaded?.goals?.disciplineMinutes?.['disc-1']).toBe(90);
  });

  it('rejects a stale revision instead of overwriting another tab', async () => {
    const repository = new LocalPlanningRepository();
    const first = await repository.saveAvailability({
      profileId,
      availability: availability(),
      expectedRevision: null,
    });
    expect(first.kind).toBe('LOCAL_COMMITTED');
    const stale = await repository.saveAvailability({
      profileId,
      availability: availability({ exceptions: [] }),
      expectedRevision: 0,
    });
    expect(stale.kind).toBe('CONFLICT');
    const loaded = await repository.loadAvailability(profileId);
    expect(loaded?.exceptions).toHaveLength(1);
  });

  it('rejects malformed windows and negative goals', async () => {
    const repository = new LocalPlanningRepository();
    const inverted = availability();
    inverted.weekly = {
      ...inverted.weekly,
      days: { MON: [{ start: '10:00', end: '09:00' }] },
    };
    const invalidWindow = await repository.saveAvailability({
      profileId,
      availability: inverted,
      expectedRevision: null,
    });
    expect(invalidWindow.kind).toBe('INVALID');
    if (invalidWindow.kind === 'INVALID') expect(invalidWindow.code).toBe('INVALID_WINDOW');

    const negativeGoal = availability({ goals: { weeklyMinutes: -10 } });
    const invalidGoal = await repository.saveAvailability({
      profileId,
      availability: negativeGoal,
      expectedRevision: null,
    });
    expect(invalidGoal.kind).toBe('INVALID');
    if (invalidGoal.kind === 'INVALID') expect(invalidGoal.code).toBe('INVALID_GOAL');
  });

  it('keeps profiles isolated', async () => {
    const repository = new LocalPlanningRepository();
    await repository.saveAvailability({
      profileId,
      availability: availability(),
      expectedRevision: null,
    });
    expect(await repository.loadAvailability('other-profile')).toBeNull();
  });
});

