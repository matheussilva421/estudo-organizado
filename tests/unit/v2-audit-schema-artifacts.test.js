import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateSchemaMatrix } from '../../scripts/v2-audit/validate-schema-matrix.mjs';

const REPO_ROOT = process.cwd();
const MATRIX_PATH = resolve(
  REPO_ROOT,
  'docs/superpowers/audits/2026-10-19-v1-schema-matrix.json',
);
const matrix = JSON.parse(readFileSync(MATRIX_PATH, 'utf8'));

describe('real F0 schema matrix', () => {
  it('validates_the_canonical_matrix', () => {
    expect(matrix.length).toBeGreaterThanOrEqual(37);
    expect(validateSchemaMatrix(matrix)).toEqual({ ok: true, errors: [] });
  });

  it('cites_only_existing_paths', () => {
    const cited = [
      ...new Set(
        matrix.flatMap((row) => [
          ...row.source_paths,
          ...row.export_paths,
          ...row.import_paths,
          ...row.sync_paths,
        ]),
      ),
    ];

    expect(cited.filter((path) => !existsSync(resolve(REPO_ROOT, path)))).toEqual([]);
  });

  it('keeps_every_row_anchored_in_source_code', () => {
    for (const row of matrix) {
      expect(row.source_paths.some((path) => path.startsWith('src/'))).toBe(true);
    }
  });
});
