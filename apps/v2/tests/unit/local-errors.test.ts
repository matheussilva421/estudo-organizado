import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteV2DatabaseForTests, getPendingOutbox, toLocalPersistenceError } from '../../src/platform/indexeddb';
import { LocalSubjectRepository } from '../../src/platform/local-subject-repository';
import { subscribeLocalChanges } from '../../src/platform/local-events';
import type { SubjectCommand } from '../../src/domain/subject';

const profileId = 'profile-local';

function command(overrides: Partial<SubjectCommand> = {}): SubjectCommand {
  return {
    operationId: 'op-local-1',
    profileId,
    subjectId: 'subject-local-1',
    type: 'create',
    title: 'Direito Administrativo',
    ...overrides,
  };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('local persistence failures', () => {
  it('maps_quota_and_abort_errors', () => {
    expect(toLocalPersistenceError(new DOMException('quota', 'QuotaExceededError'))).toMatchObject({
      kind: 'QUOTA',
      recoverable: true,
    });
    expect(toLocalPersistenceError(new DOMException('abort', 'AbortError'))).toMatchObject({
      kind: 'ABORT',
      recoverable: true,
    });
  });

  it('quota_never_reports_success', async () => {
    const repository = new LocalSubjectRepository({ fault: 'quota' });

    await expect(repository.execute(command())).rejects.toMatchObject({
      kind: 'QUOTA',
      recoverable: true,
    });
    expect(await repository.get(profileId, 'subject-local-1')).toBeNull();
    expect(await getPendingOutbox(profileId)).toEqual([]);
  });

  it('two_tabs_observe_only_committed_changes', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeLocalChanges(profileId, first);
    const unsubscribeSecond = subscribeLocalChanges(profileId, second);
    const repository = new LocalSubjectRepository();

    await repository.execute(command());

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    const failing = new LocalSubjectRepository({ fault: 'abort' });
    await expect(
      failing.execute(command({ operationId: 'op-local-2', subjectId: 'subject-local-2' })),
    ).rejects.toBeDefined();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    unsubscribeFirst();
    unsubscribeSecond();
  });

  it('unsubscribe_stops_events', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLocalChanges(profileId, listener);
    unsubscribe();

    await new LocalSubjectRepository().execute(command());

    expect(listener).not.toHaveBeenCalled();
  });
});
