import { STORES } from './indexeddb';

/**
 * F2 schema migration.
 *
 * The upgrade is additive only: F1 stores are never renamed, re-keyed or
 * dropped, and no record is rewritten. Every step is guarded so the same
 * `onupgradeneeded` can run for a fresh database (oldVersion 0) and for an F1
 * database (oldVersion 1) without duplicating stores or indexes.
 */

export const UPGRADE_BLOCKED_MESSAGE = 'BLOCKED_UPGRADE';

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
          name: 'by_parent_order',
          keyPath: ['profileId', 'editalDisciplineId', 'parentId', 'orderKey'],
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
