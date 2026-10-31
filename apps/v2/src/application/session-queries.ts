import type {
  SessionOrigin,
  SessionState,
  StudySession,
} from '../domain/session';
import type { LocalSessionRepository } from '../platform/local-session-repository';

export type SessionHistoryFilter = {
  profileId: string;
  from?: string;
  to?: string;
  editalId?: string;
  assuntoId?: string;
  origin?: SessionOrigin;
  state?: SessionState;
};

export type SessionHistoryPage = {
  items: StudySession[];
  nextCursor?: string;
};

function compareSessions(left: StudySession, right: StudySession): number {
  const dateOrder = (left.recordedAtCivilDate ?? '').localeCompare(
    right.recordedAtCivilDate ?? '',
  );
  if (dateOrder !== 0) return dateOrder;
  return left.id.localeCompare(right.id);
}

function matchesFilter(session: StudySession, filter: SessionHistoryFilter): boolean {
  if (session.profileId !== filter.profileId) return false;
  if (
    filter.from &&
    (!session.recordedAtCivilDate || session.recordedAtCivilDate < filter.from)
  ) {
    return false;
  }
  if (
    filter.to &&
    (!session.recordedAtCivilDate || session.recordedAtCivilDate > filter.to)
  ) {
    return false;
  }
  if (filter.editalId && !session.editalIds.includes(filter.editalId)) return false;
  if (
    filter.assuntoId &&
    !(session.allocations ?? []).some(
      (allocation) => allocation.assuntoId === filter.assuntoId,
    )
  ) {
    return false;
  }
  if (filter.origin && session.origin !== filter.origin) return false;
  if (filter.state && session.state !== filter.state) return false;
  // assuntoId matches only through explicit allocations; the query never
  // guesses a classification for sessions without one.
  return true;
}

export async function querySessionHistory(
  repository: LocalSessionRepository,
  filter: SessionHistoryFilter,
  cursor?: string,
  limit = 50,
): Promise<SessionHistoryPage> {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : 50;
  const all = (await repository.listSessions(filter.profileId))
    .filter((session) => matchesFilter(session, filter))
    .sort(compareSessions);
  let start = 0;
  if (cursor) {
    const index = all.findIndex((session) => session.id === cursor);
    start = index >= 0 ? index + 1 : 0;
  }
  const items = all.slice(start, start + safeLimit);
  const last = items[items.length - 1];
  const nextCursor =
    last && start + items.length < all.length ? last.id : undefined;
  return { items, nextCursor };
}
