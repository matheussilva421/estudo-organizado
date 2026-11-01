import { expect, test, type Page } from '@playwright/test';
import type { SessionConflict } from '../../src/domain/session-conflicts';
import type { SessionAllocation, SessionInterval, StudySession } from '../../src/domain/session';

const profileId = 'local-default';
const sessionId = 'session-conflict-e2e';
const conflictId = `${sessionId}~1~2~3`;

function interval(id: string, verifiedMs: number): SessionInterval {
  return {
    id,
    kind: 'FOCUS',
    verifiedMs,
    contextId: 'ctx-e2e',
    checkpoint: null,
    recoveryFlag: false,
    startedAt: '2026-10-30T10:00:00.000Z',
    endedAt: '2026-10-30T11:00:00.000Z',
  };
}

function allocation(allocationId: string, durationMs: number): SessionAllocation {
  return { sessionId, allocationId, durationMs };
}

function fixture(): { session: StudySession; conflict: SessionConflict } {
  const local: StudySession = {
    id: sessionId,
    profileId,
    state: 'COMPLETED',
    origin: 'TIMER',
    localRevision: 2,
    schemaVersion: 1,
    referenceZone: 'America/Fortaleza',
    recordedAtCivilDate: '2026-10-30',
    planBlockIds: ['block-local'],
    editalIds: ['edital-local'],
    intervals: [interval('local-focus', 60 * 60_000)],
    allocations: [allocation('local-allocation', 30 * 60_000)],
    note: 'nota local',
  };
  const incoming: StudySession = {
    ...local,
    localRevision: 3,
    planBlockIds: ['block-incoming'],
    editalIds: ['edital-incoming'],
    intervals: [interval('incoming-focus', 90 * 60_000)],
    allocations: [allocation('incoming-allocation', 45 * 60_000)],
    note: 'nota incoming',
  };
  const conflict: SessionConflict = {
    id: conflictId,
    profileId,
    sessionId,
    baseRevision: 1,
    local,
    incoming,
    kind: 'SAME_FIELD',
    status: 'OPEN',
  };
  return { session: local, conflict };
}

async function seedConflict(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const data = fixture();
  await page.evaluate(async ({ session, conflict }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('estudo-organizado-v2');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ['sessions', 'session_conflicts'],
      'readwrite',
    );
    transaction.objectStore('sessions').put(session);
    transaction.objectStore('session_conflicts').put(conflict);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, data);

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const conflicts = page.locator('[data-testid="session-conflicts"]');
  await expect(conflicts).toContainText('local 01:00:00');
  await expect(conflicts).toContainText('incoming 01:30:00');
}

type StoredState = {
  status?: string;
  resolution?: string;
  incomingIntervals: number[];
  incomingBlocks: string[];
  sessionIntervals: number[];
  sessionBlocks: string[];
  sessionEditals: string[];
  sessionAllocations: number[];
  sessionNote?: string;
  sessionRevision?: number;
  sessionCount: number;
};

async function readState(page: Page): Promise<StoredState> {
  return page.evaluate(async ({ profileId, conflictId }) => {
    function request<T>(request: IDBRequest<T>): Promise<T> {
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('estudo-organizado-v2');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const transaction = database.transaction(
      ['sessions', 'session_conflicts'],
      'readonly',
    );
    const conflict = (await request(
      transaction.objectStore('session_conflicts').get([profileId, conflictId]),
    )) as SessionConflict | undefined;
    const sessions = (await request(
      transaction.objectStore('sessions').getAll(),
    )) as StudySession[];
    database.close();
    const session = sessions[0];
    return {
      status: conflict?.status,
      resolution: conflict?.resolution,
      incomingIntervals: conflict?.incoming.intervals.map((item) => item.verifiedMs) ?? [],
      incomingBlocks: conflict?.incoming.planBlockIds ?? [],
      sessionIntervals: session?.intervals.map((item) => item.verifiedMs) ?? [],
      sessionBlocks: session?.planBlockIds ?? [],
      sessionEditals: session?.editalIds ?? [],
      sessionAllocations: session?.allocations?.map((item) => item.durationMs) ?? [],
      sessionNote: session?.note,
      sessionRevision: session?.localRevision,
      sessionCount: sessions.length,
    };
  }, { profileId, conflictId });
}

test('keep_both keeps the incoming variant recoverable without double counting', async ({ page }) => {
  await seedConflict(page);
  const conflicts = page.locator('[data-testid="session-conflicts"]');
  await conflicts.getByRole('button', { name: 'Manter ambos' }).click();

  await expect(page.locator('.inline-notice')).toContainText('Versões preservadas');
  const resolved = page.locator('[data-testid="session-resolved-conflicts"]');
  await expect(resolved).toBeVisible();
  await expect(resolved).toContainText('incoming 01:30:00');
  await expect(resolved).toContainText('preservada no registro');

  const afterResolve = await readState(page);
  expect(afterResolve.status).toBe('RESOLVED');
  expect(afterResolve.resolution).toBe('KEEP_BOTH');
  expect(afterResolve.incomingIntervals).toEqual([90 * 60_000]);
  expect(afterResolve.incomingBlocks).toEqual(['block-incoming']);
  expect(afterResolve.sessionIntervals).toEqual([60 * 60_000]);
  expect(afterResolve.sessionCount).toBe(1);

  await resolved.getByRole('button', { name: 'Reabrir' }).click();
  await expect(conflicts.getByRole('button', { name: 'Manter ambos' })).toBeVisible();
  await expect(page.locator('.inline-notice')).toContainText('Conflito reaberto');
  const reopened = await readState(page);
  expect(reopened.status).toBe('OPEN');
  expect(reopened.incomingIntervals).toEqual([90 * 60_000]);
  expect(reopened.incomingBlocks).toEqual(['block-incoming']);
  expect(reopened.sessionCount).toBe(1);
});

test('incoming applies facts while intervals and links stay pending', async ({ page }) => {
  await seedConflict(page);
  const conflicts = page.locator('[data-testid="session-conflicts"]');
  await conflicts.getByRole('button', { name: 'Usar incoming' }).click();

  await expect(page.locator('.inline-notice')).toContainText('não aplicados');
  await expect(conflicts).toContainText('incoming 01:30:00');
  await expect(conflicts.getByRole('button', { name: 'Usar incoming' })).toBeVisible();

  const first = await readState(page);
  expect(first.status).toBe('OPEN');
  expect(first.incomingIntervals).toEqual([90 * 60_000]);
  expect(first.incomingBlocks).toEqual(['block-incoming']);
  expect(first.sessionIntervals).toEqual([60 * 60_000]);
  expect(first.sessionBlocks).toEqual(['block-local']);
  expect(first.sessionEditals).toEqual(['edital-local']);
  expect(first.sessionAllocations).toEqual([45 * 60_000]);
  expect(first.sessionNote).toBe('nota incoming');
  expect(first.sessionCount).toBe(1);

  await conflicts.getByRole('button', { name: 'Usar incoming' }).click();
  await expect(page.locator('.inline-notice')).toContainText('permanece pendente');
  const second = await readState(page);
  expect(second.sessionRevision).toBe(first.sessionRevision);
  expect(second.incomingIntervals).toEqual([90 * 60_000]);
  expect(second.sessionCount).toBe(1);
});
