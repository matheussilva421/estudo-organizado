import { beforeEach, describe, expect, it } from 'vitest';
import { ReviewService } from '../../src/application/review-service';
import { LocalPlanningRepository } from '../../src/platform/local-planning-repository';
import { LocalReviewRepository } from '../../src/platform/local-review-repository';
import { LocalSessionRepository } from '../../src/platform/local-session-repository';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';

const profileId = 'profile-f7-ux-placement';
const today = '2026-11-01';

function service(): ReviewService {
  return new ReviewService(
    new LocalReviewRepository(),
    new LocalSessionRepository(),
    new LocalPlanningRepository(),
    { now: () => `${today}T12:00:00.000Z`, zone: 'America/Fortaleza' },
  );
}

async function commitmentFor(review: ReviewService): Promise<string> {
  await review.ensurePolicy(profileId, 'op-policy');
  await review.createTopic(
    profileId,
    {
      editalId: 'edital-1',
      editalDisciplineId: 'disc-1',
      assuntoId: 'assunto-1',
      label: 'Controle de constitucionalidade',
    },
    'op-topic',
  );
  const suggestion = (await review.generateSuggestions(profileId, today))[0]!;
  const applied = await review.applySuggestion(profileId, suggestion, 'op-apply');
  if (applied.kind !== 'LOCAL_COMMITTED') throw new Error('commitment missing');
  return applied.value.id;
}

async function activeScenario(planning: LocalPlanningRepository): Promise<void> {
  const scenario = {
    id: 'scenario-1',
    profileId,
    editalId: 'edital-1',
    kind: 'CYCLE' as const,
    name: 'Ciclo TJPB',
    status: 'ACTIVE' as const,
    localRevision: 1,
    schemaVersion: 1,
    priorityProfileId: 'priority-1',
    priorityProfileRevision: 1,
    referenceZone: 'America/Fortaleza',
  };
  const created = await planning.commit({
    scope: { profileId, operationId: 'op-scenario', baseRevision: null },
    scenarioId: scenario.id,
    baseRevision: null,
    changes: { scenario },
  });
  expect(created.kind).toBe('LOCAL_COMMITTED');
}

async function existingBlock(
  planning: LocalPlanningRepository,
  start: string,
  end: string,
  civilDate = '2026-11-02',
): Promise<void> {
  const committed = await planning.commit({
    scope: { profileId, operationId: `op-block-${start}`, baseRevision: 1 },
    scenarioId: 'scenario-1',
    baseRevision: 1,
    changes: {
      upsertBlocks: [
        {
          id: `block-${start}`,
          profileId,
          editalId: 'edital-1',
          scenarioId: 'scenario-1',
          editalDisciplineId: 'disc-1',
          assuntoId: 'assunto-1',
          plannedMinutes: 30,
          allocation: 'CONFIRMED_DAY' as const,
          civilDate,
          localStart: start,
          localEnd: end,
          timeZone: 'America/Fortaleza',
          priority: 0,
          localRevision: 1,
          sourceOperationId: 'seed',
          label: 'Bloco existente',
        },
      ],
    },
  });
  expect(committed.kind).toBe('LOCAL_COMMITTED');
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7-UX review placement integrity', () => {
  it('refuses a placement that overlaps an existing official block', async () => {
    const review = service();
    const commitmentId = await commitmentFor(review);
    const planning = new LocalPlanningRepository();
    await activeScenario(planning);
    await existingBlock(planning, '08:00', '08:30');

    const preview = await review.previewPlacement(profileId, commitmentId, '2026-11-02', '08:00', 30);
    expect(preview.kind).toBe('BLOCKED');
    if (preview.kind === 'BLOCKED') {
      expect(preview.reason).toBe('OVERLAP');
      expect(preview.conflictingBlockIds).toContain('block-08:00');
    }
  });

  it('refuses a placement that starts before and bleeds into an existing block', async () => {
    const review = service();
    const commitmentId = await commitmentFor(review);
    const planning = new LocalPlanningRepository();
    await activeScenario(planning);
    await existingBlock(planning, '08:00', '08:30');

    const preview = await review.previewPlacement(profileId, commitmentId, '2026-11-02', '07:45', 30);
    expect(preview.kind).toBe('BLOCKED');
    if (preview.kind === 'BLOCKED') expect(preview.reason).toBe('OVERLAP');
  });

  it('allows a placement that starts when the existing block ends', async () => {
    const review = service();
    const commitmentId = await commitmentFor(review);
    const planning = new LocalPlanningRepository();
    await activeScenario(planning);
    await existingBlock(planning, '08:00', '08:30');

    const preview = await review.previewPlacement(profileId, commitmentId, '2026-11-02', '08:30', 30);
    expect(preview.kind).toBe('READY');
    // A preview only proposes a block; nothing is written before applyPlacement.
    expect(await planning.listBlocks(profileId, 'scenario-1')).toHaveLength(1);
    if (preview.kind === 'READY') {
      expect(preview.block.localStart).toBe('08:30');
      expect(preview.block.localEnd).toBe('09:00');
    }
  });

  it('rejects a placement that would cross midnight', async () => {
    const review = service();
    const commitmentId = await commitmentFor(review);
    const planning = new LocalPlanningRepository();
    await activeScenario(planning);

    const preview = await review.previewPlacement(profileId, commitmentId, '2026-11-02', '23:45', 30);
    expect(preview.kind).toBe('BLOCKED');
    if (preview.kind === 'BLOCKED') expect(preview.reason).toBe('CROSSES_MIDNIGHT');
  });
});

