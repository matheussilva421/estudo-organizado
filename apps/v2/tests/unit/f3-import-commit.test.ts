import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteV2DatabaseForTests,
  openV2Database,
  requestResult,
  transactionDone,
} from '../../src/platform/indexeddb';
import { LocalPlanningImportCommitter } from '../../src/platform/planning-import-commit';
import { parsePlanningImport, previewPlanningImport } from '../../src/application/planning-portability';
import { LocalPlanningRepository } from '../../src/platform/local-planning-repository';

const profileId = 'profile-local';

const legacy = JSON.stringify({
  nome: 'Reta Final TJPB',
  dataProva: '2027-01-24',
  blocos: [
    { conteudo: 'Constitucional', duracao: 60, data: '2027-01-05' },
    { conteudo: 'Administrativo', duracao: 45, data: '2027-01-06' },
  ],
});

function previewFor() {
  const parsed = parsePlanningImport(legacy, { namespace: 'legacy:v1' });
  if (!parsed.ok) throw new Error('parse failed');
  return previewPlanningImport(parsed, []);
}

async function counts(): Promise<{ scenarios: number; blocks: number; receipts: number; outbox: number }> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(
    ['planning_scenarios', 'planning_blocks', 'planning_imports', 'outbox'],
    'readonly',
  );
  return {
    scenarios: await requestResult(transaction.objectStore('planning_scenarios').count()),
    blocks: await requestResult(transaction.objectStore('planning_blocks').count()),
    receipts: await requestResult(transaction.objectStore('planning_imports').count()),
    outbox: await requestResult(transaction.objectStore('outbox').count()),
  };
}

async function seedEdital(): Promise<void> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction('editais', 'readwrite');
  transaction.objectStore('editais').put({
    id: 'edital-tjpb',
    profileId,
    title: 'TJPB',
    status: 'ACTIVE',
    localRevision: 1,
  });
  await transactionDone(transaction);
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
  await seedEdital();
});

describe('F3 planning import commit', () => {
  it('confirmed_import_is_atomic_and_idempotent', async () => {
    const preview = previewFor();
    const committer = new LocalPlanningImportCommitter();
    const first = await committer.apply(profileId, preview, {
      confirmed: true,
      targetSignature: preview.targetSignature,
      targetEditalId: 'edital-tjpb',
    });
    expect(first.kind).toBe('LOCAL_COMMITTED');
    const after = await counts();
    expect(after.scenarios).toBe(1);
    expect(after.blocks).toBe(2);
    expect(after.receipts).toBe(1);
    expect(after.outbox).toBe(3);

    const replay = await committer.apply(profileId, preview, {
      confirmed: true,
      targetSignature: preview.targetSignature,
      targetEditalId: 'edital-tjpb',
    });
    expect(replay.kind).toBe('LOCAL_COMMITTED');
    expect(await counts()).toEqual(after);
  });

  it('unconfirmed_or_stale_signature_is_refused', async () => {
    const preview = previewFor();
    const committer = new LocalPlanningImportCommitter();
    expect(
      await committer.apply(profileId, preview, { confirmed: false, targetSignature: preview.targetSignature }),
    ).toEqual({ kind: 'BLOCKED', reason: 'CONFIRMATION_REQUIRED' });
    expect(
      await committer.apply(profileId, preview, { confirmed: true, targetSignature: 'other' }),
    ).toEqual({ kind: 'INVALID', code: 'TARGET_SIGNATURE_MISMATCH' });
    expect((await counts()).scenarios).toBe(0);
  });

  it('ambiguous_entries_require_human_reconciliation', async () => {
    const parsed = parsePlanningImport(legacy, { namespace: 'legacy:v1' });
    if (!parsed.ok) throw new Error('parse failed');
    const preview = previewPlanningImport(parsed, [
      {
        scenario: {
          id: 'other',
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
          provenance: 'outra',
        },
        blocks: [],
      },
    ]);
    const result = await new LocalPlanningImportCommitter().apply(profileId, preview, {
      confirmed: true,
      targetSignature: preview.targetSignature,
    });
    expect(result).toEqual({ kind: 'BLOCKED', reason: 'RECONCILIATION_REQUIRED' });
    expect((await counts()).scenarios).toBe(0);
  });

  it('quota_failure_leaves_no_partial_import', async () => {
    const preview = previewFor();
    const failing = new LocalPlanningImportCommitter({ fault: 'quota' });
    const result = await failing.apply(profileId, preview, {
      confirmed: true,
      targetSignature: preview.targetSignature,
      targetEditalId: 'edital-tjpb',
    });
    expect(result).toEqual({ kind: 'FAILED', reason: 'QUOTA' });
    expect(await counts()).toEqual({ scenarios: 0, blocks: 0, receipts: 0, outbox: 0 });
  });

  it('applied_scenarios_are_readable_through_the_repository', async () => {
    const preview = previewFor();
    await new LocalPlanningImportCommitter().apply(profileId, preview, {
      confirmed: true,
      targetSignature: preview.targetSignature,
      targetEditalId: 'edital-tjpb',
    });
    const repository = new LocalPlanningRepository();
    const scenarios = await repository.listScenarios(profileId);
    expect(scenarios).toHaveLength(1);
    const loaded = await repository.loadScenario(profileId, scenarios[0]!.id);
    expect(loaded?.blocks).toHaveLength(2);
    expect(loaded?.blocks[0]?.allocation).toBe('UNALLOCATED');
    expect(loaded?.blocks[0]?.reason).toBe('UNMAPPED_CONTENT');
  });
});
