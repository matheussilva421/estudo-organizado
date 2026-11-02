import { beforeEach, describe, expect, it } from 'vitest';
import { deleteV2DatabaseForTests, openV2Database, STORES } from '../../src/platform/indexeddb';
import { LOCAL_DB_VERSION } from '../../src/domain/versions';

const profileId = 'profile-f5';

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F5 schema', () => {
  it('opens the additive database version and creates the review stores', async () => {
    const database = await openV2Database(profileId);
    expect(database.version).toBe(5);
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
    ]) {
      expect(database.objectStoreNames.contains(store)).toBe(true);
    }
    expect(database.objectStoreNames.contains(STORES.sessions)).toBe(true);
    expect(database.objectStoreNames.contains(STORES.planningBlocks)).toBe(true);
    database.close();
  });
});
