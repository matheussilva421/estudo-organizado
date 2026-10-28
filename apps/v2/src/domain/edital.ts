import {
  normalizeSubjectTitle,
  SUBJECT_TITLE_MAX_LENGTH,
  type StudySubject,
} from './subject';

export type Id = string;

export type CommandScope = {
  operationId: Id;
  profileId: Id;
  baseRevision?: number | null;
};

export type EditalStatus = 'ACTIVE' | 'ARCHIVED';

export type Edital = {
  id: Id;
  profileId: Id;
  title: string;
  status: EditalStatus;
  localRevision: number;
  sourceRef?: string;
};

export type EditalDiscipline = {
  id: Id;
  profileId: Id;
  editalId: Id;
  subjectId: Id;
  orderKey: string;
  displayAlias?: string;
  localRevision: number;
  status: EditalStatus;
};

/** Display title is bounded like the canonical one; it never holds identity. */
export const EDITAL_TITLE_MAX_LENGTH = SUBJECT_TITLE_MAX_LENGTH;
export const DISPLAY_ALIAS_MAX_LENGTH = 120;
export const ORDER_KEY_WIDTH = 6;

export type ContentErrorCode =
  | 'IDENTIFIER_REQUIRED'
  | 'INVALID_COMMAND'
  | 'TITLE_REQUIRED'
  | 'TITLE_TOO_LONG'
  | 'ALIAS_TOO_LONG'
  | 'EDITAL_EXISTS'
  | 'EDITAL_NOT_FOUND'
  | 'EDITAL_ARCHIVED'
  | 'EDITAL_NOT_ACTIVE'
  | 'PROFILE_MISMATCH'
  | 'LINK_EDITAL_MISMATCH'
  | 'LINK_SUBJECT_MISMATCH'
  | 'LINK_ARCHIVED'
  | 'ORDER_KEY_REQUIRED'
  | 'ENTITY_NOT_FOUND'
  | 'ENTITY_EXISTS'
  | 'INVALID_PARENT'
  | 'CYCLE_DETECTED'
  | 'CROSS_SCOPE_LINK'
  | 'LINK_DUPLICATE'
  | 'BASE_REVISION_STALE'
  | 'DEPENDENT_CONTENT'
  | 'DELETED_ENTITY'
  | 'TOMBSTONE_CONFLICT'
  | 'PRIMARY_REQUIRED'
  | 'PRIMARY_ARCHIVED'
  | 'OPERATION_ID_REUSED'
  | 'IMPORT_INVALID'
  | 'IMPORT_LIMIT_EXCEEDED'
  | 'IMPORT_STALE_PREVIEW';

export class ContentValidationError extends Error {
  readonly code: ContentErrorCode;

  constructor(code: ContentErrorCode, message: string) {
    super(message);
    this.name = 'ContentValidationError';
    this.code = code;
  }
}

function requireText(value: string | undefined, code: ContentErrorCode, label: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new ContentValidationError(code, `${label} is required`);
  return normalized;
}

function normalizeTitle(title: string | undefined): string {
  const normalized = normalizeSubjectTitle(
    requireText(title, 'TITLE_REQUIRED', 'title'),
  );
  if (normalized.length > EDITAL_TITLE_MAX_LENGTH) {
    throw new ContentValidationError('TITLE_TOO_LONG', 'edital title is too long');
  }
  return normalized;
}

export function normalizeDisplayAlias(alias: string | undefined): string | undefined {
  if (alias === undefined) return undefined;
  const normalized = normalizeSubjectTitle(alias);
  if (!normalized) return undefined;
  if (normalized.length > DISPLAY_ALIAS_MAX_LENGTH) {
    throw new ContentValidationError('ALIAS_TOO_LONG', 'display alias is too long');
  }
  return normalized;
}

export type EditalMutation =
  | { type: 'CREATE_EDITAL'; editalId: Id; title: string; sourceRef?: string }
  | { type: 'RENAME_EDITAL'; editalId: Id; title: string }
  | { type: 'ARCHIVE_EDITAL'; editalId: Id };

export type EditalCommand = CommandScope & EditalMutation;

function assertOwnership(current: Edital, profileId: string, editalId: string): void {
  if (current.profileId !== profileId) {
    throw new ContentValidationError('PROFILE_MISMATCH', 'profile does not own edital');
  }
  if (current.id !== editalId) {
    throw new ContentValidationError('PROFILE_MISMATCH', 'edital id mismatch');
  }
}

export function applyEditalCommand(current: Edital | null, command: EditalCommand): Edital {
  requireText(command.operationId, 'IDENTIFIER_REQUIRED', 'operationId');
  const profileId = requireText(command.profileId, 'IDENTIFIER_REQUIRED', 'profileId');

  if (command.type === 'CREATE_EDITAL') {
    const editalId = requireText(command.editalId, 'IDENTIFIER_REQUIRED', 'editalId');
    if (current) throw new ContentValidationError('EDITAL_EXISTS', 'edital already exists');
    const title = normalizeTitle(command.title);
    const created: Edital = {
      id: editalId,
      profileId,
      title,
      status: 'ACTIVE',
      localRevision: 1,
    };
    const sourceRef = command.sourceRef?.trim();
    return sourceRef ? { ...created, sourceRef } : created;
  }

  if (command.type === 'RENAME_EDITAL') {
    const editalId = requireText(command.editalId, 'IDENTIFIER_REQUIRED', 'editalId');
    if (!current) throw new ContentValidationError('EDITAL_NOT_FOUND', 'edital not found');
    assertOwnership(current, profileId, editalId);
    return {
      ...current,
      title: normalizeTitle(command.title),
      localRevision: current.localRevision + 1,
    };
  }

  if (command.type === 'ARCHIVE_EDITAL') {
    const editalId = requireText(command.editalId, 'IDENTIFIER_REQUIRED', 'editalId');
    if (!current) throw new ContentValidationError('EDITAL_NOT_FOUND', 'edital not found');
    assertOwnership(current, profileId, editalId);
    if (current.status === 'ARCHIVED') return current;
    return { ...current, status: 'ARCHIVED', localRevision: current.localRevision + 1 };
  }

  throw new ContentValidationError('INVALID_COMMAND', 'unknown edital command');
}

/**
 * The association is the only place a discipline title can be overridden.
 * The canonical `StudySubject` is never cloned, renamed or merged by name.
 */
export function displayName(subject: StudySubject, link: EditalDiscipline): string {
  if (link.profileId !== subject.profileId) {
    throw new ContentValidationError('PROFILE_MISMATCH', 'link and subject belong to different profiles');
  }
  if (link.subjectId !== subject.id) {
    throw new ContentValidationError('LINK_SUBJECT_MISMATCH', 'link points to another subject');
  }
  return normalizeDisplayAlias(link.displayAlias) ?? subject.title;
}

export function validateEditalLink(
  edital: Edital,
  subject: StudySubject,
  link: EditalDiscipline,
): void {
  if (edital.profileId !== subject.profileId || link.profileId !== edital.profileId) {
    throw new ContentValidationError('PROFILE_MISMATCH', 'link crosses profile boundary');
  }
  if (link.editalId !== edital.id) {
    throw new ContentValidationError('LINK_EDITAL_MISMATCH', 'link points to another edital');
  }
  if (link.subjectId !== subject.id) {
    throw new ContentValidationError('LINK_SUBJECT_MISMATCH', 'link points to another subject');
  }
  if (edital.status !== 'ACTIVE') {
    throw new ContentValidationError('EDITAL_ARCHIVED', 'edital is archived');
  }
  if (link.status !== 'ACTIVE') {
    throw new ContentValidationError('LINK_ARCHIVED', 'link is archived');
  }
  requireText(link.orderKey, 'ORDER_KEY_REQUIRED', 'orderKey');
  normalizeDisplayAlias(link.displayAlias);
}

export function formatOrderKey(index: number): string {
  const safeIndex = Number.isInteger(index) && index >= 0 ? index : 0;
  return String((safeIndex + 1) * 10).padStart(ORDER_KEY_WIDTH, '0');
}

export function nextOrderKey(existing: readonly { orderKey: string }[]): string {
  const highest = existing.reduce((latest, item) => {
    const parsed = Number.parseInt(item.orderKey, 10);
    return Number.isFinite(parsed) && parsed > latest ? parsed : latest;
  }, 0);
  // Keep the +10 step used by `formatOrderKey` and never collide with an
  // irregular key already persisted by an older import.
  return String(highest + 10).padStart(ORDER_KEY_WIDTH, '0');
}

export function compareByOrderKey(
  left: { orderKey: string; id: string },
  right: { orderKey: string; id: string },
): number {
  if (left.orderKey !== right.orderKey) return left.orderKey < right.orderKey ? -1 : 1;
  if (left.id === right.id) return 0;
  return left.id < right.id ? -1 : 1;
}
