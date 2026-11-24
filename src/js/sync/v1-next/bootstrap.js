import { convertBackupV12, reconstituteBackupV12 } from './backup-codec.js';
import {
  entityCollectionForType,
  validateManifest,
  validateRecord,
} from './contracts.js';
import * as localModule from './local.js';
import {
  fetchGenerationRecords,
  getCurrentGeneration,
} from './remote.js';

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const COLLECTIONS = [
  'editais',
  'disciplinas',
  'eventos',
  'habitos',
  'retaFinalBlocos',
  'meta',
  'tombstones',
];
const DEFAULT_REMOTE = Object.freeze({
  getCurrentGeneration,
  fetchGenerationRecords,
});
const V1_FLAG_KEY = 'estudo_v1_sync_enabled';
const TEST_CONFIG_KEY = '__ESTUDO_V1_SYNC_TEST__';
const AUTH_TIMEOUT_MS = 10_000;

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

function safeReason(error) {
  return typeof error?.code === 'string' && error.code.startsWith('V1_')
    ? error.code
    : 'V1_BOOTSTRAP_FAILED';
}

export function isV1AuthFailure(code) {
  return ['V1_REMOTE_AUTH_REQUIRED', 'V1_REMOTE_UID_MISMATCH', 'V1_REMOTE_PERMISSION_DENIED'].includes(code);
}

function requiresNetwork(error) {
  return [
    'V1_REMOTE_OFFLINE',
    'V1_REMOTE_UNAVAILABLE',
    'V1_REMOTE_TIMEOUT',
    'V1_REMOTE_READ_FAILED',
  ].includes(error?.code);
}

function onlineByDefault() {
  return globalThis.navigator?.onLine !== false;
}

/** Validate one generated baseline and reconstruct the academic T1 state. */
export function validateV1Baseline({ generationId, manifest, records } = {},
  { verifyManifestBaseline = true } = {}) {
  if (typeof generationId !== 'string' || !TOKEN.test(generationId)) {
    throw new TypeError('Invalid V1 baseline generation');
  }
  validateManifest(manifest);
  if (manifest.generationId !== generationId ||
    !['verified', 'active'].includes(manifest.state) || !Array.isArray(records)) {
    throw new TypeError('Invalid V1 baseline manifest or records');
  }

  const grouped = Object.fromEntries(COLLECTIONS.map((name) => [name, []]));
  const keys = new Set();
  for (const item of records) {
    if (!item || typeof item !== 'object' || typeof item.key !== 'string' ||
      keys.has(item.key)) {
      throw new TypeError('Invalid V1 baseline record identity');
    }
    const collection = entityCollectionForType(item.entityType);
    keys.add(item.key);
    grouped[collection].push(clone(item));
  }

  const state = reconstituteBackupV12(grouped);
  const checked = convertBackupV12(state);
  if (verifyManifestBaseline &&
    (canonical(checked.manifestDraft.counts) !== canonical(manifest.counts) ||
    checked.manifestDraft.businessDigest !== manifest.businessDigest)) {
    throw new TypeError('Invalid V1 baseline digest or counts');
  }
  return {
    state,
    counts: checked.manifestDraft.counts,
    businessDigest: checked.manifestDraft.businessDigest,
  };
}

function checkedCurrentGeneration(current, uid) {
  if (!current || current.generationId !== current.manifest?.generationId) {
    throw Object.assign(new Error('V1 generation is unavailable'), {
      code: 'V1_REMOTE_GENERATION_INVALID',
    });
  }
  validateManifest(current.manifest);
  if (!['verified', 'active'].includes(current.manifest.state)) {
    throw Object.assign(new Error('V1 generation is inactive'), {
      code: 'V1_REMOTE_GENERATION_INACTIVE',
    });
  }
  if (!current.uid || current.uid === uid) return current;
  throw Object.assign(new Error('V1 generation belongs to another UID'), {
    code: 'V1_REMOTE_UID_MISMATCH',
  });
}

/** Open a verified UID cache immediately, or validate a complete remote baseline. */
export async function bootstrapV1Generation({
  uid,
  online = onlineByDefault(),
  remoteApi = DEFAULT_REMOTE,
  local = localModule,
  now,
  onBackgroundResult,
} = {}) {
  local.clearActiveV1Context?.();
  if (typeof uid !== 'string' || !TOKEN.test(uid)) {
    return { status: 'blocked', reason: 'V1_BOOTSTRAP_INVALID_UID' };
  }

  try {
    const pointer = await local.readV1GenerationPointer(uid);
    if (pointer?.status === 'ready') {
      const cached = await local.readLocalGeneration(uid, pointer.generationId);
      if (cached?.verified === true) {
        local.setActiveV1Context(uid, pointer.generationId);
        return {
          status: 'ready',
          generationId: pointer.generationId,
          state: clone(cached.state),
          source: 'cache',
          backgroundValidation: online
            ? runBackgroundValidation({
              uid,
              generationId: pointer.generationId,
              remoteApi,
              local,
              onBackgroundResult,
            })
            : null,
        };
      }
      if (!online) return { status: 'requires-network' };
    } else if (pointer?.status === 'blocked' && !online) {
      return { status: 'blocked', reason: 'V1_REMOTE_GENERATION_INACTIVE' };
    }

    if (!online) return { status: 'requires-network' };

    const current = checkedCurrentGeneration(
      await remoteApi.getCurrentGeneration(uid),
      uid,
    );
    const fetched = await remoteApi.fetchGenerationRecords(uid, current.generationId);
    if (fetched?.generationId !== current.generationId ||
      canonical(fetched.manifest) !== canonical(current.manifest)) {
      throw Object.assign(new Error('V1 generation changed during bootstrap'), {
        code: 'V1_REMOTE_GENERATION_INVALID',
      });
    }
    // The operation receipts prove whether this generation still equals the
    // immutable migration baseline. Baseline counts/digests are enforced until
    // the first acknowledged mutation; afterwards each live record is checked
    // by validateRecord before it reaches local storage.
    const verifyManifestBaseline = fetched.evolved !== true;
    const verified = validateV1Baseline(fetched, { verifyManifestBaseline });
    let installedState = verified.state;
    if (fetched.planRevision?.pointer) {
      const { applyPlanRevisionToState, resolveVisiblePlanRevision } =
        await import('./reta-final.js');
      const revision = resolveVisiblePlanRevision(
        fetched.planRevision.pointer,
        fetched.planRevision.records,
      );
      installedState = applyPlanRevisionToState(installedState, revision);
    }
    await local.installRemoteBaseline({
      uid,
      generationId: current.generationId,
      state: installedState,
      manifest: current.manifest,
      entityMeta: fetched.entityMeta,
      now,
      verifyManifestBaseline,
    });
    const installed = await local.readLocalGeneration(uid, current.generationId);
    if (installed?.verified !== true) {
      throw new TypeError('V1 baseline was not durable');
    }
    local.setActiveV1Context(uid, current.generationId);
    return {
      status: 'ready',
      generationId: current.generationId,
      state: clone(installed.state),
      source: 'network',
    };
  } catch (error) {
    local.clearActiveV1Context?.();
    return {
      status: requiresNetwork(error) ? 'requires-network' : 'blocked',
      reason: safeReason(error),
    };
  }
}

function runBackgroundValidation({
  uid,
  remoteApi,
  local,
  onBackgroundResult,
}) {
  return Promise.resolve()
    .then(() => revalidateV1Generation({ uid, online: true, remoteApi, local }))
    .then((result) => {
      try {
        onBackgroundResult?.(result);
      } catch {
        // A UI callback must not turn a completed validation into a rejected boot.
      }
      return result;
    })
    .catch(() => {
      const result = { status: 'blocked', reason: 'V1_BOOTSTRAP_FAILED' };
      try {
        onBackgroundResult?.(result);
      } catch {
        // Preserve the fixed failure result.
      }
      return result;
    });
}

/** Revalidate the active pointer before upload or after a listener failure. */
export async function revalidateV1Generation({
  uid,
  online = onlineByDefault(),
  remoteApi = DEFAULT_REMOTE,
  local = localModule,
} = {}) {
  if (!online) return { status: 'requires-network' };
  try {
    const pointer = await local.readV1GenerationPointer(uid);
    if (!pointer) return { status: 'requires-network' };
    const current = checkedCurrentGeneration(
      await remoteApi.getCurrentGeneration(uid),
      uid,
    );
    if (current.generationId !== pointer.generationId) {
      await local.markV1GenerationBlocked(uid, pointer.generationId);
      return { status: 'blocked', reason: 'V1_REMOTE_GENERATION_INVALID' };
    }
    if (pointer.status !== 'ready') {
      return { status: 'blocked', reason: 'V1_REMOTE_GENERATION_INACTIVE' };
    }
    return { status: 'ready', generationId: pointer.generationId };
  } catch (error) {
    if (!requiresNetwork(error) && !isV1AuthFailure(error?.code)) {
      try {
        const pointer = await local.readV1GenerationPointer(uid);
        if (pointer) await local.markV1GenerationBlocked(uid, pointer.generationId);
      } catch {
        // Preserve the original fixed bootstrap failure.
      }
    }
    return {
      status: requiresNetwork(error) ? 'requires-network' : 'blocked',
      reason: safeReason(error),
    };
  }
}

/** Apply a T4 validated delta without generating an outbox operation. */
export async function reconcileRemoteDelta(
  delta,
  { uid, generationId, local = localModule, now } = {},
) {
  const active = local.getActiveV1Context?.();
  const targetUid = uid || active?.uid;
  const targetGeneration = generationId || active?.generationId;
  if (!targetUid || !targetGeneration) {
    throw new TypeError('V1 delta has no active UID and generation');
  }
  if (!delta || typeof delta !== 'object' ||
    !COLLECTIONS.includes(delta.collection)) {
    throw new TypeError('Invalid V1 remote delta');
  }
  if (delta.record === null) {
    // A removed collection document is local entity state. Only the remote
    // control/manifest can revoke a generation; tombstones belong to T7.
    return;
  }
  validateRecord(delta.record);
  if (delta.record.generationId !== targetGeneration ||
    delta.record.collection !== delta.collection) {
    throw new TypeError('V1 remote delta does not match the active generation');
  }
  const outcome = await local.applyRemoteRecord({
    uid: targetUid,
    generationId: targetGeneration,
    record: delta.record,
    now,
  });
  return outcome;
}

/** Opt-in surface used by local tests and Chromium fixtures. Production is off. */
export function isV1SyncEnabled({
  windowRef = globalThis.window,
  storage = globalThis.localStorage,
} = {}) {
  try {
    if (windowRef?.[TEST_CONFIG_KEY]?.enabled === true) return true;
    return storage?.getItem(V1_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

export function isLegacySyncBlocked() {
  return isV1SyncEnabled() || Boolean(localModule.getActiveV1Context());
}

function configuredV1(windowRef) {
  try {
    const explicit = windowRef?.[TEST_CONFIG_KEY];
    if (explicit?.enabled === true) return explicit;
  } catch {
    // An invalid test injection leaves the production Auth path intact.
  }
  return null;
}

/** Wait for Firebase's initial persisted-session callback before trusting a UID. */
export function waitForAuthUser(observeAuth, {
  timeoutMs = AUTH_TIMEOUT_MS,
  setTimeoutRef = globalThis.setTimeout,
  clearTimeoutRef = globalThis.clearTimeout,
  onAuthChange,
  observeIdToken,
  onIdTokenChange,
} = {}) {
  if (typeof observeAuth !== 'function') return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe = null;
    let unsubscribeIdToken = null;
    let timer = null;
    const finish = (user) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeoutRef?.(timer);
      try {
        if (!onAuthChange) unsubscribe?.();
        if (!onIdTokenChange) unsubscribeIdToken?.();
      } catch {
        // The restored identity remains authoritative even if cleanup fails.
      }
      resolve(user || null);
    };
    try {
      let initialUid = null;
      unsubscribe = observeAuth((user) => {
        if (settled) {
          onAuthChange?.(user || null, initialUid);
          return;
        }
        initialUid = user?.uid ?? null;
        finish(user);
      });
      if (settled) unsubscribe?.();
      if (typeof observeIdToken === 'function') {
        unsubscribeIdToken = observeIdToken((user) => {
          if (settled) onIdTokenChange?.(user || null, initialUid);
        });
        if (settled) unsubscribeIdToken?.();
      }
    } catch {
      finish(null);
      return;
    }
    if (settled) {
      if (!onAuthChange) unsubscribe?.();
      if (!onIdTokenChange) unsubscribeIdToken?.();
      return;
    }
    timer = setTimeoutRef(() => finish(null), timeoutMs);
  });
}

function blockedBoot(reason) {
  return { enabled: true, status: 'blocked', reason };
}

function authenticatedBootInput(options) {
  if (typeof options.initFirebaseServices !== 'function') {
    throw Object.assign(new Error('Firebase services unavailable'), {
      code: 'V1_FIREBASE_NOT_CONFIGURED',
    });
  }
  const services = options.initFirebaseServices();
  if (!services?.configured || !services.db || !services.auth) {
    throw Object.assign(new Error('Firebase services unavailable'), {
      code: 'V1_FIREBASE_NOT_CONFIGURED',
    });
  }
  if (typeof options.wireFirestores !== 'function') {
    throw Object.assign(new Error('V1 remote wiring unavailable'), {
      code: 'V1_REMOTE_NOT_CONFIGURED',
    });
  }
  options.wireFirestores({
    db: services.db,
    auth: services.auth,
    firestore: options.firestoreSdk,
    isOnline: () => options.online ?? onlineByDefault(),
  });
  return services;
}

/** Resolve Firebase/Auth before any production bootstrap or cache authority. */
export async function bootstrapConfiguredV1Generation(options = {}) {
  const windowRef = options.windowRef || globalThis.window;
  const storage = options.storage || globalThis.localStorage;
  if (!isV1SyncEnabled({ windowRef, storage })) return { enabled: false };
  const config = options.config || configuredV1(windowRef);
  const online = options.online ?? config?.online ?? onlineByDefault();
  let uid = config?.enabled === true ? config.uid : options.uid;
  try {
    if (config?.enabled !== true) {
      authenticatedBootInput(options);
      const user = options.authUser !== undefined
        ? options.authUser
        : await waitForAuthUser(options.observeFirebaseAuth, {
          onAuthChange: options.onAuthChange,
          observeIdToken: options.observeFirebaseIdToken,
          onIdTokenChange: options.onIdTokenChange,
          timeoutMs: options.authTimeoutMs,
          setTimeoutRef: options.setTimeoutRef,
          clearTimeoutRef: options.clearTimeoutRef,
        });
      if (!user) return blockedBoot('V1_AUTH_REQUIRED');
      uid = user.uid;
    }
  } catch (error) {
    return blockedBoot(safeReason(error));
  }
  if (typeof uid !== 'string' || !TOKEN.test(uid)) {
    return { enabled: true, status: 'blocked', reason: 'V1_BOOTSTRAP_INVALID_UID' };
  }
  const result = await bootstrapV1Generation({
    uid,
    online,
    remoteApi: options.remoteApi || config?.remoteApi || DEFAULT_REMOTE,
    local: options.local || localModule,
    now: options.now,
    onBackgroundResult: options.onBackgroundResult,
  });
  return {
    enabled: true,
    ...(result.status === 'ready' ? { uid } : {}),
    ...(config?.enabled === true && config.remoteApi ? {
      runtimeRemoteApi: config.remoteApi,
    } : {}),
    ...result,
  };
}

/** Keep the gate synchronous and legacy state unloaded until a generation is ready. */
export async function runV1FirstAccessLifecycle({
  gate,
  openStorage,
  prepare,
  initDB,
  applyState,
  release,
} = {}) {
  gate?.({ status: 'preparing' });
  try {
    await openStorage?.();
    const result = await prepare?.();
    if (result?.status !== 'ready') {
      gate?.(result);
      return result;
    }
    await initDB?.();
    applyState?.(result.state, result);
    await release?.(result);
    return result;
  } catch (error) {
    const result = { enabled: true, status: 'blocked', reason: safeReason(error) };
    gate?.(result);
    return result;
  }
}

export const V1_BOOTSTRAP_TEST_CONFIG = TEST_CONFIG_KEY;
