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
const V1_UID_KEY = 'estudo_v1_sync_uid';
const TEST_CONFIG_KEY = '__ESTUDO_V1_SYNC_TEST__';

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
export function validateV1Baseline({ generationId, manifest, records } = {}) {
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
  if (canonical(checked.manifestDraft.counts) !== canonical(manifest.counts) ||
    checked.manifestDraft.businessDigest !== manifest.businessDigest) {
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
  if (current.manifest.state !== 'active') {
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
    const verified = validateV1Baseline(fetched);
    await local.installRemoteBaseline({
      uid,
      generationId: current.generationId,
      state: verified.state,
      manifest: current.manifest,
      now,
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
    if (!requiresNetwork(error)) {
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
    await local.markV1GenerationBlocked(targetUid, targetGeneration, now);
    return;
  }
  validateRecord(delta.record);
  if (delta.record.generationId !== targetGeneration ||
    delta.record.collection !== delta.collection) {
    throw new TypeError('V1 remote delta does not match the active generation');
  }
  await local.applyRemoteRecord({
    uid: targetUid,
    generationId: targetGeneration,
    record: delta.record,
    now,
  });
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

function configuredV1(windowRef, storage) {
  try {
    const explicit = windowRef?.[TEST_CONFIG_KEY];
    if (explicit?.enabled === true) return explicit;
    if (storage?.getItem(V1_FLAG_KEY) === 'true') {
      return { enabled: true, uid: storage.getItem(V1_UID_KEY) };
    }
  } catch {
    // Storage denial leaves the engine disabled.
  }
  return null;
}

/** Minimal app seam. It never reports success when Auth or a verified cache is absent. */
export async function bootstrapConfiguredV1Generation(options = {}) {
  const windowRef = options.windowRef || globalThis.window;
  const storage = options.storage || globalThis.localStorage;
  if (!isV1SyncEnabled({ windowRef, storage })) return { enabled: false };
  const config = options.config || configuredV1(windowRef, storage);
  if (typeof config?.uid !== 'string' || !TOKEN.test(config.uid)) {
    return { enabled: true, status: 'blocked', reason: 'V1_BOOTSTRAP_INVALID_UID' };
  }
  const result = await bootstrapV1Generation({
    uid: config.uid,
    online: options.online ?? config.online,
    remoteApi: options.remoteApi || config.remoteApi || DEFAULT_REMOTE,
    local: options.local || localModule,
    now: options.now,
  });
  return { enabled: true, ...result };
}

export const V1_BOOTSTRAP_TEST_CONFIG = TEST_CONFIG_KEY;
