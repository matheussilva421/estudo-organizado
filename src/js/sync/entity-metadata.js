export const ENTITY_TOMBSTONE_LIMIT = 500;
export const ENTITY_TOMBSTONE_TTL_DAYS = 180;

const HABIT_DEFAULT_TYPES = [
  'questoes',
  'revisao',
  'discursiva',
  'simulado',
  'leitura',
  'informativo',
  'sumula',
  'videoaula',
  'paginas',
];

export const TRACKED_ENTITY_COLLECTIONS = [
  'editais',
  'disciplinas',
  'assuntos',
  'aulas',
  'eventos',
  'arquivo',
  'revisoes',
  'habitos.*',
  'planejamento.sequencia',
];

function cloneWithoutSync(value) {
  if (Array.isArray(value)) {
    return value.map(cloneWithoutSync);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        if (key === '_sync') return acc;
        acc[key] = cloneWithoutSync(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function toIso(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function normalizeNow(value) {
  return toIso(value) || new Date().toISOString();
}

function toTime(value) {
  const time = new Date(value || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getDeviceId(options = {}) {
  if (options.updatedBy) return options.updatedBy;
  if (options.deviceId) return options.deviceId;
  try {
    return localStorage.getItem('estudo_firestore_device_id') || 'local-device';
  } catch {
    return 'local-device';
  }
}

function ensureConfig(state) {
  if (!state.config || typeof state.config !== 'object') state.config = {};
  if (!Array.isArray(state.config.entityTombstones)) state.config.entityTombstones = [];
  return state.config;
}

function getEntityId(entity) {
  if (!entity || typeof entity !== 'object') return null;
  return entity.id || entity.uid || entity.key || null;
}

function pushEntity(target, collection, key, entity) {
  const id = getEntityId(entity);
  if (!id) return;
  target.push({ collection, key, id: String(id), entity });
}

export function visitTrackedEntities(state = {}) {
  const entities = [];

  for (const edital of Array.isArray(state.editais) ? state.editais : []) {
    const editalId = getEntityId(edital);
    if (!editalId) continue;
    pushEntity(entities, 'editais', `editais/${editalId}`, edital);

    for (const disciplina of Array.isArray(edital.disciplinas) ? edital.disciplinas : []) {
      const disciplinaId = getEntityId(disciplina);
      if (!disciplinaId) continue;
      pushEntity(
        entities,
        'disciplinas',
        `editais/${editalId}/disciplinas/${disciplinaId}`,
        disciplina
      );

      for (const assunto of Array.isArray(disciplina.assuntos) ? disciplina.assuntos : []) {
        const assuntoId = getEntityId(assunto);
        if (assuntoId)
          pushEntity(
            entities,
            'assuntos',
            `editais/${editalId}/disciplinas/${disciplinaId}/assuntos/${assuntoId}`,
            assunto
          );
      }

      for (const aula of Array.isArray(disciplina.aulas) ? disciplina.aulas : []) {
        const aulaId = getEntityId(aula);
        if (aulaId)
          pushEntity(
            entities,
            'aulas',
            `editais/${editalId}/disciplinas/${disciplinaId}/aulas/${aulaId}`,
            aula
          );
      }
    }
  }

  for (const evento of Array.isArray(state.eventos) ? state.eventos : []) {
    const id = getEntityId(evento);
    if (id) pushEntity(entities, 'eventos', `eventos/${id}`, evento);
  }

  for (const item of Array.isArray(state.arquivo) ? state.arquivo : []) {
    const id = getEntityId(item);
    if (id) pushEntity(entities, 'arquivo', `arquivo/${id}`, item);
  }

  for (const revisao of Array.isArray(state.revisoes) ? state.revisoes : []) {
    const id = getEntityId(revisao);
    if (id) pushEntity(entities, 'revisoes', `revisoes/${id}`, revisao);
  }

  const habitos = state.habitos && typeof state.habitos === 'object' ? state.habitos : {};
  const habitTypes = new Set([...HABIT_DEFAULT_TYPES, ...Object.keys(habitos)]);
  for (const type of habitTypes) {
    for (const habit of Array.isArray(habitos[type]) ? habitos[type] : []) {
      const id = getEntityId(habit);
      if (id) pushEntity(entities, `habitos.${type}`, `habitos/${type}/${id}`, habit);
    }
  }

  for (const item of Array.isArray(state.planejamento?.sequencia)
    ? state.planejamento.sequencia
    : []) {
    const id = getEntityId(item);
    if (id) pushEntity(entities, 'planejamento.sequencia', `planejamento/sequencia/${id}`, item);
  }

  return entities;
}

export function stableEntityChecksum(entity) {
  return hashString(stableStringify(cloneWithoutSync(entity)));
}

function normalizePreviousIndex(previousIndex) {
  if (!previousIndex) return new Map();
  if (previousIndex instanceof Map) return previousIndex;
  if (Array.isArray(previousIndex)) return new Map(previousIndex.map((item) => [item.key, item]));
  if (typeof previousIndex === 'object') return new Map(Object.entries(previousIndex));
  return new Map();
}

function normalizeEntitySync(entity, record, options) {
  const now = normalizeNow(options.now);
  const updatedBy = getDeviceId(options);
  const previous = options.previousIndex.get(record.key);
  const existing = entity._sync && typeof entity._sync === 'object' ? entity._sync : {};
  const checksum = stableEntityChecksum(entity);
  const previousRevision = Number(previous?.revision || existing.revision || 0);
  const changed = Boolean(
    previous && previous.checksum && previous.checksum !== checksum && !options.baselineOnly
  );
  const revision = changed
    ? previousRevision + 1
    : Math.max(1, previousRevision || Number(existing.revision || 1));
  const updatedAt = changed ? now : normalizeNow(existing.updatedAt || previous?.updatedAt || now);

  entity._sync = {
    createdAt: normalizeNow(existing.createdAt || previous?.createdAt || updatedAt || now),
    updatedAt,
    deletedAt: existing.deletedAt ? normalizeNow(existing.deletedAt) : null,
    revision,
    updatedBy: changed ? updatedBy : existing.updatedBy || previous?.updatedBy || updatedBy,
  };

  return {
    key: record.key,
    collection: record.collection,
    id: record.id,
    checksum,
    updatedAt: entity._sync.updatedAt,
    revision: entity._sync.revision,
    createdAt: entity._sync.createdAt,
    updatedBy: entity._sync.updatedBy,
    changed,
  };
}

function createTombstones(state, currentKeys, options) {
  const previousIndex = options.previousIndex;
  const tombstones = [];
  if (options.baselineOnly) return tombstones;

  for (const [key, record] of previousIndex.entries()) {
    if (currentKeys.has(key)) continue;
    const deletedAt = normalizeNow(options.now);
    tombstones.push({
      key,
      collection: record.collection || key.split('/')[0],
      id: String(record.id || key.split('/').pop()),
      deletedAt,
      deletedBy: getDeviceId(options),
      revision: Number(record.revision || 0) + 1,
    });
  }

  if (tombstones.length === 0) return tombstones;
  const config = ensureConfig(state);
  const byKey = new Map((config.entityTombstones || []).map((item) => [item.key, item]));
  tombstones.forEach((item) => byKey.set(item.key, item));
  config.entityTombstones = pruneTombstones(Array.from(byKey.values()), options.now);
  return tombstones;
}

export function pruneTombstones(tombstones = [], now = Date.now()) {
  const cutoff = toTime(now) - ENTITY_TOMBSTONE_TTL_DAYS * 24 * 60 * 60 * 1000;
  return tombstones
    .filter((item) => item?.key && toTime(item.deletedAt) >= cutoff)
    .sort((a, b) => toTime(b.deletedAt) - toTime(a.deletedAt))
    .slice(0, ENTITY_TOMBSTONE_LIMIT);
}

export function createEntityIndex(sourceState = {}) {
  return visitTrackedEntities(sourceState).map((record) => {
    const sync = record.entity._sync || {};
    return {
      key: record.key,
      collection: record.collection,
      id: record.id,
      checksum: stableEntityChecksum(record.entity),
      updatedAt: toIso(sync.updatedAt),
      revision: Number(sync.revision || 1),
    };
  });
}

export function normalizeEntityMetadata(sourceState = {}, options = {}) {
  const config = ensureConfig(sourceState);
  const previousIndex = normalizePreviousIndex(options.previousIndex);
  const entities = visitTrackedEntities(sourceState);
  const currentKeys = new Set();
  const changed = [];
  const index = [];

  for (const record of entities) {
    currentKeys.add(record.key);
    const item = normalizeEntitySync(record.entity, record, { ...options, previousIndex });
    index.push(item);
    if (item.changed) changed.push(item);
  }

  config.entityTombstones = pruneTombstones(config.entityTombstones || [], options.now);
  const removed = createTombstones(sourceState, currentKeys, { ...options, previousIndex });

  return {
    index,
    changed,
    removed,
    manifest: buildEntityManifest(sourceState),
  };
}

export function buildEntityManifest(sourceState = {}) {
  const active = createEntityIndex(sourceState).map((item) => ({
    key: item.key,
    collection: item.collection,
    id: item.id,
    updatedAt: item.updatedAt,
    deletedAt: null,
    revision: item.revision,
    checksum: item.checksum,
  }));
  const tombstones = (sourceState.config?.entityTombstones || []).map((item) => ({
    key: item.key,
    collection: item.collection,
    id: String(item.id),
    updatedAt: null,
    deletedAt: toIso(item.deletedAt),
    revision: Number(item.revision || 1),
    checksum: null,
  }));
  return [...active, ...tombstones];
}

function idForMerge(item) {
  return item?.id || JSON.stringify(item);
}

function comparableRevision(item) {
  const revision = Number(item?._sync?.revision);
  return Number.isFinite(revision) && revision > 0 ? revision : null;
}

function comparableUpdatedAt(item) {
  const value = item?._sync?.updatedAt || item?.updatedAt || null;
  return toTime(value) || null;
}

function entitiesDiffer(a, b) {
  return stableEntityChecksum(a) !== stableEntityChecksum(b);
}

function chooseEntityWinner(localItem, remoteItem) {
  const localRevision = comparableRevision(localItem);
  const remoteRevision = comparableRevision(remoteItem);
  if (localRevision !== null && remoteRevision !== null && localRevision !== remoteRevision) {
    return localRevision > remoteRevision ? localItem : remoteItem;
  }

  const localUpdatedAt = comparableUpdatedAt(localItem);
  const remoteUpdatedAt = comparableUpdatedAt(remoteItem);
  if (localUpdatedAt && remoteUpdatedAt && localUpdatedAt !== remoteUpdatedAt) {
    return localUpdatedAt > remoteUpdatedAt ? localItem : remoteItem;
  }

  return null;
}

export function mergeEntityAwareArrays(localArray = [], remoteArray = [], options = {}) {
  const merged = new Map();
  const collisions = options.collisions || [];
  const collection = options.collection || 'items';

  for (const item of remoteArray || []) {
    merged.set(idForMerge(item), item);
  }

  for (const item of localArray || []) {
    const key = idForMerge(item);
    const remoteItem = merged.get(key);
    if (remoteItem && entitiesDiffer(remoteItem, item)) {
      const winner = chooseEntityWinner(item, remoteItem);
      if (winner) {
        merged.set(key, winner);
      } else {
        collisions.push({
          collection,
          id: item?.id || key,
          localRevision: comparableRevision(item),
          remoteRevision: comparableRevision(remoteItem),
          localUpdatedAt: item?._sync?.updatedAt || item?.updatedAt || item?.data || null,
          remoteUpdatedAt:
            remoteItem?._sync?.updatedAt || remoteItem?.updatedAt || remoteItem?.data || null,
        });
        merged.set(key, item);
      }
    } else {
      merged.set(key, item);
    }
  }

  return Array.from(merged.values());
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readEntityIndexStore(db, storeName) {
  if (!db || !storeName || !db.objectStoreNames?.contains(storeName)) return new Map();
  try {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    if (typeof store.getAll !== 'function') return new Map();
    const records = await requestToPromise(store.getAll());
    return normalizePreviousIndex(records || []);
  } catch (err) {
    console.error('Failed to read entity index store:', err);
    return new Map();
  }
}

export async function writeEntityIndexStore(db, storeName, index = [], removed = []) {
  if (!db || !storeName || !db.objectStoreNames?.contains(storeName)) return;
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      if (typeof store.put !== 'function' || typeof store.delete !== 'function') {
        resolve();
        return;
      }
      for (const item of index) {
        store.put(item);
      }
      for (const item of removed) {
        store.delete(item.key);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch (err) {
    console.error('Failed to write entity index store:', err);
  }
}

export async function prepareEntityMetadataForSave(sourceState, options = {}) {
  const previousIndex =
    options.previousIndex || (await readEntityIndexStore(options.db, options.storeName));
  const result = normalizeEntityMetadata(sourceState, {
    previousIndex,
    now: options.now,
    updatedBy: options.updatedBy || options.deviceId,
    baselineOnly: Boolean(options.baselineOnly),
  });
  await writeEntityIndexStore(options.db, options.storeName, result.index, result.removed);
  return result;
}
