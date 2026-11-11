import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
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

const ICONS: Partial<Record<RouteModule, ReactNode>> = {
  home: <path d="M3 10.5 12 4l9 6.5V20h-6v-6H9v6H3z" />,
  content: <path d="M12 3 3 7l9 4 9-4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4" />,
  planning: <path d="M4 6h16v14H4zM8 3v5M16 3v5M4 10h16" />,
  sessions: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM10 8l6 4-6 4z" />,
  reviews: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />,
  analytics: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  attention: <path d="M18 15v-5a6 6 0 1 0-12 0v5l-2 3h16zM10 21h4" />,
  settings: <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3v-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3h4v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z" />,
  search: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16 16l5 5" />,
  overview: <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />,
};

function NavIcon({ module }: { module: RouteModule }) {
  const icon = ICONS[module];
  if (!icon) return null;
  return (
    <span className="nav-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
    </span>
  );
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
      <NavIcon module={module} />
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
        <div className="rail-quote" aria-hidden="true">
          <span className="rail-quote-mark">“</span>
          <p>Disciplina hoje,<br />resultado amanhã.</p>
        </div>
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
