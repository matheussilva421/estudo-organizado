import {
  ContentValidationError,
  nextOrderKey,
  ORDER_KEY_WIDTH,
  type Id,
} from './edital';
import { normalizeSubjectTitle, SUBJECT_TITLE_MAX_LENGTH } from './subject';

export const CONTENT_TITLE_MAX_LENGTH = SUBJECT_TITLE_MAX_LENGTH;
/** Matching key used by import previews; never an identity. */
export const MATCHING_KEY_MAX_LENGTH = 200;

export type Assunto = {
  id: Id;
  profileId: Id;
  editalDisciplineId: Id;
  parentId: Id | null;
  /** Derived persistence key: `parentId ?? ''`. IndexedDB cannot index null. */
  parentKey: string;
  title: string;
  orderKey: string;
  localRevision: number;
  provenance?: string;
};

export type Aula = {
  id: Id;
  profileId: Id;
  editalDisciplineId: Id;
  title: string;
  orderKey: string;
  localRevision: number;
  provenance?: string;
};

export type LessonTopicLink = {
  id: Id;
  profileId: Id;
  aulaId: Id;
  assuntoId: Id;
  localRevision: number;
};

export function parentKeyOf(parentId: Id | null | undefined): string {
  return typeof parentId === 'string' ? parentId : '';
}

export function normalizeContentTitle(title: string | undefined): string {
  const raw = typeof title === 'string' ? title : '';
  const normalized = normalizeSubjectTitle(raw);
  if (!normalized) {
    throw new ContentValidationError('TITLE_REQUIRED', 'content title is required');
  }
  if (normalized.length > CONTENT_TITLE_MAX_LENGTH) {
    throw new ContentValidationError('TITLE_TOO_LONG', 'content title is too long');
  }
  return normalized;
}

export function normalizeProvenance(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = normalizeSubjectTitle(value);
  return normalized ? normalized.slice(0, MATCHING_KEY_MAX_LENGTH) : undefined;
}

export function normalizeOrderKey(value: string | undefined): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return null;
  // One canonical numeric space keeps lexicographic order equal to numeric
  // order; otherwise `'0500'` would sort after `'000510'`.
  if (!/^\d{1,9}$/.test(normalized)) {
    throw new ContentValidationError('ORDER_KEY_REQUIRED', 'orderKey is invalid');
  }
  return String(Math.min(Number.parseInt(normalized, 10), 999_990)).padStart(
    ORDER_KEY_WIDTH,
    '0',
  );
}

/** Deterministic order: `orderKey` first, then the opaque id. */
export function sortByOrder<T extends { orderKey: string; id: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    if (left.orderKey !== right.orderKey) return left.orderKey < right.orderKey ? -1 : 1;
    if (left.id === right.id) return 0;
    return left.id < right.id ? -1 : 1;
  });
}

export function sortAssuntos(items: Assunto[]): Assunto[] {
  return [...items].sort((left, right) => {
    if (left.parentKey !== right.parentKey) return left.parentKey < right.parentKey ? -1 : 1;
    if (left.orderKey !== right.orderKey) return left.orderKey < right.orderKey ? -1 : 1;
    if (left.id === right.id) return 0;
    return left.id < right.id ? -1 : 1;
  });
}

export function siblingsOf(
  items: Assunto[],
  parentId: Id | null,
): Assunto[] {
  const key = parentKeyOf(parentId);
  return items.filter((item) => item.parentKey === key);
}

export function nextSiblingOrderKey(items: Assunto[], parentId: Id | null): string {
  return nextOrderKey(siblingsOf(items, parentId));
}

export function nextScopeOrderKey(items: readonly { orderKey: string }[]): string {
  return nextOrderKey(items);
}

export function formatInitialOrder(index: number): string {
  return String((Math.max(0, index) + 1) * 10).padStart(ORDER_KEY_WIDTH, '0');
}

/** Rejects a parent that is missing, in another scope, itself, or a descendant. */
export function assertAssuntoParent(
  candidateId: Id,
  parentId: Id | null,
  scopeId: Id,
  byId: ReadonlyMap<Id, Assunto>,
): void {
  if (parentId === null) return;
  if (parentId === candidateId) {
    throw new ContentValidationError('INVALID_PARENT', 'assunto cannot be its own parent');
  }
  const parent = byId.get(parentId);
  if (!parent) {
    throw new ContentValidationError('INVALID_PARENT', 'parent assunto does not exist');
  }
  if (parent.editalDisciplineId !== scopeId) {
    throw new ContentValidationError('INVALID_PARENT', 'parent belongs to another edital discipline');
  }

  const seen = new Set<Id>([candidateId]);
  let cursor: Id | null = parentId;
  while (cursor !== null) {
    if (cursor === candidateId) {
      throw new ContentValidationError('CYCLE_DETECTED', 'assunto tree would contain a cycle');
    }
    if (seen.has(cursor)) {
      throw new ContentValidationError('CYCLE_DETECTED', 'assunto tree already contains a cycle');
    }
    seen.add(cursor);
    cursor = byId.get(cursor)?.parentId ?? null;
  }
}

/** Whole-tree validation used by import previews before any write. */
export function validateAssuntoTree(items: readonly Assunto[]): void {
  const byId = new Map<Id, Assunto>();
  for (const item of items) {
    if (byId.has(item.id)) {
      throw new ContentValidationError('INVALID_PARENT', 'duplicate assunto id in tree');
    }
    byId.set(item.id, item);
  }
  for (const item of items) {
    if (item.parentId !== null && item.parentKey !== item.parentId) {
      throw new ContentValidationError('INVALID_PARENT', 'parentKey does not match parentId');
    }
    assertAssuntoParent(item.id, item.parentId, item.editalDisciplineId, byId);
  }
}

export function validateLessonTopicLink(
  aula: Aula,
  assunto: Assunto,
  link: LessonTopicLink,
): void {
  if (aula.profileId !== assunto.profileId || link.profileId !== aula.profileId) {
    throw new ContentValidationError('PROFILE_MISMATCH', 'lesson link crosses profile boundary');
  }
  if (link.aulaId !== aula.id) {
    throw new ContentValidationError('CROSS_SCOPE_LINK', 'link points to another lesson');
  }
  if (link.assuntoId !== assunto.id) {
    throw new ContentValidationError('CROSS_SCOPE_LINK', 'link points to another assunto');
  }
  if (aula.editalDisciplineId !== assunto.editalDisciplineId) {
    throw new ContentValidationError('CROSS_SCOPE_LINK', 'lesson and assunto belong to different editais');
  }
}
