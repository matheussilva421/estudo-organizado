import type { Firestore } from 'firebase/firestore';
import type {
  OutboxOperation,
  RemoteMutationPort,
  RemoteMutationResult,
} from '../../application/sync-types';
import {
  validateRemoteEnvelope,
  type RemoteChange,
  type RemoteEntity,
  type RemoteReceipt,
} from './remote-schema';
import { validateRemoteChange } from './remote-schema';
import type { RemoteChangePage, RemoteChangePort } from './change-feed';

export type RemoteHead = { epoch: number; changeSequence: number };

export type RemoteSnapshot = {
  receipt: RemoteReceipt | null;
  entity: RemoteEntity | null;
  head: RemoteHead | null;
};

export type RemoteMutationPlan =
  | {
      kind: 'APPLIED';
      remoteRevision: number;
      entity: RemoteEntity;
      receipt: RemoteReceipt;
      change: RemoteChange;
      head: RemoteHead;
    }
  | { kind: 'ALREADY_APPLIED'; remoteRevision: number }
  | { kind: 'CONFLICT'; remoteRevision: number; remote: RemoteEntity | null }
  | { kind: 'INVALID'; reason: string };

export class RemoteOperationError extends Error {
  readonly code = 'REMOTE_OPERATION';

  constructor(message: string) {
    super(message);
    this.name = 'RemoteOperationError';
  }
}

export type FirestoreTransactionPort = {
  get(path: string): Promise<unknown | null>;
  set(path: string, value: unknown): void;
};

export type FirestorePort = {
  runTransaction<T>(task: (transaction: FirestoreTransactionPort) => Promise<T>): Promise<T>;
  get(path: string): Promise<unknown | null>;
  getFresh?(path: string): Promise<unknown | null>;
  /** Full collection read used only by a verified recovery snapshot. */
  list?(path: string): Promise<unknown[]>;
  listFresh?(path: string): Promise<unknown[]>;
  query?(
    path: string,
    options: { field: string; operator: '>'; value: number; orderBy: string; limit: number },
  ): Promise<unknown[]>;
};

export type RecoverySnapshotResult =
  | {
    kind: 'OK';
    entities: RemoteEntity[];
    epoch: number;
    head: number;
    /** A full snapshot replaces history; no old change replay is required. */
    historyFloor: number;
    historyMode: 'SNAPSHOT_ONLY';
    capturedAt: string;
  }
  | { kind: 'STALE' | 'UNSUPPORTED' | 'INVALID'; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'string') return JSON.stringify(value);
  // JSON.stringify drops undefined object properties and turns undefined array
  // slots into null. The canonical form must do the same so a checksum of the
  // live snapshot survives encrypt/JSON.stringify/parse/decrypt.
  if (type === 'undefined' || type === 'function' || type === 'symbol') return 'null';
  if (type === 'bigint') throw new RemoteOperationError('BigInt is not JSON-serializable');
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => {
      const item = record[key];
      return item !== undefined && typeof item !== 'function' && typeof item !== 'symbol';
    })
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

export async function digestPayload(payload: unknown): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new RemoteOperationError('Web Crypto SHA-256 is unavailable');
  const bytes = new TextEncoder().encode(canonicalJson(payload));
  const digest = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requireId(value: unknown, label: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new RemoteOperationError(`${label} is required`);
  return normalized;
}

function requireScope(operation: OutboxOperation): {
  profileId: string;
  uid: string;
  libraryId: string;
  entityId: string;
  operationId: string;
} {
  if (operation.deliveryMode === 'BLOCKED') {
    throw new RemoteOperationError('blocked operations never reach the remote adapter');
  }
  return {
    profileId: requireId(operation.profileId, 'profileId'),
    uid: requireId(operation.deliveryUid, 'deliveryUid'),
    libraryId: requireId(operation.remoteLibraryId, 'remoteLibraryId'),
    entityId: requireId(operation.entityId, 'entityId'),
    operationId: requireId(operation.operationId, 'operationId'),
  };
}

function asReceipt(value: unknown): RemoteReceipt | null {
  return isRecord(value) && typeof value.operationId === 'string' ? (value as RemoteReceipt) : null;
}

function asEntity(value: unknown): RemoteEntity | null {
  return isRecord(value) && typeof value.entityId === 'string' ? (value as RemoteEntity) : null;
}

function asHead(value: unknown): RemoteHead | null {
  if (!isRecord(value)) return null;
  if (typeof value.epoch !== 'number' || typeof value.changeSequence !== 'number') return null;
  return { epoch: value.epoch, changeSequence: value.changeSequence };
}

/** Pure planner; the Firestore transaction only supplies the current snapshot. */
export async function planRemoteMutation(
  operation: OutboxOperation,
  snapshot: RemoteSnapshot,
): Promise<RemoteMutationPlan> {
  const scope = requireScope(operation);
  const digest = await digestPayload(operation.payload);
  const receipt = asReceipt(snapshot.receipt);
  if (receipt) {
    if (receipt.entityId !== scope.entityId) {
      return { kind: 'INVALID', reason: 'operationId was already applied to another entity' };
    }
    if (receipt.payloadDigest.toLowerCase() !== digest) {
      return { kind: 'INVALID', reason: 'operationId was reused with a different payload' };
    }
    return { kind: 'ALREADY_APPLIED', remoteRevision: receipt.revision };
  }

  const entity = asEntity(snapshot.entity);
  const currentRevision = entity?.revision ?? 0;
  const baseRevision =
    operation.remoteBaseRevision !== undefined && operation.remoteBaseRevision !== null
      ? operation.remoteBaseRevision
      : operation.baseRevision ?? 0;
  if (!Number.isInteger(baseRevision) || baseRevision < 0) {
    return { kind: 'INVALID', reason: 'baseRevision must be a non-negative integer' };
  }
  if (baseRevision !== currentRevision) {
    return { kind: 'CONFLICT', remoteRevision: currentRevision, remote: entity };
  }

  const head = asHead(snapshot.head);
  const epoch = head?.epoch ?? entity?.epoch ?? 0;
  if (!Number.isInteger(epoch) || epoch < 0) {
    return { kind: 'INVALID', reason: 'epoch must be a non-negative integer' };
  }
  const changeSequence = (head?.changeSequence ?? 0) + 1;
  if (!Number.isInteger(changeSequence) || changeSequence < 1) {
    return { kind: 'INVALID', reason: 'changeSequence is invalid' };
  }
  const remoteRevision = currentRevision + 1;
  const deleted = operation.kind === 'delete';
  const nextEntity: RemoteEntity = {
    entityId: scope.entityId,
    entityType: operation.entityType,
    schemaVersion: operation.schemaVersion,
    revision: remoteRevision,
    deleted,
    payload: deleted ? null : operation.payload,
    epoch,
  };
  const validation = validateRemoteEnvelope(nextEntity);
  if (!validation.ok) return { kind: 'INVALID', reason: validation.reason };

  if (!deleted) {
    const payload = operation.payload as { id?: unknown; profileId?: unknown } | null;
    if (!isRecord(payload) || payload.id !== scope.entityId || payload.profileId !== scope.profileId) {
      return { kind: 'INVALID', reason: 'payload profile or entity does not match the operation' };
    }
  }

  return {
    kind: 'APPLIED',
    remoteRevision,
    entity: nextEntity,
    receipt: {
      operationId: scope.operationId,
      entityId: scope.entityId,
      payloadDigest: digest,
      revision: remoteRevision,
      changeSequence,
    },
    change: {
      sequence: changeSequence,
      entityId: scope.entityId,
      revision: remoteRevision,
      deleted,
      epoch,
    },
    head: { epoch, changeSequence },
  };
}

export type FirebaseRemotePortOptions = {
  uid: string;
  remoteLibraryId: string;
  profileId: string;
  store: FirestorePort;
};

/** Firestore adapter for one authenticated uid/library scope. */
export class FirebaseRemotePort implements RemoteMutationPort, RemoteChangePort {
  private readonly uid: string;
  private readonly libraryId: string;
  private readonly profileId: string;
  private readonly store: FirestorePort;

  constructor(options: FirebaseRemotePortOptions) {
    this.uid = requireId(options.uid, 'uid');
    this.libraryId = requireId(options.remoteLibraryId, 'remoteLibraryId');
    this.profileId = requireId(options.profileId, 'profileId');
    this.store = options.store;
  }

  private path(collection: string, id: string): string {
    return `users/${this.uid}/libraries/${this.libraryId}/${collection}/${id}`;
  }

  private collectionPath(collection: string): string {
    return `users/${this.uid}/libraries/${this.libraryId}/${collection}`;
  }

  private assertScope(operation: OutboxOperation): void {
    const scope = requireScope(operation);
    if (scope.uid !== this.uid || scope.libraryId !== this.libraryId || scope.profileId !== this.profileId) {
      throw new RemoteOperationError('operation is outside the authenticated uid/library scope');
    }
  }

  async apply(operation: OutboxOperation): Promise<RemoteMutationResult> {
    this.assertScope(operation);
    const plan = await this.store.runTransaction(async (transaction) => {
      const receipt = await transaction.get(this.path('operations', operation.operationId));
      const entity = await transaction.get(this.path('entities', operation.entityId));
      const head = await transaction.get(this.path('meta', 'head'));
      const next = await planRemoteMutation(operation, {
        receipt: asReceipt(receipt),
        entity: asEntity(entity),
        head: asHead(head),
      });
      if (next.kind === 'APPLIED') {
        transaction.set(this.path('entities', operation.entityId), { ...next.entity, uid: this.uid });
        transaction.set(this.path('operations', operation.operationId), {
          ...next.receipt,
          uid: this.uid,
        });
        transaction.set(this.path('changes', String(next.change.sequence)), {
          ...next.change,
          uid: this.uid,
        });
        transaction.set(this.path('meta', 'head'), { ...next.head, uid: this.uid });
      }
      return next;
    });

    if (plan.kind === 'INVALID') throw new RemoteOperationError(plan.reason);
    if (plan.kind === 'CONFLICT') {
      return {
        kind: 'CONFLICT',
        remoteRevision: plan.remoteRevision,
        ...(plan.remote
          ? {
            remote: {
              payload: plan.remote.payload,
              deleted: plan.remote.deleted,
              epoch: plan.remote.epoch,
            },
          }
          : {}),
      };
    }
    if (plan.kind === 'ALREADY_APPLIED') {
      return { kind: 'ALREADY_APPLIED', remoteRevision: plan.remoteRevision };
    }
    return { kind: 'APPLIED', remoteRevision: plan.remoteRevision };
  }

  async lookup(
    operationId: string,
    entityId?: string,
    payloadDigest?: string,
  ): Promise<'APPLIED' | 'MISSING' | 'UNKNOWN' | 'MISMATCH'> {
    try {
      const receipt = asReceipt(await this.store.get(this.path('operations', operationId)));
      if (!receipt) return 'MISSING';
      if (entityId !== undefined && receipt.entityId !== entityId) return 'MISMATCH';
      if (
        payloadDigest !== undefined &&
        receipt.payloadDigest.toLowerCase() !== payloadDigest.toLowerCase()
      ) {
        return 'MISMATCH';
      }
      return 'APPLIED';
    } catch {
      return 'UNKNOWN';
    }
  }

  async lookupRevision(operationId: string): Promise<number | null> {
    try {
      const receipt = asReceipt(await this.store.get(this.path('operations', operationId)));
      return receipt?.revision ?? null;
    } catch {
      return null;
    }
  }

  async listAfter(
    uid: string,
    libraryId: string,
    epoch: number,
    cursor: number,
    limit: number,
  ): Promise<RemoteChangePage> {
    if (uid !== this.uid || libraryId !== this.libraryId) {
      return { changes: [], head: 0, epoch };
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new RemoteOperationError('change limit must be between 1 and 200');
    }
    const head = asHead(await this.store.get(this.path('meta', 'head')));
    const pageEpoch = head?.epoch ?? 0;
    if (epoch !== pageEpoch) return { changes: [], head: head?.changeSequence ?? 0, epoch: pageEpoch };
    if (!this.store.query) throw new RemoteOperationError('change queries are unavailable');
    const rows = await this.store.query(this.collectionPath('changes'), {
      field: 'sequence',
      operator: '>',
      value: cursor,
      orderBy: 'sequence',
      limit,
    });
    const changes: RemoteChange[] = [];
    for (const row of rows) {
      if (!isRecord(row)) throw new RemoteOperationError('invalid remote change document');
      const change: RemoteChange = {
        sequence: row.sequence as number,
        entityId: row.entityId as string,
        revision: row.revision as number,
        deleted: row.deleted as boolean,
        epoch: row.epoch as number,
      };
      const validation = validateRemoteChange(change);
      if (!validation.ok || change.epoch !== pageEpoch) {
        throw new RemoteOperationError('remote change is outside the current epoch');
      }
      changes.push(change);
    }
    return { changes, head: head?.changeSequence ?? 0, epoch: pageEpoch };
  }

  async readEntity(uid: string, libraryId: string, id: string): Promise<RemoteEntity | null> {
    if (uid !== this.uid || libraryId !== this.libraryId) return null;
    const value = asEntity(await this.store.get(this.path('entities', id)));
    if (!value) return null;
    // Firestore Rules require the owner uid in the document, while the local
    // schema deliberately validates only the canonical envelope fields.
    const entity = { ...value } as RemoteEntity & { uid?: string };
    delete entity.uid;
    return entity;
  }

  /**
   * Captures a complete, stable view of entities plus the head. The head is
   * read before and after the collection; a concurrent write makes the
   * capture STALE instead of producing a mixed snapshot.
   */
  async captureRecoverySnapshot(
    uid: string,
    libraryId: string,
  ): Promise<RecoverySnapshotResult> {
    if (uid !== this.uid || libraryId !== this.libraryId) {
      return { kind: 'INVALID', reason: 'IDENTITY_MISMATCH' };
    }
    if (!this.store.list) return { kind: 'UNSUPPORTED', reason: 'LIST_UNAVAILABLE' };
    try {
      const getHead = this.store.getFresh
        ? (path: string) => this.store.getFresh!(path)
        : (path: string) => this.store.get(path);
      const listEntities = this.store.listFresh
        ? (path: string) => this.store.listFresh!(path)
        : (path: string) => this.store.list!(path);
      const beforeHead = asHead(
        await getHead(this.path('meta', 'head')),
      );
      const rows = await listEntities(this.collectionPath('entities'));
      if (!beforeHead && rows.length > 0) {
        return { kind: 'INVALID', reason: 'HEAD_REQUIRED' };
      }
      const before = beforeHead ?? { epoch: 0, changeSequence: 0 };
      const entities: RemoteEntity[] = [];
      const seen = new Set<string>();
      for (const row of rows) {
        if (!isRecord(row)) return { kind: 'INVALID', reason: 'ENTITY_FORMAT' };
        const copy = { ...row };
        delete copy.uid;
        const validation = validateRemoteEnvelope(copy);
        if (!validation.ok) return { kind: 'INVALID', reason: validation.reason };
        const entity = copy as RemoteEntity;
        if (seen.has(entity.entityId)) {
          return { kind: 'INVALID', reason: 'DUPLICATE_ENTITY' };
        }
        seen.add(entity.entityId);
        if (entity.epoch > before.epoch) {
          return { kind: 'INVALID', reason: 'ENTITY_EPOCH_AHEAD' };
        }
        entities.push(entity);
      }
      const afterHead = asHead(
        await getHead(this.path('meta', 'head')),
      );
      if (!afterHead && rows.length > 0) {
        return { kind: 'INVALID', reason: 'HEAD_REQUIRED' };
      }
      const after = afterHead ?? { epoch: 0, changeSequence: 0 };
      if (
        after.epoch !== before.epoch ||
        after.changeSequence !== before.changeSequence
      ) {
        return { kind: 'STALE', reason: 'HEAD_CHANGED_DURING_CAPTURE' };
      }
      return {
        kind: 'OK',
        entities,
        epoch: before.epoch,
        head: before.changeSequence,
        historyFloor: before.changeSequence,
        historyMode: 'SNAPSHOT_ONLY',
        capturedAt: new Date().toISOString(),
      };
    } catch {
      return { kind: 'INVALID', reason: 'SNAPSHOT_READ_FAILED' };
    }
  }
}

/** Creates the production Firestore transaction port for an injected database. */
export async function createFirestorePort(db: Firestore): Promise<FirestorePort> {
  const {
    collection,
    doc,
    getDoc,
    getDocFromServer,
    getDocs,
    getDocsFromServer,
    limit,
    orderBy,
    query,
    runTransaction,
    where,
  } = await import('firebase/firestore');
  return {
    async runTransaction<T>(task: (transaction: FirestoreTransactionPort) => Promise<T>): Promise<T> {
      return runTransaction(db, async (transaction) =>
        task({
          async get(path) {
            const snapshot = await transaction.get(doc(db, path));
            return snapshot.exists() ? snapshot.data() : null;
          },
          set(path, value) {
            transaction.set(doc(db, path), value);
          },
        }),
      );
    },
    async get(path) {
      const snapshot = await getDoc(doc(db, path));
      return snapshot.exists() ? snapshot.data() : null;
    },
    async getFresh(path) {
      const snapshot = await getDocFromServer(doc(db, path));
      return snapshot.exists() ? snapshot.data() : null;
    },
    async list(path) {
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs.map((item) => item.data());
    },
    async listFresh(path) {
      const snapshot = await getDocsFromServer(collection(db, path));
      return snapshot.docs.map((item) => item.data());
    },
    async query(path, options) {
      const target = query(
        collection(db, path),
        where(options.field, options.operator, options.value),
        orderBy(options.orderBy),
        limit(options.limit),
      );
      const snapshot = await getDocs(target);
      return snapshot.docs.map((item) => item.data());
    },
  };
}
