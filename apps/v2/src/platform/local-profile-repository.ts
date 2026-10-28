import type {
  ArchiveEditalInput,
  ArchiveEditalResult,
  ProfileRecord,
  ProfileRepository,
  SetPrimaryInput,
} from '../application/profile-service';
import { createDefaultProfile } from '../application/profile-service';
import type { CommitResult } from '../application/content-commands';
import type { Edital } from '../domain/edital';
import {
  openV2Database,
  requestResult,
  STORES,
  toLocalPersistenceError,
  transactionDone,
} from './indexeddb';
import { LocalContentRepository } from './local-content-repository';

type OperationRecord = {
  operationId: string;
  profileId: string;
  entityType: string;
  entityId: string;
  command: unknown;
  entity: unknown;
  committedAt: string;
};

function normalizeSetPrimary(input: SetPrimaryInput): Record<string, unknown> {
  return {
    type: 'SET_PRIMARY',
    operationId: input.operationId,
    profileId: input.profileId,
    editalId: input.editalId,
    baseRevision: input.baseRevision ?? null,
  };
}

export class LocalProfileRepository implements ProfileRepository {
  private readonly now: () => string;
  private readonly content: LocalContentRepository;

  constructor(
    options: {
      now?: () => string;
      content?: LocalContentRepository;
    } = {},
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.content = options.content ?? new LocalContentRepository({ now: this.now });
  }

  async getProfile(profileId: string): Promise<ProfileRecord> {
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.profiles, 'readonly');
    const stored = (await requestResult(
      transaction.objectStore(STORES.profiles).get(profileId),
    )) as ProfileRecord | undefined;
    return stored ?? createDefaultProfile(profileId);
  }

  async setPrimaryEdital(input: SetPrimaryInput): Promise<CommitResult<ProfileRecord>> {
    let database: IDBDatabase;
    try {
      database = await openV2Database(input.profileId);
    } catch (error) {
      return { kind: 'FAILED', reason: toLocalPersistenceError(error).kind };
    }

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
        const expected = normalizeSetPrimary(input);
        const matches =
          persisted.profileId === input.profileId &&
          persisted.entityType === 'profile' &&
          JSON.stringify(persisted.command) === JSON.stringify(expected);
        if (!matches) {
          transaction.abort();
          return { kind: 'INVALID', code: 'OPERATION_ID_REUSED' };
        }
        await transactionDone(transaction);
        return { kind: 'LOCAL_COMMITTED', value: persisted.entity as ProfileRecord };
      }

      const profileStore = transaction.objectStore(STORES.profiles);
      const current =
        ((await requestResult(profileStore.get(input.profileId))) as ProfileRecord | undefined) ??
        createDefaultProfile(input.profileId);

      if (input.baseRevision !== undefined && input.baseRevision !== null) {
        if (input.baseRevision !== current.localRevision) {
          transaction.abort();
          return { kind: 'CONFLICT', current };
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

  /**
   * Archiving lives in the single content commit path so the primary-edital
   * decision and the edital revision are enforced in the same transaction.
   */
  async archiveEdital(
    input: ArchiveEditalInput,
  ): Promise<CommitResult<ArchiveEditalResult>> {
    if (!input.operationId.trim()) return { kind: 'INVALID', code: 'IDENTIFIER_REQUIRED' };

    const result = await this.content.execute({
      type: 'ARCHIVE_EDITAL',
      operationId: input.operationId,
      profileId: input.profileId,
      editalId: input.editalId,
      replacementPrimaryId: input.replacementPrimaryId,
      baseRevision: input.baseRevision ?? null,
    });
    if (result.kind !== 'LOCAL_COMMITTED') return result;

    const profile = await this.getProfile(input.profileId);
    return {
      kind: 'LOCAL_COMMITTED',
      value: { edital: result.value as Edital, profile },
    };
  }
}
