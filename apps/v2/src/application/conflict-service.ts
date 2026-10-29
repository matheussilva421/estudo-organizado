import type { CommitResult, ContentCommand } from './content-commands';
import type { Assunto, Aula, LessonTopicLink } from '../domain/content';
import type { Edital, EditalDiscipline } from '../domain/edital';
import {
  annotateRemoteBaseRevision,
  getConflicts,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
  type PersistedConflict,
} from '../platform/indexeddb';
import { LocalContentRepository } from '../platform/local-content-repository';

export type { PersistedConflict } from '../platform/indexeddb';

export type ConflictChoice = 'KEEP_LOCAL' | 'ACCEPT_REMOTE';

export type ConflictResolution = {
  conflictId: string;
  choice: ConflictChoice;
  operationId: string;
  entityType: string;
  entityId: string;
};

export interface ConflictService {
  listConflicts(profileId: string): Promise<PersistedConflict[]>;
  getConflict(profileId: string, conflictId: string): Promise<PersistedConflict | null>;
  resolveConflict(
    profileId: string,
    conflictId: string,
    choice: ConflictChoice,
    operationId: string,
  ): Promise<CommitResult<ConflictResolution>>;
}

function storeForEntityType(entityType: string): string | null {
  switch (entityType) {
    case 'edital':
      return STORES.editais;
    case 'edital-discipline':
      return STORES.editalDisciplines;
    case 'assunto':
      return STORES.assuntos;
    case 'aula':
      return STORES.aulas;
    case 'lesson-topic-link':
      return STORES.lessonTopicLinks;
    default:
      return null;
  }
}

function revisionOf(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as { localRevision?: unknown }).localRevision;
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

/**
 * Conflict resolution is conservative: a stale decision is refused instead of
 * being applied over a newer local edit, and the content write plus the
 * conflict marking share one IndexedDB transaction.
 */
export class LocalConflictService implements ConflictService {
  private readonly content: LocalContentRepository;

  constructor(options: { content?: LocalContentRepository } = {}) {
    this.content = options.content ?? new LocalContentRepository();
  }

  async listConflicts(profileId: string): Promise<PersistedConflict[]> {
    const conflicts = await getConflicts(profileId);
    return conflicts.sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
  }

  async getConflict(profileId: string, conflictId: string): Promise<PersistedConflict | null> {
    const conflicts = await this.listConflicts(profileId);
    return conflicts.find((item) => item.conflictId === conflictId) ?? null;
  }

  async resolveConflict(
    profileId: string,
    conflictId: string,
    choice: ConflictChoice,
    operationId: string,
  ): Promise<CommitResult<ConflictResolution>> {
    if (!operationId.trim()) return { kind: 'INVALID', code: 'IDENTIFIER_REQUIRED' };
    const conflict = await this.getConflict(profileId, conflictId);
    if (!conflict) return { kind: 'INVALID', code: 'ENTITY_NOT_FOUND' };
    if (conflict.status !== 'OPEN') return { kind: 'INVALID', code: 'ENTITY_EXISTS' };

    const resolution: ConflictResolution = {
      conflictId,
      choice,
      operationId,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
    };

    // A decision made against an older local revision must not overwrite a
    // newer edit; both payloads stay intact in the conflict record.
    const expected = revisionOf(conflict.localPayload);
    const current = await this.currentEntity(profileId, conflict);
    if (expected !== null) {
      const currentRevision = revisionOf(current);
      if (currentRevision !== expected) {
        return {
          kind: 'CONFLICT',
          current: { code: 'RESOLUTION_STALE', expected, currentRevision },
        };
      }
    }

    if (choice === 'KEEP_LOCAL') {
      const command = await this.toCommand(conflict, operationId);
      if (!command) return { kind: 'INVALID', code: 'INVALID_COMMAND' };
      const result = await this.content.execute(command, {
        markConflict: { conflictId, resolution: 'LOCAL' },
      });
      if (result.kind !== 'LOCAL_COMMITTED') return result;
      await annotateRemoteBaseRevision(profileId, operationId, conflict.remoteRevision);
      return { kind: 'LOCAL_COMMITTED', value: resolution };
    }

    const adopted = await this.adoptRemote(profileId, conflict, operationId, resolution);
    return adopted;
  }

  private async toCommand(
    conflict: PersistedConflict,
    operationId: string,
  ): Promise<ContentCommand | null> {
    const base = { operationId, profileId: conflict.profileId };
    switch (conflict.entityType) {
      case 'assunto':
        return { ...base, type: 'UPSERT_ASSUNTO', value: conflict.localPayload as Assunto };
      case 'aula':
        return { ...base, type: 'UPSERT_AULA', value: conflict.localPayload as Aula };
      case 'lesson-topic-link':
        return {
          ...base,
          type: 'LINK_LESSON_TOPIC',
          link: conflict.localPayload as LessonTopicLink,
        };
      case 'edital-discipline': {
        const link = conflict.localPayload as EditalDiscipline;
        return {
          ...base,
          type: 'LINK_SUBJECT',
          editalId: link.editalId,
          subjectId: link.subjectId,
          linkId: link.id,
          displayAlias: link.displayAlias,
          orderKey: link.orderKey,
        };
      }
      case 'edital': {
        const edital = conflict.localPayload as Edital;
        const snapshot = await this.content.loadContent(conflict.profileId);
        const exists = snapshot.editais.some((item) => item.id === edital.id);
        return exists
          ? { ...base, type: 'RENAME_EDITAL', editalId: edital.id, title: edital.title }
          : {
              ...base,
              type: 'CREATE_EDITAL',
              editalId: edital.id,
              title: edital.title,
              ...(edital.sourceRef ? { sourceRef: edital.sourceRef } : {}),
            };
      }
      default:
        return null;
    }
  }

  /** Remote deletion goes through the causal delete path and never enqueues an upsert. */
  private async adoptRemote(
    profileId: string,
    conflict: PersistedConflict,
    operationId: string,
    resolution: ConflictResolution,
  ): Promise<CommitResult<ConflictResolution>> {
    if (conflict.deleted) {
      const result = await this.content.execute(
        {
          type: 'SOFT_DELETE',
          operationId,
          profileId,
          entityType: conflict.entityType as never,
          entityId: conflict.entityId,
          baseRevision: revisionOf(conflict.localPayload) ?? 0,
        },
        { markConflict: { conflictId: conflict.conflictId, resolution: 'REMOTE' } },
      );
      if (result.kind !== 'LOCAL_COMMITTED') return result;
      return { kind: 'LOCAL_COMMITTED', value: resolution };
    }

    const storeName = storeForEntityType(conflict.entityType);
    if (!storeName) return { kind: 'INVALID', code: 'INVALID_COMMAND' };
    if (!conflict.remotePayload) return { kind: 'INVALID', code: 'ENTITY_NOT_FOUND' };

    const database = await openV2Database(profileId);
    const transaction = database.transaction(
      [
        storeName,
        STORES.operations,
        STORES.conflicts,
        STORES.tombstones,
        // Reference stores are read to validate parents/links before writing.
        STORES.editais,
        STORES.subjects,
        STORES.editalDisciplines,
        STORES.assuntos,
        STORES.aulas,
        STORES.lessonTopicLinks,
      ],
      'readwrite',
    );

    try {
      const operations = transaction.objectStore(STORES.operations);
      const previous = (await requestResult(operations.get(operationId))) as
        | { profileId?: string; command?: unknown }
        | undefined;
      if (previous) {
        const expectedCommand = JSON.stringify({
          type: 'ACCEPT_REMOTE',
          conflictId: conflict.conflictId,
        });
        if (
          previous.profileId !== profileId ||
          JSON.stringify(previous.command) !== expectedCommand
        ) {
          transaction.abort();
          return { kind: 'INVALID', code: 'OPERATION_ID_REUSED' };
        }
        await transactionDone(transaction);
        return { kind: 'LOCAL_COMMITTED', value: resolution };
      }

      const tombstone = await requestResult(
        transaction.objectStore(STORES.tombstones).get([
          profileId,
          conflict.entityType,
          conflict.entityId,
        ]),
      );
      if (tombstone) {
        transaction.abort();
        return { kind: 'CONFLICT', current: { code: 'DELETED_ENTITY' } };
      }

      const referenceError = await this.adoptionReferenceError(profileId, conflict, transaction);
      if (referenceError) {
        transaction.abort();
        return { kind: 'CONFLICT', current: { code: referenceError } };
      }

      const store = transaction.objectStore(storeName);
      const current = (await requestResult(
        store.get([profileId, conflict.entityId]),
      )) as Record<string, unknown> | undefined;
      const adopted = {
        ...(conflict.remotePayload as Record<string, unknown>),
        profileId,
        id: conflict.entityId,
        localRevision: ((current?.localRevision as number) ?? 0) + 1,
      };
      store.put(adopted);
      operations.put({
        operationId,
        profileId,
        entityType: conflict.entityType,
        entityId: conflict.entityId,
        command: { type: 'ACCEPT_REMOTE', conflictId: conflict.conflictId },
        entity: adopted,
        committedAt: new Date().toISOString(),
      });

      const conflictStore = transaction.objectStore(STORES.conflicts);
      const record = (await requestResult(conflictStore.get(conflict.conflictId))) as
        | { profileId?: string; status?: string }
        | undefined;
      if (!record || record.profileId !== profileId || record.status !== 'OPEN') {
        transaction.abort();
        return { kind: 'INVALID', code: 'ENTITY_EXISTS' };
      }
      conflictStore.put({
        ...record,
        status: 'RESOLVED',
        resolution: 'REMOTE',
        resolvedByOperationId: operationId,
      });

      await transactionDone(transaction);
      return { kind: 'LOCAL_COMMITTED', value: resolution };
    } catch {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      return { kind: 'FAILED', reason: 'UNAVAILABLE' };
    }
  }

  /** Scope/parents/dependents are validated before adopting remote content. */
  private async adoptionReferenceError(
    profileId: string,
    conflict: PersistedConflict,
    transaction: IDBTransaction,
  ): Promise<string | null> {
    const get = async (store: string, key: IDBValidKey) =>
      (await requestResult(transaction.objectStore(store).get(key))) as
        | Record<string, unknown>
        | undefined;
    const payload = conflict.remotePayload as Record<string, unknown> | null;
    if (!payload) return 'ENTITY_NOT_FOUND';

    if (conflict.entityType === 'edital-discipline') {
      const edital = await get(STORES.editais, [profileId, String(payload.editalId)]);
      if (!edital) return 'ENTITY_NOT_FOUND';
      if (edital.status !== 'ACTIVE') return 'EDITAL_ARCHIVED';
      if (!(await get(STORES.subjects, [profileId, String(payload.subjectId)]))) {
        return 'ENTITY_NOT_FOUND';
      }
    }

    if (conflict.entityType === 'assunto') {
      const link = await get(STORES.editalDisciplines, [
        profileId,
        String(payload.editalDisciplineId),
      ]);
      if (!link) return 'ENTITY_NOT_FOUND';
      if (link.status !== 'ACTIVE') return 'EDITAL_ARCHIVED';
      if (payload.parentId) {
        const parent = await get(STORES.assuntos, [profileId, String(payload.parentId)]);
        if (!parent) return 'INVALID_PARENT';
        if (parent.editalDisciplineId !== payload.editalDisciplineId) return 'INVALID_PARENT';
      }
    }

    if (conflict.entityType === 'aula') {
      const link = await get(STORES.editalDisciplines, [
        profileId,
        String(payload.editalDisciplineId),
      ]);
      if (!link) return 'ENTITY_NOT_FOUND';
      if (link.status !== 'ACTIVE') return 'EDITAL_ARCHIVED';
    }

    if (conflict.entityType === 'lesson-topic-link') {
      const aula = await get(STORES.aulas, [profileId, String(payload.aulaId)]);
      const assunto = await get(STORES.assuntos, [profileId, String(payload.assuntoId)]);
      if (!aula || !assunto) return 'ENTITY_NOT_FOUND';
      if (aula.editalDisciplineId !== assunto.editalDisciplineId) return 'CROSS_SCOPE_LINK';
    }

    return null;
  }

  private async currentEntity(
    profileId: string,
    conflict: PersistedConflict,
  ): Promise<Record<string, unknown> | null> {
    const storeName = storeForEntityType(conflict.entityType);
    if (!storeName) return null;
    const database = await openV2Database(profileId);
    const transaction = database.transaction(storeName, 'readonly');
    const record = await requestResult(
      transaction.objectStore(storeName).get([profileId, conflict.entityId]),
    );
    return (record as Record<string, unknown> | undefined) ?? null;
  }
}
