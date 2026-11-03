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
  return (
    <nav className="app-nav" aria-label="Navegação principal">
      <ul className="nav-list">
        {ITEMS.map((module) => {
          const active = current === module;
          const badge =
            module === 'attention' ? attentionCount : module === 'reviews' ? reviewCount : 0;
          return (
            <li key={module}>
              <a
                className={active ? 'nav-link nav-link-active' : 'nav-link'}
                href={routeHref({ module, entityId: null, query: {}, invalid: false })}
                aria-current={active ? 'page' : undefined}
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

