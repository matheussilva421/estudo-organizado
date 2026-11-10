import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteV2DatabaseForTests,
  openV2Database,
  STORES,
} from '../../src/platform/indexeddb';
import { LocalPlanningRepository } from '../../src/platform/local-planning-repository';
import type { PlanBlock, PlanningScenario } from '../../src/domain/planning';

const profileId = 'profile-f7-ux-activation';

function scenario(overrides: Partial<PlanningScenario> = {}): PlanningScenario {
  return {
    id: 'scenario-1',
    profileId,
    editalId: 'edital-1',
    kind: 'CYCLE',
    name: 'Ciclo',
    status: 'DRAFT',
    localRevision: 1,
    schemaVersion: 1,
    priorityProfileId: 'priority-default',
    priorityProfileRevision: 1,
    referenceZone: 'America/Fortaleza',
    ...overrides,
  };
}

function block(): PlanBlock {
  return {
    id: 'block-1',
    profileId,
    editalId: 'edital-1',
    scenarioId: 'scenario-1',
    editalDisciplineId: 'disc-1',
    plannedMinutes: 60,
    allocation: 'UNALLOCATED',
    priority: 0,
    localRevision: 1,
    sourceOperationId: 'seed',
    reason: 'NO_DAY_DEFINED',
  };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

async function seedLink(): Promise<void> {
  const database = await openV2Database(profileId);
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORES.editalDisciplines, 'readwrite');
    transaction.objectStore(STORES.editalDisciplines).put({
      id: 'disc-1',
      profileId,
      editalId: 'edital-1',
      subjectId: 'subject-1',
      orderKey: '000100',
      localRevision: 1,
      status: 'ACTIVE',
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

describe('F7-UX planning activation checkpoint', () => {
  it('keeps a restorable snapshot when activating a scenario', async () => {
    const repository = new LocalPlanningRepository();
    await seedLink();
    const created = await repository.commit({
      scope: { profileId, operationId: 'op-create', baseRevision: null },
      scenarioId: 'scenario-1',
      baseRevision: null,
      changes: { scenario: scenario() },
    });
    expect(created.kind).toBe('LOCAL_COMMITTED');
    const withBlock = await repository.commit({
      scope: { profileId, operationId: 'op-block', baseRevision: 1 },
      scenarioId: 'scenario-1',
      baseRevision: 1,
      changes: { upsertBlocks: [block()] },
    });
    expect(withBlock.kind).toBe('LOCAL_COMMITTED');

    const checkpoint = await repository.createCheckpoint({
      profileId,
      scenarioId: 'scenario-1',
      checkpointId: 'cp-1',
      kind: 'MANUAL',
      operationId: 'op-checkpoint',
    });
    expect(checkpoint.kind).toBe('LOCAL_COMMITTED');

    const activated = await repository.activateScenario({
      profileId,
      operationId: 'op-activate',
      editalId: 'edital-1',
      scenarioId: 'scenario-1',
      checkpointId: 'cp-1',
      baseRevision: 2,
    });
    expect(activated.kind).toBe('LOCAL_COMMITTED');

    const checkpoints = await repository.listCheckpoints(profileId, 'scenario-1');
    const saved = checkpoints.find((item) => item.checkpointId === 'cp-1');
    expect(saved?.snapshot?.blocks).toHaveLength(1);
    expect(saved?.snapshot?.blocks[0]?.id).toBe('block-1');
    expect(saved?.snapshot?.scenario.status).toBe('DRAFT');
    expect(saved?.manifest.blockCount).toBe(1);
  });

  it('rejects activation from a stale base revision', async () => {
    const repository = new LocalPlanningRepository();
    await seedLink();
    await repository.commit({
      scope: { profileId, operationId: 'op-create', baseRevision: null },
      scenarioId: 'scenario-1',
      baseRevision: null,
      changes: { scenario: scenario() },
    });
    await repository.commit({
      scope: { profileId, operationId: 'op-block', baseRevision: 1 },
      scenarioId: 'scenario-1',
      baseRevision: 1,
      changes: { upsertBlocks: [block()] },
    });
    await repository.createCheckpoint({
      profileId,
      scenarioId: 'scenario-1',
      checkpointId: 'cp-1',
      kind: 'MANUAL',
      operationId: 'op-checkpoint',
    });

    const stale = await repository.activateScenario({
      profileId,
      operationId: 'op-activate',
      editalId: 'edital-1',
      scenarioId: 'scenario-1',
      checkpointId: 'cp-1',
      baseRevision: 1,
    });
    expect(stale.kind).toBe('CONFLICT');
    const [current] = await repository.listScenarios(profileId);
    expect(current?.status).toBe('DRAFT');
    expect(current?.localRevision).toBe(2);
  });
});

