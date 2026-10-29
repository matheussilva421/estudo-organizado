import { describe, expect, it } from 'vitest';
import { queryCalendar, summarizeCalendar } from '../../src/application/planning-queries';
import type { PlanBlock, PlanningScenario } from '../../src/domain/planning';
import type { WeeklyAvailability } from '../../src/domain/planning-capacity';

const profileId = 'profile-local';
const zone = 'America/Fortaleza';

const weekly: WeeklyAvailability = {
  timeZone: zone,
  days: {
    MON: [{ start: '08:00', end: '11:00' }],
    TUE: [{ start: '08:00', end: '11:00' }],
    WED: [{ start: '08:00', end: '11:00' }],
    THU: [{ start: '08:00', end: '11:00' }],
    FRI: [{ start: '08:00', end: '11:00' }],
  },
};

function scenario(
  id: string,
  status: PlanningScenario['status'],
  editalId = 'edital-tjpb',
): PlanningScenario {
  return {
    id,
    profileId,
    editalId,
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

function block(id: string, scenarioId: string, civilDate: string, extra: Partial<PlanBlock> = {}): PlanBlock {
  return {
    id,
    profileId,
    editalId: 'edital-tjpb',
    scenarioId,
    editalDisciplineId: 'link-1',
    plannedMinutes: 60,
    allocation: 'PROJECTED',
    civilDate,
    priority: 1,
    localRevision: 1,
    sourceOperationId: 'op-1',
    ...extra,
  };
}

const scenarios = [scenario('scenario-active', 'ACTIVE'), scenario('scenario-closed', 'CLOSED')];
const blocks = [
  block('a-1', 'scenario-active', '2027-01-04'),
  block('a-2', 'scenario-active', '2027-01-05', {
    localStart: '08:00',
    localEnd: '09:00',
    timeZone: zone,
    allocation: 'CONFIRMED_TIME',
  }),
  block('closed-1', 'scenario-closed', '2027-01-06'),
];

describe('F3 calendar queries', () => {
  it('daily_weekly_and_monthly_views_share_the_same_ids', () => {
    const month = queryCalendar({
      profileId,
      rangeStart: '2027-01-01',
      rangeEnd: '2027-01-31',
      activeOnly: true,
      blocks,
      scenarios,
      availability: { zone, weekly, exceptions: [] },
    });
    expect(month).toHaveLength(31);
    const monthIds = month.flatMap((day) => day.blocks.map((item) => item.id));
    expect(monthIds).toEqual(['a-1', 'a-2']);

    const week = queryCalendar({
      profileId,
      rangeStart: '2027-01-04',
      rangeEnd: '2027-01-10',
      activeOnly: true,
      blocks,
      scenarios,
      availability: { zone, weekly, exceptions: [] },
    });
    expect(week.flatMap((day) => day.blocks.map((item) => item.id))).toEqual(monthIds);

    const day = queryCalendar({
      profileId,
      rangeStart: '2027-01-04',
      rangeEnd: '2027-01-04',
      activeOnly: true,
      blocks,
      scenarios,
      availability: { zone, weekly, exceptions: [] },
    });
    expect(day).toHaveLength(1);
    expect(day[0]?.blocks.map((item) => item.id)).toEqual(['a-1']);
    expect(day[0]?.availableMinutes).toBe(180);
    expect(day[0]?.reservedMinutes).toBe(60);
  });

  it('closed_history_is_consultable_but_never_reserves_capacity', () => {
    const history = queryCalendar({
      profileId,
      rangeStart: '2027-01-06',
      rangeEnd: '2027-01-06',
      activeOnly: false,
      blocks,
      scenarios,
      availability: { zone, weekly, exceptions: [] },
    });
    expect(history[0]?.blocks.map((item) => item.id)).toEqual(['closed-1']);
    expect(history[0]?.reservedMinutes).toBe(0);

    const official = queryCalendar({
      profileId,
      rangeStart: '2027-01-06',
      rangeEnd: '2027-01-06',
      activeOnly: true,
      blocks,
      scenarios,
      availability: { zone, weekly, exceptions: [] },
    });
    expect(official[0]?.blocks).toEqual([]);
  });

  it('query_never_writes_and_is_stable_across_calls', () => {
    const input = {
      profileId,
      rangeStart: '2027-01-04',
      rangeEnd: '2027-01-05',
      activeOnly: true,
      blocks,
      scenarios,
      availability: { zone, weekly, exceptions: [] },
    };
    const first = queryCalendar(input);
    const second = queryCalendar(input);
    expect(second).toEqual(first);
    expect(summarizeCalendar(first)).toMatchObject({
      days: 2,
      blocks: 2,
      reservedMinutes: 120,
    });
  });

  it('civil_date_is_preserved_regardless_of_the_block_zone', () => {
    const tokyoBlock = block('tokyo', 'scenario-active', '2027-01-04', {
      localStart: '08:00',
      localEnd: '10:00',
      timeZone: 'Asia/Tokyo',
      allocation: 'CONFIRMED_TIME',
    });
    const result = queryCalendar({
      profileId,
      rangeStart: '2027-01-04',
      rangeEnd: '2027-01-04',
      activeOnly: true,
      blocks: [tokyoBlock],
      scenarios,
    });
    expect(result[0]?.civilDate).toBe('2027-01-04');
    expect(result[0]?.blocks[0]?.civilDate).toBe('2027-01-04');
  });

  it('invalid_or_inverted_ranges_return_nothing', () => {
    expect(
      queryCalendar({
        profileId,
        rangeStart: '2027-01-10',
        rangeEnd: '2027-01-01',
        activeOnly: true,
        blocks,
        scenarios,
      }),
    ).toEqual([]);
    expect(
      queryCalendar({
        profileId,
        rangeStart: '2027-02-30',
        rangeEnd: '2027-03-01',
        activeOnly: true,
        blocks,
        scenarios,
      }),
    ).toEqual([]);
  });
});
