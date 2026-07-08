import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { nextVersion, bumpFiles } from '../../scripts/bump-cache.mjs';

const FIXTURES = {
  'src/sw.js': [
    "const APP_VERSION = '9.02';",
    'const CACHE_NAME = `estudo-organizado-v${APP_VERSION}`;',
    ''
  ].join('\n'),
  'src/index.html': [
    '<link rel="stylesheet" href="css/tokens.css?v=9.02" />',
    '<link rel="stylesheet" href="css/styles.css?v=9.02" />',
    '<script src="js/sw-register.js?v=9.02" defer></script>',
    '<script type="module" src="js/main.js?v=9.02"></script>',
    ''
  ].join('\n'),
  'src/js/sync/sync-diagnostic.js': [
    "import { state } from '../store.js?v=8.37';",
    "const DIAGNOSTIC_BUILD_VERSION = '9.02';",
    ''
  ].join('\n'),
  'tests/unit/css-architecture.test.js': [
    "expect(html).toContain('css/styles.css?v=9.02');",
    "expect(serviceWorker).toContain(\"APP_VERSION = '9.02'\");",
    "expect(syncDiagnostic).toContain(\"DIAGNOSTIC_BUILD_VERSION = '9.02'\");",
    ''
  ].join('\n')
};

let root;

function writeFixtures(overrides = {}) {
  const files = { ...FIXTURES, ...overrides };
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) continue;
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'bump-cache-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('nextVersion', () => {
  it('increments the hundredths place', () => {
    expect(nextVersion('9.02')).toBe('9.03');
  });

  it('keeps two decimal places when crossing tenths', () => {
    expect(nextVersion('9.09')).toBe('9.10');
    expect(nextVersion('9.10')).toBe('9.11');
  });

  it('carries into the major number at .99', () => {
    expect(nextVersion('9.99')).toBe('10.00');
    expect(nextVersion('10.00')).toBe('10.01');
  });

  it('rejects versions that are not MAJOR.MM with two decimals', () => {
    expect(() => nextVersion('9.2')).toThrow();
    expect(() => nextVersion('9.023')).toThrow();
    expect(() => nextVersion('abc')).toThrow();
    expect(() => nextVersion('')).toThrow();
  });
});

describe('bumpFiles', () => {
  it('bumps the version in the four synchronized files', () => {
    writeFixtures();

    const result = bumpFiles(root);

    expect(result.from).toBe('9.02');
    expect(result.to).toBe('9.03');

    expect(read('src/sw.js')).toContain("APP_VERSION = '9.03';");
    expect(read('src/sw.js')).not.toContain('9.02');

    const html = read('src/index.html');
    expect(html).not.toContain('9.02');
    expect(html.match(/\?v=9\.03/g)).toHaveLength(4);

    expect(read('src/js/sync/sync-diagnostic.js')).toContain(
      "DIAGNOSTIC_BUILD_VERSION = '9.03';"
    );

    const testFile = read('tests/unit/css-architecture.test.js');
    expect(testFile).toContain("'css/styles.css?v=9.03'");
    expect(testFile).toContain("APP_VERSION = '9.03'");
    expect(testFile).toContain("DIAGNOSTIC_BUILD_VERSION = '9.03'");
    expect(testFile).not.toContain('9.02');
  });

  it('never touches the frozen ?v=8.37 ES module import specifiers', () => {
    writeFixtures();

    bumpFiles(root);

    expect(read('src/js/sync/sync-diagnostic.js')).toContain(
      "import { state } from '../store.js?v=8.37';"
    );
  });

  it('accepts an explicit target version', () => {
    writeFixtures();

    const result = bumpFiles(root, { to: '12.00' });

    expect(result.to).toBe('12.00');
    expect(read('src/sw.js')).toContain("APP_VERSION = '12.00';");
  });

  it('rejects an explicit version with the wrong format', () => {
    writeFixtures();

    expect(() => bumpFiles(root, { to: '9.3' })).toThrow(/format|formato/i);
  });

  it('rejects an explicit version equal to the current one', () => {
    writeFixtures();

    expect(() => bumpFiles(root, { to: '9.02' })).toThrow();
  });

  it('fails when a synchronized file has no occurrence of the current version', () => {
    writeFixtures({
      'src/index.html': '<link rel="stylesheet" href="css/styles.css" />\n'
    });

    expect(() => bumpFiles(root)).toThrow(/index\.html/);
  });

  it('fails when sw.js does not declare APP_VERSION', () => {
    writeFixtures({ 'src/sw.js': 'const CACHE_NAME = `x`;\n' });

    expect(() => bumpFiles(root)).toThrow(/APP_VERSION/);
  });

  it('does not rewrite any file when validation fails', () => {
    writeFixtures({
      'src/index.html': '<link rel="stylesheet" href="css/styles.css" />\n'
    });

    expect(() => bumpFiles(root)).toThrow();
    expect(read('src/sw.js')).toContain("APP_VERSION = '9.02';");
    expect(read('tests/unit/css-architecture.test.js')).toContain('9.02');
  });
});
