import type { SubjectCommand, StudySubject } from '../domain/subject';
import type { OutboxOperation } from '../application/sync-types';
import type { CommitResult, ContentCommand } from '../application/content-commands';
import type { ContentSnapshot } from '../application/content-service';
import { LocalSubjectRepository } from './local-subject-repository';
import { LocalContentRepository } from './local-content-repository';
import {
  deleteV2DatabaseForTests,
  getDatabaseUpgradeState,
  getPendingOutbox,
  markConfirmed,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
  type ConfirmedProof,
  type DatabaseUpgradeState,
} from './indexeddb';
import { browserLockPort, withSafeFlushLock } from './sync/coordination';
import { setE2EFault, type E2EFault } from './e2e-fault';

type Fault = E2EFault;

export type V2E2EHarness = {
  resetDb: () => Promise<void>;
  seedLegacyV1: () => Promise<void>;
  releaseLegacyV1: () => void;
  legacySnapshot: () => Promise<{
    stores: string[];
    subjects: number;
    operations: number;
    outbox: number;
  }>;
  openDb: () => Promise<{ version: number; stores: string[] }>;
  upgradeState: () => DatabaseUpgradeState;
  countStore: (store: string) => Promise<number>;
  executeContent: (
    command: ContentCommand,
    fault?: Exclude<Fault, null>,
  ) => Promise<CommitResult<unknown>>;
  loadContent: (profileId: string) => Promise<ContentSnapshot>;
  contentCounts: (profileId: string) => Promise<{
    editais: number;
    links: number;
    operations: number;
    outbox: number;
  }>;
  setFault: (fault: Fault) => void;
  execute: (command: SubjectCommand) => Promise<StudySubject>;
  executeWithFault: (command: SubjectCommand, fault: Exclude<Fault, null>) => Promise<StudySubject>;
  list: (profileId: string) => Promise<StudySubject[]>;
  pending: (profileId: string) => Promise<OutboxOperation[]>;
  markConfirmed: (profileId: string, ids: string[], proof: ConfirmedProof) => Promise<void>;
  inspectCounts: (profileId: string) => Promise<{
    subjects: number;
    outbox: number;
    operations: number;
  }>;
  flushOnceShared: (
    profileId: string,
    operationId: string,
  ) => Promise<{ kind: 'EXECUTED' | 'BLOCKED' }>;
  clearRemote: (profileId: string) => void;
  readRemote: (profileId: string) => { applied: string[]; effects: number };
};

type SharedRemoteState = { applied: string[]; effects: number };

function remoteKey(profileId: string): string {
  return `v2-e2e-remote:${profileId}`;
}

function readSharedRemote(profileId: string): SharedRemoteState {
  const raw = localStorage.getItem(remoteKey(profileId));
  if (!raw) return { applied: [], effects: 0 };
  const parsed = JSON.parse(raw) as SharedRemoteState;
  return { applied: parsed.applied, effects: parsed.effects };
}

export function installE2EHarness(): void {
  if (!__V2_E2E__) return;

  let legacyConnection: IDBDatabase | null = null;

  const harness: V2E2EHarness = {
    resetDb: () => deleteV2DatabaseForTests(),
    seedLegacyV1: async () => {
      legacyConnection?.close();
      legacyConnection = null;
      await deleteV2DatabaseForTests();
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('estudo-organizado-v2', 1);
        request.onupgradeneeded = () => {
          const current = request.result;
          const subjects = current.createObjectStore('subjects', {
            keyPath: ['profileId', 'id'],
          });
          subjects.createIndex('by_profile', 'profileId', { unique: false });
          const outbox = current.createObjectStore('outbox', { keyPath: 'operationId' });
          outbox.createIndex('by_profile_status', ['profileId', 'status'], { unique: false });
          current.createObjectStore('operations', { keyPath: 'operationId' });
          current.createObjectStore('profiles', { keyPath: 'profileId' });
          current.createObjectStore('meta', { keyPath: 'key' });
          const conflicts = current.createObjectStore('conflicts', { keyPath: 'conflictId' });
          conflicts.createIndex('by_profile', 'profileId', { unique: false });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction(
        ['subjects', 'operations', 'outbox'],
        'readwrite',
      );
      transaction.objectStore('subjects').put({
        id: 'subject-legacy',
        profileId: 'local-default',
        title: 'Legado preservado',
        localRevision: 4,
      });
      transaction.objectStore('operations').put({
        operationId: 'op-legacy',
        profileId: 'local-default',
        entityId: 'subject-legacy',
        type: 'create',
        subject: {
          id: 'subject-legacy',
          profileId: 'local-default',
          title: 'Legado preservado',
          localRevision: 4,
        },
        committedAt: '2026-10-28T00:00:00.000Z',
      });
      transaction.objectStore('outbox').put({
        operationId: 'op-legacy',
        profileId: 'local-default',
        entityType: 'subject',
        entityId: 'subject-legacy',
        kind: 'upsert',
        baseRevision: 3,
        payload: {
          id: 'subject-legacy',
          profileId: 'local-default',
          title: 'Legado preservado',
          localRevision: 4,
        },
        schemaVersion: 1,
        status: 'PENDING',
      });
      await transactionDone(transaction);
      legacyConnection = database;
    },
    releaseLegacyV1: () => {
      legacyConnection?.close();
      legacyConnection = null;
    },
    legacySnapshot: async () => {
      if (!legacyConnection) throw new Error('legacy connection is not open');
      const transaction = legacyConnection.transaction(
        ['subjects', 'operations', 'outbox'],
        'readonly',
      );
      return {
        stores: [...legacyConnection.objectStoreNames].sort(),
        subjects: await requestResult(transaction.objectStore('subjects').count()),
        operations: await requestResult(transaction.objectStore('operations').count()),
        outbox: await requestResult(transaction.objectStore('outbox').count()),
      };
    },
    openDb: async () => {
      const database = await openV2Database('local-default');
      return { version: database.version, stores: [...database.objectStoreNames].sort() };
    },
    upgradeState: () => getDatabaseUpgradeState(),
    countStore: async (store: string) => {
      const database = await openV2Database('local-default');
      const transaction = database.transaction(store, 'readonly');
      return requestResult(transaction.objectStore(store).count());
    },
    executeContent: (command, fault) =>
      new LocalContentRepository({ fault: fault ?? null }).execute(command),
    loadContent: (profileId) => new LocalContentRepository().loadContent(profileId),
    contentCounts: async (profileId) => {
      const database = await openV2Database(profileId);
      const transaction = database.transaction(
        [STORES.editais, STORES.editalDisciplines, STORES.operations, STORES.outbox],
        'readonly',
      );
      return {
        editais: await requestResult(transaction.objectStore(STORES.editais).count()),
        links: await requestResult(
          transaction.objectStore(STORES.editalDisciplines).count(),
        ),
        operations: await requestResult(transaction.objectStore(STORES.operations).count()),
        outbox: await requestResult(transaction.objectStore(STORES.outbox).count()),
      };
    },
    setFault: (fault) => setE2EFault(fault),
    execute: (command) => new LocalSubjectRepository({ fault: null }).execute(command),
    executeWithFault: (command, fault) =>
      new LocalSubjectRepository({ fault }).execute(command),
    list: (profileId) => new LocalSubjectRepository().list(profileId),
    pending: (profileId) => getPendingOutbox(profileId),
    markConfirmed: (profileId, ids, proof) => markConfirmed(profileId, ids, proof),
    inspectCounts: async (profileId) => {
      const database = await openV2Database(profileId);
      const transaction = database.transaction(
        [STORES.subjects, STORES.outbox, STORES.operations],
        'readonly',
      );
      const [subjects, outbox, operations] = await Promise.all([
        requestResult(transaction.objectStore(STORES.subjects).count()),
        requestResult(transaction.objectStore(STORES.outbox).count()),
        requestResult(transaction.objectStore(STORES.operations).count()),
      ]);
      return { subjects, outbox, operations };
    },
    flushOnceShared: async (profileId, operationId) => {
      const result = await withSafeFlushLock(
        `v2-flush:${profileId}`,
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 120));
          const state = readSharedRemote(profileId);
          if (!state.applied.includes(operationId)) {
            state.applied.push(operationId);
            state.effects += 1;
            localStorage.setItem(remoteKey(profileId), JSON.stringify(state));
          }
        },
        browserLockPort(),
      );
      return result.kind === 'EXECUTED' ? { kind: 'EXECUTED' } : { kind: 'BLOCKED' };
    },
    clearRemote: (profileId) => localStorage.removeItem(remoteKey(profileId)),
    readRemote: (profileId) => readSharedRemote(profileId),
  };

  (window as Window & { __v2E2E?: V2E2EHarness }).__v2E2E = harness;
}
