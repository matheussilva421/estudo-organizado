import { closeModal, showConfirm, showToast } from './app.js?v=8.32';
import {
  createExportableState,
  runMigrations,
  saveStateToDB,
  scheduleSave,
  state,
  setState,
} from './store.js?v=8.32';
import { renderCurrentView } from './components.js?v=8.32';
import { setCredential, getCredential, deleteCredential } from './credentials.js?v=8.32';
import { mergeStudyStates } from './sync/sync-center.js?v=8.32';

// =============================================
// GOOGLE DRIVE SYNC MODULE
// =============================================

const DRIVE_CLIENT_ID_KEY = 'drive_client_id';

export let tokenClient;
export let gapiInited = false;
export let gisInited = false;

// Initialize Google Services
export async function initGoogleAPIs() {
  const CLIENT_ID = await getCredential(DRIVE_CLIENT_ID_KEY);
  if (!CLIENT_ID) return;

  const scriptGapi = document.createElement('script');
  scriptGapi.src = 'https://apis.google.com/js/api.js';
  scriptGapi.onload = () => {
    gapi.load('client', () => {
      gapi.client
        .init({
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        })
        .then(() => {
          gapiInited = true;
          checkDriveStatus();
        })
        .catch((err) => console.error('GAPI Init error:', err));
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
          showToast(
            'Erro na autenticação do Drive: ' + (resp.error_description || resp.error),
            'error'
          );
          return;
        }
        showToast('Conectado ao Drive! Sincronizando...', 'info');
        syncWithDrive();
      },
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
    sub.textContent = state.lastSync
      ? `Sincronizado: ${new Date(state.lastSync).toLocaleString('pt-BR').slice(0, 16)}`
      : 'Sincronizado';
    if (btn) btn.textContent = 'Sincronizar Agora';
    if (area) {
      area.innerHTML = `
        <div class="drive-connected-message">
          <strong>✅ Conectado ao Google Drive</strong><br>
          Seus dados estão sendo salvos automaticamente na nuvem.
        </div>
        <button class="btn btn-ghost btn-sm drive-disconnect-btn" data-action="disconnect-drive">Desconectar</button>
      `;
    }
  } else if (status === 'syncing') {
    sub.textContent = 'Sincronizando...';
    if (btn) {
      btn.disabled = true;
      btn.textContent = '\u231B Sincronizando...';
    }
    if (area) {
      area.innerHTML =
        '<div class="drive-syncing-container"><div class="drive-syncing-spinner"></div><span>Sincronizando seus dados...</span></div>';
    }
  } else {
    sub.textContent = 'Clique para conectar';
    if (btn) btn.textContent = 'Conectar';
    if (area) area.innerHTML = '';
  }
}

export async function checkDriveStatus() {
  const CLIENT_ID = await getCredential(DRIVE_CLIENT_ID_KEY);
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

export async function driveAction() {
  const btn = document.getElementById('drive-action-btn');
  const inputEl = document.getElementById('drive-client-id');
  const inputId = inputEl?.value.trim();
  const savedId = await getCredential(DRIVE_CLIENT_ID_KEY);

  // Set loading state
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Sincronizando...';
  }

  if (inputId && inputId !== savedId) {
    await setCredential(DRIVE_CLIENT_ID_KEY, inputId);
    showToast('Client ID salvo. Recarregue a página para aplicar.', 'info');
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
    showToast(
      'APIs do Google não carregadas. Certifique-se de ter inserido o Client ID e recarregue a página.',
      'error'
    );
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
  const token = gapi.client?.getToken?.() || null;
  const finishDisconnect = () => {
    gapi.client?.setToken?.('');
    Promise.resolve(deleteCredential(DRIVE_CLIENT_ID_KEY)).catch((err) => {
      console.error('Failed to delete drive credential:', err);
    });
    localStorage.removeItem('estudo_drive_client_id');
    state.driveFileId = null;
    state.lastSync = null;
    updateDriveUI('disconnected', 'Google Drive');
    closeModal('modal-drive');
    showToast('Desconectado do Drive', 'info');
    scheduleSave();
    document.dispatchEvent(new Event('app:driveDisconnected'));
  };

  if (token?.access_token) {
    google.accounts.oauth2.revoke(token.access_token, finishDisconnect);
  } else {
    finishDisconnect();
  }
}

function buildMultipartBody() {
  const metadata = { name: 'estudo-organizado-data.json', mimeType: 'application/json' };
  const boundary = '-------314159265358979323846';
  const delimiter = '\r\n--' + boundary + '\r\n';
  const close_delim = '\r\n--' + boundary + '--';
  return {
    boundary,
    contentType: 'multipart/related; boundary=' + boundary,
    body:
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(createExportableState()) +
      close_delim,
  };
}

let _isSyncing = false;
export async function syncWithDrive(recursionDepth = 0) {
  if (!gapi.client || !gapi.client.drive) return;
  if (_isSyncing && recursionDepth === 0) return;
  if (recursionDepth === 0) _isSyncing = true;
  updateDriveUI('syncing', 'Sincronizando...');

  try {
    if (state.driveFileId) {
      // Tenta obter o arquivo do Drive para comparar a versão
      try {
        const resp = await gapi.client.drive.files.get({
          fileId: state.driveFileId,
          alt: 'media',
        });

        const driveData = resp.result;

        // Merge inteligente: mescla dados locais e remotos quando remoto é mais novo
        if (
          driveData.lastSync &&
          state.lastSync &&
          new Date(driveData.lastSync) > new Date(state.lastSync)
        ) {
          // O Drive tem uma versão mais nova (modificada em outro dispositivo)
          showConfirm(
            'Encontrada versão mais recente no Drive. Deseja mesclar com os dados locais?',
            () => {
              const merged = mergeStudyStates(state, driveData);
              setState(merged);
              runMigrations();
              saveStateToDB(true, true, true, { touchLocalBackup: false })
                .then(() => {
                  renderCurrentView();
                  showToast('Dados mesclados do Drive!', 'success');
                  updateDriveUI('connected', 'Google Drive');
                })
                .catch((e) => {
                  console.error('Force save fail:', e);
                })
                .finally(() => {
                  _isSyncing = false;
                });
            },
            { title: 'Sincronização', label: 'Mesclar Dados' }
          );

          // Handle cancel: libera lock quando usuário cancela
          const cancelBtn = document.getElementById('confirm-cancel-btn');
          if (cancelBtn) {
            const originalHandler = cancelBtn.onclick || (() => {});
            cancelBtn.onclick = () => {
              _isSyncing = false;
              originalHandler();
            };
          }

          return;
        }
      } catch (e) {
        // Arquivo pode ter sido apagado no Drive
        console.warn('Não foi possível ler do Drive, sobrescrevendo arquivo.', e);
        if (e.status === 404 || e.result?.error?.code === 404) {
          if (recursionDepth < 2) {
            state.driveFileId = null;
            return saveStateToDB(true, true, true, { touchLocalBackup: false }).then(() => {
              return syncWithDrive(recursionDepth + 1);
            });
          }
        }
      }

      // Atualiza o arquivo existente
      const accessToken = gapi.client.getToken().access_token;
      const { contentType, body: multipartRequestBody } = buildMultipartBody();

      const fetchResponse = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${state.driveFileId}?uploadType=multipart`,
        {
          method: 'PATCH',
          headers: new Headers({
            Authorization: 'Bearer ' + accessToken,
            'Content-Type': contentType,
          }),
          body: multipartRequestBody,
        }
      );

      if (!fetchResponse.ok) {
        throw new Error(`Drive PATCH failed: HTTP ${fetchResponse.status}`);
      }

      // Only update lastSync AFTER successful upload
      state.lastSync = new Date().toISOString();
      await saveStateToDB(true, true, true, { touchLocalBackup: false });
      showToast('Sincronizado com sucesso!', 'success');
    } else {
      // Cria um novo arquivo
      const accessToken = gapi.client.getToken().access_token;
      const { contentType, body: multipartRequestBody } = buildMultipartBody();

      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: new Headers({
            Authorization: 'Bearer ' + accessToken,
            'Content-Type': contentType,
          }),
          body: multipartRequestBody,
        }
      );

      if (!res.ok) {
        throw new Error(`Drive POST failed: HTTP ${res.status}`);
      }

      const data = await res.json();
      state.driveFileId = data.id;

      // Only update lastSync AFTER successful upload
      state.lastSync = new Date().toISOString();
      await saveStateToDB(true, true, true, { touchLocalBackup: false });
      showToast('Backup criado no Drive!', 'success');
    }
    updateDriveUI('connected', 'Google Drive');
  } catch (err) {
    console.error('Erro ao sincronizar:', err);
    showToast('Erro ao sincronizar com Drive', 'error');
    updateDriveUI('disconnected', 'Erro na Sincronização');
  } finally {
    if (recursionDepth === 0) _isSyncing = false;
  }
}

export async function previewDriveRestore() {
  if (!gapi.client || !gapi.client.drive) {
    throw new Error('APIs do Google nao carregadas');
  }
  if (!state.driveFileId) {
    throw new Error('Nenhum arquivo encontrado no Drive.');
  }

  const resp = await gapi.client.drive.files.get({
    fileId: state.driveFileId,
    alt: 'media',
  });
  const driveData = resp.result;
  if (!driveData || typeof driveData !== 'object') {
    throw new Error('Dados invalidos no Drive');
  }
  return driveData;
}

// Pull-only: force download from Drive without uploading local data
export async function pullFromDrive() {
  if (!gapi.client || !gapi.client.drive) {
    showToast('APIs do Google não carregadas', 'error');
    return;
  }
  if (!state.driveFileId) {
    showToast('Nenhum arquivo encontrado no Drive. Sincronize primeiro.', 'error');
    return;
  }

  updateDriveUI('syncing', 'Baixando do Drive...');
  try {
    const resp = await gapi.client.drive.files.get({
      fileId: state.driveFileId,
      alt: 'media',
    });
    const driveData = resp.result;
    if (!driveData || typeof driveData !== 'object') {
      showToast('Dados inválidos no Drive', 'error');
      updateDriveUI('connected', 'Google Drive');
      return;
    }
    setState(driveData);
    runMigrations();
    await saveStateToDB(true, true, true, { touchLocalBackup: false });
    renderCurrentView();
    updateDriveUI('connected', 'Google Drive');
    showToast('Dados importados do Drive com sucesso!', 'success');
  } catch (err) {
    console.error('Erro ao carregar do Drive:', err);
    showToast('Erro ao carregar dados do Drive', 'error');
    updateDriveUI('connected', 'Google Drive');
  }
}

export async function mergeFromDrive() {
  if (!gapi.client || !gapi.client.drive) {
    showToast('APIs do Google nao carregadas', 'error');
    return false;
  }
  if (!state.driveFileId) {
    showToast('Nenhum arquivo encontrado no Drive. Sincronize primeiro.', 'error');
    return false;
  }

  updateDriveUI('syncing', 'Mesclando Drive...');
  try {
    const resp = await gapi.client.drive.files.get({
      fileId: state.driveFileId,
      alt: 'media',
    });
    const driveData = resp.result;
    if (!driveData || typeof driveData !== 'object') {
      showToast('Dados invalidos no Drive', 'error');
      updateDriveUI('connected', 'Google Drive');
      return false;
    }
    setState(mergeStudyStates(state, driveData));
    runMigrations();
    await saveStateToDB(true, true, true);
    await syncWithDrive();
    renderCurrentView();
    updateDriveUI('connected', 'Google Drive');
    showToast('Drive mesclado com os dados locais.', 'success');
    return true;
  } catch (err) {
    console.error('Erro ao mesclar Drive:', err);
    showToast('Erro ao mesclar dados do Drive', 'error');
    updateDriveUI('connected', 'Google Drive');
    return false;
  }
}

// Google APIs are initialized from app.js init() when client ID is present
