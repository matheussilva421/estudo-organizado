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
      /from\s+['"][^'"]*wrangler/,
      /EstudoOrganizadoDB/,
    ];

    // F7 approves the Firebase package as the V2 remote backend. Only the
    // dedicated adapters may import it; local modules whose names contain
    // "firebase" (for example ./firebase-remote) are not package imports.
    const firebasePackage = /from\s+['"]firebase(\/|['"])/;
    const allowedFirebase = new Set([
      join(SRC, 'platform', 'firebase', 'auth.ts'),
      join(SRC, 'platform', 'sync', 'firebase-remote.ts'),
    ]);

    const violations = contents.flatMap(({ path, text }) =>
      forbidden
        .filter((pattern) => pattern.test(text))
        .map((pattern) => `${path} matches ${pattern}`),
    );
    violations.push(
      ...contents
        .filter(({ path, text }) => firebasePackage.test(text) && !allowedFirebase.has(path))
        .map(({ path }) => `${path} imports the firebase package outside the F7 adapters`),
    );

    expect(violations).toEqual([]);
  });

  it('uses_only_the_v2_database_name', () => {
    const databaseNames = contents
      .map(({ text }) => text.match(/estudo-organizado-v2/))
      .filter(Boolean);

    expect(files.length).toBeGreaterThan(0);
    expect(databaseNames.length).toBeGreaterThan(0);
  });
});
