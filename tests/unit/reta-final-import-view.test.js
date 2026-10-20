import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportRetaFinalPortable } from "../../src/js/logic/reta-final-portable.js";

const mocks = vi.hoisted(() => ({
  state: { editais: [], eventos: [], planejamento: null },
  db: {},
  app: { openModal: vi.fn(), closeModal: vi.fn(), showToast: vi.fn() },
  saveDraft: vi.fn(async (_db, draft) => draft),
  activate: vi.fn(),
  invalidateDiscCache: vi.fn(),
  invalidateDashCaches: vi.fn(),
  renderCurrentView: vi.fn(),
  uid: vi.fn(() => "draft-id"),
}));

vi.mock("../../src/js/app.js?v=8.37", () => mocks.app);
vi.mock("../../src/js/components.js?v=8.37", () => ({
  renderCurrentView: mocks.renderCurrentView,
}));
vi.mock("../../src/js/logic.js?v=8.37", () => ({
  invalidateDiscCache: mocks.invalidateDiscCache,
  invalidateDashCaches: mocks.invalidateDashCaches,
}));
vi.mock("../../src/js/store.js?v=8.37", () => ({
  db: mocks.db,
  saveRetaFinalDraft: mocks.saveDraft,
  state: mocks.state,
}));
vi.mock("../../src/js/utils.js?v=8.37", () => ({
  esc: (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    ),
  todayStr: () => "2026-10-20",
  uid: mocks.uid,
}));
vi.mock("../../src/js/logic/reta-final.js", () => ({
  activateRetaFinal: mocks.activate,
}));

function plan() {
  return {
    ativo: true,
    tipo: "reta_final",
    planId: "plan-1",
    schemaVersionRetaFinal: 2,
    revision: 4,
    updatedAt: "2026-10-20T10:00:00.000Z",
    retaFinal: {
      nome: "Reta Final",
      dataFinal: "2026-11-30",
      minutosPadrao: 60,
      blocos: [
        {
          id: "rf-1",
          discId: "disc-1",
          topicos: [{ assId: "ass-1", aulaId: null }],
          minutos: 60,
          ordem: 0,
          dataPlanejada: "2026-10-21",
          dataOriginal: "2026-10-21",
          data: "2026-10-21",
          status: "pendente",
          rolagens: 0,
        },
        {
          id: "rf-absent",
          discId: "disc-1",
          topicos: [{ assId: "ass-1", aulaId: null }],
          minutos: 45,
          ordem: 1,
          dataPlanejada: "2026-10-22",
          dataOriginal: "2026-10-22",
          data: "2026-10-22",
          status: "pendente",
          rolagens: 0,
        },
      ],
    },
  };
}

let view;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.state.editais = [
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
  mocks.state.eventos = [{ id: "ev-1", status: "estudei", rfBlocoId: "rf-1" }];
  mocks.state.planejamento = plan();
  document.body.innerHTML = `
    <div id="modal-prompt">
      <h2 id="modal-prompt-title"></h2>
      <div id="modal-prompt-body"></div>
      <button id="modal-prompt-save">Salvar</button>
    </div>
  `;
  view = await import("../../src/js/views/reta-final-import.js");
});

describe("importação supervisionada da Reta Final ativa", () => {
  it("salva um draft da comparação e mantém plano e eventos oficiais intactos", async () => {
    const officialBefore = structuredClone(mocks.state.planejamento);
    const eventsBefore = structuredClone(mocks.state.eventos);
    const payload = exportRetaFinalPortable(mocks.state.planejamento);
    payload.blocos = payload.blocos.filter((block) => block.id !== "rf-absent");
    payload.blocos[0].minutos = 90;

    expect(view.openRetaFinalPreview(payload)).toBe(true);

    const saveButton = document.getElementById("modal-prompt-save");
    expect(document.getElementById("modal-prompt-title").textContent).toBe(
      "Comparar Reta Final",
    );
    expect(saveButton.textContent).toBe("Criar rascunho");
    expect(saveButton.disabled).toBe(false);
    await saveButton.onclick();

    expect(mocks.activate).not.toHaveBeenCalled();
    expect(mocks.saveDraft).toHaveBeenCalledOnce();
    const [database, draft] = mocks.saveDraft.mock.calls[0];
    expect(database).toBe(mocks.db);
    expect(
      draft.snapshot.retaFinal.blocos.find((block) => block.id === "rf-1")
        .minutos,
    ).toBe(90);
    expect(
      draft.snapshot.retaFinal.blocos.find((block) => block.id === "rf-absent")
        .arquivado,
    ).not.toBe(true);
    expect(draft.operations.map((operation) => operation.command.type)).toEqual(
      ["PATCH"],
    );
    expect(draft.importComparison.pendingImportCommands).toEqual([
      expect.objectContaining({ type: "ARCHIVE", blockIds: ["rf-absent"] }),
    ]);
    expect(mocks.state.planejamento).toEqual(officialBefore);
    expect(mocks.state.eventos).toEqual(eventsBefore);
    expect(mocks.renderCurrentView).not.toHaveBeenCalled();
  });

  it("rejects a v2 payload without an active v2 plan before the legacy activation path", () => {
    mocks.state.planejamento = { ...plan(), ativo: false };
    const payload = exportRetaFinalPortable(plan());

    expect(view.openRetaFinalPreview(payload)).toBe(false);
    expect(mocks.activate).not.toHaveBeenCalled();
    expect(mocks.app.showToast).toHaveBeenCalledWith(
      "JSON v2 só pode ser comparado com uma Reta Final v2 ativa.",
      "error",
    );
  });

  it("keeps the legacy v1 initial-import route reaching activation", () => {
    mocks.state.planejamento = { ...plan(), ativo: false };
    const legacy = {
      versao: 1,
      nome: "Reta Final legada",
      dataFinal: "2026-11-30",
      minutosPadrao: 60,
      dias: [
        {
          data: "2026-10-21",
          blocos: [{ disciplina: "Direito Penal", topicos: ["Crimes"] }],
        },
      ],
    };

    expect(view.openRetaFinalPreview(legacy)).toBe(true);
    expect(document.getElementById("modal-prompt-save").textContent).toBe(
      "Ativar Reta Final",
    );
    document.getElementById("modal-prompt-save").onclick();

    expect(mocks.activate).toHaveBeenCalledOnce();
    expect(mocks.activate).toHaveBeenCalledWith({ payload: legacy });
    expect(mocks.saveDraft).not.toHaveBeenCalled();
  });
});
