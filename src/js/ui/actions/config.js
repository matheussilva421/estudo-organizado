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
} from '../../views/config-view.js?v=8.32';
import { scheduleSave, state } from '../../store.js?v=8.32';
import { showToast, openModal, showConfirm } from '../../app.js?v=8.32';
import { renderCurrentView } from '../../components.js?v=8.32';
import { esc } from '../../utils.js?v=8.32';
import {
  forceCloudflareSync,
  pullFromCloudflare,
  pushToCloudflare,
  mergeFromCloudflare,
} from '../../cloud-sync.js?v=8.32';
import {
  firestoreSignIn,
  firestoreSignOut,
  enableFirestoreSync,
  disableFirestoreSync,
  syncFirestoreNow,
  pullFromFirestore,
  mergeFromFirestore,
  forcePushFirestore,
  verifyFirestoreEntityShadow,
  resolveEntityConflict,
  getFirestoreSyncStatus,
} from '../../sync/firestore-sync-engine.js?v=8.32';
import { flushPrimarySyncNow } from '../../sync/sync-coordinator.js?v=8.32';
import {
  syncWithDrive,
  pullFromDrive,
  mergeFromDrive,
  driveAction,
} from '../../drive-sync.js?v=8.32';

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
registerAction('firestore-pull-remote', () => {
  showConfirm(
    'Baixar snapshot do Firestore? Isso pode substituir dados locais. Exporte um backup local antes de confirmar.',
    () => pullFromFirestore(true),
    { label: 'Baixar Firestore', title: 'Restaurar Firestore' }
  );
});
registerAction('firestore-merge-remote', () => {
  showConfirm(
    'Mesclar Firestore com os dados locais? Itens locais e remotos serao preservados quando possivel, e o resultado sera enviado ao Firestore.',
    () => mergeFromFirestore(),
    { label: 'Mesclar Firestore', title: 'Mesclar dados' }
  );
});
registerAction('firestore-force-push', () => {
  showConfirm(
    'Enviar dados locais para o Firestore e sobrescrever o snapshot remoto?',
    () => forcePushFirestore(),
    { label: 'Forcar envio', title: 'Sobrescrever Firestore', danger: true }
  );
});
registerAction('firestore-export-local', exportData);
registerAction('firestore-verify-entity-shadow', verifyFirestoreEntityShadow);
registerAction('firestore-open-conflict-review', () => {
  const conflict = state?.config?.firestoreSync?.conflict;
  const modal = document.getElementById('modal-prompt');
  if (!modal || !conflict) return;
  const title = modal.querySelector('#modal-prompt-title');
  const body = modal.querySelector('#modal-prompt-body');
  const items = Array.isArray(conflict.items) ? conflict.items : [];
  const entityKey = (item) => item.key || `${item.collection}/${item.id}`;
  const hintLabel = (item) => {
    if (item.hint === 'remote-newer' || item.remoteDeleted) return 'Remoto mais novo';
    if (item.hint === 'tie') return 'Empate';
    if (item.localDeleted) return 'Deletado localmente';
    if (item.remoteDeleted) return 'Deletado remotamente';
    return 'Local mais novo';
  };

  if (title) title.textContent = 'Revisar conflito Firestore';
  if (body) {
    body.innerHTML = `
      <div class="config-actions-row">
        <button type="button" class="btn btn-outline btn-sm" data-action="firestore-export-local">
          <i class="fa fa-download"></i> Exportar backup antes
        </button>
      </div>
      <div class="sync-conflict-entities">
        ${items
          .map(
            (item) => `
          <div class="sync-conflict-entity">
            <span>${esc(item.collection || 'entidade')}</span>
            <code>${esc(item.id || item.key || 'sem-id')}</code>
            <span>${esc(hintLabel(item))}</span>
            <span>Local rev. ${esc(item.localRevision ?? '-')}</span>
            <span>Remoto rev. ${esc(item.remoteRevision ?? '-')}</span>
            <div class="sync-conflict-entity-actions">
              <button type="button" class="btn btn-ghost btn-sm" data-action="entity-conflict-keep-local" data-entity-key="${esc(entityKey(item))}">
                Manter local
              </button>
              <button type="button" class="btn btn-outline btn-sm" data-action="entity-conflict-keep-remote" data-entity-key="${esc(entityKey(item))}">
                Usar remoto
              </button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
      <pre style="white-space:pre-wrap;font-size:12px;max-height:32vh;overflow:auto;">${esc(
        JSON.stringify(conflict, null, 2)
      )}</pre>
    `;
  }
  openModal('modal-prompt');
});
registerAction('entity-conflict-keep-local', (el) => entityConflictResolve(el, 'local'));
registerAction('entity-conflict-keep-remote', (el) => entityConflictResolve(el, 'remote'));
registerAction('entity-sync-set-primary', () => setEntitySyncMode('primary'));
registerAction('entity-sync-set-shadow', () => setEntitySyncMode('shadow'));
registerAction('entity-sync-set-off', () => setEntitySyncMode('off'));
registerAction('cloud-merge-remote', () => {
  showConfirm(
    'Mesclar Cloudflare com os dados locais? Itens locais e remotos serao preservados quando possivel, e o resultado sera enviado ao Worker.',
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
    'Mesclar Google Drive com os dados locais? Itens locais e remotos serao preservados quando possivel, e o resultado sera reenviado ao Drive.',
    () => mergeFromDrive(),
    { label: 'Mesclar Drive', title: 'Mesclar dados' }
  );
});
registerAction('drive-action', driveAction);
registerAction('sync-center-smart-sync', async () => {
  const status = getFirestoreSyncStatus();
  if (status?.conflict) {
    showToast('Firebase tem conflito. Use Mesclar, Baixar ou Enviar local.', 'info');
    return;
  }
  if (status?.configured && status?.signedIn && status?.enabled) {
    const ok = await flushPrimarySyncNow({ manual: true, reason: 'smart-sync' });
    showToast(
      ok ? 'Firestore primario sincronizado.' : 'Firestore aguardando revisao ou nova tentativa.',
      ok ? 'success' : 'info'
    );
    return;
  }
  showToast(
    'Ative o Firestore primario para sincronizar entre dispositivos. Cloudflare e Drive ficam como backups manuais.',
    'info'
  );
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

function setEntitySyncMode(mode) {
  if (!state?.config) return;
  if (!state.config.entitySync) state.config.entitySync = { enabled: false, mode: 'off' };
  state.config.entitySync.enabled = mode !== 'off';
  state.config.entitySync.mode = mode;
  scheduleSave();
  const labels = {
    primary: 'Entidades primarias ativadas (experimental).',
    shadow: 'Entidades em shadow ativadas.',
    off: 'Entidades desativadas.',
  };
  showToast(labels[mode] || 'Modo de entidades atualizado.', 'info');
  if (mode === 'primary') {
    document.dispatchEvent(
      new CustomEvent('app:primarySyncRequested', {
        detail: { reason: 'entity-primary-activated' },
      })
    );
  }
  document.dispatchEvent(new Event('app:renderCurrentView'));
}

async function entityConflictResolve(el, decision) {
  const entityKey = el.dataset.entityKey;
  if (!entityKey) return;
  const ok = await resolveEntityConflict(entityKey, decision);
  if (!ok) {
    showToast('Falha ao resolver conflito da entidade.', 'error');
    return;
  }
  showToast('Entidade resolvida.', 'success');
  const conflict = state?.config?.firestoreSync?.conflict;
  const modal = document.getElementById('modal-prompt');
  if (modal && conflict) {
    const pre = modal.querySelector('pre');
    if (pre) pre.textContent = JSON.stringify(conflict, null, 2);
  }
  document.dispatchEvent(new Event('app:renderCurrentView'));
}
