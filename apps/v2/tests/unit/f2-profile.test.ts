import { beforeEach, describe, expect, it } from 'vitest';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';
import { LocalContentRepository } from '../../src/platform/local-content-repository';
import { LocalProfileRepository } from '../../src/platform/local-profile-repository';

const profileId = 'profile-local';

function editalCommand(editalId: string, title = editalId) {
  return {
    type: 'CREATE_EDITAL' as const,
    operationId: `op-${editalId}`,
    profileId,
    editalId,
    title,
  };
}

async function seedEditais(...ids: string[]): Promise<void> {
  const repository = new LocalContentRepository();
  for (const id of ids) await repository.execute(editalCommand(id));
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F2 profile and primary edital', () => {
  it('archiving_primary_requires_explicit_replacement_or_none', async () => {
    await seedEditais('edital-a', 'edital-b');
    const profiles = new LocalProfileRepository();

    const primary = await profiles.setPrimaryEdital({
      profileId,
      editalId: 'edital-a',
      operationId: 'op-primary-a',
    });
    expect(primary).toMatchObject({
      kind: 'LOCAL_COMMITTED',
      value: { primaryEditalId: 'edital-a' },
    });

    // No replacement decision: refuse instead of electing a hidden primary.
    const undecided = await profiles.archiveEdital({
      profileId,
      editalId: 'edital-a',
      operationId: 'op-archive-undecided',
    });
    expect(undecided).toEqual({ kind: 'INVALID', code: 'PRIMARY_REQUIRED' });

    const content = new LocalContentRepository();
    const before = await content.loadContent(profileId);
    expect(before.editais.find((item) => item.id === 'edital-a')?.status).toBe('ACTIVE');
    expect((await profiles.getProfile(profileId)).primaryEditalId).toBe('edital-a');

    // Explicit "no primary" keeps the record and its revision history.
    const archived = await profiles.archiveEdital({
      profileId,
      editalId: 'edital-a',
      operationId: 'op-archive-none',
      replacementPrimaryId: null,
    });
    expect(archived.kind).toBe('LOCAL_COMMITTED');
    expect((await profiles.getProfile(profileId)).primaryEditalId).toBeNull();

    const after = await content.loadContent(profileId);
    const archivedEdital = after.editais.find((item) => item.id === 'edital-a');
    expect(archivedEdital).toMatchObject({ status: 'ARCHIVED', localRevision: 2 });
    expect(after.editais.find((item) => item.id === 'edital-b')).toMatchObject({
      status: 'ACTIVE',
    });
  });

  it('archiving_the_primary_can_promote_an_explicit_replacement', async () => {
    await seedEditais('edital-a', 'edital-b');
    const profiles = new LocalProfileRepository();
    await profiles.setPrimaryEdital({
      profileId,
      editalId: 'edital-a',
      operationId: 'op-primary-a',
    });

    const archived = await profiles.archiveEdital({
      profileId,
      editalId: 'edital-a',
      operationId: 'op-archive-replace',
      replacementPrimaryId: 'edital-b',
    });
    expect(archived.kind).toBe('LOCAL_COMMITTED');
    expect((await profiles.getProfile(profileId)).primaryEditalId).toBe('edital-b');
  });

  it('concurrent_primary_switch_never_creates_two_primaries', async () => {
    await seedEditais('edital-a', 'edital-b', 'edital-c');
    const profiles = new LocalProfileRepository();
    await profiles.setPrimaryEdital({
      profileId,
      editalId: 'edital-a',
      operationId: 'op-primary-a',
    });
    const base = (await profiles.getProfile(profileId)).localRevision;

    const [left, right] = await Promise.all([
      profiles.setPrimaryEdital({
        profileId,
        editalId: 'edital-b',
        operationId: 'op-primary-b',
        baseRevision: base,
      }),
      profiles.setPrimaryEdital({
        profileId,
        editalId: 'edital-c',
        operationId: 'op-primary-c',
        baseRevision: base,
      }),
    ]);

    expect([left.kind, right.kind].sort()).toEqual(['CONFLICT', 'LOCAL_COMMITTED']);
    const stored = await profiles.getProfile(profileId);
    expect(['edital-b', 'edital-c']).toContain(stored.primaryEditalId);
    expect(['edital-a', 'edital-b', 'edital-c']).toContain(stored.primaryEditalId);
  });

  it('profile_defaults_stay_local_and_separate_from_uid', async () => {
    const profiles = new LocalProfileRepository();
    expect(await profiles.getProfile(profileId)).toEqual({
      profileId,
      uid: null,
      remoteLibraryId: null,
      syncEnabled: false,
      state: 'LOCAL_ONLY',
      primaryEditalId: null,
      localRevision: 0,
    });
  });

  it('primary_cannot_point_to_an_archived_or_missing_edital', async () => {
    await seedEditais('edital-a');
    const profiles = new LocalProfileRepository();
    await profiles.setPrimaryEdital({
      profileId,
      editalId: 'edital-a',
      operationId: 'op-primary-a',
    });
    await profiles.archiveEdital({
      profileId,
      editalId: 'edital-a',
      operationId: 'op-archive-a',
      replacementPrimaryId: null,
    });

    expect(
      await profiles.setPrimaryEdital({
        profileId,
        editalId: 'edital-a',
        operationId: 'op-primary-archived',
      }),
    ).toEqual({ kind: 'INVALID', code: 'PRIMARY_ARCHIVED' });

    expect(
      await profiles.setPrimaryEdital({
        profileId,
        editalId: 'edital-missing',
        operationId: 'op-primary-missing',
      }),
    ).toEqual({ kind: 'INVALID', code: 'ENTITY_NOT_FOUND' });
  });
});
