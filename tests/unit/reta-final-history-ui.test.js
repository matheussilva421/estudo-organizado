import { describe, expect, it } from "vitest";
import { renderRetaFinalOperations } from "../../src/js/views/reta-final-history-ui.js";
import { buildHistoryDraft } from "../../src/js/ui/actions/reta-final-history-ui.js";
import {
  appendRetaFinalDraftOperation,
  createRetaFinalDraft,
} from "../../src/js/logic/reta-final-drafts.js";

const HOJE = "2026-10-22";
const AGORA = "2026-10-22T12:00:00.000Z";

function plan() {
  return {
    ativo: true,
    tipo: "reta_final",
    planId: "plan-1",
    schemaVersionRetaFinal: 2,
    revision: 4,
    updatedAt: AGORA,
    disciplinas: ["disc-1"],
    retaFinal: {
      nome: "Reta Final",
      dataFinal: "2026-12-31",
      minutosPadrao: 60,
      blocos: [
        {
          id: "rf-1",
          discId: "disc-1",
          topicos: [{ assId: "ass-1", aulaId: null }],
          minutos: 60,
          status: "pendente",
          ordem: 0,
          dataOriginal: HOJE,
          dataPlanejada: HOJE,
          data: HOJE,
          rolagens: 0,
        },
      ],
    },
  };
}

function catalog() {
  return [
    {
      id: "ed-1",
      disciplinas: [
        {
          id: "disc-1",
          nome: "Direito Penal",
          assuntos: [{ id: "ass-1", nome: "Crimes" }],
          aulas: [],
        },
      ],
    },
  ];
}

function applyPatchDraft(minutos) {
  const draft = createRetaFinalDraft(plan(), { draftId: "draft-1", now: AGORA });
  const result = appendRetaFinalDraftOperation(
    draft,
    {
      operationId: "op-" + minutos,
      type: "PATCH",
      blockIds: ["rf-1"],
      patch: { minutos },
    },
    { today: HOJE, events: [], catalog: catalog() },
  );
  if (!result.valid) throw new Error("draft setup failed");
  return result.draft;
}

describe("renderRetaFinalOperations", () => {
  it("renders undo, blocked and redo actions", () => {
    const html = renderRetaFinalOperations([
      {
        type: "PATCH",
        blockIds: ["rf-1"],
        committedRevision: 5,
        inverseAvailable: true,
      },
      {
        type: "ARCHIVE",
        blockIds: ["rf-2"],
        committedRevision: 6,
        inverseAvailable: false,
      },
      {
        type: "PATCH",
        blockIds: ["rf-1"],
        committedRevision: 7,
        inverseAvailable: true,
        historyAction: "undo",
      },
    ]);
    expect(html).toContain("Editar bloco");
    expect(html).toContain("Desfazer");
    expect(html).toContain("Sem inverso seguro");
    expect(html).toContain("Refazer");
    expect(html).toContain("revisão 5");
  });
});

describe("buildHistoryDraft", () => {
  it("builds an undo draft and then a redo draft", () => {
    const edited = applyPatchDraft(90);
    const operation = {
      ...edited.operations[0],
      planId: "plan-1",
      committedRevision: 5,
    };
    const committedPlan = { ...edited.snapshot, revision: 5 };
    const undo = buildHistoryDraft(operation, "undo", {
      plan: committedPlan,
      events: [],
      catalog: catalog(),
      today: HOJE,
      draftId: "undo-1",
      now: AGORA,
    });
    expect(undo.valid).toBe(true);
    expect(undo.draft.snapshot.retaFinal.blocos[0].minutos).toBe(60);
    expect(undo.draft.operations[0].historyAction).toBe("undo");

    const undoOperation = {
      ...undo.draft.operations[0],
      planId: "plan-1",
      committedRevision: 6,
    };
    const undoCommittedPlan = { ...undo.draft.snapshot, revision: 6 };
    const redo = buildHistoryDraft(undoOperation, "redo", {
      plan: undoCommittedPlan,
      events: [],
      catalog: catalog(),
      today: HOJE,
      draftId: "redo-1",
      now: AGORA,
    });
    expect(redo.valid).toBe(true);
    expect(redo.draft.snapshot.retaFinal.blocos[0].minutos).toBe(90);
    expect(redo.draft.operations[0].historyAction).toBe("redo");
  });

  it("rejects undo when a later operation changed the target", () => {
    const edited = applyPatchDraft(90);
    const operation = edited.operations[0];
    const later = {
      ...edited.snapshot,
      retaFinal: {
        ...edited.snapshot.retaFinal,
        blocos: edited.snapshot.retaFinal.blocos.map((block) => ({
          ...block,
          minutos: 120,
        })),
      },
    };
    const result = buildHistoryDraft(operation, "undo", {
      plan: later,
      events: [],
      catalog: catalog(),
      today: HOJE,
      draftId: "undo-1",
      now: AGORA,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
