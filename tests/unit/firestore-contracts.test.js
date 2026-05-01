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
    expect(swSource).toContain('./js/sync/entity-metadata.js');
    expect(swSource).toContain('./js/sync/firestore-sync-engine.js');
    expect(swSource).toContain('./js/sync/sync-coordinator.js');
    expect(swSource).toContain('./js/sync/sync-center.js');
    expect(swSource).toContain('./vendor/firebase-client.bundle.js');
    expect(swSource).toContain("APP_VERSION = '8.32'");
  });

  it('renders a central sync surface with manual source decisions', () => {
    const configViewSource = read('src/js/views/config-view.js');
    const actionsSource = read('src/js/ui/actions/config.js');

    expect(configViewSource).toContain('Central de Sincronização');
    expect(configViewSource).toContain('data-testid="sync-quiet-panel"');
    expect(configViewSource).toContain('data-testid="sync-advanced-panel"');
    expect(configViewSource).toContain('data-testid="sync-source-conflict-entities"');
    expect(configViewSource).toContain('data-action="firestore-merge-remote"');
    expect(configViewSource).toContain('data-action="cloud-merge-remote"');
    expect(configViewSource).toContain('data-action="merge-from-drive"');
    expect(actionsSource).toContain("registerAction('sync-center-smart-sync'");
  });

  it('coalesces Firestore status renders on the config screen', () => {
    const mainSource = read('src/js/main.js');
    const firestoreStatusListener =
      mainSource.match(/addCleanupListener\(document, 'app:firestoreSyncStatus'[\s\S]*?\}\);/)?.[0] ||
      '';

    expect(mainSource).toContain('function scheduleConfigSyncRender');
    expect(mainSource).toContain('lastConfigSyncStatusSignature');
    expect(firestoreStatusListener).toContain('scheduleConfigSyncRender');
    expect(firestoreStatusListener).not.toContain('components.renderCurrentView()');
  });

  it('keeps local save storage separated while the sync coordinator owns online side effects', () => {
    const storeSource = read('src/js/store.js');
    const mainSource = read('src/js/main.js');
    const coordinatorSource = read('src/js/sync/sync-coordinator.js');
    const driveSource = read('src/js/drive-sync.js');

    expect(storeSource).not.toContain('import { pushToCloudflare }');
    expect(storeSource).not.toContain('SyncQueue.add(() => pushToCloudflare())');
    expect(storeSource).not.toContain('flushFirestoreOutbox()');
    expect(mainSource).toContain("import * as sync_coordinator from './sync/sync-coordinator.js");
    expect(coordinatorSource).toContain("document.addEventListener('stateSaved'");
    expect(coordinatorSource).toContain('queueFirestoreSnapshotFromState');
    expect(driveSource).not.toContain("document.addEventListener('stateSaved'");
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
      firestoreSource.match(/export async function syncFirestoreNow[\s\S]*?\r?\n}\r?\n/)?.[0] || '';

    expect(queueBody).toContain('createFirestoreSnapshotEnvelope(sourceState, options)');
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
    expect(storeSource).toContain('baselineOnly:');
    expect(storeSource).toContain('options.touchLocalBackup === false');
    expect(firestoreSource).toContain(
      'saveStateToDB(true, true, true, { touchLocalBackup: false })'
    );
    expect(cloudflareSource).toContain(
      'saveStateToDB(true, true, true, { touchLocalBackup: false })'
    );
    expect(driveSource).toContain('saveStateToDB(true, true, true, { touchLocalBackup: false })');
  });

  it('resolves entity-primary conflicts from entity documents instead of stale snapshots', () => {
    const firestoreSource = read('src/js/sync/firestore-sync-engine.js');
    const resolveBody =
      firestoreSource.match(
        /export async function resolveEntityConflict[\s\S]*?\r?\n}\r?\n/
      )?.[0] || '';

    expect(resolveBody).toContain('isEntityPrimaryEnabled()');
    expect(resolveBody).toContain('readFirestoreEntityDocuments(db, uid)');
    expect(resolveBody).toContain('readFirestoreSnapshot(db, uid)');
    expect(resolveBody.indexOf('readFirestoreEntityDocuments(db, uid)')).toBeLessThan(
      resolveBody.indexOf('readFirestoreSnapshot(db, uid)')
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
      './js/sync/firestore-entity-outbox.js',
      './js/sync/firestore-entity-schema.js',
    ].forEach((asset) => expect(swSource).toContain(asset));
  });

  it('renders actionable entity conflict review controls', () => {
    const configViewSource = read('src/js/views/config-view.js');
    const configActionsSource = read('src/js/ui/actions/config.js');

    expect(configViewSource).toContain('data-action="entity-conflict-keep-local"');
    expect(configViewSource).toContain('data-action="entity-conflict-keep-remote"');
    expect(configViewSource).toContain('data-entity-key');
    expect(configActionsSource).toContain('data-action="entity-conflict-keep-local"');
    expect(configActionsSource).toContain('data-action="entity-conflict-keep-remote"');
  });

  it('clears stale Firestore pending state when there is no queued snapshot', () => {
    const firestoreSource = read('src/js/sync/firestore-sync-engine.js');
    const flushBody =
      firestoreSource.match(
        /export async function flushFirestoreOutbox[\s\S]*?export async function pullFromFirestore/
      )?.[0] || '';

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
    expect(rules).toContain('entityManifest');
    expect(rules).toContain('request.resource.data.entityManifest is list');
  });

  it('allows owner-scoped entity docs and still denies physical deletes', () => {
    const rules = read('firestore.rules');

    expect(rules).toContain('match /users/{uid}/entities/{entityId}');
    expect(rules).toContain('validEntityDoc()');
    expect(rules).toContain('request.resource.data.key is string');
    expect(rules).toContain('request.resource.data.payload == null');
    expect(rules).toContain('request.resource.data.payload is map');
    expect(rules).toContain('allow delete: if false;');
  });

  it('exposes manual entity shadow verification in the sync center', () => {
    const engine = read('src/js/sync/firestore-sync-engine.js');
    const actions = read('src/js/ui/actions/config.js');
    const configView = read('src/js/views/config-view.js');

    expect(engine).toContain('export async function verifyFirestoreEntityShadow');
    expect(actions).toContain("registerAction('firestore-verify-entity-shadow'");
    expect(configView).toContain('data-action="firestore-verify-entity-shadow"');
  });
});
