export type LegacyRecognition =
  | { kind: 'V1_SUPPORTED'; schemaVersion?: number }
  | { kind: 'UNSUPPORTED' }
  | { kind: 'INVALID' };

export type LegacyComparison = 'EQUIVALENT' | 'DIVERGENT' | 'INCONCLUSIVE';

const SUPPORTED_SCHEMAS = new Set([7, 9, 11, 12]);
const DERIVED_BLOCK_FIELDS = new Set([
  'ordem',
  'data',
  'dataPlanejada',
  'status',
  'rolagens',
  'categoriaTemporal',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function recognizeLegacyFormat(input: unknown): LegacyRecognition {
  if (!isRecord(input)) return { kind: 'INVALID' };

  if (typeof input.schemaVersion === 'number') {
    if (!SUPPORTED_SCHEMAS.has(input.schemaVersion)) return { kind: 'UNSUPPORTED' };
    return { kind: 'V1_SUPPORTED', schemaVersion: input.schemaVersion };
  }

  const hasAcademicShape =
    Array.isArray(input.editais) ||
    Array.isArray(input.eventos) ||
    isRecord(input.habitos) ||
    isRecord(input.planejamento) ||
    Array.isArray(input.blocos);

  return hasAcademicShape ? { kind: 'V1_SUPPORTED' } : { kind: 'UNSUPPORTED' };
}

function blocksOf(input: unknown): unknown[] | null {
  if (!isRecord(input)) return null;
  if (Array.isArray(input.blocos)) return input.blocos;
  if (isRecord(input.retaFinal) && Array.isArray(input.retaFinal.blocos)) {
    return input.retaFinal.blocos;
  }
  if (isRecord(input.planejamento)) return blocksOf(input.planejamento);
  return null;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  );
}

function semanticBlock(block: unknown): string {
  if (!isRecord(block)) return '';
  const cleaned = Object.fromEntries(
    Object.entries(block).filter(([key]) => !DERIVED_BLOCK_FIELDS.has(key)),
  );
  return JSON.stringify(stableValue(cleaned));
}

export function compareLegacyPlan(left: unknown, right: unknown): LegacyComparison {
  const leftBlocks = blocksOf(left);
  const rightBlocks = blocksOf(right);
  if (!leftBlocks || !rightBlocks) return 'INCONCLUSIVE';
  if (leftBlocks.length !== rightBlocks.length) return 'DIVERGENT';

  const index = (blocks: unknown[]): Map<string, unknown> | null => {
    const map = new Map<string, unknown>();
    for (const block of blocks) {
      if (!isRecord(block) || typeof block.id !== 'string' || !block.id) return null;
      if (map.has(block.id)) return null;
      map.set(block.id, block);
    }
    return map;
  };

  const leftMap = index(leftBlocks);
  const rightMap = index(rightBlocks);
  if (!leftMap || !rightMap) return 'INCONCLUSIVE';
  if (leftMap.size !== rightMap.size) return 'DIVERGENT';

  for (const [id, leftBlock] of leftMap) {
    const rightBlock = rightMap.get(id);
    if (!rightBlock) return 'INCONCLUSIVE';
    if (semanticBlock(leftBlock) !== semanticBlock(rightBlock)) return 'DIVERGENT';
  }

  return 'EQUIVALENT';
}
