/**
 * Typed, stable hash routes. The URL carries navigation identity only: never
 * drafts, tokens or academic payloads. Validation happens before rendering.
 */
export const ROUTE_MODULES = [
  'overview',
  'home',
  'content',
  'planning',
  'sessions',
  'reviews',
  'analytics',
  'attention',
  'settings',
  'search',
  'notfound',
] as const;

export type RouteModule = (typeof ROUTE_MODULES)[number];

export type RouteQuery = Record<string, string>;

export type AppRoute = {
  module: RouteModule;
  entityId: string | null;
  query: RouteQuery;
  invalid: boolean;
};

export const HOME_ROUTE: AppRoute = {
  module: 'home',
  entityId: null,
  query: {},
  invalid: false,
};

/** The root keeps the established content workspace; the dashboard lives at #/home. */
export const DEFAULT_ROUTE: AppRoute = {
  module: 'overview',
  entityId: null,
  query: {},
  invalid: false,
};

const MODULE_ALIASES: Record<string, Exclude<RouteModule, 'notfound'>> = {
  overview: 'overview',
  visao: 'overview',
  integrado: 'overview',
  '': 'home',
  home: 'home',
  inicio: 'home',
  conteudo: 'content',
  content: 'content',
  editais: 'content',
  planejamento: 'planning',
  planning: 'planning',
  sessoes: 'sessions',
  sessions: 'sessions',
  estudar: 'sessions',
  revisoes: 'reviews',
  reviews: 'reviews',
  revisar: 'reviews',
  analise: 'analytics',
  analytics: 'analytics',
  analisar: 'analytics',
  atencao: 'attention',
  attention: 'attention',
  configuracoes: 'settings',
  settings: 'settings',
  config: 'settings',
  busca: 'search',
  search: 'search',
};

const ALLOWED_QUERY_KEYS = new Set(['q', 'edital', 'focus']);
const ID_PATTERN = /^(?=.*[A-Za-z0-9])[A-Za-z0-9._~-]{1,128}$/;

function decodeSegment(segment: string): string | null {
  try {
    const decoded = decodeURIComponent(segment);
    return ID_PATTERN.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function notFoundRoute(): AppRoute {
  return { module: 'notfound', entityId: null, query: {}, invalid: true };
}

/** Parses `location.hash` without trusting it. Unknown shapes become notfound. */
export function parseRoute(rawHash: string | null | undefined): AppRoute {
  const raw = (rawHash ?? '').replace(/^#/, '');
  if (!raw) return { ...DEFAULT_ROUTE, query: {} };
  if (!raw.startsWith('/')) return notFoundRoute();

  const [pathPart = '', queryPart = ''] = raw.slice(1).split('?');
  const segments = pathPart.split('/').filter((segment) => segment.length > 0);
  if (segments.length === 0) return { ...DEFAULT_ROUTE, query: {} };
  if (segments.length > 2) return notFoundRoute();

  const module = MODULE_ALIASES[(segments[0] ?? '').toLowerCase()];
  if (!module) return notFoundRoute();

  let entityId: string | null = null;
  if (segments.length === 2) {
    const decoded = decodeSegment(segments[1] ?? '');
    if (!decoded) return notFoundRoute();
    entityId = decoded;
  }

  const query: RouteQuery = {};
  const params = new URLSearchParams(queryPart);
  for (const [key, value] of params) {
    if (ALLOWED_QUERY_KEYS.has(key) && value.length > 0 && value.length <= 200) {
      query[key] = value;
    }
  }

  return { module, entityId, query, invalid: false };
}

/** Serializes a route, keeping query keys in a deterministic order. */
export function routeHref(route: AppRoute): string {
  if (route.module === 'notfound') return '#/';
  const segments: string[] = [route.module];
  if (route.entityId) segments.push(encodeURIComponent(route.entityId));
  const params = new URLSearchParams();
  for (const key of Object.keys(route.query).sort()) {
    const value = route.query[key];
    if (ALLOWED_QUERY_KEYS.has(key) && typeof value === 'string' && value.length > 0) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return `#/${segments.join('/')}${query ? `?${query}` : ''}`;
}

const MODULE_LABELS: Record<RouteModule, string> = {
  overview: 'Visão integrada',
  home: 'Início',
  content: 'Conteúdo',
  planning: 'Planejamento',
  sessions: 'Sessões',
  reviews: 'Revisões',
  analytics: 'Análise',
  attention: 'Atenção',
  settings: 'Configurações',
  search: 'Busca',
  notfound: 'Rota não encontrada',
};

export function routeLabel(module: RouteModule): string {
  return MODULE_LABELS[module];
}

export function sameRoute(left: AppRoute, right: AppRoute): boolean {
  return routeHref(left) === routeHref(right);
}

export function routeWithQuery(
  route: AppRoute,
  key: string,
  value: string | null,
): AppRoute {
  const query = { ...route.query };
  if (value === null || value.length === 0) delete query[key];
  else query[key] = value;
  return { ...route, query };
}
