import { beforeEach, describe, expect, it } from 'vitest';
import type { OutboxOperation } from '../../src/application/sync-types';
import type { ProfileRecord } from '../../src/application/profile-service';
import { previewLink } from '../../src/application/sync-policy';
import { canDeliver, type DeliveryBinding } from '../../src/platform/sync/delivery-policy';
import { deleteV2DatabaseForTests, getPendingOutbox } from '../../src/platform/indexeddb';
import { LocalContentRepository } from '../../src/platform/local-content-repository';
import { LocalProfileRepository } from '../../src/platform/local-profile-repository';
import { LocalSubjectRepository } from '../../src/platform/local-subject-repository';

const profileId = 'profile-local';
const now = Date.now();

function profile(overrides: Partial<ProfileRecord> = {}): ProfileRecord {
  return {
    profileId,
    uid: 'uid-a',
    remoteLibraryId: 'library-x',
    syncEnabled: true,
    state: 'READY',
    primaryEditalId: null,
    localRevision: 2,
    ...overrides,
  };
}

function binding(overrides: Partial<DeliveryBinding> = {}): DeliveryBinding {
  return {
    operationId: 'op-1',
    profileId,
    deliveryUid: 'uid-a',
    remoteLibraryId: 'library-x',
    attempts: 0,
    nextRetryAt: null,
    ...overrides,
  };
}

function operation(overrides: Partial<OutboxOperation> = {}): OutboxOperation {
  return {
    operationId: 'op-1',
    profileId,
    entityType: 'edital',
    entityId: 'edital-1',
    kind: 'upsert',
    baseRevision: null,
    payload: {
      id: 'edital-1',
      profileId,
      title: 'TJPB 2026',
      status: 'ACTIVE',
      localRevision: 1,
    },
    schemaVersion: 1,
    status: 'PENDING',
    deliveryUid: 'uid-a',
    remoteLibraryId: 'library-x',
    ...overrides,
  };
}

async function consent(uid: string, library: string) {
  return {
    profileId,
    uid,
    remoteLibraryId: library,
    consent: true as const,
    preview: previewLink(profileId, uid, { remoteCount: 0 }, now),
  };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F2 delivery identity', () => {
  it('wrong_uid_denied_same_uid_different_local_profile_allowed', () => {
    expect(canDeliver(operation(), binding(), profile())).toBe(true);
    expect(canDeliver(operation(), binding({ deliveryUid: 'uid-b' }), profile())).toBe(false);
    expect(canDeliver(operation({ deliveryUid: 'uid-b' }), binding(), profile())).toBe(false);
    expect(canDeliver(operation(), binding(), profile({ uid: 'uid-b' }))).toBe(false);
    expect(
      canDeliver(operation(), binding(), profile({ remoteLibraryId: 'library-y' })),
    ).toBe(false);

    // Two local profiles of the same account share the consented library.
    const otherDevice = profile({ profileId: 'profile-other-device', localRevision: 1 });
    const otherOperation = operation({ profileId: 'profile-other-device' });
    const otherBinding = binding({ profileId: 'profile-other-device' });
    expect(canDeliver(otherOperation, otherBinding, otherDevice)).toBe(true);
    // ...but an operation never crosses local profiles.
    expect(canDeliver(otherOperation, otherBinding, profile())).toBe(false);
  });

  it('local_only_command_is_immutable_and_not_sent', async () => {
    const subjects = new LocalSubjectRepository();
    await subjects.execute({
      operationId: 'op-subject',
      profileId,
      subjectId: 'subject-1',
      type: 'create',
      title: 'Direito Constitucional',
    });

    const before = (await getPendingOutbox(profileId))[0];
    expect(before?.deliveryUid ?? null).toBeNull();
    expect(canDeliver(before!, binding({ deliveryUid: null }), profile({ uid: null, state: 'LOCAL_ONLY', syncEnabled: false, remoteLibraryId: null }))).toBe(false);

    const profiles = new LocalProfileRepository();
    const adopted = await profiles.adoptLocalOperations(
      profileId,
      'uid-a',
      'library-x',
      await consent('uid-a', 'library-x'),
    );
    expect(adopted).toMatchObject({ kind: 'LOCAL_COMMITTED', value: { adopted: 1 } });

    const after = (await getPendingOutbox(profileId))[0];
    expect(after?.operationId).toBe(before?.operationId);
    expect(after?.payload).toEqual(before?.payload);
    expect(after?.baseRevision).toBe(before?.baseRevision);
    expect(after?.deliveryUid).toBe('uid-a');
    expect(after?.remoteLibraryId).toBe('library-x');
    expect(
      canDeliver(after!, binding({ operationId: after!.operationId }), await profiles.getProfile(profileId)),
    ).toBe(true);
  });

  it('logout_rebind_does_not_transfer_old_operations', async () => {
    const subjects = new LocalSubjectRepository();
    await subjects.execute({
      operationId: 'op-subject-a',
      profileId,
      subjectId: 'subject-1',
      type: 'create',
      title: 'Direito Constitucional',
    });

    const profiles = new LocalProfileRepository();
    await profiles.adoptLocalOperations(
      profileId,
      'uid-a',
      'library-x',
      await consent('uid-a', 'library-x'),
    );
    await profiles.logoutRemote(profileId, 'op-logout');
    expect((await profiles.getProfile(profileId)).uid).toBeNull();

    const bound = (await getPendingOutbox(profileId)).find(
      (item) => item.operationId === 'op-subject-a',
    );
    expect(bound?.deliveryUid).toBe('uid-a');
    expect(
      canDeliver(bound!, binding({ operationId: 'op-subject-a' }), await profiles.getProfile(profileId)),
    ).toBe(false);

    await profiles.adoptLocalOperations(
      profileId,
      'uid-b',
      'library-z',
      await consent('uid-b', 'library-z'),
    );
    const afterRebind = (await getPendingOutbox(profileId)).find(
      (item) => item.operationId === 'op-subject-a',
    );
    expect(afterRebind?.deliveryUid).toBe('uid-a');
    expect(
      canDeliver(
        afterRebind!,
        binding({ operationId: 'op-subject-a', deliveryUid: 'uid-a', remoteLibraryId: 'library-x' }),
        await profiles.getProfile(profileId),
      ),
    ).toBe(false);
  });

  it('consent_preview_must_match_profile_uid_and_clock', async () => {
    const profiles = new LocalProfileRepository();
    const expired = {
      ...(await consent('uid-a', 'library-x')),
      preview: previewLink(profileId, 'uid-a', { remoteCount: 0 }, now - 10 * 60_000, 1000),
    };
    expect(
      await profiles.adoptLocalOperations(profileId, 'uid-a', 'library-x', expired as never),
    ).toEqual({ kind: 'INVALID', code: 'INVALID_COMMAND' });

    const wrongProfile = {
      ...(await consent('uid-a', 'library-x')),
      profileId: 'other-profile',
    };
    expect(
      await profiles.adoptLocalOperations(profileId, 'uid-a', 'library-x', wrongProfile),
    ).toEqual({ kind: 'INVALID', code: 'PROFILE_MISMATCH' });
  });

  it('content_operations_also_carry_delivery_metadata_after_adoption', async () => {
    const content = new LocalContentRepository();
    await content.execute({
      type: 'CREATE_EDITAL',
      operationId: 'op-edital',
      profileId,
      editalId: 'edital-1',
      title: 'TJPB 2026',
    });

    const profiles = new LocalProfileRepository();
    const adopted = await profiles.adoptLocalOperations(
      profileId,
      'uid-a',
      'library-x',
      await consent('uid-a', 'library-x'),
    );
    expect(adopted).toMatchObject({ kind: 'LOCAL_COMMITTED', value: { adopted: 1 } });
    const pending = await getPendingOutbox(profileId);
    expect(pending.every((item) => item.deliveryUid === 'uid-a')).toBe(true);
  });
});
