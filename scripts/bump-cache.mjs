#!/usr/bin/env node
/**
 * Bump automático do cache do PWA (APP_VERSION).
 *
 * Atualiza em sincronia a versão de cache nos quatro arquivos acoplados:
 *   - src/sw.js                              (APP_VERSION = 'X.YY')
 *   - src/index.html                         (query strings ?v=X.YY)
 *   - src/js/sync/sync-diagnostic.js         (DIAGNOSTIC_BUILD_VERSION = 'X.YY')
 *   - tests/unit/css-architecture.test.js    (asserções que fixam a versão)
 *
 * Substitui APENAS a versão atual exata lida de src/sw.js, portanto os
 * import specifiers congelados (?v=8.37) nunca são tocados.
 *
 * Uso:
 *   node scripts/bump-cache.mjs            # incrementa (9.02 -> 9.03)
 *   node scripts/bump-cache.mjs --set X.YY # define versão explícita
 *   node scripts/bump-cache.mjs --check    # sai com 1 se src/ mudou vs HEAD
 *                                          # sem bump de versão
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const VERSION_RE = /^\d+\.\d{2}$/;

const SW_FILE = 'src/sw.js';
const SYNC_FILES = [
  SW_FILE,
  'src/index.html',
  'src/js/sync/sync-diagnostic.js',
  'tests/unit/css-architecture.test.js'
];

function assertVersionFormat(version) {
  if (typeof version !== 'string' || !VERSION_RE.test(version)) {
    throw new Error(
      `Versão inválida: "${version}". O formato exigido é MAJOR.MM com exatamente duas casas decimais (ex.: 9.03).`
    );
  }
}

export function nextVersion(version) {
  assertVersionFormat(version);
  const [major, minor] = version.split('.').map(Number);
  const carried = minor === 99;
  const nextMajor = carried ? major + 1 : major;
  const nextMinor = carried ? 0 : minor + 1;
  return `${nextMajor}.${String(nextMinor).padStart(2, '0')}`;
}

export function readCurrentVersion(rootDir) {
  const sw = fs.readFileSync(path.join(rootDir, SW_FILE), 'utf8');
  const match = sw.match(/const APP_VERSION = '(\d+\.\d{2})';/);
  if (!match) {
    throw new Error(`Não encontrei "const APP_VERSION = 'X.YY';" em ${SW_FILE}.`);
  }
  return match[1];
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function bumpFiles(rootDir, { to } = {}) {
  const from = readCurrentVersion(rootDir);
  const target = to ?? nextVersion(from);
  assertVersionFormat(target);
  if (target === from) {
    throw new Error(`A nova versão (${target}) é igual à atual — nada a fazer.`);
  }

  // Só a versão atual em contexto de cache busting é substituída:
  // "?v=<atual>" (query strings) e "'<atual>'" (constantes/asserções).
  const pattern = new RegExp(
    `(\\?v=${escapeRegExp(from)})|('${escapeRegExp(from)}')`,
    'g'
  );

  const updates = SYNC_FILES.map((rel) => {
    const abs = path.join(rootDir, rel);
    const before = fs.readFileSync(abs, 'utf8');
    let count = 0;
    const after = before.replace(pattern, (match) => {
      count += 1;
      return match.startsWith('?v=') ? `?v=${target}` : `'${target}'`;
    });
    if (count === 0) {
      throw new Error(
        `Nenhuma ocorrência da versão ${from} em ${rel} — os arquivos saíram de sincronia; corrija manualmente antes do bump.`
      );
    }
    return { rel, abs, after, count };
  });

  // Validação completa antes de escrever qualquer arquivo (bump atômico).
  for (const { abs, after } of updates) {
    fs.writeFileSync(abs, after, 'utf8');
  }

  return {
    from,
    to: target,
    files: updates.map(({ rel, count }) => ({ file: rel, occurrences: count }))
  };
}

const CACHEABLE_SRC_RE = /^src\/.*\.(html|css|js|json|svg|png|webmanifest)$/;

function checkBump(rootDir) {
  const git = (...args) =>
    execFileSync('git', args, { cwd: rootDir, encoding: 'utf8' });

  const changed = git('diff', 'HEAD', '--name-only')
    .split('\n')
    .filter((file) => CACHEABLE_SRC_RE.test(file));
  if (changed.length === 0) {
    console.log('bump-cache --check: nenhum asset de src/ alterado vs HEAD.');
    return 0;
  }

  const current = readCurrentVersion(rootDir);
  const headSw = git('show', `HEAD:${SW_FILE}`);
  const headMatch = headSw.match(/const APP_VERSION = '(\d+\.\d{2})';/);
  if (headMatch && headMatch[1] === current) {
    console.error(
      `bump-cache --check: ${changed.length} asset(s) de src/ alterado(s) mas APP_VERSION continua ${current}. Rode "npm run bump".`
    );
    return 1;
  }

  console.log(`bump-cache --check: ok (APP_VERSION ${current}).`);
  return 0;
}

function main() {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);

  if (args.includes('--check')) {
    process.exit(checkBump(rootDir));
  }

  const setIndex = args.indexOf('--set');
  const to = setIndex >= 0 ? args[setIndex + 1] : undefined;

  const result = bumpFiles(rootDir, { to });
  console.log(`bump-cache: ${result.from} -> ${result.to}`);
  for (const { file, occurrences } of result.files) {
    console.log(`  ${file} (${occurrences} ocorrência(s))`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
