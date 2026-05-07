/**
 * Sync Direction Dialogs
 *
 * Two modals that protect the user from destructive sync mistakes:
 *
 * 1. openDownloadFromSourceDialog — explicit pull from a chosen channel.
 *    Used by the "Baixar dados" button in the Sync Center. Always offers
 *    an auto-export of the current local state before pulling, so a wrong
 *    choice is recoverable from a JSON file.
 *
 * 2. openCfActivationDirectionDialog — when the user activates the
 *    Cloudflare toggle, ask which side is canonical (push, pull, merge)
 *    instead of silently choosing for them.
 */

import { state } from '../../store.js?v=8.37';
import { openModal, closeModal, showToast } from '../../app.js?v=8.37';
import { renderCurrentView } from '../../components.js?v=8.37';
import { esc } from '../../utils.js?v=8.37';
import {
  exportData,
} from './data-management.js?v=8.37';
import {
  pullFromCloudflare,
  pushToCloudflare,
  mergeFromCloudflare,
} from '../../cloud-sync.js?v=8.37';
import {
  pullFromFirestore,
  getFirestoreSyncStatus,
} from '../../sync/firestore-sync-engine.js?v=8.37';
import { pullFromDrive } from '../../drive-sync.js?v=8.37';

// ── helpers ────────────────────────────────────────────────────────────

function formatTs(value) {
  if (!value) return 'nunca';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return String(value);
  }
}

function getSourceMeta() {
  const fs = getFirestoreSyncStatus() || {};
  return {
    firestore: {
      configured: !!fs.configured && !!(fs.signedIn || fs.uid),
      lastAt: fs.remoteUpdatedAt || fs.lastPullAt || fs.lastPushAt || null,
      label: 'Firebase',
    },
    cloudflare: {
      configured: !!(state.config?.cfUrl && state.config?.cfToken),
      lastAt: state.config?.cfRemoteUpdatedAt || state.config?.cfLastSyncAt || null,
      label: 'Cloudflare',
    },
    drive: {
      configured: !!state.driveFileId,
      lastAt: state.lastSync || null,
      label: 'Google Drive',
    },
  };
}

// Auto-export current state to a JSON download. Returns nothing — runs
// fire-and-forget; the user gets the download via their browser. Used as a
// pre-flight safety net before destructive pulls.
function triggerAutoExport(reason) {
  try {
    exportData();
    showToast(`Backup local salvo automaticamente antes de ${reason}.`, 'info');
  } catch (err) {
    console.warn('[sync-dialogs] auto-export failed:', err);
  }
}

function openPromptModal({ title, body, primaryLabel, primaryDanger, onPrimary }) {
  const titleEl = document.getElementById('modal-prompt-title');
  const bodyEl = document.getElementById('modal-prompt-body');
  const saveBtn = document.getElementById('modal-prompt-save');
  if (!titleEl || !bodyEl || !saveBtn) {
    console.error('[sync-dialogs] modal-prompt missing in DOM');
    return;
  }
  titleEl.textContent = title;
  bodyEl.innerHTML = body;
  saveBtn.textContent = primaryLabel;
  saveBtn.className = `btn btn-sm ${primaryDanger ? 'btn-danger' : 'btn-primary'}`;
  saveBtn.onclick = async () => {
    closeModal('modal-prompt');
    try {
      await onPrimary();
    } catch (err) {
      console.error('[sync-dialogs] primary action failed:', err);
      showToast('Erro: ' + (err?.message || 'desconhecido'), 'error');
    }
  };
  openModal('modal-prompt');
}

// ── 1. Baixar dados de uma fonte ───────────────────────────────────────

export function openDownloadFromSourceDialog() {
  const sources = getSourceMeta();
  const eligible = Object.entries(sources).filter(([, m]) => m.configured);
  if (eligible.length === 0) {
    showToast('Nenhum canal configurado para baixar dados.', 'info');
    return;
  }
  const localCount = (state.eventos || []).length;

  const optionsHtml = eligible
    .map(([key, meta], idx) => {
      const checked = idx === 0 ? 'checked' : '';
      return `
        <label class="sync-direction-option">
          <input type="radio" name="download-source" value="${esc(key)}" ${checked}>
          <div class="sync-direction-option-body">
            <div class="sync-direction-option-title">${esc(meta.label)}</div>
            <div class="sync-direction-option-meta">Última atualização: ${esc(formatTs(meta.lastAt))}</div>
          </div>
        </label>
      `;
    })
    .join('');

  const body = `
    <div class="config-desc" style="margin-bottom:12px;">
      Escolha de qual canal baixar os dados. Esta operação <strong>substitui</strong>
      seus ${localCount} evento(s) locais pelos dados remotos.
    </div>
    <div class="sync-direction-options">
      ${optionsHtml}
    </div>
    <label class="sync-direction-checkbox" style="margin-top:14px;display:flex;gap:8px;align-items:flex-start;">
      <input type="checkbox" id="download-auto-export" checked>
      <span>
        <strong>Salvar backup local antes (recomendado)</strong>
        <div class="config-sub">Exporta um JSON dos seus dados atuais antes de substituir. Se algo der errado, você pode restaurar pelo arquivo.</div>
      </span>
    </label>
  `;

  openPromptModal({
    title: 'Baixar dados',
    body,
    primaryLabel: 'Baixar e substituir',
    primaryDanger: true,
    onPrimary: async () => {
      const selected = document.querySelector(
        'input[name="download-source"]:checked'
      );
      const sourceKey = selected?.value;
      const wantsAutoExport = document.getElementById('download-auto-export')?.checked !== false;
      if (!sourceKey) {
        showToast('Selecione uma origem.', 'error');
        return;
      }
      if (wantsAutoExport) triggerAutoExport(`baixar do ${sources[sourceKey].label}`);
      await runPullFromSource(sourceKey);
      renderCurrentView();
    },
  });
}

async function runPullFromSource(sourceKey) {
  showToast(`Baixando dados...`, 'info');
  switch (sourceKey) {
    case 'firestore':
      await pullFromFirestore(true);
      break;
    case 'cloudflare':
      await pullFromCloudflare(true);
      break;
    case 'drive':
      await pullFromDrive();
      break;
    default:
      throw new Error('Origem desconhecida: ' + sourceKey);
  }
}

// ── 2. Direção na ativação do Cloudflare ───────────────────────────────

export function openCfActivationDirectionDialog({ onCancel } = {}) {
  const localCount = (state.eventos || []).length;
  const cfLastAt = state.config?.cfRemoteUpdatedAt || state.config?.cfLastSyncAt || null;
  const lastSummary = cfLastAt
    ? `O Cloudflare tem um snapshot de ${formatTs(cfLastAt)}.`
    : 'O Cloudflare ainda não tem nenhum snapshot.';

  const body = `
    <div class="config-desc" style="margin-bottom:14px;">
      Você tem <strong>${localCount} evento(s)</strong> locais. ${esc(lastSummary)}
    </div>
    <div class="sync-direction-options">
      <label class="sync-direction-option">
        <input type="radio" name="cf-direction" value="push" checked>
        <div class="sync-direction-option-body">
          <div class="sync-direction-option-title">⬆️ Enviar meus dados locais</div>
          <div class="sync-direction-option-meta">Substitui o snapshot do Cloudflare pelos seus dados atuais. Use se este dispositivo está mais atualizado.</div>
        </div>
      </label>
      <label class="sync-direction-option">
        <input type="radio" name="cf-direction" value="pull" ${cfLastAt ? '' : 'disabled'}>
        <div class="sync-direction-option-body">
          <div class="sync-direction-option-title">⬇️ Baixar do Cloudflare</div>
          <div class="sync-direction-option-meta">Substitui os dados deste dispositivo pelo snapshot remoto. Use se o Cloudflare está mais atualizado.${cfLastAt ? '' : ' <em>(snapshot remoto vazio — desabilitado)</em>'}</div>
        </div>
      </label>
      <label class="sync-direction-option">
        <input type="radio" name="cf-direction" value="merge" ${cfLastAt ? '' : 'disabled'}>
        <div class="sync-direction-option-body">
          <div class="sync-direction-option-title">🔀 Mesclar (timestamp por item)</div>
          <div class="sync-direction-option-meta">Combina os dois lados, mantendo a versão mais recente de cada item. Pode ressuscitar itens deletados.${cfLastAt ? '' : ' <em>(snapshot remoto vazio — desabilitado)</em>'}</div>
        </div>
      </label>
    </div>
    <label class="sync-direction-checkbox" style="margin-top:14px;display:flex;gap:8px;align-items:flex-start;">
      <input type="checkbox" id="cf-activation-auto-export" checked>
      <span>
        <strong>Salvar backup local antes (recomendado)</strong>
        <div class="config-sub">Exporta um JSON dos seus dados atuais antes da operação.</div>
      </span>
    </label>
  `;

  // Override the Cancelar button to revert the toggle UI state if needed.
  const closeBtn = document.querySelector(
    '#modal-prompt [data-action="close-modal"][data-modal="modal-prompt"]'
  );
  const onCancelHandler = () => {
    if (typeof onCancel === 'function') onCancel();
  };
  if (closeBtn) closeBtn.addEventListener('click', onCancelHandler, { once: true });
  // Top-right close button too
  const topCloseBtn = document.querySelector(
    '#modal-prompt .modal-close[data-modal="modal-prompt"]'
  );
  if (topCloseBtn) topCloseBtn.addEventListener('click', onCancelHandler, { once: true });

  openPromptModal({
    title: 'Ativar Cloudflare',
    body,
    primaryLabel: 'Confirmar',
    primaryDanger: false,
    onPrimary: async () => {
      const selected = document.querySelector('input[name="cf-direction"]:checked');
      const direction = selected?.value;
      const wantsAutoExport =
        document.getElementById('cf-activation-auto-export')?.checked !== false;
      if (!direction) {
        showToast('Selecione uma direção.', 'error');
        return;
      }
      if (wantsAutoExport) triggerAutoExport(`ativar Cloudflare (${direction})`);
      await runCfActivation(direction);
      renderCurrentView();
    },
  });
}

async function runCfActivation(direction) {
  switch (direction) {
    case 'push': {
      showToast('Enviando dados locais para o Cloudflare...', 'info');
      const ok = await pushToCloudflare(true);
      showToast(
        ok ? 'Cloudflare atualizado com seus dados locais.' : 'Falha ao enviar.',
        ok ? 'success' : 'error'
      );
      break;
    }
    case 'pull': {
      showToast('Baixando dados do Cloudflare...', 'info');
      const ok = await pullFromCloudflare(true);
      showToast(
        ok ? 'Dados baixados do Cloudflare.' : 'Falha ao baixar.',
        ok ? 'success' : 'error'
      );
      break;
    }
    case 'merge': {
      showToast('Mesclando dados locais com Cloudflare...', 'info');
      const ok = await mergeFromCloudflare();
      showToast(
        ok ? 'Cloudflare mesclado com sucesso.' : 'Falha ao mesclar.',
        ok ? 'success' : 'error'
      );
      break;
    }
    default:
      throw new Error('Direção desconhecida: ' + direction);
  }
}

// Re-exports for backwards-compat / tests
export { runPullFromSource, runCfActivation, triggerAutoExport };
