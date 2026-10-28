import { beforeEach, describe, expect, it } from 'vitest';
import type { Edital } from '../../src/domain/edital';
import type { EditalCommand } from '../../src/application/content-commands';
import {
  deleteV2DatabaseForTests,
  getPendingOutbox,
  openV2Database,
  requestResult,
  STORES,
} from '../../src/platform/indexeddb';
import { LocalContentRepository } from '../../src/platform/local-content-repository';

const profileId = 'profile-local';

function createCommand(overrides: Partial<EditalCommand> = {}): EditalCommand {
  return {
    type: 'CREATE_EDITAL',
    operationId: 'op-edital-1',
    profileId,
    editalId: 'edital-1',
    title: 'TJPB 2026',
    ...overrides,
  };
}

async function countStores(): Promise<{ editais: number; operations: number; outbox: number }> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(
    [STORES.editais, STORES.operations, STORES.outbox],
    'readonly',
  );
  return {
    editais: await requestResult(transaction.objectStore(STORES.editais).count()),
    operations: await requestResult(transaction.objectStore(STORES.operations).count()),
    outbox: await requestResult(transaction.objectStore(STORES.outbox).count()),
  };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F2 commit service', () => {
  it('same_operation_id_same_payload_is_noop_divergent_rejected', async () => {
    const repository = new LocalContentRepository();

    const first = await repository.execute(createCommand());
    expect(first.kind).toBe('LOCAL_COMMITTED');
    const replay = await repository.execute(createCommand());
    expect(replay).toEqual(first);

    const divergent = await repository.execute(createCommand({ title: 'TJPB 2027' }));
    expect(divergent).toEqual({ kind: 'INVALID', code: 'OPERATION_ID_REUSED' });

    expect(await countStores()).toEqual({ editais: 1, operations: 1, outbox: 1 });
    const content = await repository.loadContent(profileId);
    expect(content.editais).toEqual([
      {
        id: 'edital-1',
        profileId,
        title: 'TJPB 2026',
        status: 'ACTIVE',
        localRevision: 1,
      },
    ]);
  });

  it('aborted_content_commit_writes_neither_entity_nor_outbox', async () => {
    const aborted = await new LocalContentRepository({ fault: 'abort' }).execute(
      createCommand(),
    );
    expect(aborted).toEqual({ kind: 'FAILED', reason: 'ABORT' });

    const repository = new LocalContentRepository();
    expect(await repository.loadContent(profileId)).toEqual({
      subjects: [],
      editais: [],
      links: [],
      assuntos: [],
      aulas: [],
      lessonTopics: [],
    });
    expect(await getPendingOutbox(profileId)).toEqual([]);
    expect(await countStores()).toEqual({ editais: 0, operations: 0, outbox: 0 });
  });

  it('quota_failure_rolls_back_every_store', async () => {
    const failed = await new LocalContentRepository({ fault: 'quota' }).execute(
      createCommand(),
    );
    expect(failed).toEqual({ kind: 'FAILED', reason: 'QUOTA' });
    expect(await new LocalContentRepository().loadContent(profileId)).toEqual({
      subjects: [],
      editais: [],
      links: [],
      assuntos: [],
      aulas: [],
      lessonTopics: [],
    });
    expect(await countStores()).toEqual({ editais: 0, operations: 0, outbox: 0 });
  });

  it('invalid_title_returns_invalid_not_unavailable', async () => {
    const repository = new LocalContentRepository();

    const tooLong = await repository.execute(
      createCommand({ operationId: 'op-long', editalId: 'edital-2', title: 'x'.repeat(121) }),
    );
    expect(tooLong).toEqual({ kind: 'INVALID', code: 'TITLE_TOO_LONG' });

    const blank = await repository.execute(
      createCommand({ operationId: 'op-blank', editalId: 'edital-3', title: '   ' }),
    );
    expect(blank).toEqual({ kind: 'INVALID', code: 'TITLE_REQUIRED' });

    await repository.execute(createCommand());
    const duplicate = await repository.execute(
      createCommand({ operationId: 'op-duplicate', title: 'Outro nome' }),
    );
    expect(duplicate).toEqual({ kind: 'INVALID', code: 'EDITAL_EXISTS' });
    expect(await countStores()).toEqual({ editais: 1, operations: 1, outbox: 1 });
  });

  it('stale_base_revision_conflicts_with_the_persisted_entity', async () => {
    const repository = new LocalContentRepository();
    await repository.execute(createCommand());

    const stale = await repository.execute({
      type: 'RENAME_EDITAL',
      operationId: 'op-rename-stale',
      profileId,
      editalId: 'edital-1',
      title: 'Novo titulo',
      baseRevision: 0,
    });
    expect(stale.kind).toBe('CONFLICT');
    expect(stale.kind === 'CONFLICT' ? (stale.current as Edital).title : null).toBe('TJPB 2026');

    const accepted = await repository.execute({
      type: 'RENAME_EDITAL',
      operationId: 'op-rename-ok',
      profileId,
      editalId: 'edital-1',
      title: 'Novo titulo',
      baseRevision: 1,
    });
    expect(accepted.kind).toBe('LOCAL_COMMITTED');
    expect(await countStores()).toEqual({ editais: 1, operations: 2, outbox: 2 });
  });

  it('writes_one_outbox_operation_with_base_revision_and_scoped_payload', async () => {
    const repository = new LocalContentRepository();
    await repository.execute(createCommand());
    await repository.execute({
      type: 'RENAME_EDITAL',
      operationId: 'op-rename',
      profileId,
      editalId: 'edital-1',
      title: 'TJPB 2027',
    });

    const outbox = await getPendingOutbox(profileId);
    expect(outbox.map((operation) => operation.entityType)).toEqual(['edital', 'edital']);
    expect(outbox.map((operation) => operation.baseRevision)).toEqual([null, 1]);
    expect(outbox[1]?.payload).toMatchObject({ title: 'TJPB 2027', localRevision: 2 });
    expect(new Set(outbox.map((operation) => operation.operationId)).size).toBe(2);
  });

  it('noop_archive_records_idempotency_without_a_second_outbox_operation', async () => {
    const repository = new LocalContentRepository();
    await repository.execute(createCommand());
    await repository.execute({
      type: 'ARCHIVE_EDITAL',
      operationId: 'op-archive',
      profileId,
      editalId: 'edital-1',
    });
    const second = await repository.execute({
      type: 'ARCHIVE_EDITAL',
      operationId: 'op-archive-again',
      profileId,
      editalId: 'edital-1',
    });
    expect(second).toMatchObject({ kind: 'LOCAL_COMMITTED' });
    const outbox = await getPendingOutbox(profileId);
    expect(outbox).toHaveLength(2);
    expect((second as { value: Edital }).value.localRevision).toBe(2);
  });
});
