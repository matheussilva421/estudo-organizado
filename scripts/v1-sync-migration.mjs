import { createHash } from 'node:crypto';
import {
  mkdir,
  readFile as readFileFromDisk,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL, URLSearchParams } from 'node:url';
import {
  auditBusinessEquivalence,
  convertBackupV12,
  reconstituteBackupV12,
} from '../src/js/sync/v1-next/backup-codec.js';
import {
  encodeDocId,
  encodeRecordData,
  validateManifest,
  validateRecord,
} from '../src/js/sync/v1-next/contracts.js';
import { sha256Utf8 } from '../src/js/sync/v1-next/sha256.js';
import { CANONICAL_BACKUP_EXPECTATIONS } from './verify-v1-backup.mjs';

export const COLLECTION_NAMES = Object.freeze([
  'editais',
  'disciplinas',
  'eventos',
  'habitos',
  'retaFinalBlocos',
  'meta',
  'tombstones',
]);

const DEFAULT_EXPECTED_SHA256 = CANONICAL_BACKUP_EXPECTATIONS.sha256;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_PROJECT_ID = 'demo-estudo-v1-sync';
const DEFAULT_EMULATOR_HOST = '127.0.0.1:8085';
const DEFAULT_STATE_DIRECTORY = join('output', 'v1-sync-migration');
const JOURNAL_FILE = 'journal.json';
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const SUCCESS_STATUSES = new Set(['PASS', 'VERIFIED', 'ALREADY_VERIFIED', 'ACTIVE']);
const OPTION_NAMES = new Set([
  'backup',
  'batch-size',
  'emulator-host',
  'expected-sha256',
  'project',
  'state-dir',
  'target',
  'uid',
]);

class MigrationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code) {
  throw new MigrationError(code);
}

function clone(value) {
  return structuredClone(value);
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

function same(left, right) {
  return canonical(left) === canonical(right);
}

function checkItem(checks, name, ok) {
  checks.push({ check: name, ok: Boolean(ok) });
}

function timestampFrom(now) {
  const milliseconds = typeof now === 'function' ? now() : now;
  if (!Number.isFinite(milliseconds)) fail('INVALID_CLOCK');
  return {
    seconds: Math.floor(milliseconds / 1000),
    nanoseconds: (milliseconds % 1000) * 1_000_000,
  };
}

function emptyCounts() {
  return Object.fromEntries(COLLECTION_NAMES.map(name => [name, 0]));
}

function statusFor(checks) {
  return checks.every(item => item.ok) ? 'PASS' : 'FAIL';
}

/** Audit exact bytes without returning the file path, academic content or entity IDs. */
export function auditBackupBytes(bytes, {
  expectedSha256 = DEFAULT_EXPECTED_SHA256,
} = {}) {
  const checks = [];
  const sourceBytes = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  const actualSha256 = sha256Bytes(sourceBytes);
  const validExpectedHash = typeof expectedSha256 === 'string' && SHA256.test(expectedSha256);
  checkItem(checks, 'sha256', validExpectedHash && actualSha256 === expectedSha256);
  const base = {
    command: 'audit',
    source: { sizeBytes: sourceBytes.byteLength, sha256: actualSha256 },
  };
  if (!checks[0].ok) return { ...base, status: 'FAIL', checks };

  let raw;
  let converted;
  let restored;
  try {
    raw = JSON.parse(sourceBytes.toString('utf8'));
    converted = convertBackupV12(raw);
    checkItem(checks, 'schemaAndConversion', raw?.schemaVersion === 12);
  } catch {
    checkItem(checks, 'schemaAndConversion', false);
    return { ...base, status: 'FAIL', checks };
  }
  if (!checks.at(-1).ok) return { ...base, status: 'FAIL', checks };

  try {
    const reversedRecords = Object.fromEntries(COLLECTION_NAMES.map(name =>
      [name, [...converted.records[name]].reverse()]));
    restored = reconstituteBackupV12(reversedRecords);
    checkItem(checks, 'reconstruction', true);
  } catch {
    checkItem(checks, 'reconstruction', false);
  }

  if (restored) {
    const equivalence = auditBusinessEquivalence(raw, restored);
    checkItem(checks, 'businessEquivalence', equivalence.ok);
    try {
      const reconverted = convertBackupV12(restored);
      checkItem(checks, 'counts', same(reconverted.manifestDraft.counts,
        converted.manifestDraft.counts));
      checkItem(checks, 'businessDigest', reconverted.manifestDraft.businessDigest ===
        converted.manifestDraft.businessDigest);
    } catch {
      checkItem(checks, 'counts', false);
      checkItem(checks, 'businessDigest', false);
    }
  } else {
    checkItem(checks, 'businessEquivalence', false);
    checkItem(checks, 'counts', false);
    checkItem(checks, 'businessDigest', false);
  }

  return {
    ...base,
    status: statusFor(checks),
    counts: converted.manifestDraft.counts,
    businessDigest: converted.manifestDraft.businessDigest,
    checks,
  };
}

function parseBackup(bytes) {
  let raw;
  try {
    raw = JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch {
    fail('INVALID_BACKUP_JSON');
  }
  try {
    const converted = convertBackupV12(clone(raw));
    const restored = reconstituteBackupV12(converted.records);
    const equivalence = auditBusinessEquivalence(raw, restored);
    if (!equivalence.ok) fail('BACKUP_BUSINESS_MISMATCH');
    return { raw, converted };
  } catch (error) {
    if (error instanceof MigrationError) throw error;
    fail('INVALID_BACKUP');
  }
}

function generationIdentity(sourceSha256) {
  return {
    generationId: `v1_${sourceSha256.slice(0, 40)}`,
    migrationId: `m1_${sourceSha256.slice(0, 40)}`,
  };
}

function buildManifest({ generationId, migrationId, sourceSha256, businessDigest,
  counts, state, revision, updatedAt }) {
  const manifest = {
    schemaVersion: 1,
    generationId,
    migrationId,
    state,
    revision,
    sourceSha256,
    businessDigest,
    counts: clone(counts),
    updatedAt,
  };
  validateManifest(manifest);
  return manifest;
}

function buildDocuments(converted, { generationId, updatedAt }) {
  const documents = [];
  const keys = new Set();
  for (const collection of COLLECTION_NAMES) {
    for (const item of converted.records[collection]) {
      if (keys.has(item.key)) fail('DUPLICATE_LOGICAL_KEY');
      keys.add(item.key);
      const dataText = encodeRecordData(item);
      const opId = `op_${sha256Utf8(`${generationId}\0${item.key}`).slice(0, 64)}`;
      const record = {
        schemaVersion: 1,
        generationId,
        entityType: item.entityType,
        entityId: String(item.entityId),
        collection,
        revision: 1,
        baseRevision: 0,
        opId,
        opDigest: sha256Utf8(dataText),
        deleted: false,
        data: dataText,
        updatedAt: clone(updatedAt),
      };
      validateRecord(record);
      const docId = encodeDocId(item.key);
      documents.push({
        collection,
        docId,
        data: record,
        fingerprint: sha256Utf8(`${collection}\0${docId}\0${record.opDigest}`),
      });
    }
  }
  documents.sort((left, right) => {
    const collectionOrder = COLLECTION_NAMES.indexOf(left.collection) -
      COLLECTION_NAMES.indexOf(right.collection);
    if (collectionOrder !== 0) return collectionOrder;
    return left.docId < right.docId ? -1 : left.docId > right.docId ? 1 : 0;
  });
  return documents;
}

function buildBatches(documents, batchSize) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    fail('INVALID_BATCH_SIZE');
  }
  const batches = [];
  for (let start = 0; start < documents.length; start += batchSize) {
    const documentsInBatch = documents.slice(start, start + batchSize);
    batches.push({
      index: batches.length,
      documents: documentsInBatch,
      count: documentsInBatch.length,
      digest: sha256Utf8(documentsInBatch.map(item => item.fingerprint).join('\n')),
    });
  }
  return batches;
}

function planDigest(batches) {
  return sha256Utf8(batches.map(batch => `${batch.index}:${batch.count}:${batch.digest}`).join('\n'));
}

function manifestPath(generationId) {
  return ['v1SyncNamespaces', generationId];
}

function recordPath(generationId, collection, docId) {
  return ['v1SyncNamespaces', generationId, collection, docId];
}

const CONTROL_PATH = Object.freeze(['v1SyncControl', 'current']);

function sameRecord(left, right) {
  const withoutTimestamp = value => {
    const copy = clone(value);
    delete copy.updatedAt;
    return copy;
  };
  return same(withoutTimestamp(left), withoutTimestamp(right));
}

function createJournal({ target, generationId, migrationId, sourceSha256,
  businessDigest, counts, batches, batchSize, state }) {
  return {
    schemaVersion: 1,
    target,
    generationId,
    migrationId,
    sourceSha256,
    businessDigest,
    counts: clone(counts),
    batchSize,
    planDigest: planDigest(batches),
    state,
    completedBatches: [],
  };
}

function validateJournal(journal, expected) {
  if (!journal || journal.schemaVersion !== 1 || journal.target !== 'emulator' ||
    journal.generationId !== expected.generationId ||
    journal.migrationId !== expected.migrationId ||
    journal.sourceSha256 !== expected.sourceSha256 ||
    journal.businessDigest !== expected.businessDigest ||
    !same(journal.counts, expected.counts) ||
    journal.batchSize !== expected.batchSize || journal.planDigest !== expected.planDigest ||
    !Array.isArray(journal.completedBatches)) fail('JOURNAL_CONFLICT');
}

async function loadJournal(path) {
  try {
    const text = await readFileFromDisk(path, 'utf8');
    return JSON.parse(text);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    fail('INVALID_JOURNAL');
  }
}

async function writeJournal(path, journal) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(journal, null, 2) + '\n', 'utf8');
  await rm(path, { force: true });
  await rename(temporaryPath, path);
}

function journalBatchMetadata(batch, completedAt) {
  return {
    index: batch.index,
    count: batch.count,
    digest: batch.digest,
    completedAt,
  };
}

function markBatchComplete(journal, batch, now) {
  if (journal.completedBatches.some(item => item.index === batch.index)) return;
  const completedAt = new Date(typeof now === 'function' ? now() : now).toISOString();
  journal.completedBatches.push(journalBatchMetadata(batch, completedAt));
  journal.completedBatches.sort((left, right) => left.index - right.index);
}

async function writeMissingDocuments(gateway, generationId, documents) {
  const writes = [];
  for (const document of documents) {
    const path = recordPath(generationId, document.collection, document.docId);
    const existing = await gateway.getDocument(path);
    if (!existing) {
      writes.push({ type: 'create', path, data: document.data });
      continue;
    }
    try {
      validateRecord(existing.data);
    } catch {
      fail('REMOTE_RECORD_CONFLICT');
    }
    if (!sameRecord(existing.data, document.data)) fail('REMOTE_RECORD_CONFLICT');
  }
  if (writes.length) await gateway.commit(writes);
}

async function readBackDocuments(gateway, raw, converted, expectedDocuments, generationId) {
  const checks = [];
  const expectedByCollection = Object.fromEntries(COLLECTION_NAMES.map(name => [
    name,
    new Map(expectedDocuments.filter(item => item.collection === name)
      .map(item => [item.docId, item])),
  ]));
  const missingByCollection = emptyCounts();
  const invalidByCollection = emptyCounts();
  const extraByCollection = emptyCounts();
  const actualCounts = emptyCounts();
  const grouped = Object.fromEntries(COLLECTION_NAMES.map(name => [name, []]));
  let documentsRead = 0;

  for (const collection of COLLECTION_NAMES) {
    const listed = await gateway.listDocuments(['v1SyncNamespaces', generationId, collection]);
    documentsRead += listed.length;
    actualCounts[collection] = listed.length;
    const seen = new Set();
    for (const stored of listed) {
      const docId = stored.path.at(-1);
      if (seen.has(docId)) {
        invalidByCollection[collection] += 1;
        continue;
      }
      seen.add(docId);
      const expected = expectedByCollection[collection].get(docId);
      if (!expected) {
        extraByCollection[collection] += 1;
        continue;
      }
      try {
        validateRecord(stored.data);
        if (!sameRecord(stored.data, expected.data)) throw new Error('mismatch');
        grouped[collection].push(JSON.parse(stored.data.data));
      } catch {
        invalidByCollection[collection] += 1;
      }
    }
    for (const docId of expectedByCollection[collection].keys()) {
      if (!seen.has(docId)) missingByCollection[collection] += 1;
    }
  }

  const expectedCounts = expectedDocuments.reduce((counts, document) => {
    counts[document.collection] += 1;
    return counts;
  }, emptyCounts());
  checkItem(checks, 'documents', documentsRead === expectedDocuments.length &&
    same(actualCounts, expectedCounts));

  const complete = Object.values(missingByCollection).every(count => count === 0) &&
    Object.values(invalidByCollection).every(count => count === 0) &&
    Object.values(extraByCollection).every(count => count === 0);
  checkItem(checks, 'recordSet', complete);

  let businessEquivalenceOk = false;
  let businessDigestOk = false;
  let reconstructedCountsOk = false;
  if (complete) {
    try {
      const restored = reconstituteBackupV12(grouped);
      businessEquivalenceOk = auditBusinessEquivalence(raw, restored).ok;
      const reconverted = convertBackupV12(restored);
      reconstructedCountsOk = same(reconverted.manifestDraft.counts, converted.manifestDraft.counts);
      businessDigestOk = reconverted.manifestDraft.businessDigest ===
        converted.manifestDraft.businessDigest;
    } catch {
      businessEquivalenceOk = false;
      reconstructedCountsOk = false;
      businessDigestOk = false;
    }
  }
  checkItem(checks, 'reconstruction', complete && reconstructedCountsOk);
  checkItem(checks, 'businessEquivalence', businessEquivalenceOk);
  checkItem(checks, 'businessDigest', businessDigestOk);

  return {
    ok: checks.every(item => item.ok),
    checks,
    documentsRead,
    actualCounts,
    missingByCollection,
    invalidByCollection,
    extraByCollection,
  };
}

async function verifyBaseline({
  backupBytes,
  expectedSha256,
  gateway,
  journal,
  allowedManifestStates = ['verified', 'active'],
}) {
  const audit = auditBackupBytes(backupBytes, { expectedSha256 });
  if (audit.status !== 'PASS') fail('SOURCE_AUDIT_FAILED');
  const { raw, converted } = parseBackup(backupBytes);
  const identity = generationIdentity(audit.source.sha256);
  if (journal.schemaVersion !== 1 || journal.target !== 'emulator' ||
    journal.generationId !== identity.generationId ||
    journal.migrationId !== identity.migrationId ||
    journal.sourceSha256 !== audit.source.sha256 ||
    journal.businessDigest !== audit.businessDigest || !same(journal.counts, audit.counts)) {
    fail('JOURNAL_CONFLICT');
  }

  const timestamp = timestampFrom(() => 0);
  const documents = buildDocuments(converted, {
    generationId: journal.generationId,
    updatedAt: timestamp,
  });
  const checks = [];
  const manifestRecord = await gateway.getDocument(manifestPath(journal.generationId));
  let manifest = null;
  try {
    validateManifest(manifestRecord.data);
    manifest = manifestRecord.data;
    checkItem(checks, 'manifest', true);
  } catch {
    checkItem(checks, 'manifest', false);
  }
  if (manifest) {
    checkItem(checks, 'manifestIdentity', manifest.generationId === journal.generationId &&
      manifest.migrationId === journal.migrationId &&
      allowedManifestStates.includes(manifest.state));
    checkItem(checks, 'sourceSha256', manifest.sourceSha256 === audit.source.sha256);
    checkItem(checks, 'counts', same(manifest.counts, audit.counts));
    checkItem(checks, 'manifestDigest', manifest.businessDigest === audit.businessDigest);
  } else {
    for (const name of ['manifestIdentity', 'sourceSha256', 'counts', 'manifestDigest']) {
      checkItem(checks, name, false);
    }
  }

  const readBack = await readBackDocuments(
    gateway,
    raw,
    converted,
    documents,
    journal.generationId,
  );
  checks.push(...readBack.checks);
  return {
    audit,
    raw,
    converted,
    manifestRecord,
    manifest,
    documents,
    readBack,
    checks,
    ok: checks.every(item => item.ok),
  };
}

function publicVerification(result, command = 'verify') {
  return {
    command,
    status: result.ok ? 'PASS' : 'FAIL',
    generationId: result.manifest?.generationId,
    counts: result.audit.counts,
    businessDigest: result.audit.businessDigest,
    documentsRead: result.readBack.documentsRead,
    actualCounts: result.readBack.actualCounts,
    missingByCollection: result.readBack.missingByCollection,
    invalidByCollection: result.readBack.invalidByCollection,
    extraByCollection: result.readBack.extraByCollection,
    checks: result.checks,
  };
}

function journalPathFor(stateDirectory) {
  return join(stateDirectory, JOURNAL_FILE);
}

function requireEmulatorTarget(target) {
  if (target !== 'emulator') fail('EMULATOR_TARGET_REQUIRED');
}

function requireUid(uid) {
  if (typeof uid !== 'string' || !TOKEN.test(uid)) fail('INVALID_UID');
}

export async function prepareMigration({ backupBytes, expectedSha256, target,
  uid, gateway, stateDirectory, batchSize = DEFAULT_BATCH_SIZE, now = Date.now }) {
  requireEmulatorTarget(target);
  requireUid(uid);
  const audit = auditBackupBytes(backupBytes, { expectedSha256 });
  if (audit.status !== 'PASS') fail('SOURCE_AUDIT_FAILED');
  const { converted } = parseBackup(backupBytes);
  if (converted.manifestDraft.businessDigest !== audit.businessDigest ||
    !same(converted.manifestDraft.counts, audit.counts)) fail('SOURCE_AUDIT_FAILED');

  const sourceSha256 = audit.source.sha256;
  const { generationId, migrationId } = generationIdentity(sourceSha256);
  const updatedAt = timestampFrom(now);
  const documents = buildDocuments(converted, { generationId, updatedAt });
  const batches = buildBatches(documents, batchSize);
  const journalPath = journalPathFor(stateDirectory);
  const expectedJournal = createJournal({
    target,
    generationId,
    migrationId,
    sourceSha256,
    businessDigest: audit.businessDigest,
    counts: audit.counts,
    batches,
    batchSize,
    state: 'staging',
  });
  let journal = await loadJournal(journalPath);
  if (journal) {
    validateJournal(journal, expectedJournal);
  } else {
    journal = expectedJournal;
    await writeJournal(journalPath, journal);
  }

  const path = manifestPath(generationId);
  let storedManifest = await gateway.getDocument(path);
  if (!storedManifest) {
    const stagingManifest = buildManifest({
      generationId,
      migrationId,
      sourceSha256,
      businessDigest: audit.businessDigest,
      counts: audit.counts,
      state: 'staging',
      revision: 0,
      updatedAt,
    });
    await gateway.commit([{ type: 'create', path, data: stagingManifest }]);
    storedManifest = await gateway.getDocument(path);
  } else {
    try {
      validateManifest(storedManifest.data);
    } catch {
      fail('REMOTE_MANIFEST_CONFLICT');
    }
    if (storedManifest.data.generationId !== generationId ||
      storedManifest.data.migrationId !== migrationId ||
      storedManifest.data.sourceSha256 !== sourceSha256 ||
      storedManifest.data.businessDigest !== audit.businessDigest ||
      !same(storedManifest.data.counts, audit.counts)) fail('REMOTE_MANIFEST_CONFLICT');
    if (storedManifest.data.state === 'active') fail('GENERATION_ALREADY_ACTIVE');
    if (storedManifest.data.state === 'retired') fail('REMOTE_MANIFEST_CONFLICT');
  }

  for (const batch of batches) {
    await writeMissingDocuments(gateway, generationId, batch.documents);
    markBatchComplete(journal, batch, now);
    await writeJournal(journalPath, journal);
  }

  if (storedManifest.data.state === 'verified') {
    journal.state = 'verified';
    await writeJournal(journalPath, journal);
    const checked = await verifyBaseline({ backupBytes, expectedSha256, gateway, journal });
    if (!checked.ok) fail('READBACK_FAILED');
    return {
      command: 'prepare',
      status: 'ALREADY_VERIFIED',
      generationId,
      migrationId,
      counts: audit.counts,
      businessDigest: audit.businessDigest,
      batches: batches.length,
      documentsRead: checked.readBack.documentsRead,
      checks: checked.checks,
    };
  }

  const staged = await verifyBaseline({
    backupBytes,
    expectedSha256,
    gateway,
    journal,
    allowedManifestStates: ['staging', 'verified', 'active'],
  });
  if (!staged.ok) throw new MigrationError('READBACK_FAILED');
  const verifiedManifest = buildManifest({
    generationId,
    migrationId,
    sourceSha256,
    businessDigest: audit.businessDigest,
    counts: audit.counts,
    state: 'verified',
    revision: storedManifest.data.revision + 1,
    updatedAt: timestampFrom(now),
  });
  await gateway.commit([{
    type: 'overwrite',
    path,
    data: verifiedManifest,
    expectedUpdateTime: storedManifest.updateTime,
  }]);
  journal.state = 'verified';
  await writeJournal(journalPath, journal);

  return {
    command: 'prepare',
    status: 'VERIFIED',
    generationId,
    migrationId,
    counts: audit.counts,
    businessDigest: audit.businessDigest,
    batches: batches.length,
    documentsRead: staged.readBack.documentsRead,
    checks: staged.checks,
  };
}

export async function verifyMigration({ backupBytes, expectedSha256, target,
  uid, gateway, stateDirectory }) {
  requireEmulatorTarget(target);
  requireUid(uid);
  const journal = await loadJournal(journalPathFor(stateDirectory));
  if (!journal) fail('JOURNAL_NOT_FOUND');
  const checked = await verifyBaseline({ backupBytes, expectedSha256, gateway, journal });
  return publicVerification(checked);
}

export async function activateMigration({ target, backupBytes, expectedSha256,
  uid, gateway, stateDirectory, now = Date.now }) {
  if (target === 'production' || target == null) {
    return { command: 'activate', status: 'REFUSED', code: 'PRODUCTION_ACTIVATION_DISABLED' };
  }
  requireEmulatorTarget(target);
  requireUid(uid);
  const journal = await loadJournal(journalPathFor(stateDirectory));
  if (!journal) fail('JOURNAL_NOT_FOUND');
  const checked = await verifyBaseline({ backupBytes, expectedSha256, gateway, journal });
  if (!checked.ok) throw new MigrationError('READBACK_FAILED');
  const manifest = checked.manifest;
  const current = await gateway.getDocument(CONTROL_PATH);
  if (current && current.data?.generationId !== journal.generationId) {
    fail('ANOTHER_GENERATION_ACTIVE');
  }
  if (manifest.state === 'active') {
    if (!current || current.data?.generationId !== journal.generationId) {
      fail('CONTROL_MISMATCH');
    }
    journal.state = 'active';
    await writeJournal(journalPathFor(stateDirectory), journal);
    return { command: 'activate', status: 'ACTIVE', generationId: journal.generationId,
      checks: checked.checks };
  }

  const updatedAt = timestampFrom(now);
  const activeManifest = buildManifest({
    generationId: journal.generationId,
    migrationId: journal.migrationId,
    sourceSha256: journal.sourceSha256,
    businessDigest: journal.businessDigest,
    counts: journal.counts,
    state: 'active',
    revision: manifest.revision + 1,
    updatedAt,
  });
  const control = { schemaVersion: 1, generationId: journal.generationId, updatedAt };
  const writes = [{
    type: 'overwrite',
    path: manifestPath(journal.generationId),
    data: activeManifest,
    expectedUpdateTime: checked.manifestRecord.updateTime,
  }];
  writes.push(current
    ? { type: 'overwrite', path: CONTROL_PATH, data: control,
      expectedUpdateTime: current.updateTime }
    : { type: 'create', path: CONTROL_PATH, data: control });
  await gateway.commit(writes);

  const storedManifest = await gateway.getDocument(manifestPath(journal.generationId));
  const storedControl = await gateway.getDocument(CONTROL_PATH);
  validateManifest(storedManifest?.data);
  if (storedManifest.data.state !== 'active' ||
    storedControl?.data?.generationId !== journal.generationId ||
    storedControl?.data?.schemaVersion !== 1) fail('ACTIVATION_READBACK_FAILED');
  journal.state = 'active';
  await writeJournal(journalPathFor(stateDirectory), journal);
  return { command: 'activate', status: 'ACTIVE', generationId: journal.generationId,
    checks: checked.checks };
}

function parseIntegerOption(name, value) {
  if (!/^\d+$/.test(value)) fail('INVALID_ARGUMENTS');
  const number = Number(value);
  if (!Number.isSafeInteger(number)) fail('INVALID_ARGUMENTS');
  return number;
}

function parseArguments(args, env) {
  const command = args[0];
  if (!['audit', 'prepare', 'verify', 'activate'].includes(command)) {
    fail('INVALID_COMMAND');
  }
  const selected = {};
  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith('--') || !OPTION_NAMES.has(argument.slice(2))) {
      fail('INVALID_ARGUMENTS');
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) fail('INVALID_ARGUMENTS');
    selected[argument.slice(2)] = value;
    index += 1;
  }
  return {
    command,
    options: {
      backupPath: selected.backup ?? env.ESTUDO_V1_BACKUP_PATH,
      expectedSha256: selected['expected-sha256'] ?? DEFAULT_EXPECTED_SHA256,
      target: selected.target ?? (command === 'activate' ? 'production' : null),
      stateDirectory: selected['state-dir'] ?? env.ESTUDO_V1_MIGRATION_STATE_DIR ??
        DEFAULT_STATE_DIRECTORY,
      uid: selected.uid ?? env.ESTUDO_V1_UID,
      projectId: selected.project ?? env.FIREBASE_PROJECT_ID ?? DEFAULT_PROJECT_ID,
      emulatorHost: selected['emulator-host'] ?? env.FIRESTORE_EMULATOR_HOST ??
        DEFAULT_EMULATOR_HOST,
      batchSize: selected['batch-size'] === undefined
        ? DEFAULT_BATCH_SIZE
        : parseIntegerOption('batch-size', selected['batch-size']),
    },
  };
}

function requestedTarget(args) {
  const index = args.indexOf('--target');
  return index >= 0 ? args[index + 1] : null;
}

function safeCode(error) {
  return error instanceof MigrationError ? error.code : 'MIGRATION_FAILED';
}

async function readSource(readFile, backupPath) {
  if (typeof backupPath !== 'string' || !backupPath.trim()) fail('BACKUP_PATH_REQUIRED');
  try {
    return await readFile(backupPath);
  } catch {
    fail('BACKUP_READ_FAILED');
  }
}

export async function runCommand(args, env = process.env, dependencies = {}) {
  const output = dependencies.output ?? (result => console.log(JSON.stringify(result, null, 2)));
  const readFile = dependencies.readFile ?? readFileFromDisk;
  const now = dependencies.now ?? Date.now;
  if (!Array.isArray(args) || !['audit', 'prepare', 'verify', 'activate'].includes(args[0])) {
    const result = { command: 'unknown', status: 'FAIL', code: 'INVALID_COMMAND' };
    output(result);
    return 1;
  }

  // Production activation is unreachable by design. Resolve nothing before this gate.
  if (args[0] === 'activate' && (requestedTarget(args) ?? 'production') === 'production') {
    const result = { command: 'activate', status: 'REFUSED',
      code: 'PRODUCTION_ACTIVATION_DISABLED' };
    output(result);
    return 1;
  }

  try {
    const { command, options } = parseArguments(args, env);
    const sourceBytes = await readSource(readFile, options.backupPath);
    if (command === 'audit') {
      const result = auditBackupBytes(sourceBytes, { expectedSha256: options.expectedSha256 });
      output(result);
      return result.status === 'PASS' ? 0 : 1;
    }
    requireEmulatorTarget(options.target);
    requireUid(options.uid);
    const gateway = dependencies.gateway ?? createEmulatorGateway({
      uid: options.uid,
      projectId: options.projectId,
      emulatorHost: options.emulatorHost,
    });
    let result;
    if (command === 'prepare') {
      result = await prepareMigration({
        backupBytes: sourceBytes,
        expectedSha256: options.expectedSha256,
        target: options.target,
        uid: options.uid,
        gateway,
        stateDirectory: options.stateDirectory,
        batchSize: options.batchSize,
        now,
      });
    } else if (command === 'verify') {
      result = await verifyMigration({
        backupBytes: sourceBytes,
        expectedSha256: options.expectedSha256,
        target: options.target,
        uid: options.uid,
        gateway,
        stateDirectory: options.stateDirectory,
      });
    } else {
      result = await activateMigration({
        target: options.target,
        backupBytes: sourceBytes,
        expectedSha256: options.expectedSha256,
        uid: options.uid,
        gateway,
        stateDirectory: options.stateDirectory,
        now,
      });
    }
    output(result);
    return SUCCESS_STATUSES.has(result.status) ? 0 : 1;
  } catch (error) {
    output({ command: args[0], status: 'FAIL', code: safeCode(error) });
    return 1;
  }
}

function parseEmulatorAuthority(value) {
  if (typeof value !== 'string' || !value.trim()) fail('INVALID_EMULATOR_HOST');
  const authority = value.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const match = authority.match(/^(localhost|127\.0\.0\.1|\[::1\]|::1):(\d{1,5})$/);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 65535) {
    fail('INVALID_EMULATOR_HOST');
  }
  const host = match[1] === '::1' ? '[::1]' : match[1];
  return `${host}:${match[2]}`;
}

function requireDemoProject(projectId) {
  if (typeof projectId !== 'string' || !projectId.startsWith('demo-') ||
    !/^[A-Za-z0-9_-]+$/.test(projectId)) fail('EMULATOR_DEMO_PROJECT_REQUIRED');
}

function encodeFieldValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('INVALID_REMOTE_VALUE');
    return Number.isSafeInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeFieldValue) } };
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 2 && Number.isInteger(value.seconds) &&
      Number.isInteger(value.nanoseconds)) {
      const milliseconds = value.seconds * 1000 + Math.floor(value.nanoseconds / 1e6);
      return { timestampValue: new Date(milliseconds).toISOString() };
    }
    return { mapValue: { fields: encodeFields(value) } };
  }
  fail('INVALID_REMOTE_VALUE');
}

function encodeFields(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) =>
    [key, encodeFieldValue(value)]));
}

function decodeTimestamp(value) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/);
  if (!match) fail('INVALID_EMULATOR_RESPONSE');
  const seconds = Math.floor(Date.parse(`${match[1]}Z`) / 1000);
  const nanoseconds = match[2] ? Number(match[2].padEnd(9, '0')) : 0;
  return { seconds, nanoseconds };
}

function decodeFieldValue(value) {
  if (Object.hasOwn(value, 'nullValue')) return null;
  if (Object.hasOwn(value, 'stringValue')) return value.stringValue;
  if (Object.hasOwn(value, 'booleanValue')) return value.booleanValue;
  if (Object.hasOwn(value, 'integerValue')) {
    const number = Number(value.integerValue);
    if (!Number.isSafeInteger(number)) fail('INVALID_EMULATOR_RESPONSE');
    return number;
  }
  if (Object.hasOwn(value, 'doubleValue')) return Number(value.doubleValue);
  if (Object.hasOwn(value, 'timestampValue')) return decodeTimestamp(value.timestampValue);
  if (Object.hasOwn(value, 'arrayValue')) return (value.arrayValue.values || []).map(decodeFieldValue);
  if (Object.hasOwn(value, 'mapValue')) return decodeFields(value.mapValue.fields || {});
  fail('INVALID_EMULATOR_RESPONSE');
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) =>
    [key, decodeFieldValue(value)]));
}

function documentName(projectId, segments) {
  return `projects/${projectId}/databases/(default)/documents/${segments.join('/')}`;
}

function documentPathFromName(name) {
  const marker = '/documents/';
  const index = name.indexOf(marker);
  if (index < 0) fail('INVALID_EMULATOR_RESPONSE');
  return name.slice(index + marker.length).split('/');
}

/** REST adapter restricted to a local Emulator and a demo-* project. */
export function createEmulatorGateway({
  uid,
  projectId = DEFAULT_PROJECT_ID,
  emulatorHost = DEFAULT_EMULATOR_HOST,
  fetchImpl = globalThis.fetch,
} = {}) {
  requireUid(uid);
  requireDemoProject(projectId);
  const authority = parseEmulatorAuthority(emulatorHost);
  if (typeof fetchImpl !== 'function') fail('FETCH_UNAVAILABLE');
  const root = ['users', uid];
  const documentsUrl = `http://${authority}/v1/projects/${encodeURIComponent(projectId)}` +
    '/databases/(default)/documents';

  async function request(url, options = {}) {
    let response;
    try {
      response = await fetchImpl(url, {
        ...options,
        // The local Emulator reserves this marker for administrative bypass.
        // The adapter also rejects every non-demo project and non-loopback host.
        headers: { authorization: 'Bearer owner', ...(options.headers || {}) },
      });
    } catch {
      fail('EMULATOR_UNAVAILABLE');
    }
    return response;
  }

  function absoluteParts(parts) {
    return [...root, ...parts];
  }

  async function getDocument(parts) {
    const full = absoluteParts(parts);
    const response = await request(`${documentsUrl}/${full.map(encodeURIComponent).join('/')}`);
    if (response.status === 404) return null;
    if (!response.ok) fail('EMULATOR_READ_FAILED');
    const body = await response.json();
    return {
      path: parts,
      data: decodeFields(body.fields || {}),
      updateTime: body.updateTime,
    };
  }

  async function listDocuments(parts) {
    const full = absoluteParts(parts);
    const documents = [];
    let pageToken;
    do {
      const query = new URLSearchParams({ pageSize: '300' });
      if (pageToken) query.set('pageToken', pageToken);
      const response = await request(
        `${documentsUrl}/${full.map(encodeURIComponent).join('/')}?${query}`,
      );
      if (response.status === 404) return documents;
      if (!response.ok) fail('EMULATOR_READ_FAILED');
      const body = await response.json();
      for (const document of body.documents || []) {
        documents.push({
          path: documentPathFromName(document.name),
          data: decodeFields(document.fields || {}),
          updateTime: document.updateTime,
        });
      }
      pageToken = body.nextPageToken;
    } while (pageToken);
    return documents;
  }

  async function commit(writes) {
    const body = {
      writes: writes.map(write => {
        const full = absoluteParts(write.path);
        const update = {
          name: documentName(projectId, full),
          fields: encodeFields(write.data),
        };
        return {
          update,
          currentDocument: write.type === 'create'
            ? { exists: false }
            : { updateTime: write.expectedUpdateTime },
        };
      }),
    };
    const response = await request(`${documentsUrl}:commit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) fail('EMULATOR_COMMIT_FAILED');
  }

  return { getDocument, listDocuments, commit };
}

export async function main(args = [], env = process.env) {
  return runCommand(args, env);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
