import { mergeEntityAwareArrays } from './entity-metadata.js?v=8.32';
import { deriveSyncHealthState, summarizeSyncMetrics } from './sync-health.js?v=8.32';

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
  return Boolean(config.cfTokenSaved || config.cfToken);
}

function deriveQuietSyncView({ syncHealth, firestore }) {
  const signedIn = Boolean(firestore.signedIn || firestore.uid);
  const isPrimary = firestore.mode === 'primary';

  if (syncHealth.state === 'conflict') {
    return {
      title: 'Acao necessaria',
      detail:
        'Existe um conflito real de sync. Seus dados locais continuam preservados; abra as opcoes avancadas para resolver.',
      tone: 'danger',
      primaryAction: 'advanced',
    };
  }

  if (syncHealth.state === 'degraded' || firestore.lastError) {
    return {
      title: 'Sync aguardando recuperacao',
      detail:
        'O app continua salvando neste dispositivo e tentara sincronizar novamente. Use as opcoes avancadas se o erro persistir.',
      tone: 'warning',
      primaryAction: 'advanced',
    };
  }

  if (!firestore.configured) {
    return {
      title: 'Salvo neste dispositivo',
      detail:
        'O salvamento local esta ativo. Configure o Firebase para sincronizacao automatica entre dispositivos.',
      tone: 'idle',
      primaryAction: null,
    };
  }

  if (!signedIn) {
    return {
      title: 'Salvo neste dispositivo',
      detail:
        'Entre com Google para ativar o sync automatico. Enquanto isso, o app continua seguro localmente.',
      tone: 'idle',
      primaryAction: 'sign-in',
    };
  }

  if (!firestore.enabled) {
    return {
      title: 'Sync remoto pausado',
      detail:
        'O salvamento local esta funcionando. Ative o Firestore primary para sincronizar automaticamente.',
      tone: 'idle',
      primaryAction: 'advanced',
    };
  }

  if (syncHealth.state === 'syncing') {
    return {
      title: 'Sincronizando automaticamente',
      detail: 'As alteracoes ja foram salvas no dispositivo e estao sendo enviadas ao Firestore.',
      tone: 'pending',
      primaryAction: null,
    };
  }

  if (syncHealth.state === 'queued') {
    return {
      title: 'Sync automatico na fila',
      detail:
        'As alteracoes estao salvas localmente e serao enviadas pelo app assim que a tentativa atual puder rodar.',
      tone: 'pending',
      primaryAction: null,
    };
  }

  if (isPrimary) {
    return {
      title: 'Tudo salvo automaticamente',
      detail:
        'Suas alteracoes ficam salvas neste dispositivo e o Firestore sincroniza sozinho em segundo plano.',
      tone: 'ok',
      primaryAction: null,
    };
  }

  return {
    title: 'Sync em modo de verificacao',
    detail:
      'O Firestore esta ativo fora do modo primary. Use o modo primary para sync automatico completo.',
    tone: 'idle',
    primaryAction: 'advanced',
  };
}

export function canAutoSyncFirestore(config = {}, pending = null, now = Date.now()) {
  if (!config.enabled) return false;
  if (config.mode !== 'primary') return false;
  if (config.conflict) return false;
  if (!pending) return true;
  if (pending.status === 'conflict') return false;
  if (pending.nextAttemptAt && toTime(pending.nextAttemptAt) > now) return false;
  return true;
}

export function buildSyncCenterModel({ state, firestoreStatus = {}, getFirestoreStatus = null }) {
  const config = state?.config || {};
  const firestore = {
    ...config.firestoreSync,
    ...(typeof getFirestoreStatus === 'function' ? getFirestoreStatus() : {}),
    ...firestoreStatus,
  };
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
  });
  const syncMetrics = summarizeSyncMetrics(syncHealth.metrics);

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
      detail: 'Fonte de recuperacao imediata.',
    },
    {
      id: 'firebase',
      title: 'Firebase',
      icon: 'fa-fire',
      label: 'Firestore primario',
      primary: true,
      enabled: Boolean(firestore.enabled),
      configured: Boolean(firestore.configured),
      signedIn: Boolean(firestore.signedIn || firestore.uid),
      mode: firestore.mode || 'shadow',
      health: firestore.conflict
        ? 'conflict'
        : firestore.lastError
          ? 'error'
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
      entityShadowDiff: state?.config?.entitySync?.lastShadowDiff || null,
      detail: firestore.enabled
        ? firestore.mode === 'primary'
          ? state?.config?.entitySync?.mode === 'primary'
            ? 'Entidades primarias com snapshot de fallback.'
            : 'Sync automatico principal.'
          : state?.config?.entitySync?.mode === 'shadow'
            ? 'Snapshot primario com entidades em shadow.'
            : 'Shadow: sem envio automatico.'
        : 'Ative depois de entrar com Google.',
    },
    {
      id: 'cloudflare',
      title: 'Cloudflare',
      icon: 'fa-cloud',
      label: 'Backup Worker/KV secundario',
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
      label: 'Backup manual/secundario',
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
    quiet: deriveQuietSyncView({ syncHealth, firestore }),
    health: {
      status: syncHealth.state,
      requiresAction: syncHealth.requiresAction,
      metrics: syncMetrics,
      events: config.syncHealth?.events || [],
    },
    needsAttention: sources.some(
      (source) => source.health === 'conflict' || source.health === 'error'
    ),
    newestRemoteAt: latestIso(firestore.remoteUpdatedAt, config.cfRemoteUpdatedAt, state?.lastSync),
    newestLocalAt: config.localBackupAt || null,
  };
}

export function mergeStudyStates(localState = {}, remoteState = {}) {
  const collisions = [];
  const merged = {
    ...remoteState,
    ...localState,
    config: {
      ...(remoteState.config || {}),
      ...(localState.config || {}),
    },
  };

  for (const key of ['editais', 'eventos', 'arquivo', 'revisoes']) {
    merged[key] = mergeEntityAwareArrays(localState[key], remoteState[key], {
      collection: key,
      collisions,
    });
  }

  const habitTypes = new Set([
    ...Object.keys(remoteState.habitos || {}),
    ...Object.keys(localState.habitos || {}),
  ]);
  merged.habitos = {};
  for (const type of habitTypes) {
    merged.habitos[type] = mergeEntityAwareArrays(
      localState.habitos?.[type],
      remoteState.habitos?.[type],
      { collection: `habitos.${type}`, collisions }
    );
  }

  merged.config.localBackupAt = new Date().toISOString();
  delete merged.config.syncMergeConflicts;
  if (collisions.length > 0) {
    merged.config.syncMergeConflicts = {
      detectedAt: new Date().toISOString(),
      total: collisions.length,
      items: collisions.slice(0, 20),
    };
  }
  return merged;
}
