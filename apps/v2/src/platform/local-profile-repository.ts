import type {
  ArchiveEditalInput,
  ArchiveEditalResult,
  ProfileRecord,
  ProfileRepository,
  SetPrimaryInput,
} from '../application/profile-service';
import type { CommitResult } from '../application/content-commands';
import {
  applyEditalCommand,
  ContentValidationError,
  type Edital,
} from '../domain/edital';
import { DOMAIN_SCHEMA_VERSION } from '../domain/versions';
import {
  openV2Database,
  requestResult,
  STORES,
  toLocalPersistenceError,
  transactionDone,
} from './indexeddb';

type OperationRecord = {
  operationId: string;
  profileId: string;
  entityType: string;
  entityId: string;
  command: unknown;
  entity: unknown;
  committedAt: string;
};

function defaultProfile(profileId: string): ProfileRecord {
  return {
    profileId,
    uid: null,
    remoteLibraryId: null,
    syncEnabled: false,
    state: 'LOCAL_ONLY',
    primaryEditalId: null,
    localRevision: 0,
  };
}

function normalizeSetPrimary(input: SetPrimaryInput): Record<string, unknown> {
  return {
    type: 'SET_PRIMARY',
    operationId: input.operationId,
    profileId: input.profileId,
    editalId: input.editalId,
    baseRevision: input.baseRevision ?? null,
  };
}

function normalizeArchive(input: ArchiveEditalInput): Record<string, unknown> {
  return {
    type: 'ARCHIVE_EDITAL',
    operationId: input.operationId,
    profileId: input.profileId,
    editalId: input.editalId,
    replacementPrimaryId: input.replacementPrimaryId ?? null,
    replacementDecided: input.replacementPrimaryId !== undefined,
    baseRevision: input.baseRevision ?? null,
  };
}

function sameCommand(persisted: unknown, next: Record<string, unknown>): boolean {
  try {
    return JSON.stringify(persisted) === JSON.stringify(next);
  } catch {
    return false;
  }
}

export class LocalProfileRepository implements ProfileRepository {
  private readonly now: () => string;

  constructor(options: { now?: () => string } = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async getProfile(profileId: string): Promise<ProfileRecord> {
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.profiles, 'readonly');
    const stored = (await requestResult(
      transaction.objectStore(STORES.profiles).get(profileId),
    )) as ProfileRecord | undefined;
    return stored ?? defaultProfile(profileId);
  }

  async setPrimaryEdital(input: SetPrimaryInput): Promise<CommitResult<ProfileRecord>> {
    const database = await openV2Database(input.profileId);
    const transaction = database.transaction(
      [STORES.profiles, STORES.editais, STORES.operations],
      'readwrite',
    );

    try {
      const operations = transaction.objectStore(STORES.operations);
      const persisted = (await requestResult(operations.get(input.operationId))) as
        | OperationRecord
        | undefined;
      if (persisted) {
        if (
          persisted.profileId !== input.profileId ||
          persisted.entityType !== 'profile' ||
          !sameCommand(persisted.command, normalizeSetPrimary(input))
        ) {
          transaction.abort();
          return { kind: 'INVALID', code: 'OPERATION_ID_REUSED' };
        }
        await transactionDone(transaction);
        return { kind: 'LOCAL_COMMITTED', value: persisted.entity as ProfileRecord };
      }

      const profileStore = transaction.objectStore(STORES.profiles);
      const current =
        ((await requestResult(profileStore.get(input.profileId))) as ProfileRecord | undefined) ??
        defaultProfile(input.profileId);

      if (input.baseRevision !== undefined && input.baseRevision !== null) {
        if (input.baseRevision !== current.localRevision) {
          transaction.abort();
          return { kind: 'CONFLICT', current: current.primaryEditalId };
        }
      }

      if (input.editalId !== null) {
        const edital = (await requestResult(
          transaction.objectStore(STORES.editais).get([input.profileId, input.editalId]),
        )) as Edital | undefined;
        if (!edital) {
          transaction.abort();
          return { kind: 'INVALID', code: 'ENTITY_NOT_FOUND' };
        }
        if (edital.status !== 'ACTIVE') {
          transaction.abort();
          return { kind: 'INVALID', code: 'PRIMARY_ARCHIVED' };
        }
      }

      const next: ProfileRecord = {
        ...current,
        primaryEditalId: input.editalId,
        localRevision: current.localRevision + 1,
      };
      profileStore.put(next);
      operations.put({
        operationId: input.operationId,
        profileId: input.profileId,
        entityType: 'profile',
        entityId: input.profileId,
        command: normalizeSetPrimary(input),
        entity: next,
        committedAt: this.now(),
      } satisfies OperationRecord);

      await transactionDone(transaction);
      return { kind: 'LOCAL_COMMITTED', value: next };
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      return { kind: 'FAILED', reason: toLocalPersistenceError(error).kind };
    }
  }

  async archiveEdital(
    input: ArchiveEditalInput,
  ): Promise<CommitResult<ArchiveEditalResult>> {
    const database = await openV2Database(input.profileId);
    const transaction = database.transaction(
      [STORES.profiles, STORES.editais, STORES.operations, STORES.outbox],
      'readwrite',
    );

    try {
      const operations = transaction.objectStore(STORES.operations);
      const persisted = (await requestResult(operations.get(input.operationId))) as
        | OperationRecord
        | undefined;
      if (persisted) {
        if (
          persisted.profileId !== input.profileId ||
          persisted.entityType !== 'edital' ||
          !sameCommand(persisted.command, normalizeArchive(input))
        ) {
          transaction.abort();
          return { kind: 'INVALID', code: 'OPERATION_ID_REUSED' };
        }
        await transactionDone(transaction);
        return { kind: 'LOCAL_COMMITTED', value: persisted.entity as ArchiveEditalResult };
      }

      const editalStore = transaction.objectStore(STORES.editais);
      const current = (await requestResult(
        editalStore.get([input.profileId, input.editalId]),
      )) as Edital | undefined;

      let archived: Edital;
      try {
        archived = applyEditalCommand(current ?? null, {
          type: 'ARCHIVE_EDITAL',
          operationId: input.operationId,
          profileId: input.profileId,
          editalId: input.editalId,
          baseRevision: input.baseRevision ?? null,
        });
      } catch (error) {
        transaction.abort();
        if (error instanceof ContentValidationError) return { kind: 'INVALID', code: error.code };
        return { kind: 'FAILED', reason: 'UNKNOWN' };
      }

      const profileStore = transaction.objectStore(STORES.profiles);
      const currentProfile =
        ((await requestResult(profileStore.get(input.profileId))) as ProfileRecord | undefined) ??
        defaultProfile(input.profileId);

      let nextProfile = currentProfile;
      if (currentProfile.primaryEditalId === input.editalId) {
        if (input.replacementPrimaryId === undefined) {
          transaction.abort();
          return { kind: 'INVALID', code: 'PRIMARY_REQUIRED' };
        }
        if (input.replacementPrimaryId !== null) {
          if (input.replacementPrimaryId === input.editalId) {
            transaction.abort();
            return { kind: 'INVALID', code: 'PRIMARY_ARCHIVED' };
          }
          const replacement = (await requestResult(
            editalStore.get([input.profileId, input.replacementPrimaryId]),
          )) as Edital | undefined;
          if (!replacement) {
            transaction.abort();
            return { kind: 'INVALID', code: 'ENTITY_NOT_FOUND' };
          }
          if (replacement.status !== 'ACTIVE') {
            transaction.abort();
            return { kind: 'INVALID', code: 'PRIMARY_ARCHIVED' };
          }
        }
        nextProfile = {
          ...currentProfile,
          primaryEditalId: input.replacementPrimaryId,
          localRevision: currentProfile.localRevision + 1,
        };
        profileStore.put(nextProfile);
      }

      const changed = JSON.stringify(current ?? null) !== JSON.stringify(archived);
      editalStore.put(archived);

      const result: ArchiveEditalResult = { edital: archived, profile: nextProfile };
      operations.put({
        operationId: input.operationId,
        profileId: input.profileId,
        entityType: 'edital',
        entityId: input.editalId,
        command: normalizeArchive(input),
        entity: result,
        committedAt: this.now(),
      } satisfies OperationRecord);

      if (changed) {
        transaction.objectStore(STORES.outbox).put({
          operationId: input.operationId,
          profileId: input.profileId,
          entityType: 'edital',
          entityId: input.editalId,
          kind: 'upsert',
          baseRevision: current?.localRevision ?? null,
          payload: archived,
          schemaVersion: DOMAIN_SCHEMA_VERSION,
          status: 'PENDING',
        });
      }

      await transactionDone(transaction);
      return { kind: 'LOCAL_COMMITTED', value: result };
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      return { kind: 'FAILED', reason: toLocalPersistenceError(error).kind };
    }
  }
}
