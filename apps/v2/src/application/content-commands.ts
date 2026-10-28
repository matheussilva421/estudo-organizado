import type { CommandScope, EditalCommand, Id } from '../domain/edital';

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

/** F2 grows this union monotonically; Task 5 adds the content commands. */
export type ContentCommand = EditalCommand;

export type ContentScope = CommandScope & { profileId: Id };
