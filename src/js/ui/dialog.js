/**
 * Dialog/Modal Controller — controller único de modais do app
 * - contrato visual por classe `.open` (CSS de .modal-overlay)
 * - pilha de modais aninhados
 * - focus trap (Tab/Shift+Tab cicla dentro do modal)
 * - restauração de foco por modal (devolve a quem abriu)
 * - ARIA (aria-hidden, anúncio de abertura via #aria-announcer)
 *
 * Escape NÃO é tratado aqui: o handler global de teclado (ui/search.js) é o
 * dono do Escape, pois conhece o caso especial do modal-confirm
 * (cancelConfirm limpa o callback pendente). Tratar Escape por modal aqui
 * causaria fechamento duplo com modais empilhados.
 *
 * app/modals.js re-exporta openModal/closeModal daqui — os consumidores
 * continuam importando de app.js sem mudança.
 */

import { debugLog } from '../debug.js?v=8.37';

// Pilha de modais abertos (para foco do nível anterior e scroll do body)
const modalStack = [];

// Foco de origem por modal: devolvido no closeModal (teclado/leitores de tela)
const lastFocusedByModal = new Map();

// Focusable elements selector
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Get all focusable elements within a container.
 * Não usa offsetParent: ele é null em overlays position:fixed (e no jsdom),
 * o que esvaziaria a lista; display/visibility computados cobrem o essencial.
 */
function getFocusableElements(container) {
  if (typeof container.querySelectorAll !== 'function') return [];
  const elements = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return elements;
  }
  return elements.filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

/**
 * Trap focus within a modal (Tab cycles through focusable elements)
 */
function trapFocus(e, container) {
  if (e.key !== 'Tab') return;

  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    }
  } else {
    if (document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
}

/**
 * Abre modal pelo ID
 * @param {string} modalId - ID do elemento modal
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const active = document.activeElement;
  if (active && active !== document.body && !modal.contains?.(active)) {
    lastFocusedByModal.set(modalId, active);
  }
  if (!modalStack.includes(modalId)) modalStack.push(modalId);

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Focus trap por modal (removido no closeModal)
  if (!modal._dialogHandlers) {
    const handleTab = (e) => trapFocus(e, modal);
    modal.addEventListener('keydown', handleTab);
    modal._dialogHandlers = { handleTab };
  }

  // Move o foco para dentro do modal, sem roubar foco que o app já tenha
  // posicionado (vários modais focam um input específico ao abrir). O timer é
  // cancelado no closeModal (e guardado contra teardown de ambiente de teste).
  modal._dialogFocusTimer = setTimeout(() => {
    modal._dialogFocusTimer = null;
    if (typeof document === 'undefined') return;
    if (modal.contains?.(document.activeElement)) return;
    const focusableElements = getFocusableElements(modal);
    if (focusableElements.length > 0) focusableElements[0].focus();
  }, 50);

  // Anuncia a abertura para leitores de tela
  const title = modal.querySelector?.('[id$="-title"]');
  if (title?.textContent) {
    announce(`Janela modal aberta: ${title.textContent}`);
  }
}

/**
 * Fecha modal pelo ID
 * @param {string} modalId - ID do elemento modal
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const index = modalStack.indexOf(modalId);
  if (index > -1) modalStack.splice(index, 1);

  if (modal.contains?.(document.activeElement)) document.activeElement.blur();
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');

  if (modal._dialogHandlers) {
    modal.removeEventListener('keydown', modal._dialogHandlers.handleTab);
    delete modal._dialogHandlers;
  }
  if (modal._dialogFocusTimer) {
    clearTimeout(modal._dialogFocusTimer);
    modal._dialogFocusTimer = null;
  }

  // Consulta o DOM (e não só a pilha) para tolerar open/close desbalanceados.
  const hasOpenModal = document.querySelector?.('.modal-overlay.open');
  document.body.style.overflow = hasOpenModal ? 'hidden' : '';

  const last = lastFocusedByModal.get(modalId);
  lastFocusedByModal.delete(modalId);
  // Re-renders podem ter removido o elemento de origem; só restaura se vivo.
  if (last && typeof last.focus === 'function' && document.contains?.(last)) {
    last.focus();
  }
}

/**
 * Initialize all modals with proper ARIA attributes
 * Should be called once on app initialization
 */
export function initModals() {
  const modals = document.querySelectorAll('[id^="modal-"]');

  modals.forEach((modal) => {
    // Set ARIA attributes
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');

    // Find title and set aria-labelledby
    const title = modal.querySelector('[id*="-title"]');
    if (title && !modal.hasAttribute('aria-labelledby')) {
      modal.setAttribute('aria-labelledby', title.id);
    }
  });

  debugLog('ui', '[dialog.js] Modals initialized with ARIA attributes');
}

/**
 * Announce message to screen readers
 */
export function announce(message, priority = 'polite') {
  const announcer = document.getElementById('aria-announcer');
  if (!announcer) return;

  announcer.setAttribute('aria-live', priority);
  announcer.textContent = '';

  // Force reflow
  void announcer.offsetHeight;

  announcer.textContent = message;
}

export default {
  openModal,
  closeModal,
  initModals,
  announce,
};
