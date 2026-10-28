import { beforeEach, describe, expect, it } from 'vitest';
import type {
  OutboxOperation,
  RemoteMutationPort,
  RemoteMutationResult,
} from '../../src/application/sync-types';
import {
  applyRetryPlan,
  deleteV2DatabaseForTests,
  getEligibleOutbox,
  getPendingOutbox,
  markConfirmed,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';
import { LocalContentRepository } from '../../src/platform/local-content-repository';
import { FakeRemotePort } from '../../src/platform/sync/fake-remote';
import { flushPending } from '../../src/platform/sync/flush';
import {
  classifyFailure,
  planRetry,
  RETRY_MAX_MS,
} from '../../src/platform/sync/retry-policy';

const profileId = 'profile-local';

class FlakyPort implements RemoteMutationPort {
  private remaining: number;
  private readonly remote: FakeRemotePort;
  private readonly code?: string;

  constructor(remote: FakeRemotePort, failures: number, code?: string) {
    this.remote = remote;
    this.remaining = failures;
    this.code = code;
  }

  async apply(operation: OutboxOperation): Promise<RemoteMutationResult> {
    if (this.remaining > 0) {
      this.remaining -= 1;
      const error = new Error('transient network failure');
      if (this.code) (error as Error & { code?: string }).code = this.code;
      throw error;
    }
    return this.remote.apply(operation);
  }

  lookup(operationId: string) {
    return this.remote.lookup(operationId);
  }

  lookupRevision(operationId: string) {
    return this.remote.lookupRevision(operationId);
  }
}

async function seedPendingOperation(): Promise<void> {
  const content = new LocalContentRepository();
  await content.execute({
    type: 'CREATE_EDITAL',
    operationId: 'op-edital',
    profileId,
    editalId: 'edital-1',
    title: 'TJPB 2026',
  });
}

async function setProfileState(state: string, uid: string | null): Promise<void> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.profiles, 'readwrite');
  transaction.objectStore(STORES.profiles).put({
    profileId,
    uid,
    remoteLibraryId: 'library-x',
    syncEnabled: true,
    state,
    primaryEditalId: null,
    localRevision: 1,
  });
  await transactionDone(transaction);
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F2 retry policy', () => {
  it('backoff_is_exponential_bounded_and_jittered', () => {
    expect(planRetry(1, 0, 0).delayMs).toBe(1_000);
    expect(planRetry(2, 0, 0).delayMs).toBe(2_000);
    expect(planRetry(5, 0, 0).delayMs).toBe(16_000);
    expect(planRetry(40, 0, 0).delayMs).toBe(RETRY_MAX_MS);
    expect(planRetry(1, 0, 1).delayMs).toBe(1_200);
    expect(planRetry(1, 0, 5).delayMs).toBe(1_200);
    expect(planRetry(5, 100, 0).cooldown).toBe(true);
    expect(planRetry(1, 100, 0).cooldown).toBe(false);
    expect(planRetry(1, 100, 0).terminal).toBe(false);
  });

  it('classifies_deterministic_auth_and_quota_failures', () => {
    expect(classifyFailure(new Error('offline'))).toBe('TRANSIENT');
    expect(classifyFailure(Object.assign(new Error('x'), { code: 'REMOTE_SCOPE' }))).toBe(
      'DETERMINISTIC',
    );
    expect(classifyFailure(Object.assign(new Error('x'), { code: 'DOCUMENT_BUDGET' }))).toBe(
      'DETERMINISTIC',
    );
    expect(classifyFailure(Object.assign(new Error('x'), { code: 'AUTH' }))).toBe('AUTH');
    expect(classifyFailure(Object.assign(new Error('x'), { code: 'QUOTA' }))).toBe('QUOTA');
  });

  it('sixth_transient_failure_stays_pending_and_auto_retries', async () => {
    await seedPendingOperation();
    const remote = new FakeRemotePort({ uid: 'uid-a', profileId });
    const flaky = new FlakyPort(remote, 6);
    let clock = 1_000_000;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const pending = await getEligibleOutbox(profileId, clock);
      expect(pending.length).toBe(1);
      const flush = await flushPending(pending, flaky, { now: clock, jitter: () => 0 });
      expect(flush.pending).toEqual(['op-edital']);
      expect(flush.confirmedIds).toEqual([]);
      await applyRetryPlan(profileId, flush.failures);
      clock = flush.failures[0]?.nextRetryAt ?? clock + 1;
    }

    const stored = (await getPendingOutbox(profileId))[0];
    expect(stored?.status).toBe('PENDING');
    expect(stored?.attempts).toBe(6);
    expect(stored?.nextRetryAt).toBeGreaterThan(clock - 1);

    // Inside the cooldown window nothing is retried, but nothing is discarded.
    expect(await getEligibleOutbox(profileId, clock - 1)).toEqual([]);

    const eligible = await getEligibleOutbox(profileId, clock + 1);
    expect(eligible.map((item) => item.operationId)).toEqual(['op-edital']);
    const recovered = await flushPending(eligible, remote, { now: clock + 1 });
    expect(recovered.confirmedIds).toEqual(['op-edital']);
    expect(recovered.proof['op-edital']).toBe(1);
    await markConfirmed(profileId, recovered.confirmedIds, recovered.proof);

    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.outbox, 'readonly');
    const confirmed = (await requestResult(
      transaction.objectStore(STORES.outbox).get('op-edital'),
    )) as OutboxOperation;
    await transactionDone(transaction).catch(() => undefined);
    expect(confirmed.status).toBe('CONFIRMED');
  });

  it('auth_and_quota_pause_without_retry_loop', async () => {
    await seedPendingOperation();
    const remote = new FakeRemotePort({ uid: 'uid-a', profileId });

    const authFlush = await flushPending(
      await getEligibleOutbox(profileId, 0),
      new FlakyPort(remote, 1, 'AUTH'),
      { now: 0 },
    );
    expect(authFlush.failures[0]?.reason).toBe('AUTH');
    expect(authFlush.failures[0]?.nextRetryAt).toBeNull();
    await applyRetryPlan(profileId, authFlush.failures);
    await setProfileState('PAUSED_AUTH', 'uid-a');
    expect(await getEligibleOutbox(profileId, 10_000_000)).toEqual([]);

    await setProfileState('PAUSED_QUOTA', 'uid-a');
    expect(await getEligibleOutbox(profileId, 10_000_000)).toEqual([]);
    expect((await getPendingOutbox(profileId)).length).toBe(1);
  });

  it('deterministic_scope_failure_is_not_retried', async () => {
    await seedPendingOperation();
    const remote = new FakeRemotePort({ uid: 'uid-a', profileId });
    const flush = await flushPending(
      await getEligibleOutbox(profileId, 0),
      new FlakyPort(remote, 1, 'REMOTE_SCOPE'),
      { now: 0 },
    );
    expect(flush.failures[0]).toMatchObject({ reason: 'DETERMINISTIC', nextRetryAt: null });
    await applyRetryPlan(profileId, flush.failures);
    expect((await getPendingOutbox(profileId))[0]?.status).toBe('PENDING');
  });

  it('timeout_after_apply_is_confirmed_and_never_acked_blindly', async () => {
    await seedPendingOperation();
    const remote = new FakeRemotePort({
      uid: 'uid-a',
      profileId,
      simulateTimeoutAfterApply: true,
    });
    const flush = await flushPending(await getEligibleOutbox(profileId, 0), remote, {
      now: 0,
    });
    expect(flush.pending).toEqual([]);
    expect(flush.confirmedIds).toEqual(['op-edital']);
    expect(flush.proof['op-edital']).toBe(1);
  });
});
