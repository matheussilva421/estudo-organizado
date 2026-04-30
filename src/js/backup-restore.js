const ARRAY_COLLECTIONS = ['editais', 'eventos', 'arquivo', 'revisoes'];
const HABIT_TYPES = [
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

function idSet(items = []) {
  return new Set((Array.isArray(items) ? items : []).map((item) => item?.id).filter(Boolean));
}

function collectionImpact(currentItems = [], incomingItems = []) {
  const currentIds = idSet(currentItems);
  const incomingIds = idSet(incomingItems);
  let added = 0;
  let removed = 0;
  let kept = 0;

  for (const id of incomingIds) {
    if (currentIds.has(id)) kept += 1;
    else added += 1;
  }
  for (const id of currentIds) {
    if (!incomingIds.has(id)) removed += 1;
  }

  return {
    current: currentIds.size,
    incoming: incomingIds.size,
    added,
    removed,
    kept,
  };
}

export function validateBackupPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    return { ok: false, errors: ['backup must be an object'], schemaVersion: null };
  }

  const schemaVersion = Number(payload.schemaVersion || 0) || null;
  if (!schemaVersion) errors.push('schemaVersion is required');
  for (const key of ARRAY_COLLECTIONS) {
    if (payload[key] !== undefined && !Array.isArray(payload[key])) {
      errors.push(`${key} must be an array`);
    }
  }

  const config = payload.config || {};
  if (config.cfToken) errors.push('backup must not include Cloudflare token');
  if (config.cfUrl) errors.push('backup must not include Cloudflare URL');
  if (config.cfTokenSaved) errors.push('backup must not include Cloudflare token marker');
  if (config.firestoreSync?.enabled) {
    errors.push('backup must not include enabled Firestore runtime sync');
  }
  if (config.entitySync?.mode && config.entitySync.mode !== 'off') {
    errors.push('backup must not include active entity runtime sync');
  }

  return {
    ok: errors.length === 0,
    errors,
    schemaVersion,
  };
}

export function previewRestoreImpact(currentState = {}, incomingState = {}) {
  const collections = {};
  for (const key of ARRAY_COLLECTIONS) {
    collections[key] = collectionImpact(currentState[key], incomingState[key]);
  }

  for (const type of HABIT_TYPES) {
    collections[`habitos.${type}`] = collectionImpact(
      currentState.habitos?.[type],
      incomingState.habitos?.[type]
    );
  }

  const totals = Object.values(collections).reduce(
    (acc, item) => {
      acc.added += item.added;
      acc.removed += item.removed;
      acc.kept += item.kept;
      return acc;
    },
    { added: 0, removed: 0, kept: 0 }
  );

  return {
    collections,
    totals,
    destructive: totals.removed > 0,
  };
}
