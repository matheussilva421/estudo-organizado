import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteV2DatabaseForTests,
  openV2Database,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';
import { LocalSessionRepository } from '../../src/platform/local-session-repository';
import { querySessionHistory } from '../../src/application/session-queries';
import type { StudySession } from '../../src/domain/session';

const profileId = 'profile-f4';

function session(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: 'session-1',
    profileId,
    state: 'COMPLETED',
    origin: 'TIMER',
    localRevision: 1,
    schemaVersion: 1,
    referenceZone: 'America/Fortaleza',
    recordedAtCivilDate: '2026-10-30',
    planBlockIds: [],
    editalIds: [],
    intervals: [],
    ...overrides,
  };
}

async function seed(sessions: StudySession[]): Promise<void> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.sessions, 'readwrite');
  for (const item of sessions) transaction.objectStore(STORES.sessions).put(item);
  await transactionDone(transaction);
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F4 session history', () => {
  it('filters_by_profile_date_edital_origin_and_state', async () => {
    await seed([
      session({ id: 'a', editalIds: ['e1'], origin: 'TIMER', state: 'COMPLETED' }),
      session({ id: 'b', editalIds: ['e2'], origin: 'MANUAL', state: 'COMPLETED' }),
      session({ id: 'c', recordedAtCivilDate: '2026-10-31' }),
    ]);
    const page = await querySessionHistory(new LocalSessionRepository(), {
      profileId,
      from: '2026-10-30',
      to: '2026-10-30',
      editalId: 'e1',
      origin: 'TIMER',
      state: 'COMPLETED',
    });
    expect(page.items.map((item) => item.id)).toEqual(['a']);
  });

  it('stable_cursor_order_for_large_history', async () => {
    const sessions = Array.from({ length: 25 }, (_, index) =>
      session({
        id: 's' + String(index).padStart(2, '0'),
        recordedAtCivilDate:
          '2026-10-' + String((index % 28) + 1).padStart(2, '0'),
      }),
    );
    await seed(sessions);
    const repository = new LocalSessionRepository();
    const collected: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await querySessionHistory(repository, { profileId }, cursor, 10);
      collected.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(collected).toHaveLength(25);
    expect(new Set(collected).size).toBe(25);
  });

  it('first_page_starts_at_the_newest_session', async () => {
    const sessions = Array.from({ length: 60 }, (_, index) =>
      session({
        id: 'n' + String(index).padStart(2, '0'),
        recordedAtCivilDate:
          '2026-09-' + String((index % 28) + 1).padStart(2, '0'),
      }),
    );
    await seed(sessions);
    const page = await querySessionHistory(new LocalSessionRepository(), { profileId }, undefined, 10);
    expect(page.items).toHaveLength(10);
    expect(page.items[0]?.recordedAtCivilDate).toBe('2026-09-28');
    expect(page.nextCursor).toBeTruthy();
  });

  it('archived_references_remain_visible', async () => {
    await seed([session({ id: 'archived-ref', planBlockIds: ['block-archived'] })]);
    const page = await querySessionHistory(new LocalSessionRepository(), { profileId });
    expect(page.items.map((item) => item.id)).toContain('archived-ref');
  });

  it('create_without_civil_date_is_still_listed', async () => {
    const repository = new LocalSessionRepository();
    const undated = session({ id: 'undated' });
    delete undated.recordedAtCivilDate;
    const created = await repository.commit({
      kind: 'CREATE',
      scope: { profileId, operationId: 'op-undated', baseRevision: null },
      sessionId: 'undated',
      session: undated,
    });
    expect(created.kind).toBe('LOCAL_COMMITTED');
    const page = await querySessionHistory(repository, { profileId });
    expect(page.items.map((item) => item.id)).toContain('undated');
  });

  it('filters_by_assunto_id_using_allocations', async () => {
    await seed([
      session({
        id: 'with-assunto',
        allocations: [
          {
            sessionId: 'with-assunto',
            allocationId: 'allocation-1',
            assuntoId: 'assunto-1',
            durationMs: 60_000,
          },
        ],
      }),
      session({ id: 'without-assunto' }),
    ]);
    const page = await querySessionHistory(new LocalSessionRepository(), {
      profileId,
      assuntoId: 'assunto-1',
    });
    expect(page.items.map((item) => item.id)).toEqual(['with-assunto']);
  });
});
