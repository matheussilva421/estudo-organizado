import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  auditBusinessEquivalence, convertBackupV12, reconstituteBackupV12,
} from '../src/js/sync/v1-next/backup-codec.js';

// Approved SPEC baseline, not observations from a private run of this script.
export const CANONICAL_BACKUP_EXPECTATIONS = Object.freeze({
  sizeBytes: 1653120,
  sha256: 'f4f9af2923d3b0da9599de32e1c897ae4ef4690339b63ba1a5a9ba0059844127',
  businessCounts: Object.freeze({ editais: 4, disciplinas: 49, aulas: 792, assuntos: 1825,
    eventos: 360, habitos: 222, retaFinalBlocos: 140, tombstones: 5, planejamentoArquivado: 1 }),
  tombstonesByOrigin: Object.freeze({ root: 3, config: 2 }),
  habitCounts: Object.freeze({ questoes: 87, revisao: 1, discursiva: 0, simulado: 0,
    leitura: 54, informativo: 0, sumula: 0, videoaula: 26, paginas: 54 }),
  historicalUnresolvedReferences: Object.freeze({ aulaId: 57, rfBlocoId: 86 }),
  rfBlocoIdPresent: 226,
  habitEventsUnresolved: 0,
});

const disabled = () => ({ status: 'DISABLED', checks: [] });
const failure = check => ({ status: 'FAIL', checks: [{ check, ok: false }] });
const equalCounts = (actual, expected) => expected !== null && typeof expected === 'object' &&
  Object.keys(actual).length === Object.keys(expected).length &&
  Object.keys(actual).every(key => Object.hasOwn(expected, key) && actual[key] === expected[key]);

/** Pure in-memory verification. Output contains fixed check names and booleans
 * only: never the input path, payload, dynamic IDs/keys or caught error messages.
 */
export function verifyBackupBytes(bytes, expected = CANONICAL_BACKUP_EXPECTATIONS) {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) return failure('sourceBytes');
  const checks = [];
  const check = (name, ok) => checks.push({ check: name, ok: Boolean(ok) });
  const summary = () => ({ status: checks.every(item => item.ok) ? 'PASS' : 'FAIL', checks });
  check('sizeBytes', bytes.byteLength === expected.sizeBytes);
  check('sha256', createHash('sha256').update(bytes).digest('hex') === expected.sha256);
  // Verify the original bytes, never a parsed/reformatted version of the JSON.
  if (checks.some(item => !item.ok)) return summary();
  let stage = 'schemaAndConversion';
  try {
    const raw = JSON.parse(Buffer.from(bytes).toString('utf8'));
    const converted = convertBackupV12(raw);
    check(stage, true);
    check('businessCounts', equalCounts(converted.manifestDraft.businessCounts, expected.businessCounts));
    check('tombstonesByOrigin', equalCounts({
      root: converted.records.tombstones.filter(record => record.path[0] === 'syncTombstones').length,
      config: converted.records.tombstones.filter(record => record.path[0] === 'config').length,
    }, expected.tombstonesByOrigin));
    const habitCounts = Object.fromEntries(Object.keys(CANONICAL_BACKUP_EXPECTATIONS.habitCounts)
      .map(type => [type, raw.habitos[type]?.length || 0]));
    check('habitCounts', equalCounts(habitCounts, expected.habitCounts) &&
      Object.keys(raw.habitos).every(type => Object.hasOwn(habitCounts, type)));
    check('historicalUnresolvedReferences', equalCounts(
      converted.manifestDraft.historicalUnresolvedReferences, expected.historicalUnresolvedReferences));
    check('rfBlocoIdPresent', raw.eventos.filter(event => event.rfBlocoId !== undefined &&
      event.rfBlocoId !== null && event.rfBlocoId !== '').length === expected.rfBlocoIdPresent);
    const eventIds = new Set(raw.eventos.map(event => event.id));
    check('habitEventsUnresolved', Object.values(raw.habitos).flat()
      .filter(habit => !eventIds.has(habit.eventoId)).length === expected.habitEventsUnresolved);
    stage = 'reconstruction';
    // Simulate records returned over JSON in a different read order.
    const wireRecords = JSON.parse(JSON.stringify(converted.records));
    Object.values(wireRecords).forEach(records => records.reverse());
    const restored = reconstituteBackupV12(wireRecords);
    check('businessEquivalence', auditBusinessEquivalence(raw, restored).ok);
    check('businessDigest', convertBackupV12(restored).manifestDraft.businessDigest ===
      converted.manifestDraft.businessDigest);
  } catch {
    check(stage, false);
  }
  return summary();
}

export async function runPrivateVerification({ authorized = false, backupPath,
  readBytes = readFile, expected = CANONICAL_BACKUP_EXPECTATIONS } = {}) {
  if (authorized !== true) return disabled();
  if (typeof backupPath !== 'string' || !backupPath.trim()) return failure('backupPath');
  try {
    return verifyBackupBytes(await readBytes(backupPath), expected);
  } catch {
    return failure('readSource');
  }
}

// Future authorized use only:
// node scripts/verify-v1-backup.mjs --authorize-private-read --path <local-file>
// With the same authorization flag, ESTUDO_V1_BACKUP_PATH can supply the path.
// Without the flag even the environment is not consulted; imports do no I/O.
export async function main(args = [], env = process.env,
  output = result => console.log(JSON.stringify(result)), readBytes = readFile) {
  if (!args.includes('--authorize-private-read')) {
    output(disabled());
    return 0;
  }
  let backupPath;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--authorize-private-read') continue;
    if (args[i] === '--path' && backupPath === undefined && args[i + 1] &&
      !args[i + 1].startsWith('--')) backupPath = args[++i];
    else {
      output(failure('arguments'));
      return 1;
    }
  }
  const result = await runPrivateVerification({ authorized: true,
    backupPath: backupPath ?? env.ESTUDO_V1_BACKUP_PATH, readBytes });
  output(result);
  return result.status === 'PASS' ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
