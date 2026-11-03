import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROUTE,
  HOME_ROUTE,
  parseRoute,
  routeHref,
  routeLabel,
  routeWithQuery,
  sameRoute,
} from '../../src/presentation/routing';

describe('f6 typed routes', () => {
  it('defaults to the integrated overview without marking the route invalid', () => {
    expect(parseRoute('')).toEqual(DEFAULT_ROUTE);
    expect(parseRoute('#/')).toEqual(DEFAULT_ROUTE);
    expect(DEFAULT_ROUTE.module).toBe('overview');
    expect(parseRoute('#/home')).toEqual(HOME_ROUTE);
    expect(parseRoute('#/inicio').module).toBe('home');
  });

  it('accepts portuguese aliases for the six journeys', () => {
    expect(parseRoute('#/conteudo').module).toBe('content');
    expect(parseRoute('#/planejamento').module).toBe('planning');
    expect(parseRoute('#/estudar').module).toBe('sessions');
    expect(parseRoute('#/revisoes').module).toBe('reviews');
    expect(parseRoute('#/analise').module).toBe('analytics');
    expect(parseRoute('#/configuracoes').module).toBe('settings');
    expect(parseRoute('#/busca').module).toBe('search');
  });

  it('validates entity identifiers instead of trusting the URL', () => {
    expect(parseRoute('#/content/edital-1').entityId).toBe('edital-1');
    expect(parseRoute('#/content/..').invalid).toBe(true);
    expect(parseRoute('#/content/%2e%2e').invalid).toBe(true);
    expect(parseRoute('#/content/has%20space').invalid).toBe(true);
    expect(parseRoute('#/content/id/extra').invalid).toBe(true);
  });

  it('drops unauthorized query keys and oversized values', () => {
    const route = parseRoute('#/search?q=crase&token=secret&edital=e1&focus=a1');
    expect(route.query).toEqual({ q: 'crase', edital: 'e1', focus: 'a1' });
    const oversized = parseRoute('#/search?q=' + 'a'.repeat(201));
    expect(oversized.query.q).toBeUndefined();
  });

  it('rejects malformed or unknown hashes without revealing a destination', () => {
    expect(parseRoute('#qualquer').invalid).toBe(true);
    expect(parseRoute('#/desconhecido').invalid).toBe(true);
    expect(parseRoute('#/home/abc').module).toBe('home');
  });

  it('round-trips deterministically and keeps query order stable', () => {
    const route = {
      module: 'search' as const,
      entityId: null,
      query: { q: 'acao', focus: 'a1' },
      invalid: false,
    };
    const href = routeHref(route);
    expect(href).toBe('#/search?focus=a1&q=acao');
    expect(parseRoute(href)).toEqual(route);
    expect(sameRoute(parseRoute(href), route)).toBe(true);
  });

  it('updates a query key without mutating the original route', () => {
    const base = { module: 'search' as const, entityId: null, query: { q: 'a' }, invalid: false };
    const next = routeWithQuery(base, 'q', 'b');
    expect(base.query.q).toBe('a');
    expect(next.query.q).toBe('b');
    expect(routeWithQuery(next, 'q', null).query.q).toBeUndefined();
  });

  it('exposes accessible labels for every module', () => {
    expect(routeLabel('home')).toBe('Início');
    expect(routeLabel('notfound')).toContain('não encontrada');
  });
});

