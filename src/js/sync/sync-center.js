const SOURCE_ORDER = ['local', 'firebase', 'cloudflare', 'drive'];

function toTime(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function latestIso(...values) {
  const newest = values.map(toTime).filter(Boolean).sort((a, b) => b - a)[0];
  return newest ? new Date(newest).toISOString() : null;
}

function hasCloudflareCredentials(config = {}) {
  return Boolean(config.cfTokenSaved || config.cfToken);
}

export function canAutoSyncFirestore(config = {}, pending = null, now = Date.now()) {
  if (!config.enabled) return false;
  if (config.conflict) return false;
  if (!pending) return true;
  if (pending.status === 'conflict') return false;
  if (pending.nextAttemptAt && toTime(pending.nextAttemptAt) > now) return false;
  return true;
}

export function buildSyncCenterModel({ state, firestoreStatus = {} }) {
  const config = state?.config || {};
  const firestore = {
    ...config.firestoreSync,
    ...firestoreStatus
  };
  const cloudflareConfigured = Boolean(config.cfUrl && hasCloudflareCredentials(config));
  const driveConfigured = Boolean(state?.driveFileId);

  const sources = [
    {
      id: 'local',
      title: 'Local',
      label: 'IndexedDB neste dispositivo',
      primary: false,
      enabled: true,
      configured: true,
      health: 'ok',
      pending: false,
      lastLocalAt: config.localBackupAt || null,
      lastSyncAt: config.localBackupAt || null,
      remoteAt: null,
      detail: 'Fonte de recuperacao imediata.'
    },
    {
      id: 'firebase',
      title: 'Firebase',
      label: 'Firestore primario',
      primary: true,
      enabled: Boolean(firestore.enabled),
      configured: Boolean(firestore.configured),
      signedIn: Boolean(firestore.signedIn || firestore.uid),
      mode: firestore.mode || 'shadow',
      health: firestore.conflict ? 'conflict' : firestore.lastError ? 'error' : firestore.hasPendingWrites ? 'pending' : firestore.enabled ? 'ok' : 'idle',
      pending: Boolean(firestore.hasPendingWrites),
      lastPullAt: firestore.lastPullAt || null,
      lastPushAt: firestore.lastPushAt || null,
      lastSyncAt: latestIso(firestore.lastPullAt, firestore.lastPushAt),
      remoteAt: firestore.remoteUpdatedAt || null,
      conflict: firestore.conflict || null,
      lastError: firestore.lastError || null,
      detail: firestore.enabled ? `Modo ${firestore.mode || 'shadow'}` : 'Ative depois de entrar com Google.'
    },
    {
      id: 'cloudflare',
      title: 'Cloudflare',
      label: 'Worker/KV secundario',
      primary: false,
      enabled: Boolean(config.cfSyncEnabled),
      configured: cloudflareConfigured,
      health: config.cfConflict ? 'conflict' : config.cfSyncEnabled ? 'ok' : 'idle',
      pending: false,
      lastSyncAt: config.cfLastSyncAt || null,
      remoteAt: config.cfRemoteUpdatedAt || null,
      conflict: config.cfConflict || null,
      detail: cloudflareConfigured ? 'Worker configurado.' : 'Informe URL e token para usar.'
    },
    {
      id: 'drive',
      title: 'Google Drive',
      label: 'Backup manual/secundario',
      primary: false,
      enabled: driveConfigured,
      configured: driveConfigured,
      health: driveConfigured ? 'ok' : 'idle',
      pending: false,
      lastSyncAt: state?.lastSync || null,
      remoteAt: state?.lastSync || null,
      detail: driveConfigured ? 'Arquivo de backup conectado.' : 'Conecte para backup em arquivo.'
    }
  ];

  return {
    sources: SOURCE_ORDER.map(id => sources.find(source => source.id === id)),
    primarySource: 'firebase',
    needsAttention: sources.some(source => source.health === 'conflict' || source.health === 'error'),
    newestRemoteAt: latestIso(firestore.remoteUpdatedAt, config.cfRemoteUpdatedAt, state?.lastSync),
    newestLocalAt: config.localBackupAt || null
  };
}

function mergeArrayById(localArray = [], remoteArray = []) {
  const merged = new Map();
  for (const item of remoteArray) {
    const key = item?.id || JSON.stringify(item);
    merged.set(key, item);
  }
  for (const item of localArray) {
    const key = item?.id || JSON.stringify(item);
    merged.set(key, item);
  }
  return Array.from(merged.values());
}

export function mergeStudyStates(localState = {}, remoteState = {}) {
  const merged = {
    ...remoteState,
    ...localState,
    config: {
      ...(remoteState.config || {}),
      ...(localState.config || {})
    }
  };

  for (const key of ['editais', 'eventos', 'arquivo', 'revisoes']) {
    merged[key] = mergeArrayById(localState[key], remoteState[key]);
  }

  const habitTypes = new Set([
    ...Object.keys(remoteState.habitos || {}),
    ...Object.keys(localState.habitos || {})
  ]);
  merged.habitos = {};
  for (const type of habitTypes) {
    merged.habitos[type] = mergeArrayById(localState.habitos?.[type], remoteState.habitos?.[type]);
  }

  merged.config.localBackupAt = new Date().toISOString();
  return merged;
}
