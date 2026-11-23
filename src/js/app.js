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
import { ensureDB, initDB, saveStateToDB, saveTimeout, scheduleSave, setState, state } from './store.js?v=8.37';
import { initGoogleAPIs, updateDriveUI } from './drive-sync.js?v=8.37';
import { esc } from './utils.js?v=8.37';
import { initNotifications } from './notifications.js?v=8.37';
import { initFirestoreSync } from './sync/firestore-sync-engine.js?v=8.37';
import { initSyncCoordinator } from './sync/sync-coordinator.js?v=8.37';
import { resumeV1SyncForUser, startV1Sync, stopV1Sync, suspendV1SyncForAuth } from './sync/v1-next/worker.js';
import { setHideConcluidosCiclo } from './views/ciclo-view.js?v=8.37';
import { reconcilePrincipalEdital } from './views/editais-crud.js';
import { syncRetaFinalToEventos } from './logic/reta-final.js';
import { reconcileDerivedStateOnBoot } from './app/boot-reconciliation.js';
import { consumeDerivedRecoveryPending } from './store/boot-recovery.js';
import {
  bootstrapConfiguredV1Generation,
  isV1AuthFailure,
  isV1SyncEnabled,
  runV1FirstAccessLifecycle,
} from './sync/v1-next/bootstrap.js?v=8.37';
import { initFirebaseServices, observeFirebaseAuth } from './firebase/firebase-client.js?v=8.37';
import { wireFirestores } from './sync/v1-next/remote.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from '../vendor/firebase-client.bundle.js?v=8.37';

const V1_FIRESTORE_SDK = Object.freeze({
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  runTransaction,
  serverTimestamp,
});

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

let v1GenerationBlocked = false;

function setV1GateLocked(locked) {
  const inertNodes = [
    document.getElementById('sidebar'),
    document.querySelector?.('.topbar'),
    ...(document.querySelectorAll?.('.modal-overlay') || []),
  ].filter(Boolean);
  for (const node of inertNodes) {
    if (locked) node.setAttribute?.('inert', '');
    else node.removeAttribute?.('inert');
  }
  const main = document.getElementById('main');
  if (main) main.setAttribute('aria-busy', locked ? 'true' : 'false');
  if (locked) document.body?.classList?.add('v1-sync-gated');
  else document.body?.classList?.remove('v1-sync-gated');
}

function gateV1FirstAccess(result) {
  const status = result?.status || 'blocked';
  const preparing = status === 'preparing';
  const offline = status === 'requires-network';
  const needsLogin = result?.reason === 'V1_AUTH_REQUIRED' || isV1AuthFailure(result?.reason);
  const title = preparing
    ? 'Preparando seus dados'
    : offline
      ? 'Conecte-se para preparar seus dados'
      : 'Preparação segura indisponível';
  const message = preparing
    ? 'Validando a sessão e a geração antes de liberar a edição.'
    : offline
      ? 'A geração verificada será baixada e validada antes de liberar a edição.'
      : 'Não foi possível validar a geração remota. Recarregue a página para tentar novamente.';
  if (status === 'blocked') v1GenerationBlocked = true;
  const content = document.getElementById('main-content');
  if (content) {
    content.innerHTML = `
      <section class="v1-first-access" data-v1-sync-gate="${status}"
        role="status" aria-live="polite"
        style="max-width:560px;margin:72px auto;padding:28px;border:1px solid var(--border);border-radius:16px;background:var(--surface);">
        <h2 style="margin-top:0;">${title}</h2>
        <p style="color:var(--text-secondary);line-height:1.6;">${needsLogin ? 'Entre com sua conta Google para carregar os dados desta conta.' : message}</p>
        ${needsLogin ? '<button type="button" class="btn btn-primary" data-action="firestore-sign-in">Entrar com Google</button>' : ''}
      </section>
    `;
  }
  const topbarTitle = document.getElementById('topbar-title');
  if (topbarTitle) topbarTitle.textContent = 'Preparando dados';
  setV1GateLocked(true);
}

function releaseV1FirstAccess() {
  if (v1GenerationBlocked) return;
  setV1GateLocked(false);
}

// ── Initialization ────────────────────────────────────────────────────

async function completeInitialization(options = {}) {
  if (v1GenerationBlocked) return;

  // Notify modules that state is loaded from IndexedDB
  document.dispatchEvent(new Event('app:stateLoaded'));
  applyTheme();
  initNotifications();
  initSyncCoordinator();
  if (options.v1Context) {
    void startV1Sync({
      ...options.v1Context,
      remoteApi: options.runtimeRemoteApi,
    }).catch((error) => {
      console.error('Falha ao iniciar worker V1:', error);
    });
  } else {
    initFirestoreSync();
  }

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

  if (v1GenerationBlocked) return;
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
}

function showInitializationError(err) {
  console.error('Falha ao inicializar o aplicativo:', err);
  const content = document.getElementById('main-content');
  if (content) {
    content.innerHTML =
      '<div style="padding:40px;text-align:center;color:var(--danger);"><h2>Erro ao carregar o aplicativo</h2><p>Tente recarregar a página. Se o erro persistir, limpe os dados do navegador.</p></div>';
  }
}

/**
 * Inicializa aplicação: gate seguro, DB, tema, sync e navegação.
 */
export function init(options = {}) {
  const v1Enabled = options.v1Enabled ?? isV1SyncEnabled({
    windowRef: options.windowRef,
    storage: options.storage,
  });
  if (!v1Enabled) {
    return initDB().then(completeInitialization).catch(showInitializationError);
  }

  let session = 0;
  let lastUid;
  let boot;
  function onAuthChange(user, initialUid) {
    const uid = user?.uid ?? null;
    if (uid === (lastUid === undefined ? initialUid : lastUid)) {
      if (uid) Promise.resolve(resumeV1SyncForUser(uid)).catch(showInitializationError);
      return;
    }
    lastUid = uid;
    const version = ++session;
    gateV1FirstAccess({ status: 'blocked', reason: uid ? null : 'V1_AUTH_REQUIRED' });
    // Capture a debounced edit under the departing identity before clearing its context.
    const saved = saveTimeout ? saveStateToDB() : Promise.resolve();
    stopV1Sync();
    setState({});
    boot = Promise.all([boot, saved]).then(() => {
      if (version !== session) return;
      stopV1Sync();
      if (uid) return openSession(version, user);
    }).catch(showInitializationError);
  }

  function openSession(version, authUser) {
    v1GenerationBlocked = false;
    let authFailure;
    return runV1FirstAccessLifecycle({
      gate: result => { if (version === session) gateV1FirstAccess(result); },
      openStorage: ensureDB,
      prepare: () => bootstrapConfiguredV1Generation({
        windowRef: options.windowRef,
        storage: options.storage,
        initFirebaseServices: options.initFirebaseServices || initFirebaseServices,
        wireFirestores: options.wireFirestores || wireFirestores,
        firestoreSdk: options.firestoreSdk || V1_FIRESTORE_SDK,
        observeFirebaseAuth: options.observeFirebaseAuth || observeFirebaseAuth,
        authUser,
        onAuthChange,
        remoteApi: options.remoteApi,
        online: options.online,
        local: options.local,
        onBackgroundResult: result => {
          if (version !== session) return;
          if (isV1AuthFailure(result.reason)) {
            authFailure = result.reason;
            suspendV1SyncForAuth(authFailure);
          } else if (result.status === 'blocked') {
            gateV1FirstAccess(result);
          }
        },
      }),
      initDB: () => initDB({ loadState: false }),
      applyState: nextState => { if (version === session) setState(nextState); },
      release: () => { if (version === session) releaseV1FirstAccess(); },
    }).then(result => {
      if (result?.status !== 'ready' || version !== session || v1GenerationBlocked) return;
      return completeInitialization({
        v1Context: { uid: result.uid, generationId: result.generationId, authFailure },
        runtimeRemoteApi: result.runtimeRemoteApi || options.remoteApi,
      });
    });
  }
  boot = openSession(session).catch(showInitializationError);
  return boot;
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
