import { state, setState, SyncQueue, saveStateToDB } from './store.js?v=8.11';
import { setCredential, getCredential, deleteCredential } from './credentials.js?v=8.11';

let isSyncing = false;
let _lastPushTime = 0;
const MIN_PUSH_INTERVAL_MS = 30_000;
const SYNC_VERSION = 2;
const DEVICE_ID_KEY = 'estudo_device_id';

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

async function getSyncCreds() {
    // Usa IndexedDB isolado para credenciais
    return await getCredential(CF_CREDS_KEY);
}

export async function setSyncCreds({ url, token, enabled }) {
    await setCredential(CF_CREDS_KEY, { url, token, enabled });
    // Backward compat: keep state.config in sync for legacy reads
    if (!state.config) state.config = {};
    state.config.cfUrl = url || '';
    state.config.cfToken = token || '';
    state.config.cfSyncEnabled = !!enabled;
}

function getSyncConfig() {
    // Prefer isolated creds, fall back to state.config for backward compat
    const creds = getSyncCreds();
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
        payload
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

/**
 * Puxa os dados da Cloudflare e mescla se o timestamp remoto for mais recente
 */
export async function pullFromCloudflare(forceOverwrite = false) {
    const config = getSyncConfig();
    if (!config) return false;

    updateSyncStatus('Sincronizando puxando dados...');
    try {
        const response = await fetch(config.url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${config.token}` }
        });

        if (!response.ok) {
            let errorMsg = `HTTP Error: ${response.status}`;
            try {
                const errData = await response.json();
                if (errData && errData.error) errorMsg = `Erro ${response.status}: ${errData.error}`;
            } catch (e) { /* ignore */ }
            throw new Error(errorMsg);
        }

        const rawData = await response.json();

        if (rawData === null || rawData.data === null) {
            updateSyncStatus('Nenhum dado remoto. Pronto para primeiro push.');
            return true;
        }

        const { envelope, payload: remoteData } = unwrapEnvelope(rawData);

        const localTime = state.config && state.config._lastUpdated ? state.config._lastUpdated : 0;
        const remoteUpdatedAt = getRemoteUpdatedAtFromEnvelope(envelope, remoteData);
        let remoteTime = 0;

        if (remoteUpdatedAt) {
            remoteTime = new Date(remoteUpdatedAt).getTime();
        }

        if (forceOverwrite || remoteTime > localTime) {
            console.log(forceOverwrite ? 'Restauração forçada da Cloudflare...' : 'Dados da Cloudflare são mais novos, aplicando...');
            setState(remoteData);
            // Strip sync creds from incoming data to avoid overwriting local creds
            if (state.config) {
                delete state.config.cfUrl;
                delete state.config.cfToken;
                if (remoteUpdatedAt) state.config.cfRemoteUpdatedAt = remoteUpdatedAt;
                delete state.config.cfConflict;
            }
            saveStateToDB(true);
            document.dispatchEvent(new Event('app:invalidateCaches'));
            document.dispatchEvent(new Event('app:renderCurrentView'));
            document.dispatchEvent(new CustomEvent('app:showToast', { detail: { msg: 'Sincronizado via Nuvem (Cloudflare)', type: 'success' } }));
        } else if (remoteTime < localTime) {
            console.log('Dados locais mais recentes, ignorando pull.');
        } else {
            console.log('Dados sincronizados perfeitamente.');
        }

        const syncTs = remoteTime || Date.now();
        if (!state.config) state.config = {};
        if (remoteUpdatedAt) state.config.cfRemoteUpdatedAt = remoteUpdatedAt;
        state.config.cfLastSyncAt = new Date(syncTs).toISOString();
        saveStateToDB(true);
        const lastStr = new Date(syncTs).toLocaleString('pt-BR');
        updateSyncStatus(`Sincronizado em ${lastStr}`);
        return true;

    } catch (err) {
        console.error('Erro no Cloudflare Pull:', err);
        updateSyncStatus(`Erro: ${err.message}`, true);
        return false;
    }
}

/**
 * Envia o estado atual para o KV com versioned envelope
 */
export async function pushToCloudflare(forceOverwrite = false) {
    if (isSyncing) return false;
    const config = getSyncConfig();
    if (!config) return false;

    const now = Date.now();
    if (!forceOverwrite && now - _lastPushTime < MIN_PUSH_INTERVAL_MS) {
        console.log(`Cloud push ignorado (rate limit: aguardar ${Math.ceil((MIN_PUSH_INTERVAL_MS - (now - _lastPushTime)) / 1000)}s)`);
        return false;
    }

    isSyncing = true;
    updateSyncStatus('Enviando dados para a nuvem...');

    try {
        if (!state.config) state.config = {};
        const pushTimestamp = Date.now();

        const snapshot = structuredClone(state);
        snapshot.config._lastUpdated = pushTimestamp;
        // Strip credentials from sync payload
        delete snapshot.config.cfUrl;
        delete snapshot.config.cfToken;

        const envelope = wrapInEnvelope(snapshot, { forceOverwrite });
        const payload = JSON.stringify(envelope);

        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.token}`
            },
            body: payload
        });

        let responseData = null;
        try {
            responseData = await response.json();
        } catch (e) { /* response body is optional */ }

        if (!response.ok) {
            let errorMsg = `HTTP Error: ${response.status}`;
            if (responseData && responseData.error) errorMsg = `Erro ${response.status}: ${responseData.error}`;
            if (response.status === 409 && responseData) {
                state.config.cfConflict = {
                    remoteUpdatedAt: responseData.remoteUpdatedAt || null,
                    remoteDeviceId: responseData.remoteDeviceId || null,
                    detectedAt: new Date().toISOString()
                };
                document.dispatchEvent(new CustomEvent('app:showToast', {
                    detail: { msg: 'Conflito de sincronização: baixe os dados remotos antes de enviar.', type: 'error' }
                }));
            }
            throw new Error(errorMsg);
        }

        _lastPushTime = Date.now();

        state.config._lastUpdated = pushTimestamp;
        state.config.cfLastSyncAt = new Date(pushTimestamp).toISOString();
        state.config.cfRemoteUpdatedAt = responseData?.meta?.updatedAt || envelope.payloadUpdatedAt;
        delete state.config.cfConflict;
        saveStateToDB(true);
        const lastStr = new Date(pushTimestamp).toLocaleString('pt-BR');
        updateSyncStatus(`Nuvem atualizada em ${lastStr}`);
        console.log('Cloudflare Sync OK');
        return true;
    } catch (err) {
        console.error('Erro no Cloudflare Push:', err);
        updateSyncStatus(`Erro no Push: ${err.message}`, true);
        return false;
    } finally {
        isSyncing = false;
    }
}

window.forceCloudflareSync = async function () {
    const btn = document.getElementById('btn-force-cf-sync');
    const originalText = btn ? btn.textContent : 'Sincronizar';
    if (btn) {
        btn.disabled = true;
        btn.textContent = '\u231B Sincronizando...';
    }

    try {
        _lastPushTime = 0;
        await SyncQueue.add(() => pullFromCloudflare());
        await SyncQueue.add(() => pushToCloudflare());
        updateSyncStatus('Sincronizado com sucesso', false);
    } catch (err) {
        console.error('Force sync failed:', err);
        updateSyncStatus('Erro na sincronização forçada', true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
};
