import type {
  CommitResult,
  ContentCommand,
  ContentEntity,
  ContentEntityType,
} from '../application/content-commands';
import type {
  ContentRepository,
  ContentSnapshot,
  ReorderSiblingInput,
} from '../application/content-service';
import {
  applyEditalCommand,
  ContentValidationError,
  nextOrderKey,
  normalizeDisplayAlias,
  type Edital,
  type EditalDiscipline,
} from '../domain/edital';
import {
  assertAssuntoParent,
  nextSiblingOrderKey,
  normalizeContentTitle,
  normalizeOrderKey,
  normalizeProvenance,
  parentKeyOf,
  sortAssuntos,
  sortByOrder,
  validateLessonTopicLink,
  type Assunto,
  type Aula,
  type LessonTopicLink,
} from '../domain/content';
import { normalizeSubjectTitle, type StudySubject } from '../domain/subject';
import {
  assertTombstoneScope,
  epochKey,
  isDeletableEntityType,
  nextEpoch,
  type DependencyEntry,
  type DependencyReport,
  type LogicalTombstone,
} from '../domain/delete';
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

type Plan = {
  entityType: ContentEntityType;
  entityId: string;
  stores: string[];
};

type ApplyResult =
  | {
      status: 'OK';
      entity: ContentEntity;
      changed: boolean;
      baseRevision: number | null;
      kind: 'upsert' | 'delete';
    }
  | { status: 'INVALID'; code: string }
  | { status: 'CONFLICT'; current?: unknown };

function planOf(command: ContentCommand): Plan {
  switch (command.type) {
    case 'CREATE_EDITAL':
    case 'RENAME_EDITAL':
    case 'ARCHIVE_EDITAL':
      return {
        entityType: 'edital',
        entityId: command.editalId,
        stores: [STORES.editais, STORES.tombstones],
      };
    case 'LINK_SUBJECT':
      return {
        entityType: 'edital-discipline',
        entityId: command.linkId,
        stores: [STORES.editalDisciplines, STORES.editais, STORES.subjects, STORES.tombstones],
      };
    case 'UPSERT_ASSUNTO':
      return {
        entityType: 'assunto',
        entityId: command.value.id,
        stores: [STORES.assuntos, STORES.editalDisciplines, STORES.tombstones],
      };
    case 'UPSERT_AULA':
      return {
        entityType: 'aula',
        entityId: command.value.id,
        stores: [STORES.aulas, STORES.editalDisciplines, STORES.tombstones],
      };
    case 'LINK_LESSON_TOPIC':
      return {
        entityType: 'lesson-topic-link',
        entityId: command.link.id,
        stores: [STORES.lessonTopicLinks, STORES.aulas, STORES.assuntos, STORES.tombstones],
      };
    case 'UNLINK_LESSON_TOPIC':
      return {
        entityType: 'lesson-topic-link',
        entityId: command.linkId,
        stores: [STORES.lessonTopicLinks, STORES.tombstones],
      };
    case 'REORDER_SIBLING':
      return {
        entityType: command.entityType,
        entityId: command.entityId,
        stores: [
          command.entityType === 'assunto' ? STORES.assuntos : STORES.aulas,
          STORES.tombstones,
        ],
      };
    case 'SOFT_DELETE':
    case 'RESTORE_ENTITY':
      if (!isDeletableEntityType(command.entityType)) {
        throw new ContentValidationError('INVALID_COMMAND', 'entity type is not deletable');
      }
      return {
        entityType: command.entityType,
        entityId: command.entityId,
        stores: [
          storeFor(command.entityType),
          STORES.tombstones,
          STORES.meta,
          STORES.editalDisciplines,
          STORES.assuntos,
          STORES.aulas,
          STORES.lessonTopicLinks,
        ],
      };
    default:
      throw new ContentValidationError('INVALID_COMMAND', 'command has no plan');
  }
}

function storeFor(entityType: ContentEntityType): string {
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

function canonicalAssunto(value: Assunto): Record<string, unknown> {
  return {
    id: value.id,
    profileId: value.profileId,
    editalDisciplineId: value.editalDisciplineId,
    parentId: value.parentId ?? null,
    title: safeTitle(value.title),
    orderKey: typeof value.orderKey === 'string' ? value.orderKey.trim() : '',
    provenance: value.provenance ?? null,
  };
}

function canonicalAula(value: Aula): Record<string, unknown> {
  return {
    id: value.id,
    profileId: value.profileId,
    editalDisciplineId: value.editalDisciplineId,
    title: safeTitle(value.title),
    orderKey: typeof value.orderKey === 'string' ? value.orderKey.trim() : '',
    provenance: value.provenance ?? null,
  };
}

/**
 * Immutable, normalized identity of a command. Two commands compare equal only
 * when they would produce the same effect, so an `operationId` can never carry
 * two different payloads.
 */
function normalizeCommand(command: ContentCommand): Record<string, unknown> {
  const base = {
    type: command.type,
    operationId: command.operationId,
    profileId: command.profileId,
    baseRevision: command.baseRevision ?? null,
  };

  switch (command.type) {
    case 'CREATE_EDITAL':
      return {
        ...base,
        editalId: command.editalId,
        title: safeTitle(command.title),
        sourceRef: command.sourceRef?.trim() || null,
      };
    case 'RENAME_EDITAL':
      return { ...base, editalId: command.editalId, title: safeTitle(command.title) };
    case 'ARCHIVE_EDITAL':
      return { ...base, editalId: command.editalId };
    case 'LINK_SUBJECT':
      return {
        ...base,
        editalId: command.editalId,
        subjectId: command.subjectId,
        linkId: command.linkId,
        displayAlias: command.displayAlias?.trim() || null,
        orderKey: command.orderKey?.trim() || null,
      };
    case 'UPSERT_ASSUNTO':
      return { ...base, value: canonicalAssunto(command.value) };
    case 'UPSERT_AULA':
      return { ...base, value: canonicalAula(command.value) };
    case 'LINK_LESSON_TOPIC':
      return {
        ...base,
        link: {
          id: command.link.id,
          profileId: command.link.profileId,
          aulaId: command.link.aulaId,
          assuntoId: command.link.assuntoId,
        },
      };
    case 'UNLINK_LESSON_TOPIC':
      return { ...base, linkId: command.linkId };
    case 'REORDER_SIBLING':
      return {
        ...base,
        entityType: command.entityType,
        entityId: command.entityId,
        orderKey: command.orderKey.trim(),
      };
    case 'SOFT_DELETE':
      return { ...base, entityType: command.entityType, entityId: command.entityId };
    case 'RESTORE_ENTITY':
      return { ...base, entityType: command.entityType, entityId: command.entityId };
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

function requireLink(link: EditalDiscipline | undefined): EditalDiscipline {
  if (!link) throw new ContentValidationError('ENTITY_NOT_FOUND', 'edital discipline not found');
  if (link.status !== 'ACTIVE') {
    throw new ContentValidationError('EDITAL_ARCHIVED', 'edital discipline is archived');
  }
  return link;
}

export class LocalContentRepository implements ContentRepository {
  private readonly fault: Fault;
  private readonly now: () => string;

  constructor(options: ContentRepositoryOptions = {}) {
    this.fault = options.fault ?? null;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  reorderSibling(input: ReorderSiblingInput): Promise<CommitResult<unknown>> {
    return this.execute({
      type: 'REORDER_SIBLING',
      operationId: input.operationId,
      profileId: input.profileId,
      entityType: input.entityType,
      entityId: input.entityId,
      orderKey: input.orderKey,
      baseRevision: input.baseRevision ?? null,
    });
  }

  async execute(command: ContentCommand): Promise<CommitResult<unknown>> {
    let plan: Plan;
    try {
      plan = planOf(command);
    } catch (error) {
      if (error instanceof ContentValidationError) return { kind: 'INVALID', code: error.code };
      return { kind: 'FAILED', reason: 'UNKNOWN' };
    }

    const database = await openV2Database(command.profileId);
    const transaction = database.transaction(
      [...new Set([...plan.stores, STORES.operations, STORES.outbox])],
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
          existing.entityType !== plan.entityType ||
          existing.entityId !== plan.entityId ||
          !sameCommand(existing.command, command)
        ) {
          transaction.abort();
          return { kind: 'INVALID', code: 'OPERATION_ID_REUSED' };
        }
        await transactionDone(transaction);
        return { kind: 'LOCAL_COMMITTED', value: existing.entity };
      }

      let result: ApplyResult;
      try {
        result = await this.applyCommand(command, transaction);
      } catch (error) {
        transaction.abort();
        if (error instanceof ContentValidationError) return { kind: 'INVALID', code: error.code };
        if (error instanceof DOMException) {
          return { kind: 'INVALID', code: 'LINK_DUPLICATE' };
        }
        return { kind: 'FAILED', reason: 'UNKNOWN' };
      }

      if (result.status === 'INVALID') {
        transaction.abort();
        return { kind: 'INVALID', code: result.code };
      }
      if (result.status === 'CONFLICT') {
        transaction.abort();
        return { kind: 'CONFLICT', current: result.current };
      }

      const expectedBase = command.baseRevision ?? null;
      if (expectedBase !== null && expectedBase !== result.baseRevision) {
        const persisted = await requestResult(
          transaction.objectStore(storeFor(plan.entityType)).get([command.profileId, plan.entityId]),
        );
        transaction.abort();
        return { kind: 'CONFLICT', current: persisted ?? undefined };
      }

      const store = transaction.objectStore(storeFor(plan.entityType));
      if (result.kind === 'delete') {
        store.delete([command.profileId, plan.entityId]);
      } else {
        store.put(result.entity);
      }

      if (this.fault === 'abort') throw new DOMException('forced abort', 'AbortError');
      if (this.fault === 'quota') throw new DOMException('forced quota', 'QuotaExceededError');

      operations.put({
        operationId: command.operationId,
        profileId: command.profileId,
        entityType: plan.entityType,
        entityId: plan.entityId,
        command: normalizeCommand(command),
        entity: result.entity,
        committedAt: this.now(),
      } satisfies OperationRecord);

      if (result.changed) {
        transaction.objectStore(STORES.outbox).put({
          operationId: command.operationId,
          profileId: command.profileId,
          entityType: plan.entityType,
          entityId: plan.entityId,
          kind: result.kind,
          baseRevision: result.baseRevision,
          payload: result.entity,
          schemaVersion: DOMAIN_SCHEMA_VERSION,
          status: 'PENDING',
        });
      }

      await transactionDone(transaction);
      return { kind: 'LOCAL_COMMITTED', value: result.entity };
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      return { kind: 'FAILED', reason: toLocalPersistenceError(error).kind };
    }
  }

  private async applyCommand(
    command: ContentCommand,
    transaction: IDBTransaction,
  ): Promise<ApplyResult> {
    switch (command.type) {
      case 'CREATE_EDITAL':
      case 'RENAME_EDITAL':
      case 'ARCHIVE_EDITAL': {
        const deleted = await this.deletedMarker(
          command.profileId,
          'edital',
          command.editalId,
          transaction,
        );
        if (deleted) return { status: 'INVALID', code: 'DELETED_ENTITY' };
        const store = transaction.objectStore(STORES.editais);
        const current = (await requestResult(
          store.get([command.profileId, command.editalId]),
        )) as Edital | undefined;
        const next = applyEditalCommand(current ?? null, command);
        return {
          status: 'OK',
          entity: next,
          changed: JSON.stringify(current ?? null) !== JSON.stringify(next),
          baseRevision: current?.localRevision ?? null,
          kind: 'upsert',
        };
      }

      case 'LINK_SUBJECT': {
        const deleted = await this.deletedMarker(
          command.profileId,
          'edital-discipline',
          command.linkId,
          transaction,
        );
        if (deleted) return { status: 'INVALID', code: 'DELETED_ENTITY' };
        const edital = (await requestResult(
          transaction.objectStore(STORES.editais).get([command.profileId, command.editalId]),
        )) as Edital | undefined;
        if (!edital) return { status: 'INVALID', code: 'ENTITY_NOT_FOUND' };
        const subject = (await requestResult(
          transaction.objectStore(STORES.subjects).get([command.profileId, command.subjectId]),
        )) as StudySubject | undefined;
        if (!subject) return { status: 'INVALID', code: 'ENTITY_NOT_FOUND' };

        const linkStore = transaction.objectStore(STORES.editalDisciplines);
        const current = (await requestResult(
          linkStore.get([command.profileId, command.linkId]),
        )) as EditalDiscipline | undefined;
        const samePair = (await requestResult(
          linkStore.index('by_edital_subject').getAll([
            command.profileId,
            command.editalId,
            command.subjectId,
          ]),
        )) as EditalDiscipline[];
        if (samePair.some((item) => item.id !== command.linkId)) {
          return { status: 'INVALID', code: 'LINK_DUPLICATE' };
        }

        const siblings = (await requestResult(
          linkStore.index('by_edital').getAll([command.profileId, command.editalId]),
        )) as EditalDiscipline[];
        const orderKey =
          normalizeOrderKey(command.orderKey) ??
          current?.orderKey ??
          nextOrderKey(siblings.filter((item) => item.id !== command.linkId));

        const displayAlias = normalizeDisplayAlias(command.displayAlias) ?? current?.displayAlias;
        const next: EditalDiscipline = {
          id: command.linkId,
          profileId: command.profileId,
          editalId: command.editalId,
          subjectId: command.subjectId,
          orderKey,
          localRevision: (current?.localRevision ?? 0) + 1,
          status: 'ACTIVE',
          ...(displayAlias ? { displayAlias } : {}),
        };
        return {
          status: 'OK',
          entity: next,
          changed: JSON.stringify(current ?? null) !== JSON.stringify(next),
          baseRevision: current?.localRevision ?? null,
          kind: 'upsert',
        };
      }

      case 'UPSERT_ASSUNTO': {
        if (
          await this.deletedMarker(command.profileId, 'assunto', command.value.id, transaction)
        ) {
          return { status: 'INVALID', code: 'DELETED_ENTITY' };
        }
        const link = requireLink(
          (await requestResult(
            transaction.objectStore(STORES.editalDisciplines).get([
              command.profileId,
              command.value.editalDisciplineId,
            ]),
          )) as EditalDiscipline | undefined,
        );
        const store = transaction.objectStore(STORES.assuntos);
        const current = (await requestResult(
          store.get([command.profileId, command.value.id]),
        )) as Assunto | undefined;
        const scoped = (await requestResult(
          store.index('by_scope').getAll([command.profileId, link.id]),
        )) as Assunto[];
        const byId = new Map(scoped.map((item) => [item.id, item]));
        const parentId = command.value.parentId ?? null;
        assertAssuntoParent(command.value.id, parentId, link.id, byId);

        const orderKey =
          normalizeOrderKey(command.value.orderKey) ??
          current?.orderKey ??
          nextSiblingOrderKey(
            scoped.filter((item) => item.id !== command.value.id),
            parentId,
          );
        const provenance = normalizeProvenance(command.value.provenance);
        const next: Assunto = {
          id: command.value.id,
          profileId: command.profileId,
          editalDisciplineId: link.id,
          parentId,
          parentKey: parentKeyOf(parentId),
          title: normalizeContentTitle(command.value.title),
          orderKey,
          localRevision: (current?.localRevision ?? 0) + 1,
          ...(provenance ? { provenance } : {}),
        };
        return {
          status: 'OK',
          entity: next,
          changed: JSON.stringify(current ?? null) !== JSON.stringify(next),
          baseRevision: current?.localRevision ?? null,
          kind: 'upsert',
        };
      }

      case 'UPSERT_AULA': {
        if (await this.deletedMarker(command.profileId, 'aula', command.value.id, transaction)) {
          return { status: 'INVALID', code: 'DELETED_ENTITY' };
        }
        const link = requireLink(
          (await requestResult(
            transaction.objectStore(STORES.editalDisciplines).get([
              command.profileId,
              command.value.editalDisciplineId,
            ]),
          )) as EditalDiscipline | undefined,
        );
        const store = transaction.objectStore(STORES.aulas);
        const current = (await requestResult(
          store.get([command.profileId, command.value.id]),
        )) as Aula | undefined;
        const scoped = (await requestResult(
          store.index('by_scope').getAll([command.profileId, link.id]),
        )) as Aula[];
        const orderKey =
          normalizeOrderKey(command.value.orderKey) ??
          current?.orderKey ??
          nextOrderKey(scoped.filter((item) => item.id !== command.value.id));
        const provenance = normalizeProvenance(command.value.provenance);
        const next: Aula = {
          id: command.value.id,
          profileId: command.profileId,
          editalDisciplineId: link.id,
          title: normalizeContentTitle(command.value.title),
          orderKey,
          localRevision: (current?.localRevision ?? 0) + 1,
          ...(provenance ? { provenance } : {}),
        };
        return {
          status: 'OK',
          entity: next,
          changed: JSON.stringify(current ?? null) !== JSON.stringify(next),
          baseRevision: current?.localRevision ?? null,
          kind: 'upsert',
        };
      }

      case 'LINK_LESSON_TOPIC': {
        if (
          await this.deletedMarker(
            command.profileId,
            'lesson-topic-link',
            command.link.id,
            transaction,
          )
        ) {
          return { status: 'INVALID', code: 'DELETED_ENTITY' };
        }
        const aula = (await requestResult(
          transaction.objectStore(STORES.aulas).get([command.profileId, command.link.aulaId]),
        )) as Aula | undefined;
        if (!aula) return { status: 'INVALID', code: 'ENTITY_NOT_FOUND' };
        const assunto = (await requestResult(
          transaction.objectStore(STORES.assuntos).get([
            command.profileId,
            command.link.assuntoId,
          ]),
        )) as Assunto | undefined;
        if (!assunto) return { status: 'INVALID', code: 'ENTITY_NOT_FOUND' };

        validateLessonTopicLink(aula, assunto, command.link);

        const linkStore = transaction.objectStore(STORES.lessonTopicLinks);
        const current = (await requestResult(
          linkStore.get([command.profileId, command.link.id]),
        )) as LessonTopicLink | undefined;
        const duplicates = (await requestResult(
          linkStore.index('by_aula_assunto').getAll([
            command.profileId,
            command.link.aulaId,
            command.link.assuntoId,
          ]),
        )) as LessonTopicLink[];
        if (duplicates.some((item) => item.id !== command.link.id)) {
          return { status: 'INVALID', code: 'LINK_DUPLICATE' };
        }

        const next: LessonTopicLink = {
          id: command.link.id,
          profileId: command.profileId,
          aulaId: command.link.aulaId,
          assuntoId: command.link.assuntoId,
          localRevision: (current?.localRevision ?? 0) + 1,
        };
        return {
          status: 'OK',
          entity: next,
          changed: JSON.stringify(current ?? null) !== JSON.stringify(next),
          baseRevision: current?.localRevision ?? null,
          kind: 'upsert',
        };
      }

      case 'UNLINK_LESSON_TOPIC': {
        const store = transaction.objectStore(STORES.lessonTopicLinks);
        const current = (await requestResult(
          store.get([command.profileId, command.linkId]),
        )) as LessonTopicLink | undefined;
        if (!current) return { status: 'INVALID', code: 'ENTITY_NOT_FOUND' };
        return {
          status: 'OK',
          entity: current,
          changed: true,
          baseRevision: current.localRevision,
          kind: 'delete',
        };
      }

      case 'REORDER_SIBLING': {
        const store = transaction.objectStore(
          command.entityType === 'assunto' ? STORES.assuntos : STORES.aulas,
        );
        const current = (await requestResult(
          store.get([command.profileId, command.entityId]),
        )) as Assunto | Aula | undefined;
        if (!current) return { status: 'INVALID', code: 'ENTITY_NOT_FOUND' };
        const orderKey = normalizeOrderKey(command.orderKey);
        if (!orderKey) return { status: 'INVALID', code: 'ORDER_KEY_REQUIRED' };
        const next = { ...current, orderKey, localRevision: current.localRevision + 1 };
        return {
          status: 'OK',
          entity: next,
          changed: next.orderKey !== current.orderKey,
          baseRevision: current.localRevision,
          kind: 'upsert',
        };
      }

      case 'SOFT_DELETE': {
        const store = transaction.objectStore(storeFor(command.entityType));
        const current = (await requestResult(
          store.get([command.profileId, command.entityId]),
        )) as ContentEntity | undefined;
        if (!current) return { status: 'INVALID', code: 'ENTITY_NOT_FOUND' };

        const dependents = await this.dependenciesOf(
          command.profileId,
          command.entityType,
          command.entityId,
          current,
          transaction,
        );
        if (dependents.length > 0) {
          const report: DependencyReport = {
            code: 'DEPENDENT_CONTENT',
            entityType: command.entityType,
            entityId: command.entityId,
            dependents,
          };
          return { status: 'CONFLICT', current: report };
        }

        const meta = transaction.objectStore(STORES.meta);
        const epochRecord = (await requestResult(meta.get(epochKey(command.profileId)))) as
          | { epoch?: number }
          | undefined;
        const epoch = nextEpoch(epochRecord?.epoch);
        meta.put({ key: epochKey(command.profileId), epoch });

        const tombstone: LogicalTombstone = {
          profileId: command.profileId,
          entityType: command.entityType,
          entityId: command.entityId,
          operationId: command.operationId,
          baseRevision: current.localRevision ?? null,
          epoch,
          deleted: true,
          deletedAt: this.now(),
          snapshot: current as unknown as Record<string, unknown>,
        };
        transaction.objectStore(STORES.tombstones).put(tombstone);

        return {
          status: 'OK',
          entity: current,
          changed: true,
          baseRevision: current.localRevision ?? null,
          kind: 'delete',
        };
      }

      case 'RESTORE_ENTITY': {
        const liveStore = transaction.objectStore(storeFor(command.entityType));
        const live = (await requestResult(
          liveStore.get([command.profileId, command.entityId]),
        )) as ContentEntity | undefined;
        if (live) {
          if ((live as unknown as { status?: string }).status !== 'ARCHIVED') {
            return { status: 'INVALID', code: 'ENTITY_EXISTS' };
          }
          const reactivated = {
            ...(live as unknown as Record<string, unknown>),
            status: 'ACTIVE',
            localRevision: (live.localRevision ?? 0) + 1,
          } as unknown as ContentEntity;
          liveStore.put(reactivated);
          return {
            status: 'OK',
            entity: reactivated,
            changed: true,
            baseRevision: live.localRevision ?? null,
            kind: 'upsert',
          };
        }

        const tombstones = transaction.objectStore(STORES.tombstones);
        const tombstone = (await requestResult(
          tombstones.get([command.profileId, command.entityType, command.entityId]),
        )) as LogicalTombstone | undefined;
        if (!tombstone) return { status: 'INVALID', code: 'ENTITY_NOT_FOUND' };
        try {
          assertTombstoneScope(tombstone, command.profileId);
        } catch (error) {
          if (error instanceof ContentValidationError) {
            return { status: 'INVALID', code: error.code };
          }
          return { status: 'INVALID', code: 'TOMBSTONE_CONFLICT' };
        }

        const snapshot = tombstone.snapshot as unknown as ContentEntity;
        const restored: ContentEntity = {
          ...(snapshot as unknown as Record<string, unknown>),
          localRevision: (snapshot.localRevision ?? 0) + 1,
        } as unknown as ContentEntity;
        if (command.entityType === 'edital' || command.entityType === 'edital-discipline') {
          (restored as unknown as { status: string }).status = 'ACTIVE';
        }

        transaction.objectStore(storeFor(command.entityType)).put(restored);
        tombstones.delete([command.profileId, command.entityType, command.entityId]);

        const meta = transaction.objectStore(STORES.meta);
        const epochRecord = (await requestResult(meta.get(epochKey(command.profileId)))) as
          | { epoch?: number }
          | undefined;
        meta.put({ key: epochKey(command.profileId), epoch: nextEpoch(epochRecord?.epoch) });

        return {
          status: 'OK',
          entity: restored,
          changed: true,
          baseRevision: tombstone.baseRevision,
          kind: 'upsert',
        };
      }

      default:
        return { status: 'INVALID', code: 'INVALID_COMMAND' };
    }
  }

  private async deletedMarker(
    profileId: string,
    entityType: ContentEntityType,
    entityId: string,
    transaction: IDBTransaction,
  ): Promise<boolean> {
    const tombstone = await requestResult(
      transaction.objectStore(STORES.tombstones).get([profileId, entityType, entityId]),
    );
    return Boolean(tombstone);
  }

  /** Reads dependents without ever writing outside the current transaction. */
  private async dependenciesOf(
    profileId: string,
    entityType: ContentEntityType,
    entityId: string,
    current: ContentEntity,
    transaction: IDBTransaction,
  ): Promise<DependencyEntry[]> {
    const count = (store: string, index: string, key: IDBValidKey) =>
      requestResult(transaction.objectStore(store).index(index).count(key));
    const dependents: DependencyEntry[] = [];

    if (entityType === 'edital') {
      const links = await count(STORES.editalDisciplines, 'by_edital', [profileId, entityId]);
      if (links > 0) dependents.push({ entityType: 'edital-discipline', count: links });
      return dependents;
    }

    if (entityType === 'edital-discipline') {
      const assuntos = await count(STORES.assuntos, 'by_scope', [profileId, entityId]);
      if (assuntos > 0) dependents.push({ entityType: 'assunto', count: assuntos });
      const aulas = await count(STORES.aulas, 'by_scope', [profileId, entityId]);
      if (aulas > 0) dependents.push({ entityType: 'aula', count: aulas });
      return dependents;
    }

    if (entityType === 'assunto') {
      const scopeId = (current as Assunto).editalDisciplineId;
      const scoped = (await requestResult(
        transaction.objectStore(STORES.assuntos).index('by_scope').getAll([profileId, scopeId]),
      )) as Assunto[];
      const children = scoped.filter((item) => item.parentId === entityId).length;
      if (children > 0) dependents.push({ entityType: 'assunto', count: children });
      const links = await count(STORES.lessonTopicLinks, 'by_assunto', [profileId, entityId]);
      if (links > 0) dependents.push({ entityType: 'lesson-topic-link', count: links });
      return dependents;
    }

    if (entityType === 'aula') {
      const links = await count(STORES.lessonTopicLinks, 'by_aula', [profileId, entityId]);
      if (links > 0) dependents.push({ entityType: 'lesson-topic-link', count: links });
    }

    return dependents;
  }

  async loadContent(profileId: string): Promise<ContentSnapshot> {
    const database = await openV2Database(profileId);
    const transaction = database.transaction(
      [
        STORES.subjects,
        STORES.editais,
        STORES.editalDisciplines,
        STORES.assuntos,
        STORES.aulas,
        STORES.lessonTopicLinks,
      ],
      'readonly',
    );
    const [subjects, editais, links, assuntos, aulas, lessonTopics] = await Promise.all([
      requestResult(transaction.objectStore(STORES.subjects).index('by_profile').getAll(profileId)),
      requestResult(transaction.objectStore(STORES.editais).index('by_profile').getAll(profileId)),
      requestResult(
        transaction.objectStore(STORES.editalDisciplines).index('by_profile').getAll(profileId),
      ),
      requestResult(transaction.objectStore(STORES.assuntos).index('by_profile').getAll(profileId)),
      requestResult(transaction.objectStore(STORES.aulas).index('by_profile').getAll(profileId)),
      requestResult(
        transaction.objectStore(STORES.lessonTopicLinks).index('by_profile').getAll(profileId),
      ),
    ]);

    return {
      subjects: (subjects as StudySubject[]).sort((left, right) =>
        left.title.localeCompare(right.title, 'pt-BR'),
      ),
      editais: (editais as Edital[]).sort((left, right) =>
        left.title.localeCompare(right.title, 'pt-BR'),
      ),
      links: sortByOrder(links as EditalDiscipline[]),
      assuntos: sortAssuntos(assuntos as Assunto[]),
      aulas: sortByOrder(aulas as Aula[]),
      lessonTopics: [...(lessonTopics as LessonTopicLink[])].sort((left, right) =>
        left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
      ),
    };
  }
}
