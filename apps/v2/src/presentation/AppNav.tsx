import { useRef } from 'react';
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

type Props = {
  current: RouteModule;
  attentionCount: number;
  reviewCount: number;
};

export function AppNav({ current, attentionCount, reviewCount }: Props) {
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const activeIndex = Math.max(0, ITEMS.indexOf(current));

  function moveFocus(event: React.KeyboardEvent<HTMLAnchorElement>, index: number): void {
    if (
      event.key !== 'ArrowRight' &&
      event.key !== 'ArrowLeft' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return;
    }
    event.preventDefault();
    const last = ITEMS.length - 1;
    let next = index;
    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = last;
    linkRefs.current[next]?.focus();
  }

  return (
    <nav
      className="app-nav"
      aria-label="Navegação principal"
      aria-describedby="f6-nav-help"
    >
      <p id="f6-nav-help" className="sr-only">
        Use as setas esquerda e direita para percorrer os destinos. Tab avança para o conteúdo.
      </p>
      <ul className="nav-list">
        {ITEMS.map((module, index) => {
          const active = current === module;
          const badge =
            module === 'attention' ? attentionCount : module === 'reviews' ? reviewCount : 0;
          return (
            <li key={module}>
              <a
                ref={(node) => {
                  linkRefs.current[index] = node;
                }}
                className={active ? 'nav-link nav-link-active' : 'nav-link'}
                href={routeHref({ module, entityId: null, query: {}, invalid: false })}
                aria-current={active ? 'page' : undefined}
                tabIndex={index === activeIndex ? 0 : -1}
                onKeyDown={(event) => moveFocus(event, index)}
                data-nav={module}
              >
                <span>{routeLabel(module)}</span>
                {badge > 0 ? (
                  <span className="nav-badge" aria-label={badge + ' pendência(s)'}>
                    {badge}
                  </span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

