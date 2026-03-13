import { closeModal, showConfirm, showToast } from './app.js?v=8.2';
import { runMigrations, saveStateToDB, scheduleSave, state, setState, SyncQueue } from './store.js?v=8.2';
import { renderCurrentView } from './components.js?v=8.2';

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
            }).then(() => { gapiInited = true; checkDriveStatus(); }).catch(err => console.error('GAPI Init error:', err));
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
                    console.error('Google OAuth error:', resp);
                    showToast('Erro na autenticação do Drive: ' + (resp.error_description || resp.error), 'error');
                    return;
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
        <button class="btn btn-ghost btn-sm" style="margin-top:12px;width:100%;color:var(--red);" data-action="disconnect-drive">Desconectar</button>
      `;
        }
    } else if (status === 'syncing') {
        sub.textContent = 'Sincronizando...';
        if (btn) {
            btn.disabled = true;
            btn.textContent = '\u231B Sincronizando...';
        }
        if (area) {
            area.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:12px;border-radius:8px;font-size:13px;margin-top:16px;background:var(--bg-secondary);"><div class="spinner" style="width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 1s linear infinite;"></div><span>Sincronizando seus dados...</span></div>';
        }
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
    const btn = document.getElementById('drive-action-btn');
    const inputId = document.getElementById('drive-client-id')?.value.trim();
    const savedId = localStorage.getItem('estudo_drive_client_id');

    // Set loading state
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Sincronizando...';
    }

    if (inputId && inputId !== savedId) {
        localStorage.setItem('estudo_drive_client_id', inputId);
        showToast('Client ID salvo. Recarregando...', 'info');
        setTimeout(() => {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Conectar';
            }
            location.reload();
        }, 1500);
        return;
    }

    if (!savedId) {
        showToast('Insira o Client ID primeiro', 'error');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Conectar';
        }
        return;
    }

    if (typeof gapi === 'undefined' || !gapi.client) {
        showToast('APIs do Google não carregadas. Certifique-se de ter inserido o Client ID e recarregue a página.', 'error');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Conectar';
        }
        return;
    }
    if (gapi.client?.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
        // Reset button after auth prompt
        setTimeout(() => {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Conectar';
            }
        }, 2000);
    } else {
        syncWithDrive().finally(() => {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Sincronizar Agora';
            }
        });
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
            document.dispatchEvent(new Event('app:driveDisconnected'));
        });
    }
}

let _isSyncing = false;
export async function syncWithDrive(isRecursion = false) {
    if (!gapi.client || !gapi.client.drive) return;
    if (_isSyncing && !isRecursion) return;
    if (!isRecursion) _isSyncing = true;
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
                    // O Drive tem uma versão mais nova (modificada em outro dispositivo)
                    // Mantém _isSyncing = true até usuário decidir - libera apenas nos callbacks
                    showConfirm('Encontrada versão mais recente no Drive. Deseja sobrescrever os dados locais?', () => {
                        setState(driveData);
                        runMigrations();
                        saveStateToDB().then(() => {
                            renderCurrentView();
                            showToast('Dados atualizados do Drive!', 'success');
                            updateDriveUI('connected', 'Google Drive');
                            _isSyncing = false; // libera lock após conclusão com sucesso
                        }).catch(e => {
                            console.error('Force save fail:', e);
                            _isSyncing = false; // libera lock mesmo em erro
                        });
                    }, { title: 'Sincronização', label: 'Sobrescrever Local' });

                    // Handle cancel: libera lock quando usuário cancela
                    const cancelBtn = document.getElementById('confirm-cancel-btn');
                    if (cancelBtn) {
                        const originalHandler = cancelBtn.onclick || (() => {});
                        cancelBtn.onclick = () => {
                            _isSyncing = false; // libera lock no cancelamento
                            originalHandler();
                        };
                    }

                    return; // Não envia o arquivo local, aguarda decisão do usuário
                }
            } catch (e) {
                // Arquivo pode ter sido apagado no Drive
                console.warn('Não foi possível ler do Drive, sobrescrevendo arquivo.', e);
                if (e.status === 404 || e.result?.error?.code === 404) {
                    state.driveFileId = null;
                    return saveStateToDB().then(() => {
                        return syncWithDrive(true); // recursão com flag para não liberar lock duplamente
                    });
                }
            }

            // Atualiza o arquivo existente
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
            }).then(res => {
                if (!res.ok) throw new Error(`Drive PATCH failed: HTTP ${res.status}`);
            });

            // Only update lastSync AFTER successful upload
            state.lastSync = new Date().toISOString();
            saveStateToDB();
            showToast('Sincronizado com sucesso!', 'success');
        } else {
            // Cria um novo arquivo
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
            if (!res.ok) throw new Error(`Drive POST failed: HTTP ${res.status}`);
            const data = await res.json();
            state.driveFileId = data.id;

            // Only update lastSync AFTER successful upload
            state.lastSync = new Date().toISOString();
            saveStateToDB();
            showToast('Backup criado no Drive!', 'success');
        }
        updateDriveUI('connected', 'Google Drive');
    } catch (err) {
        console.error('Erro ao sincronizar:', err);
        showToast('Erro ao sincronizar com Drive', 'error');
        updateDriveUI('disconnected', 'Erro na Sincronização');
    } finally {
        if (!isRecursion) _isSyncing = false;
    }
}

// Pull-only: force download from Drive without uploading local data
export async function pullFromDrive() {
    if (!gapi.client || !gapi.client.drive) { showToast('APIs do Google não carregadas', 'error'); return; }
    if (!state.driveFileId) { showToast('Nenhum arquivo encontrado no Drive. Sincronize primeiro.', 'error'); return; }

    updateDriveUI('syncing', 'Baixando do Drive...');
    try {
        const resp = await gapi.client.drive.files.get({
            fileId: state.driveFileId,
            alt: 'media'
        });
        const driveData = resp.result;
        if (!driveData || typeof driveData !== 'object') {
            showToast('Dados inválidos no Drive', 'error');
            updateDriveUI('connected', 'Google Drive');
            return;
        }
        setState(driveData);
        runMigrations();
        await saveStateToDB();
        renderCurrentView();
        updateDriveUI('connected', 'Google Drive');
        showToast('Dados importados do Drive com sucesso!', 'success');
    } catch (err) {
        console.error('Erro ao carregar do Drive:', err);
        showToast('Erro ao carregar dados do Drive', 'error');
        updateDriveUI('connected', 'Google Drive');
    }
}

// Google APIs are initialized from app.js init() when client ID is present

// Hook para sincronizar automaticamente quando salva localmente (se estiver conectado)
document.addEventListener('stateSaved', () => {
    if (typeof gapi !== 'undefined' && gapi.client?.getToken() !== null && state.driveFileId) {
        // Debounce para a sincronização na nuvem não ficar sobrecarregada
        if (window.driveSyncTimeout) clearTimeout(window.driveSyncTimeout);
        window.driveSyncTimeout = setTimeout(() => {
            SyncQueue.add(() => syncWithDrive());
        }, 10000); // 10s debounce para Drive Sync
    }
});
