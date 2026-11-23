import { validateBackupPayload } from '../../backup-restore.js';

// Exact operational paths, not a recursive name-based business-field whitelist.
// Keep entityTombstones, plan revisions/operations and unknown academic extensions.
const ROOT_OPERATIONAL = new Set(['driveFileId', 'lastSync']);
const CONFIG_OPERATIONAL = new Set([
  'localBackupAt', 'cfUrl', 'cfToken', 'cfTokenDraft', 'cfTokenSaved', 'cfConflict',
  'cfRemoteUpdatedAt', 'cfLastSyncAt', 'cfLastError', '_lastUpdated', 'syncMergeConflicts',
  'cfSyncEnabled', 'firestoreSync', 'entitySync', 'globalSyncPaused',
  'manualSyncHistory', 'lastManualSyncResults', 'lastManualSyncAt',
  'syncPerformance', 'syncHealth', 'lastEnvelopeBytes',
]);
const COLLECTIONS = ['editais', 'disciplinas', 'eventos', 'habitos', 'retaFinalBlocos', 'meta', 'tombstones'];
const META_FIELDS = ['config', 'planejamento', 'planejamentoArquivado', 'ciclo', 'cronoLivre', 'bancaRelevance'];
const pointer = path => '/' + path.map(x => String(x).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value, key);

// Public diagnostics follow only schema-owned fields. A null leaf also marks
// a dynamic map: keep comparing its original keys internally, never emit them.
const ENTITY_FIELDS = { id: null, nome: null, notas: null };
const HABIT_TYPES = ['questoes', 'revisao', 'discursiva', 'simulado', 'leitura',
  'informativo', 'sumula', 'videoaula', 'paginas'];
const PUBLIC_PATH_SCHEMA = {
  schemaVersion: null,
  editais: [{ ...ENTITY_FIELDS, disciplinas: [{ ...ENTITY_FIELDS,
    aulas: [ENTITY_FIELDS], assuntos: [ENTITY_FIELDS] }] }],
  eventos: [{ ...ENTITY_FIELDS, aulaId: null, rfBlocoId: null }],
  habitos: Object.fromEntries(HABIT_TYPES.map(type => [type, [ENTITY_FIELDS]])),
  config: { entityTombstones: null },
  planejamento: { retaFinal: { blocos: [ENTITY_FIELDS] } },
  planejamentoArquivado: null, ciclo: null, cronoLivre: { tempoAcumulado: null },
  bancaRelevance: { userMappings: null, lessonMappings: null },
  syncTombstones: null, arquivo: null, revisoes: null,
};

function publicPointer(path) {
  const safe = [];
  let schema = PUBLIC_PATH_SCHEMA;
  for (const segment of path) {
    if (Array.isArray(schema) && Number.isInteger(segment) && segment >= 0) schema = schema[0];
    else if (schema && !Array.isArray(schema) && own(schema, segment)) schema = schema[segment];
    else break;
    safe.push(segment);
  }
  return pointer(safe);
}

function fail(path, reason) {
  // Deliberately omit values/IDs, including from validation errors.
  throw new Error(`Invalid V1 backup at ${publicPointer(path)}: ${reason}`);
}

function tombstoneIdentity(data, slot, isArray, path) {
  const validId = value => (typeof value === 'string' && value.length > 0) ||
    (typeof value === 'number' && Number.isFinite(value));
  const validType = value => typeof value === 'string' && value.length > 0;
  // Legacy root shape {col,id}; legacy config shape {entityType,entityId}.
  if (isObject(data)) {
    if (validType(data.col) && validId(data.id)) return [data.col, data.id];
    if (validType(data.entityType) && validId(data.entityId)) return [data.entityType, data.entityId];
  }
  // Legacy map keys encode type:id; split only the first colon, preserving IDs.
  if (!isArray) {
    const separator = slot.indexOf(':');
    if (separator > 0 && separator < slot.length - 1) {
      return [slot.slice(0, separator), slot.slice(separator + 1)];
    }
  }
  fail(path, 'missing recoverable tombstone identity');
}

function operational(path) {
  const key = path.at(-1);
  return (path.length === 1 && ROOT_OPERATIONAL.has(key)) ||
    (path.length === 2 && path[0] === 'config' && CONFIG_OPERATIONAL.has(key)) ||
    (path.length === 2 && path[0] === 'cronoLivre' && key === '_timerStart') ||
    (path.length === 3 && path[0] === 'eventos' && key === '_timerStart');
}

function businessTree(raw, exclusions = []) {
  const ancestors = new Set();
  function visit(value, path) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object' || ancestors.has(value) ||
      (!Array.isArray(value) && Object.prototype.toString.call(value) !== '[object Object]')) {
      fail(path, 'expected finite JSON data');
    }
    ancestors.add(value);
    let result;
    if (Array.isArray(value)) {
      result = Array.from({ length: value.length }, (_, i) => visit(value[i], [...path, i]));
    } else {
      result = Object.fromEntries(Object.keys(value).sort().flatMap(key => {
        const nextPath = [...path, key];
        if (operational(nextPath)) {
          exclusions.push(pointer(nextPath));
          return [];
        }
        return [[key, visit(value[key], nextPath)]];
      }));
    }
    ancestors.delete(value);
    return result;
  }
  return visit(raw, []);
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

// Synchronous SHA-256 keeps the public codec synchronous in browsers and Node.
// Fractional square/cube roots of the first primes are the FIPS 180-4 constants.
const SHA_INITIAL = [];
const SHA_K = [];
for (let candidate = 2; SHA_K.length < 64; candidate++) {
  let prime = true;
  for (let factor = 2; factor * factor <= candidate; factor++) {
    if (candidate % factor === 0) { prime = false; break; }
  }
  if (!prime) continue;
  if (SHA_INITIAL.length < 8) SHA_INITIAL.push((Math.sqrt(candidate) % 1 * 0x100000000) >>> 0);
  SHA_K.push((Math.cbrt(candidate) % 1 * 0x100000000) >>> 0);
}
const rotate = (word, bits) => (word >>> bits) | (word << (32 - bits));
function digest(value) {
  const encoded = encodeURIComponent(canonical(value));
  const bytes = Array.from(encoded.replace(/%([0-9A-F]{2})/g,
    (_, hex) => String.fromCharCode(parseInt(hex, 16))), char => char.charCodeAt(0));
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(Math.floor(bitLength / 2 ** (i * 8)) & 0xff);
  const hash = [...SHA_INITIAL];
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = [];
    for (let i = 0; i < 64; i++) {
      if (i < 16) {
        const j = offset + i * 4;
        words[i] = (bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3];
      } else {
        const x = words[i - 15], y = words[i - 2];
        words[i] = (words[i - 16] + (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) +
          words[i - 7] + (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10))) | 0;
      }
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) +
        ((e & f) ^ (~e & g)) + SHA_K[i] + words[i]) | 0;
      const t2 = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) +
        ((a & b) ^ (a & c) ^ (b & c))) | 0;
      [a, b, c, d, e, f, g, h] = [(t1 + t2) | 0, a, b, c, (d + t1) | 0, e, f, g];
    }
    [a, b, c, d, e, f, g, h].forEach((word, i) => { hash[i] = (hash[i] + word) | 0; });
  }
  return hash.map(word => (word >>> 0).toString(16).padStart(8, '0')).join('');
}

function validateTree(tree) {
  const validation = validateBackupPayload(tree);
  if (!validation.ok) throw new Error(`Invalid V1 backup: ${validation.errors.join('; ')}`);
  if (!isObject(tree) || tree.schemaVersion !== 12) fail(['schemaVersion'], 'expected schemaVersion 12');
  for (const name of ['editais', 'eventos']) {
    if (!Array.isArray(tree[name])) fail([name], 'expected array');
  }
  for (const name of ['habitos', 'config']) {
    if (!isObject(tree[name])) fail([name], 'expected object');
  }
  function entities(items, path) {
    const ids = new Set();
    items.forEach((item, i) => {
      if (!isObject(item) || !['string', 'number'].includes(typeof item.id) ||
        item.id === '' || ids.has(String(item.id))) fail([...path, i], 'missing or duplicate entity id');
      ids.add(String(item.id));
    });
  }
  entities(tree.editais, ['editais']);
  entities(tree.eventos, ['eventos']);
  tree.editais.forEach((edital, e) => {
    const path = ['editais', e, 'disciplinas'];
    if (!Array.isArray(edital.disciplinas)) fail(path, 'expected array');
    entities(edital.disciplinas, path);
    edital.disciplinas.forEach((disciplina, d) => {
      for (const name of ['aulas', 'assuntos']) {
        if (!own(disciplina, name)) continue;
        if (!Array.isArray(disciplina[name])) fail([...path, d, name], 'expected array');
        entities(disciplina[name], [...path, d, name]);
      }
    });
  });
  for (const [type, items] of Object.entries(tree.habitos)) {
    if (!Array.isArray(items)) fail(['habitos', type], 'expected array');
    entities(items, ['habitos', type]);
  }
  for (const name of ['planejamento', 'planejamentoArquivado', 'ciclo', 'cronoLivre', 'bancaRelevance']) {
    if (own(tree, name) && tree[name] !== null && !isObject(tree[name])) fail([name], 'expected object or null');
  }
  const retaFinal = tree.planejamento?.retaFinal;
  if (retaFinal !== undefined && retaFinal !== null) {
    if (!isObject(retaFinal) || !Array.isArray(retaFinal.blocos)) {
      fail(['planejamento', 'retaFinal'], 'expected object with blocos array');
    }
    entities(retaFinal.blocos, ['planejamento', 'retaFinal', 'blocos']);
  }
  for (const [value, path] of [[tree.syncTombstones, ['syncTombstones']],
    [tree.config.entityTombstones, ['config', 'entityTombstones']]]) {
    if (value === undefined || value === null) continue;
    if (!Array.isArray(value) && !isObject(value)) fail(path, 'expected tombstone array or map');
  }
}

function comparePaths(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    if (typeof a[i] === 'number' && typeof b[i] === 'number') return a[i] - b[i];
    return String(a[i]) < String(b[i]) ? -1 : 1;
  }
  return a.length - b.length;
}

/** Convert a JSON V12 backup to hybrid records; never performs I/O or repairs IDs.
 * Records carry {key, entityType, entityId, path, data}. path is an ordered JSON
 * location; null slots in parent records must all be filled on read-back.
 * @returns {{records: Record<string, object[]>, manifestDraft: object, exclusions: string[], exceptions: object[]}}
 */
export function convertBackupV12(raw) {
  const exclusions = [];
  const tree = businessTree(raw, exclusions);
  validateTree(tree);
  const businessDigest = digest(tree);
  const records = Object.fromEntries(COLLECTIONS.map(name => [name, []]));
  const keys = new Set();
  function add(collection, entityType, entityId, path, data) {
    const key = `${entityType}:${entityId}`;
    if (keys.has(key)) fail(path, 'duplicate stable record key');
    keys.add(key);
    records[collection].push({ key, entityType, entityId, path, data });
  }
  function split(items, collection, type, path) {
    items.forEach((item, i) => {
      add(collection, type, item.id, [...path, i], item);
      items[i] = null;
    });
  }
  const disciplinas = tree.editais.flatMap(edital => edital.disciplinas);
  const aulas = disciplinas.flatMap(d => d.aulas || []);
  const assuntos = disciplinas.flatMap(d => d.assuntos || []);
  const blocks = tree.planejamento?.retaFinal?.blocos;
  const historicalUnresolvedReferences = { aulaId: null, rfBlocoId: null };
  const exceptions = [];
  for (const [field, items, complete, target] of [
    ['aulaId', aulas, disciplinas.every(d => Array.isArray(d.aulas)), 'aulas'],
    ['rfBlocoId', blocks || [], Array.isArray(blocks), 'retaFinalBlocos'],
  ]) {
    if (!complete) continue;
    historicalUnresolvedReferences[field] = 0;
    const ids = new Set(items.map(item => item.id));
    tree.eventos.forEach((event, i) => {
      if (event[field] === undefined || event[field] === null || event[field] === '' || ids.has(event[field])) return;
      historicalUnresolvedReferences[field]++;
      exceptions.push({ type: 'historicalUnresolvedReference', path: pointer(['eventos', i, field]), target });
    });
  }
  exceptions.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const businessCounts = { editais: tree.editais.length, disciplinas: disciplinas.length,
    aulas: aulas.length, assuntos: assuntos.length, eventos: tree.eventos.length,
    habitos: Object.values(tree.habitos).reduce((n, items) => n + items.length, 0),
    retaFinalBlocos: blocks?.length || 0, tombstones: 0,
    planejamentoArquivado: tree.planejamentoArquivado == null ? 0 : 1 };
  tree.editais.forEach((edital, e) => split(edital.disciplinas, 'disciplinas', 'disciplina', ['editais', e, 'disciplinas']));
  split(tree.editais, 'editais', 'edital', ['editais']);
  split(tree.eventos, 'eventos', 'evento', ['eventos']);
  for (const [type, items] of Object.entries(tree.habitos)) {
    split(items, 'habitos', `habito.${type}`, ['habitos', type]);
  }
  if (blocks) split(blocks, 'retaFinalBlocos', 'retaFinalBloco', ['planejamento', 'retaFinal', 'blocos']);
  for (const path of [['syncTombstones'], ['config', 'entityTombstones']]) {
    const parent = path.length === 1 ? tree : tree.config;
    const name = path.at(-1);
    const items = parent[name];
    if (items === undefined || items === null) continue;
    const entries = Array.isArray(items) ? items.map((item, i) => [i, item]) : Object.entries(items);
    for (const [slot, data] of entries) {
      // Origin/collection disambiguate evidence; array order is never identity.
      const [collection, identity] = tombstoneIdentity(data, slot, Array.isArray(items), [...path, slot]);
      const type = `tombstone.${path.join('.')}.${collection}`;
      add('tombstones', type, identity, [...path, slot], data);
      items[slot] = null;
      businessCounts.tombstones++;
    }
  }
  for (const name of META_FIELDS) {
    if (!own(tree, name)) continue;
    add('meta', 'meta', name, [name], tree[name]);
    tree[name] = null;
  }
  add('meta', 'meta', '$root', [], tree);
  for (const items of Object.values(records)) items.sort((a, b) => comparePaths(a.path, b.path));
  const byCollection = Object.fromEntries(COLLECTIONS.map(name => [name, records[name].length]));
  const manifestDraft = {
    schemaVersion: 12, digestAlgorithm: 'SHA-256', businessDigest, businessCounts,
    counts: { total: Object.values(byCollection).reduce((a, b) => a + b, 0), byCollection },
    collectionDigests: Object.fromEntries(COLLECTIONS.map(name => [name, digest(records[name])])),
    recordDigests: Object.fromEntries(COLLECTIONS.map(name => [name, records[name].map(digest)])),
    historicalUnresolvedReferences,
  };
  return { records, manifestDraft, exclusions: exclusions.sort(), exceptions };
}

/** Rebuild records fetched in any order. Reject missing slots/invalid topology.
 * Read-back integrity against the source also requires comparing manifest digests.
 * @param {Record<string, object[]>} records
 * @returns {object}
 */
export function reconstituteBackupV12(records) {
  if (!isObject(records) || COLLECTIONS.some(name => !Array.isArray(records[name])) ||
    Object.keys(records).length !== COLLECTIONS.length) fail([], 'invalid record collections');
  const copied = businessTree(records);
  const flat = Object.values(copied).flat();
  if (flat.some(record => !isObject(record) || !Array.isArray(record.path))) fail([], 'invalid record');
  flat.sort((a, b) => a.path.length - b.path.length || comparePaths(a.path, b.path));
  const root = flat.shift();
  if (!root || root.key !== 'meta:$root' || root.path.length !== 0) fail([], 'missing root record');
  const tree = root.data;
  for (const record of flat) {
    if (!record.path.length) fail([], 'duplicate root');
    let parent = tree;
    for (const segment of record.path.slice(0, -1)) {
      if (!parent || !own(parent, segment)) fail([], 'invalid record path');
      parent = parent[segment];
    }
    const slot = record.path.at(-1);
    if (!parent || !own(parent, slot) || parent[slot] !== null) fail([], 'invalid record slot');
    Object.defineProperty(parent, slot, { value: record.data, enumerable: true, writable: true, configurable: true });
  }
  const rebuilt = convertBackupV12(tree);
  // Re-conversion validates topology/IDs and prevents accepting injected secrets.
  for (const name of COLLECTIONS) {
    const sorted = [...records[name]].sort((a, b) => comparePaths(a.path, b.path));
    if (canonical(rebuilt.records[name]) !== canonical(sorted)) fail([], 'record topology or sanitation mismatch');
  }
  return tree;
}

/** Compare canonical academic trees, reporting JSON paths and kinds only.
 * @returns {{ok: boolean, differences: object[]}}
 */
export function auditBusinessEquivalence(raw, restored) {
  const left = businessTree(raw), right = businessTree(restored);
  const differences = [];
  function compare(a, b, path) {
    if (Object.is(a, b)) return;
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (i >= a.length || i >= b.length) differences.push({ path: publicPointer([...path, i]), kind: 'presence' });
        else compare(a[i], b[i], [...path, i]);
      }
    } else if (isObject(a) && isObject(b)) {
      for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
        if (!own(a, key) || !own(b, key)) differences.push({ path: publicPointer([...path, key]), kind: 'presence' });
        else compare(a[key], b[key], [...path, key]);
      }
    } else differences.push({ path: publicPointer(path), kind: 'value' });
  }
  compare(left, right, []);
  return { ok: differences.length === 0, differences };
}
