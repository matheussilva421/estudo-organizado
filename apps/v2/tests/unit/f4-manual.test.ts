import { beforeEach, describe, expect, it } from 'vitest';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';
import { LocalSessionCoordinator } from '../../src/platform/session-coordination';
import { LocalSessionRepository } from '../../src/platform/local-session-repository';
import { StudySessionService } from '../../src/application/session-service';
import type { ClockPort } from '../../src/domain/session-clock';

const profileId = 'profile-f4';
const clock: ClockPort = {
  observe: () => ({
    contextId: 'ctx-1',
    monotonicMs: 1_000,
    wallInstant: '2026-10-30T10:00:00.000Z',
  }),
};

async function acquire(
  coordinator: LocalSessionCoordinator,
  sessionId: string,
  profile = profileId,
  operationId = 'op-auth',
) {
  return coordinator.acquireAuthority(sessionId, profile, 'tab-a', null, operationId);
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F4 manual sessions', () => {
  it('retroactive_session_is_manual_without_monotonic_interval', async () => {
    const coordinator = new LocalSessionCoordinator();
    const repository = new LocalSessionRepository();
    const service = new StudySessionService(repository, clock);
    const authority = await acquire(coordinator, 'manual-1');
    if (authority.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');

    const result = await service.registerManualSession({
      scope: { profileId, operationId: 'op-manual', baseRevision: null },
      sessionId: 'manual-1',
      civilDate: '2026-10-29',
      referenceZone: 'America/Fortaleza',
      durationMs: 45 * 60_000,
      note: 'revisão',
      authority: authority.value,
    });
    expect(result.kind).toBe('LOCAL_COMMITTED');
    if (result.kind !== 'LOCAL_COMMITTED') return;
    expect(result.value.origin).toBe('MANUAL');
    expect(result.value.state).toBe('COMPLETED');
    expect(result.value.intervals).toEqual([]);
    expect(result.value.manualDeclaredMs).toBe(45 * 60_000);
    expect(result.value.recordedAtCivilDate).toBe('2026-10-29');
    expect(result.value.note).toBe('revisão');
  });

  it('manual_overlap_reports_warning_but_keeps_both_facts', async () => {
    const coordinator = new LocalSessionCoordinator();
    const repository = new LocalSessionRepository();
    const service = new StudySessionService(repository, clock);
    const first = await acquire(coordinator, 'manual-1');
    if (first.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    await service.registerManualSession({
      scope: { profileId, operationId: 'op-manual-1', baseRevision: null },
      sessionId: 'manual-1',
      civilDate: '2026-10-29',
      referenceZone: 'America/Fortaleza',
      durationMs: 30 * 60_000,
      authority: first.value,
    });
    await coordinator.releaseAuthority(
      'manual-1',
      profileId,
      'tab-a',
      first.value.generation,
      'op-release-1',
    );

    const second = await acquire(coordinator, 'manual-2', profileId, 'op-auth-2');
    if (second.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    await service.registerManualSession({
      scope: { profileId, operationId: 'op-manual-2', baseRevision: null },
      sessionId: 'manual-2',
      civilDate: '2026-10-29',
      referenceZone: 'America/Fortaleza',
      durationMs: 40 * 60_000,
      authority: second.value,
    });

    const overlaps = await service.findPotentialOverlaps(profileId, '2026-10-29');
    expect(overlaps.map((session) => session.id).sort()).toEqual(['manual-1', 'manual-2']);
    expect(await repository.load(profileId, 'manual-1')).not.toBeNull();
    expect(await repository.load(profileId, 'manual-2')).not.toBeNull();
  });

  it('invalid_civil_date_rejected', async () => {
    const coordinator = new LocalSessionCoordinator();
    const service = new StudySessionService(new LocalSessionRepository(), clock);
    const authority = await acquire(coordinator, 'manual-bad');
    if (authority.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    const result = await service.registerManualSession({
      scope: { profileId, operationId: 'op-manual-bad', baseRevision: null },
      sessionId: 'manual-bad',
      civilDate: '2026-02-30',
      referenceZone: 'America/Fortaleza',
      durationMs: 30 * 60_000,
      authority: authority.value,
    });
    expect(result).toEqual({ kind: 'INVALID', code: 'INVALID_CIVIL_DATE' });
  });

  it('other_profile_not_visible', async () => {
    const coordinator = new LocalSessionCoordinator();
    const repository = new LocalSessionRepository();
    const service = new StudySessionService(repository, clock);
    const own = await acquire(coordinator, 'manual-own');
    if (own.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    await service.registerManualSession({
      scope: { profileId, operationId: 'op-own', baseRevision: null },
      sessionId: 'manual-own',
      civilDate: '2026-10-29',
      referenceZone: 'America/Fortaleza',
      durationMs: 20 * 60_000,
      authority: own.value,
    });

    const other = await acquire(coordinator, 'manual-other', 'profile-other', 'op-auth-other');
    if (other.kind !== 'LOCAL_COMMITTED') throw new Error('authority not acquired');
    await service.registerManualSession({
      scope: { profileId: 'profile-other', operationId: 'op-other', baseRevision: null },
      sessionId: 'manual-other',
      civilDate: '2026-10-29',
      referenceZone: 'America/Fortaleza',
      durationMs: 20 * 60_000,
      authority: other.value,
    });

    const overlaps = await service.findPotentialOverlaps(profileId, '2026-10-29');
    expect(overlaps.map((session) => session.id)).toEqual(['manual-own']);
  });
});
