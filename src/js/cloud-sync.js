import {
  state,
  setState,
  SyncQueue,
  saveStateToDB,
  createExportableState,
} from './store.js?v=8.34';
import {
  setCredential,
  getCredential,
  deleteCredential as _deleteCredential,
} from './credentials.js?v=8.34';
import { mergeStudyStates } from './sync/sync-center.js?v=8.34';
import { cloudflareLock } from './sync/sync-lock.js?v=8.34';

const MAX_RETRIES = 3;
const OPERATION_TIMEOUT_MS = 15_000;
const MIN_PUSH_INTERVAL_MS = 30_000;
const SYNC_VERSION = 2;
const DEVICE_ID_KEY = 'estudo_device_id';

let _lastPushTime = 0;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function withRetry(fn, maxRetries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout(fn(), OPERATION_TIMEOUT_MS);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt);
        console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, err.message);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// Chaves de credenciais (nomes lógicos, armazenamento em IndexedDB)
const CF_CREDS_KEY = 'cloudflare';

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'web-' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export async function getSyncCreds() {
  // Usa IndexedDB isolado para credenciais
  const creds = await getCredential(CF_CREDS_KEY);
  console.log('[Cloudflare] getSyncCreds:', {
    hasCreds: !!creds,
    url: creds?.url ? `${creds.url.substring(0, 30)}...` : null,
    hasToken: !!creds?.token,
    enabled: creds?.enabled,
  });
  return creds;
}

export async function setSyncCreds({ url, token, enabled }) {
  const currentCreds = await getSyncCreds();
  console.log('[Cloudflare] setSyncCreds BEFORE:', {
    currentUrl: currentCreds?.url ? `${currentCreds.url.substring(0, 30)}...` : null,
    currentHasToken: !!currentCreds?.token,
    currentEnabled: currentCreds?.enabled,
    newUrl: url ? `${url.substring(0, 30)}...` : null,
    newHasToken: !!token,
    newEnabled: enabled,
  });

  const nextCreds = {
    url: url ?? currentCreds?.url ?? '',
    token: token || currentCreds?.token || '',
    enabled: enabled ?? currentCreds?.enabled ?? false,
  };

  await setCredential(CF_CREDS_KEY, nextCreds);

  console.log('[Cloudflare] setSyncCreds AFTER - IndexedDB updated:', {
    url: nextCreds.url ? `${nextCreds.url.substring(0, 30)}...` : null,
    hasToken: !!nextCreds.token,
    enabled: nextCreds.enabled,
  });

  // Backward compat: keep state.config in sync for legacy reads
  if (!state.config) state.config = {};
  state.config.cfUrl = nextCreds.url;
  delete state.config.cfToken;
  state.config.cfSyncEnabled = !!nextCreds.enabled;
  state.config.cfTokenSaved = Boolean(nextCreds.token);

  console.log('[Cloudflare] setSyncCreds AFTER - state.config updated:', {
    cfUrl: state.config.cfUrl ? `${state.config.cfUrl.substring(0, 30)}...` : null,
    cfSyncEnabled: state.config.cfSyncEnabled,
    cfTokenSaved: state.config.cfTokenSaved,
  });
}

export async function initCloudflareCreds() {
  const creds = await getSyncCreds();
  if (!state.config) state.config = {};

  console.log('[Cloudflare] initCloudflareCreds:', {
    storeHasCreds: !!(creds && creds.url),
    storeUrl: creds?.url,
    storeEnabled: creds?.enabled,
    storeHasToken: !!creds?.token,
    stateConfigUrl: state.config.cfUrl,
    stateConfigEnabled: state.config.cfSyncEnabled,
    stateConfigTokenSaved: state.config.cfTokenSaved,
  });

  if (creds && creds.url) {
    // Credential store has data — sync to state.config
    state.config.cfUrl = creds.url;
    state.config.cfSyncEnabled = !!creds.enabled;
    state.config.cfTokenSaved = Boolean(creds.token);
  } else if (state.config.cfUrl) {
    // Credential store empty but state.config has URL — preserve existing state
    // (migration path: old saves had cfUrl/cfTokenSaved in state.config)
    state.config.cfSyncEnabled = !!state.config.cfSyncEnabled;
    state.config.cfTokenSaved = !!state.config.cfTokenSaved;
  } else {
    // No credentials anywhere — clear flags
    state.config.cfUrl = '';
    state.config.cfSyncEnabled = false;
    state.config.cfTokenSaved = false;
  }

  console.log('[Cloudflare] After initCloudflareCreds:', {
    url: state.config.cfUrl,
    enabled: state.config.cfSyncEnabled,
    tokenSaved: state.config.cfTokenSaved,
  });
}

export async function getSyncConfig() {
  // Prefer isolated creds, fall back to state.config for backward compat
  const creds = await getSyncCreds();
  if (creds && creds.enabled && creds.url && creds.token) {
    return { url: creds.url, token: creds.token };
  }
  if (!state || !state.config) return null;
  const { cfUrl, cfToken, cfSyncEnabled } = state.config;
  if (cfSyncEnabled && cfUrl && cfToken) {
    return { url: cfUrl, token: cfToken };
  }
  return null;
}

function updateSyncStatus(msg, isError = false) {
  const el = document.getElementById('cf-sync-status');
  if (el) {
    el.textContent = msg;
    el.style.color = isError ? 'var(--red)' : 'var(--green)';
  }
}

function toIsoTimestamp(value) {
  if (!value) return new Date().toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? new Date().toISOString() : new Date(time).toISOString();
}

function getRemoteUpdatedAtFromEnvelope(envelope, payload) {
  if (envelope?.payloadUpdatedAt) return envelope.payloadUpdatedAt;
  if (envelope?.updatedAt) return envelope.updatedAt;
  if (payload?.config?._lastUpdated) return toIsoTimestamp(payload.config._lastUpdated);
  return null;
}

function wrapInEnvelope(payload, { forceOverwrite = false } = {}) {
  const envelope = {
    version: SYNC_VERSION,
    deviceId: getDeviceId(),
    baseRemoteUpdatedAt: state.config?.cfRemoteUpdatedAt || null,
    payloadUpdatedAt: toIsoTimestamp(payload.config?._lastUpdated),
    sentAt: new Date().toISOString(),
    payload,
  };
  if (forceOverwrite) envelope.forceOverwrite = true;
  return envelope;
}

function unwrapEnvelope(data) {
  if (data && data.version !== undefined && data.payload) {
    return { envelope: data, payload: data.payload };
  }
  // Legacy snapshot format — no envelope wrapper
  return { envelope: null, payload: data };
}

async function readCloudflareRemotePayload() {
  const config = await getSyncConfig();
  if (!config) return null;

  const response = await fetch(config.url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${config.token}` },
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error: ${response.status}`;
    try {
      const errData = await response.json();
      if (errData && errData.error) errorMsg = `Erro ${response.status}: ${errData.error}`;
    } catch {
      /* ignore */
    }
    throw new Error(errorMsg);
  }

  const rawData = await response.json();
  if (rawData === null || rawData.data === null) return null;
  return unwrapEnvelope(rawData);
}

export async function previewCloudflareRestore() {
  const remote = await readCloudflareRemotePayload();
  return remote?.payload || null;
}

/**
 * Puxa os dados da Cloudflare e mescla se o timestamp remoto for mais recente
 */
export async function pullFromCloudflare(forceOverwrite = false) {
  console.log('[Cloudflare] pullFromCloudflare START:', {
    forceOverwrite,
    configUrl: state.config?.cfUrl ? `${state.config.cfUrl.substring(0, 30)}...` : null,
    configEnabled: state.config?.cfSyncEnabled,
    configTokenSaved: state.config?.cfTokenSaved,
  });

  return cloudflareLock
    .withLock(async () => {
      const config = await getSyncConfig();
      console.log('[Cloudflare] pullFromCloudflare getSyncConfig:', {
        hasConfig: !!config,
        configUrl: config?.url ? `${config.url.substring(0, 30)}...` : null,
        hasToken: !!config?.token,
      });

      if (!config) {
        console.log('[Cloudflare] pullFromCloudflare ABORT: no config');
        return false;
      }

      updateSyncStatus('Sincronizando puxando dados...');
      try {
        const remote = await withRetry(() => readCloudflareRemotePayload());
        console.log('[Cloudflare] pullFromCloudflare remote data:', {
          hasRemote: !!remote,
          remoteTimestamp: remote?.envelope?.timestamp || remote?.payload?.updatedAt || 'N/A',
          remoteEventCount: remote?.payload?.eventos?.length ?? 'N/A',
        });

        if (!remote) {
          updateSyncStatus('Nenhum dado remoto. Pronto para primeiro push.');
          return true;
        }

        const { envelope, payload: remoteData } = remote;

        const localTime = state.config && state.config._lastUpdated ? state.config._lastUpdated : 0;
        const remoteUpdatedAt = getRemoteUpdatedAtFromEnvelope(envelope, remoteData);
        let remoteTime = 0;

        if (remoteUpdatedAt) {
          remoteTime = new Date(remoteUpdatedAt).getTime();
        }

        if (forceOverwrite || remoteTime > localTime) {
          console.log(
            forceOverwrite
              ? '[Cloudflare] Restaurao forada da Cloudflare...'
              : `[Cloudflare] Dados da Cloudflare so mais novos, aplicando... (remoteTime=${remoteTime}, localTime=${localTime})`
          );
          if (forceOverwrite) {
            setState(remoteData);
          } else {
            const merged = mergeStudyStates(state, remoteData);
            setState(merged);
          }
          // Strip sync creds from incoming data to avoid overwriting local creds
          if (state.config) {
            delete state.config.cfUrl;
            delete state.config.cfToken;
            delete state.config.cfTokenSaved;
            if (remoteUpdatedAt) state.config.cfRemoteUpdatedAt = remoteUpdatedAt;
            delete state.config.cfConflict;
          }
          console.log('[Cloudflare] pullFromCloudflare AFTER setState:', {
            stateConfigUrl: state.config?.cfUrl,
            stateConfigTokenSaved: state.config?.cfTokenSaved,
            stateConfigCfRemoteUpdatedAt: state.config?.cfRemoteUpdatedAt,
          });
          await saveStateToDB({
            skipCloudSync: true,
            skipFirestoreSync: true,
            skipDriveSync: true,
            touchLocalBackup: false,
          });
          console.log('[Cloudflare] pullFromCloudflare saveStateToDB completed');
          document.dispatchEvent(new Event('app:invalidateCaches'));
          document.dispatchEvent(
            new CustomEvent('app:cloudSyncStatus', {
              detail: { status: 'synced', reason: 'pull' },
            })
          );
          document.dispatchEvent(
            new CustomEvent('app:showToast', {
              detail: { msg: 'Sincronizado via Nuvem (Cloudflare)', type: 'success' },
            })
          );
        } else if (remoteTime < localTime) {
          console.log(`[Cloudflare] Dados locais mais recentes, ignorando pull. (localTime=${localTime}, remoteTime=${remoteTime})`);
        } else {
          console.log('[Cloudflare] Dados sincronizados perfeitamente.');
        }

        const syncTs = remoteTime || Date.now();
        if (!state.config) state.config = {};
        if (remoteUpdatedAt) state.config.cfRemoteUpdatedAt = remoteUpdatedAt;
        state.config.cfLastSyncAt = new Date(syncTs).toISOString();
        console.log('[Cloudflare] pullFromCloudflare saving state:', {
          cfLastSyncAt: state.config.cfLastSyncAt,
          cfRemoteUpdatedAt: state.config.cfRemoteUpdatedAt,
        });
        await saveStateToDB({
          skipCloudSync: true,
          skipFirestoreSync: true,
          skipDriveSync: true,
          touchLocalBackup: false,
        });
        console.log('[Cloudflare] pullFromCloudflare saveStateToDB completed');
        const lastStr = new Date(syncTs).toLocaleString('pt-BR');
        updateSyncStatus(`Sincronizado em ${lastStr}`);
        return true;
      } catch (err) {
        console.error('[Cloudflare] Erro no Cloudflare Pull:', err);
        updateSyncStatus(`Erro: ${err.message}`, true);
        return false;
      }
    })
    .catch((err) => {
      console.error('[Cloudflare] Erro no Cloudflare Pull (lock):', err);
      updateSyncStatus(`Erro: ${err.message}`, true);
      return false;
    });
}

export async function mergeFromCloudflare() {
  return cloudflareLock
    .withLock(async () => {
      const config = await getSyncConfig();
      if (!config) return false;

      updateSyncStatus('Mesclando dados da Cloudflare...');
      try {
        const remote = await withRetry(() => readCloudflareRemotePayload());
        if (!remote?.payload) {
          return await pushToCloudflareUnlocked(true);
        }

        const remoteUpdatedAt = getRemoteUpdatedAtFromEnvelope(remote.envelope, remote.payload);
        const merged = mergeStudyStates(state, remote.payload);
        setState(merged);
        if (!state.config) state.config = {};
        if (remoteUpdatedAt) state.config.cfRemoteUpdatedAt = remoteUpdatedAt;
        delete state.config.cfConflict;

        await saveStateToDB({ skipCloudSync: true, skipFirestoreSync: true, skipDriveSync: true });
        await pushToCloudflareUnlocked(true);
        document.dispatchEvent(new Event('app:invalidateCaches'));
        document.dispatchEvent(
          new CustomEvent('app:cloudSyncStatus', {
            detail: { status: 'synced', reason: 'merge' },
          })
        );
        document.dispatchEvent(
          new CustomEvent('app:showToast', {
            detail: { msg: 'Cloudflare mesclado com os dados locais.', type: 'success' },
          })
        );
        return true;
      } catch (err) {
        console.error('Erro no merge Cloudflare:', err);
        updateSyncStatus(`Erro no merge: ${err.message}`, true);
        return false;
      }
    })
    .catch((err) => {
      console.error('Erro no merge Cloudflare (lock):', err);
      updateSyncStatus(`Erro: ${err.message}`, true);
      return false;
    });
}

/**
 * Envia o estado atual para o KV com versioned envelope
 */
export async function pushToCloudflare(forceOverwrite = false) {
  return cloudflareLock.withLock(() => pushToCloudflareUnlocked(forceOverwrite));
}

async function pushToCloudflareUnlocked(forceOverwrite = false) {
  console.log('[Cloudflare] pushToCloudflareUnlocked START:', {
    forceOverwrite,
    configUrl: state.config?.cfUrl ? `${state.config.cfUrl.substring(0, 30)}...` : null,
    configEnabled: state.config?.cfSyncEnabled,
    configTokenSaved: state.config?.cfTokenSaved,
    configLastSyncAt: state.config?.cfLastSyncAt,
  });

  const config = await getSyncConfig();
  console.log('[Cloudflare] pushToCloudflareUnlocked getSyncConfig:', {
    hasConfig: !!config,
    configUrl: config?.url ? `${config.url.substring(0, 30)}...` : null,
    hasToken: !!config?.token,
  });

  if (!config) {
    console.log('[Cloudflare] pushToCloudflareUnlocked ABORT: no config');
    return false;
  }

  const now = Date.now();
  if (!forceOverwrite && now - _lastPushTime < MIN_PUSH_INTERVAL_MS) {
    console.log(`[Cloudflare] pushToCloudflareUnlocked ABORT: rate limit (${now - _lastPushTime}ms since last push, min=${MIN_PUSH_INTERVAL_MS}ms)`);
    return false;
  }

  updateSyncStatus('Enviando dados para a nuvem...');

  try {
    if (!state.config) state.config = {};
    const pushTimestamp = Date.now();

    const snapshot = createExportableState();
    snapshot.config._lastUpdated = pushTimestamp;

    const envelope = wrapInEnvelope(snapshot, { forceOverwrite });
    const payload = JSON.stringify(envelope);

    console.log('[Cloudflare] pushToCloudflareUnlocked sending:', {
      payloadSize: payload.length,
      envelopeTimestamp: envelope.timestamp,
      payloadUpdatedAt: envelope.payloadUpdatedAt,
      forceOverwrite: envelope.forceOverwrite,
    });

    const responseData = await withRetry(async () => {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.token}`,
        },
        body: payload,
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        /* response body is optional */
      }

      console.log('[Cloudflare] pushToCloudflareUnlocked fetch response:', {
        status: response.status,
        ok: response.ok,
        hasData: !!data,
        dataError: data?.error,
        dataRemoteUpdatedAt: data?.remoteUpdatedAt,
      });

      if (!response.ok) {
        let errorMsg = `HTTP Error: ${response.status}`;
        if (data && data.error) errorMsg = `Erro ${response.status}: ${data.error}`;
        if (response.status === 409 && data) {
          state.config.cfConflict = {
            remoteUpdatedAt: data.remoteUpdatedAt || null,
            remoteDeviceId: data.remoteDeviceId || null,
            detectedAt: new Date().toISOString(),
          };
          document.dispatchEvent(
            new CustomEvent('app:showToast', {
              detail: {
                msg: 'Conflito de sincronização: baixe os dados remotos antes de enviar.',
                type: 'error',
              },
            })
          );
        }
        throw new Error(errorMsg);
      }

      return data;
    });

    console.log('[Cloudflare] pushToCloudflareUnlocked push success:', {
      responseDataMeta: responseData?.meta,
    });

    _lastPushTime = Date.now();

    state.config._lastUpdated = pushTimestamp;
    state.config.cfLastSyncAt = new Date(pushTimestamp).toISOString();
    state.config.cfRemoteUpdatedAt = responseData?.meta?.updatedAt || envelope.payloadUpdatedAt;
    delete state.config.cfConflict;
    console.log('[Cloudflare] pushToCloudflareUnlocked updating state.config:', {
      cfLastSyncAt: state.config.cfLastSyncAt,
      cfRemoteUpdatedAt: state.config.cfRemoteUpdatedAt,
      cfConflict: state.config.cfConflict,
    });
    await saveStateToDB({
      skipCloudSync: true,
      skipFirestoreSync: true,
      skipDriveSync: true,
    });
    updateSyncStatus('Nuvem atualizada');
    console.log('[Cloudflare] pushToCloudflareUnlocked saveStateToDB completed');

    document.dispatchEvent(new Event('app:invalidateCaches'));
    document.dispatchEvent(
      new CustomEvent('app:cloudSyncStatus', {
        detail: { status: 'synced', reason: 'push' },
      })
    );
    document.dispatchEvent(
      new CustomEvent('app:showToast', {
        detail: { msg: 'Enviado para a nuvem (Cloudflare)', type: 'success' },
      })
    );
    console.log('[Cloudflare] pushToCloudflareUnlocked COMPLETE');
    return true;
  } catch (err) {
    console.error('[Cloudflare] Erro no Cloudflare Push:', err);
    updateSyncStatus(`Erro: ${err.message}`, true);
    return false;
  }
}

export async function forceCloudflareSync() {
  console.log('[Cloudflare] forceCloudflareSync START');
  const btn = document.getElementById('btn-force-cf-sync');
  const originalText = btn ? btn.textContent : 'Sincronizar';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '\u231B Sincronizando...';
  }

  try {
    _lastPushTime = 0;
    console.log('[Cloudflare] forceCloudflareSync pulling...');
    await SyncQueue.add(() => pullFromCloudflare());
    console.log('[Cloudflare] forceCloudflareSync pushing...');
    await SyncQueue.add(() => pushToCloudflare(true));
    console.log('[Cloudflare] forceCloudflareSync COMPLETE');
  } catch (err) {
    console.error('[Cloudflare] forceCloudflareSync ERROR:', err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}
