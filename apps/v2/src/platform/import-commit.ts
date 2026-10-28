import type { CommitResult } from '../application/content-commands';
import type { Assunto, Aula } from '../domain/content';
import type { Edital, EditalDiscipline } from '../domain/edital';
import type { StudySubject } from '../domain/subject';
import { formatInitialOrder } from '../domain/content';
import { DOMAIN_SCHEMA_VERSION } from '../domain/versions';
import {
  qualifiedIdentity,
  targetSignatureOf,
  type ExistingContent,
} from '../application/import-service';
import type { ImportPreview, ImportReceipt } from '../application/import-types';
import {
  openV2Database,
  requestResult,
  STORES,
  toLocalPersistenceError,
  transactionDone,
} from './indexeddb';

export type ImportApproval = { confirmed: true; targetSignature: string };

type Fault = 'abort' | 'quota' | null;

export class ImportCommitter {
  private readonly fault: Fault;
  private readonly now: () => string;

  constructor(options: { fault?: Fault; now?: () => string } = {}) {
    this.fault = options.fault ?? null;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async apply(
    profileId: string,
    preview: ImportPreview,
    approval: ImportApproval,
  ): Promise<CommitResult<ImportReceipt>> {
    if (!approval || approval.confirmed !== true) {
      return { kind: 'INVALID', code: 'IMPORT_INVALID' };
    }
    if (approval.targetSignature !== preview.targetSignature) {
      return { kind: 'INVALID', code: 'IMPORT_STALE_PREVIEW' };
    }

    let database: IDBDatabase;
    try {
      database = await openV2Database(profileId);
    } catch (error) {
      return { kind: 'FAILED', reason: toLocalPersistenceError(error).kind };
    }

    const transaction = database.transaction(
      [
        STORES.subjects,
        STORES.editais,
        STORES.editalDisciplines,
        STORES.assuntos,
        STORES.aulas,
        STORES.lessonTopicLinks,
        STORES.operations,
        STORES.outbox,
        STORES.importReceipts,
      ],
      'readwrite',
    );

    try {
      const receiptStore = transaction.objectStore(STORES.importReceipts);
      const previous = (await requestResult(
        receiptStore.get([profileId, preview.importId]),
      )) as ImportReceipt | undefined;
      if (previous) {
        if (previous.fingerprint !== preview.fingerprint) {
          transaction.abort();
          return { kind: 'INVALID', code: 'IMPORT_INVALID' };
        }
        // Replay of the same trusted file is a no-op even though the target
        // signature moved because of the first import.
        await transactionDone(transaction);
        return { kind: 'LOCAL_COMMITTED', value: previous };
      }

      const readAll = async (storeName: string) =>
        requestResult(
          transaction.objectStore(storeName).index('by_profile').getAll(profileId),
        ) as Promise<Record<string, unknown>[]>;

      // Everything below runs inside one transaction: no external awaits.
      const [subjects, editais, links, assuntos, aulas] = await Promise.all([
        readAll(STORES.subjects),
        readAll(STORES.editais),
        readAll(STORES.editalDisciplines),
        readAll(STORES.assuntos),
        readAll(STORES.aulas),
      ]);
      const current: ExistingContent = {
        subjects: subjects as unknown as StudySubject[],
        editais: editais as unknown as Edital[],
        links: links as unknown as EditalDiscipline[],
        assuntos: assuntos as unknown as Assunto[],
        aulas: aulas as unknown as Aula[],
      };
      if (targetSignatureOf(current) !== preview.targetSignature) {
        transaction.abort();
        return { kind: 'INVALID', code: 'IMPORT_STALE_PREVIEW' };
      }

      const creates = preview.creates;
      const byId = new Map(creates.map((item) => [item.id, item]));
      // Existing ids are skipped, but their records still feed `scopeOf` so a
      // child never inherits the wrong scope from a skipped ancestor.
      const existingById = new Map<string, Record<string, unknown>>();
      for (const list of [
        current.subjects,
        current.editais,
        current.links,
        current.assuntos,
        current.aulas,
      ]) {
        for (const item of list as unknown as Record<string, unknown>[]) {
          existingById.set(String(item.id), item);
        }
      }

      const operations = transaction.objectStore(STORES.operations);
      const outbox = transaction.objectStore(STORES.outbox);
      const operationIds: string[] = [];
      const entityCounts: Record<string, number> = {};
      const orderCounters = new Map<string, number>();
      const written = new Map<string, Record<string, unknown>>();

      const nextOrder = (parentId: string): string => {
        const next = (orderCounters.get(parentId) ?? 0) + 1;
        orderCounters.set(parentId, next);
        return formatInitialOrder(next - 1);
      };

      const scopeOf = (parentId: string): string => {
        const parent = byId.get(parentId);
        if (!parent) return parentId;
        if (parent.entityType === 'edital-discipline') return parentId;
        const written = writtenOf(parentId);
        return (written as { editalDisciplineId?: string })?.editalDisciplineId ?? parentId;
      };
      const writtenOf = (id: string): Record<string, unknown> | undefined =>
        written.get(id);

      const emit = (
        entityType: string,
        entityId: string,
        entity: Record<string, unknown>,
      ): void => {
        const operationId = `${preview.importId}~${entityId}`;
        operations.put({
          operationId,
          profileId,
          entityType,
          entityId,
          command: { type: 'IMPORT_ENTITY', importId: preview.importId, fingerprint: preview.fingerprint },
          entity,
          committedAt: this.now(),
        });
        outbox.put({
          operationId,
          profileId,
          entityType,
          entityId,
          kind: 'upsert',
          baseRevision: null,
          payload: entity,
          schemaVersion: DOMAIN_SCHEMA_VERSION,
          status: 'PENDING',
        });
        operationIds.push(operationId);
        entityCounts[entityType] = (entityCounts[entityType] ?? 0) + 1;
      };

      const qualified = qualifiedIdentity(
        preview.sourceIdentity.namespace,
        preview.sourceIdentity.centralId,
        preview.sourceIdentity.sourceRef,
      );

      for (const item of creates) {
        const alreadyThere = existingById.get(item.id);
        if (alreadyThere) {
          written.set(item.id, alreadyThere);
          continue;
        }

        if (item.entityType === 'edital') {
          const edital: Edital = {
            id: item.id,
            profileId,
            title: item.name,
            status: 'ACTIVE',
            localRevision: 1,
            ...(qualified ? { sourceRef: qualified } : {}),
            sourceRevision: preview.sourceRevision,
            fingerprint: preview.fingerprint,
          };
          transaction.objectStore(STORES.editais).put(edital);
          written.set(item.id, edital as unknown as Record<string, unknown>);
          emit('edital', item.id, edital as unknown as Record<string, unknown>);
          continue;
        }

        if (item.entityType === 'subject') {
          const subject: StudySubject = {
            id: item.id,
            profileId,
            title: item.name,
            localRevision: 1,
          };
          transaction.objectStore(STORES.subjects).put(subject);
          written.set(item.id, subject as unknown as Record<string, unknown>);
          emit('subject', item.id, subject as unknown as Record<string, unknown>);
          continue;
        }

        if (item.entityType === 'edital-discipline') {
          const link: EditalDiscipline = {
            id: item.id,
            profileId,
            editalId: item.parentId ?? '',
            subjectId: item.subjectId ?? '',
            orderKey: nextOrder(item.parentId ?? 'edital'),
            localRevision: 1,
            status: 'ACTIVE',
          };
          transaction.objectStore(STORES.editalDisciplines).put(link);
          written.set(item.id, link as unknown as Record<string, unknown>);
          emit('edital-discipline', item.id, link as unknown as Record<string, unknown>);
          continue;
        }

        if (item.entityType === 'assunto') {
          const parent = item.parentId;
          const scope = parent ? scopeOf(parent) : item.id;
          const parentIsLink = parent ? byId.get(parent)?.entityType === 'edital-discipline' : false;
          const assunto: Assunto = {
            id: item.id,
            profileId,
            editalDisciplineId: scope,
            parentId: parent && !parentIsLink ? parent : null,
            parentKey: parent && !parentIsLink ? parent : '',
            title: item.name,
            orderKey: nextOrder(parent ?? 'root'),
            localRevision: 1,
            provenance: preview.fingerprint,
          };
          transaction.objectStore(STORES.assuntos).put(assunto);
          written.set(item.id, assunto as unknown as Record<string, unknown>);
          emit('assunto', item.id, assunto as unknown as Record<string, unknown>);
          continue;
        }

        const aula: Aula = {
          id: item.id,
          profileId,
          editalDisciplineId: item.parentId ?? '',
          title: item.name,
          orderKey: nextOrder(item.parentId ?? 'aulas'),
          localRevision: 1,
          provenance: preview.fingerprint,
        };
        transaction.objectStore(STORES.aulas).put(aula);
        written.set(item.id, aula as unknown as Record<string, unknown>);
        emit('aula', item.id, aula as unknown as Record<string, unknown>);
      }

      if (this.fault === 'abort') throw new DOMException('forced abort', 'AbortError');
      if (this.fault === 'quota') throw new DOMException('forced quota', 'QuotaExceededError');

      const receipt: ImportReceipt = {
        profileId,
        importId: preview.importId,
        fingerprint: preview.fingerprint,
        sourceRevision: preview.sourceRevision,
        entityCounts,
        operationIds,
      };
      receiptStore.put(receipt);

      await transactionDone(transaction);
      return { kind: 'LOCAL_COMMITTED', value: receipt };
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      return { kind: 'FAILED', reason: toLocalPersistenceError(error).kind };
    }
  }
}

export function applyEditalImport(
  profileId: string,
  preview: ImportPreview,
  approval: ImportApproval,
): Promise<CommitResult<ImportReceipt>> {
  return new ImportCommitter().apply(profileId, preview, approval);
}
