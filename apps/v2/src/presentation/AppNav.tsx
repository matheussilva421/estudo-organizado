import { useEffect, useRef, useState } from 'react';
import type { RouteModule } from './routing';
import { routeHref, routeLabel } from './routing';

const ITEMS: RouteModule[] = [
  'home',
  'content',
  'planning',
  'sessions',
  'reviews',
  'analytics',
  'attention',
  'settings',
  'search',
];

const SECONDARY: RouteModule[] = [
  'overview',
  'content',
  'analytics',
  'attention',
  'search',
  'settings',
];

type Props = {
  current: RouteModule;
  attentionCount: number;
  reviewCount: number;
};

function badgeFor(module: RouteModule, attentionCount: number, reviewCount: number): number {
  return module === 'attention' ? attentionCount : module === 'reviews' ? reviewCount : 0;
}

function NavLink({
  module,
  current,
  attentionCount,
  reviewCount,
  onNavigate,
}: {
  module: RouteModule;
  current: RouteModule;
  attentionCount: number;
  reviewCount: number;
  onNavigate?: () => void;
}) {
  const active = current === module;
  const badge = badgeFor(module, attentionCount, reviewCount);
  return (
    <a
      className={active ? 'nav-link nav-link-active' : 'nav-link'}
      href={routeHref({ module, entityId: null, query: {}, invalid: false })}
      aria-current={active ? 'page' : undefined}
      data-nav={module}
      onClick={onNavigate}
    >
      <span className="nav-label">{routeLabel(module)}</span>
      {badge > 0 ? (
        <span className="nav-badge" aria-label={badge + ' pendência(s)'}>
          {badge}
        </span>
      ) : null}
    </a>
  );
}

function useMobileNavigation(): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return mobile;
}

export function AppNav({ current, attentionCount, reviewCount }: Props) {
  const mobile = useMobileNavigation();
  const [studyOpen, setStudyOpen] = useState(false);
  const secondaryActive = SECONDARY.includes(current);
  const navRef = useRef<HTMLElement | null>(null);
  const focusedNav = useRef<string | null>(null);
  const desktopFocus = useRef<string | null>(null);
  const previousMobile = useRef(mobile);

  function closeMobileMenus(): void {
    setStudyOpen(false);
    const more = navRef.current?.querySelector<HTMLDetailsElement>('.nav-more');
    if (more) more.open = false;
  }

  useEffect(() => {
    const node = navRef.current;
    if (!node) return;
    const remember = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        focusedNav.current = target.dataset.nav ?? null;
        if (!mobile) desktopFocus.current = target.dataset.nav ?? null;
      }
    };
    node.addEventListener('focusin', remember);
    return () => node.removeEventListener('focusin', remember);
  }, [mobile]);

  useEffect(() => {
    // Route changes are an external navigation event; menus must not cover the
    // destination. This never changes academic or draft state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStudyOpen(false);
    const more = navRef.current?.querySelector<HTMLDetailsElement>('.nav-more');
    if (more) more.open = false;
  }, [current]);

  useEffect(() => {
    if (previousMobile.current === mobile) return;
    previousMobile.current = mobile;
    const preferred =
      mobile && secondaryActive
        ? 'more'
        : !mobile
          ? desktopFocus.current ?? current
          : focusedNav.current ?? current;
    window.requestAnimationFrame(() => {
      const nav = navRef.current;
      const target = nav?.querySelector<HTMLElement>(`[data-nav="${preferred}"]`);
      if (target && target.offsetParent !== null) target.focus();
    });
  }, [mobile, secondaryActive, current]);

  if (!mobile) {
    return (
      <nav ref={navRef} className="app-nav" aria-label="Navegação principal">
        <ul className="nav-list">
          {ITEMS.map((module) => (
            <li key={module}>
              <NavLink
                module={module}
                current={current}
                attentionCount={attentionCount}
                reviewCount={reviewCount}
              />
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav ref={navRef} className="app-nav app-nav-mobile" aria-label="Navegação principal">
      <ul className="nav-list nav-list-mobile">
        <li>
          <NavLink
            module="home"
            current={current}
            attentionCount={attentionCount}
            reviewCount={reviewCount}
            onNavigate={closeMobileMenus}
          />
        </li>
        <li>
          <NavLink
            module="planning"
            current={current}
            attentionCount={attentionCount}
            reviewCount={reviewCount}
            onNavigate={closeMobileMenus}
          />
        </li>
        <li className="nav-flyout-host">
          <button
            type="button"
            className={
              current === 'sessions' ? 'nav-link nav-link-active nav-study-trigger' : 'nav-link nav-study-trigger'
            }
            aria-expanded={studyOpen}
            aria-controls="nav-study-options"
            data-nav="sessions"
            onClick={() => setStudyOpen((open) => !open)}
          >
            <span className="nav-label">Estudar</span>
          </button>
          {studyOpen ? (
            <div className="nav-flyout" id="nav-study-options" role="group" aria-label="Opções para estudar">
              <strong>Como deseja começar?</strong>
              <a href="#/sessions" onClick={closeMobileMenus}>
                Abrir sessões
              </a>
              <a href="#/sessions" onClick={closeMobileMenus}>
                Registrar sessão manual
              </a>
              <a href="#/planning" onClick={closeMobileMenus}>
                Escolher um bloco no plano
              </a>
              <span className="muted">Nenhum cronômetro inicia sem um comando explícito.</span>
            </div>
          ) : null}
        </li>
        <li>
          <NavLink
            module="reviews"
            current={current}
            attentionCount={attentionCount}
            reviewCount={reviewCount}
            onNavigate={closeMobileMenus}
          />
        </li>
        <li className="nav-flyout-host">
          <details className="nav-more">
            <summary
              className={
                secondaryActive ? 'nav-link nav-link-active nav-more-summary' : 'nav-link nav-more-summary'
              }
              data-nav="more"
              aria-current={secondaryActive ? 'page' : undefined}
            >
              <span className="nav-label">Mais</span>
            </summary>
            <div className="nav-flyout nav-more-panel" role="group" aria-label="Mais destinos">
              {SECONDARY.map((module) => (
                <NavLink
                  key={module}
                  module={module}
                  current={current}
                  attentionCount={attentionCount}
                  reviewCount={reviewCount}
                  onNavigate={closeMobileMenus}
                />
              ))}
            </div>
          </details>
        </li>
      </ul>
    </nav>
  );
}
