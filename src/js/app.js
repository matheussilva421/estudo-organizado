// =============================================
// APP ORCHESTRATOR
// Re-exports from domain sub-modules + init, prompts, ciclo toggle
// =============================================

// ── Domain sub-module imports (also re-exported below) ────────────────
import {
  THEME_OPTIONS,
  normalizeTheme,
  getThemeLabel,
  applyTheme,
} from './app/themes.js';
import {
  openModal,
  closeModal,
  showConfirm,
  setupConfirmHandlers,
  cancelConfirm,
  _confirmCallback,
} from './app/modals.js';
import {
  currentView,
  navigate,
  toggleSidebar,
  closeSidebar,
  toggleSidebarCollapse,
} from './app/navigation.js';
import { showToast } from './app/toast.js';
import {
  getLastSaveStatus,
  renderSaveStatus,
  initSaveStatusIndicator,
} from './app/save-status.js';

// ── Other module imports for orchestrator functions ──────────────────
import { renderCurrentView } from './components.js?v=8.37';
import { initDB, scheduleSave, setState, state } from './store.js?v=8.37';
import { initGoogleAPIs, updateDriveUI } from './drive-sync.js?v=8.37';
import { esc } from './utils.js?v=8.37';
import { initNotifications } from './notifications.js?v=8.37';
import { initFirestoreSync } from './sync/firestore-sync-engine.js?v=8.37';
import { initSyncCoordinator } from './sync/sync-coordinator.js?v=8.37';
import { setHideConcluidosCiclo } from './views/ciclo-view.js?v=8.37';
import { reconcilePrincipalEdital } from './views/editais-crud.js';
import { syncRetaFinalToEventos } from './logic/reta-final.js';
import { reconcileDerivedStateOnBoot } from './app/boot-reconciliation.js';
import { consumeDerivedRecoveryPending } from './store/boot-recovery.js';
import {
  bootstrapConfiguredV1Generation,
  isV1SyncEnabled,
} from './sync/v1-next/bootstrap.js?v=8.37';

// ── Re-exports ────────────────────────────────────────────────────────
export {
  THEME_OPTIONS,
  normalizeTheme,
  getThemeLabel,
  applyTheme,
  openModal,
  closeModal,
  showConfirm,
  setupConfirmHandlers,
  cancelConfirm,
  _confirmCallback,
  currentView,
  navigate,
  toggleSidebar,
  closeSidebar,
  toggleSidebarCollapse,
  showToast,
  getLastSaveStatus,
  renderSaveStatus,
  initSaveStatusIndicator,
};

function gateV1FirstAccess(result) {
  const offline = result.status === 'requires-network';
  const title = offline ? 'Conecte-se para preparar seus dados' : 'Preparação segura indisponível';
  const message = offline
    ? 'A geração verificada será baixada e validada antes de liberar a edição.'
    : 'Não foi possível validar a geração remota. Recarregue a página para tentar novamente.';
  const content = document.getElementById('main-content');
  if (content) {
    content.innerHTML = `
      <section class="v1-first-access" data-v1-sync-gate="${result.status}"
        style="max-width:560px;margin:72px auto;padding:28px;border:1px solid var(--border);border-radius:16px;background:var(--surface);">
        <h2 style="margin-top:0;">${title}</h2>
        <p style="color:var(--text-secondary);line-height:1.6;">${message}</p>
      </section>
    `;
  }
  const topbarTitle = document.getElementById('topbar-title');
  if (topbarTitle) topbarTitle.textContent = 'Preparando dados';
  document.getElementById('sidebar')?.setAttribute('inert', '');
  document.body?.classList?.add('v1-sync-gated');
}

function releaseV1FirstAccess(result) {
  setState(result.state);
  document.getElementById('sidebar')?.removeAttribute?.('inert');
  document.body?.classList?.remove('v1-sync-gated');
}

// ── Initialization ────────────────────────────────────────────────────

/**
 * Inicializa aplicação: DB, tema, sync, navegação
 */
export function init() {
  initDB()
    .then(async () => {
      if (isV1SyncEnabled()) {
        const v1FirstAccess = await bootstrapConfiguredV1Generation();
        if (v1FirstAccess.status !== 'ready') {
          gateV1FirstAccess(v1FirstAccess);
          return;
        }
        releaseV1FirstAccess(v1FirstAccess);
      }

      // Notify modules that state is loaded from IndexedDB
      document.dispatchEvent(new Event('app:stateLoaded'));
      applyTheme();
      initNotifications();
      initSyncCoordinator();
      initFirestoreSync();

      // Restaurar estado da sidebar (collapsed/expanded)
      const sidebarCollapsed = localStorage.getItem('estudo_sidebar_collapsed') === 'true';
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        if (sidebarCollapsed && window.innerWidth > 768) {
          sidebar.classList.add('collapsed');
        } else {
          sidebar.classList.remove('collapsed');
        }
      }

      // Reta Final: rolagem/reconcile no boot — bloco de ontem "empilha" em
      // hoje antes do primeiro render (renderRetaFinal cobre a virada de dia
      // com o app aberto).
      if (consumeDerivedRecoveryPending()) {
        const { syncCicloToEventos } = await import('./logic/cycle.js');
        reconcileDerivedStateOnBoot(state.planejamento, {
          syncCiclo: syncCicloToEventos,
          recoveryPending: true,
        });
      } else if (state.planejamento?.ativo && state.planejamento.tipo === 'reta_final') {
        syncRetaFinalToEventos();
      }

      // Render UI first — user can interact, sync only runs on manual click.
      navigate('home');

      // Modelo de edital principal único: na 1ª abertura após a atualização, se
      // houver mais de um edital ativo, pede ao usuário qual é o principal
      // (uma vez por dispositivo). Não toca em sync — só flags em state.editais.
      reconcilePrincipalEdital();

      // Drive: load Google APIs if a client ID was previously saved, but do
      // NOT trigger any sync. The user starts sync via the manual button.
      updateDriveUI('disconnected', 'Google Drive');
      const savedClientId = localStorage.getItem('estudo_drive_client_id');
      if (savedClientId) {
        initGoogleAPIs();
      }
    })
    .catch((err) => {
      console.error('Falha ao inicializar o aplicativo:', err);
      const content = document.getElementById('main-content');
      if (content) {
        content.innerHTML =
          '<div style="padding:40px;text-align:center;color:var(--danger);"><h2>Erro ao carregar o aplicativo</h2><p>Tente recarregar a página. Se o erro persistir, limpe os dados do navegador.</p></div>';
      }
    });
}

// ── Interactive Prompts ───────────────────────────────────────────────

/**
 * Abre modal para definir data da prova
 */
export function promptDataProva() {
  const atual = state.config.dataProva || '';

  document.getElementById('modal-prompt-title').textContent = 'Data da Prova';
  document.getElementById('modal-prompt-body').innerHTML = `
    <div style="margin-bottom:12px;color:var(--text-secondary);font-size:14px;">Informe a data final para os contadores regressivos.</div>
    <input type="date" id="prompt-input-data" class="form-control" value="${esc(atual)}">
  `;

  const saveBtn = document.getElementById('modal-prompt-save');
  saveBtn.onclick = () => {
    const nova = document.getElementById('prompt-input-data').value;
    if (nova.trim() === '') {
      state.config.dataProva = null;
    } else {
      if (/^\d{4}-\d{2}-\d{2}$/.test(nova)) {
        state.config.dataProva = nova;
      } else {
        showToast('Data inválida.', 'error');
        return;
      }
    }
    scheduleSave();
    if (currentView === 'home') renderCurrentView();
    closeModal('modal-prompt');
  };

  openModal('modal-prompt');
}

/**
 * Abre modal para definir metas semanais
 */
export function promptMetas() {
  const horas = state.config.metas?.horasSemana || 20;
  const quest = state.config.metas?.questoesSemana || 150;

  document.getElementById('modal-prompt-title').textContent = 'Metas da Semana';
  document.getElementById('modal-prompt-body').innerHTML = `
    <div style="margin-bottom:12px;">
      <label class="form-label">Meta de Horas (por semana)</label>
      <input type="number" id="prompt-input-horas" class="form-control" value="${esc(horas)}" min="1" max="168">
    </div>
    <div style="margin-bottom:12px;">
      <label class="form-label">Meta de Questões (por semana)</label>
      <input type="number" id="prompt-input-quest" class="form-control" value="${esc(quest)}" min="1">
    </div>
  `;

  const saveBtn = document.getElementById('modal-prompt-save');
  saveBtn.onclick = () => {
    const h = parseInt(document.getElementById('prompt-input-horas').value, 10);
    const q = parseInt(document.getElementById('prompt-input-quest').value, 10);

    if (!isNaN(h) && !isNaN(q) && h > 0 && q > 0) {
      if (!state.config.metas) state.config.metas = {};
      state.config.metas.horasSemana = h;
      state.config.metas.questoesSemana = q;
      scheduleSave();
      if (currentView === 'home') renderCurrentView();
      closeModal('modal-prompt');
    } else {
      showToast('Valores inválidos. Insira números maiores que 0.', 'error');
    }
  };

  openModal('modal-prompt');
}

// ── Ciclo Toggle ─────────────────────────────────────────────────────

/**
 * Toggle filtro de concluídos no Ciclo
 * @param {boolean} checked - Se true, esconde concluídos
 */
export function toggleCicloFin(checked) {
  setHideConcluidosCiclo(checked);
  if (currentView === 'ciclo') renderCurrentView();
}
