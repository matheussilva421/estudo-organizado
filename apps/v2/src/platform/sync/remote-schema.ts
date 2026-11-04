import type { OutboxEntityType, OutboxPayload } from '../../application/sync-types';
import { estimateRemoteEnvelopeBytes, MAX_SAFE_DOCUMENT_BYTES } from './document-budget';

export type RemoteEntity = {
  entityId: string;
  entityType: OutboxEntityType;
  schemaVersion: number;
  revision: number;
  deleted: boolean;
  payload: OutboxPayload | null;
  epoch: number;
};

export type RemoteReceipt = {
  operationId: string;
  entityId: string;
  payloadDigest: string;
  revision: number;
  changeSequence: number;
};

export type RemoteChange = {
  sequence: number;
  entityId: string;
  revision: number;
  deleted: boolean;
  epoch: number;
};

export type RemoteValidation =
  | { ok: true }
  | { ok: false; reason: 'INVALID' | 'OVERSIZE' | 'TOMBSTONE_PAYLOAD' | 'PAYLOAD_REQUIRED' };

const ID_MAX = 200;
const ENTITY_TYPE_MAX = 80;
const SCHEMA_MAX = 100;
const REVISION_MAX = 1_000_000_000;
const EPOCH_MAX = 1_000_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(record).every((key) => keys.includes(key));
}

function isId(value: unknown, max = ID_MAX): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function validateRemoteEnvelope(entity: unknown): RemoteValidation {
  if (!isRecord(entity)) return { ok: false, reason: 'INVALID' };
  if (!hasOnlyKeys(entity, ['entityId', 'entityType', 'schemaVersion', 'revision', 'deleted', 'payload', 'epoch'])) {
    return { ok: false, reason: 'INVALID' };
  }
  if (!isId(entity.entityId)) return { ok: false, reason: 'INVALID' };
  if (!isId(entity.entityType, ENTITY_TYPE_MAX)) return { ok: false, reason: 'INVALID' };
  if (!isIntegerInRange(entity.schemaVersion, 1, SCHEMA_MAX)) return { ok: false, reason: 'INVALID' };
  if (!isIntegerInRange(entity.revision, 1, REVISION_MAX)) return { ok: false, reason: 'INVALID' };
  if (typeof entity.deleted !== 'boolean') return { ok: false, reason: 'INVALID' };
  if (!isIntegerInRange(entity.epoch, 0, EPOCH_MAX)) return { ok: false, reason: 'INVALID' };

  if (entity.deleted === true) {
    if (entity.payload !== null) return { ok: false, reason: 'TOMBSTONE_PAYLOAD' };
  } else {
    if (entity.payload === null) return { ok: false, reason: 'PAYLOAD_REQUIRED' };
    if (!isRecord(entity.payload)) return { ok: false, reason: 'INVALID' };
  }

  const bytes = estimateRemoteEnvelopeBytes(entity);
  if (!Number.isFinite(bytes) || bytes > MAX_SAFE_DOCUMENT_BYTES) {
    return { ok: false, reason: 'OVERSIZE' };
  }
  return { ok: true };
}

export function validateRemoteReceipt(receipt: unknown): RemoteValidation {
  if (!isRecord(receipt)) return { ok: false, reason: 'INVALID' };
  if (!hasOnlyKeys(receipt, ['operationId', 'entityId', 'payloadDigest', 'revision', 'changeSequence'])) {
    return { ok: false, reason: 'INVALID' };
  }
  if (!isId(receipt.operationId)) return { ok: false, reason: 'INVALID' };
  if (!isId(receipt.entityId)) return { ok: false, reason: 'INVALID' };
  if (typeof receipt.payloadDigest !== 'string' || !/^[a-fA-F0-9]{64}$/.test(receipt.payloadDigest)) {
    return { ok: false, reason: 'INVALID' };
  }
  if (!isIntegerInRange(receipt.revision, 1, REVISION_MAX)) return { ok: false, reason: 'INVALID' };
  if (!isIntegerInRange(receipt.changeSequence, 1, REVISION_MAX)) return { ok: false, reason: 'INVALID' };
  return { ok: true };
}

export function receiptMatches(
  receipt: RemoteReceipt,
  expected: { operationId: string; entityId: string; payloadDigest: string },
): boolean {
  return (
    receipt.operationId === expected.operationId &&
    receipt.entityId === expected.entityId &&
    receipt.payloadDigest.toLowerCase() === expected.payloadDigest.toLowerCase()
  );
}

export function validateRemoteChange(change: unknown): RemoteValidation {
  if (!isRecord(change)) return { ok: false, reason: 'INVALID' };
  if (!hasOnlyKeys(change, ['sequence', 'entityId', 'revision', 'deleted', 'epoch'])) {
    return { ok: false, reason: 'INVALID' };
  }
  if (!isIntegerInRange(change.sequence, 1, REVISION_MAX)) return { ok: false, reason: 'INVALID' };
  if (!isId(change.entityId)) return { ok: false, reason: 'INVALID' };
  if (!isIntegerInRange(change.revision, 1, REVISION_MAX)) return { ok: false, reason: 'INVALID' };
  if (typeof change.deleted !== 'boolean') return { ok: false, reason: 'INVALID' };
  if (!isIntegerInRange(change.epoch, 0, EPOCH_MAX)) return { ok: false, reason: 'INVALID' };
  return { ok: true };
}

export function compareRemoteChanges(left: RemoteChange, right: RemoteChange): number {
  if (left.sequence !== right.sequence) return left.sequence - right.sequence;
  return left.entityId < right.entityId ? -1 : left.entityId > right.entityId ? 1 : 0;
}
