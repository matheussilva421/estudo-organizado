import { beforeEach, describe, expect, it } from 'vitest';
import {
  DB_NAME,
  deleteV2DatabaseForTests,
  openV2Database,
  requestResult,
  STORES,
} from '../../src/platform/indexeddb';
import { LOCAL_DB_VERSION } from '../../src/domain/versions';

const profileId = 'profile-f5';

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F5 schema', () => {
  it('opens the additive database version and creates the review stores', async () => {
    const database = await openV2Database(profileId);
    expect(database.version).toBe(6);
    expect(database.version).toBe(LOCAL_DB_VERSION);
    for (const store of [
      STORES.reviewTopics,
      STORES.reviewPolicies,
      STORES.reviewCommitments,
      STORES.reviewExecutions,
      STORES.reviewBoardEvidence,
      STORES.reviewMatches,
      STORES.reviewPriorities,
      STORES.reviewSettings,
      STORES.reviewProjections,
    ]) {
      expect(database.objectStoreNames.contains(store)).toBe(true);
    }
    expect(database.objectStoreNames.contains(STORES.sessions)).toBe(true);
    expect(database.objectStoreNames.contains(STORES.planningBlocks)).toBe(true);
    database.close();
  });

  it('upgrades a synthetic v4 database without losing session data', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 4);
      request.onupgradeneeded = () => {
        const database = request.result;
        const sessions = database.createObjectStore(STORES.sessions, {
          keyPath: ['profileId', 'id'],
        });
        sessions.createIndex('by_profile', 'profileId');
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(STORES.sessions, 'readwrite');
        transaction.objectStore(STORES.sessions).put({
          id: 'session-v4',
          profileId,
          state: 'COMPLETED',
          origin: 'TIMER',
          localRevision: 1,
          schemaVersion: 1,
          referenceZone: 'America/Fortaleza',
          planBlockIds: [],
          editalIds: [],
          intervals: [],
          note: 'preservar',
        });
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      };
    });

    const upgraded = await openV2Database(profileId);
    expect(upgraded.version).toBe(6);
    const transaction = upgraded.transaction(STORES.sessions, 'readonly');
    const preserved = (await requestResult(
      transaction.objectStore(STORES.sessions).get([profileId, 'session-v4']),
    )) as { note?: string } | undefined;
    expect(preserved?.note).toBe('preservar');
    expect(upgraded.objectStoreNames.contains(STORES.reviewTopics)).toBe(true);
    upgraded.close();
  });
});
