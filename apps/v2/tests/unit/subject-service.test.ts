import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteV2DatabaseForTests,
  getPendingOutbox,
} from '../../src/platform/indexeddb';
import { LocalSubjectRepository } from '../../src/platform/local-subject-repository';
import type { SubjectCommand } from '../../src/domain/subject';

const profileId = 'profile-local';

function createCommand(overrides: Partial<SubjectCommand> = {}): SubjectCommand {
  return {
    operationId: 'op-create-1',
    profileId,
    subjectId: 'subject-1',
    type: 'create',
    title: 'Direito Constitucional',
    ...overrides,
  };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('LocalSubjectRepository', () => {
  it('duplicate_command_id_is_idempotent', async () => {
    const repository = new LocalSubjectRepository();

    const first = await repository.execute(createCommand());
    const second = await repository.execute(createCommand());

    expect(second).toEqual(first);
    expect(first.localRevision).toBe(1);
    expect(await getPendingOutbox(profileId)).toHaveLength(1);
  });

  it('wrong_profile_cannot_read_subject', async () => {
    const repository = new LocalSubjectRepository();
    await repository.execute(createCommand());

    expect(await repository.get('other-profile', 'subject-1')).toBeNull();
    expect(await repository.list('other-profile')).toEqual([]);
  });

  it('reused_operation_id_with_different_command_is_rejected', async () => {
    const repository = new LocalSubjectRepository();
    await repository.execute(createCommand());

    await expect(
      repository.execute(
        createCommand({ subjectId: 'subject-2', title: 'Outra disciplina', type: 'create' }),
      ),
    ).rejects.toMatchObject({ kind: 'UNAVAILABLE' });
    expect(await repository.list(profileId)).toHaveLength(1);
  });

  it('entity_and_outbox_commit_atomically', async () => {
    const repository = new LocalSubjectRepository();
    const subject = await repository.execute(createCommand());
    const outbox = await getPendingOutbox(profileId);

    expect(subject.id).toBe('subject-1');
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.operationId).toBe('op-create-1');
    expect(outbox[0]?.baseRevision).toBeNull();
    expect(outbox[0]?.status).toBe('PENDING');
  });

  it('abort_failure_rolls_back_entity_and_outbox', async () => {
    const repository = new LocalSubjectRepository({ fault: 'abort' });

    await expect(repository.execute(createCommand())).rejects.toMatchObject({ kind: 'ABORT' });

    const verify = new LocalSubjectRepository();
    expect(await verify.get(profileId, 'subject-1')).toBeNull();
    expect(await getPendingOutbox(profileId)).toEqual([]);
  });

  it('quota_failure_rolls_back_entity_and_outbox', async () => {
    const repository = new LocalSubjectRepository({ fault: 'quota' });

    await expect(repository.execute(createCommand())).rejects.toMatchObject({ kind: 'QUOTA' });

    const verify = new LocalSubjectRepository();
    expect(await verify.get(profileId, 'subject-1')).toBeNull();
    expect(await getPendingOutbox(profileId)).toEqual([]);
  });

  it('reload_restores_subject', async () => {
    const repository = new LocalSubjectRepository();
    await repository.execute(createCommand());

    const reopened = new LocalSubjectRepository();
    expect(await reopened.list(profileId)).toEqual([
      {
        id: 'subject-1',
        profileId,
        title: 'Direito Constitucional',
        localRevision: 1,
      },
    ]);
  });
});
