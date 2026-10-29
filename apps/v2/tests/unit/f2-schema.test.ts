import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DB_NAME,
  deleteV2DatabaseForTests,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';
import { LOCAL_DB_VERSION } from '../../src/domain/versions';

const profileId = 'profile-local';

const F2_STORE_NAMES = [
  'editais',
  'edital_disciplines',
  'assuntos',
  'aulas',
  'lesson_topic_links',
  'tombstones',
  'quarantine',
  'import_receipts',
];

type UpgradeState = { kind: string; blocked: boolean };

async function readUpgradeState(): Promise<UpgradeState> {
  const module = (await import('../../src/platform/indexeddb')) as unknown as Record<
    string,
    unknown
  >;
  const reader = module.getDatabaseUpgradeState;
  expect(typeof reader).toBe('function');
  return (reader as () => UpgradeState)();
}

function openRequest(version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, version);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Builds the F1 schema exactly as `85ce1e3` shipped it, without F2 stores. */
async function seedF1Database(options: { keepOpen?: boolean } = {}): Promise<IDBDatabase> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      const subjects = database.createObjectStore('subjects', {
        keyPath: ['profileId', 'id'],
      });
      subjects.createIndex('by_profile', 'profileId', { unique: false });
      const outbox = database.createObjectStore('outbox', { keyPath: 'operationId' });
      outbox.createIndex('by_profile_status', ['profileId', 'status'], { unique: false });
      const operations = database.createObjectStore('operations', { keyPath: 'operationId' });
      operations.createIndex('by_profile', 'profileId', { unique: false });
      database.createObjectStore('profiles', { keyPath: 'profileId' });
      database.createObjectStore('meta', { keyPath: 'key' });
      const conflicts = database.createObjectStore('conflicts', { keyPath: 'conflictId' });
      conflicts.createIndex('by_profile', 'profileId', { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const transaction = database.transaction(
    ['subjects', 'operations', 'outbox'],
    'readwrite',
  );
  transaction.objectStore('subjects').put({
    id: 'subject-1',
    profileId,
    title: 'Direito Constitucional',
    localRevision: 3,
  });
  transaction.objectStore('operations').put({
    operationId: 'op-f1-1',
    profileId,
    entityId: 'subject-1',
    type: 'create',
    subject: { id: 'subject-1', profileId, title: 'Direito', localRevision: 1 },
    committedAt: '2026-10-28T00:00:00.000Z',
  });
  transaction.objectStore('outbox').put({
    operationId: 'op-f1-1',
    profileId,
    entityType: 'subject',
    entityId: 'subject-1',
    kind: 'upsert',
    baseRevision: null,
    payload: { id: 'subject-1', profileId, title: 'Direito', localRevision: 1 },
    schemaVersion: 1,
    status: 'PENDING',
  });
  await transactionDone(transaction);

  if (!options.keepOpen) database.close();
  return database;
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F2 IndexedDB schema upgrade', () => {
  it('upgrade_f1_preserves_subject_operations_outbox', async () => {
    await seedF1Database();

    const database = await openV2Database(profileId);
    const names = [...database.objectStoreNames];
    expect(names).toEqual(expect.arrayContaining(['subjects', 'outbox', 'operations']));
    expect(names).toEqual(expect.arrayContaining(F2_STORE_NAMES));

    const transaction = database.transaction(
      ['subjects', 'operations', 'outbox'],
      'readonly',
    );
    const subject = await requestResult(
      transaction.objectStore('subjects').get([profileId, 'subject-1']),
    );
    expect(subject).toEqual({
      id: 'subject-1',
      profileId,
      title: 'Direito Constitucional',
      localRevision: 3,
    });
    expect(await requestResult(transaction.objectStore('operations').count())).toBe(1);
    expect(await requestResult(transaction.objectStore('outbox').count())).toBe(1);

    // Reopening the same upgraded database must not duplicate or reset stores.
    const reopened = await openRequest(LOCAL_DB_VERSION);
    expect([...reopened.objectStoreNames]).toEqual(expect.arrayContaining(F2_STORE_NAMES));
    const replay = reopened.transaction(['subjects'], 'readonly');
    expect(await requestResult(replay.objectStore('subjects').count())).toBe(1);
    reopened.close();
  });

  it('upgrade_creates_f2_indexes_for_scoping_and_ordering', async () => {
    const database = await openV2Database(profileId);
    const transaction = database.transaction(
      [STORES.editalDisciplines, STORES.assuntos, STORES.lessonTopicLinks, STORES.editais],
      'readonly',
    );
    const linkIndexes = [...transaction.objectStore(STORES.editalDisciplines).indexNames];
    expect(linkIndexes).toEqual(
      expect.arrayContaining(['by_profile', 'by_edital', 'by_subject', 'by_edital_subject']),
    );
    const linkStore = transaction.objectStore(STORES.editalDisciplines);
    expect(linkStore.index('by_edital_subject').unique).toBe(true);

    const assuntoIndexes = [...transaction.objectStore(STORES.assuntos).indexNames];
    expect(assuntoIndexes).toEqual(
      expect.arrayContaining(['by_scope', 'by_scope_order', 'by_parent_order']),
    );

    const lessonIndexes = [...transaction.objectStore(STORES.lessonTopicLinks).indexNames];
    expect(lessonIndexes).toEqual(expect.arrayContaining(['by_aula', 'by_aula_assunto']));
    expect(
      transaction.objectStore(STORES.lessonTopicLinks).index('by_aula_assunto').unique,
    ).toBe(true);
    expect(transaction.objectStore(STORES.editais).keyPath).toEqual(['profileId', 'id']);
  });

  it('blocked_upgrade_never_deletes_existing_database', async () => {
    const deleteSpy = vi.spyOn(indexedDB, 'deleteDatabase');
    const legacy = await seedF1Database({ keepOpen: true });

    const opening = openV2Database(profileId);
    try {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const blocked = await readUpgradeState();
      expect(blocked.kind).toBe('BLOCKED_UPGRADE');
      expect(blocked.blocked).toBe(true);

      // The F1 database is untouched and the F2 stores were not created yet.
      expect(legacy.objectStoreNames.contains('editais')).toBe(false);
      const legacyTransaction = legacy.transaction('subjects', 'readonly');
      expect(await requestResult(legacyTransaction.objectStore('subjects').count())).toBe(1);
      expect(deleteSpy).not.toHaveBeenCalled();
    } finally {
      legacy.close();
    }

    const upgraded = await opening;
    expect(upgraded.objectStoreNames.contains('editais')).toBe(true);
    const ready = await readUpgradeState();
    expect(ready.kind).toBe('READY');
    expect(ready.blocked).toBe(false);
  });

  it('blocked_upgrade_never_opens_a_second_database', async () => {
    const legacy = await seedF1Database({ keepOpen: true });
    const opening = openV2Database(profileId);
    try {
      await new Promise((resolve) => setTimeout(resolve, 10));
      const state = await readUpgradeState();
      expect(state.kind).toBe('BLOCKED_UPGRADE');
    } finally {
      legacy.close();
    }
    await opening;
    await openV2Database(profileId);
    expect((await readUpgradeState()).kind).toBe('READY');
  });

  it('versionchange_releases_the_cached_connection', async () => {
    const database = await openV2Database(profileId);
    let closed = false;
    const close = database.close.bind(database);
    database.close = () => {
      closed = true;
      close();
    };

    database.onversionchange?.(new Event('versionchange') as IDBVersionChangeEvent);
    expect(closed).toBe(true);
    expect((await readUpgradeState()).kind).toBe('IDLE');

    const reopened = await openV2Database(profileId);
    expect(reopened).not.toBe(database);
    expect((await readUpgradeState()).kind).toBe('READY');
  });

  it('parent_order_index_covers_roots_and_children', async () => {
    const database = await openV2Database(profileId);
    const write = database.transaction(STORES.assuntos, 'readwrite');
    const store = write.objectStore(STORES.assuntos);
    store.put({
      id: 'assunto-root-2',
      profileId,
      editalDisciplineId: 'link-1',
      parentId: null,
      parentKey: '',
      title: 'Raiz 2',
      orderKey: '000020',
      localRevision: 1,
    });
    store.put({
      id: 'assunto-root-1',
      profileId,
      editalDisciplineId: 'link-1',
      parentId: null,
      parentKey: '',
      title: 'Raiz 1',
      orderKey: '000010',
      localRevision: 1,
    });
    store.put({
      id: 'assunto-child',
      profileId,
      editalDisciplineId: 'link-1',
      parentId: 'assunto-root-1',
      parentKey: 'assunto-root-1',
      title: 'Filho',
      orderKey: '000005',
      localRevision: 1,
    });
    await transactionDone(write);

    const read = database.transaction(STORES.assuntos, 'readonly');
    const indexed = (await requestResult(
      read.objectStore(STORES.assuntos).index('by_parent_order').getAll(),
    )) as { id: string }[];
    expect(indexed.map((item) => item.id)).toEqual([
      'assunto-root-1',
      'assunto-root-2',
      'assunto-child',
    ]);
  });

  it('edital_discipline_uniqueness_blocks_duplicate_links', async () => {
    const database = await openV2Database(profileId);
    const first = database.transaction(STORES.editalDisciplines, 'readwrite');
    first.objectStore(STORES.editalDisciplines).put({
      id: 'link-1',
      profileId,
      editalId: 'edital-1',
      subjectId: 'subject-1',
      orderKey: '000010',
      localRevision: 1,
      status: 'ACTIVE',
    });
    await transactionDone(first);

    const duplicate = database.transaction(STORES.editalDisciplines, 'readwrite');
    const request = duplicate.objectStore(STORES.editalDisciplines).put({
      id: 'link-2',
      profileId,
      editalId: 'edital-1',
      subjectId: 'subject-1',
      orderKey: '000020',
      localRevision: 1,
      status: 'ACTIVE',
    });
    const failure = await new Promise<unknown>((resolve) => {
      request.onsuccess = () => resolve(undefined);
      request.onerror = () => resolve(request.error);
    });
    expect(failure).toMatchObject({ name: 'ConstraintError' });
    await transactionDone(duplicate).catch(() => undefined);

    const read = database.transaction(STORES.editalDisciplines, 'readonly');
    expect(await requestResult(read.objectStore(STORES.editalDisciplines).count())).toBe(1);
  });

  it('upgrade_adds_new_indexes_to_existing_f1_stores', async () => {
    await seedF1Database();
    const database = await openV2Database(profileId);
    const transaction = database.transaction(
      [STORES.operations, STORES.outbox, STORES.conflicts],
      'readonly',
    );
    expect([...transaction.objectStore(STORES.operations).indexNames]).toEqual(
      expect.arrayContaining(['by_profile']),
    );
    expect([...transaction.objectStore(STORES.outbox).indexNames]).toEqual(
      expect.arrayContaining(['by_profile_status', 'by_profile_entity']),
    );
    expect([...transaction.objectStore(STORES.conflicts).indexNames]).toEqual(
      expect.arrayContaining(['by_profile', 'by_profile_entity']),
    );
  });

  it('upgrade_preserves_exact_operation_and_outbox_records', async () => {
    await seedF1Database();
    const database = await openV2Database(profileId);
    const transaction = database.transaction(['operations', 'outbox'], 'readonly');
    const operation = await requestResult(
      transaction.objectStore('operations').get('op-f1-1'),
    );
    const outbox = await requestResult(transaction.objectStore('outbox').get('op-f1-1'));
    expect(operation).toMatchObject({
      operationId: 'op-f1-1',
      profileId,
      entityId: 'subject-1',
      type: 'create',
      committedAt: '2026-10-28T00:00:00.000Z',
    });
    expect(outbox).toMatchObject({
      operationId: 'op-f1-1',
      entityType: 'subject',
      baseRevision: null,
      schemaVersion: 1,
      status: 'PENDING',
    });
  });
});
