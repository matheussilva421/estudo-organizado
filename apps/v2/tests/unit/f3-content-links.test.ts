import { describe, expect, it } from 'vitest';
import {
  blocksNeedingReconciliation,
  reconcileContentLinks,
  type ContentLinkContext,
} from '../../src/domain/planning-execution-contract';
import type { PlanBlock } from '../../src/domain/planning';

const context: ContentLinkContext = {
  editais: [{ id: 'edital-tjpb', status: 'ACTIVE' }],
  links: [{ id: 'link-1', editalId: 'edital-tjpb', status: 'ACTIVE' }],
  assuntos: [
    { id: 'assunto-1', editalDisciplineId: 'link-1' },
    { id: 'assunto-outro', editalDisciplineId: 'link-dpe' },
  ],
  aulas: [{ id: 'aula-1', editalDisciplineId: 'link-1' }],
};

function block(overrides: Partial<PlanBlock> = {}): PlanBlock {
  return {
    id: 'block-1',
    profileId: 'profile-local',
    editalId: 'edital-tjpb',
    scenarioId: 'scenario-tjpb',
    editalDisciplineId: 'link-1',
    assuntoId: 'assunto-1',
    aulaId: 'aula-1',
    plannedMinutes: 60,
    allocation: 'PROJECTED',
    priority: 1,
    localRevision: 1,
    sourceOperationId: 'op-1',
    ...overrides,
  };
}

describe('F3 content link reconciliation', () => {
  it('renaming_content_keeps_the_reference_valid', () => {
    // Titles are display data; the id is the identity.
    expect(reconcileContentLinks([block()], context)).toEqual([
      { blockId: 'block-1', status: 'VALID', detail: 'ok' },
    ]);
  });

  it('archived_editais_and_links_are_signalled', () => {
    const archivedLink = reconcileContentLinks([block()], {
      ...context,
      links: [{ id: 'link-1', editalId: 'edital-tjpb', status: 'ARCHIVED' }],
    });
    expect(archivedLink[0]).toMatchObject({ status: 'ARCHIVED', detail: 'edital-discipline' });

    const archivedEdital = reconcileContentLinks([block()], {
      ...context,
      editais: [{ id: 'edital-tjpb', status: 'ARCHIVED' }],
    });
    expect(archivedEdital[0]).toMatchObject({ status: 'ARCHIVED', detail: 'edital' });
  });

  it('homonymous_content_from_another_scope_is_not_merged', () => {
    const checks = reconcileContentLinks([block({ assuntoId: 'assunto-outro' })], context);
    expect(checks[0]).toMatchObject({ status: 'INVALID_SCOPE', detail: 'assunto' });
    expect(blocksNeedingReconciliation(checks)).toEqual(['block-1']);
  });

  it('missing_and_soft_deleted_content_is_reported', () => {
    expect(
      reconcileContentLinks([block({ editalDisciplineId: 'link-gone' })], context)[0],
    ).toMatchObject({ status: 'MISSING' });
    expect(
      reconcileContentLinks([block()], { ...context, archivedIds: ['assunto-1'] })[0],
    ).toMatchObject({ status: 'ARCHIVED', detail: 'assunto' });
  });

  it('a_link_from_another_edital_is_never_valid', () => {
    const checks = reconcileContentLinks(
      [block()],
      {
        ...context,
        links: [{ id: 'link-1', editalId: 'edital-dpe', status: 'ACTIVE' }],
        editais: [
          { id: 'edital-tjpb', status: 'ACTIVE' },
          { id: 'edital-dpe', status: 'ACTIVE' },
        ],
      },
    );
    expect(checks[0]).toMatchObject({ status: 'INVALID_SCOPE', detail: 'edital' });
  });
});
