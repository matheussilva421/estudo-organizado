import type { BlockAllocation, PlanBlock, PlanningScenario, PlanningScenarioSnapshot } from '../domain/planning';
import { isCivilDate } from '../domain/planning-time';

/**
 * Conservative academic portability.
 *
 * Imports are read-only until an explicit commit, identity never comes from a
 * name, and exports carry a whitelist of academic fields - never tokens,
 * delivery metadata, outbox rows or sessions.
 */

export const PLANNING_FORMAT_VERSION = 1;
const MAX_BYTES = 2_000_000;
const MAX_DEPTH = 12;

export type ParsedPlanningBlock = {
  sourceId: string;
  label?: string;
  editalDisciplineId?: string;
  assuntoId?: string;
  aulaId?: string;
  plannedMinutes: number;
  civilDate?: string;
  localStart?: string;
  localEnd?: string;
  allocation: BlockAllocation;
};

export type ParsedPlanning = {
  format: 'V1_RETA_FINAL' | 'V2_PLANNING';
  namespace: string;
  fingerprint: string;
  scenario: {
    name: string;
    editalId?: string;
    examDate?: string | null;
    kind: 'CYCLE' | 'FINAL_STRETCH';
    referenceZone: string;
    provenance?: string;
  };
  blocks: ParsedPlanningBlock[];
  warnings: string[];
};

export type ParsePlanningResult =
  | {
      ok: true;
      format: ParsedPlanning['format'];
      fingerprint: string;
      scenarios: ParsedPlanning[];
      warnings: string[];
    }
  | { ok: false; reason: string };

export type ImportEntryKind = 'NEW' | 'EQUIVALENT' | 'AMBIGUOUS' | 'DIVERGENT';

export type PlanningImportEntry = {
  index: number;
  kind: ImportEntryKind;
  name: string;
  existingScenarioId?: string;
  reason: string;
};

export type PlanningImportPreview = {
  format: ParsedPlanning['format'];
  fingerprint: string;
  entries: PlanningImportEntry[];
  scenarios: ParsedPlanning[];
  automaticMerges: number;
  requiresConfirmation: true;
  targetSignature: string;
  unallocatedCount: number;
};

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16);
}

export function hashText(value: string): string {
  return hash(value);
}

type FingerprintableBlock = {
  editalDisciplineId?: string;
  assuntoId?: string;
  aulaId?: string;
  plannedMinutes: number;
  civilDate?: string;
  localStart?: string;
  localEnd?: string;
  allocation: string;
  label?: string;
};

function blockShape(block: FingerprintableBlock): string {
  return [
    block.editalDisciplineId ?? '',
    block.assuntoId ?? '',
    block.aulaId ?? '',
    String(block.plannedMinutes),
    block.civilDate ?? '',
    block.localStart ?? '',
    block.localEnd ?? '',
    block.allocation,
    block.label ?? '',
  ].join('~');
}

/** Semantic fingerprint of a block set, independent of persistence shape. */
export function fingerprintBlocks(blocks: FingerprintableBlock[]): string {
  return hash(blocks.map(blockShape).sort().join('|'));
}

function depthOf(value: unknown, depth = 0): number {
  if (depth > MAX_DEPTH) return depth;
  if (Array.isArray(value)) {
    return value.reduce((max, item) => Math.max(max, depthOf(item, depth + 1)), depth);
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).reduce<number>(
      (max, item) => Math.max(max, depthOf(item, depth + 1)),
      depth,
    );
  }
  return depth;
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function hasUnsafeKeys(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasUnsafeKeys);
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value as Record<string, unknown>).some(
    (key) => FORBIDDEN_KEYS.has(key) || hasUnsafeKeys((value as Record<string, unknown>)[key]),
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeBlock(raw: unknown, index: number, warnings: string[]): ParsedPlanningBlock | null {
  const record = asRecord(raw);
  if (!record) return null;
  const minutes = Number(record.plannedMinutes ?? record.duracao ?? record.minutes ?? 0);
  if (!Number.isInteger(minutes) || minutes <= 0) {
    warnings.push(`BLOCK_WITHOUT_VALID_DURATION:${index}`);
    return null;
  }
  const civilDate = typeof record.civilDate === 'string'
    ? record.civilDate
    : typeof record.data === 'string'
      ? record.data
      : undefined;
  if (civilDate !== undefined && !isCivilDate(civilDate)) {
    warnings.push(`BLOCK_WITH_INVALID_DATE:${index}`);
  }
  const allocation = (record.allocation ?? (record.localStart ? 'CONFIRMED_TIME' : 'PROJECTED')) as BlockAllocation;
  return {
    sourceId: String(record.id ?? record.sourceId ?? `imported-${index}`),
    label: typeof record.label === 'string' ? record.label : typeof record.conteudo === 'string' ? record.conteudo : undefined,
    editalDisciplineId:
      typeof record.editalDisciplineId === 'string' ? record.editalDisciplineId : undefined,
    assuntoId: typeof record.assuntoId === 'string' ? record.assuntoId : undefined,
    aulaId: typeof record.aulaId === 'string' ? record.aulaId : undefined,
    plannedMinutes: minutes,
    civilDate: civilDate && isCivilDate(civilDate) ? civilDate : undefined,
    localStart: typeof record.localStart === 'string' ? record.localStart : undefined,
    localEnd: typeof record.localEnd === 'string' ? record.localEnd : undefined,
    allocation:
      allocation === 'CONFIRMED_TIME' || allocation === 'CONFIRMED_DAY' || allocation === 'UNALLOCATED'
        ? allocation
        : 'PROJECTED',
  };
}

/**
 * Parses a planning JSON without trusting any field. Legacy V1 files often
 * lack schemaVersion/planId/revision and are still accepted when their content
 * is semantically valid.
 */
export function parsePlanningImport(
  input: string | Uint8Array,
  options: { namespace: string },
): ParsePlanningResult {
  let text: string;
  if (typeof input === 'string') {
    text = input;
  } else {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input);
    } catch {
      return { ok: false, reason: 'INVALID_ENCODING' };
    }
  }
  if (text.length > MAX_BYTES) return { ok: false, reason: 'OVERSIZE' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'INVALID_JSON' };
  }
  if (depthOf(parsed) > MAX_DEPTH) return { ok: false, reason: 'TOO_DEEP' };
  if (hasUnsafeKeys(parsed)) return { ok: false, reason: 'UNSAFE_KEYS' };

  const root = asRecord(parsed);
  if (!root) {
    if (Array.isArray(parsed)) {
      return buildLegacy(parsed, options.namespace, 'V1_RETA_FINAL');
    }
    return { ok: false, reason: 'INVALID_SHAPE' };
  }

  if (Array.isArray(root.scenarios)) {
    return buildPortable(root, options.namespace);
  }

  const legacyBlocks = root.blocos ?? root.blocks ?? root.dias ?? root.itens;
  if (Array.isArray(legacyBlocks)) {
    const blocks = legacyBlocks
      .map((item, index) => normalizeBlock(item, index, []))
      .filter((item): item is ParsedPlanningBlock => item !== null);
    const scenario = legacyScenario(root, blocks.length);
    const warnings: string[] = [];
    if (!root.schemaVersionRetaFinal) warnings.push('LEGACY_WITHOUT_SCHEMA_VERSION');
    if (!root.planId) warnings.push('LEGACY_WITHOUT_PLAN_ID');
    if (!root.revision) warnings.push('LEGACY_WITHOUT_REVISION');
    const blocksFingerprint = fingerprintBlocks(blocks);
    return {
      ok: true,
      format: 'V1_RETA_FINAL',
      fingerprint: blocksFingerprint,
      scenarios: [
        {
          format: 'V1_RETA_FINAL',
          namespace: options.namespace,
          fingerprint: blocksFingerprint,
          scenario,
          blocks,
          warnings,
        },
      ],
      warnings,
    };
  }

  return { ok: false, reason: 'INVALID_SHAPE' };
}

function legacyScenario(
  root: Record<string, unknown>,
  blockCount: number,
): ParsedPlanning['scenario'] {
  const examDate =
    typeof root.dataProva === 'string'
      ? root.dataProva
      : typeof root.examDate === 'string'
        ? root.examDate
        : null;
  return {
    name: typeof root.nome === 'string' ? root.nome : typeof root.name === 'string' ? root.name : 'Reta Final importada',
    editalId: typeof root.editalId === 'string' ? root.editalId : undefined,
    examDate: examDate && isCivilDate(examDate) ? examDate : null,
    kind: examDate && isCivilDate(examDate) ? 'FINAL_STRETCH' : 'CYCLE',
    referenceZone:
      typeof root.referenceZone === 'string' ? root.referenceZone : 'America/Fortaleza',
    provenance: `legacy:${blockCount}`,
  };
}

function buildLegacy(
  items: unknown[],
  namespace: string,
  format: ParsedPlanning['format'],
): ParsePlanningResult {
  const warnings: string[] = [];
  const blocks = items
    .map((item, index) => normalizeBlock(item, index, warnings))
    .filter((item): item is ParsedPlanningBlock => item !== null);
  if (blocks.length === 0) return { ok: false, reason: 'EMPTY_PLAN' };
  return {
    ok: true,
    format,
    fingerprint: fingerprintBlocks(blocks),
    scenarios: [
      {
        format,
        namespace,
          fingerprint: fingerprintBlocks(blocks),
        scenario: {
          name: 'Reta Final importada',
          examDate: null,
          kind: 'CYCLE',
          referenceZone: 'America/Fortaleza',
        },
        blocks,
        warnings,
      },
    ],
    warnings,
  };
}

function buildPortable(
  root: Record<string, unknown>,
  namespace: string,
): ParsePlanningResult {
  const version = Number(root.formatVersion ?? 0);
  if (version !== PLANNING_FORMAT_VERSION) {
    return { ok: false, reason: 'UNSUPPORTED_FORMAT_VERSION' };
  }
  const warnings: string[] = [];
  const scenarios: ParsedPlanning[] = [];
  for (const raw of root.scenarios as unknown[]) {
    const record = asRecord(raw);
    if (!record) return { ok: false, reason: 'INVALID_SHAPE' };
    const blocks = (Array.isArray(record.blocks) ? record.blocks : [])
      .map((item, index) => normalizeBlock(item, index, warnings))
      .filter((item): item is ParsedPlanningBlock => item !== null);
    const meta = asRecord(record.scenario) ?? {};
    const examDate = typeof meta.examDate === 'string' && isCivilDate(meta.examDate) ? meta.examDate : null;
    scenarios.push({
      format: 'V2_PLANNING',
      namespace,
      fingerprint: fingerprintBlocks(blocks),
      scenario: {
        name: typeof meta.name === 'string' ? meta.name : 'Plano importado',
        editalId: typeof meta.editalId === 'string' ? meta.editalId : undefined,
        examDate,
        kind: meta.kind === 'FINAL_STRETCH' && examDate ? 'FINAL_STRETCH' : 'CYCLE',
        referenceZone: typeof meta.referenceZone === 'string' ? meta.referenceZone : 'America/Fortaleza',
        provenance: typeof meta.provenance === 'string' ? meta.provenance : undefined,
      },
      blocks,
      warnings: [],
    });
  }
  if (scenarios.length === 0) return { ok: false, reason: 'EMPTY_PLAN' };
  return {
    ok: true,
    format: 'V2_PLANNING',
    fingerprint: hash(scenarios.map((item) => item.fingerprint).join('|')),
    scenarios,
    warnings,
  };
}

/**
 * A name is never identity. Only the same stable source (format + namespace +
 * name + provenance) can be equivalent; anything else stays for a human.
 */
export function previewPlanningImport(
  parsed: Extract<ParsePlanningResult, { ok: true }>,
  existing: PlanningScenarioSnapshot[],
): PlanningImportPreview {
  const entries: PlanningImportEntry[] = parsed.scenarios.map((item, index) => {
    const sameName = existing.filter((candidate) => candidate.scenario.name === item.scenario.name);
    if (sameName.length === 0) {
      return { index, kind: 'NEW', name: item.scenario.name, reason: 'NO_MATCHING_SCENARIO' };
    }
    const equivalent = sameName.find(
      (candidate) => fingerprintBlocks(candidate.blocks) === fingerprintBlocks(item.blocks),
    );
    if (equivalent) {
      return {
        index,
        kind: 'EQUIVALENT',
        name: item.scenario.name,
        existingScenarioId: equivalent.scenario.id,
        reason: 'SAME_CONTENT',
      };
    }
    if (sameName.length > 1) {
      return { index, kind: 'AMBIGUOUS', name: item.scenario.name, reason: 'MULTIPLE_CANDIDATES' };
    }
    const candidate = sameName[0] as PlanningScenarioSnapshot;
    if (candidate.scenario.provenance === item.scenario.provenance) {
      return {
        index,
        kind: 'DIVERGENT',
        name: item.scenario.name,
        existingScenarioId: candidate.scenario.id,
        reason: 'SAME_SOURCE_DIFFERENT_CONTENT',
      };
    }
    return {
      index,
      kind: 'AMBIGUOUS',
      name: item.scenario.name,
      existingScenarioId: candidate.scenario.id,
      reason: 'SAME_NAME_DIFFERENT_SOURCE',
    };
  });

  const targetSignature = `${parsed.format}:${parsed.fingerprint}:${entries
    .map((entry) => `${entry.kind}:${entry.existingScenarioId ?? 'new'}`)
    .join(',')}`;

  return {
    format: parsed.format,
    fingerprint: parsed.fingerprint,
    entries,
    scenarios: parsed.scenarios,
    automaticMerges: 0,
    requiresConfirmation: true,
    targetSignature,
    unallocatedCount: parsed.scenarios.reduce(
      (sum, item) => sum + item.blocks.filter((block) => block.allocation === 'UNALLOCATED').length,
      0,
    ),
  };
}

const BLOCK_EXPORT_FIELDS = [
  'id',
  'editalId',
  'scenarioId',
  'editalDisciplineId',
  'assuntoId',
  'aulaId',
  'plannedMinutes',
  'allocation',
  'civilDate',
  'localStart',
  'localEnd',
  'timeZone',
  'priority',
  'label',
  'reason',
] as const;

/**
 * Selective academic export. Fields are whitelisted: no profile uid, no
 * delivery binding, no outbox, no other edital and no session ever leaves.
 */
export function exportPlanningScenarios(input: {
  scenarioIds: string[];
  profileId: string;
  snapshots: PlanningScenarioSnapshot[];
  exportedAt?: string;
}): string {
  const wanted = new Set(input.scenarioIds);
  const scenarios = input.snapshots
    .filter(
      (snapshot) =>
        snapshot.scenario.profileId === input.profileId && wanted.has(snapshot.scenario.id),
    )
    .map((snapshot) => ({
      scenario: {
        id: snapshot.scenario.id,
        editalId: snapshot.scenario.editalId,
        kind: snapshot.scenario.kind,
        name: snapshot.scenario.name,
        status: snapshot.scenario.status,
        examDate: snapshot.scenario.examDate ?? null,
        referenceZone: snapshot.scenario.referenceZone,
        priorityProfileId: snapshot.scenario.priorityProfileId,
        priorityProfileRevision: snapshot.scenario.priorityProfileRevision,
        schemaVersion: snapshot.scenario.schemaVersion,
        provenance: snapshot.scenario.provenance,
      },
      blocks: snapshot.blocks
        .filter((block) => block.profileId === input.profileId)
        .map((block) => {
          const record: Record<string, unknown> = {};
          for (const field of BLOCK_EXPORT_FIELDS) {
            const value = (block as unknown as Record<string, unknown>)[field];
            if (value !== undefined) record[field] = value;
          }
          return record;
        }),
    }));

  return JSON.stringify(
    {
      formatVersion: PLANNING_FORMAT_VERSION,
      kind: 'estudo-organizado-v2-planning',
      sourceNamespace: `v2:${input.profileId}`,
      exportedAt: input.exportedAt ?? '1970-01-01T00:00:00.000Z',
      scenarios,
    },
    null,
    2,
  );
}

export function toScenarioFromParsed(
  parsed: ParsedPlanning,
  input: {
    profileId: string;
    scenarioId: string;
    editalId: string;
    operationId: string;
  },
): { scenario: PlanningScenario; blocks: PlanBlock[] } {
  const scenario: PlanningScenario = {
    id: input.scenarioId,
    profileId: input.profileId,
    editalId: input.editalId,
    kind: parsed.scenario.kind,
    name: parsed.scenario.name,
    status: 'DRAFT',
    localRevision: 1,
    schemaVersion: 1,
    priorityProfileId: 'priority-default',
    priorityProfileRevision: 1,
    examDate: parsed.scenario.kind === 'FINAL_STRETCH' ? parsed.scenario.examDate ?? null : null,
    referenceZone: parsed.scenario.referenceZone,
    provenance: `import:${parsed.namespace}:${parsed.fingerprint}`,
  };
  const blocks: PlanBlock[] = parsed.blocks.map((block, index) => ({
    id: `${input.scenarioId}~import~${index}`,
    profileId: input.profileId,
    editalId: input.editalId,
    scenarioId: input.scenarioId,
    editalDisciplineId: block.editalDisciplineId ?? 'unmapped',
    assuntoId: block.assuntoId,
    aulaId: block.aulaId,
    plannedMinutes: block.plannedMinutes,
    allocation: block.allocation,
    civilDate: block.civilDate,
    localStart: block.localStart,
    localEnd: block.localEnd,
    timeZone: block.localStart ? parsed.scenario.referenceZone : undefined,
    priority: 1,
    localRevision: 1,
    sourceOperationId: input.operationId,
    label: block.label,
  }));
  return { scenario, blocks };
}
