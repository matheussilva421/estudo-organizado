/**
 * Ações de Configurações
 * Handlers para configurações, sync, backup e preferências
 */

import { registerAction } from './dispatcher.js';
import {
  updateConfig,
  toggleConfig,
  updateFrequencia,
  toggleCfSync,
  archiveOldEvents,
  clearAllData,
  setTheme,
  exportData,
  importData,
  restoreBackupFromSelectedSource,
  openDriveModal,
  driveDisconnect,
} from '../../views/config-view.js?v=8.37';
import { scheduleSave, state } from '../../store.js?v=8.37';
import { showToast, showConfirm } from '../../app.js?v=8.37';
import { renderCurrentView } from '../../components.js?v=8.37';
import {
  forceCloudflareSync,
  pullFromCloudflare,
  pushToCloudflare,
  mergeFromCloudflare,
} from '../../cloud-sync.js?v=8.37';
import {
  firestoreSignIn,
  firestoreSignOut,
  enableFirestoreSync,
  disableFirestoreSync,
  syncFirestoreNow,
  pullFromFirestore,
  mergeFromFirestore,
  forcePushFirestore,
  getFirestoreSyncStatus,
  downloadSyncDiagnosticLog,
  resolveEntityConflictKeepLocal,
  resolveEntityConflictKeepRemote,
} from '../../sync/firestore-sync-engine.js?v=8.37';
import { flushPrimarySyncNow } from '../../sync/sync-coordinator.js?v=8.37';
import { syncAllChannels, isManualSyncRunning } from '../../sync/manual-sync.js?v=8.37';
import { downloadSyncLog } from '../../sync/sync-diagnostic.js?v=8.37';
import {
  syncWithDrive,
  pullFromDrive,
  mergeFromDrive,
  driveAction,
} from '../../drive-sync.js?v=8.37';

// Registrar ações
registerAction('update-config', (el) => {
  const key = el.dataset.configKey;
  if (!key) return;
  let value = el.value;
  if (el.dataset.valueType === 'number') {
    value = parseInt(value, 10);
  } else if (el.dataset.valueTransform === 'trim-url') {
    value = value.trim().replace(/\/$/, '');
  } else if (el.dataset.valueTransform === 'trim') {
    value = value.trim();
  }
  updateConfig(key, value);
});
registerAction('toggle-config', (el) => {
  const key = el.dataset.configKey;
  if (!key) return;
  toggleConfig(key, el);
  el.setAttribute('aria-pressed', el.classList.contains('on') ? 'true' : 'false');
});
registerAction('update-frequencia', (el) => updateFrequencia(el.value));
registerAction('toggle-password-visibility', (el) => {
  const input = document.getElementById(el.dataset.targetId);
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
});
registerAction('toggle-cf-sync', (el) => toggleCfSync(el.checked));
registerAction('archive-old-events', (el) => {
  const days = parseInt(el.dataset.days || '90', 10);
  archiveOldEvents(days);
});
registerAction('clear-all-data', clearAllData);
registerAction('set-theme', (el) => setTheme(el.value));
registerAction('export-data', exportData);
registerAction('import-data', importData);
registerAction('restore-backup', restoreBackupFromSelectedSource);
registerAction('open-restore-preview', restoreBackupFromSelectedSource);
registerAction('open-drive-modal', openDriveModal);
registerAction('drive-disconnect', driveDisconnect);
registerAction('disconnect-drive', driveDisconnect);
registerAction('request-notification-permission', () => {
  if (!('Notification' in window)) return;
  Notification.requestPermission()
    .then((permission) => {
      if (permission === 'granted') showToast('Notificações ativadas!', 'success');
      renderCurrentView();
    })
    .catch((error) => console.warn(error));
});
registerAction('test-notification', () => {
  if ('Notification' in window) {
    new Notification('Estudo Organizado', { body: 'Notificações funcionando!', icon: '📚' });
    showToast('Lembretes enviados!', 'success');
  }
});

// Sync and advanced config actions
registerAction('force-cloudflare-sync', forceCloudflareSync);
registerAction('cloud-conflict-export-local', exportData);
registerAction('cloud-conflict-pull-remote', () => {
  showConfirm(
    'Baixar os dados remotos agora? Isso substituirá os dados locais. Exporte um backup local antes se tiver dúvida.',
    () => pullFromCloudflare(true),
    { label: 'Baixar remoto', title: 'Resolver conflito de sync' }
  );
});
registerAction('cloud-conflict-force-push', () => {
  showConfirm(
    'Forçar envio local para a nuvem? Isso sobrescreverá a versão remota mais recente.',
    () => pushToCloudflare(true),
    { label: 'Forçar envio', title: 'Sobrescrever remoto', danger: true }
  );
});
registerAction('firestore-sign-in', firestoreSignIn);
registerAction('firestore-sign-out', firestoreSignOut);
registerAction('firestore-enable-primary', () => enableFirestoreSync('primary'));
registerAction('firestore-enable-shadow', () => enableFirestoreSync('shadow'));
registerAction('firestore-disable-sync', disableFirestoreSync);
registerAction('firestore-sync-now', syncFirestoreNow);
registerAction('firestore-force-sync', async () => {
  const ok = await syncFirestoreNow();
  showToast(
    ok ? 'Sincronização forçada concluída.' : 'Sincronização forçada falhou. Verifique o log.',
    ok ? 'success' : 'error'
  );
});
registerAction('firestore-pull-remote', () => {
  showConfirm(
    'Baixar snapshot do Firestore? Isso pode substituir dados locais. Exporte um backup local antes de confirmar.',
    () => pullFromFirestore(true),
    { label: 'Baixar Firestore', title: 'Restaurar Firestore' }
  );
});
registerAction('firestore-merge-remote', () => {
  showConfirm(
    'Mesclar Firestore com os dados locais? Itens locais e remotos serão preservados quando possível, e o resultado será enviado ao Firestore.',
    () => mergeFromFirestore(),
    { label: 'Mesclar Firestore', title: 'Mesclar dados' }
  );
});
registerAction('firestore-force-push', () => {
  showConfirm(
    'Enviar dados locais para o Firestore e sobrescrever o snapshot remoto?',
    () => forcePushFirestore(),
    { label: 'Forçar envio', title: 'Sobrescrever Firestore', danger: true }
  );
});
registerAction('firestore-export-local', exportData);
registerAction('firestore-open-conflict-review', () => {
  showToast('Revise as entidades afetadas nas opções avançadas de sync.', 'info');
});
registerAction('entity-conflict-keep-local', async () => {
  const ok = await resolveEntityConflictKeepLocal();
  showToast(
    ok ? 'Conflito resolvido: dados locais enviados.' : 'Erro ao resolver conflito.',
    ok ? 'success' : 'error'
  );
});
registerAction('entity-conflict-keep-remote', async () => {
  const ok = await resolveEntityConflictKeepRemote();
  showToast(
    ok ? 'Conflito resolvido: dados da nuvem aplicados.' : 'Erro ao resolver conflito.',
    ok ? 'success' : 'error'
  );
});
registerAction('firestore-download-log', async () => {
  try {
    await downloadSyncDiagnosticLog();
    showToast('Log de sync baixado', 'success');
  } catch (err) {
    showToast('Erro ao gerar log: ' + err.message, 'error');
  }
});
registerAction('cloud-merge-remote', () => {
  showConfirm(
    'Mesclar Cloudflare com os dados locais? Itens locais e remotos serão preservados quando possível, e o resultado será enviado ao Worker.',
    () => mergeFromCloudflare(),
    { label: 'Mesclar Cloudflare', title: 'Mesclar dados' }
  );
});
registerAction('drive-sync-now', () => {
  syncWithDrive()
    .then(() => showToast('Sincronizado!', 'success'))
    .catch(() => showToast('Erro ao sincronizar', 'error'));
});
registerAction('pull-from-drive', pullFromDrive);
registerAction('merge-from-drive', () => {
  showConfirm(
    'Mesclar Google Drive com os dados locais? Itens locais e remotos serão preservados quando possível, e o resultado será reenviado ao Drive.',
    () => mergeFromDrive(),
    { label: 'Mesclar Drive', title: 'Mesclar dados' }
  );
});
registerAction('drive-action', driveAction);
registerAction('sync-center-smart-sync', async () => {
  if (state.config?.globalSyncPaused) {
    showToast('Sync global pausado. Retome o sync para enviar dados à nuvem.', 'info');
    return;
  }
  const status = getFirestoreSyncStatus();
  if (status?.conflict) {
    showToast('Firebase tem conflito. Use Mesclar, Baixar ou Enviar local.', 'info');
    return;
  }
  if (status?.configured && status?.signedIn && status?.enabled) {
    const ok = await flushPrimarySyncNow({ manual: true, reason: 'smart-sync' });
    showToast(
      ok ? 'Firestore primário sincronizado.' : 'Firestore aguardando revisão ou nova tentativa.',
      ok ? 'success' : 'info'
    );
    return;
  }
  showToast(
    'Ative o Firestore primário para sincronizar entre dispositivos. Cloudflare e Drive ficam como backups manuais.',
    'info'
  );
});
registerAction('toggle-global-sync', () => {
  if (!state.config) state.config = {};
  const paused = state.config.globalSyncPaused !== true;
  state.config.globalSyncPaused = paused;
  scheduleSave();
  document.dispatchEvent(
    new CustomEvent('app:globalSyncPauseChanged', {
      detail: { paused },
    })
  );
  document.dispatchEvent(
    new CustomEvent('app:primarySyncStatus', {
      detail: { status: paused ? 'paused' : 'idle', reason: 'global-toggle' },
    })
  );
  showToast(
    paused
      ? 'Sync global pausado. O salvamento local continua ativo.'
      : 'Sync global retomado. O app voltará a sincronizar automaticamente.',
    paused ? 'info' : 'success'
  );
});
async function runManualSync(trigger) {
  if (isManualSyncRunning()) {
    showToast('Sincronização já em andamento.', 'info');
    return;
  }

  if (!navigator.onLine) {
    showToast('Sem conexão. Sincronize quando estiver online.', 'info');
    return;
  }

  const result = await syncAllChannels({ trigger });
  const { summary } = result;

  if (summary.overall === 'no-channels') {
    showToast(
      'Nenhum canal de sincronização configurado. Vá em Configurações → Central de Sincronização.',
      'info'
    );
    return;
  }

  if (summary.overall === 'offline') {
    showToast('Sem conexão. Sincronize quando estiver online.', 'info');
    return;
  }

  if (summary.overall === 'synced') {
    showToast('Sincronização concluída.', 'success');
    renderCurrentView();
    return;
  }

  if (summary.overall === 'conflict') {
    showToast(
      'Conflito detectado. Resolva em Configurações → Central de Sincronização → Avançado.',
      'error'
    );
    renderCurrentView();
    return;
  }

  if (summary.overall === 'partial') {
    const failed = [];
    if (result.firestore.status === 'error' || result.firestore.status === 'conflict') failed.push('Firebase');
    if (result.cloudflare.status === 'error' || result.cloudflare.status === 'conflict') failed.push('Cloudflare');
    if (result.drive.status === 'error' || result.drive.status === 'conflict') failed.push('Google Drive');
    showToast(
      `Sincronização parcial. Verifique: ${failed.join(', ')}.`,
      'info'
    );
    renderCurrentView();
    return;
  }

  showToast('Sincronização falhou. Verifique o log.', 'error');
  renderCurrentView();
}
registerAction('sync-now', () => runManualSync('header-button'));
registerAction('manual-sync-all', () => runManualSync('config-button'));
registerAction('download-sync-log', async () => {
  try {
    await downloadSyncLog();
    showToast('Log de sync baixado.', 'success');
  } catch (err) {
    showToast('Erro ao gerar log: ' + (err?.message || 'desconhecido'), 'error');
  }
});
registerAction('sync-center-export-local', exportData);
registerAction('sync-center-import-local', () => importData());
registerAction('force-sw-cache-clear', async () => {
  if (!('serviceWorker' in navigator)) {
    showToast('Service Worker não suportado neste browser.', 'error');
    return;
  }
  try {
    showToast('Limpando cache...', 'info');
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      await reg.update();
    }
    window.location.reload(true);
  } catch (err) {
    console.error('Erro ao limpar cache do SW:', err);
    showToast('Erro ao limpar cache. Tente Ctrl+Shift+R.', 'error');
  }
});
