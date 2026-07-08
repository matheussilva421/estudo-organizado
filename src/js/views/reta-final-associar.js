/**
 * Reta Final — picker "Associar sessão do histórico"
 * Reusa o #modal-prompt (padrão de openSubstitutionPrompt em
 * registro-sessao/session-save.js, inclusive a restauração do rótulo do botão
 * salvar ao fechar): lista sessões estudadas da disciplina do bloco ainda sem
 * vínculo e associa a escolhida via associateHistoryEventToBloco — a data real
 * da sessão é preservada.
 */

import { esc } from '../utils.js?v=8.37';
import { state } from '../store.js?v=8.37';
import { invalidateDashCaches } from '../logic.js?v=8.37';
import { closeModal, openModal, showToast } from '../app.js?v=8.37';
import { renderCurrentView } from '../components.js?v=8.37';
import { listAssociableHistoryEvents } from '../logic/reta-final-core.js';
import { associateHistoryEventToBloco } from '../logic/reta-final.js';

function formatBrDate(dateStr) {
  const [year, month, day] = String(dateStr || '').split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

/**
 * Abre o picker de associação para um bloco pendente.
 * @returns {boolean} true se o modal abriu
 */
export function openAssociarHistorico(blocoId) {
  const bloco = (state.planejamento?.retaFinal?.blocos || []).find((b) => b?.id === blocoId);
  if (!bloco) return false;

  const titleEl = document.getElementById('modal-prompt-title');
  const bodyEl = document.getElementById('modal-prompt-body');
  const saveBtn = document.getElementById('modal-prompt-save');
  if (!titleEl || !bodyEl || !saveBtn) return false;

  titleEl.textContent = 'Associar sessão do histórico';
  saveBtn.textContent = 'Fechar';

  // O modal-prompt é compartilhado: cancelar/fechar sem escolher precisa
  // devolver o rótulo padrão do botão salvar.
  const cancelButtons = Array.from(
    document.querySelectorAll('#modal-prompt [data-action="close-modal"]')
  );
  const restoreSaveLabel = () => {
    saveBtn.textContent = 'Salvar';
    cancelButtons.forEach((btn) => btn.removeEventListener('click', restoreSaveLabel));
  };
  cancelButtons.forEach((btn) => btn.addEventListener('click', restoreSaveLabel));

  const candidates = listAssociableHistoryEvents(state.eventos, bloco);
  if (candidates.length === 0) {
    bodyEl.innerHTML = `
      <div class="modal-note">
        Nenhuma sessão estudada desta disciplina disponível.
      </div>
    `;
  } else {
    const items = candidates
      .map(
        (ev) => `
          <button type="button" class="btn btn-ghost w-full text-left" data-associar-evento-id="${esc(ev.id)}">
            ${esc(formatBrDate(ev.dataEstudo || ev.data))} — ${esc(ev.titulo || 'Sessão de estudo')}
          </button>
        `
      )
      .join('');
    bodyEl.innerHTML = `
      <div class="modal-note mb-3">
        Escolha a sessão já estudada que conclui este bloco. A data real da sessão é preservada.
      </div>
      <div class="stack-sm">${items}</div>
    `;
  }

  bodyEl.querySelectorAll('[data-associar-evento-id]').forEach((button) => {
    button.addEventListener('click', () => {
      closeModal('modal-prompt');
      restoreSaveLabel();
      if (!associateHistoryEventToBloco(blocoId, button.dataset.associarEventoId)) {
        showToast('Não foi possível associar esta sessão.', 'error');
        return;
      }
      invalidateDashCaches();
      renderCurrentView();
      showToast('Sessão associada — bloco concluído com a data real do estudo.', 'success');
    });
  });

  saveBtn.onclick = () => {
    closeModal('modal-prompt');
    restoreSaveLabel();
  };

  openModal('modal-prompt');
  return true;
}
