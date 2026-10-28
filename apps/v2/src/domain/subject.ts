export type StudySubject = {
  id: string;
  profileId: string;
  title: string;
  localRevision: number;
};

export type SubjectCommand = {
  operationId: string;
  profileId: string;
  subjectId: string;
  type: 'create' | 'rename';
  title: string;
};

export type SubjectErrorCode =
  | 'IDENTIFIER_REQUIRED'
  | 'INVALID_COMMAND'
  | 'TITLE_REQUIRED'
  | 'TITLE_TOO_LONG'
  | 'SUBJECT_EXISTS'
  | 'SUBJECT_NOT_FOUND'
  | 'PROFILE_MISMATCH';

export class SubjectValidationError extends Error {
  readonly code: SubjectErrorCode;

  constructor(code: SubjectErrorCode, message: string) {
    super(message);
    this.name = 'SubjectValidationError';
    this.code = code;
  }
}

export const SUBJECT_TITLE_MAX_LENGTH = 120;

function requireText(value: string | undefined, code: SubjectErrorCode, label: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new SubjectValidationError(code, `${label} is required`);
  return normalized;
}

export function normalizeSubjectTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ');
}

export function applySubjectCommand(
  current: StudySubject | null,
  command: SubjectCommand,
): StudySubject {
  requireText(command.operationId, 'IDENTIFIER_REQUIRED', 'operationId');
  const profileId = requireText(command.profileId, 'IDENTIFIER_REQUIRED', 'profileId');
  const subjectId = requireText(command.subjectId, 'IDENTIFIER_REQUIRED', 'subjectId');

  if (command.type !== 'create' && command.type !== 'rename') {
    throw new SubjectValidationError('INVALID_COMMAND', 'unknown subject command');
  }

  const title = normalizeSubjectTitle(requireText(command.title, 'TITLE_REQUIRED', 'title'));
  if (title.length > SUBJECT_TITLE_MAX_LENGTH) {
    throw new SubjectValidationError('TITLE_TOO_LONG', 'subject title is too long');
  }

  if (command.type === 'create') {
    if (current) throw new SubjectValidationError('SUBJECT_EXISTS', 'subject already exists');
    return { id: subjectId, profileId, title, localRevision: 1 };
  }

  if (!current) throw new SubjectValidationError('SUBJECT_NOT_FOUND', 'subject not found');
  if (current.profileId !== profileId) {
    throw new SubjectValidationError('PROFILE_MISMATCH', 'profile does not own subject');
  }
  if (current.id !== subjectId) {
    throw new SubjectValidationError('PROFILE_MISMATCH', 'subject id mismatch');
  }

  return { ...current, title, localRevision: current.localRevision + 1 };
}
