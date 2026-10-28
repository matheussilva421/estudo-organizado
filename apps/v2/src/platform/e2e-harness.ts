import type { SubjectCommand, StudySubject } from '../domain/subject';
import type { OutboxOperation } from '../application/sync-types';
import { LocalSubjectRepository } from './local-subject-repository';
import {
  deleteV2DatabaseForTests,
  getPendingOutbox,
  markConfirmed,
  openV2Database,
  requestResult,
  STORES,
  type ConfirmedProof,
} from './indexeddb';
import { browserLockPort, withSafeFlushLock } from './sync/coordination';

type Fault = 'abort' | 'quota' | null;

let activeFault: Fault = null;

export function getE2EFault(): Fault {
  return activeFault;
}

export type V2E2EHarness = {
  resetDb: () => Promise<void>;
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

  const harness: V2E2EHarness = {
    resetDb: () => deleteV2DatabaseForTests(),
    setFault: (fault) => {
      activeFault = fault;
    },
    execute: (command) => new LocalSubjectRepository({ fault: activeFault }).execute(command),
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
