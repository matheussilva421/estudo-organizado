import type { StudySession } from '../domain/session';
import { sumVerifiedFocusMs } from '../domain/session-clock';
import type { SessionHistoryFilter } from './session-queries';

export type ExportFormat = 'CSV' | 'JSON';

export type ExportResult = {
  fileName: string;
  mimeType: string;
  content: string;
};

function escapeCsv(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? "'" + value : value;
  return /[",\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
}

function sanitizeNote(note: string): string {
  return note.replace(
    /\b(token|secret|password|credential)\s*=\s*[^;\s]+/gi,
    '$1=[REDACTED]',
  );
}

export function exportSessionHistory(
  format: ExportFormat,
  filter: SessionHistoryFilter,
  sessions: readonly StudySession[],
): ExportResult {
  const selected = sessions.filter((session) => session.profileId === filter.profileId);
  if (format === 'CSV') {
    const header = [
      'sessionId',
      'profileId',
      'civilDate',
      'origin',
      'state',
      'manualDeclaredMs',
      'verifiedFocusMs',
      'editalIds',
      'planBlockIds',
      'note',
      'tombstone',
    ].join(',');
    const rows = selected.map((session) =>
      [
        escapeCsv(session.id),
        escapeCsv(session.profileId),
        escapeCsv(session.recordedAtCivilDate ?? ''),
        escapeCsv(session.origin),
        escapeCsv(session.state),
        String(session.manualDeclaredMs ?? 0),
        String(sumVerifiedFocusMs(session.intervals)),
        escapeCsv(session.editalIds.join('|')),
        escapeCsv(session.planBlockIds.join('|')),
        escapeCsv(session.note ?? ''),
        session.tombstone === true ? 'true' : 'false',
      ].join(','),
    );
    return {
      fileName: 'sessoes.csv',
      mimeType: 'text/csv;charset=utf-8',
      content: [header, ...rows].join('\r\n'),
    };
  }

  const payload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    profileId: filter.profileId,
    sessions: selected.map((session) => ({
      ...session,
      note: session.note ? sanitizeNote(session.note) : undefined,
    })),
  };
  return {
    fileName: 'sessoes.json',
    mimeType: 'application/json',
    content: JSON.stringify(payload, null, 2),
  };
}
