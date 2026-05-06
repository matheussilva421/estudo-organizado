import { esc } from '../../utils.js?v=8.37';
import { THEME_OPTIONS, applyTheme, normalizeTheme } from '../../app.js?v=8.37';
import { scheduleSave, state } from '../../store.js?v=8.37';
import { syncCicloToEventos } from '../../logic.js?v=8.37';
import { renderCurrentView } from '../../components.js?v=8.37';
import { formatBackupDateTime } from './backup-settings.js?v=8.37';

export function renderPreferenceNotificationsCard(cfg) {
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

export function renderPreferenceDataCard(saveStatus, saveStatusText) {
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

export function renderPreferenceServiceWorkerCard() {
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

export function renderPreferenceAboutCard() {
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
