import { recognizeLegacyFormat } from './recognize';
import { digestPayload } from '../sync/firebase-remote';
import type { F7BackupSnapshot } from '../backup/f7-format';

export type LegacyMigrationPreview = {
  kind: 'SAFE' | 'AMBIGUOUS' | 'INVALID';
  recordCount: number;
  unmapped: number;
  conflicts: number;
  provenance: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function blocksOf(input: unknown): unknown[] {
  if (!isRecord(input)) return [];
  if (Array.isArray(input.blocos)) return input.blocos;
  if (isRecord(input.retaFinal) && Array.isArray(input.retaFinal.blocos)) return input.retaFinal.blocos;
  if (isRecord(input.planejamento)) return blocksOf(input.planejamento);
  return [];
}

function blockArrays(input: unknown): unknown[][] {
  if (!isRecord(input)) return [];
  const arrays: unknown[][] = [];
  if (Array.isArray(input.blocos)) arrays.push(input.blocos);
  if (isRecord(input.retaFinal) && Array.isArray(input.retaFinal.blocos)) {
    arrays.push(input.retaFinal.blocos);
  }
  if (isRecord(input.planejamento)) arrays.push(...blockArrays(input.planejamento));
  return arrays;
}

function arrayOf(input: unknown, key: string): unknown[] {
  return isRecord(input) && Array.isArray(input[key]) ? (input[key] as unknown[]) : [];
}

function questionArray(input: unknown): unknown[] {
  if (!isRecord(input) || !isRecord(input.habitos)) return [];
  return Array.isArray(input.habitos.questoes) ? input.habitos.questoes : [];
}

function blockIds(blocks: unknown[]): { unique: unknown[]; duplicates: unknown[] } {
  const seen = new Set<string>();
  const unique: unknown[] = [];
  const duplicates: unknown[] = [];
  for (const block of blocks) {
    const id = isRecord(block) && typeof block.id === 'string' ? block.id : '';
    if (!id) {
      duplicates.push(block);
      continue;
    }
    if (seen.has(id)) {
      duplicates.push(block);
      continue;
    }
    seen.add(id);
    unique.push(block);
  }
  return { unique, duplicates };
}

function provenance(input: unknown): string[] {
  const result: string[] = [];
  if (isRecord(input)) {
    if (typeof input.schemaVersion === 'number') result.push(`schemaVersion:${input.schemaVersion}`);
    if (typeof input.idbVersion === 'number') result.push(`idbVersion:${input.idbVersion}`);
    if (isRecord(input.retaFinal)) result.push('retaFinal');
    if (isRecord(input.planejamento)) result.push('planejamento');
  }
  return result;
}

function hasContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some((item) => hasContent(item));
  if (isRecord(value)) return Object.values(value).some((item) => hasContent(item));
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

const MAPPED_ARRAY_KEYS = new Set(['editais', 'eventos', 'blocos']);

function hasUnmappedContent(input: unknown): boolean {
  if (!isRecord(input)) return false;
  for (const [key, value] of Object.entries(input)) {
    if (key === 'schemaVersion' || key === 'idbVersion') {
      if (typeof value !== 'number' && hasContent(value)) return true;
      continue;
    }
    if (MAPPED_ARRAY_KEYS.has(key)) {
      if (!Array.isArray(value) && hasContent(value)) return true;
      continue;
    }
    if (key === 'habitos') {
      if (!isRecord(value)) {
        if (hasContent(value)) return true;
        continue;
      }
      for (const [habitKey, habitValue] of Object.entries(value)) {
        if (habitKey === 'questoes' && Array.isArray(habitValue)) continue;
        if (hasContent(habitValue)) return true;
      }
      continue;
    }
    if (key === 'retaFinal' || key === 'planejamento') {
      if (!isRecord(value)) {
        if (hasContent(value)) return true;
        continue;
      }
      if (hasUnmappedContent(value)) return true;
      continue;
    }
    if (hasContent(value)) return true;
  }
  return false;
}

export function inspectLegacyV1Export(input: unknown): LegacyMigrationPreview {
  const recognition = recognizeLegacyFormat(input);
  if (recognition.kind !== 'V1_SUPPORTED') {
    return { kind: 'INVALID', recordCount: 0, unmapped: 0, conflicts: 0, provenance: provenance(input) };
  }
  if (isRecord(input) && typeof input.idbVersion === 'number' && input.idbVersion !== 6 && input.idbVersion !== 7) {
    return { kind: 'INVALID', recordCount: 0, unmapped: 0, conflicts: 0, provenance: provenance(input) };
  }

  const editais = arrayOf(input, 'editais');
  const events = arrayOf(input, 'eventos');
  const questions = questionArray(input);
  const blocks = blocksOf(input);
  const split = blockIds(blocks);
  const extraBlocks = blockArrays(input).some(
    (rows) => rows !== blocks && rows.some((row) => hasContent(row)),
  );
  const unmapped =
    blocks.filter((block) => !isRecord(block) || block.planoRemoto === undefined || block.planoRemoto === null).length +
    editais.length +
    events.length +
    questions.length;
  const hasData =
    editais.length > 0 || events.length > 0 || questions.length > 0 || blocks.length > 0;
  const recordCount = editais.length + events.length + questions.length + split.unique.length;
  return {
    kind:
      split.duplicates.length > 0 ||
      unmapped > 0 ||
      hasData ||
      extraBlocks ||
      hasUnmappedContent(input)
        ? 'AMBIGUOUS'
        : 'SAFE',
    recordCount,
    unmapped,
    conflicts: split.duplicates.length,
    provenance: provenance(input),
  };
}

export async function convertLegacyV1InIsolation(
  input: unknown,
): Promise<{ preview: LegacyMigrationPreview; snapshot: F7BackupSnapshot | null }> {
  const preview = inspectLegacyV1Export(input);
  if (preview.kind !== 'SAFE') return { preview, snapshot: null };

  const editais = arrayOf(input, 'editais');
  const events = arrayOf(input, 'eventos');
  const questions = questionArray(input);
  const split = blockIds(blocksOf(input));
  const payload: Record<string, unknown[]> = {
    editais: editais.map((row) => (isRecord(row) ? { ...row } : row)),
    sessions: events.map((row) => (isRecord(row) ? { ...row } : row)),
    habitOccurrences: questions.map((row) => (isRecord(row) ? { ...row } : row)),
    planningBlocks: split.unique.map((row) => (isRecord(row) ? { ...row } : row)),
    quarantine: split.duplicates.map((row) => (isRecord(row) ? { ...row } : row)),
  };
  const recordCount = Object.values(payload).reduce((total, rows) => total + rows.length, 0);
  const checksum = await digestPayload(payload);
  return {
    preview,
    snapshot: {
      manifest: {
        formatVersion: 3,
        profileId: 'legacy-v1',
        recordCount,
        checksum,
        epoch: 0,
        deletionHistoryComplete: true,
      },
      payload,
    },
  };
}
