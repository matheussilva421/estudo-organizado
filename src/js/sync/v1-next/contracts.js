// Wire schema 1, independent of the academic backup's schemaVersion 12.
// All validators throw without including private values. See the schemas below.
const COLLECTIONS = { edital: 'editais', disciplina: 'disciplinas', evento: 'eventos',
  retaFinalBloco: 'retaFinalBlocos', meta: 'meta' };
const ALL_COLLECTIONS = [...Object.values(COLLECTIONS), 'habitos', 'tombstones'];
const META_IDS = ['$root', 'config', 'planejamento', 'planejamentoArquivado', 'ciclo',
  'cronoLivre', 'bancaRelevance'];
const MAX_BYTES = 900 * 1024;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const isMap = value => value != null && typeof value === 'object' &&
  [null, Object.prototype].includes(Object.getPrototypeOf(value));
const natural = value => Number.isSafeInteger(value) && value >= 0;
const bytes = value => new globalThis.TextEncoder().encode(value);
const matches = (value, pattern) => typeof value === 'string' && pattern.test(value);

function check(condition, description) {
  if (!condition) throw new TypeError('Invalid V1 sync ' + description);
}

function exact(map, keys) {
  check(isMap(map) && Object.keys(map).length === keys.length &&
    keys.every(key => Object.hasOwn(map, key)), 'document fields');
}

/** Resolve codec types, including new habit categories and both historical tombstone sources. */
export function entityCollectionForType(type) {
  check(typeof type === 'string' && type.length <= 128 && bytes(type).length <= 128, 'entityType');
  if (Object.hasOwn(COLLECTIONS, type)) return COLLECTIONS[type];
  if (/^habito\.[^:]+$/.test(type)) return 'habitos';
  if (/^tombstone\.(syncTombstones|config\.entityTombstones)\.[^:]+$/.test(type)) {
    return 'tombstones';
  }
  throw new TypeError('Invalid V1 sync entityType');
}

/** T1 logical key. Numeric and string representations share the same key as in T1. */
export function recordKey(type, id) {
  entityCollectionForType(type);
  check((typeof id === 'string' && id.length > 0) || Number.isFinite(id), 'entityId');
  const key = type + ':' + id;
  checkKey(key);
  return key;
}

function checkKey(key) {
  check(typeof key === 'string' && key.length > 0 && key.length <= 750 &&
    !/[\uD800-\uDFFF]/u.test(key) && bytes(key).length <= 750, 'logical key (750 UTF-8 bytes)');
}

/** Lowercase hex of the complete UTF-8 logical key. At most 1500 ASCII bytes. */
export function encodeDocId(key) {
  checkKey(key);
  return Array.from(bytes(key), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Compare base to remote (-1 stale, 0 equal, +1 ahead). Missing document has base zero. */
export function compareRevisions(base, remote) {
  check(natural(base) && natural(remote), 'revision');
  return Math.sign(base - remote);
}

function checkJson(value, depth = 0) {
  check(depth <= 32, 'JSON depth');
  if (value === null || typeof value === 'boolean' || Number.isFinite(value)) return;
  if (typeof value === 'string') {
    check(value.length <= 262144, 'JSON string length');
    return;
  }
  if (Array.isArray(value)) {
    check(value.length <= 10000 && Object.keys(value).length === value.length, 'JSON array');
    for (const child of value) checkJson(child, depth + 1);
    return;
  }
  check(isMap(value), 'JSON object');
  const keys = Object.keys(value);
  check(keys.length <= 4096, 'JSON map size');
  for (const key of keys) {
    check(key.length <= 1024, 'JSON map key length');
    checkJson(value[key], depth + 1);
  }
}

function checkCodecRecord(item) {
  exact(item, ['key', 'entityType', 'entityId', 'path', 'data']);
  const { entityType: type, entityId: id, path, data } = item;
  const collection = entityCollectionForType(type);
  check(item.key === recordKey(type, id), 'logical identity');
  check(Array.isArray(path) && path.length <= 4, 'codec path');
  checkJson(item);
  if (collection === 'meta') {
    check(META_IDS.includes(id) && (id === '$root' ? path.length === 0 :
      path.length === 1 && path[0] === id), 'meta path');
    check(isMap(data) || (data === null && !['$root', 'config'].includes(id)), 'meta shape');
    if (id === 'planejamento' && data?.retaFinal != null) {
      check(isMap(data.retaFinal) && Array.isArray(data.retaFinal.blocos), 'plan blocks');
    }
    return;
  }
  if (collection === 'tombstones') {
    const source = type.startsWith('tombstone.config.') ? ['config', 'entityTombstones'] : ['syncTombstones'];
    check(path.length === source.length + 1 && source.every((name, i) => path[i] === name) &&
      (typeof path.at(-1) === 'string' || natural(path.at(-1))), 'historical tombstone path');
    return;
  }
  check(isMap(data) && data.id === id && natural(path.at(-1)), 'business identity or position');
  if (collection === 'disciplinas') {
    check(path.length === 4 && path[0] === 'editais' && natural(path[1]) &&
      path[2] === 'disciplinas', 'discipline path');
    for (const field of ['aulas', 'assuntos']) {
      if (Object.hasOwn(data, field)) {
        check(Array.isArray(data[field]) && data[field].every(child => isMap(child) &&
          (Number.isFinite(child.id) || (typeof child.id === 'string' && child.id.length > 0))),
        'discipline children');
      }
    }
  } else if (collection === 'retaFinalBlocos') {
    check(path.length === 4 && path[0] === 'planejamento' && path[1] === 'retaFinal' &&
      path[2] === 'blocos', 'block path');
  } else if (collection === 'habitos') {
    check(path.length === 3 && path[0] === 'habitos' && path[1] === type.slice(7), 'habit path');
  } else {
    check(path.length === 2 && path[0] === collection, 'entity path');
    if (collection === 'editais') check(Array.isArray(data.disciplinas), 'edital disciplines');
  }
}

function checkSize(text) {
  check(text.length <= MAX_BYTES && bytes(text).length <= MAX_BYTES, 'payload exceeds 900 KiB');
}

/** Serialize exactly one T1 record into the wire data string, preserving numeric IDs and paths. */
export function encodeRecordData(item) {
  checkCodecRecord(item);
  const text = JSON.stringify(item);
  checkSize(text);
  return text;
}

function timestamp(value) {
  // Firestore Timestamp (client or Admin SDK), after serverTimestamp resolution.
  return value != null && Number.isInteger(value.seconds) && value.seconds >= -62135596800 &&
    value.seconds <= 253402300799 && natural(value.nanoseconds) && value.nanoseconds < 1e9;
}

/** Validate a materialized entity. opDigest is lowercase SHA-256 of UTF-8 data
 * (literal "null" for delete). Rules verify the hash against the committed bytes.
 * The immutable receipt contains exactly these fields except data. Its path is operations/{opId}.
 */
export function validateRecord(record) {
  exact(record, ['schemaVersion', 'generationId', 'entityType', 'entityId', 'collection', 'revision',
    'baseRevision', 'opId', 'opDigest', 'deleted', 'data', 'updatedAt']);
  check(record.schemaVersion === 1 && matches(record.generationId, TOKEN) && matches(record.opId, TOKEN) &&
    matches(record.opDigest, SHA256) && timestamp(record.updatedAt), 'record metadata');
  check(natural(record.baseRevision) && natural(record.revision) &&
    record.revision === record.baseRevision + 1, 'CAS revisions');
  check(typeof record.entityId === 'string' && record.collection === entityCollectionForType(record.entityType),
    'wire identity');
  const key = recordKey(record.entityType, record.entityId);
  check(typeof record.deleted === 'boolean', 'deleted flag');
  if (record.deleted) check(record.data === null && record.baseRevision > 0, 'terminal delete');
  else {
    check(typeof record.data === 'string', 'wire data');
    checkSize(record.data);
    let item;
    try { item = JSON.parse(record.data); } catch { throw new TypeError('Invalid V1 sync JSON'); }
    checkCodecRecord(item);
    check(item.key === key, 'payload identity');
  }
  return true;
}

/** Namespace root, written only by Admin. Counts/digests describe the migration baseline.
 * The Admin-only control/current contains {schemaVersion:1,generationId,updatedAt}.
 */
export function validateManifest(manifest) {
  exact(manifest, ['schemaVersion', 'generationId', 'migrationId', 'state', 'revision', 'sourceSha256',
    'businessDigest', 'counts', 'updatedAt']);
  check(manifest.schemaVersion === 1 && matches(manifest.generationId, TOKEN) &&
    matches(manifest.migrationId, TOKEN) && natural(manifest.revision) && timestamp(manifest.updatedAt) &&
    ['staging', 'verified', 'active', 'retired'].includes(manifest.state) &&
    matches(manifest.sourceSha256, SHA256) && matches(manifest.businessDigest, SHA256), 'manifest');
  exact(manifest.counts, ['total', 'byCollection']);
  exact(manifest.counts.byCollection, ALL_COLLECTIONS);
  const counts = Object.values(manifest.counts.byCollection);
  check(counts.every(natural) && natural(manifest.counts.total) &&
    counts.reduce((sum, count) => sum + count, 0) === manifest.counts.total, 'manifest counts');
  return true;
}
