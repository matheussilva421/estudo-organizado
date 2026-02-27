import { state, scheduleSave, setState } from './store.js';

let isSyncing = false;

// Helpers para atualizar a UI da tela de configurações
function updateSyncStatus(msg, isError = false) {
    const el = document.getElementById('cf-sync-status');
    if (el) {
        el.textContent = msg;
        el.style.color = isError ? 'var(--red)' : 'var(--green)';
    }
}

function getSyncConfig() {
    if (!state || !state.config) return null;
    const { cfUrl, cfToken, cfSyncSyncEnabled } = state.config;
    if (cfSyncSyncEnabled && cfUrl && cfToken) {
        return { url: cfUrl, token: cfToken };
    }
    return null;
}

/**
 * Puxa os dados da Cloudflare e mescla se o timestamp remoto for mais recente
 * Retorna true se houve atualização bem-sucedida ou se não tinha dados remotos.
 */
export async function pullFromCloudflare() {
    const config = getSyncConfig();
    if (!config) return false;

    updateSyncStatus('Sincronizando puxando dados...');
    try {
        const response = await fetch(config.url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${config.token}`
            }
        });

        if (!response.ok) {
            let errorMsg = `HTTP Error: ${response.status}`;
            try {
                const errData = await response.json();
                if (errData && errData.error) errorMsg = `Erro ${response.status}: ${errData.error}`;
            } catch (e) { }
            throw new Error(errorMsg);
        }

        const remoteData = await response.json();

        // Se a resposta for null, o banco KV acabou de ser criado e ta vazio
        if (remoteData === null || remoteData.data === null) {
            updateSyncStatus('Nenhum dado remoto. Pronto para primeiro push.');
            return true;
        }

        // Checar timestamps para evitar overwrite malicioso de aparelho desatualizado
        const localTime = state.config && state.config._lastUpdated ? state.config._lastUpdated : 0;
        let remoteTime = 0;

        if (remoteData.config && remoteData.config._lastUpdated) {
            remoteTime = remoteData.config._lastUpdated;
        }

        if (remoteTime > localTime) {
            console.log('Dados da Cloudflare são mais novos, aplicando...');
            // Injeta propriedades vitais antes da carga pesada
            setState(remoteData);
            scheduleSave(); // Salva localmente
            document.dispatchEvent(new Event('app:invalidateCaches'));
            document.dispatchEvent(new Event('app:renderCurrentView'));
            document.dispatchEvent(new CustomEvent('app:showToast', { detail: { msg: 'Sincronizado via Nuvem (Cloudflare)', type: 'success' } }));
        } else if (remoteTime < localTime) {
            console.log('Dados locais mais recentes, ignorando pull.');
        } else {
            console.log('Dados sincronizados perfeitamente.');
        }

        const lastStr = new Date(remoteTime || Date.now()).toLocaleTimeString();
        updateSyncStatus(`Sincronizado às ${lastStr}`);
        return true;

    } catch (err) {
        console.error('Erro no Cloudflare Pull:', err);
        updateSyncStatus(`Erro: ${err.message}`, true);
        return false;
    }
}

/**
 * Envia o estado atual para o KV
 */
export async function pushToCloudflare() {
    if (isSyncing) return;
    const config = getSyncConfig();
    if (!config) return false;

    isSyncing = true;
    updateSyncStatus('Enviando dados para a nuvem...');

    try {
        // Marcador de versão ultra imperativo para saber de qual aparelho veio
        if (!state.config) state.config = {};
        state.config._lastUpdated = Date.now();

        const payload = JSON.stringify(state);

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
            } catch (e) { }
            throw new Error(errorMsg);
        }

        const lastStr = new Date(state.config._lastUpdated).toLocaleTimeString();
        updateSyncStatus(`Nuvem atualizada às ${lastStr}`);
        console.log('Cloudflare Sync OK');
    } catch (err) {
        console.error('Erro no Cloudflare Push:', err);
        updateSyncStatus(`Erro no Push: ${err.message}`, true);
    } finally {
        isSyncing = false;
    }
}

// Global binding para o botão na UI
window.forceCloudflareSync = async function () {
    const btn = document.getElementById('btn-force-cf-sync');
    if (btn) btn.disabled = true;

    // Tenta puxar novidades, e então empurra a versão atualizada pra consolidar
    await pullFromCloudflare();
    await pushToCloudflare();

    if (btn) btn.disabled = false;
};
