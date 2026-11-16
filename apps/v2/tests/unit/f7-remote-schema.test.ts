import { describe, expect, it } from 'vitest';
import {
  compareRemoteChanges,
  receiptMatches,
  validateRemoteChange,
  validateRemoteEnvelope,
  validateRemoteReceipt,
  type RemoteChange,
} from '../../src/platform/sync/remote-schema';

const validEntity = {
  entityId: 'edital-1',
  entityType: 'edital',
  schemaVersion: 1,
  revision: 1,
  deleted: false,
  payload: { id: 'edital-1', profileId: 'profile-a', title: 'TJPB', status: 'ACTIVE', localRevision: 1 },
  epoch: 1,
};

const digest = 'a'.repeat(64);

describe('F7 remote schema', () => {
  it('f7_entity_under_budget', () => {
    expect(validateRemoteEnvelope(validEntity)).toEqual({ ok: true });
  });

  it('f7_rejects_giant_document_without_truncation', () => {
    const giant = {
      ...validEntity,
      payload: { ...validEntity.payload, title: 'x'.repeat(1_100_000) },
    };
    expect(validateRemoteEnvelope(giant)).toEqual({ ok: false, reason: 'OVERSIZE' });
    expect(giant.payload.title).toHaveLength(1_100_000);
  });

  it('f7_rejects_future_remote_schema_version_without_apply', () => {
    const future = { ...validEntity, schemaVersion: 99 };
    expect(validateRemoteEnvelope(future)).toEqual({ ok: false, reason: 'INVALID' });
    expect(future.payload.title).toBe('TJPB');
  });

  it('f7_receipt_binds_operation_entity_digest', () => {
    const receipt = {
      operationId: 'op-1',
      entityId: 'edital-1',
      payloadDigest: digest,
      revision: 1,
      changeSequence: 1,
    };
    expect(validateRemoteReceipt(receipt)).toEqual({ ok: true });
    expect(
      receiptMatches(receipt, { operationId: 'op-1', entityId: 'edital-1', payloadDigest: digest }),
    ).toBe(true);
    expect(
      receiptMatches(receipt, { operationId: 'op-1', entityId: 'edital-2', payloadDigest: digest }),
    ).toBe(false);
    expect(
      receiptMatches(receipt, { operationId: 'op-1', entityId: 'edital-1', payloadDigest: 'b'.repeat(64) }),
    ).toBe(false);
    expect(validateRemoteReceipt({ ...receipt, payloadDigest: 'bad' })).toEqual({
      ok: false,
      reason: 'INVALID',
    });
  });

  it('f7_changes_are_orderable', () => {
    const changes: RemoteChange[] = [
      { sequence: 2, entityId: 'b', revision: 1, deleted: false, epoch: 1 },
      { sequence: 1, entityId: 'a', revision: 1, deleted: false, epoch: 1 },
      { sequence: 2, entityId: 'a', revision: 1, deleted: false, epoch: 1 },
    ];
    expect(changes.sort(compareRemoteChanges).map((change) => `${change.sequence}:${change.entityId}`)).toEqual([
      '1:a',
      '2:a',
      '2:b',
    ]);
    expect(validateRemoteChange(changes[0])).toEqual({ ok: true });
  });

  it('f7_delete_retains_tombstone', () => {
    expect(validateRemoteEnvelope({ ...validEntity, deleted: true, payload: null })).toEqual({ ok: true });
    expect(validateRemoteEnvelope({ ...validEntity, deleted: true })).toEqual({
      ok: false,
      reason: 'TOMBSTONE_PAYLOAD',
    });
    expect(validateRemoteEnvelope({ ...validEntity, payload: null })).toEqual({
      ok: false,
      reason: 'PAYLOAD_REQUIRED',
    });
  });
});
