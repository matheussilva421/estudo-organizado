#!/usr/bin/env node

/**
 * Context Map Generator
 *
 * Scans src/js/ for all .js files, counts exports/imports per file,
 * and produces a JSON context map + compact stdout summary.
 *
 * Usage: node scripts/context-map.mjs
 */

import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_JS = join(ROOT, 'src', 'js');
const EXCLUDED_DIRS = new Set(['node_modules', 'vendor', 'firebase']);
const OUTPUT_PATH = join(ROOT, 'docs', 'context-map.json');

// Patterns for counting
const EXPORT_PATTERNS = [
  /^export\s+(function|const|let|var|class)\s+\w+/gm,
  /^export\s+default\s+(function|class|const|let)\s+\w+/gm,
  /^export\s+\{\s*[\w\s,/*]+\s*\}/gm,
  /^export\s+\*\s+from/gm,
];

const IMPORT_PATTERNS = [
  /import\s+\{?\s*[\w\s,/*]*\s*\}?\s+from\s+['"][^'"]+['"]/gm,
];

function isExcluded(filePath) {
  const parts = filePath.split(sep);
  return parts.some((p) => EXCLUDED_DIRS.has(p));
}

function countMatches(content, patterns) {
  const combined = patterns.map((re) => {
    const matches = content.match(re);
    return matches ? matches.length : 0;
  });
  return combined.reduce((a, b) => a + b, 0);
}

function walkDir(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (isExcluded(fullPath)) continue;

    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

function analyzeFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const stats = statSync(filePath);

  const exportCount = countMatches(content, EXPORT_PATTERNS);
  const importCount = countMatches(content, IMPORT_PATTERNS);
  const lines = content.split('\n').length;

  return {
    path: relative(ROOT, filePath).replace(/\\/g, '/'),
    sizeBytes: stats.size,
    lines,
    exports: exportCount,
    imports: importCount,
  };
}

// ── Main ──
const allFiles = walkDir(SRC_JS);
const fileResults = allFiles.map(analyzeFile);

// Sort by line count descending
fileResults.sort((a, b) => b.lines - a.lines);

const summary = {
  totalFiles: fileResults.length,
  totalLines: fileResults.reduce((s, f) => s + f.lines, 0),
  totalExports: fileResults.reduce((s, f) => s + f.exports, 0),
  totalImports: fileResults.reduce((s, f) => s + f.imports, 0),
  totalSizeBytes: fileResults.reduce((s, f) => s + f.sizeBytes, 0),
};

const output = {
  generatedAt: new Date().toISOString(),
  summary,
  files: fileResults,
};

// Save full JSON
writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

// ── Compact stdout summary ──
console.log('=== Context Map Summary ===');
console.log(`  Files:   ${summary.totalFiles}`);
console.log(`  Lines:   ${summary.totalLines}`);
console.log(`  Exports: ${summary.totalExports}`);
console.log(`  Imports: ${summary.totalImports}`);
console.log(`  Size:    ${(summary.totalSizeBytes / 1024).toFixed(0)} KB`);
console.log('');
console.log('Top 10 files by line count:');
console.log('');
console.log('  Lines  Exp  Imp  Path');
console.log('  ' + '-'.repeat(60));
for (const file of fileResults.slice(0, 10)) {
  const path = file.path.padEnd(45);
  const lines = String(file.lines).padStart(5);
  const exp = String(file.exports).padStart(3);
  const imp = String(file.imports).padStart(3);
  console.log(`  ${lines}  ${exp}  ${imp}  ${path}`);
}
console.log('');
console.log(`Full JSON saved to: ${relative(process.cwd(), OUTPUT_PATH).replace(/\\/g, '/')}`);
