import { describe, expect, it } from 'vitest';
import {
  generatePlanPreview,
  GenerationLimitError,
  type PlanGenerationInput,
} from '../../src/domain/planning-generator';
import type { PriorityItem, PriorityProfile } from '../../src/domain/planning-priority';
import type { PlanningScenario } from '../../src/domain/planning';
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
  examDate: '2027-01-24',
  referenceZone: zone,
};

const profile: PriorityProfile = {
  id: 'priority-default',
  revision: 1,
  name: 'Padrão',
  weights: { urgency: 2, depth: 1, volume: 0.5, pending: 3 },
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

function items(count: number): PriorityItem[] {
  return Array.from({ length: count }, (_, index) => ({
    contentKey: `disc-${Math.floor(index / 15) + 1}/assunto-${(index % 15) + 1}`,
    editalDisciplineId: `link-${Math.floor(index / 15) + 1}`,
    assuntoId: `assunto-${index + 1}`,
    label: `Conteúdo ${index + 1}`,
    depth: index % 3,
    plannedMinutes: 60,
    pending: index % 7 === 0,
    examDate: '2027-01-24',
  }));
}

function build(count: number, extra: Partial<PlanGenerationInput> = {}): PlanGenerationInput {
  return {
    scenario,
    profile,
    items: items(count),
    startDate: '2027-01-04',
    horizonDays: 14,
    zone,
    weekly,
    exceptions: [],
    fixedBlocks: [],
    operationId: 'op-generate',
    ...extra,
  };
}

describe('F3 plan generator', () => {
  it('limited_availability_keeps_every_item_visible', () => {
    const preview = generatePlanPreview(build(120));
    expect(preview.blocks.length + preview.unallocated.length).toBe(120);
    expect(preview.unallocated.length).toBeGreaterThan(0);
    expect(
      preview.unallocated.every(
        (block) => block.allocation === 'UNALLOCATED' && block.reason === 'NO_CAPACITY_IN_HORIZON',
      ),
    ).toBe(true);
    expect(preview.explanations).toHaveLength(120);
  });

  it('generation_is_deterministic_and_only_proposes', () => {
    const first = generatePlanPreview(build(30));
    const second = generatePlanPreview(build(30));
    expect(second.inputRevisionSignature).toBe(first.inputRevisionSignature);
    expect(second.blocks).toEqual(first.blocks);
    const reordered = generatePlanPreview(build(30, { items: [...items(30)].reverse() }));
    expect(reordered.blocks.map((block) => block.label).sort()).toEqual(
      first.blocks.map((block) => block.label).sort(),
    );
  });

  it('one_hundred_and_eighty_blocks_are_generated_without_truncation', () => {
    const preview = generatePlanPreview(
      build(180, { horizonDays: 60, startDate: '2027-01-04' }),
    );
    expect(preview.blocks.length + preview.unallocated.length).toBe(180);
    expect(preview.limits.consideredItems).toBe(180);
    expect(preview.limits.blocked).toBe(false);
  });

  it('a_measured_ceiling_fails_closed_instead_of_truncating', () => {
    expect(() => generatePlanPreview(build(120, { maxBlocks: 10 }))).toThrow(
      GenerationLimitError,
    );
  });
});
