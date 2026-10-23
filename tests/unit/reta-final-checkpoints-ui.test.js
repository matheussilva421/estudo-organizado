import { describe, expect, it } from "vitest";
import {
  renderRetaFinalCheckpointBlocks,
  renderRetaFinalCheckpointList,
} from "../../src/js/views/reta-final-checkpoints.js";
import {
  appendRestoreOperationsToDraft,
  restoreRetaFinalCheckpoint,
} from "../../src/js/ui/actions/reta-final-checkpoints.js";
import {
  createRetaFinalDraft,
} from "../../src/js/logic/reta-final-drafts.js";
import { createRetaFinalCheckpoint } from "../../src/js/logic/reta-final-history.js";

const HOJE = "2026-10-22";
const AGORA = "2026-10-22T12:00:00.000Z";

function block(id, overrides = {}) {
  return {
    id,
    discId: "disc-1",
    topicos: [{ assId: "ass-1", aulaId: null }],
    minutos: 60,
    status: "pendente",
    ordem: Number(id.split("-")[1] || 0),
    dataOriginal: HOJE,
    dataPlanejada: HOJE,
    data: HOJE,
    rolagens: 0,
    ...overrides,
  };
}

function plan(revision = 4, blocks = [block("rf-1")]) {
  return {
    ativo: true,
    tipo: "reta_final",
    planId: "plan-1",
    schemaVersionRetaFinal: 2,
    revision,
    updatedAt: AGORA,
    disciplinas: ["disc-1"],
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
          assuntos: [{ id: "ass-1", nome: "Crimes" }],
          aulas: [],
        },
      ],
    },
  ];
}

function checkpoint(revision = 1, blocks = [block("rf-1", { minutos: 30 })]) {
  return createRetaFinalCheckpoint(plan(revision, blocks), {
    checkpointId: "cp-" + revision,
    createdAt: AGORA,
    kind: "manual",
    label: "Antes do ajuste",
  });
}

describe("renderRetaFinalCheckpointList", () => {
  it("renders manual, automatic and invalid checkpoints", () => {
    const html = renderRetaFinalCheckpointList([
      checkpoint(1),
      { ...checkpoint(2), kind: "automatic", label: undefined },
      {
        ...checkpoint(3),
        integrity: "invalid",
        integrityDiagnostics: [{ message: "checksum" }],
      },
    ]);
    expect(html).toContain("Antes do ajuste");
    expect(html).toContain("Checkpoint automático");
    expect(html).toContain("revisão 1");
    expect(html).toContain("Inválido");
    expect(html).toMatch(/data-checkpoint-id="cp-3"[^>]*disabled/);
  });

  it("handles an empty list", () => {
    expect(renderRetaFinalCheckpointList([])).toContain(
      "Nenhum checkpoint disponível",
    );
  });
});

describe("renderRetaFinalCheckpointBlocks", () => {
  it("renders block checkboxes checked by default", () => {
    const html = renderRetaFinalCheckpointBlocks(
      checkpoint(1, [block("rf-1", { minutos: 30 }), block("rf-2")]),
    );
    expect(html).toContain('name="rf-restore-block" value="rf-1" checked');
    expect(html).toContain('name="rf-restore-block" value="rf-2" checked');
    expect(html).toContain("Sessões, questões e tempo registrados");
    expect(html).toContain('data-action="rf-restore-checkpoint"');
  });
});

describe("appendRestoreOperationsToDraft", () => {
  it("applies operations without publishing or mutating the input draft", () => {
    const draft = createRetaFinalDraft(plan(), { draftId: "draft-1", now: AGORA });
    const before = JSON.stringify(draft);
    const result = appendRestoreOperationsToDraft(
      draft,
      [
        {
          operationId: "op-1",
          type: "PATCH",
          blockIds: ["rf-1"],
          patch: { minutos: 30 },
        },
      ],
      { events: [], catalog: catalog(), today: HOJE },
    );
    expect(result.valid).toBe(true);
    expect(result.draft.snapshot.retaFinal.blocos[0].minutos).toBe(30);
    expect(JSON.stringify(draft)).toBe(before);
  });

  it("rejects the whole batch when one operation is invalid", () => {
    const draft = createRetaFinalDraft(plan(), { draftId: "draft-1", now: AGORA });
    const result = appendRestoreOperationsToDraft(
      draft,
      [
        {
          operationId: "op-1",
          type: "PATCH",
          blockIds: ["rf-1"],
          patch: { minutos: 30 },
        },
        {
          operationId: "op-2",
          type: "PATCH",
          blockIds: ["missing"],
          patch: { minutos: 10 },
        },
      ],
      { events: [], catalog: catalog(), today: HOJE },
    );
    expect(result.valid).toBe(false);
    expect(result.draft).toBe(draft);
  });
});

describe("restoreRetaFinalCheckpoint", () => {
  it("restores the full checkpoint into the draft and preserves events", () => {
    const current = plan(4, [block("rf-1", { minutos: 60 })]);
    const draft = createRetaFinalDraft(current, { draftId: "draft-1", now: AGORA });
    const events = [
      { id: "ev-1", rfBlocoId: "rf-1", status: "estudei", tempoAcumulado: 900 },
    ];
    const snapshotEvents = JSON.stringify(events);
    const result = restoreRetaFinalCheckpoint(checkpoint(1), {
      draft,
      plan: current,
      events,
      catalog: catalog(),
      today: HOJE,
    });
    expect(result.valid).toBe(true);
    expect(result.proposal.operations.length).toBeGreaterThan(0);
    expect(result.draft.snapshot.retaFinal.blocos[0].minutos).toBe(30);
    expect(JSON.stringify(events)).toBe(snapshotEvents);
  });

  it("restores only the selected block", () => {
    const current = plan(4, [
      block("rf-1", { minutos: 60 }),
      block("rf-2", { minutos: 60 }),
    ]);
    const draft = createRetaFinalDraft(current, { draftId: "draft-1", now: AGORA });
    const result = restoreRetaFinalCheckpoint(
      checkpoint(1, [
        block("rf-1", { minutos: 30 }),
        block("rf-2", { minutos: 45 }),
      ]),
      {
        draft,
        plan: current,
        events: [],
        catalog: catalog(),
        today: HOJE,
        blockIds: ["rf-2"],
      },
    );
    expect(result.valid).toBe(true);
    expect(result.draft.snapshot.retaFinal.blocos[0].minutos).toBe(60);
    expect(result.draft.snapshot.retaFinal.blocos[1].minutos).toBe(45);
  });
});
