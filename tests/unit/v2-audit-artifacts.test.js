import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateInventory } from '../../scripts/v2-audit/validate-inventory.mjs';
import {
  assessSourceCoverage,
  discoverLegacySurfaces,
} from '../../scripts/v2-audit/source-coverage.mjs';

const REPO_ROOT = process.cwd();
const AUDIT_DIR = resolve(REPO_ROOT, 'docs/superpowers/audits');

function readJson(fileName) {
  return JSON.parse(readFileSync(resolve(AUDIT_DIR, fileName), 'utf8'));
}

const inventory = readJson('2026-10-19-v1-feature-inventory.json');
const coverage = readJson('2026-10-19-v1-source-coverage.json');

describe('real F0 audit artifacts', () => {
  it('validates_the_canonical_inventory', () => {
    expect(inventory.length).toBeGreaterThanOrEqual(40);
    expect(validateInventory(inventory)).toEqual({ ok: true, errors: [] });
  });

  it('keeps_every_destination_as_a_proposal', () => {
    for (const row of inventory) {
      expect(row.decision_status).toBe('PROPOSED');
      expect(row.approval_reference).toBeNull();
    }
  });

  it('maps_every_discovered_surface', async () => {
    const surfaces = await discoverLegacySurfaces(REPO_ROOT);
    const result = assessSourceCoverage(surfaces, inventory, coverage.exclusions);

    expect(result.unmapped).toEqual([]);
    expect(result.invalid_exclusions).toEqual([]);
    expect(result.mapped_count).toBe(surfaces.length - coverage.exclusions.length);
  });

  it('cites_only_existing_sources_and_tests', () => {
    const cited = [
      ...new Set(
        inventory.flatMap((row) => [...row.source_paths, ...row.tests]),
      ),
    ];

    expect(cited.filter((path) => !existsSync(resolve(REPO_ROOT, path)))).toEqual([]);
  });
});
