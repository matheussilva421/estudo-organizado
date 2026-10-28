import type { CommitResult, ContentCommand } from './content-commands';
import type { Assunto, Aula, LessonTopicLink } from '../domain/content';
import type { Edital, EditalDiscipline } from '../domain/edital';
import {
  annotateRemoteBaseRevision,
  getConflicts,
  openV2Database,
  requestResult,
  resolveConflictRecord,
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

    if (choice === 'KEEP_LOCAL') {
      const command = await this.toCommand(conflict, operationId);
      if (!command) return { kind: 'INVALID', code: 'INVALID_COMMAND' };
      const result = await this.content.execute(command);
      if (result.kind !== 'LOCAL_COMMITTED') return result;
      await annotateRemoteBaseRevision(profileId, operationId, conflict.remoteRevision);
      const resolved = await resolveConflictRecord(profileId, conflictId, {
        status: 'RESOLVED',
        resolution: 'LOCAL',
        resolvedByOperationId: operationId,
      });
      if (!resolved) return { kind: 'FAILED', reason: 'CONFLICT_NOT_FOUND' };
      return {
        kind: 'LOCAL_COMMITTED',
        value: {
          conflictId,
          choice,
          operationId,
          entityType: conflict.entityType,
          entityId: conflict.entityId,
        },
      };
    }

    const adopted = await this.adoptRemote(profileId, conflict, operationId);
    if (adopted.kind !== 'LOCAL_COMMITTED') return adopted;
    const resolved = await resolveConflictRecord(profileId, conflictId, {
      status: 'RESOLVED',
      resolution: 'REMOTE',
      resolvedByOperationId: operationId,
    });
    if (!resolved) return { kind: 'FAILED', reason: 'CONFLICT_NOT_FOUND' };
    return {
      kind: 'LOCAL_COMMITTED',
      value: {
        conflictId,
        choice,
        operationId,
        entityType: conflict.entityType,
        entityId: conflict.entityId,
      },
    };
  }

  private async toCommand(
    conflict: PersistedConflict,
    operationId: string,
  ): Promise<ContentCommand | null> {
    const base = { operationId, profileId: conflict.profileId };
    switch (conflict.entityType) {
      case 'assunto':
        return {
          ...base,
          type: 'UPSERT_ASSUNTO',
          value: conflict.localPayload as Assunto,
        };
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

  /**
   * Adopting the remote side writes only the local entity and the idempotency
   * record: nothing is pushed back to the remote.
   */
  private async adoptRemote(
    profileId: string,
    conflict: PersistedConflict,
    operationId: string,
  ): Promise<CommitResult<unknown>> {
    const storeName = storeForEntityType(conflict.entityType);
    if (!storeName) return { kind: 'INVALID', code: 'INVALID_COMMAND' };

    // A remote tombstone must go through the causal delete path: it validates
    // dependencies, writes the tombstone/epoch and refuses orphaned children.
    if (conflict.deleted) {
      const current = await this.currentEntity(profileId, conflict);
      if (!current) {
        return {
          kind: 'INVALID',
          code: 'ENTITY_NOT_FOUND',
        };
      }
      return this.content.execute({
        type: 'SOFT_DELETE',
        operationId,
        profileId,
        entityType: conflict.entityType as never,
        entityId: conflict.entityId,
        baseRevision: (current as { localRevision?: number }).localRevision ?? null,
      });
    }

    const database = await openV2Database(profileId);
    const transaction = database.transaction([storeName, STORES.operations], 'readwrite');
    try {
      const operations = transaction.objectStore(STORES.operations);
      const persisted = await requestResult(operations.get(operationId));
      if (persisted) {
        await transactionDone(transaction);
        return { kind: 'LOCAL_COMMITTED', value: persisted };
      }

      const store = transaction.objectStore(storeName);
      const current = (await requestResult(
        store.get([profileId, conflict.entityId]),
      )) as { localRevision?: number } | undefined;

      if (!conflict.remotePayload) {
        transaction.abort();
        return { kind: 'INVALID', code: 'ENTITY_NOT_FOUND' };
      }
      const adopted = {
        ...(conflict.remotePayload as Record<string, unknown>),
        profileId,
        id: conflict.entityId,
        localRevision: (current?.localRevision ?? 0) + 1,
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

      await transactionDone(transaction);
      return { kind: 'LOCAL_COMMITTED', value: { adopted: true } };
    } catch {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      return { kind: 'FAILED', reason: 'UNAVAILABLE' };
    }
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
