import { useCallback, useEffect, useRef, useState } from 'react';
import { parseRoute, routeHref, routeLabel, type AppRoute } from './routing';
import { confirmNavigationIntent, hasDirtyDrafts } from './draft-guard';

export type NavigateOptions = { replace?: boolean; skipGuard?: boolean };

/**
 * Hash routing keeps deep links, favorites, reloads and browser history
 * working without a server rewrite or a new runtime dependency.
 */
export function useHashRoute(): {
  route: AppRoute;
  navigate: (next: AppRoute, options?: NavigateOptions) => void;
} {
  const initialHash =
    typeof window === 'undefined' || window.location.hash.startsWith('#/')
      ? window.location.hash
      : '';
  const initialRoute = parseRoute(initialHash);
  const initialCanonical =
    initialHash.startsWith('#/') && !initialRoute.invalid ? routeHref(initialRoute) : initialHash;
  if (
    typeof window !== 'undefined' &&
    initialCanonical !== initialHash &&
    window.location.hash === initialHash
  ) {
    window.history.replaceState(null, '', initialCanonical);
  }
  const [route, setRoute] = useState<AppRoute>(initialRoute);
  const routeRef = useRef<string>(initialCanonical);
  const skipGuardRef = useRef(false);

  useEffect(() => {
    const sync = () => {
      const rawHash = window.location.hash;
      // Element anchors (#main-content, #session-timer) scroll; they are not routes.
      if (rawHash && !rawHash.startsWith('#/')) return;
      const parsed = parseRoute(rawHash);
      const hash = rawHash.startsWith('#/') && !parsed.invalid ? routeHref(parsed) : rawHash;
      if (hash !== rawHash) window.history.replaceState(null, '', hash);
      if (skipGuardRef.current) {
        skipGuardRef.current = false;
        routeRef.current = hash;
        setRoute(parsed);
        return;
      }
      if (
        hasDirtyDrafts() &&
        hash !== routeRef.current &&
        !confirmNavigationIntent(routeLabel(parsed.module))
      ) {
        window.history.replaceState(null, '', routeRef.current || '#/');
        setRoute(parseRoute(routeRef.current || '#/'));
        return;
      }
      routeRef.current = hash;
      setRoute(parsed);
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
    if (
      hasDirtyDrafts() &&
      !options?.skipGuard &&
      !confirmNavigationIntent(routeLabel(next.module))
    ) {
      return;
    }
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
