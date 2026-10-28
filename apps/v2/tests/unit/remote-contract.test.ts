import { describe, expect, it } from 'vitest';
import type { OutboxOperation } from '../../src/application/sync-types';
import type { StudySubject } from '../../src/domain/subject';
import { DOMAIN_SCHEMA_VERSION } from '../../src/domain/versions';
import {
  FakeRemotePort,
  RemoteScopeError,
  TimeoutError,
} from '../../src/platform/sync/fake-remote';

const profileId = 'profile-a';
const uid = 'uid-a';

let sequence = 0;

function makeSubject(entityId: string, title: string, localRevision = 1): StudySubject {
  return { id: entityId, profileId, title, localRevision };
}

function makeOperation(overrides: Partial<OutboxOperation> = {}): OutboxOperation {
  sequence += 1;
  const entityId = overrides.entityId ?? 'subject-1';
  const baseRevision = overrides.baseRevision === undefined ? null : overrides.baseRevision;
  return {
    operationId: `op-${sequence}`,
    profileId,
    entityType: 'subject',
    entityId,
    kind: 'upsert',
    baseRevision,
    payload: makeSubject(entityId, `Disciplina ${entityId}`, (baseRevision ?? 0) + 1),
    schemaVersion: DOMAIN_SCHEMA_VERSION,
    status: 'PENDING',
    ...overrides,
  };
}

function makePort(overrides: { simulateTimeoutAfterApply?: boolean } = {}): FakeRemotePort {
  return new FakeRemotePort({ uid, profileId, ...overrides });
}

describe('FakeRemotePort CAS contract', () => {
  it('duplicate_operation_has_one_remote_effect', async () => {
    const port = makePort();
    const operation = makeOperation({ operationId: 'op-create-1' });

    expect(await port.apply(operation)).toEqual({ kind: 'APPLIED', remoteRevision: 1 });
    expect(await port.apply(operation)).toEqual({
      kind: 'ALREADY_APPLIED',
      remoteRevision: 1,
    });

    // A create at revision 1 only succeeds if the duplicate did not write again.
    const next = makeOperation({
      operationId: 'op-update-1',
      baseRevision: 1,
      payload: makeSubject('subject-1', 'Direito Administrativo', 2),
    });
    expect(await port.apply(next)).toEqual({ kind: 'APPLIED', remoteRevision: 2 });
    expect(await port.lookup('op-create-1')).toBe('APPLIED');
  });

  it('stale_base_revision_conflicts', async () => {
    const port = makePort();

    expect(
      await port.apply(makeOperation({ operationId: 'op-create-1' })),
    ).toEqual({ kind: 'APPLIED', remoteRevision: 1 });

    const stale = makeOperation({ operationId: 'op-stale', baseRevision: 0 });
    expect(await port.apply(stale)).toEqual({ kind: 'CONFLICT', remoteRevision: 1 });
    expect(await port.lookup('op-stale')).toBe('MISSING');

    // If CONFLICT had written, a CAS at revision 1 would fail here.
    const fresh = makeOperation({
      operationId: 'op-fresh',
      baseRevision: 1,
      payload: makeSubject('subject-1', 'Direito Civil', 2),
    });
    expect(await port.apply(fresh)).toEqual({ kind: 'APPLIED', remoteRevision: 2 });
  });

  it('different_entities_converge_independently', async () => {
    const port = makePort();

    expect(
      await port.apply(makeOperation({ operationId: 'op-a', entityId: 'subject-a' })),
    ).toEqual({ kind: 'APPLIED', remoteRevision: 1 });
    expect(
      await port.apply(makeOperation({ operationId: 'op-b', entityId: 'subject-b' })),
    ).toEqual({ kind: 'APPLIED', remoteRevision: 1 });

    expect(
      await port.apply(
        makeOperation({ operationId: 'op-a-stale', entityId: 'subject-a', baseRevision: 0 }),
      ),
    ).toEqual({ kind: 'CONFLICT', remoteRevision: 1 });

    // A conflict on subject-a must not block subject-b, nor its own later retry.
    expect(
      await port.apply(
        makeOperation({
          operationId: 'op-b-update',
          entityId: 'subject-b',
          baseRevision: 1,
          payload: makeSubject('subject-b', 'Direito Penal', 2),
        }),
      ),
    ).toEqual({ kind: 'APPLIED', remoteRevision: 2 });
    expect(
      await port.apply(
        makeOperation({
          operationId: 'op-a-update',
          entityId: 'subject-a',
          baseRevision: 1,
          payload: makeSubject('subject-a', 'Direito Processual', 2),
        }),
      ),
    ).toEqual({ kind: 'APPLIED', remoteRevision: 2 });
  });

  it('timeout_after_commit_is_lookup_visible', async () => {
    const port = makePort({ simulateTimeoutAfterApply: true });
    const operation = makeOperation({ operationId: 'op-timeout' });

    await expect(port.apply(operation)).rejects.toBeInstanceOf(TimeoutError);
    expect(await port.lookup('op-timeout')).toBe('APPLIED');
    expect(await port.apply(operation)).toEqual({
      kind: 'ALREADY_APPLIED',
      remoteRevision: 1,
    });
  });

  it('wrong_uid_rejected', async () => {
    const port = makePort();
    const operation = makeOperation({ operationId: 'op-uid' });

    port.signInAs('uid-intruder');
    await expect(port.apply(operation)).rejects.toBeInstanceOf(RemoteScopeError);
    expect(await port.lookup('op-uid')).toBe('MISSING');

    port.signInAs(uid);
    expect(await port.apply(operation)).toEqual({ kind: 'APPLIED', remoteRevision: 1 });
  });

  it('wrong_profile_rejected', async () => {
    const port = makePort();
    const foreign = makeOperation({ operationId: 'op-foreign', profileId: 'profile-b' });

    await expect(port.apply(foreign)).rejects.toBeInstanceOf(RemoteScopeError);
    expect(await port.lookup('op-foreign')).toBe('MISSING');
  });
});
