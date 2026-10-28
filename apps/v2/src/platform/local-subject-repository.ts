import type { SubjectRepository } from '../application/subject-service';
import type { OutboxOperation } from '../application/sync-types';
import { applySubjectCommand, type StudySubject, type SubjectCommand } from '../domain/subject';
import { DOMAIN_SCHEMA_VERSION } from '../domain/versions';
import {
  openV2Database,
  requestResult,
  STORES,
  toLocalPersistenceError,
  transactionDone,
} from './indexeddb';

type RepositoryOptions = {
  fault?: 'abort' | 'quota' | null;
  now?: () => string;
};

export class LocalSubjectRepository implements SubjectRepository {
  private readonly fault: 'abort' | 'quota' | null;
  private readonly now: () => string;

  constructor(options: RepositoryOptions = {}) {
    this.fault = options.fault ?? null;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async execute(command: SubjectCommand): Promise<StudySubject> {
    const database = await openV2Database(command.profileId);
    const transaction = database.transaction(
      [STORES.subjects, STORES.operations, STORES.outbox],
      'readwrite',
    );

    try {
      const operations = transaction.objectStore(STORES.operations);
      const existing = (await requestResult(operations.get(command.operationId))) as
        | { subject: StudySubject }
        | undefined;

      if (existing) {
        await transactionDone(transaction);
        return existing.subject;
      }

      const subjects = transaction.objectStore(STORES.subjects);
      const current = (await requestResult(
        subjects.get([command.profileId, command.subjectId]),
      )) as StudySubject | undefined;
      const subject = applySubjectCommand(current ?? null, command);

      subjects.put(subject);

      if (this.fault === 'abort') throw new DOMException('forced abort', 'AbortError');
      if (this.fault === 'quota') throw new DOMException('forced quota', 'QuotaExceededError');

      operations.put({
        operationId: command.operationId,
        profileId: command.profileId,
        entityId: subject.id,
        type: command.type,
        subject,
        committedAt: this.now(),
      });

      const operation: OutboxOperation = {
        operationId: command.operationId,
        profileId: command.profileId,
        entityType: 'subject',
        entityId: subject.id,
        kind: 'upsert',
        baseRevision: current?.localRevision ?? null,
        payload: subject,
        schemaVersion: DOMAIN_SCHEMA_VERSION,
        status: 'PENDING',
      };
      transaction.objectStore(STORES.outbox).put(operation);

      await transactionDone(transaction);
      return subject;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      throw toLocalPersistenceError(error);
    }
  }

  async get(profileId: string, id: string): Promise<StudySubject | null> {
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.subjects, 'readonly');
    const subject = (await requestResult(
      transaction.objectStore(STORES.subjects).get([profileId, id]),
    )) as StudySubject | undefined;
    return subject ?? null;
  }

  async list(profileId: string): Promise<StudySubject[]> {
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.subjects, 'readonly');
    const index = transaction.objectStore(STORES.subjects).index('by_profile');
    const subjects = (await requestResult(index.getAll(profileId))) as StudySubject[];
    return subjects.sort((left, right) => left.title.localeCompare(right.title, 'pt-BR'));
  }
}
