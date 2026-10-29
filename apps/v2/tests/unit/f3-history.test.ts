import { beforeEach, describe, expect, it } from 'vitest';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';
import { openV2Database, transactionDone } from '../../src/platform/indexeddb';
import { LocalPlanningRepository } from '../../src/platform/local-planning-repository';
import {
  planRetention,
  previewCompensation,
  type PlanningCheckpointRecord,
} from '../../src/domain/planning-history';
import type { PlanBlock, PlanningScenario, PlanningScenarioSnapshot } from '../../src/domain/planning';

const profileId = 'profile-local';

const scenario: PlanningScenario = {
  id: 'scenario-tjpb',
  profileId,
  editalId: 'edital-tjpb',
  kind: 'FINAL_STRETCH',
  name: 'Reta Final',
  status: 'DRAFT',
  localRevision: 1,
  schemaVersion: 1,
  priorityProfileId: 'priority-default',
  priorityProfileRevision: 1,
  examDate: '2027-01-24',
  referenceZone: 'America/Fortaleza',
};

function block(id: string, extra: Partial<PlanBlock> = {}): PlanBlock {
  return {
    id,
    profileId,
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

async function seed(repository: LocalPlanningRepository): Promise<void> {
  const database = await openV2Database(profileId);
  const linkTransaction = database.transaction('edital_disciplines', 'readwrite');
  linkTransaction.objectStore('edital_disciplines').put({
    id: 'link-1',
    profileId,
    editalId: 'edital-tjpb',
    subjectId: 'subject-1',
    orderKey: '000010',
    localRevision: 1,
    status: 'ACTIVE',
  });
  await transactionDone(linkTransaction);
  await repository.commit({
    scope: { profileId, operationId: 'op-scenario' },
    scenarioId: scenario.id,
    baseRevision: null,
    changes: { scenario },
  });
  await repository.commit({
    scope: { profileId, operationId: 'op-blocks' },
    scenarioId: scenario.id,
    baseRevision: 1,
    changes: { upsertBlocks: [block('a'), block('b')] },
  });
}

function snapshot(blocks: PlanBlock[], revision = 2): PlanningScenarioSnapshot {
  return { scenario: { ...scenario, localRevision: revision }, blocks };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F3 checkpoints and compensation', () => {
  it('manual_checkpoint_survives_and_records_its_manifest', async () => {
    const repository = new LocalPlanningRepository();
    await seed(repository);
    const created = await repository.createCheckpoint({
      profileId,
      scenarioId: scenario.id,
      checkpointId: 'checkpoint-1',
      kind: 'MANUAL',
      operationId: 'op-checkpoint',
    });
    expect(created.kind).toBe('LOCAL_COMMITTED');
    const checkpoints = await repository.listCheckpoints(profileId, scenario.id);
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0]?.manifest).toMatchObject({ blockCount: 2, scenarioRevision: 2 });
    expect(checkpoints[0]?.manifest.digest).toMatch(/[0-9a-f]+/);
  });

  it('quota_failure_on_checkpoint_never_activates_partially', async () => {
    const repository = new LocalPlanningRepository();
    await seed(repository);
    const failing = new LocalPlanningRepository({ fault: 'quota' });
    const created = await failing.createCheckpoint({
      profileId,
      scenarioId: scenario.id,
      checkpointId: 'checkpoint-q',
      kind: 'MANUAL',
      operationId: 'op-checkpoint-q',
    });
    expect(created).toEqual({ kind: 'FAILED', reason: 'QUOTA' });
    expect(await repository.listCheckpoints(profileId, scenario.id)).toEqual([]);

    const activation = await failing.activateScenario({
      profileId,
      operationId: 'op-activate-q',
      editalId: 'edital-tjpb',
      scenarioId: scenario.id,
      checkpointId: 'checkpoint-q',
    });
    expect(activation).toEqual({ kind: 'FAILED', reason: 'QUOTA' });
    const stored = await repository.loadScenario(profileId, scenario.id);
    expect(stored?.scenario.status).toBe('DRAFT');
    expect(stored?.scenario.localRevision).toBe(2);
  });

  it('undo_never_rewrites_a_real_session', () => {
    const current = snapshot([block('a', { plannedMinutes: 120 })]);
    const target = snapshot([block('a', { plannedMinutes: 60 })]);
    const blocked = previewCompensation({
      direction: 'UNDO',
      current,
      target,
      executionFacts: [{ sessionId: 'session-1', plannedBlockId: 'a', durationMinutes: 60 }],
    });
    expect(blocked.kind).toBe('BLOCKED');
    expect(blocked.conflicts[0]).toMatchObject({ blockId: 'a', reason: 'EXECUTION_LINKED' });
    expect(blocked.blocks.find((item) => item.id === 'a')?.plannedMinutes).toBe(60);

    const free = previewCompensation({ direction: 'UNDO', current, target });
    expect(free.kind).toBe('APPLICABLE');
    expect(free.restoredBlockIds).toEqual(['a']);
  });

  it('undo_blocked_by_an_open_draft_is_reported', () => {
    const current = snapshot([block('a', { plannedMinutes: 120 })]);
    const target = snapshot([block('a', { plannedMinutes: 60 })]);
    const preview = previewCompensation({
      direction: 'UNDO',
      current,
      target,
      draftBlockIds: ['a'],
    });
    expect(preview.kind).toBe('BLOCKED');
    expect(preview.warnings).toContain('OPEN_DRAFT_DEPENDS_ON_THESE_BLOCKS');
  });

  it('a_deleted_block_is_restored_by_a_new_operation', async () => {
    const repository = new LocalPlanningRepository();
    await seed(repository);
    const before = await repository.loadScenario(profileId, scenario.id);
    if (!before) throw new Error('missing scenario');
    await repository.createCheckpoint({
      profileId,
      scenarioId: scenario.id,
      checkpointId: 'checkpoint-before-delete',
      kind: 'MANUAL',
      operationId: 'op-check-before',
    });
    const deleted = await repository.commit({
      scope: { profileId, operationId: 'op-delete' },
      scenarioId: scenario.id,
      baseRevision: 2,
      changes: { deleteBlockIds: ['b'] },
    });
    expect(deleted.kind).toBe('LOCAL_COMMITTED');

    const preview = previewCompensation({
      direction: 'UNDO',
      current: (await repository.loadScenario(profileId, scenario.id))!,
      target: before,
    });
    expect(preview.kind).toBe('APPLICABLE');
    expect(preview.addedBlockIds).toEqual(['b']);

    const restored = await repository.commit({
      scope: { profileId, operationId: 'op-undo-delete' },
      scenarioId: scenario.id,
      baseRevision: 3,
      changes: { upsertBlocks: preview.blocks.filter((item) => item.id === 'b') },
    });
    expect(restored.kind).toBe('LOCAL_COMMITTED');
    const after = await repository.loadScenario(profileId, scenario.id);
    expect(after?.blocks.map((item) => item.id).sort()).toEqual(['a', 'b']);
    // A new revision exists: the past is compensated, never rewritten.
    expect(after?.scenario.localRevision).toBe(4);
  });

  it('retention_keeps_manual_and_dependency_checkpoints', () => {
    const checkpoints: PlanningCheckpointRecord[] = [
      {
        checkpointId: 'manual',
        profileId,
        scenarioId: scenario.id,
        kind: 'MANUAL',
        createdAt: '2026-10-29T00:00:00.000Z',
        operationId: 'op-1',
        manifest: { blockIds: [], blockCount: 0, scenarioRevision: 1, digest: 'x' },
      },
      {
        checkpointId: 'auto-draft',
        profileId,
        scenarioId: scenario.id,
        kind: 'AUTO',
        createdAt: '2026-10-29T00:00:01.000Z',
        operationId: 'op-2',
        manifest: { blockIds: [], blockCount: 0, scenarioRevision: 1, digest: 'y' },
      },
      {
        checkpointId: 'auto-free',
        profileId,
        scenarioId: 'scenario-old',
        kind: 'AUTO',
        createdAt: '2026-10-29T00:00:02.000Z',
        operationId: 'op-3',
        manifest: { blockIds: [], blockCount: 0, scenarioRevision: 1, digest: 'z' },
      },
    ];
    const retention = planRetention({
      checkpoints,
      draftScenarioIds: [scenario.id],
    });
    expect(retention.kept).toEqual(['manual', 'auto-draft']);
    expect(retention.consolidationCandidates).toEqual(['auto-free']);
  });
});
