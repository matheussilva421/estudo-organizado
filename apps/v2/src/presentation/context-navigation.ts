import type { PriorityTarget } from '../application/experience-queries';
import type { AppRoute } from './routing';

export type RouteEntityStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED';

export type RouteEntity = {
  id: string;
  profileId: string;
  status: RouteEntityStatus;
};

export type RouteEntityResolution =
  | { kind: 'none'; canRead: true; canEdit: false }
  | { kind: 'found'; canRead: true; canEdit: true }
  | { kind: 'archived'; canRead: true; canEdit: false }
  | { kind: 'missing'; canRead: false; canEdit: false }
  | { kind: 'foreign'; canRead: false; canEdit: false }
  | { kind: 'deleted'; canRead: false; canEdit: false };

/** Only opaque IDs and navigation filters belong in the URL. */
export function routeForTarget(target: PriorityTarget, entityId: string | null = null): AppRoute {
  return {
    module: target,
    entityId,
    query: entityId ? { focus: entityId } : {},
    invalid: false,
  };
}

export function resolveRouteEntity(
  route: AppRoute,
  profileId: string,
  lookup: (id: string) => RouteEntity | null,
): RouteEntityResolution {
  const id = route.entityId ?? route.query.focus ?? null;
  if (!id) return { kind: 'none', canRead: true, canEdit: false };
  const entity = lookup(id);
  if (!entity) return { kind: 'missing', canRead: false, canEdit: false };
  if (entity.profileId !== profileId) return { kind: 'foreign', canRead: false, canEdit: false };
  if (entity.status === 'DELETED') return { kind: 'deleted', canRead: false, canEdit: false };
  if (entity.status === 'ARCHIVED') return { kind: 'archived', canRead: true, canEdit: false };
  return { kind: 'found', canRead: true, canEdit: true };
}
