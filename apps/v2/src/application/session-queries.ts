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

function encodeCursor(session: StudySession): string {
  return (
    encodeURIComponent(session.recordedAtCivilDate ?? '') +
    '|' +
    encodeURIComponent(session.id)
  );
}

function decodeCursor(cursor: string): { civilDate: string; id: string } {
  const separator = cursor.indexOf('|');
  if (separator < 0) return { civilDate: '', id: cursor };
  return {
    civilDate: decodeURIComponent(cursor.slice(0, separator)),
    id: decodeURIComponent(cursor.slice(separator + 1)),
  };
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
  const { items, hasMore } = await repository.scanSessionsDescending(
    filter.profileId,
    {
      before: cursor ? decodeCursor(cursor) : null,
      limit: safeLimit,
      matches: (session) => matchesFilter(session, filter),
    },
  );
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last) : undefined,
  };
}
