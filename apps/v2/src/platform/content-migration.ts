import type { CommitResult } from '../application/content-commands';
import {
  applyEditalCommand,
  ContentValidationError,
  nextOrderKey,
  type Edital,
  type EditalDiscipline,
  type Id,
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

/**
 * F2 schema migration.
 *
 * The upgrade is additive only: F1 stores are never renamed, re-keyed or
 * dropped, and no record is rewritten. Every step is guarded so the same
 * `onupgradeneeded` can run for a fresh database (oldVersion 0) and for an F1
 * database (oldVersion 1) without duplicating stores or indexes.
 */

export const UPGRADE_BLOCKED_MESSAGE = 'BLOCKED_UPGRADE';

export type AdoptionDecision =
  | { subjectId: Id; decision: 'LINK_EXISTING'; editalId: Id }
  | {
      subjectId: Id;
      decision: 'CREATE_EDITAL_AND_LINK';
      newEdital: { editalId: Id; title: string };
    }
  | { subjectId: Id; decision: 'LEAVE_UNASSIGNED' };

export type AdoptionReport = {
  profileId: Id;
  operationId: Id;
  /** Subjects attached to an edital that already existed. */
  linked: Id[];
  /** Subjects attached through a newly created edital. */
  created: Id[];
  leftUnassigned: Id[];
  links: EditalDiscipline[];
};

export interface SubjectAdoptionService {
  listUnassignedSubjects(profileId: Id): Promise<StudySubject[]>;
  applySubjectAdoption(
    profileId: Id,
    operationId: Id,
    decisions: readonly AdoptionDecision[],
  ): Promise<CommitResult<AdoptionReport>>;
}

type IndexDefinition = {
  name: string;
  keyPath: string | string[];
  unique?: boolean;
};

type StoreDefinition = {
  name: string;
  keyPath: string | string[];
  indexes: IndexDefinition[];
};

function definitions(): StoreDefinition[] {
  return [
    {
      name: STORES.subjects,
      keyPath: ['profileId', 'id'],
      indexes: [{ name: 'by_profile', keyPath: 'profileId' }],
    },
    {
      name: STORES.outbox,
      keyPath: 'operationId',
      indexes: [
        { name: 'by_profile_status', keyPath: ['profileId', 'status'] },
        { name: 'by_profile_entity', keyPath: ['profileId', 'entityType', 'entityId'] },
      ],
    },
    {
      name: STORES.operations,
      keyPath: 'operationId',
      indexes: [{ name: 'by_profile', keyPath: 'profileId' }],
    },
    { name: STORES.profiles, keyPath: 'profileId', indexes: [] },
    { name: STORES.meta, keyPath: 'key', indexes: [] },
    {
      name: STORES.conflicts,
      keyPath: 'conflictId',
      indexes: [
        { name: 'by_profile', keyPath: 'profileId' },
        { name: 'by_profile_entity', keyPath: ['profileId', 'entityType', 'entityId'] },
      ],
    },
    {
      name: STORES.editais,
      keyPath: ['profileId', 'id'],
      indexes: [
        { name: 'by_profile', keyPath: 'profileId' },
        { name: 'by_profile_status', keyPath: ['profileId', 'status'] },
      ],
    },
    {
      name: STORES.editalDisciplines,
      keyPath: ['profileId', 'id'],
      indexes: [
        { name: 'by_profile', keyPath: 'profileId' },
        { name: 'by_edital', keyPath: ['profileId', 'editalId'] },
        { name: 'by_subject', keyPath: ['profileId', 'subjectId'] },
        {
          name: 'by_edital_subject',
          keyPath: ['profileId', 'editalId', 'subjectId'],
          unique: true,
        },
      ],
    },
    {
      name: STORES.assuntos,
      keyPath: ['profileId', 'id'],
      indexes: [
        { name: 'by_profile', keyPath: 'profileId' },
        { name: 'by_scope', keyPath: ['profileId', 'editalDisciplineId'] },
        { name: 'by_scope_order', keyPath: ['profileId', 'editalDisciplineId', 'orderKey'] },
        {
          // `parentId` is nullable and IndexedDB does not index compound keys
          // containing null, so writers persist `parentKey = parentId ?? ''`.
          name: 'by_parent_order',
          keyPath: ['profileId', 'editalDisciplineId', 'parentKey', 'orderKey'],
        },
      ],
    },
    {
      name: STORES.aulas,
      keyPath: ['profileId', 'id'],
      indexes: [
        { name: 'by_profile', keyPath: 'profileId' },
        { name: 'by_scope', keyPath: ['profileId', 'editalDisciplineId'] },
        { name: 'by_scope_order', keyPath: ['profileId', 'editalDisciplineId', 'orderKey'] },
      ],
    },
    {
      name: STORES.lessonTopicLinks,
      keyPath: ['profileId', 'id'],
      indexes: [
        { name: 'by_profile', keyPath: 'profileId' },
        { name: 'by_aula', keyPath: ['profileId', 'aulaId'] },
        { name: 'by_assunto', keyPath: ['profileId', 'assuntoId'] },
        {
          name: 'by_aula_assunto',
          keyPath: ['profileId', 'aulaId', 'assuntoId'],
          unique: true,
        },
      ],
    },
    {
      name: STORES.tombstones,
      keyPath: ['profileId', 'entityType', 'entityId'],
      indexes: [
        { name: 'by_profile', keyPath: 'profileId' },
        { name: 'by_profile_epoch', keyPath: ['profileId', 'epoch'] },
      ],
    },
    {
      name: STORES.quarantine,
      keyPath: ['profileId', 'quarantineId'],
      indexes: [{ name: 'by_profile', keyPath: 'profileId' }],
    },
    {
      name: STORES.importReceipts,
      keyPath: ['profileId', 'importId'],
      indexes: [{ name: 'by_profile', keyPath: 'profileId' }],
    },
  ];
}

function ensureIndex(store: IDBObjectStore, definition: IndexDefinition): void {
  if (store.indexNames.contains(definition.name)) return;
  store.createIndex(definition.name, definition.keyPath, { unique: definition.unique === true });
}

export function upgradeV2Schema(
  database: IDBDatabase,
  oldVersion: number,
  _transaction: IDBTransaction,
): void {
  if (!Number.isInteger(oldVersion) || oldVersion < 0) {
    throw new Error('INVALID_UPGRADE_VERSION');
  }

  for (const definition of definitions()) {
    const store = database.objectStoreNames.contains(definition.name)
      ? _transaction.objectStore(definition.name)
      : database.createObjectStore(definition.name, { keyPath: definition.keyPath });
    for (const index of definition.indexes) ensureIndex(store, index);
  }
}

type AdoptionOperationRecord = {
  operationId: string;
  profileId: string;
  entityType: 'subject-adoption';
  entityId: string;
  command: unknown;
  entity: AdoptionReport;
  committedAt: string;
};

function normalizeAdoption(
  operationId: string,
  profileId: string,
  decisions: readonly AdoptionDecision[],
): Record<string, unknown> {
  return {
    type: 'SUBJECT_ADOPTION',
    operationId,
    profileId,
    decisions: decisions.map((decision) => {
      if (decision.decision === 'LINK_EXISTING') {
        return { subjectId: decision.subjectId, decision: decision.decision, editalId: decision.editalId };
      }
      if (decision.decision === 'CREATE_EDITAL_AND_LINK') {
        return {
          subjectId: decision.subjectId,
          decision: decision.decision,
          editalId: decision.newEdital.editalId,
          title: normalizeSubjectTitle(decision.newEdital.title ?? ''),
        };
      }
      return { subjectId: decision.subjectId, decision: decision.decision };
    }),
  };
}

/**
 * F1 subjects are never linked automatically. The queue is explicit and every
 * decision lands through one transaction with its own operation record.
 */
export class LocalSubjectAdoptionService implements SubjectAdoptionService {
  private readonly now: () => string;

  constructor(options: { now?: () => string } = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async listUnassignedSubjects(profileId: string): Promise<StudySubject[]> {
    const database = await openV2Database(profileId);
    const transaction = database.transaction(
      [STORES.subjects, STORES.editalDisciplines],
      'readonly',
    );
    const [subjects, links] = await Promise.all([
      requestResult(transaction.objectStore(STORES.subjects).index('by_profile').getAll(profileId)),
      requestResult(
        transaction.objectStore(STORES.editalDisciplines).index('by_profile').getAll(profileId),
      ),
    ]);
    const linked = new Set(
      (links as EditalDiscipline[])
        .filter((link) => link.status === 'ACTIVE')
        .map((link) => link.subjectId),
    );
    return (subjects as StudySubject[])
      .filter((subject) => !linked.has(subject.id))
      .sort((left, right) => left.title.localeCompare(right.title, 'pt-BR'));
  }

  async applySubjectAdoption(
    profileId: string,
    operationId: string,
    decisions: readonly AdoptionDecision[],
  ): Promise<CommitResult<AdoptionReport>> {
    if (!operationId.trim() || decisions.length === 0) {
      return { kind: 'INVALID', code: 'INVALID_COMMAND' };
    }
    const seen = new Set<string>();
    for (const decision of decisions) {
      if (!decision.subjectId || seen.has(decision.subjectId)) {
        return { kind: 'INVALID', code: 'INVALID_COMMAND' };
      }
      seen.add(decision.subjectId);
    }

    const database = await openV2Database(profileId);
    const transaction = database.transaction(
      [
        STORES.subjects,
        STORES.editais,
        STORES.editalDisciplines,
        STORES.operations,
        STORES.outbox,
      ],
      'readwrite',
    );

    try {
      const operations = transaction.objectStore(STORES.operations);
      const persisted = (await requestResult(operations.get(operationId))) as
        | AdoptionOperationRecord
        | undefined;
      if (persisted) {
        if (
          persisted.profileId !== profileId ||
          JSON.stringify(persisted.command) !==
            JSON.stringify(normalizeAdoption(operationId, profileId, decisions))
        ) {
          transaction.abort();
          return { kind: 'INVALID', code: 'OPERATION_ID_REUSED' };
        }
        await transactionDone(transaction);
        return { kind: 'LOCAL_COMMITTED', value: persisted.entity };
      }

      const subjectStore = transaction.objectStore(STORES.subjects);
      const editalStore = transaction.objectStore(STORES.editais);
      const linkStore = transaction.objectStore(STORES.editalDisciplines);
      const outbox = transaction.objectStore(STORES.outbox);

      const report: AdoptionReport = {
        profileId,
        operationId,
        linked: [],
        created: [],
        leftUnassigned: [],
        links: [],
      };

      for (const decision of decisions) {
        const subject = (await requestResult(
          subjectStore.get([profileId, decision.subjectId]),
        )) as StudySubject | undefined;
        if (!subject) {
          transaction.abort();
          return { kind: 'INVALID', code: 'ENTITY_NOT_FOUND' };
        }

        if (decision.decision === 'LEAVE_UNASSIGNED') {
          report.leftUnassigned.push(subject.id);
          continue;
        }

        let edital: Edital;
        if (decision.decision === 'LINK_EXISTING') {
          const existing = (await requestResult(
            editalStore.get([profileId, decision.editalId]),
          )) as Edital | undefined;
          if (!existing) {
            transaction.abort();
            return { kind: 'INVALID', code: 'ENTITY_NOT_FOUND' };
          }
          if (existing.status !== 'ACTIVE') {
            transaction.abort();
            return { kind: 'INVALID', code: 'EDITAL_ARCHIVED' };
          }
          edital = existing;
        } else {
          const editalId = decision.newEdital.editalId?.trim();
          if (!editalId) {
            transaction.abort();
            return { kind: 'INVALID', code: 'IDENTIFIER_REQUIRED' };
          }
          const conflicting = (await requestResult(
            editalStore.get([profileId, editalId]),
          )) as Edital | undefined;
          if (conflicting) {
            transaction.abort();
            return { kind: 'INVALID', code: 'EDITAL_EXISTS' };
          }
          try {
            edital = applyEditalCommand(null, {
              type: 'CREATE_EDITAL',
              operationId,
              profileId,
              editalId,
              title: decision.newEdital.title,
            });
          } catch (error) {
            transaction.abort();
            if (error instanceof ContentValidationError) {
              return { kind: 'INVALID', code: error.code };
            }
            return { kind: 'FAILED', reason: 'UNKNOWN' };
          }
          editalStore.put(edital);
          outbox.put({
            operationId: `${operationId}~edital~${edital.id}`,
            profileId,
            entityType: 'edital',
            entityId: edital.id,
            kind: 'upsert',
            baseRevision: null,
            payload: edital,
            schemaVersion: DOMAIN_SCHEMA_VERSION,
            status: 'PENDING',
          });
        }

        if (decision.decision === 'LINK_EXISTING') report.linked.push(subject.id);
        else report.created.push(subject.id);

        const already = (await requestResult(
          linkStore.index('by_edital_subject').getAll([profileId, edital.id, subject.id]),
        )) as EditalDiscipline[];
        if (already.length > 0) {
          report.links.push(...already);
          continue;
        }

        const siblings = (await requestResult(
          linkStore.index('by_edital').getAll([profileId, edital.id]),
        )) as EditalDiscipline[];
        const link: EditalDiscipline = {
          id: `${operationId}~link~${subject.id}`,
          profileId,
          editalId: edital.id,
          subjectId: subject.id,
          orderKey: nextOrderKey(siblings),
          localRevision: 1,
          status: 'ACTIVE',
        };
        linkStore.put(link);
        outbox.put({
          operationId: `${operationId}~link~${subject.id}`,
          profileId,
          entityType: 'edital-discipline',
          entityId: link.id,
          kind: 'upsert',
          baseRevision: null,
          payload: link,
          schemaVersion: DOMAIN_SCHEMA_VERSION,
          status: 'PENDING',
        });
        report.links.push(link);
      }

      operations.put({
        operationId,
        profileId,
        entityType: 'subject-adoption',
        entityId: operationId,
        command: normalizeAdoption(operationId, profileId, decisions),
        entity: report,
        committedAt: this.now(),
      } satisfies AdoptionOperationRecord);

      await transactionDone(transaction);
      return { kind: 'LOCAL_COMMITTED', value: report };
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
