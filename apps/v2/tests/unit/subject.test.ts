import { describe, expect, it } from 'vitest';
import {
  applySubjectCommand,
  SubjectValidationError,
  type SubjectCommand,
  type StudySubject,
} from '../../src/domain/subject';

const base: StudySubject = {
  id: 'subject-1',
  profileId: 'profile-local',
  title: 'Direito Constitucional',
  localRevision: 1,
};

function command(overrides: Partial<SubjectCommand> = {}): SubjectCommand {
  return {
    operationId: 'op-1',
    profileId: 'profile-local',
    subjectId: 'subject-1',
    type: 'create',
    title: 'Direito Constitucional',
    ...overrides,
  };
}

describe('applySubjectCommand', () => {
  it('rejects_blank_subject', () => {
    expect(() => applySubjectCommand(null, command({ title: '   ' }))).toThrowError(
      SubjectValidationError,
    );
    try {
      applySubjectCommand(null, command({ title: '   ' }));
    } catch (error) {
      expect((error as SubjectValidationError).code).toBe('TITLE_REQUIRED');
    }
  });

  it('id_is_not_title', () => {
    const created = applySubjectCommand(null, command({ title: 'Direito Civil' }));

    expect(created.id).toBe('subject-1');
    expect(created.title).toBe('Direito Civil');
    expect(created.id).not.toBe(created.title);
  });

  it('rename_preserves_id_and_profile', () => {
    const renamed = applySubjectCommand(base, command({ type: 'rename', title: 'Direito Civil' }));

    expect(renamed.id).toBe(base.id);
    expect(renamed.profileId).toBe(base.profileId);
    expect(renamed.title).toBe('Direito Civil');
    expect(renamed.localRevision).toBe(2);
    expect(base.title).toBe('Direito Constitucional');
  });

  it('increments_revision_once', () => {
    const once = applySubjectCommand(base, command({ type: 'rename', title: 'A' }));
    const twice = applySubjectCommand(once, command({ type: 'rename', title: 'B' }));

    expect(once.localRevision).toBe(2);
    expect(twice.localRevision).toBe(3);
  });

  it('rejects_duplicate_create_and_missing_rename', () => {
    expect(() => applySubjectCommand(base, command())).toThrowError(SubjectValidationError);
    expect(() =>
      applySubjectCommand(null, command({ type: 'rename' })),
    ).toThrowError(SubjectValidationError);
  });

  it('rejects_profile_or_subject_mismatch', () => {
    expect(() =>
      applySubjectCommand(base, command({ type: 'rename', profileId: 'other' })),
    ).toThrowError(SubjectValidationError);
    expect(() =>
      applySubjectCommand(base, command({ type: 'rename', subjectId: 'other' })),
    ).toThrowError(SubjectValidationError);
  });
});
