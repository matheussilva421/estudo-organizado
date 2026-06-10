import { deriveSyncHealthState, summarizeSyncMetrics } from './sync-health.js?v=8.37';
import { getEnvelopeUpdatedAt, getLocalContentUpdatedAt } from './firestore-schema.js?v=8.37';

const SOURCE_ORDER = ['local', 'firebase', 'cloudflare', 'drive'];

function toTime(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function latestIso(...values) {
  const newest = values
    .map(toTime)
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  return newest ? new Date(newest).toISOString() : null;
}

function hasCloudflareCredentials(config = {}) {
  return Boolean(config.cfToken);
}

function getItemUpdatedAt(item) {
  return item?.updatedAt || item?._sync?.updatedAt || item?.criadoEm || 0;
}

// =============================================
// TOMBSTONES DE EXCLUSÃO
// =============================================
// mergeById é uma união por id: a ausência de um item não carrega informação,
// então uma exclusão local ressuscitava no merge se o payload remoto ainda
// tivesse o item. Os tombstones ({ col, id, deletedAt }) registram exclusões
// reais do usuário, viajam dentro do payload (createExportableState clona o
// estado inteiro) e filtram o item nos dois sentidos do merge. Um item
// recriado/atualizado DEPOIS do deletedAt sobrevive (LWW). Clientes antigos
// ignoram o campo — comportamento atual preservado quando ele não existe.
const TOMBSTONE_MAX_AGE_DAYS = 180;
const TOMBSTONE_CAP = 2000;

export function recordSyncTombstone(state, col, id) {
  if (!state || !col || !id) return;
  if (!Array.isArray(state.syncTombstones)) state.syncTombstones = [];
  const deletedAt = new Date().toISOString();
  const existing = state.syncTombstones.find((t) => t?.col === col && t?.id === id);
  if (existing) {
    existing.deletedAt = deletedAt;
    return;
  }
  state.syncTombstones.push({ col, id, deletedAt });
}

function mergeTombstones(localList, remoteList) {
  const all = [
    ...(Array.isArray(localList) ? localList : []),
    ...(Array.isArray(remoteList) ? remoteList : []),
  ];
  const cutoff = Date.now() - TOMBSTONE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const byKey = new Map();
  for (const t of all) {
    if (!t?.col || !t?.id) continue;
    const time = toTime(t.deletedAt);
    if (!time || time < cutoff) continue;
    const key = `${t.col}:${t.id}`;
    const existing = byKey.get(key);
    if (!existing || toTime(existing.deletedAt) < time) byKey.set(key, t);
  }
  return Array.from(byKey.values())
    .sort((a, b) => toTime(b.deletedAt) - toTime(a.deletedAt))
    .slice(0, TOMBSTONE_CAP);
}

function buildTombstoneIndex(tombstones, col) {
  const index = new Map();
  for (const t of tombstones || []) {
    if (t.col === col) index.set(t.id, toTime(t.deletedAt));
  }
  return index;
}

function isTombstoned(item, tombstoneIndex) {
  if (!tombstoneIndex || tombstoneIndex.size === 0) return false;
  const deletedTime = tombstoneIndex.get(item?.id);
  if (!deletedTime) return false;
  return deletedTime >= toTime(getItemUpdatedAt(item));
}

function mergeById(localArr, remoteArr, tombstoneIndex) {
  const localItems = Array.isArray(localArr) ? localArr : [];
  const remoteItems = Array.isArray(remoteArr) ? remoteArr : [];
  const map = new Map();
  for (const item of remoteItems) {
    if (item?.id) map.set(item.id, item);
  }
  for (const item of localItems) {
    if (!item?.id) continue;
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      continue;
    }
    const localTime = getItemUpdatedAt(item);
    const remoteTime = getItemUpdatedAt(existing);
    if (localTime >= remoteTime) map.set(item.id, item);
  }
  return Array.from(map.values()).filter((item) => !isTombstoned(item, tombstoneIndex));
}

export function isGlobalSyncPaused(config = {}) {
  return config.globalSyncPaused === true;
}

export function getManualSyncStatus(config = {}) {
  const enabled = isGlobalSyncPaused(config);
  return {
    enabled,
    label: enabled ? 'Sincronização manual ativa' : 'Sincronização automática',
    lastSyncAt: config.lastManualSyncAt || null,
  };
}

function deriveQuietSyncView({ syncHealth, firestore, globalSyncPaused = false }) {
  const signedIn = Boolean(firestore.signedIn || firestore.uid);
  const isPrimary = firestore.mode === 'primary';

  if (globalSyncPaused) {
    return {
      title: 'Sincronização manual',
      detail:
        'O app salva neste dispositivo e só sincroniza quando você iniciar manualmente. Os dados locais continuam preservados.',
      tone: 'idle',
      primaryAction: null,
    };
  }

  if (syncHealth.state === 'conflict') {
    return {
      title: 'Ação necessária',
      detail:
        'Existe um conflito real de sync. Seus dados locais continuam preservados; abra as opções avançadas para resolver.',
      tone: 'danger',
      primaryAction: 'advanced',
    };
  }

  if (/permission|denied|permiss/i.test(String(firestore.lastError || ''))) {
    return {
      title: 'Ação necessária',
      detail:
        'O Firestore negou permissão para sincronizar. Seus dados locais continuam preservados; revise login e regras nas opções avançadas.',
      tone: 'danger',
      primaryAction: 'advanced',
    };
  }

  if (syncHealth.state === 'degraded' || firestore.lastError) {
    return {
      title: 'Sync aguardando recuperação',
      detail:
        'O app continua salvando neste dispositivo e tentará sincronizar novamente. Use as opções avançadas se o erro persistir.',
      tone: 'warning',
      primaryAction: 'advanced',
    };
  }

  if (syncHealth.state === 'offline') {
    return {
      title: 'Offline, sync automático pausado',
      detail:
        'Suas alterações continuam salvas neste dispositivo e serão enviadas ao Firestore quando a conexão voltar.',
      tone: 'pending',
      primaryAction: null,
    };
  }

  if (!firestore.configured) {
    return {
      title: 'Salvo neste dispositivo',
      detail:
        'O salvamento local está ativo. Configure o Firebase para sincronização automática entre dispositivos.',
      tone: 'idle',
      primaryAction: null,
    };
  }

  if (!signedIn) {
    return {
      title: 'Salvo neste dispositivo',
      detail:
        'Entre com Google para ativar o sync automático. Enquanto isso, o app continua seguro localmente.',
      tone: 'idle',
      primaryAction: 'sign-in',
    };
  }

  if (!firestore.enabled) {
    return {
      title: 'Sync remoto pausado',
      detail:
        'O salvamento local está funcionando. Ative o Firestore primary para sincronizar automaticamente.',
      tone: 'idle',
      primaryAction: 'advanced',
    };
  }

  if (syncHealth.state === 'syncing') {
    return {
      title: 'Sincronizando automaticamente',
      detail: 'As alterações já foram salvas no dispositivo e estão sendo enviadas ao Firestore.',
      tone: 'pending',
      primaryAction: null,
    };
  }

  if (syncHealth.state === 'queued') {
    return {
      title: 'Sync automático na fila',
      detail:
        'As alterações estão salvas localmente e serão enviadas pelo app assim que a tentativa atual puder rodar.',
      tone: 'pending',
      primaryAction: null,
    };
  }

  if (isPrimary) {
    return {
      title: 'Tudo salvo automaticamente',
      detail:
        'Suas alterações ficam salvas neste dispositivo e o Firestore sincroniza sozinho em segundo plano.',
      tone: 'ok',
      primaryAction: null,
    };
  }

  return {
    title: 'Sync em modo de verificação',
    detail:
      'O Firestore está ativo fora do modo primary. Use o modo primary para sync automático completo.',
    tone: 'idle',
    primaryAction: 'advanced',
  };
}

export function canAutoSyncFirestore(config = {}, pending = null, now = Date.now()) {
  if (isGlobalSyncPaused(config)) return false;
  if (!config.enabled) return false;
  if (config.mode !== 'primary') return false;
  if (config.conflict?.type === 'entity-conflict') return false;
  if (!pending) return true;
  if (pending.status === 'conflict') return false;
  if (pending.nextAttemptAt && toTime(pending.nextAttemptAt) > now) return false;
  return true;
}

export function buildSyncCenterModel({ state, firestoreStatus = {}, getFirestoreStatus = null }) {
  const config = state?.config || {};
  const offline =
    config.syncHealth?.offline === true ||
    (typeof navigator !== 'undefined' && navigator.onLine === false);
  const configuredFirestore = config.firestoreSync || {};
  const globalSyncPaused = isGlobalSyncPaused(config);
  const runtimeFirestore =
    typeof getFirestoreStatus === 'function' ? getFirestoreStatus() || {} : {};
  const firestore = {
    ...configuredFirestore,
    ...runtimeFirestore,
    ...firestoreStatus,
  };
  firestore.conflict =
    firestoreStatus.conflict ?? runtimeFirestore.conflict ?? configuredFirestore.conflict ?? null;
  firestore.lastError =
    firestoreStatus.lastError ||
    runtimeFirestore.lastError ||
    configuredFirestore.lastError ||
    null;
  const cloudflareConfigured = Boolean(config.cfUrl && hasCloudflareCredentials(config));
  const driveConfigured = Boolean(state?.driveFileId);
  const firestorePending = firestore.pending || null;
  const syncHealth = deriveSyncHealthState({
    firestore,
    pending: firestorePending,
    conflict: firestore.conflict,
    lastError: firestore.lastError,
    localSavedAt: config.localBackupAt || null,
    remoteAckAt: firestore.lastPushAt || firestore.remoteUpdatedAt || null,
    failureCount: config.syncHealth?.failureCount || 0,
    offline,
  });
  const healthStatus = globalSyncPaused ? 'paused' : syncHealth.state;
  const syncMetrics = summarizeSyncMetrics(syncHealth.metrics);
  const performanceMetrics = Array.isArray(config.syncPerformance?.metrics)
    ? config.syncPerformance.metrics
        .filter((metric) => metric && typeof metric.name === 'string')
        .map((metric) => ({
          name: metric.name,
          durationMs: Number(metric.durationMs || 0),
          at: metric.at || null,
        }))
    : [];

  const sources = [
    {
      id: 'local',
      title: 'Local',
      icon: 'fa-database',
      label: 'IndexedDB neste dispositivo',
      primary: false,
      enabled: true,
      configured: true,
      health: 'ok',
      pending: false,
      lastLocalAt: config.localBackupAt || null,
      lastSyncAt: config.localBackupAt || null,
      remoteAt: null,
      detail: 'Fonte de recuperação imediata.',
    },
    {
      id: 'firebase',
      title: 'Firebase',
      icon: 'fa-fire',
      label: 'Firestore primário',
      primary: true,
      enabled: Boolean(firestore.enabled),
      configured: Boolean(firestore.configured),
      signedIn: Boolean(firestore.signedIn || firestore.uid),
      mode: firestore.mode || 'shadow',
      health: firestore.conflict
        ? 'conflict'
        : firestore.lastError
          ? 'error'
          : globalSyncPaused
            ? 'idle'
            : firestore.hasPendingWrites
              ? 'pending'
              : firestore.enabled
                ? 'ok'
                : 'idle',
      pending: Boolean(firestore.hasPendingWrites),
      healthState: syncHealth.state,
      metrics: syncMetrics,
      lastPullAt: firestore.lastPullAt || null,
      lastPushAt: firestore.lastPushAt || null,
      lastSyncAt: latestIso(firestore.lastPullAt, firestore.lastPushAt),
      remoteAt: firestore.remoteUpdatedAt || null,
      conflict: firestore.conflict || null,
      lastError: firestore.lastError || null,
      entityShadowDiff: null,
      detail: firestore.enabled
        ? firestore.mode === 'primary'
          ? 'Sync automático principal.'
          : 'Shadow: sem envio automático.'
        : 'Ative depois de entrar com Google.',
    },
    {
      id: 'cloudflare',
      title: 'Cloudflare',
      icon: 'fa-cloud',
      label: 'Backup Worker/KV secundário',
      primary: false,
      enabled: Boolean(config.cfSyncEnabled),
      configured: cloudflareConfigured,
      health: config.cfConflict ? 'conflict' : config.cfSyncEnabled ? 'ok' : 'idle',
      pending: false,
      lastSyncAt: config.cfLastSyncAt || null,
      remoteAt: config.cfRemoteUpdatedAt || null,
      conflict: config.cfConflict || null,
      detail: cloudflareConfigured
        ? 'Backup manual configurado.'
        : 'Informe URL e token para backup.',
    },
    {
      id: 'drive',
      title: 'Google Drive',
      icon: 'fa-brands fa-google-drive',
      label: 'Backup manual/secundário',
      primary: false,
      enabled: driveConfigured,
      configured: driveConfigured,
      health: driveConfigured ? 'ok' : 'idle',
      pending: false,
      lastSyncAt: state?.lastSync || null,
      remoteAt: state?.lastSync || null,
      detail: driveConfigured ? 'Arquivo de backup conectado.' : 'Conecte para backup em arquivo.',
    },
  ];

  return {
    sources: SOURCE_ORDER.map((id) => sources.find((source) => source.id === id)),
    primarySource: 'firebase',
    quiet: deriveQuietSyncView({ syncHealth, firestore, globalSyncPaused }),
    health: {
      status: healthStatus,
      requiresAction: syncHealth.requiresAction,
      metrics: syncMetrics,
      events: config.syncHealth?.events || [],
    },
    performanceMetrics,
    needsAttention: sources.some(
      (source) => source.health === 'conflict' || source.health === 'error'
    ),
    newestRemoteAt: latestIso(firestore.remoteUpdatedAt, config.cfRemoteUpdatedAt, state?.lastSync),
    newestLocalAt: config.localBackupAt || null,
    manualSyncEnabled: globalSyncPaused,
  };
}

export function mergeStudyStates(localState = {}, remoteState = {}) {
  const merged = {
    ...remoteState,
    ...localState,
    config: {
      ...(remoteState.config || {}),
      ...(localState.config || {}),
    },
  };

  const tombstones = mergeTombstones(localState.syncTombstones, remoteState.syncTombstones);
  merged.syncTombstones = tombstones;

  for (const key of ['editais', 'eventos', 'arquivo', 'revisoes']) {
    merged[key] = mergeById(localState[key], remoteState[key], buildTombstoneIndex(tombstones, key));
  }

  const habitTypes = new Set([
    ...Object.keys(remoteState.habitos || {}),
    ...Object.keys(localState.habitos || {}),
  ]);
  merged.habitos = {};
  for (const type of habitTypes) {
    merged.habitos[type] = mergeById(
      localState.habitos?.[type],
      remoteState.habitos?.[type],
      buildTombstoneIndex(tombstones, `habitos.${type}`)
    );
  }

  merged.config.localBackupAt = new Date().toISOString();
  delete merged.config.syncMergeConflicts;
  return merged;
}

export function isEmptyState(state = {}) {
  const hasData = (arr) => Array.isArray(arr) && arr.length > 0;
  const hasHabits = (habitos) => {
    if (!habitos || typeof habitos !== 'object') return false;
    return Object.values(habitos).some((arr) => Array.isArray(arr) && arr.length > 0);
  };
  return (
    !hasData(state.editais) &&
    !hasData(state.eventos) &&
    !hasData(state.disciplinas) &&
    !hasData(state.arquivo) &&
    !hasData(state.revisoes) &&
    !hasHabits(state.habitos) &&
    !hasData(state.planejamento?.sequencia)
  );
}

export function isRemoteStateNewer(remoteEnvelope, localState) {
  const remoteRaw = remoteEnvelope?.payloadUpdatedAt || remoteEnvelope?.updatedAt;
  const remoteTime = remoteRaw ? new Date(remoteRaw).getTime() : 0;
  const localRaw = localState?.config?.localBackupAt || localState?.config?._lastUpdated;
  const localTime = localRaw ? new Date(localRaw).getTime() : 0;
  if (remoteTime <= localTime) return false;
  // Empty-state guard: if remote is newer but appears empty, reject it
  const payload = remoteEnvelope?.payload;
  if (payload && isEmptyState(payload)) return false;
  return true;
}

export function resolveConflict(remoteEnvelope, localState) {
  const remoteRaw = remoteEnvelope?.payloadUpdatedAt || remoteEnvelope?.updatedAt;
  const remoteTime = remoteRaw ? new Date(remoteRaw).getTime() : 0;
  const localRaw = localState?.config?.localBackupAt || localState?.config?._lastUpdated;
  const localTime = localRaw ? new Date(localRaw).getTime() : 0;
  const remoteNewer = isRemoteStateNewer(remoteEnvelope, localState);

  if (remoteNewer) return { decision: 'remote', reason: 'remote is newer and has data' };

  // Remote is newer but empty (empty-state guard) - preserve local
  const payload = remoteEnvelope?.payload;
  if (remoteTime > localTime && payload && isEmptyState(payload)) {
    return { decision: 'local', reason: 'remote is newer but empty - preserving local data' };
  }

  if (localTime > remoteTime) return { decision: 'local', reason: 'local is newer' };
  return { decision: 'noop', reason: 'timestamps equal' };
}
