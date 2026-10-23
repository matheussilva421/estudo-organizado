import { afterEach, describe, expect, it } from "vitest";
import {
  buildRetaFinalEditorPatch,
  renderRetaFinalEditorForm,
  resolveRetaFinalEditorTopic,
} from "../../src/js/views/reta-final-editor-form.js";
import {
  handleRetaFinalEditField,
  openRetaFinalEditor,
} from "../../src/js/ui/actions/reta-final-editor.js";
import { createRetaFinalDraft } from "../../src/js/logic/reta-final-drafts.js";
import { createTransactionalIdb } from "./reta-final-draft-idb-helper.js";

const HOJE = "2026-10-22";
const AGORA = "2026-10-22T12:00:00.000Z";

function block(overrides = {}) {
  return {
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
    ...overrides,
  };
}

function plan(overrides = {}) {
  return {
    ativo: true,
    tipo: "reta_final",
    planId: "plan-1",
    schemaVersionRetaFinal: 2,
    revision: 3,
    updatedAt: AGORA,
    disciplinas: ["disc-1"],
    retaFinal: {
      nome: "Reta Final",
      dataFinal: "2026-12-31",
      minutosPadrao: 60,
      blocos: [block()],
      ...overrides,
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
          assuntos: [
            { id: "ass-1", nome: "Crimes contra a vida" },
            { id: "ass-2", nome: "Crimes contra o patrimônio" },
          ],
          aulas: [{ id: "aula-1", nome: "Aula 01" }],
        },
      ],
    },
  ];
}

function fakeDraft() {
  return createRetaFinalDraft(plan(), { draftId: "draft-1", now: AGORA });
}

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

describe("renderRetaFinalEditorForm", () => {
  it("renders the draft values and editable fields", () => {
    const html = renderRetaFinalEditorForm(fakeDraft(), "rf-1", {
      catalog: catalog(),
    });
    expect(html).toContain('data-rf-editor-form');
    expect(html).toContain('data-draft-id="draft-1"');
    expect(html).toContain('name="dataPlanejada"');
    expect(html).toContain('value="2026-10-22"');
    expect(html).toContain('name="minutos"');
    expect(html).toContain('value="60"');
    expect(html).toContain("Crimes contra a vida");
    expect(html).toContain('data-action="rf-editor-save"');
    expect(html).toContain('data-action="rf-editor-create-assunto"');
  });

  it("blocks structural fields while the block timer is active", () => {
    const html = renderRetaFinalEditorForm(fakeDraft(), "rf-1", {
      catalog: catalog(),
      activeTimerIds: new Set(["rf-1"]),
    });
    expect(html).toContain("Cronômetro ativo");
    expect(html).toMatch(/name="dataPlanejada"[^>]*disabled/);
    expect(html).toMatch(/name="minutos"[^>]*disabled/);
    expect(html).not.toMatch(/name="prioridade"[^>]*disabled/);
  });

  it("returns an empty string when the block is absent", () => {
    expect(renderRetaFinalEditorForm(fakeDraft(), "missing", {})).toBe("");
  });
});

describe("buildRetaFinalEditorPatch", () => {
  it("returns only fields that changed", () => {
    const result = buildRetaFinalEditorPatch(
      {
        dataPlanejada: "2026-10-25",
        minutos: "90",
        prioridade: "4",
        observacao: "Revisar",
        fixado: true,
      },
      block()
    );
    expect(result.errors).toEqual([]);
    expect(result.patch).toEqual({
      dataPlanejada: "2026-10-25",
      minutos: 90,
      prioridade: 4,
      observacao: "Revisar",
      fixado: true,
    });
  });

  it("rejects invalid dates, duration and priority", () => {
    const result = buildRetaFinalEditorPatch(
      {
        dataPlanejada: "2026-02-31",
        minutos: "0",
        prioridade: "9",
        ordem: "-1",
      },
      block()
    );
    expect(result.patch).toEqual({});
    expect(result.errors.length).toBe(4);
  });

  it("keeps the patch empty when nothing changed", () => {
    const result = buildRetaFinalEditorPatch(
      {
        dataPlanejada: HOJE,
        minutos: "60",
        prioridade: "",
        ordem: "0",
        observacao: "",
        fixado: false,
      },
      block()
    );
    expect(result).toEqual({ patch: {}, errors: [] });
  });
});

describe("resolveRetaFinalEditorTopic", () => {
  it("creates a draft-only intent for a brand new subject", () => {
    const result = resolveRetaFinalEditorTopic(catalog(), {
      discId: "disc-1",
      entity: "assunto",
      nome: "Crimes de trânsito",
      makeId: () => "ass-3",
    });
    expect(result.valid).toBe(true);
    expect(result.intent).toEqual({
      entity: "assunto",
      id: "ass-3",
      discId: "disc-1",
      nome: "Crimes de trânsito",
    });
    expect(result.ref).toEqual({ assId: "ass-3", aulaId: null });
    expect(catalog()[0].disciplinas[0].assuntos).toHaveLength(2);
  });

  it("does not create a duplicate by normalized name", () => {
    const result = resolveRetaFinalEditorTopic(catalog(), {
      discId: "disc-1",
      entity: "assunto",
      nome: "  crimes   contra a vida ",
      makeId: () => "ass-3",
    });
    expect(result.valid).toBe(true);
    expect(result.existing).toBe(true);
    expect(result.intent).toBeNull();
    expect(result.ref).toEqual({ assId: "ass-1", aulaId: null });
  });
});

describe("handleRetaFinalEditField", () => {
  function setup() {
    const idb = createTransactionalIdb({
      stores: { reta_final_drafts: new Map() },
    });
    return { idb, draft: fakeDraft() };
  }

  it("appends a PATCH to the draft and persists without touching the plan", async () => {
    const { idb, draft } = setup();
    const base = plan();
    const snapshot = JSON.stringify(base);
    await idb.database
      .transaction(["reta_final_drafts"], "readwrite")
      .objectStore("reta_final_drafts")
      .put(draft);

    const result = await handleRetaFinalEditField({
      draftId: draft.draftId,
      blockId: "rf-1",
      field: "dataPlanejada",
      value: "2026-10-25",
      db: idb.database,
      plan: base,
      editais: catalog(),
      eventos: [],
      today: HOJE,
    });
    expect(result.valid).toBe(true);
    expect(result.draft.operations).toHaveLength(1);
    expect(result.draft.snapshot.retaFinal.blocos[0].dataPlanejada).toBe(
      "2026-10-25"
    );
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it("rejects structural edits for a block with an active timer", async () => {
    const { idb, draft } = setup();
    await idb.database
      .transaction(["reta_final_drafts"], "readwrite")
      .objectStore("reta_final_drafts")
      .put(draft);
    const result = await handleRetaFinalEditField({
      draftId: draft.draftId,
      blockId: "rf-1",
      field: "minutos",
      value: "90",
      db: idb.database,
      plan: plan(),
      editais: catalog(),
      eventos: [],
      today: HOJE,
      activeTimerIds: new Set(["rf-1"]),
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toMatch(/timer|cronômetro/i);
  });

  it("adjusts topics when the discipline changes", async () => {
    const { idb, draft } = setup();
    await idb.database
      .transaction(["reta_final_drafts"], "readwrite")
      .objectStore("reta_final_drafts")
      .put(draft);
    const base = plan();
    base.retaFinal.blocos[0].discId = "disc-1";
    const editais = catalog();
    editais[0].disciplinas.push({
      id: "disc-2",
      nome: "Direito Civil",
      assuntos: [{ id: "ass-9", nome: "Contratos" }],
      aulas: [],
    });
    const result = await handleRetaFinalEditField({
      draftId: draft.draftId,
      blockId: "rf-1",
      field: "discId",
      value: "disc-2",
      db: idb.database,
      plan: base,
      editais,
      eventos: [],
      today: HOJE,
    });
    expect(result.valid).toBe(true);
    expect(result.adjusted).toBe(true);
    expect(result.draft.snapshot.retaFinal.blocos[0].discId).toBe("disc-2");
    expect(result.draft.snapshot.retaFinal.blocos[0].topicos).toEqual([
      { assId: "ass-9", aulaId: null },
    ]);
  });

  it("keeps the in-memory draft unchanged when persistence fails", async () => {
    const { idb, draft } = setup();
    idb.failNextWrite();
    const result = await handleRetaFinalEditField({
      draftId: draft.draftId,
      blockId: "rf-1",
      field: "minutos",
      value: "90",
      db: idb.database,
      plan: plan(),
      editais: catalog(),
      eventos: [],
      today: HOJE,
      draft,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("DRAFT_SAVE_FAILED");
    expect(result.draft.snapshot.retaFinal.blocos[0].minutos).toBe(60);
  });

  it("derives an active timer from events for the editor form", async () => {
    const idb = createTransactionalIdb({
      stores: { reta_final_drafts: new Map() },
    });
    await openRetaFinalEditor("rf-1", {
      plan: plan(),
      editais: catalog(),
      eventos: [{ id: "ev-1", rfBlocoId: "rf-1", _timerStart: 123 }],
      db: idb.database,
      today: HOJE,
    });
    expect(document.querySelector("[data-rf-detail-panel]").textContent).toContain(
      "Cronômetro ativo"
    );
  });

  it("recreates an applied draft instead of reusing it", async () => {
    const idb = createTransactionalIdb({
      stores: { reta_final_drafts: new Map() },
    });
    const applied = { ...fakeDraft(), state: "applied" };
    await idb.database
      .transaction(["reta_final_drafts"], "readwrite")
      .objectStore("reta_final_drafts")
      .put(applied);
    await openRetaFinalEditor("rf-1", {
      plan: plan(),
      editais: catalog(),
      eventos: [],
      db: idb.database,
      today: HOJE,
      draftId: "draft-1",
    });
    expect(idb.getRecord("reta_final_drafts", "draft-1").state).toBe("editing");
    expect(document.querySelector("[data-rf-editor-form]")).toBeTruthy();
  });
});

describe("openRetaFinalEditor", () => {
  it("opens the panel and restores the persisted draft after closing", async () => {
    const idb = createTransactionalIdb({
      stores: { reta_final_drafts: new Map() },
    });
    await openRetaFinalEditor("rf-1", {
      plan: plan(),
      editais: catalog(),
      eventos: [],
      db: idb.database,
      today: HOJE,
    });
    expect(document.querySelector("[data-rf-detail-panel]")).toBeTruthy();
    await handleRetaFinalEditField({
      blockId: "rf-1",
      field: "observacao",
      value: "Rascunho sobrevive",
      db: idb.database,
      plan: plan(),
      editais: catalog(),
      eventos: [],
      today: HOJE,
    });
    document.querySelector("[data-rf-detail-overlay]").remove();
    await openRetaFinalEditor("rf-1", {
      plan: plan(),
      editais: catalog(),
      eventos: [],
      db: idb.database,
      today: HOJE,
    });
    expect(document.querySelector("[data-rf-detail-panel]").textContent).toContain(
      "Rascunho sobrevive"
    );
  });
});
