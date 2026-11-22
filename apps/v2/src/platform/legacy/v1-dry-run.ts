import { digestPayload } from '../sync/firebase-remote';
import { recognizeLegacyFormat } from './recognize';

export type LegacyDryRunStatus = 'ZERO_LOSS_CANDIDATE' | 'AMBIGUOUS' | 'INVALID';

export type LegacyDryRunIssue = {
  code:
    | 'UNSUPPORTED_FORMAT'
    | 'UNSUPPORTED_IDB_VERSION'
    | 'MISSING_ID'
    | 'DUPLICATE_ID'
    | 'MISSING_REMOTE_PLAN'
    | 'ORPHAN_REFERENCE'
    | 'UNMAPPED_KEY';
  entity: 'input' | 'edital' | 'event' | 'question' | 'block';
  id?: string;
  path?: string;
  detail: string;
};

export type LegacyDryRunReport = {
  status: LegacyDryRunStatus;
  recognized: boolean;
  schemaVersion: number | null;
  idbVersion: number | null;
  counts: { editais: number; events: number; questions: number; blocks: number; total: number };
  mapped: { editais: number; sessions: number; habitOccurrences: number; planningBlocks: number; quarantine: number };
  issues: LegacyDryRunIssue[];
  duplicates: number;
  orphans: number;
  unmappedKeys: string[];
  losses: number;
  inputChecksum: string;
};

const ALLOWED_KEYS = new Set([
  'schemaVersion',
  'idbVersion',
  'editais',
  'eventos',
  'habitos',
  'retaFinal',
  'planejamento',
  'blocos',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function arrayOf(input: unknown, key: string): unknown[] {
  return isRecord(input) && Array.isArray(input[key]) ? (input[key] as unknown[]) : [];
}

function questionArray(input: unknown): unknown[] {
  if (!isRecord(input) || !isRecord(input.habitos)) return [];
  return Array.isArray(input.habitos.questoes) ? input.habitos.questoes : [];
}

function blocksOf(input: unknown): unknown[] {
  if (!isRecord(input)) return [];
  if (Array.isArray(input.blocos)) return input.blocos;
  if (isRecord(input.retaFinal) && Array.isArray(input.retaFinal.blocos)) {
    return input.retaFinal.blocos;
  }
  if (isRecord(input.planejamento)) return blocksOf(input.planejamento);
  return [];
}

function hasContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some(hasContent);
  if (isRecord(value)) return Object.values(value).some(hasContent);
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function idOf(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return typeof value.id === 'string' && value.id.trim() ? value.id.trim() : null;
}

/**
 * Structural, read-only pre-cutover audit. It never writes and never claims
 * semantic equivalence: ZERO_LOSS_CANDIDATE means all sampled records have an
 * identity and references, not that the production cutover is approved.
 */
export async function auditLegacyV1DryRun(input: unknown): Promise<LegacyDryRunReport> {
  const recognition = recognizeLegacyFormat(input);
  const issues: LegacyDryRunIssue[] = [];
  const editais = arrayOf(input, 'editais');
  const events = arrayOf(input, 'eventos');
  const questions = questionArray(input);
  const blocks = blocksOf(input);
  const idbVersion = isRecord(input) && typeof input.idbVersion === 'number' ? input.idbVersion : null;

  if (recognition.kind !== 'V1_SUPPORTED') {
    issues.push({ code: 'UNSUPPORTED_FORMAT', entity: 'input', detail: 'legacy export is not a recognized V1 shape' });
  }
  if (idbVersion !== null && idbVersion !== 6 && idbVersion !== 7) {
    issues.push({ code: 'UNSUPPORTED_IDB_VERSION', entity: 'input', detail: `IDB version ${idbVersion} is not supported` });
  }

  const unmappedKeys = isRecord(input)
    ? Object.entries(input)
        .filter(([key, value]) => {
          if (ALLOWED_KEYS.has(key)) return false;
          if (key === 'habitos' && isRecord(value)) {
            return Object.entries(value).some(([habitKey, habitValue]) => habitKey !== 'questoes' && hasContent(habitValue));
          }
          return hasContent(value);
        })
        .map(([key]) => key)
    : [];
  for (const key of unmappedKeys) {
    issues.push({ code: 'UNMAPPED_KEY', entity: 'input', path: key, detail: `unmapped input key ${key}` });
  }

  const seen = new Map<string, Set<string>>();
  const duplicateIds = new Set<string>();
  const collectIds = (entity: 'edital' | 'event' | 'question' | 'block', rows: unknown[]): Set<string> => {
    const ids = new Set<string>();
    for (const row of rows) {
      const id = idOf(row);
      if (!id) {
        issues.push({ code: 'MISSING_ID', entity, detail: 'record has no stable id' });
        continue;
      }
      if (ids.has(id)) {
        duplicateIds.add(`${entity}:${id}`);
        issues.push({ code: 'DUPLICATE_ID', entity, id, detail: 'duplicate id in the same collection' });
        continue;
      }
      ids.add(id);
    }
    seen.set(entity, ids);
    return ids;
  };

  const editalIds = collectIds('edital', editais);
  const eventIds = collectIds('event', events);
  collectIds('question', questions);
  collectIds('block', blocks);

  let orphans = 0;
  for (const event of events) {
    if (!isRecord(event)) continue;
    const editalId = typeof event.editalId === 'string' ? event.editalId : null;
    if (editalId && !editalIds.has(editalId)) {
      orphans += 1;
      issues.push({ code: 'ORPHAN_REFERENCE', entity: 'event', id: idOf(event) ?? undefined, detail: `missing edital ${editalId}` });
    }
  }
  for (const question of questions) {
    if (!isRecord(question)) continue;
    const eventId = typeof question.eventoId === 'string' ? question.eventoId : null;
    if (eventId && !eventIds.has(eventId)) {
      orphans += 1;
      issues.push({ code: 'ORPHAN_REFERENCE', entity: 'question', id: idOf(question) ?? undefined, detail: `missing event ${eventId}` });
    }
  }
  for (const block of blocks) {
    if (!isRecord(block) || block.planoRemoto === undefined || block.planoRemoto === null) {
      issues.push({ code: 'MISSING_REMOTE_PLAN', entity: 'block', id: idOf(block) ?? undefined, detail: 'legacy block has no remote plan identity' });
    }
  }

  const counts = { editais: editais.length, events: events.length, questions: questions.length, blocks: blocks.length, total: editais.length + events.length + questions.length + blocks.length };
  const duplicateCount = duplicateIds.size;
  const losses = issues.filter((issue) => issue.code !== 'UNSUPPORTED_FORMAT' || recognition.kind !== 'V1_SUPPORTED').length;
  const recognized = recognition.kind === 'V1_SUPPORTED' && (idbVersion === null || idbVersion === 6 || idbVersion === 7);
  return {
    status: !recognized ? 'INVALID' : losses === 0 ? 'ZERO_LOSS_CANDIDATE' : 'AMBIGUOUS',
    recognized,
    schemaVersion: isRecord(input) && typeof input.schemaVersion === 'number' ? input.schemaVersion : null,
    idbVersion,
    counts,
    mapped: {
      editais: editais.length,
      sessions: events.length,
      habitOccurrences: questions.length,
      planningBlocks: blocks.length,
      quarantine: duplicateCount,
    },
    issues,
    duplicates: duplicateCount,
    orphans,
    unmappedKeys,
    losses,
    inputChecksum: await digestPayload(input),
  };
}
