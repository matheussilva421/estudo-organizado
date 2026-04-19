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
  const normalized = selector.startsWith('#') || selector.startsWith('.')
    ? selector
    : `#${selector}`;
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
  const normalized = selector.startsWith('#') || selector.startsWith('.')
    ? selector
    : `#${selector}`;
  return root.querySelectorAll(normalized) || root.querySelectorAll(selector);
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
