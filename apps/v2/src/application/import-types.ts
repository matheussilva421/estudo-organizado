import type { Id } from '../domain/edital';

/** Candidate limits; measured before lowering them with evidence. */
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_DEPTH = 20;
export const IMPORT_MAX_ENTITIES = 5_000;
export const IMPORT_MAX_TITLE = 120;
export const IMPORT_MAX_KEY = 200;

export type ImportInvalidReason =
  | 'NOT_JSON'
  | 'NOT_OBJECT'
  | 'UNSUPPORTED_VERSION'
  | 'UNSUPPORTED_KIND'
  | 'MISSING_NAME'
  | 'TITLE_TOO_LONG'
  | 'NO_DISCIPLINES'
  | 'TOO_LARGE'
  | 'TOO_DEEP'
  | 'TOO_MANY_ENTITIES'
  | 'UNSAFE_KEY'
  | 'INVALID_STRUCTURE';

export type QuarantineEntry = {
  path: string;
  reason: string;
  name?: string;
};

export type ParsedTopic = {
  name: string;
  nameKey: string;
  children: ParsedTopic[];
};

export type ParsedLesson = {
  name: string;
  nameKey: string;
  centralId?: string;
  sourceRef?: string;
};

export type ParsedDiscipline = {
  name: string;
  nameKey: string;
  centralId?: string;
  sourceRef?: string;
  topics: ParsedTopic[];
  lessons: ParsedLesson[];
};

export type SourceIdentity = {
  /** Trusted namespace; `centralId`/`sourceRef` are only authoritative here. */
  namespace: string;
  centralId: string | null;
  sourceRef: string | null;
  nameKey: string;
};

export type ParsedEdital = {
  format: 'legacy-v1';
  sourceIdentity: SourceIdentity;
  name: string;
  nameKey: string;
  disciplines: ParsedDiscipline[];
  fingerprint: string;
  sourceRevision: string;
  entityCount: number;
  depth: number;
  quarantined: QuarantineEntry[];
  suspicious: string[];
};

export type ParseResult =
  | { ok: true; parsed: ParsedEdital }
  | { ok: false; reason: ImportInvalidReason; detail?: string };

export type PreviewCreate = {
  entityType: 'subject' | 'edital' | 'edital-discipline' | 'assunto' | 'aula';
  id: Id;
  name: string;
  parentId: Id | null;
  subjectId?: Id;
  orderKey?: string;
};

export type PreviewMatch = {
  entityType: 'edital' | 'edital-discipline';
  id: Id;
  name: string;
  reason: 'SAME_QUALIFIED_IDENTITY' | 'SAME_SOURCE_REF';
};

export type PreviewAmbiguity = {
  name: string;
  nameKey: string;
  candidates: Id[];
  reason: 'SAME_NAME_DIFFERENT_SOURCE' | 'NAME_ONLY_MATCH';
};

export type ImportConflict = {
  targetId: Id;
  name: string;
  reason: 'SOURCE_REVISION_DIVERGED' | 'NAME_COLLISION' | 'EDITAL_ARCHIVED' | 'TOO_MANY_ENTITIES';
  incomingRevision: string;
  existingRevision: string;
};

export type ImportPreview = {
  importId: Id;
  sourceIdentity: SourceIdentity;
  fingerprint: string;
  sourceRevision: string;
  targetSignature: string;
  creates: PreviewCreate[];
  matches: PreviewMatch[];
  ambiguous: PreviewAmbiguity[];
  conflicts: ImportConflict[];
  quarantined: QuarantineEntry[];
  entityCount: number;
};

export type ImportReceipt = {
  profileId: Id;
  importId: Id;
  fingerprint: string;
  sourceRevision: string;
  entityCounts: Record<string, number>;
  operationIds: Id[];
};
