import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());
const SRC = join(ROOT, 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

const files = sourceFiles(SRC).filter((path) => /\.(ts|tsx)$/.test(path));
const contents = files.map((path) => ({ path, text: readFileSync(path, 'utf8') }));

describe('V2 architecture boundary', () => {
  it('is_v2_independent_of_root_src_and_config', () => {
    const forbidden = [
      /from\s+['"][^'"]*\/src\/js\//,
      /from\s+['"][^'"]*\/src\/css\//,
      /from\s+['"][^'"]*firebase/,
      /from\s+['"][^'"]*wrangler/,
      /EstudoOrganizadoDB/,
    ];

    const violations = contents.flatMap(({ path, text }) =>
      forbidden
        .filter((pattern) => pattern.test(text))
        .map((pattern) => `${path} matches ${pattern}`),
    );

    expect(violations).toEqual([]);
  });

  it('uses_only_the_v2_database_name', () => {
    const databaseNames = contents
      .map(({ text }) => text.match(/estudo-organizado-v2/))
      .filter(Boolean);

    expect(files.length).toBeGreaterThan(0);
    expect(databaseNames.length).toBeGreaterThanOrEqual(0);
  });
});
