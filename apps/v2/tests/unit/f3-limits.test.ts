import { describe, expect, it } from 'vitest';
import { generatePlanPreview, GenerationLimitError } from '../../src/domain/planning-generator';
import { queryCalendar } from '../../src/application/planning-queries';
import type { PriorityItem, PriorityProfile } from '../../src/domain/planning-priority';
import type { PlanBlock, PlanningScenario } from '../../src/domain/planning';
import type { WeeklyAvailability } from '../../src/domain/planning-capacity';

const zone = 'America/Fortaleza';

const scenario: PlanningScenario = {
  id: 'scenario-tjpb',
  profileId: 'profile-local',
  editalId: 'edital-tjpb',
  kind: 'FINAL_STRETCH',
  name: 'Reta Final',
  status: 'DRAFT',
  localRevision: 1,
  schemaVersion: 1,
  priorityProfileId: 'priority-default',
  priorityProfileRevision: 1,
  examDate: '2027-06-30',
  referenceZone: zone,
};

const profile: PriorityProfile = {
  id: 'priority-default',
  revision: 1,
  name: 'Padrão',
  weights: { urgency: 1, depth: 1, volume: 0.5, pending: 2 },
};

const weekly: WeeklyAvailability = {
  timeZone: zone,
  days: {
    MON: [{ start: '08:00', end: '12:00' }],
    TUE: [{ start: '08:00', end: '12:00' }],
    WED: [{ start: '08:00', end: '12:00' }],
    THU: [{ start: '08:00', end: '12:00' }],
    FRI: [{ start: '08:00', end: '12:00' }],
    SAT: [{ start: '08:00', end: '12:00' }],
  },
};

function items(count: number): PriorityItem[] {
  return Array.from({ length: count }, (_, index) => ({
    contentKey: `d${Math.floor(index / 20)}/a${index}`,
    editalDisciplineId: `link-${Math.floor(index / 20)}`,
    assuntoId: `assunto-${index}`,
    label: `Conteúdo ${index}`,
    plannedMinutes: 45,
    examDate: '2027-06-30',
  }));
}

function blocksFrom(previewBlocks: PlanBlock[]): PlanBlock[] {
  return previewBlocks.map((block) => ({ ...block, scenarioId: scenario.id }));
}

describe('F3 measured limits', () => {
  it('one_hundred_and_eighty_blocks_are_integral_end_to_end', () => {
    const started = Date.now();
    const preview = generatePlanPreview({
      scenario,
      profile,
      items: items(180),
      startDate: '2027-01-04',
      horizonDays: 90,
      zone,
      weekly,
      exceptions: [],
      fixedBlocks: [],
      operationId: 'op-180',
    });
    const generationMs = Date.now() - started;
    expect(preview.blocks.length + preview.unallocated.length).toBe(180);

    const days = queryCalendar({
      profileId: 'profile-local',
      rangeStart: '2027-01-04',
      rangeEnd: '2027-04-03',
      activeOnly: false,
      blocks: blocksFrom(preview.blocks),
      scenarios: [{ ...scenario, status: 'ACTIVE' }],
      availability: { zone, weekly, exceptions: [] },
    });
    const total = days.reduce((sum, day) => sum + day.blocks.length, 0);
    expect(total).toBe(preview.blocks.length);
    // A measured, generous ceiling for local generation on modest machines.
    expect(generationMs).toBeLessThan(3000);
  });

  it('at_least_three_hundred_and_sixty_blocks_are_not_truncated', () => {
    const preview = generatePlanPreview({
      scenario,
      profile,
      items: items(360),
      startDate: '2027-01-04',
      horizonDays: 180,
      zone,
      weekly,
      exceptions: [],
      fixedBlocks: [],
      operationId: 'op-360',
    });
    expect(preview.blocks.length + preview.unallocated.length).toBe(360);
    expect(preview.limits.consideredItems).toBe(360);
  });

  it('the_measured_ceiling_blocks_instead_of_truncating_silently', () => {
    expect(() =>
      generatePlanPreview({
        scenario,
        profile,
        items: items(200),
        startDate: '2027-01-04',
        horizonDays: 90,
        zone,
        weekly,
        exceptions: [],
        fixedBlocks: [],
        operationId: 'op-limit',
        maxBlocks: 150,
      }),
    ).toThrow(GenerationLimitError);
  });
});
