import { beforeEach, describe, expect, it } from 'vitest';
import {
  DB_NAME,
  deleteV2DatabaseForTests,
  openV2Database,
  requestResult,
  transactionDone,
  getDatabaseUpgradeState,
} from '../../src/platform/indexeddb';
import { LOCAL_DB_VERSION } from '../../src/domain/versions';

const profileId = 'profile-local';

const F3_STORES = [
  'planning_scenarios',
  'planning_blocks',
  'planning_drafts',
  'planning_checkpoints',
  'planning_priority_profiles',
  'planning_availability',
  'planning_imports',
];

/** Builds the v2 database (F1 + F2) exactly as F2 shipped it. */
async function seedF2Database(options: { keepOpen?: boolean } = {}): Promise<IDBDatabase> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const current = request.result;
      const subjects = current.createObjectStore('subjects', {
        keyPath: ['profileId', 'id'],
      });
      subjects.createIndex('by_profile', 'profileId', { unique: false });
      const outbox = current.createObjectStore('outbox', { keyPath: 'operationId' });
      outbox.createIndex('by_profile_status', ['profileId', 'status'], { unique: false });
      outbox.createIndex('by_profile_entity', ['profileId', 'entityType', 'entityId'], {
        unique: false,
      });
      current.createObjectStore('operations', { keyPath: 'operationId' });
      current.createObjectStore('profiles', { keyPath: 'profileId' });
      current.createObjectStore('meta', { keyPath: 'key' });
      const conflicts = current.createObjectStore('conflicts', { keyPath: 'conflictId' });
      conflicts.createIndex('by_profile', 'profileId', { unique: false });
      const editais = current.createObjectStore('editais', {
        keyPath: ['profileId', 'id'],
      });
      editais.createIndex('by_profile', 'profileId', { unique: false });
      current.createObjectStore('edital_disciplines', {
        keyPath: ['profileId', 'id'],
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const transaction = database.transaction(
    ['subjects', 'operations', 'outbox', 'editais'],
    'readwrite',
  );
  transaction.objectStore('subjects').put({
    id: 'subject-1',
    profileId,
    title: 'Direito Constitucional',
    localRevision: 3,
  });
  transaction.objectStore('editais').put({
    id: 'edital-tjpb',
    profileId,
    title: 'TJPB',
    status: 'ACTIVE',
    localRevision: 2,
  });
  transaction.objectStore('operations').put({
    operationId: 'op-f2-1',
    profileId,
    entityId: 'edital-tjpb',
    type: 'create',
    committedAt: '2026-10-28T00:00:00.000Z',
  });
  transaction.objectStore('outbox').put({
    operationId: 'op-f2-1',
    profileId,
    entityType: 'edital',
    entityId: 'edital-tjpb',
    kind: 'upsert',
    baseRevision: null,
    payload: { id: 'edital-tjpb', profileId, title: 'TJPB' },
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

describe('F3 IndexedDB schema upgrade', () => {
  it('upgrade_v2_to_v3_adds_planning_stores_and_preserves_f2_records', async () => {
    await seedF2Database();

    const database = await openV2Database(profileId);
    expect(database.version).toBe(LOCAL_DB_VERSION);
    const names = [...database.objectStoreNames];
    expect(names).toEqual(expect.arrayContaining(F3_STORES));
    // F1/F2 stores keep their identity: no rename, no drop.
    expect(names).toEqual(
      expect.arrayContaining([
        'subjects',
        'outbox',
        'operations',
        'editais',
        'edital_disciplines',
        'conflicts',
      ]),
    );

    const transaction = database.transaction(
      ['subjects', 'operations', 'outbox', 'editais'],
      'readonly',
    );
    expect(
      await requestResult(transaction.objectStore('subjects').get([profileId, 'subject-1'])),
    ).toEqual({
      id: 'subject-1',
      profileId,
      title: 'Direito Constitucional',
      localRevision: 3,
    });
    expect(await requestResult(transaction.objectStore('operations').count())).toBe(1);
    expect(await requestResult(transaction.objectStore('outbox').count())).toBe(1);
    expect(
      await requestResult(transaction.objectStore('editais').get([profileId, 'edital-tjpb'])),
    ).toMatchObject({ id: 'edital-tjpb', localRevision: 2 });
  });

  it('blocked_upgrade_never_drops_the_previous_database', async () => {
    const legacy = await seedF2Database({ keepOpen: true });
    const opening = openV2Database(profileId);
    try {
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(getDatabaseUpgradeState().kind).toBe('BLOCKED_UPGRADE');
      // The v2 database is untouched while the old tab holds it.
      const probe = legacy.transaction('subjects', 'readonly');
      expect(await requestResult(probe.objectStore('subjects').count())).toBe(1);
      expect(legacy.version).toBe(2);
    } finally {
      legacy.close();
    }
    const upgraded = await opening;
    expect(upgraded.version).toBe(LOCAL_DB_VERSION);
    const read = upgraded.transaction(['subjects', 'outbox'], 'readonly');
    expect(await requestResult(read.objectStore('subjects').count())).toBe(1);
    expect(await requestResult(read.objectStore('outbox').count())).toBe(1);
    expect(getDatabaseUpgradeState().kind).toBe('READY');
  });

  it('planning_stores_expose_scoping_indexes', async () => {
    const database = await openV2Database(profileId);
    const transaction = database.transaction(
      ['planning_scenarios', 'planning_blocks', 'planning_drafts'],
      'readonly',
    );
    expect([...transaction.objectStore('planning_scenarios').indexNames]).toEqual(
      expect.arrayContaining(['by_profile', 'by_profile_edital', 'by_edital_status']),
    );
    expect([...transaction.objectStore('planning_blocks').indexNames]).toEqual(
      expect.arrayContaining(['by_scenario', 'by_edital', 'by_date', 'by_allocation']),
    );
    expect(
      transaction.objectStore('planning_drafts').keyPath,
    ).toEqual(['profileId', 'scenarioId']);
  });
});
