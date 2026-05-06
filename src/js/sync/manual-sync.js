/**
 * Manual Sync Orchestrator
 *
 * Single entry point for user-initiated synchronization across all configured
 * remote channels (Firestore, Cloudflare KV, Google Drive). Replaces the
 * automatic sync coordinator that previously fired on every state change.
 *
 * Behavior per channel (pull-then-push):
 *   1. Read remote metadata.
 *   2. If remote is newer (other device pushed since last sync), merge by
 *      timestamp before pushing — preserves edits from both sides.
 *   3. Push local with conflict-aware envelope. If the server detects another
 *      push slipped in between read and write, register a conflict for the
 *      user to resolve manually via the "Avançado" panel.
 *
 * Eligibility is checked cheaply (no OAuth popup). Drive only runs if a token
 * is already in memory and a fileId exists.
 */

import { state, saveStateToDB } from '../store.js?v=8.37';
import {
  getFirestoreSyncStatus,
  syncFirestoreNow,
} from './firestore-sync-engine.js?v=8.37';
import { forceCloudflareSync } from '../cloud-sync.js?v=8.37';
import { syncWithDrive } from '../drive-sync.js?v=8.37';

export const SYNC_CHANNELS = ['firestore', 'cloudflare', 'drive'];

let inFlight = null;

function emitStatus(status, payload = {}) {
  document.dispatchEvent(
    new CustomEvent('app:manualSyncStatus', {
      detail: { status, at: new Date().toISOString(), ...payload },
    })
  );
}

export function isFirestoreEligible() {
  const status = getFirestoreSyncStatus();
  return Boolean(
    status &&
      status.configured &&
      status.signedIn &&
      status.enabled &&
      status.mode === 'primary'
  );
}

export function isCloudflareEligible() {
  const cfg = state.config || {};
  return Boolean(cfg.cfUrl && cfg.cfToken && cfg.cfSyncEnabled);
}

export function isDriveEligible() {
  // Drive is only eligible if OAuth has already happened in this session and
  // a backup file exists. Never trigger the consent popup automatically.
  if (typeof gapi === 'undefined') return false;
  const token = gapi?.client?.getToken?.();
  return Boolean(token?.access_token && state?.driveFileId);
}

export function getEligibility() {
  return {
    firestore: isFirestoreEligible(),
    cloudflare: isCloudflareEligible(),
    drive: isDriveEligible(),
  };
}

async function syncFirestoreChannel() {
  // syncFirestoreNow pulls remote first; if remote is newer it applies the
  // remote snapshot and skips push. Otherwise it queues a snapshot from the
  // local state and writes it. Conflicts surface via getFirestoreSyncStatus.
  let ok = false;
  try {
    ok = await syncFirestoreNow();
  } catch (err) {
    return { status: 'error', error: err?.message || String(err) };
  }
  const status = getFirestoreSyncStatus();
  if (status?.conflict) {
    return { status: 'conflict', conflict: status.conflict };
  }
  if (status?.lastError) {
    return { status: 'error', error: status.lastError };
  }
  return { status: ok ? 'ok' : 'error', error: ok ? null : 'Falha ao sincronizar com Firestore.' };
}

async function syncCloudflareChannel() {
  // Pull-then-push without server overwrite — the worker returns 409 if the
  // remote envelope's baseRemoteUpdatedAt mismatches the live one. The 409
  // path stores config.cfConflict for user resolution.
  try {
    await forceCloudflareSync({ overwriteRemote: false });
    if (state.config?.cfConflict) {
      return { status: 'conflict', conflict: state.config.cfConflict };
    }
    return { status: 'ok' };
  } catch (err) {
    if (state.config?.cfConflict) {
      return { status: 'conflict', conflict: state.config.cfConflict };
    }
    return { status: 'error', error: err?.message || String(err) };
  }
}

async function syncDriveChannel() {
  try {
    await syncWithDrive(0, { autoMerge: true });
    return { status: 'ok' };
  } catch (err) {
    return { status: 'error', error: err?.message || String(err) };
  }
}

function aggregateSummary(result) {
  const counts = { ok: 0, conflict: 0, error: 0, skipped: 0 };
  for (const key of SYNC_CHANNELS) {
    const s = result[key]?.status || 'skipped';
    counts[s] = (counts[s] || 0) + 1;
  }
  let overall = 'idle';
  if (counts.error > 0 && counts.ok === 0 && counts.conflict === 0) overall = 'error';
  else if (counts.conflict > 0 && counts.ok === 0 && counts.error === 0) overall = 'conflict';
  else if (counts.error > 0 || counts.conflict > 0) overall = 'partial';
  else if (counts.ok > 0) overall = 'synced';
  return { ...counts, overall };
}

async function _runAll(trigger) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const payload = {
      firestore: { status: 'skipped', reason: 'offline' },
      cloudflare: { status: 'skipped', reason: 'offline' },
      drive: { status: 'skipped', reason: 'offline' },
      summary: { ok: 0, conflict: 0, error: 0, skipped: 3, overall: 'offline' },
    };
    emitStatus('offline', { trigger, ...payload });
    return payload;
  }

  const eligibility = getEligibility();
  if (!eligibility.firestore && !eligibility.cloudflare && !eligibility.drive) {
    const payload = {
      firestore: { status: 'skipped', reason: 'not-configured' },
      cloudflare: { status: 'skipped', reason: 'not-configured' },
      drive: { status: 'skipped', reason: 'not-configured' },
      summary: { ok: 0, conflict: 0, error: 0, skipped: 3, overall: 'no-channels' },
    };
    emitStatus('no-channels', { trigger, ...payload });
    return payload;
  }

  emitStatus('syncing', { trigger, eligibility });

  const tasks = [
    eligibility.firestore ? syncFirestoreChannel() : Promise.resolve({ status: 'skipped' }),
    eligibility.cloudflare ? syncCloudflareChannel() : Promise.resolve({ status: 'skipped' }),
    eligibility.drive ? syncDriveChannel() : Promise.resolve({ status: 'skipped' }),
  ];

  const settled = await Promise.allSettled(tasks);
  const fromSettled = (s) =>
    s.status === 'fulfilled'
      ? s.value
      : { status: 'error', error: s.reason?.message || String(s.reason || 'unknown') };

  const result = {
    firestore: fromSettled(settled[0]),
    cloudflare: fromSettled(settled[1]),
    drive: fromSettled(settled[2]),
  };

  const summary = aggregateSummary(result);

  if (!state.config) state.config = {};
  state.config.lastManualSyncAt = new Date().toISOString();
  state.config.lastManualSyncResults = {
    at: state.config.lastManualSyncAt,
    trigger,
    firestore: result.firestore.status,
    cloudflare: result.cloudflare.status,
    drive: result.drive.status,
  };
  try {
    await saveStateToDB({
      skipCloudSync: true,
      skipFirestoreSync: true,
      skipDriveSync: true,
      touchLocalBackup: false,
      skipSyncEvent: true,
    });
  } catch (err) {
    console.warn('[manual-sync] failed to persist lastManualSyncAt:', err?.message);
  }

  emitStatus(summary.overall, { trigger, ...result, summary });

  return { ...result, summary };
}

/**
 * Sincroniza todos os canais elegíveis em paralelo.
 * Retorna `{ firestore, cloudflare, drive, summary }`.
 * Re-entrante: se já houver uma sincronização em andamento, retorna a mesma promise.
 */
export async function syncAllChannels({ trigger = 'unknown' } = {}) {
  if (inFlight) return inFlight;
  inFlight = _runAll(trigger).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function isManualSyncRunning() {
  return inFlight !== null;
}
