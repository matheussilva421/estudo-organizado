import type {
  SessionOutcome,
  SessionScope,
  StudySession,
} from '../domain/session';
import type {
  LocalSessionRepository,
  SessionCommitInput,
} from '../platform/local-session-repository';

export type EmergencyExportInput = {
  formatVersion: number;
  command: SessionCommitInput;
  checkpoint?: unknown;
};

export type EmergencyExport = {
  fileName: string;
  content: string;
  digest: string;
};

export type EmergencyPreview = {
  kind: 'READY' | 'INVALID' | 'CONFLICT';
  reason?: string;
  operationId?: string;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => JSON.stringify(key) + ':' + stableStringify(item));
  return '{' + entries.join(',') + '}';
}

function digestOf(value: unknown): string {
  const input = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function containsUnsafeUrl(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /(?:javascript|data|file):/i.test(text);
}

export function exportUnsavedSessionIntent(
  input: EmergencyExportInput,
): EmergencyExport {
  const body = {
    formatVersion: input.formatVersion,
    exportedAt: new Date().toISOString(),
    command: input.command,
    checkpoint: input.checkpoint,
  };
  const digest = digestOf(body);
  return {
    fileName: 'f4-emergencia.json',
    content: JSON.stringify({ ...body, digest }),
    digest,
  };
}

export function previewEmergencyImport(
  raw: string,
  profileId: string,
): EmergencyPreview {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { kind: 'INVALID', reason: 'INVALID_JSON' };
  }
  if (!parsed || parsed.formatVersion !== 1) {
    return { kind: 'INVALID', reason: 'INVALID_FORMAT' };
  }
  const command = parsed.command as SessionCommitInput | undefined;
  if (
    !command ||
    !command.scope ||
    command.scope.profileId !== profileId ||
    typeof command.sessionId !== 'string' ||
    !command.sessionId.trim()
  ) {
    return { kind: 'INVALID', reason: 'PROFILE_MISMATCH' };
  }
  if (
    command.kind !== 'CREATE' &&
    command.kind !== 'TRANSITION' &&
    command.kind !== 'CHECKPOINT' &&
    command.kind !== 'EDIT_FACTS' &&
    command.kind !== 'TOMBSTONE'
  ) {
    return { kind: 'INVALID', reason: 'INVALID_COMMAND' };
  }
  if (containsUnsafeUrl(command)) {
    return { kind: 'INVALID', reason: 'UNSAFE_URL' };
  }
  const { digest, ...body } = parsed;
  if (typeof digest !== 'string' || digestOf(body) !== digest) {
    return { kind: 'INVALID', reason: 'DIGEST_MISMATCH' };
  }
  return { kind: 'READY', operationId: command.scope.operationId };
}

export async function applyEmergencyImport(
  repository: LocalSessionRepository,
  raw: string,
  scope: SessionScope,
): Promise<SessionOutcome<StudySession>> {
  const preview = previewEmergencyImport(raw, scope.profileId);
  if (preview.kind !== 'READY') {
    return { kind: 'INVALID', code: preview.reason ?? 'INVALID_IMPORT' };
  }
  const parsed = JSON.parse(raw) as { command: SessionCommitInput };
  return repository.commit(parsed.command);
}

export async function downloadEmergencyFile(
  file: { content: string },
  save: (content: string) => Promise<void>,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    await save(file.content);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'DOWNLOAD_FAILED' };
  }
}
