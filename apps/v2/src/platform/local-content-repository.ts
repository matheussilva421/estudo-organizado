import type {
  CommitResult,
  ContentCommand,
  ContentEntity,
  ContentEntityType,
} from '../application/content-commands';
import type { ContentRepository, ContentSnapshot } from '../application/content-service';
import {
  applyEditalCommand,
  compareByOrderKey,
  ContentValidationError,
  type Edital,
  type EditalDiscipline,
} from '../domain/edital';
import { normalizeSubjectTitle, type StudySubject } from '../domain/subject';
import { DOMAIN_SCHEMA_VERSION } from '../domain/versions';
import {
  openV2Database,
  requestResult,
  STORES,
  toLocalPersistenceError,
  transactionDone,
} from './indexeddb';

type Fault = 'abort' | 'quota' | null;

export type ContentRepositoryOptions = {
  fault?: Fault;
  now?: () => string;
};

type OperationRecord = {
  operationId: string;
  profileId: string;
  entityType: ContentEntityType;
  entityId: string;
  command: unknown;
  entity: ContentEntity;
  committedAt: string;
};

function entityTypeOf(command: ContentCommand): ContentEntityType {
  switch (command.type) {
    case 'CREATE_EDITAL':
    case 'RENAME_EDITAL':
    case 'ARCHIVE_EDITAL':
      return 'edital';
    default:
      throw new ContentValidationError('INVALID_COMMAND', 'command has no entity type');
  }
}

function entityIdOf(command: ContentCommand): string {
  switch (command.type) {
    case 'CREATE_EDITAL':
    case 'RENAME_EDITAL':
    case 'ARCHIVE_EDITAL':
      return command.editalId;
    default:
      throw new ContentValidationError('INVALID_COMMAND', 'command has no entity id');
  }
}

function storeFor(entityType: ContentEntityType): string {
  switch (entityType) {
    case 'edital':
      return STORES.editais;
    case 'edital-discipline':
      return STORES.editalDisciplines;
    case 'subject':
      return STORES.subjects;
    default:
      throw new ContentValidationError('INVALID_COMMAND', 'command has no store');
  }
}

function safeTitle(title: string | undefined): string {
  try {
    return normalizeSubjectTitle(typeof title === 'string' ? title : '');
  } catch {
    return '';
  }
}

/**
 * Immutable, normalized identity of a command. Two commands compare equal only
 * when they would produce the same effect, so an `operationId` can never carry
 * two different payloads.
 */
function normalizeCommand(command: ContentCommand): Record<string, unknown> {
  switch (command.type) {
    case 'CREATE_EDITAL':
      return {
        type: command.type,
        operationId: command.operationId,
        profileId: command.profileId,
        editalId: command.editalId,
        title: safeTitle(command.title),
        sourceRef: command.sourceRef?.trim() || null,
        baseRevision: command.baseRevision ?? null,
      };
    case 'RENAME_EDITAL':
      return {
        type: command.type,
        operationId: command.operationId,
        profileId: command.profileId,
        editalId: command.editalId,
        title: safeTitle(command.title),
        baseRevision: command.baseRevision ?? null,
      };
    case 'ARCHIVE_EDITAL':
      return {
        type: command.type,
        operationId: command.operationId,
        profileId: command.profileId,
        editalId: command.editalId,
        baseRevision: command.baseRevision ?? null,
      };
    default:
      return { type: (command as { type?: string }).type ?? 'UNKNOWN' };
  }
}

function sameCommand(persisted: unknown, command: ContentCommand): boolean {
  try {
    return (
      JSON.stringify(normalizeCommand(persisted as ContentCommand)) ===
      JSON.stringify(normalizeCommand(command))
    );
  } catch {
    return false;
  }
}

function applyCommand(current: ContentEntity | null, command: ContentCommand): ContentEntity {
  switch (command.type) {
    case 'CREATE_EDITAL':
    case 'RENAME_EDITAL':
    case 'ARCHIVE_EDITAL':
      return applyEditalCommand(current as Edital | null, command);
    default:
      throw new ContentValidationError('INVALID_COMMAND', 'unsupported content command');
  }
}

export class LocalContentRepository implements ContentRepository {
  private readonly fault: Fault;
  private readonly now: () => string;

  constructor(options: ContentRepositoryOptions = {}) {
    this.fault = options.fault ?? null;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async execute(command: ContentCommand): Promise<CommitResult<unknown>> {
    let entityType: ContentEntityType;
    let entityId: string;
    let storeName: string;
    try {
      entityType = entityTypeOf(command);
      entityId = entityIdOf(command);
      storeName = storeFor(entityType);
    } catch (error) {
      if (error instanceof ContentValidationError) return { kind: 'INVALID', code: error.code };
      return { kind: 'FAILED', reason: 'UNKNOWN' };
    }

    const database = await openV2Database(command.profileId);
    const transaction = database.transaction(
      [storeName, STORES.operations, STORES.outbox],
      'readwrite',
    );

    try {
      const operations = transaction.objectStore(STORES.operations);
      const existing = (await requestResult(operations.get(command.operationId))) as
        | OperationRecord
        | undefined;

      if (existing) {
        if (
          existing.profileId !== command.profileId ||
          existing.entityType !== entityType ||
          existing.entityId !== entityId ||
          !sameCommand(existing.command, command)
        ) {
          transaction.abort();
          return { kind: 'INVALID', code: 'OPERATION_ID_REUSED' };
        }
        await transactionDone(transaction);
        return { kind: 'LOCAL_COMMITTED', value: existing.entity };
      }

      const store = transaction.objectStore(storeName);
      const current = (await requestResult(
        store.get([command.profileId, entityId]),
      )) as ContentEntity | undefined;

      let next: ContentEntity;
      try {
        next = applyCommand(current ?? null, command);
      } catch (error) {
        transaction.abort();
        if (error instanceof ContentValidationError) return { kind: 'INVALID', code: error.code };
        return { kind: 'FAILED', reason: 'UNKNOWN' };
      }

      const expectedBase = command.baseRevision ?? null;
      if (expectedBase !== null && expectedBase !== (current?.localRevision ?? 0)) {
        transaction.abort();
        return { kind: 'CONFLICT', current: current ?? undefined };
      }

      const changed = JSON.stringify(current ?? null) !== JSON.stringify(next);
      store.put(next);

      if (this.fault === 'abort') throw new DOMException('forced abort', 'AbortError');
      if (this.fault === 'quota') throw new DOMException('forced quota', 'QuotaExceededError');

      operations.put({
        operationId: command.operationId,
        profileId: command.profileId,
        entityType,
        entityId,
        command: normalizeCommand(command),
        entity: next,
        committedAt: this.now(),
      } satisfies OperationRecord);

      if (changed) {
        transaction.objectStore(STORES.outbox).put({
          operationId: command.operationId,
          profileId: command.profileId,
          entityType,
          entityId,
          kind: 'upsert',
          baseRevision: current?.localRevision ?? null,
          payload: next,
          schemaVersion: DOMAIN_SCHEMA_VERSION,
          status: 'PENDING',
        });
      }

      await transactionDone(transaction);
      return { kind: 'LOCAL_COMMITTED', value: next };
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      return { kind: 'FAILED', reason: toLocalPersistenceError(error).kind };
    }
  }

  async loadContent(profileId: string): Promise<ContentSnapshot> {
    const database = await openV2Database(profileId);
    const transaction = database.transaction(
      [STORES.subjects, STORES.editais, STORES.editalDisciplines],
      'readonly',
    );
    const [subjects, editais, links] = await Promise.all([
      requestResult(transaction.objectStore(STORES.subjects).index('by_profile').getAll(profileId)),
      requestResult(transaction.objectStore(STORES.editais).index('by_profile').getAll(profileId)),
      requestResult(
        transaction.objectStore(STORES.editalDisciplines).index('by_profile').getAll(profileId),
      ),
    ]);

    return {
      subjects: (subjects as StudySubject[]).sort((left, right) =>
        left.title.localeCompare(right.title, 'pt-BR'),
      ),
      editais: (editais as Edital[]).sort((left, right) =>
        left.title.localeCompare(right.title, 'pt-BR'),
      ),
      links: (links as EditalDiscipline[]).sort(compareByOrderKey),
    };
  }
}
