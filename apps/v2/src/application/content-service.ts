import type { StudySubject } from '../domain/subject';
import type { Edital, EditalDiscipline } from '../domain/edital';
import type { CommitResult, ContentCommand } from './content-commands';

export type ContentSnapshot = {
  subjects: StudySubject[];
  editais: Edital[];
  links: EditalDiscipline[];
};

/**
 * The only write path for F2 content. Implementations must commit entity,
 * operation record and outbox intent in one IndexedDB transaction.
 */
export interface ContentRepository {
  execute(command: ContentCommand): Promise<CommitResult<unknown>>;
  loadContent(profileId: string): Promise<ContentSnapshot>;
}
