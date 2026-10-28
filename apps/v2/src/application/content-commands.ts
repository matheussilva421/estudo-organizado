import type { StudySubject } from '../domain/subject';
import type {
  CommandScope,
  Edital,
  EditalCommand,
  EditalDiscipline,
  Id,
} from '../domain/edital';
import type { Assunto, Aula, LessonTopicLink } from '../domain/content';
import type { DeletableEntityType } from '../domain/delete';

export type { CommandScope, EditalCommand, Id } from '../domain/edital';

/**
 * Local commit outcome. Domain rejections keep their own code so the UI never
 * reports an invalid title as a storage outage.
 */
export type CommitResult<T> =
  | { kind: 'LOCAL_COMMITTED'; value: T }
  | { kind: 'INVALID'; code: string }
  | { kind: 'CONFLICT'; current?: unknown }
  | { kind: 'FAILED'; reason: string };

export type ContentEntityType =
  | 'subject'
  | 'edital'
  | 'edital-discipline'
  | 'assunto'
  | 'aula'
  | 'lesson-topic-link';

/** Entities that may travel in the single F1 outbox. */
export type ContentEntity =
  | StudySubject
  | Edital
  | EditalDiscipline
  | Assunto
  | Aula
  | LessonTopicLink;

export type LinkSubjectCommand = CommandScope & {
  type: 'LINK_SUBJECT';
  editalId: Id;
  subjectId: Id;
  linkId: Id;
  displayAlias?: string;
  orderKey?: string;
};

export type UpsertAssuntoCommand = CommandScope & {
  type: 'UPSERT_ASSUNTO';
  value: Assunto;
};

export type UpsertAulaCommand = CommandScope & {
  type: 'UPSERT_AULA';
  value: Aula;
};

export type LinkLessonTopicCommand = CommandScope & {
  type: 'LINK_LESSON_TOPIC';
  link: LessonTopicLink;
};

export type UnlinkLessonTopicCommand = CommandScope & {
  type: 'UNLINK_LESSON_TOPIC';
  linkId: Id;
};

export type ReorderSiblingCommand = CommandScope & {
  type: 'REORDER_SIBLING';
  entityType: 'assunto' | 'aula';
  entityId: Id;
  orderKey: string;
};

export type SoftDeleteCommand = CommandScope & {
  type: 'SOFT_DELETE';
  entityType: DeletableEntityType;
  entityId: Id;
};

export type RestoreEntityCommand = CommandScope & {
  type: 'RESTORE_ENTITY';
  entityType: DeletableEntityType;
  entityId: Id;
};

/** F2 grows this union monotonically. */
export type ContentCommand =
  | EditalCommand
  | LinkSubjectCommand
  | UpsertAssuntoCommand
  | UpsertAulaCommand
  | LinkLessonTopicCommand
  | UnlinkLessonTopicCommand
  | ReorderSiblingCommand
  | SoftDeleteCommand
  | RestoreEntityCommand;

export type ContentScope = CommandScope & { profileId: Id };
