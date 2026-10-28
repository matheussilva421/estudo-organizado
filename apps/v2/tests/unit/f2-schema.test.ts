import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DB_NAME,
  deleteV2DatabaseForTests,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';

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
    const reopened = await openRequest(2);
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
    await new Promise((resolve) => setTimeout(resolve, 10));

    const blocked = await readUpgradeState();
    expect(blocked.kind).toBe('BLOCKED_UPGRADE');
    expect(blocked.blocked).toBe(true);

    // The F1 database is untouched and the F2 stores were not created yet.
    expect(legacy.objectStoreNames.contains('editais')).toBe(false);
    const legacyTransaction = legacy.transaction('subjects', 'readonly');
    expect(await requestResult(legacyTransaction.objectStore('subjects').count())).toBe(1);
    expect(deleteSpy).not.toHaveBeenCalled();

    legacy.close();
    const upgraded = await opening;
    expect(upgraded.objectStoreNames.contains('editais')).toBe(true);
    const ready = await readUpgradeState();
    expect(ready.kind).toBe('READY');
    expect(ready.blocked).toBe(false);
  });

  it('blocked_upgrade_never_opens_a_second_database', async () => {
    const legacy = await seedF1Database({ keepOpen: true });
    void openV2Database(profileId);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const state = await readUpgradeState();
    expect(state.kind).toBe('BLOCKED_UPGRADE');

    legacy.close();
    await openV2Database(profileId);
    expect((await readUpgradeState()).kind).toBe('READY');
  });
});
