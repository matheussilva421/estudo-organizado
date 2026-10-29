import { describe, expect, it } from 'vitest';
import { mergePlanningDraft } from '../../src/domain/planning-merge';
import type { PlanningDraft } from '../../src/application/planning-service';
import type { PlanBlock, PlanningScenario, PlanningScenarioSnapshot } from '../../src/domain/planning';

const scenario: PlanningScenario = {
  id: 'scenario-tjpb',
  profileId: 'profile-local',
  editalId: 'edital-tjpb',
  kind: 'FINAL_STRETCH',
  name: 'Reta Final',
  status: 'DRAFT',
  localRevision: 2,
  schemaVersion: 1,
  priorityProfileId: 'priority-default',
  priorityProfileRevision: 1,
  examDate: '2027-01-24',
  referenceZone: 'America/Fortaleza',
};

function block(id: string, extra: Partial<PlanBlock> = {}): PlanBlock {
  return {
    id,
    profileId: 'profile-local',
    editalId: 'edital-tjpb',
    scenarioId: scenario.id,
    editalDisciplineId: 'link-1',
    plannedMinutes: 60,
    allocation: 'PROJECTED',
    civilDate: '2027-01-05',
    priority: 1,
    localRevision: 1,
    sourceOperationId: 'op-1',
    ...extra,
  };
}

function snapshot(blocks: PlanBlock[]): PlanningScenarioSnapshot {
  return { scenario, blocks };
}

function draft(overrides: Partial<PlanningDraft> = {}): PlanningDraft {
  return {
    id: 'draft-1',
    profileId: 'profile-local',
    scenarioId: scenario.id,
    baseRevision: 2,
    changes: [],
    lastSavedAt: '2026-10-29T00:00:00.000Z',
    ...overrides,
  };
}

describe('F3 three-way merge', () => {
  it('independent_fields_of_different_blocks_merge', () => {
    const base = snapshot([block('a'), block('b')]);
    const current = snapshot([
      block('a', { localStart: '08:00', localEnd: '09:00', allocation: 'CONFIRMED_TIME', timeZone: 'America/Fortaleza' }),
      block('b'),
    ]);
    const merged = mergePlanningDraft({
      base,
      current,
      draft: draft({
        changes: [{ blockId: 'b', field: 'plannedMinutes', value: 90, baseValue: 60 }],
      }),
    });
    expect(merged.kind).toBe('MERGEABLE');
    expect(merged.conflicts).toEqual([]);
    expect(merged.blocks.find((item) => item.id === 'a')).toMatchObject({
      localStart: '08:00',
    });
    expect(merged.blocks.find((item) => item.id === 'b')?.plannedMinutes).toBe(90);
    expect(merged.capacityImpact.deltaMinutes).toBe(30);
  });

  it('the_same_field_on_the_same_block_is_a_conflict', () => {
    const base = snapshot([block('a')]);
    const current = snapshot([block('a', { plannedMinutes: 90 })]);
    const merged = mergePlanningDraft({
      base,
      current,
      draft: draft({
        changes: [{ blockId: 'a', field: 'plannedMinutes', value: 120, baseValue: 60 }],
      }),
    });
    expect(merged.kind).toBe('CONFLICT');
    expect(merged.conflicts[0]).toMatchObject({
      blockId: 'a',
      field: 'plannedMinutes',
      base: 60,
      current: 90,
      incoming: 120,
    });
    // Without a decision nothing changes.
    expect(merged.blocks.find((item) => item.id === 'a')?.plannedMinutes).toBe(90);
  });

  it('delete_against_edit_keeps_the_conflict', () => {
    const base = snapshot([block('a')]);
    const current = snapshot([block('a', { plannedMinutes: 90 })]);
    const merged = mergePlanningDraft({
      base,
      current,
      draft: draft({
        changes: [{ blockId: 'a', field: 'civilDate', value: '2027-01-06', baseValue: '2027-01-05' }],
        deletedBlockIds: ['a'],
      }),
    });
    expect(merged.kind).toBe('CONFLICT');
    expect(merged.conflicts.some((item) => item.field === 'BLOCK')).toBe(true);
    expect(merged.blocks.some((item) => item.id === 'a')).toBe(true);
  });

  it('a_new_block_colliding_with_an_existing_id_is_refused', () => {
    const base = snapshot([block('a')]);
    const current = snapshot([block('a')]);
    const merged = mergePlanningDraft({
      base,
      current,
      draft: draft({ newBlocks: [block('a', { plannedMinutes: 30 })] }),
    });
    expect(merged.kind).toBe('CONFLICT');
    expect(merged.blocks.filter((item) => item.id === 'a')).toHaveLength(1);
  });

  it('independent_deletion_and_addition_merge_without_clock_wins', () => {
    const base = snapshot([block('a'), block('b')]);
    const current = snapshot([block('a'), block('b')]);
    const merged = mergePlanningDraft({
      base,
      current,
      draft: draft({ deletedBlockIds: ['b'], newBlocks: [block('c', { plannedMinutes: 45 })] }),
    });
    expect(merged.kind).toBe('MERGEABLE');
    expect(merged.blocks.map((item) => item.id)).toEqual(['a', 'c']);
    expect(merged.capacityImpact.touchedBlockIds.sort()).toEqual(['b', 'c']);
  });
});
