/**
 * Unified Sync Diagnostic Log
 *
 * Builds a single JSON document that captures the state of all sync channels
 * (Firestore, Cloudflare KV, Google Drive) plus recent manual sync history,
 * health events and performance metrics. Used to diagnose why a sync is
 * failing without exposing the user's actual study data.
 */

import { state } from '../store.js?v=8.37';
import { getFirestoreSyncStatus } from './firestore-sync-engine.js?v=8.37';
import { getPendingFirestoreSnapshot } from './firestore-outbox.js?v=8.37';
import { getSyncCreds, getSyncConfig } from '../cloud-sync.js?v=8.37';

// The version baked at write time. Each APP_VERSION bump should also touch
// this constant so the log surfaces the JS module version actually loaded.
const DIAGNOSTIC_BUILD_VERSION = '8.94';

function safeCount(arr) {
  return Array.isArray(arr) ? arr.length : 0;
}

function getDriveStatus() {
  let connected = false;
  try {
    if (typeof gapi !== 'undefined') {
      connected = Boolean(gapi.client?.getToken?.()?.access_token);
    }
  } catch {
    /* gapi not loaded */
  }
  return {
    fileId: state.driveFileId || null,
    connected,
    lastSync: state.lastSync || null,
  };
}

async function getServiceWorkerInfo() {
  const info = {
    diagnosticBuildVersion: DIAGNOSTIC_BUILD_VERSION,
    controllerScriptURL: null,
    controllerState: null,
    registeredScopes: [],
    cacheNames: [],
    cacheVersionMatch: null,
  };
  try {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      info.controllerScriptURL = navigator.serviceWorker.controller.scriptURL || null;
      info.controllerState = navigator.serviceWorker.controller.state || null;
    }
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.getRegistrations) {
      const regs = await navigator.serviceWorker.getRegistrations();
      info.registeredScopes = regs.map((r) => r.scope || null);
    }
    if (typeof caches !== 'undefined' && caches.keys) {
      info.cacheNames = await caches.keys();
      const expected = `estudo-organizado-v${DIAGNOSTIC_BUILD_VERSION}`;
      info.cacheVersionMatch = info.cacheNames.includes(expected);
    }
  } catch (err) {
    info.error = err?.message || String(err);
  }
  return info;
}

export async function buildSyncDiagnostic() {
  const config = state.config || {};
  const firestoreStatus = getFirestoreSyncStatus();

  const swInfo = await getServiceWorkerInfo();

  const log = {
    timestamp: new Date().toISOString(),
    appVersion: DIAGNOSTIC_BUILD_VERSION,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    online: typeof navigator !== 'undefined' ? navigator.onLine : null,
    schemaVersion: state.schemaVersion || null,
    serviceWorker: swInfo,

    localState: {
      eventCount: safeCount(state.eventos),
      editalCount: safeCount(state.editais),
      arquivoCount: safeCount(state.arquivo),
      revisoesCount: safeCount(state.revisoes),
      lastBackupAt: config.localBackupAt || null,
    },

    manualSync: {
      lastManualSyncAt: config.lastManualSyncAt || null,
      lastResults: config.lastManualSyncResults || null,
      history: Array.isArray(config.manualSyncHistory)
        ? config.manualSyncHistory.slice(-20)
        : [],
    },

    firestore: {
      configured: firestoreStatus.configured,
      projectId: firestoreStatus.projectId || null,
      authDomain: firestoreStatus.authDomain || null,
      signedIn: firestoreStatus.signedIn,
      uid: firestoreStatus.uid || null,
      enabled: firestoreStatus.enabled,
      mode: firestoreStatus.mode || null,
      hasPendingWrites: firestoreStatus.hasPendingWrites || false,
      conflict: firestoreStatus.conflict || null,
      remoteUpdatedAt: firestoreStatus.remoteUpdatedAt || null,
      lastPullAt: firestoreStatus.lastPullAt || null,
      lastPushAt: firestoreStatus.lastPushAt || null,
      lastError: firestoreStatus.lastError || null,
      pendingSnapshot: null,
      pendingSnapshotError: null,
    },

    cloudflare: {
      configured: !!(config.cfUrl && config.cfToken),
      enabled: !!config.cfSyncEnabled,
      url: config.cfUrl || null,
      tokenSaved: !!config.cfToken,
      lastSyncAt: config.cfLastSyncAt || null,
      remoteUpdatedAt: config.cfRemoteUpdatedAt || null,
      conflict: config.cfConflict || null,
      lastError: config.cfLastError || null,
      credentialStore: null,
      credentialStoreError: null,
      remoteConfig: null,
      remoteConfigError: null,
    },

    drive: getDriveStatus(),

    syncHealth: {
      events: config.syncHealth?.events?.slice(-15) || [],
      failureCount: config.syncHealth?.failureCount || 0,
      offline: config.syncHealth?.offline === true,
    },

    performanceMetrics: Array.isArray(config.syncPerformance?.metrics)
      ? config.syncPerformance.metrics.slice(-15)
      : [],
  };

  // Pull pending Firestore snapshot summary (no payload data — just metadata).
  try {
    const pending = await getPendingFirestoreSnapshot();
    if (pending) {
      log.firestore.pendingSnapshot = {
        status: pending.status || null,
        attempts: pending.attempts || 0,
        queuedAt: pending.queuedAt || null,
        nextAttemptAt: pending.nextAttemptAt || null,
        baseRemoteUpdatedAt: pending.envelope?.baseRemoteUpdatedAt || null,
        payloadUpdatedAt: pending.envelope?.payloadUpdatedAt || null,
      };
    }
  } catch (err) {
    log.firestore.pendingSnapshotError = err?.message || String(err);
  }

  // Cloudflare credential / config snapshots (without exposing the token itself).
  try {
    const cfCreds = await getSyncCreds();
    log.cloudflare.credentialStore = {
      hasData: !!cfCreds,
      url: cfCreds?.url || null,
      hasToken: !!cfCreds?.token,
      enabled: cfCreds?.enabled || false,
    };
  } catch (err) {
    log.cloudflare.credentialStoreError = err?.message || String(err);
  }

  try {
    const cfConfig = await getSyncConfig();
    log.cloudflare.remoteConfig = {
      hasConfig: !!cfConfig,
      url: cfConfig?.url || null,
      hasToken: !!cfConfig?.token,
    };
  } catch (err) {
    log.cloudflare.remoteConfigError = err?.message || String(err);
  }

  return log;
}

export async function downloadSyncLog() {
  const log = await buildSyncDiagnostic();
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sync-log-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return log;
}
