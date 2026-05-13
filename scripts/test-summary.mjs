#!/usr/bin/env node

/**
 * test-summary.mjs — Run a command and print a compact test summary.
 *
 * Usage:
 *   node scripts/test-summary.mjs -- <command> [args...]
 *
 * Saves full output to test-results/latest-command.log
 * Prints only: command, exit code, test summary, first failure, log path.
 *
 * Handles both Vitest and Playwright output formats.
 * Zero dependencies — only Node.js built-ins.
 */

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const RESULTS_DIR = join(PROJECT_ROOT, 'test-results');
const LOG_FILE = join(RESULTS_DIR, 'latest-command.log');

/* ── Argument parsing ── */

const dashIndex = process.argv.indexOf('--');
if (dashIndex === -1 || dashIndex === process.argv.length - 1) {
  console.error('Usage: node scripts/test-summary.mjs -- <command> [args...]');
  process.exit(1);
}

const cmdString = process.argv.slice(dashIndex + 1).join(' ');

/* ── Ensure output directory ── */

mkdirSync(RESULTS_DIR, { recursive: true });

/* ── Execute command ── */

let fullOutput = '';

const child = spawn(cmdString, [], { shell: true, cwd: PROJECT_ROOT });

child.stdout.on('data', (d) => { fullOutput += d.toString(); });
child.stderr.on('data', (d) => { fullOutput += d.toString(); });

child.on('error', (err) => {
  writeFileSync(LOG_FILE, `Failed to start: ${err.message}\n`, 'utf-8');
  console.error(`\n  Error: ${err.message}`);
  process.exit(1);
});

child.on('close', (code) => {
  const trimmed = fullOutput.trimEnd() + '\n';
  writeFileSync(LOG_FILE, trimmed, 'utf-8');

  const lines = trimmed.split('\n');

  /* ── Print compact summary ── */

  console.log(`> ${cmdString}`);
  console.log(`exit code: ${code}`);

  const summary = extractSummary(lines);
  if (summary) console.log(summary);

  const failure = extractFirstFailure(lines);
  if (failure) console.log(`\n${failure}`);

  console.log(`\nFull log: ${LOG_FILE}`);

  process.exit(code ?? 1);
});

/* ── Helpers ── */

/** Strip ANSI escape codes from a string. */
function stripAnsi(s) {
  return s.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

/* ── Parsing helpers ── */

function extractSummary(lines) {
  const found = [];

  for (const line of lines) {
    const clean = stripAnsi(line).trim();

    // Vitest: "Test Files  1 passed (1)" / "Tests  3 passed (3)"
    if (/^(Test Files|Tests)\s+\d+/.test(clean) && /(passed|failed|skipped)/.test(clean)) {
      found.push(clean);
      continue;
    }

    // Vitest: "Duration  2.34s"
    if (/^Duration\s+\d/.test(clean)) {
      found.push(clean);
      continue;
    }

    // Playwright: "1 passed (1.2s)" / "1 failed" or "... ✓ 1 passed [chromium]"
    if (/^\d+\s+(passed|failed|skipped)/.test(clean) && !/^Running\s/.test(clean)) {
      if (!found.includes(clean)) found.push(clean);
    }
  }

  return found.length > 0 ? found.join('\n') : null;
}

function extractFirstFailure(lines) {
  for (const line of lines) {
    const clean = stripAnsi(line).trim();

    // Vitest failure header: "FAIL  tests/foo.test.js > ..."
    if (/^FAIL /.test(clean)) return clean;

    // Playwright failure symbol
    if (clean.startsWith('\u2718')) return clean;

    // Exact "FAIL " prefix (Vitest also uses this sometimes)
    if (clean.startsWith('FAIL ')) return clean;
  }
  return null;
}
