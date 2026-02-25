import { closeModal, showConfirm, showToast } from './app.js';
import { runMigrations, saveStateToDB, scheduleSave, state, setState } from './store.js';
import { renderCurrentView } from './components.js';

// =============================================
// GOOGLE DRIVE SYNC MODULE
// =============================================

export let tokenClient;
export let gapiInited = false;
export let gisInited = false;

// Initialize Google Services
export function initGoogleAPIs() {
    const CLIENT_ID = localStorage.getItem('estudo_drive_client_id');
    if (!CLIENT_ID) return;

    const scriptGapi = document.createElement('script');
    scriptGapi.src = 'https://apis.google.com/js/api.js';
    scriptGapi.onload = () => {
        gapi.load('client', () => {
            gapi.client.init({
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
            }).then(() => { gapiInited = true; checkDriveStatus(); });
        });
    };
    document.head.appendChild(scriptGapi);

    const scriptGis = document.createElement('script');
    scriptGis.src = 'https://accounts.google.com/gsi/client';
    scriptGis.onload = () => {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: (resp) => {
                if (resp.error !== undefined) {
                    throw (resp);
                }
                showToast('Conectado ao Drive! Sincronizando...', 'info');
                syncWithDrive();
            }
        });
        gisInited = true;
        checkDriveStatus();
    };
    document.head.appendChild(scriptGis);
}

export function updateDriveUI(status, label) {
    const dot = document.getElementById('drive-dot');
    const txt = document.getElementById('drive-label');
    const sub = document.getElementById('drive-sublabel');
    const btn = document.getElementById('drive-action-btn');
    const area = document.getElementById('drive-status-area');

    if (!dot) return;

    dot.className = `drive-dot ${status}`;
    txt.textContent = label;

    if (status === 'connected') {
        sub.textContent = state.lastSync ? `Sincronizado: ${new Date(state.lastSync).toLocaleString('pt-BR').slice(0, 16)}` : 'Sincronizado';
        if (btn) btn.textContent = 'Sincronizar Agora';
        if (area) {
            area.innerHTML = `
        <div style="background:var(--accent-light);color:var(--accent-dark);padding:12px;border-radius:8px;font-size:13px;margin-top:16px;">
          <strong>✅ Conectado ao Google Drive</strong><br>
          Seus dados estão sendo salvos automaticamente na nuvem.
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-top:12px;width:100%;color:var(--red);" onclick="disconnectDrive()">Desconectar</button>
      `;
        }
    } else if (status === 'syncing') {
        sub.textContent = 'Sincronizando...';
        if (btn) btn.textContent = 'Aguarde...';
    } else {
        sub.textContent = 'Clique para conectar';
        if (btn) btn.textContent = 'Conectar';
        if (area) area.innerHTML = '';
    }
}

export function checkDriveStatus() {
    const CLIENT_ID = localStorage.getItem('estudo_drive_client_id');
    if (!CLIENT_ID) {
        updateDriveUI('disconnected', 'Google Drive');
        return;
    }
    if (typeof gapi !== 'undefined' && gapi.client?.getToken() !== null && state.driveFileId) {
        updateDriveUI('connected', 'Google Drive');
    } else {
        updateDriveUI('disconnected', 'Google Drive');
    }
}

export function driveAction() {
    const inputId = document.getElementById('drive-client-id')?.value.trim();
    const savedId = localStorage.getItem('estudo_drive_client_id');

    if (inputId && inputId !== savedId) {
        localStorage.setItem('estudo_drive_client_id', inputId);
        showToast('Client ID salvo. Recarregando...', 'info');
        setTimeout(() => location.reload(), 1500);
        return;
    }

    if (!savedId) {
        showToast('Insira o Client ID primeiro', 'error');
        return;
    }

    if (typeof gapi === 'undefined' || !gapi.client) {
        showToast('APIs do Google não carregadas. Certifique-se de ter inserido o Client ID e recarregue a página.', 'error');
        return;
    }
    if (gapi.client?.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        syncWithDrive();
    }
}

export function disconnectDrive() {
    if (gapi.client?.getToken() !== null) {
        google.accounts.oauth2.revoke(gapi.client.getToken().access_token, () => {
            gapi.client.setToken('');
            localStorage.removeItem('estudo_drive_client_id');
            state.driveFileId = null;
            state.lastSync = null;
            updateDriveUI('disconnected', 'Google Drive');
            closeModal('modal-drive');
            showToast('Desconectado do Drive', 'info');
            scheduleSave();
        });
    }
}

let _isSyncing = false;
export async function syncWithDrive() {
    if (!gapi.client || !gapi.client.drive) return;
    if (_isSyncing) return;
    _isSyncing = true;
    updateDriveUI('syncing', 'Sincronizando...');

    try {
        if (state.driveFileId) {
            // Tenta obter o arquivo do Drive para comparar a versão
            try {
                const resp = await gapi.client.drive.files.get({
                    fileId: state.driveFileId,
                    alt: 'media'
                });

                const driveData = resp.result;

                // Estratégia simples de merge: usa o arquivo mais recente
                if (driveData.lastSync && state.lastSync && new Date(driveData.lastSync) > new Date(state.lastSync)) {
                    _isSyncing = false; // release lock early
                    // O Drive tem uma versão mais nova (modificada em outro dispositivo)
                    showConfirm('Encontrada versão mais recente no Drive. Deseja sobrescrever os dados locais?', () => {
                        setState(driveData);
                        runMigrations();
                        saveStateToDB().then(() => {
                            renderCurrentView();
                            showToast('Dados atualizados do Drive!', 'success');
                            updateDriveUI('connected', 'Google Drive');
                        });
                    }, { title: 'Sincronização', label: 'Sobrescrever Local' });

                    return; // Não envia o arquivo local se o do Drive for mais novo, aguarda decisão do usuário
                }
            } catch (e) {
                // Arquivo pode ter sido apagado no Drive
                console.warn('Não foi possível ler do Drive, sobrescrevendo arquivo.', e);
                if (e.status === 404 || e.result?.error?.code === 404) {
                    state.driveFileId = null;
                    saveStateToDB();
                    _isSyncing = false;
                    return syncWithDrive(); // tenta novamente, agora criando arquivo novo
                }
            }

            // Atualiza o arquivo existente
            state.lastSync = new Date().toISOString();
            saveStateToDB(); // garante que state está salvo localmente

            const accessToken = gapi.client.getToken().access_token;
            const metadata = { name: 'estudo-organizado-data.json', mimeType: 'application/json' };
            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const close_delim = "\r\n--" + boundary + "--";

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(state) +
                close_delim;

            await fetch(`https://www.googleapis.com/upload/drive/v3/files/${state.driveFileId}?uploadType=multipart`, {
                method: 'PATCH',
                headers: new Headers({
                    'Authorization': 'Bearer ' + accessToken,
                    'Content-Type': 'multipart/related; boundary=' + boundary
                }),
                body: multipartRequestBody
            });
            showToast('Sincronizado com sucesso!', 'success');
        } else {
            // Cria um novo arquivo
            state.lastSync = new Date().toISOString();
            saveStateToDB(); // garante que está atualizado

            const accessToken = gapi.client.getToken().access_token;
            const metadata = { name: 'estudo-organizado-data.json', mimeType: 'application/json' };
            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const close_delim = "\r\n--" + boundary + "--";

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(state) +
                close_delim;

            const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: new Headers({
                    'Authorization': 'Bearer ' + accessToken,
                    'Content-Type': 'multipart/related; boundary=' + boundary
                }),
                body: multipartRequestBody
            });
            const data = await res.json();
            state.driveFileId = data.id;
            saveStateToDB();
            showToast('Backup criado no Drive!', 'success');
        }
        updateDriveUI('connected', 'Google Drive');
    } catch (err) {
        console.error('Erro ao sincronizar:', err);
        showToast('Erro ao sincronizar com Drive', 'error');
        updateDriveUI('connected', 'Erro na Sincronização'); // keeps connected but shows error visually
    } finally {
        _isSyncing = false;
    }
}

// Google APIs are initialized from app.js init() when client ID is present

// Hook para sincronizar automaticamente quando salva localmente (se estiver conectado)
document.addEventListener('stateSaved', () => {
    if (typeof gapi !== 'undefined' && gapi.client?.getToken() !== null && state.driveFileId) {
        // Debounce para a sincronização na nuvem não ficar sobrecarregada
        if (window.driveSyncTimeout) clearTimeout(window.driveSyncTimeout);
        window.driveSyncTimeout = setTimeout(() => {
            syncWithDrive();
        }, 10000); // 10s debounce para Drive Sync
    }
});
