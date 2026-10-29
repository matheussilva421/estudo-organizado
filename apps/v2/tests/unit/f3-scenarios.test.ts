import { beforeEach, describe, expect, it } from 'vitest';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';
import { LocalPlanningRepository } from '../../src/platform/local-planning-repository';
import { previewScenarioActivation, type PlanningScenario } from '../../src/domain/planning';

const profileId = 'profile-local';

function scenario(
  id: string,
  editalId: string,
  name: string,
  status: PlanningScenario['status'] = 'DRAFT',
): PlanningScenario {
  return {
    id,
    profileId,
    editalId,
    kind: 'FINAL_STRETCH',
    name,
    status,
    localRevision: 1,
    schemaVersion: 1,
    priorityProfileId: 'priority-default',
    priorityProfileRevision: 1,
    examDate: '2027-01-24',
    referenceZone: 'America/Fortaleza',
  };
}

async function create(
  repository: LocalPlanningRepository,
  value: PlanningScenario,
  operationId: string,
) {
  return repository.commit({
    scope: { profileId, operationId },
    scenarioId: value.id,
    baseRevision: null,
    changes: { scenario: value },
  });
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F3 scenario isolation and activation', () => {
  it('several_scenarios_per_edital_live_without_activation', async () => {
    const repository = new LocalPlanningRepository();
    expect((await create(repository, scenario('scenario-a', 'edital-tjpb', 'A'), 'op-a')).kind).toBe(
      'LOCAL_COMMITTED',
    );
    expect((await create(repository, scenario('scenario-b', 'edital-tjpb', 'B'), 'op-b')).kind).toBe(
      'LOCAL_COMMITTED',
    );

    const list = await repository.listScenarios(profileId, 'edital-tjpb');
    expect(list.map((item) => item.id).sort()).toEqual(['scenario-a', 'scenario-b']);
    expect(list.every((item) => item.status === 'DRAFT')).toBe(true);
    expect(await repository.listScenarios(profileId, 'edital-outro')).toEqual([]);
  });

  it('activation_without_checkpoint_is_blocked_and_changes_nothing', async () => {
    const repository = new LocalPlanningRepository();
    await create(repository, scenario('scenario-a', 'edital-tjpb', 'A'), 'op-a');
    await create(repository, scenario('scenario-b', 'edital-tjpb', 'B'), 'op-b');

    const blocked = await repository.activateScenario({
      profileId,
      operationId: 'op-activate',
      editalId: 'edital-tjpb',
      scenarioId: 'scenario-b',
    });
    expect(blocked).toEqual({ kind: 'BLOCKED', reason: 'CHECKPOINT_REQUIRED' });

    const list = await repository.listScenarios(profileId, 'edital-tjpb');
    expect(list.every((item) => item.status === 'DRAFT')).toBe(true);
    expect(list.every((item) => item.localRevision === 1)).toBe(true);
  });

  it('one_active_scenario_per_edital_and_independent_editais', async () => {
    const repository = new LocalPlanningRepository();
    await create(repository, scenario('scenario-a', 'edital-tjpb', 'A'), 'op-a');
    await create(repository, scenario('scenario-b', 'edital-tjpb', 'B'), 'op-b');
    await create(repository, scenario('scenario-dpe', 'edital-dpe', 'DPE'), 'op-dpe');

    const first = await repository.activateScenario({
      profileId,
      operationId: 'op-act-a',
      editalId: 'edital-tjpb',
      scenarioId: 'scenario-a',
      checkpointId: 'checkpoint-1',
    });
    expect(first.kind).toBe('LOCAL_COMMITTED');

    const dpe = await repository.activateScenario({
      profileId,
      operationId: 'op-act-dpe',
      editalId: 'edital-dpe',
      scenarioId: 'scenario-dpe',
      checkpointId: 'checkpoint-dpe',
    });
    expect(dpe.kind).toBe('LOCAL_COMMITTED');

    const tjpb = await repository.listScenarios(profileId, 'edital-tjpb');
    const active = tjpb.filter((item) => item.status === 'ACTIVE');
    expect(active.map((item) => item.id)).toEqual(['scenario-a']);
    expect((await repository.listScenarios(profileId, 'edital-dpe'))[0]?.status).toBe('ACTIVE');
  });

  it('activation_swap_deactivates_the_previous_scenario_atomically', async () => {
    const repository = new LocalPlanningRepository();
    await create(repository, scenario('scenario-a', 'edital-tjpb', 'A'), 'op-a');
    await create(repository, scenario('scenario-b', 'edital-tjpb', 'B'), 'op-b');
    await repository.activateScenario({
      profileId,
      operationId: 'op-act-a',
      editalId: 'edital-tjpb',
      scenarioId: 'scenario-a',
      checkpointId: 'checkpoint-1',
    });

    const before = await repository.loadScenario(profileId, 'scenario-a');
    const swapped = await repository.activateScenario({
      profileId,
      operationId: 'op-act-b',
      editalId: 'edital-tjpb',
      scenarioId: 'scenario-b',
      checkpointId: 'checkpoint-2',
      baseRevision: 1,
    });
    expect(swapped.kind).toBe('LOCAL_COMMITTED');

    const after = await repository.loadScenario(profileId, 'scenario-a');
    expect(after?.scenario.status).toBe('INACTIVE');
    expect(after?.scenario.localRevision).toBe((before?.scenario.localRevision ?? 0) + 1);
    expect((await repository.loadScenario(profileId, 'scenario-b'))?.scenario.status).toBe(
      'ACTIVE',
    );
  });

  it('stale_activation_conflicts_without_losing_the_newer_version', async () => {
    const repository = new LocalPlanningRepository();
    await create(repository, scenario('scenario-a', 'edital-tjpb', 'A'), 'op-a');
    await repository.activateScenario({
      profileId,
      operationId: 'op-act-1',
      editalId: 'edital-tjpb',
      scenarioId: 'scenario-a',
      checkpointId: 'checkpoint-1',
    });
    const stale = await repository.activateScenario({
      profileId,
      operationId: 'op-act-stale',
      editalId: 'edital-tjpb',
      scenarioId: 'scenario-a',
      checkpointId: 'checkpoint-2',
      baseRevision: 1,
    });
    expect(stale.kind).toBe('CONFLICT');
    expect((await repository.loadScenario(profileId, 'scenario-a'))?.scenario.status).toBe(
      'ACTIVE',
    );
  });

  it('preview_lists_only_this_edital_and_its_affected_blocks', () => {
    const scenarios = [
      scenario('scenario-a', 'edital-tjpb', 'A', 'ACTIVE'),
      scenario('scenario-b', 'edital-tjpb', 'B'),
      scenario('scenario-dpe', 'edital-dpe', 'DPE', 'ACTIVE'),
    ];
    const blocks = [
      {
        id: 'block-a',
        profileId,
        editalId: 'edital-tjpb',
        scenarioId: 'scenario-a',
        editalDisciplineId: 'link-1',
        plannedMinutes: 60,
        allocation: 'PROJECTED' as const,
        priority: 1,
        localRevision: 1,
        sourceOperationId: 'op-1',
      },
      {
        id: 'block-dpe',
        profileId,
        editalId: 'edital-dpe',
        scenarioId: 'scenario-dpe',
        editalDisciplineId: 'link-2',
        plannedMinutes: 60,
        allocation: 'PROJECTED' as const,
        priority: 1,
        localRevision: 1,
        sourceOperationId: 'op-2',
      },
    ];

    const preview = previewScenarioActivation({
      profileId,
      editalId: 'edital-tjpb',
      nextScenarioId: 'scenario-b',
      scenarios,
      blocks,
    });
    expect(preview.deactivatedScenarioIds).toEqual(['scenario-a']);
    expect(preview.affectedScenarioIds).toEqual(['scenario-a', 'scenario-b']);
    expect(preview.affectedBlockIds).toEqual(['block-a']);
    expect(preview.requiresCheckpoint).toBe(true);
    expect(preview.warnings).toContain('CAPACITY_RELEASED_FROM_PREVIOUS_SCENARIO');
  });

  it('activation_is_blocked_while_content_is_unmapped', async () => {
    const repository = new LocalPlanningRepository();
    await create(repository, scenario('scenario-a', 'edital-tjpb', 'A'), 'op-a');
    await repository.commit({
      scope: { profileId, operationId: 'op-unmapped' },
      scenarioId: 'scenario-a',
      baseRevision: 1,
      changes: {
        upsertBlocks: [
          {
            id: 'block-unmapped',
            profileId,
            editalId: 'edital-tjpb',
            scenarioId: 'scenario-a',
            editalDisciplineId: 'unmapped',
            plannedMinutes: 60,
            allocation: 'UNALLOCATED',
            priority: 1,
            localRevision: 1,
            sourceOperationId: 'op-unmapped',
            reason: 'UNMAPPED_CONTENT',
          },
        ],
      },
    });
    const blocked = await repository.activateScenario({
      profileId,
      operationId: 'op-activate-unmapped',
      editalId: 'edital-tjpb',
      scenarioId: 'scenario-a',
      checkpointId: 'checkpoint-unmapped',
    });
    expect(blocked).toEqual({
      kind: 'BLOCKED',
      reason: 'CONTENT_RECONCILIATION_REQUIRED',
    });
    expect((await repository.loadScenario(profileId, 'scenario-a'))?.scenario.status).toBe('DRAFT');
  });
});
