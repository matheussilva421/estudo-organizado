import type {
  SessionOutcome,
  SessionScope,
} from '../domain/session';
import type { HabitOccurrence, StudyHabit } from '../domain/session-habits';
import { isCivilDate } from '../domain/planning-time';
import { DOMAIN_SCHEMA_VERSION } from '../domain/versions';
import {
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../platform/indexeddb';

export class LocalSessionHabitService {
  async confirmHabitOccurrence(input: {
    scope: SessionScope;
    habitId: string;
    civilDate: string;
  }): Promise<SessionOutcome<HabitOccurrence>> {
    if (
      !input ||
      !input.scope ||
      typeof input.scope.profileId !== 'string' ||
      !input.scope.profileId.trim() ||
      typeof input.habitId !== 'string' ||
      !input.habitId.trim() ||
      !isCivilDate(input.civilDate)
    ) {
      return { kind: 'INVALID', code: 'INVALID_COMMAND' };
    }
    const profileId = input.scope.profileId;
    const database = await openV2Database(profileId);
    const transaction = database.transaction(
      [STORES.sessionHabits, STORES.habitOccurrences, STORES.outbox],
      'readwrite',
    );
    try {
      const habit = (await requestResult(
        transaction
          .objectStore(STORES.sessionHabits)
          .get([profileId, input.habitId]),
      )) as StudyHabit | undefined;
      if (!habit || habit.profileId !== profileId) {
        transaction.abort();
        return { kind: 'INVALID', code: 'HABIT_NOT_FOUND' };
      }
      const id = `${input.habitId}~${input.civilDate}`;
      const occurrences = transaction.objectStore(STORES.habitOccurrences);
      const existing = (await requestResult(
        occurrences.get([profileId, id]),
      )) as HabitOccurrence | undefined;
      if (existing) {
        await transactionDone(transaction);
        return { kind: 'LOCAL_COMMITTED', value: existing };
      }
      const occurrence: HabitOccurrence = {
        id,
        habitId: input.habitId,
        profileId,
        civilDate: input.civilDate,
        confirmed: true,
        localRevision: 1,
        sourceOperationId: input.scope.operationId,
      };
      occurrences.put(occurrence);
      transaction.objectStore(STORES.outbox).put({
        operationId: `${input.scope.operationId}~habit~${id}`,
        profileId,
        entityType: 'habit-occurrence',
        entityId: id,
        kind: 'upsert',
        baseRevision: null,
        payload: occurrence,
        schemaVersion: DOMAIN_SCHEMA_VERSION,
        status: 'PENDING',
        deliveryMode: 'BLOCKED',
      });
      await transactionDone(transaction);
      return { kind: 'LOCAL_COMMITTED', value: occurrence };
    } catch {
      try {
        transaction.abort();
      } catch {
        // already aborted
      }
      return { kind: 'FAILED', reason: 'UNAVAILABLE' };
    }
  }
}
