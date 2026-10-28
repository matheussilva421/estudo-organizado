import { beforeEach, describe, expect, it } from 'vitest';
import type { AdoptionDecision } from '../../src/platform/content-migration';
import { LocalSubjectAdoptionService } from '../../src/platform/content-migration';
import {
  deleteV2DatabaseForTests,
  getPendingOutbox,
  openV2Database,
  requestResult,
  STORES,
} from '../../src/platform/indexeddb';
import { LocalContentRepository } from '../../src/platform/local-content-repository';
import { LocalSubjectRepository } from '../../src/platform/local-subject-repository';

const profileId = 'profile-local';

async function seedF1Subjects(): Promise<void> {
  const subjects = new LocalSubjectRepository();
  for (const [index, title] of [
    'Direito Constitucional',
    'Direito Administrativo',
    'Portugues',
  ].entries()) {
    await subjects.execute({
      operationId: `op-subject-${index}`,
      profileId,
      subjectId: `subject-${index}`,
      type: 'create',
      title,
    });
  }
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F2 F1 subject adoption', () => {
  it('f1_subject_adoption_keeps_identity_and_never_auto_links', async () => {
    await seedF1Subjects();
    const adoption = new LocalSubjectAdoptionService();

    // Opening the F2 schema must not link anything by itself.
    const beforeUpgrade = await adoption.listUnassignedSubjects(profileId);
    expect(beforeUpgrade.map((subject) => subject.title)).toEqual([
      'Direito Administrativo',
      'Direito Constitucional',
      'Portugues',
    ]);
    expect(beforeUpgrade.map((subject) => subject.id)).toEqual([
      'subject-1',
      'subject-0',
      'subject-2',
    ]);
    const database = await openV2Database(profileId);
    const transaction = database.transaction(STORES.editalDisciplines, 'readonly');
    expect(await requestResult(transaction.objectStore(STORES.editalDisciplines).count())).toBe(0);

    const content = new LocalContentRepository();
    await content.execute({
      type: 'CREATE_EDITAL',
      operationId: 'op-edital-a',
      profileId,
      editalId: 'edital-a',
      title: 'TJPB 2026',
    });

    const decisions: AdoptionDecision[] = [
      { subjectId: 'subject-0', decision: 'LINK_EXISTING', editalId: 'edital-a' },
      {
        subjectId: 'subject-1',
        decision: 'CREATE_EDITAL_AND_LINK',
        newEdital: { editalId: 'edital-b', title: 'TJRO 2026' },
      },
      { subjectId: 'subject-2', decision: 'LEAVE_UNASSIGNED' },
    ];

    const report = await adoption.applySubjectAdoption(
      profileId,
      'op-adoption-1',
      decisions,
    );
    expect(report).toMatchObject({ kind: 'LOCAL_COMMITTED' });
    const value = (report as { value: { linked: string[]; created: string[]; leftUnassigned: string[] } })
      .value;
    expect(value.linked).toEqual(['subject-0']);
    expect(value.created).toEqual(['subject-1']);
    expect(value.leftUnassigned).toEqual(['subject-2']);

    const snapshot = await content.loadContent(profileId);
    expect(snapshot.links.map((item) => item.subjectId).sort()).toEqual([
      'subject-0',
      'subject-1',
    ]);
    expect(snapshot.subjects.map((subject) => subject.id).sort()).toEqual([
      'subject-0',
      'subject-1',
      'subject-2',
    ]);
    // Existing subjects keep their identity and revision.
    const untouched = snapshot.subjects.find((subject) => subject.id === 'subject-0');
    expect(untouched).toMatchObject({ title: 'Direito Constitucional', localRevision: 1 });
    expect(snapshot.editais.map((item) => item.id).sort()).toEqual(['edital-a', 'edital-b']);

    // The queue stays consultable for the undecided subject.
    expect((await adoption.listUnassignedSubjects(profileId)).map((item) => item.id)).toEqual([
      'subject-2',
    ]);

    const outboxBefore = await getPendingOutbox(profileId);
    const countBefore = outboxBefore.length;
    const replay = await adoption.applySubjectAdoption(
      profileId,
      'op-adoption-1',
      decisions,
    );
    expect(replay).toEqual(report);
    expect(await getPendingOutbox(profileId)).toHaveLength(countBefore);
    expect((await content.loadContent(profileId)).links).toHaveLength(2);
  });

  it('invalid_adoption_rolls_back_every_decision', async () => {
    await seedF1Subjects();
    const adoption = new LocalSubjectAdoptionService();

    const missingEdital = await adoption.applySubjectAdoption(profileId, 'op-adoption-missing', [
      { subjectId: 'subject-0', decision: 'LINK_EXISTING', editalId: 'edital-ghost' },
    ]);
    expect(missingEdital).toEqual({ kind: 'INVALID', code: 'ENTITY_NOT_FOUND' });

    const content = new LocalContentRepository();
    await content.execute({
      type: 'CREATE_EDITAL',
      operationId: 'op-edital-a',
      profileId,
      editalId: 'edital-a',
      title: 'TJPB 2026',
    });
    await content.execute({
      type: 'ARCHIVE_EDITAL',
      operationId: 'op-edital-a-archive',
      profileId,
      editalId: 'edital-a',
    });

    const archived = await adoption.applySubjectAdoption(profileId, 'op-adoption-archived', [
      { subjectId: 'subject-0', decision: 'LINK_EXISTING', editalId: 'edital-a' },
    ]);
    expect(archived).toEqual({ kind: 'INVALID', code: 'EDITAL_ARCHIVED' });

    // A partially valid batch must not commit the valid half.
    const mixed = await adoption.applySubjectAdoption(profileId, 'op-adoption-mixed', [
      {
        subjectId: 'subject-1',
        decision: 'CREATE_EDITAL_AND_LINK',
        newEdital: { editalId: 'edital-ok', title: 'TJRO 2026' },
      },
      { subjectId: 'subject-2', decision: 'LINK_EXISTING', editalId: 'edital-ghost' },
    ]);
    expect(mixed).toEqual({ kind: 'INVALID', code: 'ENTITY_NOT_FOUND' });

    const snapshot = await content.loadContent(profileId);
    expect(snapshot.links).toEqual([]);
    expect(snapshot.editais.map((item) => item.id)).toEqual(['edital-a']);
    expect((await adoption.listUnassignedSubjects(profileId))).toHaveLength(3);
  });

  it('duplicate_subject_decisions_are_rejected', async () => {
    await seedF1Subjects();
    const adoption = new LocalSubjectAdoptionService();
    const duplicated = await adoption.applySubjectAdoption(profileId, 'op-adoption-dup', [
      { subjectId: 'subject-0', decision: 'LEAVE_UNASSIGNED' },
      { subjectId: 'subject-0', decision: 'LEAVE_UNASSIGNED' },
    ]);
    expect(duplicated).toEqual({ kind: 'INVALID', code: 'INVALID_COMMAND' });
  });

  it('unknown_subject_in_a_decision_is_rejected', async () => {
    await seedF1Subjects();
    const adoption = new LocalSubjectAdoptionService();
    expect(
      await adoption.applySubjectAdoption(profileId, 'op-adoption-ghost', [
        { subjectId: 'subject-ghost', decision: 'LEAVE_UNASSIGNED' },
      ]),
    ).toEqual({ kind: 'INVALID', code: 'ENTITY_NOT_FOUND' });
  });
});
