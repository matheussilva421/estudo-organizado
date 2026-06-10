// =============================================
// MODAL MANAGEMENT
// =============================================
// openModal/closeModal vivem em ui/dialog.js (controller único: pilha, focus
// trap e restauração de foco por modal). Re-exportados aqui para os
// consumidores de app.js continuarem funcionando sem mudança.

import { openModal, closeModal } from '../ui/dialog.js?v=8.37';
export { openModal, closeModal };

// Custom Confirm

/**
 * Exibe modal de confirmação customizado
 * @param {string} msg - Mensagem de confirmação
 * @param {Function} onYes - Callback ao confirmar
 * @param {{title?: string, label?: string, danger?: boolean}} [opts] - Opções
 */
export let _confirmCallback = null;
export function showConfirm(msg, onYes, opts = {}) {
  const { title = 'Confirmar', label = 'Confirmar', danger = false } = opts;
  const titleEl = document.getElementById('confirm-title');
  const msgEl = document.getElementById('confirm-msg');
  const okBtn = document.getElementById('confirm-ok-btn');

  if (!titleEl || !msgEl || !okBtn) {
    console.error('showConfirm: elementos do modal não encontrados');
    return;
  }

  titleEl.textContent = title;
  msgEl.textContent = msg;
  okBtn.textContent = label;
  okBtn.className = `btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`;
  _confirmCallback = onYes;
  openModal('modal-confirm');
}

/**
 * Configura handlers dos botões de confirmação
 */
export function setupConfirmHandlers() {
  const okBtn = document.getElementById('confirm-ok-btn');
  const cancelBtn = document.getElementById('confirm-cancel-btn');
  if (okBtn)
    okBtn.addEventListener('click', () => {
      closeModal('modal-confirm');
      if (_confirmCallback) {
        const cb = _confirmCallback;
        _confirmCallback = null;
        cb();
      }
    });
  if (cancelBtn)
    cancelBtn.addEventListener('click', () => {
      cancelConfirm();
    });
}

/**
 * Cancela confirmação e fecha modal
 */
export function cancelConfirm() {
  _confirmCallback = null;
  closeModal('modal-confirm');
}
