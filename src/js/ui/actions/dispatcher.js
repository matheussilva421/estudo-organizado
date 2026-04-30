/**
 * Action Dispatcher Registry
 * Registry central de ações e setup de event delegation
 */

import { addCleanupListener } from '../../utils.js?v=8.32';

/**
 * Registry de ações disponíveis
 * Cada ação recebe o elemento e o evento
 */
const actions = {};

/**
 * Register a new action handler
 * @param {string} name - Action name (matches data-action attribute)
 * @param {Function} handler - Handler function receiving (element, event)
 */
export function registerAction(name, handler) {
  actions[name] = handler;
}

/**
 * Setup global event delegation
 * Deve ser chamado uma vez na inicialização do app
 */
export function setupActionDispatcher() {
  // Click handler principal
  addCleanupListener(document, 'click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    // Don't prevent default on select elements - it breaks the dropdown UI
    if (target.tagName === 'SELECT') {
      return;
    }

    const actionName = target.dataset.action;
    const handler = actions[actionName];

    if (handler) {
      event.preventDefault();
      event.stopPropagation();
      handler(target, event);
    } else {
      console.warn(`[actions.js] Action "${actionName}" not found`);
    }
  });

  // Change handler para selects e inputs
  addCleanupListener(document, 'change', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    const actionName = target.dataset.action;
    const handler = actions[actionName];

    if (handler) {
      event.preventDefault();
      event.stopPropagation();
      handler(target, event);
    }
  });

  // Input handler para search
  addCleanupListener(document, 'input', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    const actionName = target.dataset.action;
    const handler = actions[actionName];

    if (handler) {
      handler(target, event);
    }
  });

  // Focus/blur handlers
  addCleanupListener(document, 'focusin', (event) => {
    const target = event.target.closest('[data-focus-action]');
    if (!target) return;

    const actionName = target.dataset.focusAction;
    const handler = actions[actionName];

    if (handler) {
      handler(target, event);
    }
  });

  addCleanupListener(document, 'focusout', (event) => {
    const target = event.target.closest('[data-blur-action]');
    if (!target) return;

    const actionName = target.dataset.blurAction;
    const handler = actions[actionName];

    if (handler) {
      handler(target, event);
    }
  });

  console.log('[actions.js] Dispatcher initialized');
}

export { actions };
