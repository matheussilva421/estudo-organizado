import type { StudySubject, SubjectCommand } from '../domain/subject';

export interface SubjectRepository {
  execute(command: SubjectCommand): Promise<StudySubject>;
  get(profileId: string, id: string): Promise<StudySubject | null>;
  list(profileId: string): Promise<StudySubject[]>;
}
