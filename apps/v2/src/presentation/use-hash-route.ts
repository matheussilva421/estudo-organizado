import { useCallback, useEffect, useRef, useState } from 'react';
import { parseRoute, routeHref, routeLabel, type AppRoute } from './routing';
import { confirmNavigationIntent, hasDirtyDrafts } from './draft-guard';

export type NavigateOptions = { replace?: boolean };

/**
 * Hash routing keeps deep links, favorites, reloads and browser history
 * working without a server rewrite or a new runtime dependency.
 */
export function useHashRoute(): {
  route: AppRoute;
  navigate: (next: AppRoute, options?: NavigateOptions) => void;
} {
  const [route, setRoute] = useState<AppRoute>(() =>
    parseRoute(
      typeof window === 'undefined' || window.location.hash.startsWith('#/')
        ? window.location.hash
        : '',
    ),
  );
  const routeRef = useRef<string>(
    typeof window !== 'undefined' && window.location.hash.startsWith('#/')
      ? window.location.hash
      : '',
  );
  const skipGuardRef = useRef(false);

  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash;
      // Element anchors (#main-content, #session-timer) scroll; they are not routes.
      if (hash && !hash.startsWith('#/')) return;
      if (skipGuardRef.current) {
        skipGuardRef.current = false;
        routeRef.current = hash;
        setRoute(parseRoute(hash));
        return;
      }
      const next = parseRoute(hash);
      if (
        hasDirtyDrafts() &&
        hash !== routeRef.current &&
        !confirmNavigationIntent(routeLabel(next.module))
      ) {
        window.history.replaceState(null, '', routeRef.current || '#/');
        setRoute(parseRoute(routeRef.current || '#/'));
        return;
      }
      routeRef.current = hash;
      setRoute(next);
    };
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  useEffect(() => {
    document.title = `${routeLabel(route.module)} \u00b7 Estudo Organizado V2`;
  }, [route.module]);

  const navigate = useCallback((next: AppRoute, options?: NavigateOptions) => {
    const href = routeHref(next);
    if (typeof window === 'undefined') return;
    if (hasDirtyDrafts() && !confirmNavigationIntent(routeLabel(next.module))) return;
    if (window.location.hash === href) {
      routeRef.current = href;
      setRoute(parseRoute(href));
      return;
    }
    if (options?.replace) {
      window.history.replaceState(null, '', href);
      routeRef.current = href;
      setRoute(parseRoute(href));
      return;
    }
    skipGuardRef.current = true;
    routeRef.current = href;
    window.location.hash = href;
  }, []);

  return { route, navigate };
}
