import { describe, expect, it } from 'vitest';
import { previewRedistribution } from '../../src/domain/planning-generator';
import type { PlanBlock } from '../../src/domain/planning';
import type { WeeklyAvailability } from '../../src/domain/planning-capacity';

const zone = 'America/Fortaleza';
const weekly: WeeklyAvailability = {
  timeZone: zone,
  days: {
    MON: [{ start: '08:00', end: '10:00' }],
    TUE: [{ start: '08:00', end: '10:00' }],
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
    ...overrides,
  };
}

describe('F3 assisted redistribution', () => {
  it('moves_unallocated_blocks_into_free_capacity_and_keeps_fixed_ones', () => {
    const preview = previewRedistribution({
      blocks: [
        block({ id: 'fixed', allocation: 'CONFIRMED_TIME', civilDate: '2027-01-04', localStart: '08:00', localEnd: '09:00', timeZone: zone }),
        block({ id: 'pending', allocation: 'UNALLOCATED', plannedMinutes: 60 }),
      ],
      startDate: '2027-01-04',
      horizonDays: 2,
      zone,
      weekly,
      exceptions: [],
      operationId: 'op-redistribute',
    });
    expect(preview.moved).toEqual([
      { blockId: 'pending', from: null, to: '2027-01-04' },
    ]);
    expect(preview.unchanged).toEqual(['fixed']);
    expect(preview.stillUnallocatedIds).toEqual([]);
    expect(preview.blocks.find((item) => item.id === 'pending')?.allocation).toBe('PROJECTED');
  });

  it('keeps_blocks_unallocated_when_the_horizon_is_full', () => {
    const preview = previewRedistribution({
      blocks: [
        block({ id: 'a', allocation: 'UNALLOCATED', plannedMinutes: 120 }),
        block({ id: 'b', allocation: 'UNALLOCATED', plannedMinutes: 120 }),
      ],
      startDate: '2027-01-04',
      horizonDays: 1,
      zone,
      weekly,
      exceptions: [],
      operationId: 'op-redistribute',
    });
    expect(preview.moved).toEqual([{ blockId: 'a', from: null, to: '2027-01-04' }]);
    expect(preview.stillUnallocatedIds).toEqual(['b']);
    expect(preview.blocks.every((item) => item.allocation !== undefined)).toBe(true);
  });
});
