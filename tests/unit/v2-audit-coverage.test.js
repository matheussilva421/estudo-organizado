import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  assessSourceCoverage,
  discoverLegacySurfaces,
} from '../../scripts/v2-audit/source-coverage.mjs';

const temporaryRoots = [];

async function makeTemporaryRepo() {
  const root = await mkdtemp(join(tmpdir(), 'v2-audit-coverage-'));
  temporaryRoots.push(root);
  return root;
}

async function writeSource(root, relativePath) {
  const absolutePath = join(root, ...relativePath.split('/'));
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, 'export const synthetic = true;\n', 'utf8');
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('source coverage audit', () => {
  it('reports_unmapped_source', () => {
    const result = assessSourceCoverage(
      ['src/js/views/known.js', 'src/js/views/unknown.js'],
      [
        {
          source_paths: ['src/js/views/known.js'],
        },
      ],
      [],
    );

    expect(result).toEqual({
      unmapped: ['src/js/views/unknown.js'],
      invalid_exclusions: [],
      mapped_count: 1,
    });
  });

  it('accepts_justified_exclusion', () => {
    const result = assessSourceCoverage(
      ['src/js/views/known.js', 'src/js/views/helper.js'],
      [{ source_paths: ['src/js/views/known.js'] }],
      [
        {
          path: 'src/js/views/helper.js',
          reason: 'Módulo auxiliar sem superfície funcional própria.',
        },
      ],
    );

    expect(result).toEqual({
      unmapped: [],
      invalid_exclusions: [],
      mapped_count: 1,
    });
  });

  it('discovers_nested_source_file', async () => {
    const root = await makeTemporaryRepo();
    await writeSource(root, 'src/js/views/nested/deep.js');
    await writeSource(root, 'src/js/views/z-last.js');
    await writeSource(root, 'src/js/views/a-first.js');
    await writeSource(root, 'src/js/main.js');

    await expect(discoverLegacySurfaces(root)).resolves.toEqual([
      'src/js/main.js',
      'src/js/views/a-first.js',
      'src/js/views/nested/deep.js',
      'src/js/views/z-last.js',
    ]);
  });

  it('flags_invalid_exclusions', () => {
    const result = assessSourceCoverage(
      ['src/js/views/known.js'],
      [{ source_paths: ['src/js/views/known.js'] }],
      [
        { path: 'src/js/views/missing.js', reason: 'Caminho inexistente.' },
        { path: 'src/js/views/known.js', reason: '   ' },
      ],
    );

    expect(result.unmapped).toEqual([]);
    expect(result.invalid_exclusions).toEqual([
      'src/js/views/missing.js',
      'src/js/views/known.js',
    ]);
    expect(result.mapped_count).toBe(1);
  });
});
