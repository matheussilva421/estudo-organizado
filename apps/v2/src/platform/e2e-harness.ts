import type { SubjectCommand, StudySubject } from '../domain/subject';
import type { OutboxOperation } from '../application/sync-types';
import type { CommitResult, ContentCommand } from '../application/content-commands';
import type { ContentSnapshot } from '../application/content-service';
import type {
  ArchiveEditalInput,
  ArchiveEditalResult,
  ProfileRecord,
  SetPrimaryInput,
} from '../application/profile-service';
import { LocalSubjectRepository } from './local-subject-repository';
import { LocalContentRepository } from './local-content-repository';
import { LocalProfileRepository } from './local-profile-repository';
import { ImportCommitter } from './import-commit';
import { parseEditalImport, previewEditalImport } from '../application/import-service';
import type { ImportPreview, ImportReceipt } from '../application/import-types';
import {
  LocalSubjectAdoptionService,
  type AdoptionDecision,
  type AdoptionReport,
} from './content-migration';
import {
  applyRetryPlan,
  deleteV2DatabaseForTests,
  getDatabaseUpgradeState,
  getEligibleOutbox,
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
import { flushPending } from './sync/flush';
import { FakeRemotePort } from './sync/fake-remote';
import { previewLink } from '../application/sync-policy';
import { canDeliver } from './sync/delivery-policy';
import { setE2EFault, type E2EFault } from './e2e-fault';
import { LocalPlanningRepository } from './local-planning-repository';
import type {
  PlanningActivationInput,
  PlanningCommit,
  PlanningDraft,
} from '../application/planning-service';
import type {
  PlanningOutcome,
  PlanningScenario,
  PlanningScenarioSnapshot,
} from '../domain/planning';

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
  getProfile: (profileId: string) => Promise<ProfileRecord>;
  setPrimary: (input: SetPrimaryInput) => Promise<CommitResult<ProfileRecord>>;
  archiveEdital: (
    input: ArchiveEditalInput,
  ) => Promise<CommitResult<ArchiveEditalResult>>;
  listUnassigned: (profileId: string) => Promise<StudySubject[]>;
  adoptSubjects: (
    profileId: string,
    operationId: string,
    decisions: readonly AdoptionDecision[],
  ) => Promise<CommitResult<AdoptionReport>>;
  outboxRecord: (profileId: string, operationId: string) => Promise<OutboxOperation | null>;
  runFailures: (
    profileId: string,
    failures: number,
    baseNow: number,
  ) => Promise<{ attempts: number; status: string; pending: number; eligibleNow: number }>;
  reconnect: (
    profileId: string,
    now: number,
  ) => Promise<{ confirmed: string[]; status: string }>;
  previewImport: (
    profileId: string,
    namespace: string,
    text: string,
  ) => Promise<{ ok: true; preview: ImportPreview } | { ok: false; reason: string }>;
  applyImport: (
    profileId: string,
    preview: ImportPreview,
    fault?: Exclude<Fault, null>,
  ) => Promise<CommitResult<ImportReceipt>>;
  adoptAll: (
    profileId: string,
    uid: string,
    remoteLibraryId: string,
  ) => Promise<CommitResult<{ adopted: number }>>;
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
  planningCommit: (
    input: PlanningCommit,
    fault?: Exclude<Fault, null>,
  ) => Promise<PlanningOutcome<PlanningScenarioSnapshot>>;
  planningActivate: (
    input: PlanningActivationInput,
  ) => Promise<PlanningOutcome<PlanningScenarioSnapshot>>;
  planningList: (profileId: string, editalId?: string) => Promise<PlanningScenario[]>;
  planningLoad: (
    profileId: string,
    scenarioId: string,
  ) => Promise<PlanningScenarioSnapshot | null>;
  planningSaveDraft: (draft: PlanningDraft) => Promise<PlanningOutcome<PlanningDraft>>;
  planningLoadDraft: (profileId: string, scenarioId: string) => Promise<PlanningDraft | null>;
  planningCounts: (profileId: string) => Promise<{
    scenarios: number;
    blocks: number;
    drafts: number;
    checkpoints: number;
    operations: number;
    outbox: number;
  }>;
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
    getProfile: (profileId) => new LocalProfileRepository().getProfile(profileId),
    setPrimary: (input) => new LocalProfileRepository().setPrimaryEdital(input),
    archiveEdital: (input) => new LocalProfileRepository().archiveEdital(input),
    listUnassigned: (profileId) =>
      new LocalSubjectAdoptionService().listUnassignedSubjects(profileId),
    adoptSubjects: (profileId, operationId, decisions) =>
      new LocalSubjectAdoptionService().applySubjectAdoption(
        profileId,
        operationId,
        decisions,
      ),
    outboxRecord: async (profileId, operationId) => {
      const database = await openV2Database(profileId);
      const transaction = database.transaction(STORES.outbox, 'readonly');
      const record = await requestResult(
        transaction.objectStore(STORES.outbox).get(operationId),
      );
      return (record as OutboxOperation | undefined) ?? null;
    },
    runFailures: async (profileId, failures, baseNow) => {
      const remote = new FakeRemotePort({ uid: 'uid-a', profileId });
      let remaining = failures;
      const scripted = {
        apply: async (operation: OutboxOperation) => {
          if (remaining > 0) {
            remaining -= 1;
            throw new Error('transient network failure');
          }
          return remote.apply(operation);
        },
        lookup: (operationId: string) => remote.lookup(operationId),
        lookupRevision: (operationId: string) => remote.lookupRevision(operationId),
      };

      let clock = Number.isFinite(baseNow) ? baseNow : Date.now();
      const profile = await new LocalProfileRepository().getProfile(profileId);
      const authorize = (operation: OutboxOperation) =>
        canDeliver(
          operation,
          {
            operationId: operation.operationId,
            profileId: operation.profileId,
            deliveryUid: operation.deliveryUid ?? null,
            remoteLibraryId: operation.remoteLibraryId ?? null,
            attempts: operation.attempts ?? 0,
            nextRetryAt: operation.nextRetryAt ?? null,
          },
          profile,
        );
      for (let attempt = 0; attempt < failures; attempt += 1) {
        const pending = await getEligibleOutbox(profileId, clock);
        if (pending.length === 0) break;
        const flush = await flushPending(pending, scripted, {
          now: clock,
          jitter: () => 0,
          canSend: authorize,
        });
        await applyRetryPlan(profileId, flush.failures);
        clock = flush.failures[0]?.nextRetryAt ?? clock + 1;
      }
      return {
        attempts: (await harness.outboxRecord(profileId, 'op-edital'))?.attempts ?? 0,
        status: (await harness.outboxRecord(profileId, 'op-edital'))?.status ?? 'NONE',
        pending: (await getPendingOutbox(profileId)).length,
        eligibleNow: (await getEligibleOutbox(profileId, clock - 1)).length,
      };
    },
    reconnect: async (profileId, now) => {
      const remote = new FakeRemotePort({ uid: 'uid-a', profileId });
      const eligible = await getEligibleOutbox(profileId, now);
      const profile = await new LocalProfileRepository().getProfile(profileId);
      const recovered = await flushPending(eligible, remote, {
        now,
        canSend: (operation) =>
          canDeliver(
            operation,
            {
              operationId: operation.operationId,
              profileId: operation.profileId,
              deliveryUid: operation.deliveryUid ?? null,
              remoteLibraryId: operation.remoteLibraryId ?? null,
              attempts: operation.attempts ?? 0,
              nextRetryAt: operation.nextRetryAt ?? null,
            },
            profile,
          ),
      });
      await markConfirmed(profileId, recovered.confirmedIds, recovered.proof);
      const first =
        eligible[0]?.operationId ?? (await getPendingOutbox(profileId))[0]?.operationId;
      return {
        confirmed: recovered.confirmedIds,
        status: first ? ((await harness.outboxRecord(profileId, first))?.status ?? 'NONE') : 'NONE',
      };
    },
    previewImport: async (profileId, namespace, text) => {
      const parsed = parseEditalImport(text, { namespace });
      if (!parsed.ok) return { ok: false, reason: parsed.reason };
      const content = await new LocalContentRepository().loadContent(profileId);
      return { ok: true, preview: previewEditalImport(parsed.parsed, content) };
    },
    applyImport: (profileId, preview, fault) =>
      new ImportCommitter({ fault: fault ?? null }).apply(profileId, preview, {
        confirmed: true,
        targetSignature: preview.targetSignature,
      }),
    adoptAll: (profileId, uid, remoteLibraryId) =>
      new LocalProfileRepository().adoptLocalOperations(profileId, uid, remoteLibraryId, {
        profileId,
        uid,
        remoteLibraryId,
        consent: true,
        preview: previewLink(profileId, uid, { remoteCount: 0 }, Date.now()),
      }),
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
    planningCommit: (input, fault) =>
      new LocalPlanningRepository({ fault: fault ?? null }).commit(input),
    planningActivate: (input) => new LocalPlanningRepository().activateScenario(input),
    planningList: (profileId, editalId) =>
      new LocalPlanningRepository().listScenarios(profileId, editalId),
    planningLoad: (profileId, scenarioId) =>
      new LocalPlanningRepository().loadScenario(profileId, scenarioId),
    planningSaveDraft: (draft) => new LocalPlanningRepository().saveDraft(draft),
    planningLoadDraft: (profileId, scenarioId) =>
      new LocalPlanningRepository().loadDraft(profileId, scenarioId),
    planningCounts: async (profileId) => {
      const database = await openV2Database(profileId);
      const transaction = database.transaction(
        [
          STORES.planningScenarios,
          STORES.planningBlocks,
          STORES.planningDrafts,
          STORES.planningCheckpoints,
          STORES.operations,
          STORES.outbox,
        ],
        'readonly',
      );
      return {
        scenarios: await requestResult(
          transaction.objectStore(STORES.planningScenarios).count(),
        ),
        blocks: await requestResult(transaction.objectStore(STORES.planningBlocks).count()),
        drafts: await requestResult(transaction.objectStore(STORES.planningDrafts).count()),
        checkpoints: await requestResult(
          transaction.objectStore(STORES.planningCheckpoints).count(),
        ),
        operations: await requestResult(transaction.objectStore(STORES.operations).count()),
        outbox: await requestResult(transaction.objectStore(STORES.outbox).count()),
      };
    },
  };

  (window as Window & { __v2E2E?: V2E2EHarness }).__v2E2E = harness;
}
