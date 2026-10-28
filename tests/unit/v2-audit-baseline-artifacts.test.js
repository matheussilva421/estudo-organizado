import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  computeBaselineGate,
  validateBaseline,
} from '../../scripts/v2-audit/validate-baseline.mjs';

const REPO_ROOT = process.cwd();
const BASELINE_PATH = resolve(
  REPO_ROOT,
  'docs/superpowers/audits/2026-10-19-v1-qa-baseline.json',
);
const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));

describe('real F0 QA baseline', () => {
  it('validates_the_canonical_baseline', () => {
    expect(validateBaseline(baseline)).toEqual({ ok: true, errors: [] });
    expect(baseline.some((row) => row.area === 'IMPECCABLE')).toBe(true);
  });

  it('keeps_the_visual_gate_explicit', () => {
    expect(computeBaselineGate(baseline)).toBe('PASS');
  });

  it('cites_only_existing_evidence', () => {
    const refs = baseline
      .map((row) => row.evidence_ref)
      .filter((ref) => typeof ref === 'string' && ref.trim());

    expect(refs.filter((ref) => !existsSync(resolve(REPO_ROOT, ref)))).toEqual([]);
  });

  it('preserves_real_failures_and_not_run_rows', () => {
    const statuses = new Set(baseline.map((row) => row.status));

    expect(statuses.has('FAIL')).toBe(true);
    expect(statuses.has('NOT_RUN')).toBe(true);
  });
});
