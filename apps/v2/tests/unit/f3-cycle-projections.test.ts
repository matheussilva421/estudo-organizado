import { describe, expect, it } from 'vitest';
import {
  advanceCycle,
  createCycleState,
  projectCycle,
} from '../../src/domain/planning-cycle';
import type { PlanBlock, PlanningScenario } from '../../src/domain/planning';
import type { WeeklyAvailability } from '../../src/domain/planning-capacity';

const zone = 'America/Fortaleza';

const scenario: PlanningScenario = {
  id: 'scenario-ciclo',
  profileId: 'profile-local',
  editalId: 'edital-tjpb',
  kind: 'CYCLE',
  name: 'Ciclo TJPB',
  status: 'DRAFT',
  localRevision: 1,
  schemaVersion: 1,
  priorityProfileId: 'priority-default',
  priorityProfileRevision: 1,
  referenceZone: zone,
  cycleHorizonDays: 14,
};

const weekly: WeeklyAvailability = {
  timeZone: zone,
  days: {
    MON: [{ start: '08:00', end: '10:00' }],
    TUE: [{ start: '08:00', end: '10:00' }],
    WED: [{ start: '08:00', end: '10:00' }],
    THU: [{ start: '08:00', end: '10:00' }],
    FRI: [{ start: '08:00', end: '10:00' }],
  },
};

const content = [
  { editalDisciplineId: 'link-constitucional', assuntoId: 'a1', plannedMinutes: 60 },
  { editalDisciplineId: 'link-constitucional', assuntoId: 'a2', plannedMinutes: 60 },
  { editalDisciplineId: 'link-administrativo', assuntoId: 'a3', plannedMinutes: 60 },
];

const pinned: PlanBlock = {
  id: 'pinned-1',
  profileId: 'profile-local',
  editalId: 'edital-tjpb',
  scenarioId: scenario.id,
  editalDisciplineId: 'link-constitucional',
  assuntoId: 'a1',
  plannedMinutes: 90,
  allocation: 'CONFIRMED_TIME',
  civilDate: '2027-01-20',
  localStart: '19:00',
  localEnd: '20:30',
  timeZone: zone,
  priority: 1,
  localRevision: 1,
  sourceOperationId: 'op-pinned',
};

describe('F3 cycle projections', () => {
  it('projects_only_inside_the_renewable_horizon', () => {
    const projection = projectCycle({
      scenario,
      state: createCycleState({
        profileId: 'profile-local',
        scenarioId: scenario.id,
        content,
      }),
      startDate: '2027-01-04',
      horizonDays: 14,
      zone,
      weekly,
      exceptions: [],
      fixedBlocks: [],
      operationId: 'op-project',
    });
    expect(projection.horizonEnd).toBe('2027-01-17');
    const planned = projection.blocks.filter((item) => item.allocation !== 'UNALLOCATED');
    expect(planned).toHaveLength(3);
    expect(planned.every((item) => item.civilDate! <= '2027-01-17')).toBe(true);
    expect(planned[0]?.civilDate).toBe('2027-01-04');
  });

  it('fixed_blocks_are_preserved_when_sequence_changes', () => {
    const state = createCycleState({
      profileId: 'profile-local',
      scenarioId: scenario.id,
      content,
    });
    const first = projectCycle({
      scenario,
      state,
      startDate: '2027-01-04',
      horizonDays: 14,
      zone,
      weekly,
      exceptions: [],
      fixedBlocks: [pinned],
      operationId: 'op-a',
    });
    const second = projectCycle({
      scenario,
      state: advanceCycle(state, { type: 'CONTINUE' }),
      startDate: '2027-01-04',
      horizonDays: 14,
      zone,
      weekly,
      exceptions: [],
      fixedBlocks: [pinned],
      operationId: 'op-b',
    });
    expect(first.blocks.find((item) => item.id === 'pinned-1')).toEqual(pinned);
    expect(second.blocks.find((item) => item.id === 'pinned-1')).toEqual(pinned);
    // A pinned block outside the window still survives the recomputation.
    expect(second.blocks.some((item) => item.id === 'pinned-1')).toBe(true);
  });

  it('zero_capacity_leaves_items_unallocated_instead_of_dropping_them', () => {
    const projection = projectCycle({
      scenario,
      state: createCycleState({
        profileId: 'profile-local',
        scenarioId: scenario.id,
        content,
      }),
      startDate: '2027-01-04',
      horizonDays: 3,
      zone,
      weekly: { timeZone: zone, days: {} },
      exceptions: [],
      fixedBlocks: [],
      operationId: 'op-empty',
    });
    expect(projection.projectedCount).toBe(0);
    expect(projection.unallocatedCount).toBe(3);
    expect(projection.blocks.every((item) => item.allocation === 'UNALLOCATED')).toBe(true);
    expect(projection.blocks.every((item) => item.reason === 'HORIZON_CAPACITY_EXHAUSTED')).toBe(
      true,
    );
  });

  it('projection_is_deterministic_for_equal_inputs', () => {
    const input = {
      scenario,
      state: createCycleState({
        profileId: 'profile-local',
        scenarioId: scenario.id,
        content,
      }),
      startDate: '2027-01-04',
      horizonDays: 14,
      zone,
      weekly,
      exceptions: [],
      fixedBlocks: [pinned],
      operationId: 'op-same',
    };
    expect(projectCycle(input)).toEqual(projectCycle({ ...input }));
  });
});
