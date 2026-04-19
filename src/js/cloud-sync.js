import { state, setState, SyncQueue, saveStateToDB } from './store.js?v=8.3';

let isSyncing = false;
let _lastPushTime = 0;
const MIN_PUSH_INTERVAL_MS = 30_000;
const SYNC_VERSION = 1;
const DEVICE_ID_KEY = 'estudo_device_id';

function getDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
        id = 'web-' + Math.random().toString(36).substring(2, 10);
        localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
}

// Sync credentials stored separately from study data
const SYNC_CREDS_KEY = 'estudo_sync_creds';

function getSyncCreds() {
    try {
        const raw = localStorage.getItem(SYNC_CREDS_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function setSyncCreds({ url, token, enabled }) {
    localStorage.setItem(SYNC_CREDS_KEY, JSON.stringify({ url, token, enabled }));
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

function wrapInEnvelope(payload) {
    return {
        version: SYNC_VERSION,
        deviceId: getDeviceId(),
        updatedAt: new Date().toISOString(),
        payload
    };
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
        let remoteTime = 0;

        if (remoteData && remoteData.config && remoteData.config._lastUpdated) {
            remoteTime = remoteData.config._lastUpdated;
        } else if (envelope && envelope.updatedAt) {
            remoteTime = new Date(envelope.updatedAt).getTime();
        }

        if (forceOverwrite || remoteTime > localTime) {
            console.log(forceOverwrite ? 'Restauração forçada da Cloudflare...' : 'Dados da Cloudflare são mais novos, aplicando...');
            setState(remoteData);
            // Strip sync creds from incoming data to avoid overwriting local creds
            if (state.config) {
                delete state.config.cfUrl;
                delete state.config.cfToken;
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
export async function pushToCloudflare() {
    if (isSyncing) return false;
    const config = getSyncConfig();
    if (!config) return false;

    const now = Date.now();
    if (now - _lastPushTime < MIN_PUSH_INTERVAL_MS) {
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

        const envelope = wrapInEnvelope(snapshot);
        const payload = JSON.stringify(envelope);

        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.token}`
            },
            body: payload
        });

        if (!response.ok) {
            let errorMsg = `HTTP Error: ${response.status}`;
            try {
                const errData = await response.json();
                if (errData && errData.error) errorMsg = `Erro ${response.status}: ${errData.error}`;
            } catch (e) { /* ignore */ }
            throw new Error(errorMsg);
        }

        _lastPushTime = Date.now();

        state.config._lastUpdated = pushTimestamp;
        state.config.cfLastSyncAt = new Date(pushTimestamp).toISOString();
        saveStateToDB(true);
        const lastStr = new Date(pushTimestamp).toLocaleString('pt-BR');
        updateSyncStatus(`Nuvem atualizada em ${lastStr}`);
        console.log('Cloudflare Sync OK');
    } catch (err) {
        console.error('Erro no Cloudflare Push:', err);
        updateSyncStatus(`Erro no Push: ${err.message}`, true);
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
