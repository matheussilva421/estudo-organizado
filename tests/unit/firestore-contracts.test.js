import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Firestore integration contracts', () => {
  it('keeps Firebase config explicit and runtime-overridable', () => {
    const configSource = read('src/js/firebase/firebase-config-default.js');

    expect(configSource).toContain('FIREBASE_CONFIG');
    expect(configSource).toContain("apiKey: ''");
    expect(configSource).toContain("projectId: ''");
    expect(configSource).toContain('window.ESTUDO_FIREBASE_CONFIG');
    expect(configSource).toContain('window.ESTUDO_APP_CHECK_SITE_KEY');
  });

  it('keeps local Firebase credentials out of tracked files', () => {
    const tracked = execFileSync('git', ['ls-files', 'src/js/firebase/firebase-config.js'], {
      cwd: root,
      encoding: 'utf8',
    });

    expect(tracked.trim()).toBe('');
  });

  it('falls back to Firebase Auth redirect when popup login is blocked', () => {
    const clientSource = read('src/js/firebase/firebase-client.js');
    const bundleEntry = read('scripts/firebase-bundle-entry.js');

    expect(bundleEntry).toContain('getRedirectResult');
    expect(bundleEntry).toContain('signInWithRedirect');
    expect(clientSource).toContain('POPUP_FALLBACK_CODES');
    expect(clientSource).toContain("'auth/popup-blocked'");
    expect(clientSource).toContain('signInWithRedirect(auth, provider)');
    expect(clientSource).toContain('completeGoogleRedirectSignIn');
  });

  it('caches all runtime Firestore modules in the service worker shell', () => {
    const swSource = read('src/sw.js');

    expect(swSource).toContain('./js/firebase/firebase-client.js');
    expect(swSource).toContain('./js/firebase/firebase-config-default.js');
    expect(swSource).toContain('./js/sync/firestore-sync-engine.js');
    expect(swSource).toContain('./js/sync/sync-coordinator.js');
    expect(swSource).toContain('./js/sync/sync-center.js');
    expect(swSource).toContain('./js/sync/manual-sync.js');
    expect(swSource).toContain('./js/views/config/sync-center.js');
    expect(swSource).toContain('./vendor/firebase-client.bundle.js');
    expect(swSource).toContain("APP_VERSION = '8.64'");
  });

  it('renders a central sync surface with manual source decisions', () => {
    const syncCenterSource = read('src/js/views/config/sync-center.js');
    const configViewSource = read('src/js/views/config-view.js');
    const actionsSource = read('src/js/ui/actions/config.js');

    expect(syncCenterSource).toContain('Central de Sincronização');
    expect(syncCenterSource).toContain('data-action="manual-sync-all"');
    expect(syncCenterSource).toContain('data-action="firestore-merge-remote"');
    expect(syncCenterSource).toContain('data-action="cloud-merge-remote"');
    expect(syncCenterSource).toContain('data-action="merge-from-drive"');
    expect(configViewSource).toContain("from './config/sync-center.js");
    expect(actionsSource).toContain("registerAction('manual-sync-all'");
  });

  it('coalesces Firestore status renders on the config screen', () => {
    const mainSource = read('src/js/main.js');

    // Sync status is now handled by dedicated sync-status-ui component (no throttle logic)
    expect(mainSource).toContain("import { initSyncStatusUI } from './sync/sync-status-ui.js");
    expect(mainSource).toContain('initSyncStatusUI()');
    // No more renderCurrentView dispatches from sync status events
    expect(mainSource).not.toMatch(/app:primarySyncStatus.*renderCurrentView/s);
  });

  it('keeps local save storage separated while sync side effects live elsewhere (manual-only)', () => {
    const storeSource = read('src/js/store.js');
    const mainSource = read('src/js/main.js');
    const driveSource = read('src/js/drive-sync.js');
    const manualSyncSource = read('src/js/sync/manual-sync.js');

    expect(storeSource).not.toContain('import { pushToCloudflare }');
    expect(storeSource).not.toContain('SyncQueue.add(() => pushToCloudflare())');
    expect(storeSource).not.toContain('flushFirestoreOutbox()');
    expect(storeSource).not.toContain('firestore-sync-engine');
    expect(storeSource).not.toContain('autoPullRemoteWhenNewer');
    expect(mainSource).toContain("import * as sync_coordinator from './sync/sync-coordinator.js");
    expect(manualSyncSource).toContain('syncAllChannels');
    expect(driveSource).not.toContain("document.addEventListener('stateSaved'");
  });

  it('prevents local-save from reading remote data before pushing queued changes', () => {
    const coordinatorSource = read('src/js/sync/sync-coordinator.js');
    const plannerSource = read('src/js/sync/sync-planner.js');

    expect(plannerSource).toContain("if (reason === 'local-save')");
    expect(plannerSource).toContain('action: ACTIONS.PUSH_LOCAL');
    expect(coordinatorSource).toContain('autoPullRemoteWhenNewer');
    expect(coordinatorSource).toContain('plan.action === ACTIONS.CHECK_REMOTE_THEN_PULL');
  });

  it('uses dedicated sync status UI instead of throttled config renders', () => {
    const mainSource = read('src/js/main.js');

    // Old throttle logic removed — replaced by dedicated sync-status-ui component
    expect(mainSource).not.toContain('CONFIG_SYNC_RENDER_THROTTLE_MS');
    expect(mainSource).not.toContain('lastConfigSyncRenderAt');
    expect(mainSource).not.toContain('scheduleConfigSyncRender');
    // New approach: dedicated UI component
    expect(mainSource).toContain('initSyncStatusUI');
    // Performance metrics still recorded via sync-health
    const coordinatorSource = read('src/js/sync/sync-coordinator.js');
    expect(coordinatorSource).toContain("name: 'plannerMs'");
  });

  it('records numeric sync performance budgets without user payloads', () => {
    const storeSource = read('src/js/store.js');
    const coordinatorSource = read('src/js/sync/sync-coordinator.js');
    const healthSource = read('src/js/sync/sync-health.js');

    expect(storeSource).toContain("name: 'localCommitMs'");
    expect(coordinatorSource).toContain("name: 'plannerMs'");
    expect(coordinatorSource).toContain("name: 'firestoreWriteMs'");
    expect(healthSource).toContain('appendSyncPerformanceMetric');
    expect(healthSource).not.toContain('payload:');
  });

  it('does not push to Firestore immediately when shadow mode is enabled', () => {
    const firestoreSource = read('src/js/sync/firestore-sync-engine.js');
    const enableBody =
      firestoreSource.match(/export async function enableFirestoreSync[\s\S]*?\r?\n}\r?\n/)?.[0] ||
      '';

    expect(enableBody).toContain("config.mode = mode === 'primary' ? 'primary' : 'shadow';");
    expect(enableBody).not.toContain('flushFirestoreOutbox');
    expect(enableBody).not.toContain('queueFirestoreSnapshotFromState');
  });

  it('routes smart sync through Firestore primary instead of parallel secondary stores', () => {
    const actionsSource = read('src/js/ui/actions/config.js');
    const smartSyncBody =
      actionsSource.match(/registerAction\('sync-center-smart-sync'[\s\S]*?\}\);/)?.[0] || '';

    expect(smartSyncBody).toContain('flushPrimarySyncNow');
    expect(smartSyncBody).not.toContain('Promise.allSettled');
    expect(smartSyncBody).not.toContain('forceCloudflareSync');
    expect(smartSyncBody).not.toContain('syncWithDrive');
  });

  it('uses the current remote revision as the manual Firestore push base', () => {
    const firestoreSource = read('src/js/sync/firestore-sync-engine.js');
    const queueBody =
      firestoreSource.match(
        /export async function queueFirestoreSnapshotFromState[\s\S]*?\r?\n}\r?\n/
      )?.[0] || '';
    const syncBody =
      firestoreSource.match(/async function syncFirestoreNowUnlocked[\s\S]*?\r?\n}\r?\n/)?.[0] ||
      '';
    const syncExport =
      firestoreSource.match(/export async function syncFirestoreNow[\s\S]*?\r?\n}\r?\n/)?.[0] || '';

    expect(queueBody).toContain('createFirestoreSnapshotEnvelope(sourceState, options)');
    expect(syncExport).toContain('firestoreLock.withLock');
    expect(syncExport).toContain('syncFirestoreNowUnlocked()');
    expect(syncBody).toContain('const remote = await readFirestoreSnapshot(db, uid);');
    expect(syncBody).toContain(
      'baseRemoteUpdatedAt: remoteUpdatedAt || config.remoteUpdatedAt || null'
    );
  });

  it('persists sync metadata without creating a new local data revision', () => {
    const storeSource = read('src/js/store.js');
    const firestoreSource = read('src/js/sync/firestore-sync-engine.js');
    const cloudflareSource = read('src/js/cloud-sync.js');
    const driveSource = read('src/js/drive-sync.js');

    expect(storeSource).toContain('touchLocalBackup');
    // All sync modules use object-form saveStateToDB (no positional args)
    expect(firestoreSource).toContain(
      'saveStateToDB({ skipCloudSync: true, skipFirestoreSync: true, skipDriveSync: true'
    );
    expect(cloudflareSource).toContain(
      'saveStateToDB({ skipCloudSync: true, skipFirestoreSync: true, skipDriveSync: true'
    );
    expect(driveSource).toContain(
      'saveStateToDB({ skipCloudSync: true, skipFirestoreSync: true, skipDriveSync: true'
    );
  });

  it('pre-caches modules that are imported by the modular app shell', () => {
    const swSource = read('src/sw.js');

    [
      './js/ui/search.js',
      './js/ui/event-modals.js',
      './js/ui/actions/config.js',
      './js/views/config-view.js',
      './js/views/revisao-view.js',
      './js/state/chart-state.js',
    ].forEach((asset) => expect(swSource).toContain(asset));
  });

  it('clears stale Firestore pending state when there is no queued snapshot', () => {
    const firestoreSource = read('src/js/sync/firestore-sync-engine.js');
    const flushBody =
      firestoreSource.match(
        /async function flushFirestoreOutboxUnlocked[\s\S]*?export async function flushFirestoreOutbox/
      )?.[0] || '';
    const flushExport =
      firestoreSource.match(/export async function flushFirestoreOutbox[\s\S]*?\r?\n}\r?\n/)?.[0] ||
      '';

    expect(flushExport).toContain('firestoreLock.withLock');
    expect(flushExport).toContain('flushFirestoreOutboxUnlocked(options)');
    expect(flushBody).toContain('if (!pending)');
    expect(flushBody).toContain('config.hasPendingWrites = false');
    expect(flushBody).toContain("emitStatus('synced'");
  });

  it('repairs stale Firestore pending flags on startup and auth changes', () => {
    const firestoreSource = read('src/js/sync/firestore-sync-engine.js');

    expect(firestoreSource).toContain('async function reconcileFirestorePendingState');
    expect(firestoreSource).toContain('reconcileFirestorePendingState(false)');
    expect(firestoreSource).toContain('!pending && config.hasPendingWrites && !config.conflict');
  });

  it('allows the Firebase Auth and Firestore network surfaces in CSP', () => {
    const html = read('src/index.html');
    const csp = html.match(/Content-Security-Policy"\s+content="([^"]+)"/i)?.[1] || '';
    const scriptSrc = csp.match(/script-src\s+([^;]+)/i)?.[1] || '';
    const connectSrc = csp.match(/connect-src\s+([^;]+)/i)?.[1] || '';
    const frameSrc = csp.match(/frame-src\s+([^;]+)/i)?.[1] || '';

    expect(scriptSrc).toContain('https://www.google.com');
    expect(scriptSrc).toContain('https://www.gstatic.com');
    expect(connectSrc).toContain('https://identitytoolkit.googleapis.com');
    expect(connectSrc).toContain('https://securetoken.googleapis.com');
    expect(connectSrc).toContain('https://firestore.googleapis.com');
    expect(connectSrc).toContain('https://content-firebaseappcheck.googleapis.com');
    expect(frameSrc).toContain('https://accounts.google.com');
    expect(frameSrc).toContain('https://app-de-estudos-14564.firebaseapp.com');
  });

  it('keeps Firestore rules owner-scoped and denies physical deletes', () => {
    const rules = read('firestore.rules');

    expect(rules).toContain('request.auth.uid == uid');
    expect(rules).toContain('match /users/{uid}/snapshots/{snapshotId}');
    expect(rules).toContain('allow delete: if false;');
    expect(rules).toContain('request.resource.data.version == 1');
  });

});
