import { describe, expect, it } from 'vitest';
import {
  evaluateDailyCapacity,
  resolveDailyAvailability,
  selectOfficialReservations,
  type AvailabilityException,
  type WeeklyAvailability,
} from '../../src/domain/planning-capacity';
import type { PlanBlock, PlanningScenario } from '../../src/domain/planning';

const zone = 'America/Fortaleza';

const weekly: WeeklyAvailability = {
  timeZone: zone,
  days: {
    MON: [{ start: '08:00', end: '11:00' }],
    TUE: [{ start: '08:00', end: '11:00' }],
    WED: [{ start: '08:00', end: '11:00' }],
    THU: [{ start: '08:00', end: '11:00' }],
    FRI: [{ start: '08:00', end: '11:00' }],
    SAT: [{ start: '08:00', end: '10:00' }],
  },
};

function block(overrides: Partial<PlanBlock> & { id: string }): PlanBlock {
  return {
    profileId: 'profile-local',
    editalId: 'edital-tjpb',
    scenarioId: 'scenario-tjpb',
    editalDisciplineId: 'link-1',
    plannedMinutes: 60,
    allocation: 'PROJECTED',
    priority: 1,
    localRevision: 1,
    sourceOperationId: 'op-1',
    civilDate: '2027-01-04',
    ...overrides,
  };
}

function scenario(id: string, status: PlanningScenario['status']): PlanningScenario {
  return {
    id,
    profileId: 'profile-local',
    editalId: 'edital-tjpb',
    kind: 'FINAL_STRETCH',
    name: id,
    status,
    localRevision: 1,
    schemaVersion: 1,
    priorityProfileId: 'priority-default',
    priorityProfileRevision: 1,
    examDate: '2027-01-24',
    referenceZone: zone,
  };
}

describe('F3 availability and capacity', () => {
  it('precedence_is_date_then_period_then_weekly', () => {
    const exceptions: AvailabilityException[] = [
      {
        exceptionId: 'period',
        kind: 'PERIOD',
        startDate: '2027-01-10',
        endDate: '2027-01-13',
        minutesOverride: 120,
      },
      {
        exceptionId: 'date-override',
        kind: 'DATE',
        startDate: '2027-01-13',
        minutesOverride: 60,
      },
      {
        exceptionId: 'wednesday-zero',
        kind: 'DATE',
        startDate: '2027-01-06',
        closed: true,
      },
    ];

    expect(
      resolveDailyAvailability({ date: '2027-01-04', weekly, exceptions, zone }),
    ).toMatchObject({ availableMinutes: 180, source: 'WEEKLY' });
    expect(
      resolveDailyAvailability({ date: '2027-01-11', weekly, exceptions, zone }),
    ).toMatchObject({ availableMinutes: 120, source: 'PERIOD_EXCEPTION' });
    expect(
      resolveDailyAvailability({ date: '2027-01-13', weekly, exceptions, zone }),
    ).toMatchObject({ availableMinutes: 60, source: 'DATE_EXCEPTION' });
    expect(
      resolveDailyAvailability({ date: '2027-01-06', weekly, exceptions, zone }),
    ).toMatchObject({ availableMinutes: 0, source: 'CLOSED' });
    // Saturday has its own routine.
    expect(
      resolveDailyAvailability({ date: '2027-01-09', weekly, exceptions, zone }).availableMinutes,
    ).toBe(120);
  });

  it('colliding_exceptions_are_reported_not_decided', () => {
    const resolution = resolveDailyAvailability({
      date: '2027-01-05',
      weekly,
      zone,
      exceptions: [
        { exceptionId: 'a', kind: 'DATE', startDate: '2027-01-05', minutesOverride: 60 },
        { exceptionId: 'b', kind: 'DATE', startDate: '2027-01-05', minutesOverride: 120 },
      ],
    });
    expect(resolution.availableMinutes).toBe(0);
    expect(resolution.source).toBe('AMBIGUOUS');
    expect(resolution.diagnostics).toContain('AMBIGUOUS_EXCEPTION');
  });

  it('overlapping_commitments_are_never_discounted_twice', () => {
    const capacity = evaluateDailyCapacity({
      date: '2027-01-04',
      zone,
      weekly,
      exceptions: [],
      reservations: [],
      fixedCommitments: [
        {
          commitmentId: 'c1',
          civilDate: '2027-01-04',
          start: '08:00',
          end: '10:00',
          timeZone: zone,
        },
        {
          commitmentId: 'c2',
          civilDate: '2027-01-04',
          start: '09:00',
          end: '11:00',
          timeZone: zone,
        },
      ],
    });
    expect(capacity.availableMinutes).toBe(180);
    expect(capacity.reservedMinutes).toBe(180);
    expect(capacity.remainingMinutes).toBe(0);
  });

  it('reservations_from_two_active_editais_sum_once_and_inactive_do_not', () => {
    const scenarios = [
      scenario('scenario-tjpb', 'ACTIVE'),
      scenario('scenario-dpe', 'ACTIVE'),
      scenario('scenario-alt', 'INACTIVE'),
    ];
    const blocks = [
      block({ id: 'tjpb-1', editalId: 'edital-tjpb', localStart: '08:00', localEnd: '09:00', timeZone: zone }),
      block({ id: 'dpe-1', editalId: 'edital-dpe', scenarioId: 'scenario-dpe', localStart: '09:00', localEnd: '10:00', timeZone: zone }),
      block({ id: 'alt-1', scenarioId: 'scenario-alt', localStart: '10:00', localEnd: '11:00', timeZone: zone }),
    ];

    const official = selectOfficialReservations(scenarios, blocks, 'profile-local');
    expect(official.map((item) => item.id)).toEqual(['tjpb-1', 'dpe-1']);

    const capacity = evaluateDailyCapacity({
      date: '2027-01-04',
      zone,
      weekly,
      exceptions: [],
      reservations: official,
    });
    expect(capacity.reservedMinutes).toBe(120);
    expect(capacity.remainingMinutes).toBe(60);
  });

  it('block_outside_the_window_is_a_conflict_not_a_silent_fit', () => {
    const capacity = evaluateDailyCapacity({
      date: '2027-01-04',
      zone,
      weekly,
      exceptions: [],
      reservations: [
        block({
          id: 'block-late',
          localStart: '19:00',
          localEnd: '20:00',
          timeZone: zone,
          allocation: 'CONFIRMED_TIME',
        }),
      ],
    });
    expect(capacity.conflictBlockIds).toEqual(['block-late']);
    expect(capacity.diagnostics).toContain('OUTSIDE_AVAILABILITY');
  });

  it('zero_capacity_day_leaves_every_block_unallocated', () => {
    const capacity = evaluateDailyCapacity({
      date: '2027-01-06',
      zone,
      weekly,
      exceptions: [
        { exceptionId: 'zero', kind: 'DATE', startDate: '2027-01-06', closed: true },
      ],
      reservations: [
        block({ id: 'block-a', civilDate: '2027-01-06', plannedMinutes: 60 }),
        block({ id: 'block-b', civilDate: '2027-01-06', plannedMinutes: 30 }),
      ],
    });
    expect(capacity.availableMinutes).toBe(0);
    expect(capacity.unallocatedBlockIds).toEqual(['block-a', 'block-b']);
    expect(capacity.conflictBlockIds).toEqual(['block-a', 'block-b']);
  });

  it('explicit_unallocated_blocks_stay_visible_and_unpriced', () => {
    const capacity = evaluateDailyCapacity({
      date: '2027-01-04',
      zone,
      weekly,
      exceptions: [],
      reservations: [
        block({ id: 'block-ok', plannedMinutes: 60 }),
        block({ id: 'block-unallocated', allocation: 'UNALLOCATED', plannedMinutes: 90 }),
      ],
    });
    expect(capacity.reservedMinutes).toBe(60);
    expect(capacity.unallocatedBlockIds).toEqual(['block-unallocated']);
    expect(capacity.remainingMinutes).toBe(120);
  });

  it('dst_gap_reduces_real_capacity_without_inventing_wall_time', () => {
    const newYork: WeeklyAvailability = {
      timeZone: 'America/New_York',
      days: { SUN: [{ start: '01:00', end: '04:00' }] },
    };
    const resolution = resolveDailyAvailability({
      date: '2026-03-08',
      weekly: newYork,
      exceptions: [],
      zone: 'America/New_York',
    });
    // 01:00 -> 04:00 local loses the nonexistent 02:00 hour: 120 real minutes.
    expect(resolution.availableMinutes).toBe(120);

    const windowInGap = resolveDailyAvailability({
      date: '2026-03-08',
      weekly: { timeZone: 'America/New_York', days: { SUN: [{ start: '02:00', end: '03:00' }] } },
      exceptions: [],
      zone: 'America/New_York',
    });
    expect(windowInGap.availableMinutes).toBe(0);
    expect(windowInGap.diagnostics).toContain('INVALID_WINDOW:NONEXISTENT_TIME');
  });
});
