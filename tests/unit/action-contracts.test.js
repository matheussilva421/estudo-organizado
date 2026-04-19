import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const srcDir = join(rootDir, 'src');

function read(relativePath) {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

function walkFiles(dir, predicate, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkFiles(fullPath, predicate, files);
    } else if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function collectDataActions() {
  const files = [
    join(srcDir, 'index.html'),
    ...walkFiles(join(srcDir, 'js'), file => file.endsWith('.js'))
  ];
  const actions = new Set();
  const actionPattern = /data-action=["']([^"']+)["']/g;

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(actionPattern)) {
      actions.add(match[1]);
    }
  }

  return actions;
}

function collectActionRegistryEntries() {
  const actionsSource = read('src/js/ui/actions.js');
  const entries = new Map();
  const actionKeyPattern = /^\s*['"]([a-z0-9-]+)['"]\s*:/gm;

  for (const match of actionsSource.matchAll(actionKeyPattern)) {
    const line = actionsSource.slice(0, match.index).split('\n').length;
    const key = match[1];
    if (!entries.has(key)) entries.set(key, []);
    entries.get(key).push(line);
  }

  return entries;
}

function collectMainLegacyCases() {
  const mainSource = read('src/js/main.js');
  return new Set([...mainSource.matchAll(/case\s+['"]([^'"]+)['"]\s*:/g)].map(match => match[1]));
}

describe('data-action contracts', () => {
  it('keeps one canonical handler per action in the central registry', () => {
    const entries = collectActionRegistryEntries();
    const duplicates = [...entries.entries()]
      .filter(([, lines]) => lines.length > 1)
      .map(([key, lines]) => `${key} at lines ${lines.join(', ')}`);

    expect(duplicates).toEqual([]);
  });

  it('does not dispatch the same used action from main.js and ui/actions.js', () => {
    const usedActions = collectDataActions();
    const registryActions = new Set(collectActionRegistryEntries().keys());
    const legacyCases = collectMainLegacyCases();
    const doubleHandled = [...usedActions]
      .filter(action => registryActions.has(action) && legacyCases.has(action))
      .sort();

    expect(doubleHandled).toEqual([]);
  });

  it('has a handler for every used data-action', () => {
    const usedActions = collectDataActions();
    const registryActions = new Set(collectActionRegistryEntries().keys());
    const legacyCases = collectMainLegacyCases();
    const missing = [...usedActions]
      .filter(action => !registryActions.has(action) && !legacyCases.has(action))
      .sort();

    expect(missing).toEqual([]);
  });
});
