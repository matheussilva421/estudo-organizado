import { beforeEach, describe, expect, it } from 'vitest';
import {
  DB_NAME,
  deleteV2DatabaseForTests,
  getDatabaseUpgradeState,
  openV2Database,
  requestResult,
  transactionDone,
} from '../../src/platform/indexeddb';
import { LOCAL_DB_VERSION } from '../../src/domain/versions';

const profileId = 'profile-f4';

const F4_STORES = [
  'sessions',
  'session_audit',
  'session_control',
  'session_conflicts',
  'session_habits',
  'habit_occurrences',
  'session_emergency_receipts',
];

/** Builds the database exactly as F3 shipped it, with F3 records to preserve. */
async function seedF3Database(options: { keepOpen?: boolean } = {}): Promise<IDBDatabase> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3);
    request.onupgradeneeded = () => {
      const current = request.result;
      const subjects = current.createObjectStore('subjects', {
        keyPath: ['profileId', 'id'],
      });
      subjects.createIndex('by_profile', 'profileId');
      const outbox = current.createObjectStore('outbox', { keyPath: 'operationId' });
      outbox.createIndex('by_profile_status', ['profileId', 'status']);
      current.createObjectStore('operations', { keyPath: 'operationId' });
      const scenarios = current.createObjectStore('planning_scenarios', {
        keyPath: ['profileId', 'id'],
      });
      scenarios.createIndex('by_profile', 'profileId');
      const blocks = current.createObjectStore('planning_blocks', {
        keyPath: ['profileId', 'id'],
      });
      blocks.createIndex('by_scenario', ['profileId', 'scenarioId']);
      blocks.createIndex('by_date', ['profileId', 'civilDate']);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const transaction = database.transaction(
    ['subjects', 'outbox', 'planning_scenarios', 'planning_blocks'],
    'readwrite',
  );
  transaction.objectStore('subjects').put({
    id: 'subject-1',
    profileId,
    title: 'Direito Constitucional',
    localRevision: 1,
  });
  transaction.objectStore('outbox').put({
    operationId: 'op-f3-1',
    profileId,
    entityType: 'planning-scenario',
    entityId: 'scenario-1',
    kind: 'upsert',
    baseRevision: null,
    payload: { id: 'scenario-1' },
    schemaVersion: 1,
    status: 'PENDING',
  });
  transaction.objectStore('planning_scenarios').put({
    id: 'scenario-1',
    profileId,
    editalId: 'edital-1',
    status: 'ACTIVE',
    localRevision: 2,
  });
  transaction.objectStore('planning_blocks').put({
    id: 'block-1',
    profileId,
    scenarioId: 'scenario-1',
    civilDate: '2026-10-30',
    allocation: 'study',
    localRevision: 1,
  });
  await transactionDone(transaction);

  if (!options.keepOpen) database.close();
  return database;
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F4 IndexedDB schema upgrade', () => {
  it('f4_upgrade_v3_to_v4_is_additive_and_preserves_f3', async () => {
    await seedF3Database();

    const database = await openV2Database(profileId);
    expect(database.version).toBe(LOCAL_DB_VERSION);
    const names = [...database.objectStoreNames];
    expect(names).toEqual(
      expect.arrayContaining([
        ...F4_STORES,
        'subjects',
        'outbox',
        'operations',
        'planning_scenarios',
        'planning_blocks',
      ]),
    );

    const transaction = database.transaction(
      ['subjects', 'outbox', 'planning_scenarios', 'planning_blocks'],
      'readonly',
    );
    expect(
      await requestResult(transaction.objectStore('subjects').get([profileId, 'subject-1'])),
    ).toMatchObject({ id: 'subject-1', localRevision: 1 });
    expect(await requestResult(transaction.objectStore('outbox').count())).toBe(1);
    expect(
      await requestResult(
        transaction.objectStore('planning_scenarios').get([profileId, 'scenario-1']),
      ),
    ).toMatchObject({ id: 'scenario-1', localRevision: 2 });
    expect(
      await requestResult(
        transaction.objectStore('planning_blocks').get([profileId, 'block-1']),
      ),
    ).toMatchObject({ id: 'block-1', civilDate: '2026-10-30' });
  });

  it('fresh_db_has_f4_indexes', async () => {
    const database = await openV2Database(profileId);
    const transaction = database.transaction(
      [
        'sessions',
        'session_audit',
        'session_control',
        'session_conflicts',
        'session_habits',
        'habit_occurrences',
        'session_emergency_receipts',
      ],
      'readonly',
    );
    expect([...transaction.objectStore('sessions').indexNames]).toEqual(
      expect.arrayContaining([
        'by_profile',
        'by_profile_state',
        'by_profile_date',
        'by_profile_origin',
      ]),
    );
    expect([...transaction.objectStore('session_audit').indexNames]).toEqual(
      expect.arrayContaining(['by_profile', 'by_session']),
    );
    expect(transaction.objectStore('session_control').keyPath).toBe('profileId');
    expect([...transaction.objectStore('session_conflicts').indexNames]).toEqual(
      expect.arrayContaining(['by_profile', 'by_session', 'by_status']),
    );
    expect([...transaction.objectStore('habit_occurrences').indexNames]).toEqual(
      expect.arrayContaining(['by_profile', 'by_habit_date']),
    );
    expect(
      transaction.objectStore('habit_occurrences').index('by_habit_date').unique,
    ).toBe(true);
    expect(
      [...transaction.objectStore('session_emergency_receipts').indexNames],
    ).toEqual(expect.arrayContaining(['by_profile', 'by_operation']));
  });

  it('older_tab_blocks_upgrade_without_writes', async () => {
    const legacy = await seedF3Database({ keepOpen: true });
    const opening = openV2Database(profileId);
    try {
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(getDatabaseUpgradeState().kind).toBe('BLOCKED_UPGRADE');
      const probe = legacy.transaction('planning_scenarios', 'readonly');
      expect(await requestResult(probe.objectStore('planning_scenarios').count())).toBe(1);
      expect(legacy.version).toBe(3);
    } finally {
      legacy.close();
    }
    const upgraded = await opening;
    expect(upgraded.version).toBe(LOCAL_DB_VERSION);
    const read = upgraded.transaction(['planning_scenarios', 'sessions'], 'readonly');
    expect(await requestResult(read.objectStore('planning_scenarios').count())).toBe(1);
    expect(await requestResult(read.objectStore('sessions').count())).toBe(0);
    expect(getDatabaseUpgradeState().kind).toBe('READY');
  });
});
