import type { StudySubject } from '../domain/subject';
import type { Edital, EditalDiscipline } from '../domain/edital';
import type { Assunto, Aula, LessonTopicLink } from '../domain/content';
import type { CommitResult, ContentCommand } from './content-commands';

export type ContentSnapshot = {
  subjects: StudySubject[];
  editais: Edital[];
  links: EditalDiscipline[];
  assuntos: Assunto[];
  aulas: Aula[];
  lessonTopics: LessonTopicLink[];
};

export type ReorderSiblingInput = {
  profileId: string;
  operationId: string;
  entityType: 'assunto' | 'aula';
  entityId: string;
  orderKey: string;
  baseRevision?: number | null;
};

/**
 * The only write path for F2 content. Implementations must commit entity,
 * operation record and outbox intent in one IndexedDB transaction.
 */
export interface ContentRepository {
  execute(command: ContentCommand): Promise<CommitResult<unknown>>;
  reorderSibling(input: ReorderSiblingInput): Promise<CommitResult<unknown>>;
  loadContent(profileId: string): Promise<ContentSnapshot>;
}
