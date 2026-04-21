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
registerAction('drive-sync-now', () => driveSyncNow());
registerAction('pull-from-drive', () => pullFromDrive());
registerAction('drive-disconnect', () => driveDisconnect());
registerAction('open-drive-modal', () => openDriveModal());
registerAction('drive-action', () => driveAction());
registerAction('disconnect-drive', () => disconnectDrive());
registerAction('request-notification-permission', () => requestNotificationPermission());
registerAction('test-notification', () => testNotification());
registerAction('export-data', () => exportData());
registerAction('restore-backup', () => restoreBackup());
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
