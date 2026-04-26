/**
 * Ações de Configurações
 * Handlers para configurações, sync, backup e preferências
 */

import { registerAction } from './dispatcher.js';

// Registrar ações
registerAction('update-config', (el) => updateConfig(el));
registerAction('toggle-config', (el) => toggleConfig(el));
registerAction('update-frequencia', (el) => updateFrequencia(el));
registerAction('toggle-password-visibility', (el) => togglePasswordVisibility(el));
registerAction('toggle-cf-sync', (el) => toggleCfSync(el));
registerAction('force-cloudflare-sync', () => forceCloudflareSync());
registerAction('cloud-conflict-export-local', () => cloudConflictExportLocal());
registerAction('cloud-conflict-pull-remote', () => cloudConflictPullRemote());
registerAction('cloud-conflict-force-push', () => cloudConflictForcePush());
registerAction('firestore-sign-in', () => firestoreSignIn());
registerAction('firestore-sign-out', () => firestoreSignOut());
registerAction('firestore-enable-shadow', () => firestoreEnableShadow());
registerAction('firestore-disable-sync', () => firestoreDisableSync());
registerAction('firestore-sync-now', () => firestoreSyncNow());
registerAction('firestore-pull-remote', () => firestorePullRemote());
registerAction('firestore-merge-remote', () => firestoreMergeRemote());
registerAction('firestore-force-push', () => firestoreForcePush());
registerAction('firestore-export-local', () => exportData());
registerAction('cloud-merge-remote', () => cloudMergeRemote());
registerAction('drive-sync-now', () => driveSyncNow());
registerAction('pull-from-drive', () => pullFromDrive());
registerAction('merge-from-drive', () => mergeFromDrive());
registerAction('drive-disconnect', () => driveDisconnect());
registerAction('open-drive-modal', () => openDriveModal());
registerAction('drive-action', () => driveAction());
registerAction('disconnect-drive', () => disconnectDrive());
registerAction('request-notification-permission', () => requestNotificationPermission());
registerAction('test-notification', () => testNotification());
registerAction('export-data', () => exportData());
registerAction('restore-backup', () => restoreBackup());
registerAction('sync-center-smart-sync', () => syncCenterSmartSync());
registerAction('sync-center-export-local', () => exportData());
registerAction('sync-center-import-local', () => importLocalData());
registerAction('archive-old-events', (el) => archiveOldEvents(el));
registerAction('clear-all-data', () => clearAllData());
registerAction('set-theme', (el) => setTheme(el));
registerAction('force-sw-cache-clear', () => forceSwCacheClear());

/**
 * Atualiza configuração por chave
 * @param {HTMLElement} el - Elemento acionador
 */
export function updateConfig(el) {
  const key = el.dataset.configKey;
  if (!key || typeof window.EstudoApp?.updateConfig !== 'function') return;

  let value = el.value;
  if (el.dataset.valueType === 'number') {
    value = parseInt(value, 10);
  } else if (el.dataset.valueTransform === 'trim-url') {
    value = value.trim().replace(/\/$/, '');
  } else if (el.dataset.valueTransform === 'trim') {
    value = value.trim();
  }

  window.EstudoApp?.updateConfig(key, value);
}

/**
 * Toggle configuração booleana
 * @param {HTMLElement} el - Elemento acionador
 */
export function toggleConfig(el) {
  const key = el.dataset.configKey;
  if (!key || typeof window.EstudoApp?.toggleConfig !== 'function') return;

  window.EstudoApp?.toggleConfig(key, el);
  el.setAttribute('aria-pressed', el.classList.contains('on') ? 'true' : 'false');
}

/**
 * Atualiza frequência de revisão
 * @param {HTMLElement} el - Elemento acionador
 */
export function updateFrequencia(el) {
  if (typeof window.EstudoApp?.updateFrequencia === 'function') {
    window.EstudoApp?.updateFrequencia(el.value);
  }
}

/**
 * Alterna visibilidade de senha
 * @param {HTMLElement} el - Elemento acionador
 */
export function togglePasswordVisibility(el) {
  const input = document.getElementById(el.dataset.targetId);
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
}

/**
 * Toggle sync com Cloudflare
 * @param {HTMLElement} el - Elemento acionador
 */
export function toggleCfSync(el) {
  if (typeof window.EstudoApp?.toggleCfSync === 'function') {
    window.EstudoApp?.toggleCfSync(el.checked);
  }
}

/**
 * Força sincronização com Cloudflare
 */
export function forceCloudflareSync() {
  if (typeof window.EstudoApp?.forceCloudflareSync === 'function') {
    window.EstudoApp?.forceCloudflareSync();
  }
}

/**
 * Exporta dados locais (conflito de sync)
 */
export function cloudConflictExportLocal() {
  if (typeof window.EstudoApp?.exportData === 'function') {
    window.EstudoApp?.exportData();
  }
}

/**
 * Baixa dados remotos (conflito de sync)
 */
export function cloudConflictPullRemote() {
  if (typeof window.EstudoApp?.showConfirm !== 'function' || typeof window.EstudoApp?.pullFromCloudflare !== 'function') return;
  window.EstudoApp?.showConfirm(
    'Baixar os dados remotos agora? Isso substituirá os dados locais. Exporte um backup local antes se tiver dúvida.',
    () => window.EstudoApp?.pullFromCloudflare(true),
    { label: 'Baixar remoto', title: 'Resolver conflito de sync' }
  );
}

/**
 * Força envio para nuvem (conflito de sync)
 */
export function cloudConflictForcePush() {
  if (typeof window.EstudoApp?.showConfirm !== 'function' || typeof window.EstudoApp?.pushToCloudflare !== 'function') return;
  window.EstudoApp?.showConfirm(
    'Forçar envio local para a nuvem? Isso sobrescreverá a versão remota mais recente.',
    () => window.EstudoApp?.pushToCloudflare(true),
    { label: 'Forçar envio', title: 'Sobrescrever remoto', danger: true }
  );
}

export function firestoreSignIn() {
  window.EstudoApp?.firestoreSignIn?.()
    .catch(err => window.EstudoApp?.showToast?.(err.message || 'Erro ao entrar no Google', 'error'));
}

export function firestoreSignOut() {
  window.EstudoApp?.firestoreSignOut?.()
    .catch(err => window.EstudoApp?.showToast?.(err.message || 'Erro ao sair do Google', 'error'));
}

export function firestoreEnableShadow() {
  window.EstudoApp?.enableFirestoreSync?.('shadow')
    .then(() => window.EstudoApp?.showToast?.('Firestore ativado em modo shadow.', 'success'))
    .catch(err => window.EstudoApp?.showToast?.(err.message || 'Erro ao ativar Firestore', 'error'));
}

export function firestoreDisableSync() {
  window.EstudoApp?.disableFirestoreSync?.()
    .then(() => window.EstudoApp?.showToast?.('Firestore desativado. Dados locais preservados.', 'info'))
    .catch(err => window.EstudoApp?.showToast?.(err.message || 'Erro ao desativar Firestore', 'error'));
}

export function firestoreSyncNow() {
  window.EstudoApp?.syncFirestoreNow?.()
    .then(ok => window.EstudoApp?.showToast?.(ok ? 'Firestore sincronizado.' : 'Firestore aguardando acao.', ok ? 'success' : 'info'))
    .catch(err => window.EstudoApp?.showToast?.(err.message || 'Erro ao sincronizar Firestore', 'error'));
}

export function firestorePullRemote() {
  if (typeof window.EstudoApp?.showConfirm !== 'function') return;
  window.EstudoApp.showConfirm(
    'Baixar snapshot do Firestore? Isso pode substituir dados locais. Exporte um backup local antes de confirmar.',
    () => window.EstudoApp?.pullFromFirestore?.(true),
    { label: 'Baixar Firestore', title: 'Restaurar Firestore' }
  );
}

export function firestoreForcePush() {
  if (typeof window.EstudoApp?.showConfirm !== 'function') return;
  window.EstudoApp.showConfirm(
    'Enviar dados locais para o Firestore e sobrescrever o snapshot remoto?',
    () => window.EstudoApp?.forcePushFirestore?.(),
    { label: 'Forcar envio', title: 'Sobrescrever Firestore', danger: true }
  );
}

export function firestoreMergeRemote() {
  if (typeof window.EstudoApp?.showConfirm !== 'function') return;
  window.EstudoApp.showConfirm(
    'Mesclar Firestore com os dados locais? Itens locais e remotos serao preservados quando possivel, e o resultado sera enviado ao Firestore.',
    () => window.EstudoApp?.mergeFromFirestore?.(),
    { label: 'Mesclar Firestore', title: 'Mesclar dados' }
  );
}

export function cloudMergeRemote() {
  if (typeof window.EstudoApp?.showConfirm !== 'function') return;
  window.EstudoApp.showConfirm(
    'Mesclar Cloudflare com os dados locais? Itens locais e remotos serao preservados quando possivel, e o resultado sera enviado ao Worker.',
    () => window.EstudoApp?.mergeFromCloudflare?.(),
    { label: 'Mesclar Cloudflare', title: 'Mesclar dados' }
  );
}

/**
 * Sync com Google Drive
 */
export function driveSyncNow() {
  if (typeof window.EstudoApp?.syncWithDrive === 'function') {
    window.EstudoApp?.syncWithDrive()
      .then(() => window.EstudoApp?.showToast('Sincronizado!', 'success'))
      .catch(() => window.EstudoApp?.showToast('Erro ao sincronizar', 'error'));
  }
}

/**
 * Baixa dados do Drive
 */
export function pullFromDrive() {
  if (typeof window.EstudoApp?.pullFromDrive === 'function') {
    window.EstudoApp?.pullFromDrive();
  }
}

export function mergeFromDrive() {
  if (typeof window.EstudoApp?.showConfirm !== 'function') return;
  window.EstudoApp.showConfirm(
    'Mesclar Google Drive com os dados locais? Itens locais e remotos serao preservados quando possivel, e o resultado sera reenviado ao Drive.',
    () => window.EstudoApp?.mergeFromDrive?.(),
    { label: 'Mesclar Drive', title: 'Mesclar dados' }
  );
}

export async function syncCenterSmartSync() {
  const status = window.EstudoApp?.getFirestoreSyncStatus?.();
  if (status?.conflict) {
    window.EstudoApp?.showToast?.('Firebase tem conflito. Use Mesclar, Baixar ou Enviar local.', 'info');
    return;
  }

  const tasks = [];
  if (status?.configured && status?.signedIn && status?.enabled) {
    tasks.push(window.EstudoApp?.syncFirestoreNow?.());
  }
  if (window.state?.config?.cfSyncEnabled) {
    tasks.push(window.EstudoApp?.forceCloudflareSync?.());
  }
  if (window.state?.driveFileId) {
    tasks.push(window.EstudoApp?.syncWithDrive?.());
  }

  if (tasks.length === 0) {
    window.EstudoApp?.showToast?.('Nenhum destino online ativo para sincronizar.', 'info');
    return;
  }

  const results = await Promise.allSettled(tasks.filter(Boolean));
  const failed = results.filter(result => result.status === 'rejected').length;
  window.EstudoApp?.showToast?.(
    failed ? 'Sincronizacao concluida com alertas. Confira a central.' : 'Central sincronizada.',
    failed ? 'error' : 'success'
  );
}

/**
 * Desconecta Google Drive
 */
export function driveDisconnect() {
  if (typeof window.EstudoApp?.driveDisconnect === 'function') {
    window.EstudoApp?.driveDisconnect();
  }
}

/**
 * Abre modal do Drive
 */
export function openDriveModal() {
  if (typeof window.EstudoApp?.openDriveModal === 'function') {
    window.EstudoApp?.openDriveModal();
  }
}

/**
 * Ação do Drive (conectar/desconectar)
 */
export function driveAction() {
  if (typeof window.EstudoApp?.driveAction === 'function') {
    window.EstudoApp?.driveAction();
  }
}

/**
 * Desconecta Drive
 */
export function disconnectDrive() {
  if (typeof window.EstudoApp?.disconnectDrive === 'function') {
    window.EstudoApp?.disconnectDrive();
  }
}

/**
 * Solicita permissão de notificação
 */
export function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  Notification.requestPermission()
    .then(permission => {
      if (permission === 'granted') {
        window.EstudoApp?.showToast('Notificações ativadas!', 'success');
      }
      window.EstudoApp?.renderCurrentView();
    })
    .catch(error => console.warn(error));
}

/**
 * Testa notificações
 */
export function testNotification() {
  if ('Notification' in window) {
    new Notification('Estudo Organizado', { body: 'Notificações funcionando!', icon: '📚' });
    window.EstudoApp?.showToast('Lembretes enviados!', 'success');
  }
}

/**
 * Exporta dados
 */
export function exportData() {
  if (typeof window.EstudoApp?.exportData === 'function') {
    window.EstudoApp?.exportData();
  }
}

export function importLocalData() {
  if (typeof window.EstudoApp?.importData === 'function') {
    window.EstudoApp?.importData();
  }
}

/**
 * Restaura backup
 */
export function restoreBackup() {
  if (typeof window.EstudoApp?.restoreBackupFromSelectedSource === 'function') {
    window.EstudoApp?.restoreBackupFromSelectedSource();
  }
}

/**
 * Arquiva eventos antigos
 * @param {HTMLElement} el - Elemento acionador
 */
export function archiveOldEvents(el) {
  const days = parseInt(el.dataset.days || '90', 10);
  if (typeof window.EstudoApp?.archiveOldEvents === 'function') {
    window.EstudoApp?.archiveOldEvents(days);
  }
}

/**
 * Limpa todos os dados
 */
export function clearAllData() {
  if (typeof window.EstudoApp?.clearAllData === 'function') {
    window.EstudoApp?.clearAllData();
  }
}

/**
 * Define tema
 * @param {HTMLElement} el - Elemento acionador
 */
export function setTheme(el) {
  if (typeof window.EstudoApp?.setTheme === 'function') {
    window.EstudoApp?.setTheme(el.value);
  }
}

/**
 * Força limpeza completa do cache do service worker e recarrega
 */
export async function forceSwCacheClear() {
  if (!('serviceWorker' in navigator)) {
    window.EstudoApp?.showToast('Service Worker não suportado neste browser.', 'error');
    return;
  }

  try {
    // Mostrar feedback imediato
    window.EstudoApp?.showToast('Limpando cache...', 'info');

    // 1. Limpar TODOS os caches
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));

    // 2. Obter registro do SW e forçar update
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      // 3. Enviar SKIP_WAITING se houver worker em espera
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      // 4. Forçar update
      await reg.update();
    }

    // 5. Recarregar página forçando refresh (true = bypass cache)
    window.location.reload(true);
  } catch (err) {
    console.error('Erro ao limpar cache do SW:', err);
    window.EstudoApp?.showToast('Erro ao limpar cache. Tente Ctrl+Shift+R.', 'error');
  }
}
