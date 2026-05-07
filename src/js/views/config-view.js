/**
 * Config View
 * Settings page rendering and configuration helpers
 */

import {
  THEME_OPTIONS,
  normalizeTheme,
  showToast,
  openModal,
  getLastSaveStatus,
} from '../app.js?v=8.37';
import { esc } from '../utils.js?v=8.37';
import {
  scheduleSave,
  state,
} from '../store.js?v=8.37';

import { renderCurrentView } from '../components.js?v=8.37';
import {
  forceCloudflareSync,
  pushToCloudflare,
} from '../cloud-sync.js?v=8.37';
import { disconnectDrive } from '../drive-sync.js?v=8.37';
import { openCfActivationDirectionDialog } from './config/sync-dialogs.js?v=8.37';
import {
  archiveOldEvents,
  clearAllData,
  exportData,
  importData,
  openRestorePreviewModal,
  restoreBackupFromSelectedSource,
} from './config/data-management.js?v=8.37';
import {
  renderBackupRestoreCard,
  renderBackupCenterCard,
  renderAdvancedCard,
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
import {
  renderPreferenceNotificationsCard,
  setTheme,
  updateConfig,
  toggleConfig,
  updateFrequencia,
} from './config/theme-settings.js?v=8.37';

export function renderConfig(el) {
  const cfg = state.config;
  // saveStatus / saveStatusText kept for parity with backwards-compat callers,
  // but the unified Backup & Restauração card no longer renders them inline.
  void getLastSaveStatus;
  void esc;
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
          <div class="card-header"><h3>📅 Calendário &amp; Estudos</h3></div>
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
            <div class="config-row">
              <div>
                <div class="config-label">Matérias por dia no Ciclo</div>
                <div class="config-sub">Quantidade de disciplinas distribuídas diariamente no calendário/MED</div>
              </div>
              <input type="number" class="form-control config-input-number" min="1" max="15" value="${cfg.materiasPorDia || 3}" data-action="update-config" data-config-key="materiasPorDia" data-value-type="number">
            </div>
          </div>
        </div>

        <div class="card config-card">
          <div class="card-header"><h3>🔁 Revisões</h3></div>
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

        ${renderPreferenceNotificationsCard(cfg)}
      </div>

      <div>
        ${renderQuietSyncCenterCard()}

        ${renderBackupRestoreCard()}

        ${renderAdvancedCard()}
      </div>
    </div>
  `;
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
    // Activation can mean different intents: this device is canonical (push),
    // remote is canonical (pull), or both have valid changes (merge). Asking
    // explicitly avoids data loss in any direction. The dialog also offers
    // an auto-export before applying — recoverable if the user picks wrong.
    scheduleSave();
    openCfActivationDirectionDialog({
      onCancel: () => {
        // User dismissed without choosing: revert toggle and persist.
        state.config.cfSyncEnabled = false;
        const checkbox = document.getElementById('config-cf-enabled');
        if (checkbox) checkbox.checked = false;
        scheduleSave();
        renderCurrentView();
      },
    });
  } else {
    scheduleSave();
    renderCurrentView();
  }
}
// Imported but kept for backwards-compat with callers outside this file.
void forceCloudflareSync;
void pushToCloudflare;

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

// Re-exported from data-management.js for backward compatibility
export {
  archiveOldEvents,
  clearAllData,
  exportData,
  importData,
  openRestorePreviewModal,
  restoreBackupFromSelectedSource,
} from './config/data-management.js?v=8.37';

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

// Re-exported from theme-settings.js for backward compatibility
export {
  setTheme,
  updateConfig,
  toggleConfig,
  updateFrequencia,
} from './config/theme-settings.js?v=8.37';
