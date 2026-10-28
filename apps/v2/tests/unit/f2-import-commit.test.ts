import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ImportPreview } from '../../src/application/import-types';
import {
  parseEditalImport,
  previewEditalImport,
  type ExistingContent,
} from '../../src/application/import-service';
import { ImportCommitter } from '../../src/platform/import-commit';
import {
  deleteV2DatabaseForTests,
  getPendingOutbox,
  openV2Database,
  requestResult,
  STORES,
} from '../../src/platform/indexeddb';
import { LocalContentRepository } from '../../src/platform/local-content-repository';
import { transactionDone } from '../../src/platform/indexeddb';

const profileId = 'profile-local';
const fixtures = join(process.cwd(), 'tests', 'fixtures');

async function currentContent(): Promise<ExistingContent> {
  return new LocalContentRepository().loadContent(profileId);
}

async function buildPreview(namespace = 'tjpb'): Promise<ImportPreview> {
  const parsed = parseEditalImport(
    new Uint8Array(readFileSync(join(fixtures, 'f2-edital-v1.json'))),
    { namespace },
  );
  if (!parsed.ok) throw new Error(`parse failed: ${parsed.reason}`);
  return previewEditalImport(parsed.parsed, await currentContent());
}

async function counts() {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(
    [
      STORES.subjects,
      STORES.editais,
      STORES.editalDisciplines,
      STORES.assuntos,
      STORES.aulas,
      STORES.importReceipts,
    ],
    'readonly',
  );
  return {
    subjects: await requestResult(transaction.objectStore(STORES.subjects).count()),
    editais: await requestResult(transaction.objectStore(STORES.editais).count()),
    links: await requestResult(transaction.objectStore(STORES.editalDisciplines).count()),
    assuntos: await requestResult(transaction.objectStore(STORES.assuntos).count()),
    aulas: await requestResult(transaction.objectStore(STORES.aulas).count()),
    receipts: await requestResult(transaction.objectStore(STORES.importReceipts).count()),
  };
}

async function quarantineCount(): Promise<number> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.quarantine, 'readonly');
  return requestResult(transaction.objectStore(STORES.quarantine).count());
}

async function dropReceipt(importId: string): Promise<void> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.importReceipts, 'readwrite');
  transaction.objectStore(STORES.importReceipts).delete([profileId, importId]);
  await transactionDone(transaction);
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F2 import commit', () => {
  it('same_trusted_file_twice_has_one_logical_import', async () => {
    const preview = await buildPreview();
    const committer = new ImportCommitter();
    const approval = { confirmed: true as const, targetSignature: preview.targetSignature };

    const first = await committer.apply(profileId, preview, approval);
    expect(first.kind).toBe('LOCAL_COMMITTED');
    const afterFirst = await counts();
    expect(afterFirst).toMatchObject({
      subjects: 2,
      editais: 1,
      links: 2,
      assuntos: 2,
      aulas: 1,
      receipts: 1,
    });

    const second = await committer.apply(profileId, preview, approval);
    expect(second).toEqual(first);
    expect(await counts()).toEqual(afterFirst);

    const outboxAfter = await getPendingOutbox(profileId);
    expect(outboxAfter.length).toBe(
      (second as { value: { operationIds: string[] } }).value.operationIds.length,
    );

    const content = await currentContent();
    expect(content.editais[0]).toMatchObject({
      title: 'TJPB 2026',
      sourceRevision: 'r1',
    });
    expect(content.editais[0]?.sourceRef).toBe('tjpb:tjpb-2026');
    expect(content.assuntos.find((item) => item.title === 'ADPF')?.parentId).toBe(
      content.assuntos.find((item) => item.title === 'Controle de constitucionalidade')?.id,
    );
  });

  it('import_abort_has_no_partial_visibility', async () => {
    const preview = await buildPreview();
    const result = await new ImportCommitter({ fault: 'abort' }).apply(profileId, preview, {
      confirmed: true,
      targetSignature: preview.targetSignature,
    });
    expect(result).toEqual({ kind: 'FAILED', reason: 'ABORT' });
    expect(await counts()).toEqual({
      subjects: 0,
      editais: 0,
      links: 0,
      assuntos: 0,
      aulas: 0,
      receipts: 0,
    });
    expect(await getPendingOutbox(profileId)).toEqual([]);
  });

  it('max_accepted_import_quota_abort_rolls_back_every_store', async () => {
    const disciplines = Array.from({ length: 120 }, (_, index) => ({
      nome: `Disciplina ${index}`,
      topicos: [{ nome: `Topico ${index}` }],
    }));
    const parsed = parseEditalImport(
      { versao: 1, tipo: 'edital', nome: 'Carga grande', centralId: 'grande', disciplinas: disciplines },
      { namespace: 'tjpb' },
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const preview = previewEditalImport(parsed.parsed, await currentContent());
    expect(preview.creates.length).toBeGreaterThan(300);

    const result = await new ImportCommitter({ fault: 'quota' }).apply(profileId, preview, {
      confirmed: true,
      targetSignature: preview.targetSignature,
    });
    expect(result).toEqual({ kind: 'FAILED', reason: 'QUOTA' });
    expect(await counts()).toEqual({
      subjects: 0,
      editais: 0,
      links: 0,
      assuntos: 0,
      aulas: 0,
      receipts: 0,
    });

    // The same batch still commits once the fault is gone.
    const committed = await new ImportCommitter().apply(profileId, preview, {
      confirmed: true,
      targetSignature: preview.targetSignature,
    });
    expect(committed.kind).toBe('LOCAL_COMMITTED');
    expect((await counts()).receipts).toBe(1);
  });

  it('stale_preview_after_tab_edit_is_rejected', async () => {
    const preview = await buildPreview();
    await new LocalContentRepository().execute({
      type: 'CREATE_EDITAL',
      operationId: 'op-outra-aba',
      profileId,
      editalId: 'edital-outra-aba',
      title: 'Editado em outra aba',
    });

    const result = await new ImportCommitter().apply(profileId, preview, {
      confirmed: true,
      targetSignature: preview.targetSignature,
    });
    expect(result).toEqual({ kind: 'INVALID', code: 'IMPORT_STALE_PREVIEW' });
    expect((await counts()).receipts).toBe(0);
    expect((await counts()).subjects).toBe(0);
  });

  it('rejects_unconfirmed_approval_and_forged_signature', async () => {
    const preview = await buildPreview();
    const committer = new ImportCommitter();
    expect(
      await committer.apply(profileId, preview, { confirmed: false as never, targetSignature: 'x' }),
    ).toEqual({ kind: 'INVALID', code: 'IMPORT_INVALID' });
    expect(
      await committer.apply(profileId, preview, { confirmed: true, targetSignature: 'forjado' }),
    ).toEqual({ kind: 'INVALID', code: 'IMPORT_STALE_PREVIEW' });
    expect((await counts()).receipts).toBe(0);
  });

  it('second_import_in_a_populated_profile_is_not_stale', async () => {
    const first = await buildPreview();
    const committer = new ImportCommitter();
    expect(
      await committer.apply(profileId, first, {
        confirmed: true,
        targetSignature: first.targetSignature,
      }),
    ).toMatchObject({ kind: 'LOCAL_COMMITTED' });

    const secondParsed = parseEditalImport(
      {
        versao: 1,
        tipo: 'edital',
        nome: 'TJRO 2026',
        centralId: 'tjro-2026',
        disciplinas: [{ nome: 'Direito Penal', topicos: [{ nome: 'Parte geral' }] }],
      },
      { namespace: 'tjpb' },
    );
    expect(secondParsed.ok).toBe(true);
    if (!secondParsed.ok) return;
    const second = previewEditalImport(secondParsed.parsed, await currentContent());

    const result = await committer.apply(profileId, second, {
      confirmed: true,
      targetSignature: second.targetSignature,
    });
    expect(result).toMatchObject({ kind: 'LOCAL_COMMITTED' });
    expect((await counts()).editais).toBe(2);
    expect((await counts()).receipts).toBe(2);
  });

  it('replay_after_a_deletion_reports_divergence_instead_of_success', async () => {
    const preview = await buildPreview();
    const committer = new ImportCommitter();
    const approval = { confirmed: true as const, targetSignature: preview.targetSignature };
    expect(await committer.apply(profileId, preview, approval)).toMatchObject({
      kind: 'LOCAL_COMMITTED',
    });

    const content = new LocalContentRepository();
    // The leaf has no dependents, so the delete is accepted.
    const assunto = (await content.loadContent(profileId)).assuntos.find(
      (item) => item.parentId !== null,
    );
    expect(assunto).toBeDefined();
    const deleted = await content.execute({
      type: 'SOFT_DELETE',
      operationId: 'op-delete-imported',
      profileId,
      entityType: 'assunto',
      entityId: assunto!.id,
      baseRevision: assunto!.localRevision,
    });
    expect(deleted).toMatchObject({ kind: 'LOCAL_COMMITTED' });

    const replay = await committer.apply(profileId, preview, approval);
    expect(replay).toMatchObject({ kind: 'CONFLICT' });
    expect((replay as { current: { code: string } }).current.code).toBe(
      'IMPORT_ALREADY_APPLIED_BUT_DIVERGED',
    );
  });

  it('import_never_resurrects_a_tombstoned_id', async () => {
    const preview = await buildPreview();
    const committer = new ImportCommitter();
    expect(
      await committer.apply(profileId, preview, {
        confirmed: true,
        targetSignature: preview.targetSignature,
      }),
    ).toMatchObject({ kind: 'LOCAL_COMMITTED' });

    const content = new LocalContentRepository();
    const assunto = (await content.loadContent(profileId)).assuntos.find(
      (item) => item.parentId !== null,
    );
    await content.execute({
      type: 'SOFT_DELETE',
      operationId: 'op-delete-imported',
      profileId,
      entityType: 'assunto',
      entityId: assunto!.id,
      baseRevision: assunto!.localRevision,
    });

    // Simulates a restore without receipts: the receipt can no longer protect us.
    await dropReceipt(preview.importId);
    const detached = previewEditalImport(
      (
        parseEditalImport(
          new Uint8Array(readFileSync(join(fixtures, 'f2-edital-v1.json'))),
          { namespace: 'tjpb' },
        ) as { ok: true; parsed: Parameters<typeof previewEditalImport>[0] }
      ).parsed,
      await currentContent(),
    );

    const blocked = await committer.apply(profileId, detached, {
      confirmed: true,
      targetSignature: detached.targetSignature,
    });
    expect(blocked).toMatchObject({ kind: 'CONFLICT' });
    expect((blocked as { current: { code: string } }).current.code).toBe('DELETED_ENTITY');
    expect((await content.loadContent(profileId)).assuntos.map((item) => item.id)).not.toContain(
      assunto!.id,
    );
  });

  it('quarantined_entries_are_persisted_with_the_import', async () => {
    const parsed = parseEditalImport(
      {
        versao: 1,
        tipo: 'edital',
        nome: 'Com quarentena',
        centralId: 'quarentena-1',
        disciplinas: [
          { nome: 'Portugues', topicos: [{ semNome: true }, { nome: 'Crase' }], aulas: [] },
        ],
      },
      { namespace: 'tjpb' },
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const preview = previewEditalImport(parsed.parsed, await currentContent());
    expect(preview.quarantined).toHaveLength(1);

    expect(
      await new ImportCommitter().apply(profileId, preview, {
        confirmed: true,
        targetSignature: preview.targetSignature,
      }),
    ).toMatchObject({ kind: 'LOCAL_COMMITTED' });
    expect(await quarantineCount()).toBe(1);
  });
});
