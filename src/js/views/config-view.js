/**
 * Config View
 * Settings page rendering and configuration helpers
 */

import {
  THEME_OPTIONS,
  applyTheme,
  normalizeTheme,
  showConfirm,
  showToast,
  openModal,
  getLastSaveStatus,
} from '../app.js?v=8.37';
import { cutoffDateStr, esc, todayStr, invalidateTodayCache } from '../utils.js?v=8.37';
import {
  scheduleSave,
  state,
  setState,
  runMigrations,
  createExportableState,
  clearData,
} from '../store.js?v=8.37';
import {
  syncCicloToEventos,
  invalidateDiscCache,
  invalidateDashCaches,
  invalidateRevCache,
} from '../logic.js?v=8.37';
import { renderCurrentView } from '../components.js?v=8.37';
import {
  previewFirestoreRestore,
  pullFromFirestore,
} from '../sync/firestore-sync-engine.js?v=8.37';
import {
  forceCloudflareSync,
  previewCloudflareRestore,
  pullFromCloudflare,
} from '../cloud-sync.js?v=8.37';
import { disconnectDrive, previewDriveRestore, pullFromDrive } from '../drive-sync.js?v=8.37';
import { previewRestoreImpact, validateBackupPayload } from '../backup-restore.js?v=8.37';
import {
  formatBackupDateTime,
  renderRestoreImpactSummary,
} from './config/backup-settings.js?v=8.37';
import {
  renderBackupCenterCard,
  renderFirestoreConflict,
  _renderFirestoreCard,
  getSyncHealthLabel,
  getSyncHealthIcon,
  renderCloudflareConflict,
  renderEntityConflictPanel,
  renderSyncSourceExtras,
  renderSyncSourceActions,
  renderCloudflareConfigFields,
  buildCurrentSyncCenterModel,
  _renderSyncCenterCard,
  renderQuietSyncCenterCard,
} from './config/sync-center.js?v=8.37';

function renderPreferenceNotificationsCard(cfg) {
  return `
    <div class="card config-card">
      <div class="card-header"><h3><i class="fa fa-bell"></i> Notifica&ccedil;&otilde;es</h3></div>
      <div class="card-body">
        <div class="config-row">
          <div>
            <div class="config-label">Notifica&ccedil;&otilde;es do browser</div>
            <div class="config-sub">${'Notification' in window ? (Notification.permission === 'granted' ? 'Ativadas' : Notification.permission === 'denied' ? 'Bloqueadas (altere nas config do browser)' : 'Permite receber lembretes de eventos e revis&otilde;es') : 'Browser n&atilde;o suporta'}</div>
          </div>
          ${
            'Notification' in window &&
            Notification.permission !== 'denied' &&
            Notification.permission !== 'granted'
              ? `
            <button class="btn btn-primary btn-sm" data-action="request-notification-permission"><i class="fa fa-bell"></i> Ativar</button>
          `
              : Notification.permission === 'granted'
                ? `
            <button class="btn btn-ghost btn-sm" data-action="test-notification"><i class="fa fa-bell"></i> Testar</button>
          `
                : ''
          }
        </div>
        <div class="config-row">
          <div>
            <div class="config-label">Modo Silencioso (In&iacute;cio)</div>
            <div class="config-sub">A partir de qual hor&aacute;rio silenciar:</div>
          </div>
          <input type="number" class="form-control config-input-number" min="0" max="23" value="${cfg.silentModeStart ?? 22}" data-action="update-config" data-config-key="silentModeStart" data-value-type="number">
        </div>
        <div class="config-row">
          <div>
            <div class="config-label">Modo Silencioso (Fim)</div>
            <div class="config-sub">At&eacute; qual hor&aacute;rio silenciar:</div>
          </div>
          <input type="number" class="form-control config-input-number" min="0" max="23" value="${cfg.silentModeEnd ?? 8}" data-action="update-config" data-config-key="silentModeEnd" data-value-type="number">
        </div>
      </div>
    </div>
  `;
}

function renderPreferenceDataCard(saveStatus, saveStatusText) {
  const isManualMode = state.config?.globalSyncPaused === true;
  return `
    <div class="card config-card">
      <div class="card-header"><h3><i class="fa fa-database"></i> Dados</h3></div>
      <div class="card-body">
        <div class="config-sub">
          ${state.eventos.length} evento(s) ativos
          ${(state.arquivo || []).length > 0 ? ` &bull; ${state.arquivo.length} arquivado(s)` : ''}
        </div>

        <div id="config-save-status-detail" class="config-save-status config-save-status--${saveStatus.status || 'saved'}">
          ${saveStatusText}
        </div>
        <div class="config-desc">Importa&ccedil;&otilde;es JSON passam por valida&ccedil;&atilde;o e pr&eacute;via de impacto antes de substituir os dados atuais.</div>

        <div class="grid config-backup-grid">
          ${
            isManualMode
              ? `<div class="flex flex-between"><span>Última sincronização manual:</span><strong>${formatBackupDateTime(state.config.localBackupAt)}</strong></div>`
              : `
          <div class="flex flex-between"><span>Backup local:</span><strong>${formatBackupDateTime(state.config.localBackupAt)}</strong></div>
          <div class="flex flex-between"><span>Backup Firestore:</span><strong>${formatBackupDateTime(state.config.firestoreSync?.remoteUpdatedAt)}</strong></div>
          <div class="flex flex-between"><span>Backup Cloudflare:</span><strong>${formatBackupDateTime(state.config.cfLastSyncAt)}</strong></div>
          <div class="flex flex-between"><span>Backup Google Drive:</span><strong>${formatBackupDateTime(state.lastSync)}</strong></div>`
          }
        </div>

        <div class="form-group mb-3">
          <label class="form-label">Origem do backup para restaura&ccedil;&atilde;o</label>
          <select id="backup-restore-source" class="form-control">
            <option value="local">Backup local (importar arquivo JSON)</option>
            <option value="firestore">Firestore</option>
            <option value="cloudflare">Cloudflare</option>
            <option value="drive">Google Drive</option>
          </select>
        </div>

        <div class="flex flex-wrap gap-sm">
          <button class="btn btn-ghost" data-action="export-data"><i class="fa fa-file-export"></i> Exportar JSON</button>
          <button class="btn btn-ghost" data-action="restore-backup"><i class="fa fa-rotate-left"></i> Restaurar backup selecionado</button>
          <button class="btn btn-ghost btn-sm" data-action="archive-old-events" data-days="90" title="Move eventos concluidos ha mais de 90 dias para o arquivo"><i class="fa fa-box-archive"></i> Arquivar antigos</button>
          <button class="btn btn-danger btn-sm" data-action="clear-all-data"><i class="fa fa-trash"></i> Limpar tudo</button>
        </div>
      </div>
    </div>
  `;
}

function renderPreferenceServiceWorkerCard() {
  return `
    <div class="card config-card">
      <div class="card-header"><h3><i class="fa fa-rotate"></i> Service Worker</h3></div>
      <div class="card-body">
        <div class="config-desc" style="margin-bottom:12px;">
          Limpe o cache do service worker e force o carregamento da vers&atilde;o mais recente. &Uacute;til quando h&aacute; problemas de cache ap&oacute;s atualiza&ccedil;&otilde;es.
        </div>
        <button class="btn btn-primary btn-sm" data-action="force-sw-cache-clear">
          <i class="fa fa-rotate"></i> Limpar cache e recarregar
        </button>
      </div>
    </div>
  `;
}

function renderPreferenceAboutCard() {
  return `
    <div class="card config-card">
      <div class="card-header"><h3><i class="fa fa-circle-info"></i> Sobre</h3></div>
      <div class="card-body">
        <div class="config-desc">
          <strong>Estudo Organizado</strong> &eacute; um app para planejamento e organiza&ccedil;&atilde;o de estudos para concursos p&uacute;blicos.<br><br>
          Baseado no Ciclo PDCA: planeje no Calend&aacute;rio, execute no Study Organizer, me&ccedil;a no Dashboard e corrija com as Revis&otilde;es.<br><br>
          <span class="text-xs text-muted">Vers&atilde;o 1.0 &bull; Dados salvos localmente + Google Drive</span>
        </div>
      </div>
    </div>
  `;
}

export function renderConfig(el) {
  const cfg = state.config;
  const saveStatus = getLastSaveStatus() || { status: 'saved' };
  const saveStatusText =
    saveStatus.status === 'error'
      ? `Falha ao salvar: ${esc(saveStatus.detail || 'erro desconhecido')}`
      : saveStatus.status === 'saving'
        ? 'Salvando alterações no dispositivo...'
        : 'Último salvamento local concluído. Credenciais não entram em backup/exportação.';
  const activeTheme = normalizeTheme(cfg.tema, cfg.darkMode);
  const themeOptionsHtml = THEME_OPTIONS.map(
    (theme) =>
      `<option value="${theme.value}" ${activeTheme === theme.value ? 'selected' : ''}>${theme.label}</option>`
  ).join('');
  el.innerHTML = `
    <div class="config-grid">
      <div>
        <div class="card config-card">
          <div class="card-header"><h3>🎨 Aparência</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Tema Visual</div>
                <div class="config-sub">Personalize a aparência do seu sistema</div>
              </div>
              <select class="form-control config-select" data-action="set-theme">
                ${themeOptionsHtml}
              </select>
            </div>
          </div>
        </div>
        <div class="card config-card">
          <div class="card-header"><h3>⚖️ Calendário</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Visualização padrão</div>
                <div class="config-sub">Modo inicial do calendário</div>
              </div>
              <select class="form-control config-select--narrow" data-action="update-config" data-config-key="visualizacao">
                <option value="mes" ${cfg.visualizacao === 'mes' ? 'selected' : ''}>Mês</option>
                <option value="semana" ${cfg.visualizacao === 'semana' ? 'selected' : ''}>Semana</option>
              </select>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Primeiro dia da semana</div>
              </div>
              <select class="form-control config-select--medium" data-action="update-config" data-config-key="primeirodiaSemana" data-value-type="number">
                <option value="0" ${cfg.primeirodiaSemana === 0 ? 'selected' : ''}>Domingo</option>
                <option value="1" ${cfg.primeirodiaSemana === 1 ? 'selected' : ''}>Segunda-feira</option>
              </select>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Número da semana</div>
              </div>
              <button type="button" class="toggle ${cfg.mostrarNumeroSemana ? 'on' : ''}" aria-pressed="${cfg.mostrarNumeroSemana ? 'true' : 'false'}" aria-label="Mostrar número da semana" data-action="toggle-config" data-config-key="mostrarNumeroSemana"></button>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Agrupar eventos no dia</div>
                <div class="config-sub">Limita quantidade visível</div>
              </div>
              <button type="button" class="toggle ${cfg.agruparEventos ? 'on' : ''}" aria-pressed="${cfg.agruparEventos ? 'true' : 'false'}" aria-label="Agrupar eventos no dia" data-action="toggle-config" data-config-key="agruparEventos"></button>
            </div>
          </div>
        </div>

        <div class="card config-card">
          <div class="card-header"><h3>⏱️ Temporizador</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Foco do Pomodoro (min)</div>
                <div class="config-sub">Tempo ininterrupto de estudo</div>
              </div>
              <input type="number" class="form-control config-input-number" min="1" max="120" value="${cfg.pomodoroFoco || 25}" data-action="update-config" data-config-key="pomodoroFoco" data-value-type="number">
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Pausa do Pomodoro (min)</div>
                <div class="config-sub">Intervalo de descanso</div>
              </div>
              <input type="number" class="form-control config-input-number" min="1" max="60" value="${cfg.pomodoroPausa || 5}" data-action="update-config" data-config-key="pomodoroPausa" data-value-type="number">
            </div>
          </div>
        </div>

        <div class="card config-card">
          <div class="card-header"><h3>📚 Planejamento Diário</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Matérias por dia no Ciclo</div>
                <div class="config-sub">Quantidade de disciplinas distribuídas diariamente no calendário/MED.</div>
              </div>
              <input type="number" class="form-control config-input-number" min="1" max="15" value="${cfg.materiasPorDia || 3}" data-action="update-config" data-config-key="materiasPorDia" data-value-type="number">
            </div>
          </div>
        </div>

        <div class="card config-card">
          <div class="card-header"><h3>🔄 Frequência de Revisão</h3></div>
          <div class="card-body">
            <div class="config-desc">
              Defina em quantos dias após concluir um assunto o programa vai sugerir cada revisão.
            </div>
            <div class="form-group">
              <label class="form-label">Intervalos (em dias, separados por vírgula)</label>
              <input type="text" class="form-control" id="freq-input" value="${(cfg.frequenciaRevisao || [1, 7, 30, 90]).join(', ')}"
                data-action="update-frequencia">
            </div>
            <div class="config-hint">Ex: 1, 7, 30, 90 = 4 revisões no 1º, 7º, 30º e 90º dia</div>
          </div>
        </div>

        ${renderPreferenceNotificationsCard(cfg)}
        ${renderPreferenceDataCard(saveStatus, saveStatusText)}
        ${renderPreferenceServiceWorkerCard()}
        ${renderPreferenceAboutCard()}
      </div>

      <div>
        ${renderQuietSyncCenterCard()}

        ${renderBackupCenterCard()}

      </div>
    </div>
  `;
}

export function setTheme(themeName) {
  const theme = normalizeTheme(themeName, state.config.darkMode);
  state.config.tema = theme;
  state.config.darkMode = true;
  state.config.lastTheme = theme;
  applyTheme();
  scheduleSave();
  renderCurrentView();
}

export function updateConfig(key, value) {
  state.config[key] = value;
  if (key === 'materiasPorDia') {
    syncCicloToEventos();
  }
  scheduleSave();
}

export function toggleConfig(key, el) {
  state.config[key] = !state.config[key];
  el.classList.toggle('on', state.config[key]);
  scheduleSave();
}

export async function toggleCfSync(enabled) {
  if (enabled) {
    const url = document.getElementById('config-cf-url').value.trim();
    const token = document.getElementById('config-cf-token').value.trim();
    if (!url || !token) {
      showToast('Preencha a URL do Worker e o Token antes de ativar.', 'error');
      const checkbox = document.getElementById('config-cf-enabled');
      if (checkbox) checkbox.checked = false;
      return;
    }
    state.config.cfUrl = url;
    state.config.cfToken = token;
  }

  state.config.cfSyncEnabled = enabled;

  if (enabled) {
    showToast('Conectando à nuvem para sincronizar...', 'info');
    forceCloudflareSync().finally(() => {
      scheduleSave();
      renderCurrentView();
    });
  } else {
    scheduleSave();
    renderCurrentView();
  }
}

export function updateFrequencia(value) {
  const nums = value
    .split(',')
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n) && n > 0);
  if (nums.length > 0) {
    state.config.frequenciaRevisao = nums;
    scheduleSave();
  }
}

export function openDriveModal() {
  openModal('modal-drive');
  const savedId = localStorage.getItem('estudo_drive_client_id');
  if (savedId) {
    const input = document.getElementById('drive-client-id');
    if (input) input.value = savedId;
  }
}

export function driveDisconnect() {
  disconnectDrive();
}

export function archiveOldEvents(days = 90) {
  const cutoffStr = cutoffDateStr(days);
  const toArchive = state.eventos.filter(
    (e) => e.status === 'estudei' && e.data && e.data < cutoffStr
  );
  if (toArchive.length === 0) {
    showToast('Nenhum evento para arquivar.', 'info');
    return;
  }
  showConfirm(
    `Arquivar ${toArchive.length} evento(s) concluído(s) com mais de ${days} dias?\n\nEles continuarão no export/backup, mas não aparecerão nos relatórios.`,
    () => {
      state.arquivo = [...(state.arquivo || []), ...toArchive];
      const archiveIds = new Set(toArchive.map((e) => e.id));
      state.eventos = state.eventos.filter((e) => !archiveIds.has(e.id));
      scheduleSave();
      renderCurrentView();
      showToast(`${toArchive.length} evento(s) arquivados.`, 'success');
    },
    { label: 'Arquivar', title: `Arquivar eventos (>${days} dias)` }
  );
}

export function exportData() {
  const blob = new Blob([JSON.stringify(createExportableState(), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `estudo-organizado-backup-${todayStr()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  showToast('Dados exportados!', 'success');
}

export function openRestorePreviewModal(payload = state, options = {}) {
  const modal = document.getElementById('modal-prompt');
  const title = document.getElementById('modal-prompt-title');
  const body = document.getElementById('modal-prompt-body');
  const saveBtn = document.getElementById('modal-prompt-save');
  if (!modal || !title || !body || !saveBtn) {
    showToast('Modal de restauração indisponível.', 'error');
    return false;
  }

  const sourceLabel = options.sourceLabel || 'backup selecionado';
  const impact = previewRestoreImpact(state, payload || {});
  title.textContent = 'Prévia de restauração';
  body.innerHTML = `
    <div class="restore-preview-modal">
      <div class="config-desc">Origem: <strong>${esc(sourceLabel)}</strong>. Revise o impacto antes de substituir os dados locais.</div>
      ${renderRestoreImpactSummary(impact)}
      <div class="restore-preview-warning">
        A restauração pode substituir eventos, editais, hábitos, revisões e configurações locais.
      </div>
      <div class="config-actions-row">
        <button type="button" class="btn btn-ghost btn-sm" data-action="export-data">
          <i class="fa fa-download"></i> Exportar antes de restaurar
        </button>
      </div>
    </div>
  `;
  saveBtn.textContent = options.label || 'Restaurar';
  saveBtn.className = 'btn btn-danger';
  saveBtn.onclick = () => {
    if (typeof options.onConfirm === 'function') {
      options.onConfirm();
    }
  };
  openModal('modal-prompt');
  return true;
}

export function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.className = 'sr-only';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      input.remove();
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (typeof imported !== 'object' || imported === null || Array.isArray(imported)) {
          showToast('Arquivo inválido! O JSON não contém um objeto de dados válido.', 'error');
          return;
        }
        const hasValidStructure =
          (Array.isArray(imported.editais) || imported.editais === undefined) &&
          (Array.isArray(imported.eventos) || imported.eventos === undefined) &&
          (typeof imported.config === 'object' || imported.config === undefined);
        const validation = validateBackupPayload(imported);
        if (!hasValidStructure || !validation.ok) {
          showToast(
            'Arquivo inválido! Este JSON não parece ser um backup do Estudo Organizado.',
            'error'
          );
          return;
        }
        openRestorePreviewModal(imported, {
          sourceLabel: file.name,
          label: 'Importar',
          onConfirm: () => {
            setState(imported);
            runMigrations();
            invalidateDiscCache();
            invalidateDashCaches();
            invalidateRevCache();
            invalidateTodayCache();
            scheduleSave();
            renderCurrentView();
            showToast('Dados importados com sucesso!', 'success');
          },
        });
      } catch {
        showToast(
          'Arquivo inválido! Verifique se é um JSON de backup do Estudo Organizado.',
          'error'
        );
      }
    };
    reader.onloadend = () => {
      input.remove();
    };
    reader.readAsText(file);
  };
  document.body.appendChild(input);
  input.click();
}

function openRemoteRestorePreview(sourceLabel, previewPromise, onConfirm, label) {
  showToast(`Lendo backup ${sourceLabel} para prévia...`, 'info');
  return previewPromise
    .then((payload) => {
      if (!payload || typeof payload !== 'object') {
        showToast(`Nenhum backup valido encontrado em ${sourceLabel}.`, 'error');
        return false;
      }
      return openRestorePreviewModal(payload, {
        sourceLabel,
        label,
        onConfirm,
      });
    })
    .catch((err) => {
      console.error(`Erro ao preparar restore ${sourceLabel}:`, err);
      showToast(`Não foi possível ler o backup ${sourceLabel}.`, 'error');
      return false;
    });
}

export function restoreBackupFromSelectedSource() {
  const source = document.getElementById('backup-restore-source')?.value || 'local';

  if (source === 'local') {
    importData();
    return;
  }

  if (source === 'firestore') {
    if (!state.config?.firestoreSync?.enabled) {
      showToast('Ative o Firestore e entre com Google antes de restaurar por ele.', 'error');
      return;
    }
    return openRemoteRestorePreview(
      'Firestore',
      previewFirestoreRestore(),
      () => pullFromFirestore(true),
      'Restaurar Firestore'
    );
  }

  if (source === 'cloudflare') {
    if (!state.config?.cfSyncEnabled || !state.config?.cfUrl || !state.config?.cfToken) {
      showToast('Configure a sincronização Cloudflare antes de restaurar por ela.', 'error');
      return;
    }
    return openRemoteRestorePreview(
      'Cloudflare',
      previewCloudflareRestore(),
      () => pullFromCloudflare(true),
      'Restaurar Cloudflare'
    );
  }

  if (source === 'drive') {
    if (!state.driveFileId) {
      showToast('Conecte o Google Drive antes de restaurar por ele.', 'error');
      return;
    }
    return openRemoteRestorePreview(
      'Google Drive',
      previewDriveRestore(),
      () => pullFromDrive().catch((err) => console.error('Erro ao restaurar do Drive:', err)),
      'Restaurar Drive'
    );
  }
}

export function clearAllData() {
  showConfirm(
    '⚠️ Apagar TODOS os dados permanentemente?\n\nEditais, eventos, hábitos e configurações serão removidos.\n\nEsta ação é irreversível.',
    () => {
      showConfirm('Última confirmação: isso não pode ser desfeito.', () => clearData(), {
        danger: true,
        label: 'Apagar tudo definitivamente',
        title: '⚠️ Confirmação final',
      });
    },
    { danger: true, label: 'Continuar com exclusão', title: '⚠️ Apagar todos os dados' }
  );
}

// Re-exported from sync-center.js for backward compatibility
export {
  renderBackupCenterCard,
  renderFirestoreConflict,
  _renderFirestoreCard,
  getSyncHealthLabel,
  getSyncHealthIcon,
  renderCloudflareConflict,
  renderEntityConflictPanel,
  renderSyncSourceExtras,
  renderSyncSourceActions,
  renderCloudflareConfigFields,
  buildCurrentSyncCenterModel,
  _renderSyncCenterCard,
  renderQuietSyncCenterCard,
} from './config/sync-center.js?v=8.37';
