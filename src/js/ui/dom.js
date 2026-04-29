/**
 * DOM Helpers - Safe, reusable utilities for DOM manipulation
 * Reduz dependência de string concatenation e inline handlers
 */

/**
 * Query selector wrapper com fallback seguro
 * @param {string} selector - CSS selector
 * @param {Element|Document} root - Root element para busca
 * @returns {Element|null}
 */
export function qs(selector, root = document) {
  if (!selector) return null;
  // Handle ID selectors sem #
  const normalized =
    selector.startsWith('#') || selector.startsWith('.') ? selector : `#${selector}`;
  return root.querySelector(normalized) || root.querySelector(selector);
}

/**
 * Query selector all wrapper
 * @param {string} selector - CSS selector
 * @param {Element|Document} root - Root element
 * @returns {NodeList}
 */
export function qsa(selector, root = document) {
  if (!selector) return [];
  const shouldNormalize = /^[A-Za-z][\w-]*$/.test(selector);
  const normalized =
    !shouldNormalize || selector.startsWith('#') || selector.startsWith('.')
      ? selector
      : `#${selector}`;
  const normalizedResult = root.querySelectorAll(normalized);
  if (normalized === selector || normalizedResult.length > 0) return normalizedResult;
  return root.querySelectorAll(selector);
}

/**
 * Set text content com null/undefined safety
 * @param {Element} node - Element to set text on
 * @param {string|number|null|undefined} value - Text value
 */
export function setText(node, value) {
  if (node) {
    node.textContent = value ?? '';
  }
}

/**
 * Clear all children from a node
 * @param {Element} node
 */
export function clearChildren(node) {
  while (node?.firstChild) {
    node.removeChild(node.firstChild);
  }
}

/**
 * Create element with optional attributes and content
 * @param {string} tag - Tag name
 * @param {Object} attrs - Attributes object
 * @param {string|Node} content - Text content or Node
 * @returns {Element}
 */
export function createElement(tag, attrs = {}, content = null) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') {
      el.className = value;
    } else if (key === 'dataset') {
      for (const [dk, dv] of Object.entries(value)) {
        el.dataset[dk] = dv;
      }
    } else if (key.startsWith('on')) {
      // Skip inline handlers - use data-action instead
      console.warn(`createElement: skipping inline handler ${key} - use data-action instead`);
    } else if (value !== null && value !== undefined) {
      el.setAttribute(key, value);
    }
  }
  if (content) {
    if (typeof content === 'string') {
      el.textContent = content;
    } else {
      el.appendChild(content);
    }
  }
  return el;
}

/**
 * Toggle element visibility
 * @param {Element} node
 * @param {boolean} show
 */
export function toggleVisibility(node, show) {
  if (node) {
    node.style.display = show ? '' : 'none';
  }
}

/**
 * Add class if not present
 * @param {Element} node
 * @param {string} className
 */
export function addClass(node, className) {
  node?.classList?.add(className);
}

/**
 * Remove class if present
 * @param {Element} node
 * @param {string} className
 */
export function removeClass(node, className) {
  node?.classList?.remove(className);
}

/**
 * Toggle class
 * @param {Element} node
 * @param {string} className
 * @param {boolean} force
 */
export function toggleClass(node, className, force) {
  node?.classList?.toggle(className, force);
}

/**
 * Import esc from utils (safe HTML escape)
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
export function esc(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Set innerHTML com validação de segurança
 * Usa esc() para sanitizar conteúdo textual antes de inserir
 * @param {Element|string} nodeOrId - Element ou ID do elemento
 * @param {string} html - HTML string (deve ser montada com esc() nos valores)
 * @returns {boolean} - Sucesso
 */
export function safeSetHTML(nodeOrId, html) {
  const node =
    typeof nodeOrId === 'string' ? document.getElementById(nodeOrId.replace('#', '')) : nodeOrId;

  if (!node) {
    console.warn(
      `[DOM] Element not found: ${typeof nodeOrId === 'string' ? '#' + nodeOrId : nodeOrId}`
    );
    return false;
  }

  node.innerHTML = html;
  return true;
}

/**
 * Highlight text com marcação segura (usa esc() antes de replace)
 * @param {string} str - String original
 * @param {RegExp} regex - Pattern para highlight (deve ter grupo de captura)
 * @returns {string} - HTML seguro com <mark>
 */
export function highlightText(str, regex) {
  const escaped = esc(str);
  return escaped.replace(regex, '<mark>$1</mark>');
}

/**
 * Create element from template string com escape automático
 * Alternativa segura ao innerHTML direto
 * @param {string} tag - Tag name
 * @param {Object} attrs - Attributes (textContent será escaped)
 * @param {string|Node} content - Text content (será escaped se for string)
 * @returns {Element}
 */
export function createSafeElement(tag, attrs = {}, content = null) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class' || key === 'className') {
      el.className = value ?? '';
    } else if (key === 'dataset') {
      for (const [dk, dv] of Object.entries(value)) {
        el.dataset[dk] = dv;
      }
    } else if (key === 'innerHTML') {
      console.warn('[createSafeElement] Use textContent ou appendChild para segurança');
    } else if (key === 'textContent') {
      el.textContent = esc(String(value));
    } else if (key.startsWith('on') || key.startsWith('data-action')) {
      // Skip inline handlers
      console.warn(`[createSafeElement] Skipping handler: ${key} - use data-action`);
    } else if (value !== null && value !== undefined) {
      el.setAttribute(key, esc(String(value)));
    }
  }

  if (content) {
    if (typeof content === 'string') {
      el.textContent = esc(content);
    } else if (content instanceof Node) {
      el.appendChild(content);
    }
  }

  return el;
}
