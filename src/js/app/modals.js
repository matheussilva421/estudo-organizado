// =============================================
// MODAL MANAGEMENT
// =============================================

// Foco de origem por modal: devolvido no closeModal (teclado/leitores de tela).
const _lastFocusedByModal = new Map();

/**
 * Abre modal pelo ID
 * @param {string} id - ID do elemento modal
 */
export function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const active = document.activeElement;
  if (active && active !== document.body && !el.contains(active)) {
    _lastFocusedByModal.set(id, active);
  }
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

/**
 * Fecha modal pelo ID
 * @param {string} id - ID do elemento modal
 */
export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.contains(document.activeElement)) document.activeElement.blur();
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
  const hasOpenModal = document.querySelector('.modal-overlay.open');
  document.body.style.overflow = hasOpenModal ? 'hidden' : '';

  const last = _lastFocusedByModal.get(id);
  _lastFocusedByModal.delete(id);
  // Re-renders podem ter removido o elemento de origem; só restaura se vivo.
  if (last && typeof last.focus === 'function' && document.contains(last)) {
    last.focus();
  }
}

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
