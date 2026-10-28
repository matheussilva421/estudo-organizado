import { describe, expect, it } from 'vitest';
import type { StudySubject } from '../../src/domain/subject';
import {
  applyEditalCommand,
  ContentValidationError,
  displayName,
  validateEditalLink,
  type Edital,
  type EditalDiscipline,
} from '../../src/domain/edital';

const profileId = 'profile-local';

const subject: StudySubject = {
  id: 'subject-1',
  profileId,
  title: 'Direito Constitucional',
  localRevision: 1,
};

function edital(overrides: Partial<Edital> = {}): Edital {
  return {
    id: 'edital-1',
    profileId,
    title: 'TJPB 2026',
    status: 'ACTIVE',
    localRevision: 1,
    ...overrides,
  };
}

function link(overrides: Partial<EditalDiscipline> = {}): EditalDiscipline {
  return {
    id: 'link-1',
    profileId,
    editalId: 'edital-1',
    subjectId: subject.id,
    orderKey: '000010',
    localRevision: 1,
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('F2 edital domain', () => {
  it('create_rename_edital_preserves_ids', () => {
    const created = applyEditalCommand(null, {
      type: 'CREATE_EDITAL',
      operationId: 'op-create-edital',
      profileId,
      editalId: 'edital-1',
      title: '  TJPB   2026  ',
    });
    expect(created).toEqual({
      id: 'edital-1',
      profileId,
      title: 'TJPB 2026',
      status: 'ACTIVE',
      localRevision: 1,
    });

    const renamed = applyEditalCommand(created, {
      type: 'RENAME_EDITAL',
      operationId: 'op-rename-edital',
      profileId,
      editalId: 'edital-1',
      title: 'TJPB 2027',
    });
    expect(renamed.id).toBe('edital-1');
    expect(renamed.profileId).toBe(profileId);
    expect(renamed.title).toBe('TJPB 2027');
    expect(renamed.localRevision).toBe(created.localRevision + 1);
    expect(renamed.status).toBe('ACTIVE');
  });

  it('archiving_is_reversible_and_only_bumps_revision_once', () => {
    const archived = applyEditalCommand(edital(), {
      type: 'ARCHIVE_EDITAL',
      operationId: 'op-archive',
      profileId,
      editalId: 'edital-1',
    });
    expect(archived.status).toBe('ARCHIVED');
    expect(archived.localRevision).toBe(2);

    const archivedAgain = applyEditalCommand(archived, {
      type: 'ARCHIVE_EDITAL',
      operationId: 'op-archive-2',
      profileId,
      editalId: 'edital-1',
    });
    expect(archivedAgain).toEqual(archived);
  });

  it('subject_can_link_to_two_editais_without_clone', () => {
    const first = link({ id: 'link-tjpb', editalId: 'edital-tjpb' });
    const second = link({ id: 'link-tjro', editalId: 'edital-tjro', orderKey: '000020' });

    expect(first.subjectId).toBe(subject.id);
    expect(second.subjectId).toBe(subject.id);
    expect(new Set([first.id, second.id]).size).toBe(2);
    expect(new Set([first.editalId, second.editalId]).size).toBe(2);
    // The canonical subject is stored once; links carry only the association.
    expect(Object.keys(subject).sort()).toEqual(['id', 'localRevision', 'profileId', 'title']);
  });

  it('homonymous_subjects_are_distinct', () => {
    const twin: StudySubject = { ...subject, id: 'subject-2' };
    const firstLink = link();
    const twinLink = link({ id: 'link-2', subjectId: twin.id });

    expect(displayName(subject, firstLink)).toBe(displayName(twin, twinLink));
    expect(subject.id).not.toBe(twin.id);
    expect(() => validateEditalLink(edital(), subject, twinLink)).toThrow(
      ContentValidationError,
    );
    expect(() => validateEditalLink(edital(), twin, firstLink)).toThrow(ContentValidationError);
  });

  it('canonical_rename_keeps_explicit_contextual_alias', () => {
    const renamedSubject: StudySubject = {
      ...subject,
      title: 'Direito Constitucional e Direitos Humanos',
      localRevision: 2,
    };
    const withAlias = link({ displayAlias: 'Constitucional (TJ)' });
    const withoutAlias = link({ id: 'link-2' });

    expect(displayName(renamedSubject, withAlias)).toBe('Constitucional (TJ)');
    expect(displayName(renamedSubject, withoutAlias)).toBe(
      'Direito Constitucional e Direitos Humanos',
    );
    // Renaming the association does not add an alias to its siblings.
    expect(withoutAlias.displayAlias).toBeUndefined();
  });

  it('invalid_titles_and_links_fail_with_explicit_codes', () => {
    expect(() =>
      applyEditalCommand(null, {
        type: 'CREATE_EDITAL',
        operationId: 'op-long',
        profileId,
        editalId: 'edital-2',
        title: 'x'.repeat(121),
      }),
    ).toThrow(expect.objectContaining({ code: 'TITLE_TOO_LONG' }));

    expect(() =>
      applyEditalCommand(edital(), {
        type: 'RENAME_EDITAL',
        operationId: 'op-other-profile',
        profileId: 'other-profile',
        editalId: 'edital-1',
        title: 'Outro',
      }),
    ).toThrow(expect.objectContaining({ code: 'PROFILE_MISMATCH' }));

    expect(() =>
      validateEditalLink(edital({ status: 'ARCHIVED' }), subject, link()),
    ).toThrow(expect.objectContaining({ code: 'EDITAL_ARCHIVED' }));

    expect(() =>
      validateEditalLink(edital(), subject, link({ displayAlias: 'a'.repeat(121) })),
    ).toThrow(expect.objectContaining({ code: 'ALIAS_TOO_LONG' }));
  });
});
