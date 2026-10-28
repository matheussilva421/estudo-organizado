/* global process */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateF0Gate } from '../../scripts/v2-audit/validate-gate.mjs';

const AUDIT_DIR = resolve(process.cwd(), 'docs/superpowers/audits');

function readAuditJson(fileName) {
  return JSON.parse(readFileSync(resolve(AUDIT_DIR, fileName), 'utf8'));
}

const inventory = readAuditJson('2026-10-19-v1-feature-inventory.json');
const coverage = readAuditJson('2026-10-19-v1-source-coverage.json');
const schemas = readAuditJson('2026-10-19-v1-schema-matrix.json');
const risks = readAuditJson('2026-10-19-v1-risk-matrix.json');
const baseline = readAuditJson('2026-10-19-v1-qa-baseline.json');

const DECISION_REFS = Array.from(
  { length: 27 },
  (_, index) => `D${String(index + 1).padStart(2, '0')}`,
).concat('A-01');

describe('real F0 audit artifacts through the gate', () => {
  it('contains_all_28_required_decision_refs', () => {
    expect(DECISION_REFS).toHaveLength(28);
    expect(new Set(DECISION_REFS).size).toBe(28);
    expect(DECISION_REFS[0]).toBe('D01');
    expect(DECISION_REFS[26]).toBe('D27');
    expect(DECISION_REFS[27]).toBe('A-01');
  });

  it('stays_ready_for_human_review_without_approving_itself', () => {
    const result = evaluateF0Gate({
      inventory,
      coverage,
      schemas,
      risks,
      baseline,
      decision_refs: DECISION_REFS,
      human_approval_ref: '',
    });

    expect(inventory.every((row) => row.decision_status === 'PROPOSED')).toBe(true);
    expect(result.status).toBe('READY_FOR_HUMAN_REVIEW');
    expect(result.status).not.toBe('APPROVED');
    expect(result.reasons).toEqual([
      'MISSING_HUMAN_APPROVAL',
      'UNAPPROVED_DISPOSITIONS',
    ]);
  });
});
