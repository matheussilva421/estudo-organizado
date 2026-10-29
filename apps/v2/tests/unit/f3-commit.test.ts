import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteV2DatabaseForTests,
  openV2Database,
  requestResult,
} from '../../src/platform/indexeddb';
import { LocalPlanningRepository } from '../../src/platform/local-planning-repository';
import type { PlanningDraft } from '../../src/application/planning-service';
import type { PlanBlock, PlanningScenario } from '../../src/domain/planning';

const profileId = 'profile-local';

const scenario: PlanningScenario = {
  id: 'scenario-tjpb',
  profileId,
  editalId: 'edital-tjpb',
  kind: 'FINAL_STRETCH',
  name: 'Reta Final TJPB',
  status: 'DRAFT',
  localRevision: 1,
  schemaVersion: 1,
  priorityProfileId: 'priority-default',
  priorityProfileRevision: 1,
  examDate: '2027-01-24',
  referenceZone: 'America/Fortaleza',
};

const block: PlanBlock = {
  id: 'block-1',
  profileId,
  editalId: 'edital-tjpb',
  scenarioId: 'scenario-tjpb',
  editalDisciplineId: 'link-1',
  plannedMinutes: 60,
  allocation: 'PROJECTED',
  civilDate: '2027-01-05',
  priority: 1,
  localRevision: 1,
  sourceOperationId: 'op-create',
};

async function counts(): Promise<{ operations: number; outbox: number }> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(['operations', 'outbox'], 'readonly');
  return {
    operations: await requestResult(transaction.objectStore('operations').count()),
    outbox: await requestResult(transaction.objectStore('outbox').count()),
  };
}

async function createScenario(repository = new LocalPlanningRepository()): Promise<void> {
  const created = await repository.commit({
    scope: { profileId, operationId: 'op-create' },
    scenarioId: scenario.id,
    baseRevision: null,
    changes: { scenario },
  });
  expect(created.kind).toBe('LOCAL_COMMITTED');
}

const draft: PlanningDraft = {
  id: 'draft-1',
  profileId,
  scenarioId: scenario.id,
  baseRevision: 1,
  changes: [{ blockId: 'block-1', field: 'plannedMinutes', value: 90 }],
  lastSavedAt: '2026-10-29T00:00:00.000Z',
};

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F3 planning commit', () => {
  it('same_operation_id_is_idempotent', async () => {
    const repository = new LocalPlanningRepository();
    await createScenario(repository);
    const first = await repository.commit({
      scope: { profileId, operationId: 'op-blocks' },
      scenarioId: scenario.id,
      baseRevision: 1,
      changes: { upsertBlocks: [block] },
    });
    expect(first.kind).toBe('LOCAL_COMMITTED');
    const before = await counts();

    const replay = await repository.commit({
      scope: { profileId, operationId: 'op-blocks' },
      scenarioId: scenario.id,
      baseRevision: 1,
      changes: { upsertBlocks: [block] },
    });
    expect(replay.kind).toBe('LOCAL_COMMITTED');
    if (first.kind === 'LOCAL_COMMITTED' && replay.kind === 'LOCAL_COMMITTED') {
      expect(replay.value.scenario.localRevision).toBe(first.value.scenario.localRevision);
      expect(replay.value.blocks).toHaveLength(1);
    }
    expect(await counts()).toEqual(before);
  });

  it('different_payload_with_the_same_operation_id_is_rejected', async () => {
    const repository = new LocalPlanningRepository();
    await createScenario(repository);
    await repository.commit({
      scope: { profileId, operationId: 'op-x' },
      scenarioId: scenario.id,
      baseRevision: 1,
      changes: { upsertBlocks: [block] },
    });
    const divergent = await repository.commit({
      scope: { profileId, operationId: 'op-x' },
      scenarioId: scenario.id,
      baseRevision: 1,
      changes: { upsertBlocks: [{ ...block, plannedMinutes: 120 }] },
    });
    expect(divergent).toEqual({ kind: 'INVALID', code: 'OPERATION_ID_REUSED' });
    const loaded = await repository.loadScenario(profileId, scenario.id);
    expect(loaded?.blocks[0]?.plannedMinutes).toBe(60);
  });

  it('stale_base_revision_conflicts_without_writing', async () => {
    const repository = new LocalPlanningRepository();
    await createScenario(repository);
    await repository.commit({
      scope: { profileId, operationId: 'op-first' },
      scenarioId: scenario.id,
      baseRevision: 1,
      changes: { upsertBlocks: [block] },
    });
    const before = await counts();
    const stale = await repository.commit({
      scope: { profileId, operationId: 'op-stale' },
      scenarioId: scenario.id,
      baseRevision: 1,
      changes: { upsertBlocks: [{ ...block, id: 'block-2' }] },
    });
    expect(stale.kind).toBe('CONFLICT');
    expect(await counts()).toEqual(before);
    const loaded = await repository.loadScenario(profileId, scenario.id);
    expect(loaded?.blocks.map((item) => item.id)).toEqual(['block-1']);
  });

  it('abort_and_quota_preserve_plan_and_draft', async () => {
    const repository = new LocalPlanningRepository();
    await createScenario(repository);
    const saved = await repository.saveDraft(draft);
    expect(saved.kind).toBe('LOCAL_COMMITTED');
    const before = await counts();

    for (const fault of ['quota', 'abort'] as const) {
      const failing = new LocalPlanningRepository({ fault });
      const result = await failing.commit({
        scope: { profileId, operationId: `op-${fault}` },
        scenarioId: scenario.id,
        baseRevision: 1,
        changes: { upsertBlocks: [{ ...block, plannedMinutes: 120 }] },
      });
      expect(result).toEqual({ kind: 'FAILED', reason: fault === 'quota' ? 'QUOTA' : 'ABORT' });
    }

    expect(await counts()).toEqual(before);
    const loaded = await repository.loadScenario(profileId, scenario.id);
    expect(loaded?.scenario.localRevision).toBe(1);
    expect(loaded?.blocks).toEqual([]);
    expect(await repository.loadDraft(profileId, scenario.id)).toMatchObject({
      id: 'draft-1',
      baseRevision: 1,
    });
  });

  it('cross_profile_block_is_refused_and_writes_nothing', async () => {
    const repository = new LocalPlanningRepository();
    await createScenario(repository);
    const before = await counts();
    const result = await repository.commit({
      scope: { profileId, operationId: 'op-foreign' },
      scenarioId: scenario.id,
      baseRevision: 1,
      changes: { upsertBlocks: [{ ...block, profileId: 'profile-outro' }] },
    });
    expect(result).toEqual({ kind: 'INVALID', code: 'PROFILE_MISMATCH' });
    expect(await counts()).toEqual(before);
    expect(await repository.loadScenario(profileId, scenario.id)).toMatchObject({
      blocks: [],
    });
  });

  it('planning_outbox_intents_stay_undeliverable', async () => {
    const repository = new LocalPlanningRepository();
    await createScenario(repository);
    const database = await openV2Database(profileId);
    const transaction = database.transaction('outbox', 'readonly');
    const rows = (await requestResult(
      transaction.objectStore('outbox').getAll(),
    )) as { deliveryMode?: string; entityType: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ entityType: 'planning-scenario', deliveryMode: 'BLOCKED' });
  });
});
