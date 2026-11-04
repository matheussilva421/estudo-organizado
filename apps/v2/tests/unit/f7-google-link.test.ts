import { beforeEach, describe, expect, it } from 'vitest';
import type { ProfileRecord } from '../../src/application/profile-service';
import type { OutboxOperation } from '../../src/application/sync-types';
import { GoogleLinkService } from '../../src/application/google-link-service';
import { LocalProfileRepository } from '../../src/platform/local-profile-repository';
import {
  deleteV2DatabaseForTests,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';

const profileId = 'profile-f7';
// Keep the fake clock just behind the real clock used by assertDeliveryConsent
// while remaining inside the five-minute preview window.
const now = Date.now() - 1_000;
const identityA = { uid: 'uid-a', email: 'a@example.com' };
const identityB = { uid: 'uid-b', email: 'b@example.com' };
const remoteA = { remoteLibraryId: 'library-a', remoteCount: 3, conflictCount: 1 };
const remoteB = { remoteLibraryId: 'library-b', remoteCount: 0 };

function profile(overrides: Partial<ProfileRecord> = {}): ProfileRecord {
  return {
    profileId,
    uid: null,
    remoteLibraryId: null,
    syncEnabled: false,
    state: 'LOCAL_ONLY',
    primaryEditalId: null,
    localRevision: 0,
    ...overrides,
  };
}

function operation(overrides: Partial<OutboxOperation> = {}): OutboxOperation {
  return {
    operationId: 'op-f7-1',
    profileId,
    entityType: 'edital',
    entityId: 'edital-f7',
    kind: 'upsert',
    baseRevision: null,
    payload: { id: 'edital-f7', profileId, title: 'TJPB', status: 'ACTIVE', localRevision: 1 },
    schemaVersion: 1,
    status: 'PENDING',
    deliveryUid: 'uid-a',
    remoteLibraryId: 'library-a',
    ...overrides,
  };
}

async function seedProfile(record: ProfileRecord): Promise<void> {
  const db = await openV2Database(profileId);
  const tx = db.transaction(STORES.profiles, 'readwrite');
  tx.objectStore(STORES.profiles).put(record);
  await transactionDone(tx);
}

async function seedOperation(record: OutboxOperation): Promise<void> {
  const db = await openV2Database(profileId);
  const tx = db.transaction(STORES.outbox, 'readwrite');
  tx.objectStore(STORES.outbox).put(record);
  await transactionDone(tx);
}

async function readOperation(operationId: string): Promise<OutboxOperation | undefined> {
  const db = await openV2Database(profileId);
  const tx = db.transaction(STORES.outbox, 'readonly');
  return requestResult(tx.objectStore(STORES.outbox).get(operationId)) as Promise<
    OutboxOperation | undefined
  >;
}

function service(): GoogleLinkService {
  return new GoogleLinkService({
    profiles: new LocalProfileRepository(),
    now: () => now,
    generation: (() => {
      let n = 0;
      return () => `gen-${++n}`;
    })(),
  });
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7 Google link', () => {
  it('f7_link_requires_current_preview', async () => {
    const links = service();
    const first = await links.previewGoogleLink(profileId, identityA, remoteA);
    const second = await links.previewGoogleLink(profileId, identityA, remoteA);
    await expect(links.confirmGoogleLink(first, true)).rejects.toMatchObject({
      code: 'STALE_PREVIEW',
    });
    const linked = await links.confirmGoogleLink(second, true);
    expect(linked.uid).toBe(identityA.uid);
    expect(linked.state).toBe('READY');
  });

  it('f7_prevents_silent_profile_merge', async () => {
    await seedProfile(profile({ uid: identityA.uid, remoteLibraryId: remoteA.remoteLibraryId, state: 'READY', syncEnabled: true }));
    const links = service();
    await expect(links.previewGoogleLink(profileId, identityB, remoteB)).rejects.toMatchObject({
      code: 'PROFILE_MISMATCH',
    });
    const stored = await new LocalProfileRepository().getProfile(profileId);
    expect(stored.uid).toBe(identityA.uid);
    expect(stored.remoteLibraryId).toBe(remoteA.remoteLibraryId);
  });

  it('f7_logout_does_not_reassign_pending_ops', async () => {
    await seedProfile(profile({ uid: identityA.uid, remoteLibraryId: remoteA.remoteLibraryId, state: 'READY', syncEnabled: true }));
    await seedOperation(operation());
    const links = service();
    await links.invalidateRemoteBinding(profileId, identityA.uid);
    expect((await new LocalProfileRepository().getProfile(profileId)).uid).toBeNull();

    const review = await links.previewGoogleLink(profileId, identityB, remoteB);
    await links.confirmGoogleLink(review, true);
    const stored = await readOperation('op-f7-1');
    expect(stored?.deliveryUid).toBe(identityA.uid);
    expect(stored?.remoteLibraryId).toBe(remoteA.remoteLibraryId);
  });

  it('f7_stale_response_from_previous_uid_is_discarded', async () => {
    const links = service();
    const review = await links.previewGoogleLink(profileId, identityA, remoteA);
    await links.invalidateRemoteBinding(profileId, identityA.uid);
    await expect(links.confirmGoogleLink(review, true)).rejects.toMatchObject({
      code: 'STALE_PREVIEW',
    });
    expect((await new LocalProfileRepository().getProfile(profileId)).uid).toBeNull();
  });

  it('f7_local_mode_survives_cancel', async () => {
    await seedProfile(profile());
    await seedOperation(operation({ deliveryUid: null, remoteLibraryId: null }));
    const links = service();
    await links.previewGoogleLink(profileId, identityA, remoteA);
    const stored = await new LocalProfileRepository().getProfile(profileId);
    expect(stored.state).toBe('LOCAL_ONLY');
    expect(stored.uid).toBeNull();
    expect((await readOperation('op-f7-1'))?.deliveryUid).toBeNull();
  });
});
