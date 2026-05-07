import { applyTheme, normalizeTheme } from '../../app.js?v=8.37';
import { scheduleSave, state } from '../../store.js?v=8.37';
import { syncCicloToEventos } from '../../logic.js?v=8.37';
import { renderCurrentView } from '../../components.js?v=8.37';

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

// Note: renderPreferenceDataCard, renderPreferenceServiceWorkerCard and
// renderPreferenceAboutCard were removed in the Configurações refactor.
// Their responsibilities are now in:
//   - renderBackupRestoreCard (sync-center.js): export/import/restore
//   - renderAdvancedCard (sync-center.js): archive, SW cache, clear-all
//   - "Sobre" card was removed entirely.

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
