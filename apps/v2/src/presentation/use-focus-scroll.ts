import { useEffect } from 'react';

/**
 * Deep-link focus by stable id, never by visual index. Missing or archived
 * entities simply receive no focus; the route stays on the requested module.
 */
export function useFocusScroll(focusId: string | null | undefined, token?: unknown): void {
  useEffect(() => {
    if (!focusId) return;
    if (!/^[A-Za-z0-9._~-]{1,128}$/.test(focusId)) return;
    const timer = window.setTimeout(() => {
      const element = document.querySelector('[data-entity-id="' + focusId + '"]');
      if (!(element instanceof HTMLElement)) return;
      element.scrollIntoView({ block: 'center', behavior: 'auto' });
      element.setAttribute('tabindex', '-1');
      element.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focusId, token]);
}

