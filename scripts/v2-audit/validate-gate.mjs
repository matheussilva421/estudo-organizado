import { validateInventory } from './validate-inventory.mjs';
import { validateRiskMatrix } from './validate-risk-matrix.mjs';
import { validateSchemaMatrix } from './validate-schema-matrix.mjs';
import {
  computeBaselineGate,
  validateBaseline,
} from './validate-baseline.mjs';

const REQUIRED_DECISION_REFS = Object.freeze([
  'D01',
  'D02',
  'D03',
  'D04',
  'D05',
  'D06',
  'D07',
  'D08',
  'D09',
  'D10',
  'D11',
  'D12',
  'D13',
  'D14',
  'D15',
  'D16',
  'D17',
  'D18',
  'D19',
  'D20',
  'D21',
  'D22',
  'D23',
  'D24',
  'D25',
  'D26',
  'D27',
  'A-01',
]);

const REASON_ORDER = Object.freeze([
  'INVENTORY_INVALID',
  'COVERAGE_UNMAPPED',
  'SCHEMA_INVALID',
  'RISK_INVALID',
  'BASELINE_INVALID',
  'VISUAL_GATE_BLOCKED',
  'MISSING_DECISION_REFS',
  'OPEN_CRITICAL_RISK',
  'MISSING_HUMAN_APPROVAL',
  'UNAPPROVED_DISPOSITIONS',
]);

const NON_HUMAN_BLOCKERS = Object.freeze(
  REASON_ORDER.filter(
    (reason) =>
      reason !== 'MISSING_HUMAN_APPROVAL' &&
      reason !== 'UNAPPROVED_DISPOSITIONS',
  ),
);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function readCoverageField(coverage, field) {
  if (!isRecord(coverage)) return undefined;
  if (Object.prototype.hasOwnProperty.call(coverage, field)) {
    return coverage[field];
  }
  if (
    isRecord(coverage.verification) &&
    Object.prototype.hasOwnProperty.call(coverage.verification, field)
  ) {
    return coverage.verification[field];
  }
  return undefined;
}

function normalizeDecisionRef(value) {
  if (typeof value === 'string') return value.trim();
  if (isRecord(value) && typeof value.id === 'string') return value.id.trim();
  return '';
}

function hasCompleteDecisionRefs(decisionRefs) {
  if (!Array.isArray(decisionRefs)) return false;

  const refs = new Set(
    decisionRefs.map(normalizeDecisionRef).filter((ref) => ref.length > 0),
  );

  return (
    refs.size === REQUIRED_DECISION_REFS.length &&
    REQUIRED_DECISION_REFS.every((ref) => refs.has(ref))
  );
}

function hasOpenCriticalRisk(risks) {
  if (!Array.isArray(risks)) return false;
  return risks.some(
    (row) =>
      isRecord(row) &&
      row.severity === 'CRITICAL' &&
      row.status !== 'MITIGATED',
  );
}

function hasApprovedDisposition(row) {
  // validateInventory already enforces the approval-reference pattern.
  return (
    isRecord(row) &&
    row.decision_status === 'APPROVED' &&
    isNonEmptyString(row.approval_reference)
  );
}

/**
 * Evaluates the F0 audit gate without reading files or mutating its input.
 *
 * @param {{
 *   inventory?: unknown,
 *   coverage?: unknown,
 *   schemas?: unknown,
 *   risks?: unknown,
 *   baseline?: unknown,
 *   decision_refs?: unknown,
 *   human_approval_ref?: unknown,
 * }} input
 * @returns {{ status: 'BLOCKED'|'READY_FOR_HUMAN_REVIEW'|'APPROVED', reasons: string[] }}
 */
export function evaluateF0Gate({
  inventory,
  coverage,
  schemas,
  risks,
  baseline,
  decision_refs: decisionRefs,
  human_approval_ref: humanApprovalRef,
} = {}) {
  const reasons = new Set();

  const inventoryResult = validateInventory(inventory);
  if (!inventoryResult.ok) reasons.add('INVENTORY_INVALID');

  const unmapped = readCoverageField(coverage, 'unmapped');
  const invalidExclusions = readCoverageField(coverage, 'invalid_exclusions');
  const coverageComplete =
    Array.isArray(unmapped) &&
    unmapped.length === 0 &&
    (invalidExclusions === undefined ||
      (Array.isArray(invalidExclusions) && invalidExclusions.length === 0));
  if (!coverageComplete) reasons.add('COVERAGE_UNMAPPED');

  if (!validateSchemaMatrix(schemas).ok) reasons.add('SCHEMA_INVALID');
  if (!validateRiskMatrix(risks).ok) reasons.add('RISK_INVALID');

  const baselineResult = validateBaseline(baseline);
  if (!baselineResult.ok) {
    reasons.add('BASELINE_INVALID');
  } else if (computeBaselineGate(baseline) !== 'PASS') {
    reasons.add('VISUAL_GATE_BLOCKED');
  }

  if (!hasCompleteDecisionRefs(decisionRefs)) {
    reasons.add('MISSING_DECISION_REFS');
  }
  if (hasOpenCriticalRisk(risks)) reasons.add('OPEN_CRITICAL_RISK');

  const hasHumanApproval = isNonEmptyString(humanApprovalRef);
  if (!hasHumanApproval) reasons.add('MISSING_HUMAN_APPROVAL');

  const dispositionsApproved =
    inventoryResult.ok &&
    inventory.every((row) => hasApprovedDisposition(row));
  if (inventoryResult.ok && !dispositionsApproved) {
    reasons.add('UNAPPROVED_DISPOSITIONS');
  }

  const hasNonHumanBlocker = NON_HUMAN_BLOCKERS.some((reason) =>
    reasons.has(reason),
  );

  let status;
  if (hasNonHumanBlocker) {
    status = 'BLOCKED';
  } else if (!hasHumanApproval || !dispositionsApproved) {
    status = 'READY_FOR_HUMAN_REVIEW';
  } else {
    status = 'APPROVED';
  }

  return {
    status,
    reasons: REASON_ORDER.filter((reason) => reasons.has(reason)),
  };
}
