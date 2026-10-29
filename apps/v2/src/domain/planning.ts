import type { Id } from './edital';
import { validateCivilDate } from './planning-time';

/**
 * F3 planning domain.
 *
 * Pure contracts only: no React, no IndexedDB and no F2 repository imports.
 * Every validator is deterministic and never mutates the value it receives.
 */

export type PlanningKind = 'CYCLE' | 'FINAL_STRETCH';

export type ScenarioStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'CLOSED'
  | 'ARCHIVED';

export type BlockAllocation =
  | 'PROJECTED'
  | 'CONFIRMED_DAY'
  | 'CONFIRMED_TIME'
  | 'UNALLOCATED';

/** `YYYY-MM-DD` in the proleptic Gregorian calendar, never a timestamp. */
export type CivilDate = string;

export const SCENARIO_STATUSES: readonly ScenarioStatus[] = [
  'DRAFT',
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'CLOSED',
  'ARCHIVED',
];

export const BLOCK_ALLOCATIONS: readonly BlockAllocation[] = [
  'PROJECTED',
  'CONFIRMED_DAY',
  'CONFIRMED_TIME',
  'UNALLOCATED',
];

export const PLANNING_KINDS: readonly PlanningKind[] = ['CYCLE', 'FINAL_STRETCH'];

export type PlanningScenario = {
  id: Id;
  profileId: Id;
  editalId: Id;
  kind: PlanningKind;
  name: string;
  status: ScenarioStatus;
  localRevision: number;
  schemaVersion: number;
  priorityProfileId: string;
  priorityProfileRevision: number;
  provenance?: string;
  examDate?: CivilDate | null;
  referenceZone: string;
  /** Renewal horizon of the flexible cycle projection, in days. */
  cycleHorizonDays?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type PlanBlock = {
  id: Id;
  profileId: Id;
  editalId: Id;
  scenarioId: Id;
  editalDisciplineId: Id;
  assuntoId?: Id;
  aulaId?: Id;
  plannedMinutes: number;
  allocation: BlockAllocation;
  civilDate?: CivilDate;
  localStart?: string;
  localEnd?: string;
  timeZone?: string;
  offsetChoice?: string;
  priority: number;
  localRevision: number;
  sourceOperationId: Id;
  /** Display snapshot resolved from F2 content; never an identity. */
  label?: string;
  /** Why a block is UNALLOCATED; never a silent removal. */
  reason?: string;
};

export type PlanningScope = {
  profileId: Id;
  operationId: Id;
  baseRevision?: number | null;
};

export type PlanningOutcome<T> =
  | { kind: 'LOCAL_COMMITTED'; value: T }
  | { kind: 'CONFLICT'; current?: unknown }
  | { kind: 'INVALID'; code: string }
  | { kind: 'BLOCKED'; reason: string }
  | { kind: 'FAILED'; reason: string };

export type PlanningScenarioSnapshot = {
  scenario: PlanningScenario;
  blocks: PlanBlock[];
};

export class PlanningValidationError extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'PlanningValidationError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new PlanningValidationError(code);
}

function assertIdentifier(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(code);
  return value;
}

function assertPositiveInteger(value: unknown, code: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) fail(code);
  return value;
}

/** Structural CivilDate check delegated to the single time authority. */
function assertCivilDate(value: unknown): CivilDate {
  if (typeof value !== 'string') fail('INVALID_CIVIL_DATE');
  try {
    return validateCivilDate(value);
  } catch {
    return fail('INVALID_CIVIL_DATE');
  }
}

/**
 * Validates a scenario and returns a shallow copy, so callers may keep using
 * the original value as a base snapshot.
 */
export function validateScenario(value: PlanningScenario): PlanningScenario {
  if (!value || typeof value !== 'object') fail('INVALID_SCENARIO');
  assertIdentifier(value.id, 'IDENTIFIER_REQUIRED');
  assertIdentifier(value.profileId, 'IDENTIFIER_REQUIRED');
  assertIdentifier(value.editalId, 'IDENTIFIER_REQUIRED');
  assertIdentifier(value.name, 'IDENTIFIER_REQUIRED');
  assertIdentifier(value.referenceZone, 'IDENTIFIER_REQUIRED');
  assertIdentifier(value.priorityProfileId, 'IDENTIFIER_REQUIRED');
  if (!PLANNING_KINDS.includes(value.kind)) fail('INVALID_KIND');
  if (!SCENARIO_STATUSES.includes(value.status)) fail('INVALID_STATUS');
  assertPositiveInteger(value.localRevision, 'INVALID_REVISION');
  assertPositiveInteger(value.schemaVersion, 'INVALID_SCHEMA_VERSION');
  assertPositiveInteger(value.priorityProfileRevision, 'INVALID_PRIORITY_REVISION');

  if (value.kind === 'FINAL_STRETCH') {
    if (value.examDate === null || value.examDate === undefined) fail('EXAM_DATE_REQUIRED');
    assertCivilDate(value.examDate);
  } else if (value.examDate !== null && value.examDate !== undefined) {
    // A cycle never receives an invented exam date; confirming a date is an
    // assisted transition to FINAL_STRETCH instead.
    fail('CYCLE_FORBIDS_EXAM_DATE');
  }

  if (value.cycleHorizonDays !== undefined) {
    assertPositiveInteger(value.cycleHorizonDays, 'INVALID_HORIZON');
  }

  return { ...value };
}

export type PlanBlockContext = {
  profileId?: Id;
  editalId?: Id;
  scenarioId?: Id;
};

/**
 * Validates a block. Optional context rejects records whose scope drifts from
 * the scenario/edital that owns them.
 */
export function validatePlanBlock(
  value: PlanBlock,
  context: PlanBlockContext = {},
): PlanBlock {
  if (!value || typeof value !== 'object') fail('INVALID_BLOCK');
  assertIdentifier(value.id, 'IDENTIFIER_REQUIRED');
  assertIdentifier(value.profileId, 'IDENTIFIER_REQUIRED');
  assertIdentifier(value.editalId, 'IDENTIFIER_REQUIRED');
  assertIdentifier(value.scenarioId, 'IDENTIFIER_REQUIRED');
  assertIdentifier(value.editalDisciplineId, 'IDENTIFIER_REQUIRED');
  assertIdentifier(value.sourceOperationId, 'IDENTIFIER_REQUIRED');
  if (
    typeof value.plannedMinutes !== 'number' ||
    !Number.isInteger(value.plannedMinutes) ||
    value.plannedMinutes <= 0
  ) {
    fail('INVALID_MINUTES');
  }
  if (!BLOCK_ALLOCATIONS.includes(value.allocation)) fail('INVALID_ALLOCATION');
  if (typeof value.priority !== 'number' || !Number.isFinite(value.priority)) {
    fail('INVALID_PRIORITY');
  }
  assertPositiveInteger(value.localRevision, 'INVALID_REVISION');

  if (context.profileId !== undefined && value.profileId !== context.profileId) {
    fail('PROFILE_MISMATCH');
  }
  if (context.editalId !== undefined && value.editalId !== context.editalId) {
    fail('EDITAL_MISMATCH');
  }
  if (context.scenarioId !== undefined && value.scenarioId !== context.scenarioId) {
    fail('SCENARIO_MISMATCH');
  }

  if (value.civilDate !== undefined && value.civilDate !== null) {
    assertCivilDate(value.civilDate);
  }

  if (value.allocation === 'CONFIRMED_DAY' || value.allocation === 'CONFIRMED_TIME') {
    if (value.civilDate === undefined || value.civilDate === null) fail('DATE_REQUIRED');
  }
  if (value.allocation === 'CONFIRMED_TIME') {
    assertIdentifier(value.localStart, 'START_REQUIRED');
    assertIdentifier(value.localEnd, 'END_REQUIRED');
    assertIdentifier(value.timeZone, 'ZONE_REQUIRED');
  }

  return { ...value };
}

/** A scenario occupies official capacity only while ACTIVE. */
export function isActiveScenario(scenario: PlanningScenario): boolean {
  return scenario.status === 'ACTIVE';
}

export function scenarioKey(profileId: Id, scenarioId: Id): string {
  return `${profileId}::${scenarioId}`;
}

export type ScenarioActivationInput = {
  profileId: Id;
  editalId: Id;
  nextScenarioId: Id;
  scenarios: PlanningScenario[];
  blocks: PlanBlock[];
};

export type ScenarioActivationPreview = {
  profileId: Id;
  editalId: Id;
  nextScenarioId: Id;
  /** Scenarios of this edital that stop being official. */
  deactivatedScenarioIds: Id[];
  /** Every scenario touched by the swap, including the next one. */
  affectedScenarioIds: Id[];
  /** Blocks whose official capacity reservation changes. */
  affectedBlockIds: Id[];
  /** The swap is never allowed without a proven checkpoint. */
  requiresCheckpoint: true;
  warnings: string[];
};

/**
 * Pure preview of an activation. Scenarios from other editais and other
 * profiles are never touched, and an INACTIVE scenario never reserves
 * capacity, so it is not part of the swap.
 */
export function previewScenarioActivation(
  input: ScenarioActivationInput,
): ScenarioActivationPreview {
  const siblings = input.scenarios.filter(
    (scenario) =>
      scenario.profileId === input.profileId && scenario.editalId === input.editalId,
  );
  const next = siblings.find((scenario) => scenario.id === input.nextScenarioId);
  if (!next) {
    throw new PlanningValidationError('SCENARIO_NOT_FOUND');
  }
  if (next.status === 'ARCHIVED' || next.status === 'CLOSED') {
    throw new PlanningValidationError('SCENARIO_NOT_ACTIVATABLE');
  }

  const deactivated = siblings
    .filter(
      (scenario) =>
        scenario.id !== input.nextScenarioId &&
        scenario.status === 'ACTIVE',
    )
    .map((scenario) => scenario.id);

  const deactivatedSet = new Set(deactivated);
  const affectedBlockIds = input.blocks
    .filter(
      (block) =>
        block.profileId === input.profileId &&
        deactivatedSet.has(block.scenarioId),
    )
    .map((block) => block.id);

  const warnings: string[] = [];
  if (deactivated.length > 0) {
    warnings.push('CAPACITY_RELEASED_FROM_PREVIOUS_SCENARIO');
  }
  if (next.status !== 'ACTIVE') {
    warnings.push('ACTIVATION_REQUIRES_CONFIRMATION');
  }

  return {
    profileId: input.profileId,
    editalId: input.editalId,
    nextScenarioId: input.nextScenarioId,
    deactivatedScenarioIds: deactivated,
    affectedScenarioIds: [...deactivated, input.nextScenarioId],
    affectedBlockIds,
    requiresCheckpoint: true,
    warnings,
  };
}
