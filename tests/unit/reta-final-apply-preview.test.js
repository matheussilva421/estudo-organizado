import { describe, expect, it } from "vitest";
import {
  buildRetaFinalImpactPreview,
  renderRetaFinalApplyPreview,
} from "../../src/js/views/reta-final-apply-preview.js";
import { applyRetaFinalDraftAction } from "../../src/js/ui/actions/reta-final-apply.js";
import {
  appendRetaFinalDraftOperation,
  createRetaFinalDraft,
} from "../../src/js/logic/reta-final-drafts.js";
import { createLocalStateEnvelope } from "../../src/js/store/normalize-state.js";
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
    revision: 4,
    updatedAt: "2026-10-21T10:00:00.000Z",
    retaFinal: {
      dataFinal: "2026-11-30",
      minutosPadrao: 60,
      blocos: [block()],
    },
    ...overrides,
  };
}

function catalog() {
  return [
    {
      id: "ed-1",
      disciplinas: [
        {
          id: "disc-1",
          nome: "Direito Administrativo",
          assuntos: [{ id: "ass-1", nome: "Atos administrativos" }],
          aulas: [],
        },
      ],
    },
  ];
}

function draftWith(patch = { minutos: 90 }) {
  const draft = createRetaFinalDraft(plan(), { draftId: "draft-1", now: AGORA });
  const result = appendRetaFinalDraftOperation(
    draft,
    { operationId: "op-1", type: "PATCH", blockIds: ["rf-1"], patch },
    { today: HOJE, events: [], catalog: catalog() }
  );
  if (!result.valid) throw new Error("draft setup failed");
  return result.draft;
}

describe("buildRetaFinalImpactPreview", () => {
  it("blocks a draft with no changes", () => {
    const draft = createRetaFinalDraft(plan(), {
      draftId: "draft-empty",
      now: AGORA,
    });
    const preview = buildRetaFinalImpactPreview({
      basePlan: plan(),
      draft,
      catalog: catalog(),
      today: HOJE,
    });
    expect(preview.status).toBe("ready");
    expect(preview.blocked).toBe(true);
    expect(preview.diagnostics[0].code).toBe("SEM_ALTERACOES");
  });

  it("blocks a changed date that became past", () => {
    const preview = buildRetaFinalImpactPreview({
      basePlan: plan(),
      draft: draftWith({ dataPlanejada: "2026-10-21" }),
      catalog: catalog(),
      today: HOJE,
    });
    expect(preview.blocked).toBe(true);
    expect(preview.diagnostics.some((item) => item.code === "DATA_PASSADA")).toBe(
      true
    );
  });

  it("accepts draft-only catalog intents when validating", () => {
    const draft = createRetaFinalDraft(plan(), {
      draftId: "draft-new-topic",
      now: AGORA,
    });
    const intent = {
      entity: "assunto",
      id: "ass-novo",
      discId: "disc-1",
      nome: "Assunto novo",
    };
    draft.catalogIntents = [intent];
    const appended = appendRetaFinalDraftOperation(
      draft,
      {
        operationId: "op-new",
        type: "PATCH",
        blockIds: ["rf-1"],
        patch: { topicos: [{ assId: "ass-novo", aulaId: null }] },
      },
      {
        today: HOJE,
        events: [],
        catalog: catalog(),
        catalogIntents: [intent],
      }
    );
    expect(appended.valid).toBe(true);
    const preview = buildRetaFinalImpactPreview({
      basePlan: plan(),
      draft: appended.draft,
      catalog: catalog(),
      today: HOJE,
    });
    expect(preview.status).toBe("ready");
    expect(preview.blocked).toBe(false);
  });

  it("derives day impact from the projection", () => {
    const preview = buildRetaFinalImpactPreview({
      basePlan: plan(),
      draft: draftWith({ minutos: 120 }),
      catalog: catalog(),
      today: HOJE,
    });
    expect(preview.dayImpact.simulated.length).toBeGreaterThan(0);
    expect(preview.dayImpact.simulated[0].date).toBe(HOJE);
  });

  it("compares official and simulated metrics without mutating the plan", () => {
    const base = plan();
    const snapshot = JSON.stringify(base);
    const preview = buildRetaFinalImpactPreview({
      basePlan: base,
      draft: draftWith({ minutos: 120 }),
      events: [],
      catalog: catalog(),
      today: HOJE,
    });
    expect(preview.status).toBe("ready");
    expect(preview.blocked).toBe(false);
    expect(preview.officialMetrics.header.totalMinutos).toBeGreaterThan(0);
    expect(preview.simulatedMetrics.header.totalMinutos).toBe(
      preview.officialMetrics.header.totalMinutos + 60
    );
    expect(preview.diff[0].blockId).toBe("rf-1");
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it("blocks stale drafts", () => {
    const stale = plan({ revision: 5 });
    const preview = buildRetaFinalImpactPreview({
      basePlan: stale,
      draft: draftWith(),
      catalog: catalog(),
      today: HOJE,
    });
    expect(preview.status).toBe("stale");
    expect(preview.blocked).toBe(true);
    expect(preview.diagnostics[0].code).toBe("BASE_STALE");
  });

  it("reports unallocated blocks without deleting them", () => {
    const draft = draftWith({ minutos: 90 });
    draft.snapshot.retaFinal.blocos[0].naoAlocado = true;
    const preview = buildRetaFinalImpactPreview({
      basePlan: plan(),
      draft,
      catalog: catalog(),
      today: HOJE,
    });
    expect(preview.unallocated).toEqual([{ id: "rf-1", motivo: "não alocado" }]);
    expect(draft.snapshot.retaFinal.blocos).toHaveLength(1);
  });
});

describe("renderRetaFinalApplyPreview", () => {
  it("shows both metrics and never claims a remote sync", () => {
    const preview = buildRetaFinalImpactPreview({
      basePlan: plan(),
      draft: draftWith({ minutos: 120 }),
      catalog: catalog(),
      today: HOJE,
    });
    const html = renderRetaFinalApplyPreview(preview, { draftId: "draft-1" });
    expect(html).toContain("Oficial × simulado");
    expect(html).toContain('data-action="rf-apply-draft"');
    expect(html).toContain("Aplicar localmente");
    expect(html).toContain("pendente");
    expect(html).not.toMatch(/>\s*Sincronizado\s*</i);
    expect(html).toContain("Blocos alterados (1)");
  });

  it("disables apply when the draft is blocked", () => {
    const preview = buildRetaFinalImpactPreview({
      basePlan: plan({ revision: 5 }),
      draft: draftWith(),
      catalog: catalog(),
      today: HOJE,
    });
    const html = renderRetaFinalApplyPreview(preview, { draftId: "draft-1" });
    expect(html).toMatch(/data-action="rf-apply-draft"[^>]*disabled/);
    expect(html).toContain("Aplicação bloqueada");
  });
});

describe("applyRetaFinalDraftAction", () => {
  function appState() {
    return {
      schemaVersion: 12,
      planejamento: plan(),
      planejamentoArquivado: null,
      eventos: [],
      editais: catalog(),
      config: {},
    };
  }

  function idbFor(draft) {
    const state = appState();
    const current = createLocalStateEnvelope(state, {
      slot: "current",
      savedAt: "2026-10-21T10:00:00.000Z",
    });
    const previous = createLocalStateEnvelope(state, {
      slot: "previous",
      savedAt: "2026-10-20T10:00:00.000Z",
    });
    return createTransactionalIdb({
      stores: {
        app_state: {
          main_state_current: current,
          main_state_previous: previous,
          main_state: state,
        },
        reta_final_drafts: { [draft.draftId]: draft },
        reta_final_journal: {},
      },
      keyPaths: { reta_final_drafts: "draftId", reta_final_journal: "id" },
    });
  }

  it("commits locally once and keeps sync pending", async () => {
    const draft = draftWith({ minutos: 90 });
    const idb = idbFor(draft);
    const result = await applyRetaFinalDraftAction(draft.draftId, {
      db: idb.database,
      plan: plan(),
      editais: catalog(),
      eventos: [],
      today: HOJE,
    });
    expect(result.localCommitted).toBe(true);
    expect(result.syncPending).toBe(true);
    const stored = idb.getRecord("reta_final_drafts", draft.draftId);
    expect(stored.state).toBe("applied");
    expect(stored.appliedResult.revision).toBe(5);
    expect(
      idb.getRecord("app_state", "main_state_current").payload.planejamento.revision
    ).toBe(5);
  });

  it("rejects a blocked draft without writing", async () => {
    const draft = draftWith({ minutos: 90 });
    const idb = idbFor(draft);
    const result = await applyRetaFinalDraftAction(draft.draftId, {
      db: idb.database,
      plan: plan({ revision: 5 }),
      editais: catalog(),
      eventos: [],
      today: HOJE,
    });
    expect(result.localCommitted).toBe(false);
    expect(result.errors[0].code).toBe("BASE_STALE");
    expect(idb.getRecord("reta_final_drafts", draft.draftId).state).toBe("editing");
  });
});
