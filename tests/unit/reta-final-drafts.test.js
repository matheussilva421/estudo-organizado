import { describe, expect, it } from 'vitest';
import {
  appendRetaFinalDraftOperation,
  createRetaFinalDraft,
  validateRetaFinalDraft,
} from '../../src/js/logic/reta-final-drafts.js';

function plan(overrides = {}) {
  return {
    ativo: true,
    tipo: 'reta_final',
    planId: overrides.planId ?? 'plan-1',
    schemaVersionRetaFinal: 2,
    revision: overrides.revision ?? 4,
    updatedAt: '2026-10-19T10:00:00.000Z',
    config: { dataProva: '2026-11-15' },
    retaFinal: {
      dataFinal: '2026-11-30',
      minutosPadrao: 60,
      blocos: [
        {
          id: 'rf-1',
          discId: 'disc-1',
          topicos: [{ assId: 'ass-1', aulaId: null }],
          minutos: 60,
          status: 'pendente',
          ordem: 0,
          dataOriginal: '2026-10-20',
          dataPlanejada: '2026-10-20',
          data: '2026-10-20',
          rolagens: 0,
        },
      ],
      ...(overrides.retaFinal || {}),
    },
  };
}

const context = {
  today: '2026-10-20',
  events: [{ id: 'event-1', rfBlocoId: 'rf-1', status: 'estudei' }],
  catalog: [],
  activeTimerIds: [],
};

function patch(operationId = 'op-1', patch = { minutos: 90 }) {
  return { operationId, type: 'PATCH', blockIds: ['rf-1'], patch };
}

describe('createRetaFinalDraft', () => {
  it('captures an isolated editing snapshot and deterministic base identity', () => {
    const source = plan();
    const draft = createRetaFinalDraft(source, {
      draftId: 'draft-1',
      now: '2026-10-20T12:00:00.000Z',
    });

    expect(draft).toMatchObject({
      draftId: 'draft-1',
      planId: 'plan-1',
      baseRevision: 4,
      state: 'editing',
      createdAt: '2026-10-20T12:00:00.000Z',
      updatedAt: '2026-10-20T12:00:00.000Z',
      operations: [],
      snapshot: source,
      baseSnapshot: source,
    });
    expect(draft.baseDigest).toEqual(expect.any(String));
    expect(draft.baseDigest.length).toBeGreaterThan(0);
    expect(draft.snapshot).not.toBe(source);
    expect(draft.baseSnapshot).not.toBe(source);
    draft.snapshot.retaFinal.blocos[0].minutos = 1;
    expect(source.retaFinal.blocos[0].minutos).toBe(60);
  });

  it('derives the same base digest when object keys are reordered', () => {
    const source = plan();
    const reordered = {
      ...source,
      retaFinal: {
        blocos: source.retaFinal.blocos,
        minutosPadrao: source.retaFinal.minutosPadrao,
        dataFinal: source.retaFinal.dataFinal,
      },
    };

    const first = createRetaFinalDraft(source, { draftId: 'a', now: 't' });
    const second = createRetaFinalDraft(reordered, { draftId: 'b', now: 't' });

    expect(first.baseDigest).toBe(second.baseDigest);
  });
});

describe('appendRetaFinalDraftOperation', () => {
  it('applies a valid Phase A command only to the draft snapshot', () => {
    const source = plan();
    const draft = createRetaFinalDraft(source, {
      draftId: 'draft-1',
      now: 't',
    });
    const result = appendRetaFinalDraftOperation(draft, patch(), context);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.draft.snapshot.retaFinal.blocos[0].minutos).toBe(90);
    expect(result.draft.operations).toHaveLength(1);
    expect(result.draft.operations[0]).toMatchObject({
      operationId: 'op-1',
      command: patch(),
    });
    expect(result.diff).toEqual([
      expect.objectContaining({
        blockId: 'rf-1',
        before: expect.objectContaining({ minutos: 60 }),
        after: expect.objectContaining({ minutos: 90 }),
      }),
    ]);
    expect(source.retaFinal.blocos[0].minutos).toBe(60);
    expect(context.events[0].status).toBe('estudei');
  });

  it('treats an identical operationId as idempotent', () => {
    const draft = createRetaFinalDraft(plan(), {
      draftId: 'draft-1',
      now: 't',
    });
    const once = appendRetaFinalDraftOperation(draft, patch(), context);
    const twice = appendRetaFinalDraftOperation(once.draft, patch(), context);

    expect(once.valid).toBe(true);
    expect(twice.valid).toBe(true);
    expect(twice.draft).toEqual(once.draft);
    expect(twice.diff).toEqual(once.diff);
    expect(twice.draft.operations).toHaveLength(1);
  });

  it('rejects an invalid command without changing the draft or diff', () => {
    const draft = createRetaFinalDraft(plan(), {
      draftId: 'draft-1',
      now: 't',
    });
    const before = JSON.parse(JSON.stringify(draft));
    const result = appendRetaFinalDraftOperation(
      draft,
      patch('op-invalid', { status: 'concluido' }),
      context,
    );

    expect(result.valid).toBe(false);
    expect(result.draft).toBe(draft);
    expect(result.draft).toEqual(before);
    expect(result.diff).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CAMPO_PROTEGIDO' }),
      ]),
    );
  });

  it('rejects reusing an operationId for a different command', () => {
    const draft = createRetaFinalDraft(plan(), {
      draftId: 'draft-1',
      now: 't',
    });
    const once = appendRetaFinalDraftOperation(draft, patch(), context);
    const result = appendRetaFinalDraftOperation(
      once.draft,
      patch('op-1', { minutos: 120 }),
      context,
    );

    expect(result.valid).toBe(false);
    expect(result.draft).toEqual(once.draft);
    expect(result.diff).toEqual(once.diff);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'OPERATION_ID_CONFLICT' }),
      ]),
    );
  });
});

describe('validateRetaFinalDraft', () => {
  it('returns ready with the deterministic draft diff for the unchanged base plan', () => {
    const draft = createRetaFinalDraft(plan(), {
      draftId: 'draft-1',
      now: 't',
    });
    const edited = appendRetaFinalDraftOperation(draft, patch(), context).draft;

    const result = validateRetaFinalDraft(edited, plan(), context);

    expect(result.status).toBe('ready');
    expect(result.errors).toEqual([]);
    expect(result.diff).toEqual([
      expect.objectContaining({ blockId: 'rf-1', fieldsChanged: ['minutos'] }),
    ]);
  });

  it('marks a changed base revision stale', () => {
    const draft = createRetaFinalDraft(plan(), {
      draftId: 'draft-1',
      now: 't',
    });

    const result = validateRetaFinalDraft(
      draft,
      plan({ revision: 5 }),
      context,
    );

    expect(result.status).toBe('stale');
    expect(result.diff).toEqual([]);
  });

  it('marks changed base content stale even when revision was not advanced', () => {
    const draft = createRetaFinalDraft(plan(), {
      draftId: 'draft-1',
      now: 't',
    });
    const changed = plan();
    changed.retaFinal.blocos[0].minutos = 75;

    const result = validateRetaFinalDraft(draft, changed, context);

    expect(result.status).toBe('stale');
  });

  it('returns conflict for absent or mismatched plan identity', () => {
    const draft = createRetaFinalDraft(plan(), {
      draftId: 'draft-1',
      now: 't',
    });

    expect(validateRetaFinalDraft(draft, null, context).status).toBe(
      'conflict',
    );
    expect(
      validateRetaFinalDraft(draft, plan({ planId: 'other-plan' }), context)
        .status,
    ).toBe('conflict');
  });

  it('returns blocking errors when a saved command is no longer valid in context', () => {
    const draft = createRetaFinalDraft(plan(), {
      draftId: 'draft-1',
      now: 't',
    });
    const edited = appendRetaFinalDraftOperation(draft, patch(), context).draft;

    const result = validateRetaFinalDraft(edited, plan(), {
      ...context,
      activeTimerIds: ['rf-1'],
    });

    expect(result.status).toBe('blocked');
    expect(result.diff).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'TIMER_ATIVO' }),
      ]),
    );
  });
});

describe('Reta Final draft context validation', () => {
  it('rejects malformed read-only command context without changing the draft', () => {
    const draft = createRetaFinalDraft(plan(), {
      draftId: 'draft-1',
      now: 't',
    });
    const before = JSON.parse(JSON.stringify(draft));

    const result = appendRetaFinalDraftOperation(draft, patch(), {
      events: {},
    });

    expect(result.valid).toBe(false);
    expect(result.draft).toEqual(before);
    expect(result.diff).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CONTEXT_INVALID' }),
      ]),
    );
  });

  it('blocks validation when the read-only command context is malformed', () => {
    const draft = createRetaFinalDraft(plan(), {
      draftId: 'draft-1',
      now: 't',
    });

    const result = validateRetaFinalDraft(draft, plan(), { catalog: {} });

    expect(result.status).toBe('blocked');
    expect(result.diff).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CONTEXT_INVALID' }),
      ]),
    );
  });
});
