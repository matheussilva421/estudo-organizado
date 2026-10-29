import { beforeEach, describe, expect, it } from 'vitest';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';
import { LocalPlanningRepository } from '../../src/platform/local-planning-repository';
import {
  applyPlanningDraft,
  previewDraftCommit,
  type PlanningDraft,
} from '../../src/application/planning-service';
import type { PlanBlock, PlanningScenario } from '../../src/domain/planning';

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
    changes: { upsertBlocks: [block('a'), block('b', { civilDate: '2027-01-06' })] },
  });
}

function draft(overrides: Partial<PlanningDraft> = {}): PlanningDraft {
  return {
    id: 'draft-1',
    profileId,
    scenarioId: scenario.id,
    baseRevision: 2,
    changes: [
      { blockId: 'a', field: 'plannedMinutes', value: 90, baseValue: 60 },
      { blockId: 'b', field: 'civilDate', value: '2027-01-07', baseValue: '2027-01-06' },
    ],
    lastSavedAt: '2026-10-29T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F3 planning drafts', () => {
  it('draft_survives_reopening_and_keeps_its_base_revision', async () => {
    const repository = new LocalPlanningRepository();
    await seed(repository);
    expect((await repository.saveDraft(draft())).kind).toBe('LOCAL_COMMITTED');

    // A new repository instance simulates closing and reopening the app.
    const reopened = new LocalPlanningRepository();
    const loaded = await reopened.loadDraft(profileId, scenario.id);
    expect(loaded?.changes).toHaveLength(2);
    expect(loaded?.baseRevision).toBe(2);
    // Saving a draft never touches the committed plan.
    expect((await reopened.loadScenario(profileId, scenario.id))?.blocks).toHaveLength(2);
  });

  it('apply_requires_confirmation_and_a_fresh_preview_token', async () => {
    const repository = new LocalPlanningRepository();
    await seed(repository);
    await repository.saveDraft(draft());
    const current = await repository.loadScenario(profileId, scenario.id);
    if (!current) throw new Error('missing scenario');
    const preview = previewDraftCommit({ current, draft: draft() });
    expect(preview.canApply).toBe(true);

    const unconfirmed = await applyPlanningDraft(repository, {
      profileId,
      scenarioId: scenario.id,
      draft: draft(),
      approval: { confirmed: false, previewToken: preview.previewToken },
    });
    expect(unconfirmed).toEqual({ kind: 'BLOCKED', reason: 'CONFIRMATION_REQUIRED' });

    const staleToken = await applyPlanningDraft(repository, {
      profileId,
      scenarioId: scenario.id,
      draft: draft(),
      approval: { confirmed: true, previewToken: 'other' },
    });
    expect(staleToken).toEqual({ kind: 'INVALID', code: 'PREVIEW_TOKEN_MISMATCH' });
  });

  it('apply_commits_the_draft_and_keeps_the_plan_consistent', async () => {
    const repository = new LocalPlanningRepository();
    await seed(repository);
    await repository.saveDraft(draft());
    const current = await repository.loadScenario(profileId, scenario.id);
    if (!current) throw new Error('missing scenario');
    const preview = previewDraftCommit({ current, draft: draft() });

    const applied = await applyPlanningDraft(repository, {
      profileId,
      scenarioId: scenario.id,
      draft: draft(),
      approval: { confirmed: true, previewToken: preview.previewToken },
    });
    expect(applied.kind).toBe('LOCAL_COMMITTED');
    const stored = await repository.loadScenario(profileId, scenario.id);
    expect(stored?.blocks.find((item) => item.id === 'a')?.plannedMinutes).toBe(90);
    expect(stored?.blocks.find((item) => item.id === 'b')?.civilDate).toBe('2027-01-07');
    expect(stored?.scenario.localRevision).toBe(3);
  });

  it('quota_failure_keeps_both_the_draft_and_the_commit', async () => {
    const repository = new LocalPlanningRepository();
    await seed(repository);
    await repository.saveDraft(draft());
    const current = await repository.loadScenario(profileId, scenario.id);
    if (!current) throw new Error('missing scenario');
    const preview = previewDraftCommit({ current, draft: draft() });

    const failing = new LocalPlanningRepository({ fault: 'quota' });
    const result = await applyPlanningDraft(failing, {
      profileId,
      scenarioId: scenario.id,
      draft: draft(),
      approval: { confirmed: true, previewToken: preview.previewToken },
    });
    expect(result).toEqual({ kind: 'FAILED', reason: 'QUOTA' });
    expect(await repository.loadDraft(profileId, scenario.id)).not.toBeNull();
    expect((await repository.loadScenario(profileId, scenario.id))?.scenario.localRevision).toBe(2);
  });

  it('a_draft_from_another_scenario_is_refused', async () => {
    const repository = new LocalPlanningRepository();
    await seed(repository);
    const result = await applyPlanningDraft(repository, {
      profileId,
      scenarioId: 'scenario-other',
      draft: draft(),
      approval: { confirmed: true, previewToken: 'x' },
    });
    expect(result).toEqual({ kind: 'INVALID', code: 'SCENARIO_NOT_FOUND' });
  });
});
