import { BACKUP_FORMAT_VERSION, DOMAIN_SCHEMA_VERSION } from '../../domain/versions';

export type LogicalTombstone = {
  profileId: string;
  entityId: string;
  operationId: string;
  baseRevision: number | null;
  epoch: number;
  [key: string]: unknown;
};

export type BackupRecord = Record<string, unknown>;

export type BackupManifest = {
  formatVersion: number;
  domainSchemaVersion: number;
  /** Exported records: subjects plus tombstones. */
  recordCount: number;
  checksum: string;
  hasDeletionHistory: boolean;
};

export type BackupPayload = {
  subjects: BackupRecord[];
  tombstones: LogicalTombstone[];
};

export type BackupSnapshot = {
  manifest: BackupManifest;
  payload: BackupPayload;
};

export type BackupVersions = {
  formatVersion?: number;
  backupFormatVersion?: number;
  domainSchemaVersion?: number;
};

export type BackupSnapshotInput = {
  subjects: readonly unknown[];
  tombstones: readonly LogicalTombstone[];
  versions?: BackupVersions;
};

export type BackupFormatErrorCode =
  | 'INVALID_SUBJECTS'
  | 'INVALID_TOMBSTONES'
  | 'INVALID_VERSIONS'
  | 'UNSERIALIZABLE_DATA';

export class BackupFormatError extends Error {
  readonly code: BackupFormatErrorCode;

  constructor(code: BackupFormatErrorCode, message: string) {
    super(message);
    this.name = 'BackupFormatError';
    this.code = code;
  }
}

export type BackupInvalidReason =
  | 'TRUNCATED_OR_MALFORMED'
  | 'MISSING_MANIFEST'
  | 'MISSING_PAYLOAD'
  | 'UNSUPPORTED_FORMAT_VERSION'
  | 'UNSUPPORTED_DOMAIN_SCHEMA_VERSION'
  | 'INVALID_MANIFEST'
  | 'INVALID_PAYLOAD'
  | 'INVALID_TOMBSTONE'
  | 'SENSITIVE_DATA_PRESENT'
  | 'CHECKSUM_MISMATCH'
  | 'RECORD_COUNT_MISMATCH';

export type ParsedBackup =
  | { ok: true; snapshot: BackupSnapshot }
  | { ok: false; reason: BackupInvalidReason };

export type BackupInspection =
  | { ok: true; snapshot: BackupSnapshot }
  | { ok: false; reason: BackupInvalidReason };

const SENSITIVE_KEYS = new Set([
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'password',
  'secret',
  'apikey',
  'authorization',
  'cookie',
  'cookies',
  'credential',
  'credentials',
  'cache',
  'caches',
]);

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSensitiveKey(key: string): boolean {
  if (UNSAFE_KEYS.has(key)) return true;
  const normalized = normalizeKey(key);
  if (SENSITIVE_KEYS.has(normalized)) return true;
  return (
    normalized.endsWith('token') ||
    normalized.endsWith('password') ||
    normalized.endsWith('secret') ||
    normalized.endsWith('apikey')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireIdentifier(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BackupFormatError('INVALID_TOMBSTONES', `${field} is required`);
  }
  return value;
}

function requireRevision(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new BackupFormatError('INVALID_TOMBSTONES', `${field} must be a non-negative integer or null`);
  }
  return value;
}

function readTombstone(value: unknown): LogicalTombstone {
  if (!isRecord(value)) {
    throw new BackupFormatError('INVALID_TOMBSTONES', 'tombstone must be an object');
  }
  const profileId = requireIdentifier(value.profileId, 'profileId');
  const entityId = requireIdentifier(value.entityId, 'entityId');
  const operationId = requireIdentifier(value.operationId, 'operationId');
  const baseRevision = requireRevision(value.baseRevision, 'baseRevision');
  const epoch = requireRevision(value.epoch, 'epoch');
  if (epoch === null) {
    throw new BackupFormatError('INVALID_TOMBSTONES', 'epoch must be a non-negative integer');
  }
  return {
    ...value,
    profileId,
    entityId,
    operationId,
    baseRevision,
    epoch,
  };
}

function sanitizeValue(value: unknown, seen: Set<object>): unknown {
  if (value === null) return null;

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'boolean') return value;
  if (valueType === 'number') {
    if (!Number.isFinite(value)) {
      throw new BackupFormatError('UNSERIALIZABLE_DATA', 'numbers must be finite');
    }
    return value;
  }
  if (valueType === 'undefined') return undefined;
  if (valueType === 'bigint' || valueType === 'symbol' || valueType === 'function') {
    throw new BackupFormatError('UNSERIALIZABLE_DATA', `${valueType} is not serializable`);
  }

  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      throw new BackupFormatError('UNSERIALIZABLE_DATA', 'dates must be valid');
    }
    return value.toISOString();
  }

  if (typeof value !== 'object') {
    throw new BackupFormatError('UNSERIALIZABLE_DATA', 'unsupported value');
  }
  if (seen.has(value)) {
    throw new BackupFormatError('UNSERIALIZABLE_DATA', 'circular reference');
  }

  const prototype = Object.getPrototypeOf(value) as unknown;
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new BackupFormatError('UNSERIALIZABLE_DATA', 'only plain records and arrays are supported');
  }

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => {
        const sanitized = sanitizeValue(item, seen);
        return sanitized === undefined ? null : sanitized;
      });
    }

    const entries: Array<[string, unknown]> = [];
    for (const [key, item] of Object.entries(value)) {
      if (isSensitiveKey(key) || item === undefined) continue;
      entries.push([key, sanitizeValue(item, seen)]);
    }
    return Object.fromEntries(entries);
  } finally {
    seen.delete(value);
  }
}

export function stripSensitiveData<T>(value: T): T {
  return sanitizeValue(value, new Set()) as T;
}

function serializeCanonical(value: unknown, seen: Set<object>): string {
  if (value === null) return 'null';

  const valueType = typeof value;
  if (valueType === 'string') return JSON.stringify(value);
  if (valueType === 'boolean') return value ? 'true' : 'false';
  if (valueType === 'number') {
    if (!Number.isFinite(value)) {
      throw new BackupFormatError('UNSERIALIZABLE_DATA', 'numbers must be finite');
    }
    return JSON.stringify(value);
  }
  if (valueType === 'undefined') {
    throw new BackupFormatError('UNSERIALIZABLE_DATA', 'undefined is not serializable');
  }
  if (valueType === 'bigint' || valueType === 'symbol' || valueType === 'function') {
    throw new BackupFormatError('UNSERIALIZABLE_DATA', `${valueType} is not serializable`);
  }

  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      throw new BackupFormatError('UNSERIALIZABLE_DATA', 'dates must be valid');
    }
    return JSON.stringify(value.toISOString());
  }

  if (typeof value !== 'object') {
    throw new BackupFormatError('UNSERIALIZABLE_DATA', 'unsupported value');
  }
  if (seen.has(value)) {
    throw new BackupFormatError('UNSERIALIZABLE_DATA', 'circular reference');
  }

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const items = value.map((item) =>
        item === undefined ? 'null' : serializeCanonical(item, seen),
      );
      return `[${items.join(',')}]`;
    }

    const record = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of Object.keys(record).sort()) {
      const item = record[key];
      if (item === undefined) continue;
      parts.push(`${JSON.stringify(key)}:${serializeCanonical(item, seen)}`);
    }
    return `{${parts.join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

export function canonicalJson(value: unknown): string {
  return serializeCanonical(value, new Set());
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function rotateRight(value: number, shift: number): number {
  return ((value >>> shift) | (value << (32 - shift))) >>> 0;
}

function sha256Bytes(bytes: Uint8Array): string {
  const paddedLength = (((bytes.length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 =
        (rotateRight(words[index - 15] as number, 7) ^
          rotateRight(words[index - 15] as number, 18) ^
          ((words[index - 15] as number) >>> 3)) >>>
        0;
      const s1 =
        (rotateRight(words[index - 2] as number, 17) ^
          rotateRight(words[index - 2] as number, 19) ^
          ((words[index - 2] as number) >>> 10)) >>>
        0;
      words[index] =
        ((words[index - 16] as number) + s0 + (words[index - 7] as number) + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let index = 0; index < 64; index += 1) {
      const s1 = (rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 =
        (h + s1 + ch + (SHA256_K[index] as number) + (words[index] as number)) >>> 0;
      const s0 = (rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((value) => value.toString(16).padStart(8, '0'))
    .join('');
}

export function sha256Hex(input: string): string {
  return sha256Bytes(new TextEncoder().encode(input));
}

export async function computeChecksum(value: unknown): Promise<string> {
  return sha256Hex(canonicalJson(value));
}

function readVersion(value: unknown, fallback: number, field: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new BackupFormatError('INVALID_VERSIONS', `${field} must be a positive integer`);
  }
  return value;
}

export async function createBackupSnapshot(
  input: BackupSnapshotInput,
): Promise<BackupSnapshot> {
  if (!Array.isArray(input.subjects)) {
    throw new BackupFormatError('INVALID_SUBJECTS', 'subjects must be an array');
  }
  if (!Array.isArray(input.tombstones)) {
    throw new BackupFormatError('INVALID_TOMBSTONES', 'tombstones must be an array');
  }

  const versions = input.versions ?? {};
  const formatVersion = readVersion(
    versions.formatVersion ?? versions.backupFormatVersion,
    BACKUP_FORMAT_VERSION,
    'formatVersion',
  );
  const domainSchemaVersion = readVersion(
    versions.domainSchemaVersion,
    DOMAIN_SCHEMA_VERSION,
    'domainSchemaVersion',
  );

  const subjects = input.subjects.map((subject, index) => {
    if (!isRecord(subject)) {
      throw new BackupFormatError('INVALID_SUBJECTS', `subject at index ${index} must be an object`);
    }
    return stripSensitiveData<BackupRecord>(subject);
  });
  const tombstones = input.tombstones.map((tombstone) =>
    stripSensitiveData<LogicalTombstone>(readTombstone(tombstone)),
  );
  const payload: BackupPayload = { subjects, tombstones };

  return {
    manifest: {
      formatVersion,
      domainSchemaVersion,
      recordCount: subjects.length + tombstones.length,
      checksum: await computeChecksum(payload),
      hasDeletionHistory: tombstones.length > 0,
    },
    payload,
  };
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

export function parseBackup(input: unknown): ParsedBackup {
  let value = input;
  if (typeof value === 'string') {
    if (value.trim().length === 0) {
      return { ok: false, reason: 'TRUNCATED_OR_MALFORMED' };
    }
    try {
      value = parseJson(value);
    } catch {
      return { ok: false, reason: 'TRUNCATED_OR_MALFORMED' };
    }
  }
  if (!isRecord(value)) {
    return { ok: false, reason: 'MISSING_MANIFEST' };
  }

  let manifest = value.manifest;
  let payload = value.payload;
  if (typeof manifest === 'string') {
    try {
      manifest = parseJson(manifest);
    } catch {
      return { ok: false, reason: 'MISSING_MANIFEST' };
    }
  }
  if (typeof payload === 'string') {
    try {
      payload = parseJson(payload);
    } catch {
      return { ok: false, reason: 'MISSING_PAYLOAD' };
    }
  }
  if (!isRecord(manifest)) {
    return { ok: false, reason: 'MISSING_MANIFEST' };
  }
  if (!isRecord(payload)) {
    return { ok: false, reason: 'MISSING_PAYLOAD' };
  }

  return {
    ok: true,
    snapshot: {
      manifest: manifest as unknown as BackupManifest,
      payload: payload as unknown as BackupPayload,
    },
  };
}

function containsSensitiveData(value: unknown, seen: Set<object>): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((item) => containsSensitiveData(item, seen));
  }
  for (const [key, item] of Object.entries(value)) {
    if (isSensitiveKey(key)) return true;
    if (containsSensitiveData(item, seen)) return true;
  }
  return false;
}

export async function inspectBackup(input: unknown): Promise<BackupInspection> {
  const parsed = parseBackup(input);
  if (!parsed.ok) return parsed;

  const { manifest, payload } = parsed.snapshot;
  if (!isRecord(manifest) || !isRecord(payload)) {
    return { ok: false, reason: !isRecord(manifest) ? 'MISSING_MANIFEST' : 'MISSING_PAYLOAD' };
  }

  if (manifest.formatVersion !== BACKUP_FORMAT_VERSION) {
    return { ok: false, reason: 'UNSUPPORTED_FORMAT_VERSION' };
  }
  if (manifest.domainSchemaVersion !== DOMAIN_SCHEMA_VERSION) {
    return { ok: false, reason: 'UNSUPPORTED_DOMAIN_SCHEMA_VERSION' };
  }
  if (typeof manifest.hasDeletionHistory !== 'boolean') {
    return { ok: false, reason: 'INVALID_MANIFEST' };
  }
  if (
    typeof manifest.recordCount !== 'number' ||
    !Number.isInteger(manifest.recordCount) ||
    manifest.recordCount < 0
  ) {
    return { ok: false, reason: 'INVALID_MANIFEST' };
  }
  if (typeof manifest.checksum !== 'string') {
    return { ok: false, reason: 'INVALID_MANIFEST' };
  }

  const subjects = payload.subjects;
  const rawTombstones = payload.tombstones;
  if (!Array.isArray(subjects) || !Array.isArray(rawTombstones)) {
    return { ok: false, reason: 'INVALID_PAYLOAD' };
  }
  if (!subjects.every((subject) => isRecord(subject))) {
    return { ok: false, reason: 'INVALID_PAYLOAD' };
  }

  const tombstones: LogicalTombstone[] = [];
  for (const rawTombstone of rawTombstones) {
    try {
      tombstones.push(readTombstone(rawTombstone));
    } catch {
      return { ok: false, reason: 'INVALID_TOMBSTONE' };
    }
  }

  if (subjects.length + rawTombstones.length !== manifest.recordCount) {
    return { ok: false, reason: 'RECORD_COUNT_MISMATCH' };
  }
  if (containsSensitiveData(payload, new Set())) {
    return { ok: false, reason: 'SENSITIVE_DATA_PRESENT' };
  }

  const checksum = manifest.checksum.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(checksum)) {
    return { ok: false, reason: 'INVALID_MANIFEST' };
  }

  let computed: string;
  try {
    computed = await computeChecksum({ subjects, tombstones });
  } catch {
    return { ok: false, reason: 'INVALID_PAYLOAD' };
  }
  if (computed !== checksum) {
    return { ok: false, reason: 'CHECKSUM_MISMATCH' };
  }

  return {
    ok: true,
    snapshot: {
      manifest,
      payload: {
        subjects: subjects as BackupRecord[],
        tombstones,
      },
    },
  };
}

export async function verifyBackup(input: unknown): Promise<boolean> {
  try {
    const inspected = await inspectBackup(input);
    return inspected.ok;
  } catch {
    return false;
  }
}
