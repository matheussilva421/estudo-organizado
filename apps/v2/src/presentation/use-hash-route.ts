import { useCallback, useEffect, useState } from 'react';
import { parseRoute, routeHref, routeLabel, type AppRoute } from './routing';

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
    parseRoute(typeof window === 'undefined' ? '' : window.location.hash),
  );

  useEffect(() => {
    const sync = () => setRoute(parseRoute(window.location.hash));
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
    if (window.location.hash === href) {
      setRoute(parseRoute(href));
      return;
    }
    if (options?.replace) {
      window.history.replaceState(null, '', href);
      setRoute(parseRoute(href));
      return;
    }
    window.location.hash = href;
  }, []);

  return { route, navigate };
}
