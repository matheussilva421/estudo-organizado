import { describe, expect, it } from "vitest";
import {
  computeRetaFinalSelection,
  createBulkRetaFinalCommand,
} from "../../src/js/views/reta-final-bulk-actions.js";
import { renderRetaFinalPlanner } from "../../src/js/views/reta-final-planner.js";
import { createRetaFinalDraft, appendRetaFinalDraftOperation } from "../../src/js/logic/reta-final-drafts.js";

const HOJE = "2026-10-22";
const AGORA = "2026-10-22T12:00:00.000Z";

function block(id, overrides = {}) {
  return {
    id,
    discId: "disc-1",
    topicos: [{ assId: "ass-1", aulaId: null }],
    minutos: 60,
    status: "pendente",
    ordem: 0,
    dataOriginal: HOJE,
    dataPlanejada: HOJE,
    data: HOJE,
    rolagens: 0,
    ...overrides,
  };
}

function plan(blocks) {
  return {
    ativo: true,
    tipo: "reta_final",
    planId: "plan-1",
    schemaVersionRetaFinal: 2,
    revision: 1,
    updatedAt: AGORA,
    disciplinas: ["disc-1", "disc-2"],
    retaFinal: {
      nome: "Reta Final",
      dataFinal: "2026-12-31",
      minutosPadrao: 60,
      blocos: blocks,
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
          assuntos: [{ id: "ass-1", nome: "Crimes contra a vida" }],
          aulas: [],
        },
        {
          id: "disc-2",
          nome: "Direito Civil",
          assuntos: [{ id: "ass-2", nome: "Contratos" }],
          aulas: [],
        },
      ],
    },
  ];
}

function blocks() {
  return [
    block("rf-1", { ordem: 0 }),
    block("rf-2", { ordem: 1, dataPlanejada: "2026-10-23", data: "2026-10-23" }),
    block("rf-3", {
      discId: "disc-2",
      topicos: [{ assId: "ass-2", aulaId: null }],
      ordem: 2,
    }),
  ];
}

describe("computeRetaFinalSelection", () => {
  it("selects only blocks visible under the active filter", () => {
    const selection = computeRetaFinalSelection(blocks(), {
      filter: { discId: "disc-1" },
      mode: "visible",
    });
    expect(selection.ids).toEqual(["rf-1", "rf-2"]);
    expect(selection.allBlockIds).toEqual(["rf-1", "rf-2", "rf-3"]);
    expect(selection.count).toBe(2);
  });

  it("expands to the whole schedule only on explicit all mode", () => {
    const selection = computeRetaFinalSelection(blocks(), {
      filter: { discId: "disc-1" },
      mode: "all",
    });
    expect(selection.ids).toEqual(["rf-1", "rf-2", "rf-3"]);
    expect(selection.mode).toBe("all");
  });
});

describe("createBulkRetaFinalCommand", () => {
  it("produces the same MOVE for drag and keyboard inputs", () => {
    const selection = { ids: ["rf-1", "rf-2"] };
    const drag = createBulkRetaFinalCommand(
      selection,
      "MOVE",
      { targetDate: "2026-10-30" },
      { operationId: "op-1" }
    );
    const keyboard = createBulkRetaFinalCommand(
      selection,
      "MOVE",
      { targetDate: "2026-10-30" },
      { operationId: "op-1" }
    );
    expect(drag).toEqual(keyboard);
    expect(drag.command).toEqual({
      operationId: "op-1",
      type: "MOVE",
      blockIds: ["rf-1", "rf-2"],
      targetDate: "2026-10-30",
    });
  });

  it("rejects empty selections and invalid inputs", () => {
    expect(createBulkRetaFinalCommand({ ids: [] }, "MOVE", { targetDate: HOJE }).valid).toBe(false);
    expect(createBulkRetaFinalCommand({ ids: ["rf-1"] }, "MOVE", { targetDate: "2026-02-31" }).valid).toBe(false);
    expect(createBulkRetaFinalCommand({ ids: ["rf-1"] }, "SET_DURATION", { minutos: 0 }).valid).toBe(false);
    expect(createBulkRetaFinalCommand({ ids: ["rf-1"] }, "SET_PRIORITY", { prioridade: 9 }).valid).toBe(false);
  });
});

describe("atomic bulk application in the draft", () => {
  it("rejects the whole batch when one target has an active timer", () => {
    const draft = createRetaFinalDraft(plan(blocks()), { draftId: "draft-1", now: AGORA });
    const snapshot = JSON.stringify(draft.snapshot);
    const command = createBulkRetaFinalCommand(
      { ids: ["rf-1", "rf-2"] },
      "MOVE",
      { targetDate: "2026-10-30" },
      { operationId: "op-1" }
    ).command;
    const result = appendRetaFinalDraftOperation(draft, command, {
      catalog: catalog(),
      events: [],
      today: HOJE,
      activeTimerIds: new Set(["rf-2"]),
    });
    expect(result.valid).toBe(false);
    expect(result.draft).toBe(draft);
    expect(JSON.stringify(draft.snapshot)).toBe(snapshot);
  });

  it("duplicates many blocks without cloning study events", () => {
    const draft = createRetaFinalDraft(plan(blocks()), { draftId: "draft-1", now: AGORA });
    const events = [{ id: "ev-1", rfBlocoId: "rf-1", status: "estudei", tempoAcumulado: 900 }];
    const command = createBulkRetaFinalCommand(
      { ids: ["rf-1", "rf-2"] },
      "DUPLICATE",
      {},
      { operationId: "op-dup" }
    ).command;
    let generated = 0;
    const result = appendRetaFinalDraftOperation(draft, command, {
      catalog: catalog(),
      events,
      today: HOJE,
      makeId: () => "copy-" + ++generated,
    });
    expect(result.valid).toBe(true);
    const copies = result.draft.snapshot.retaFinal.blocos.filter((item) =>
      item.id.startsWith("copy-")
    );
    expect(copies).toHaveLength(2);
    expect(copies.every((item) => item.status === "pendente")).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].rfBlocoId).toBe("rf-1");
  });
});

describe("renderRetaFinalPlanner", () => {
  it("renders day groups, selection state and bulk actions", () => {
    const draft = createRetaFinalDraft(plan(blocks()), { draftId: "draft-1", now: AGORA });
    const html = renderRetaFinalPlanner(draft, {
      today: HOJE,
      catalog: catalog(),
      filter: { discId: "disc-1" },
      selection: { ids: ["rf-1"], visibleBlockIds: ["rf-1", "rf-2"], allBlockIds: ["rf-1", "rf-2", "rf-3"], count: 1, mode: "visible" },
    });
    expect(html).toContain('data-rf-planner');
    expect(html).toContain('data-rf-plan-day="2026-10-22"');
    expect(html).toContain('data-rf-plan-day="2026-10-23"');
    expect(html).toContain("Selecionar visíveis (2)");
    expect(html).toContain("Todo o cronograma (3)");
    expect(html).toContain("1 selecionado(s)");
    expect(html).toContain('data-action="rf-plan-preview"');
    expect(html).toContain("Direito Civil");
    expect(html).toContain("rf-planner-block--selected");
  });
});
