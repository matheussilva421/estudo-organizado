/**
 * Dialog/Modal Controller with Accessibility Support
 * - Focus trap
 * - ESC key handling
 * - ARIA attributes management
 * - Focus restoration
 */

import { debugLog } from '../debug.js';

// Stack for nested modals
const modalStack = [];

// Track previously focused element
let lastFocusedElement = null;

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
 * Get all focusable elements within a container
 */
function getFocusableElements(container) {
  const elements = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
  return elements.filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
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
    // Shift + Tab
    if (document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    }
  } else {
    // Tab
    if (document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
}

/**
 * Handle keyboard events for modal (ESC to close)
 */
function handleKeydown(e, modalId) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeModal(modalId);
  }
}

/**
 * Open a modal with accessibility features
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    console.warn(`[dialog.js] Modal "${modalId}" not found`);
    return;
  }

  // Store last focused element for restoration
  if (modalStack.length === 0) {
    lastFocusedElement = document.activeElement;
  }

  // Add to stack
  modalStack.push(modalId);

  // Show modal
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');

  // Lock body scroll only when first modal opens
  if (modalStack.length === 1) {
    document.body.style.overflow = 'hidden';
  }

  // Setup keyboard handlers
  const handleEscape = (e) => handleKeydown(e, modalId);
  const handleTab = (e) => trapFocus(e, modal);

  modal.addEventListener('keydown', handleEscape);
  modal.addEventListener('keydown', handleTab);

  // Store handlers for cleanup
  modal._dialogHandlers = { handleEscape, handleTab };

  // Focus first focusable element
  setTimeout(() => {
    const focusableElements = getFocusableElements(modal);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      // If no focusable elements, make modal itself focusable
      modal.setAttribute('tabindex', '-1');
      modal.focus();
    }
  }, 50);

  // Announce to screen readers
  const title = modal.querySelector('[id$="-title"]');
  if (title) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = `Janela modal aberta: ${title.textContent}`;
    modal.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
  }
}

/**
 * Close a modal with accessibility features
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  // Remove from stack
  const index = modalStack.indexOf(modalId);
  if (index > -1) {
    modalStack.splice(index, 1);
  }

  // Hide modal
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');

  // Cleanup handlers
  if (modal._dialogHandlers) {
    const { handleEscape, handleTab } = modal._dialogHandlers;
    modal.removeEventListener('keydown', handleEscape);
    modal.removeEventListener('keydown', handleTab);
    delete modal._dialogHandlers;
  }

  // Restore body scroll if no more modals
  if (modalStack.length === 0) {
    document.body.style.overflow = '';

    // Restore focus to last focused element if still in DOM
    if (
      lastFocusedElement &&
      typeof lastFocusedElement.focus === 'function' &&
      document.body.contains(lastFocusedElement)
    ) {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
  } else {
    // Focus next modal in stack
    const previousModalId = modalStack[modalStack.length - 1];
    const previousModal = document.getElementById(previousModalId);
    if (previousModal) {
      const focusableElements = getFocusableElements(previousModal);
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }
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
  if (!announcer) {
    console.warn('[dialog.js] Announcer element not found');
    return;
  }

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
