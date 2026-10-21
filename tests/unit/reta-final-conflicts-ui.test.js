import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectRetaFinalConflicts,
  removeRetaFinalConflict,
  renderRetaFinalConflictReview,
} from "../../src/js/views/reta-final-conflicts.js";
import {
  registerRetaFinalConflictActions,
  resolveRetaFinalConflict,
} from "../../src/js/ui/actions/reta-final-conflicts.js";
import { actions } from "../../src/js/ui/actions/dispatcher.js";
import { resolveRetaFinalConflictAtomically } from "../../src/js/store/reta-final-commit.js";
import { createLocalStateEnvelope } from "../../src/js/store/normalize-state.js";
import { retaFinalDigest } from "../../src/js/logic/reta-final-drafts.js";
import { computeRetaFinalPlanDigest } from "../../src/js/sync/reta-final-protocol.js";
import { createTransactionalIdb } from "./reta-final-draft-idb-helper.js";

const NOW = "2026-10-21T12:00:00.000Z";
const TODAY = "2026-10-21";

function block(id, overrides = {}) {
  return {
    id,
    discId: "disc-1",
    topicos: [{ assId: "ass-1", aulaId: null }],
    minutos: 60,
    status: "pendente",
    ordem: 0,
    dataOriginal: TODAY,
    dataPlanejada: TODAY,
    data: TODAY,
    rolagens: 0,
    ...overrides,
  };
}

function plan({
  revision = 4,
  planId = "plan-1",
  ativo = true,
  blocks = [block("rf-1")],
} = {}) {
  return {
    ativo,
    tipo: "reta_final",
    planId,
    schemaVersionRetaFinal: 2,
    revision,
    updatedAt: "2026-10-20T10:00:00.000Z",
    disciplinas: ["disc-1"],
    retaFinal: {
      dataFinal: "2026-11-30",
      minutosPadrao: 60,
      blocos: blocks,
    },
  };
}

function catalog() {
  return [
    {
      id: "edital-1",
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

function firestoreConflict(overrides = {}) {
  const basePlan = plan({
    revision: 3,
    blocks: [block("rf-1", { minutos: 45 })],
  });
  const localPlan = plan({
    revision: 4,
    blocks: [block("rf-1", { minutos: 60 })],
  });
  const remotePlan = plan({
    revision: 7,
    blocks: [block("rf-1", { minutos: 90 })],
  });
  return {
    type: "reta-final-conflict",
    cause: "merge-review",
    basePlan,
    localPlan,
    remotePlan,
    proposedPlan: plan({
      revision: 7,
      blocks: [block("rf-1", { minutos: 75 })],
    }),
    mergeConflicts: [
      {
        planId: "plan-1",
        blockId: "rf-1",
        fieldPath: "retaFinal.blocos.rf-1.minutos",
        base: 45,
        local: 60,
        remote: 90,
        reason: "O mesmo campo do bloco foi alterado de formas diferentes.",
      },
    ],
    mergeValid: false,
    detectedAt: "2026-10-21T11:00:00.000Z",
    remoteUpdatedAt: "2026-10-21T10:00:00.000Z",
    reason:
      "A Reta Final v2 remota exige reconciliacao humana antes de nova escrita.",
    ...overrides,
  };
}

function appState({
  conflict = firestoreConflict(),
  extraConfig = {},
  topConfig = {},
} = {}) {
  const state = {
    schemaVersion: 12,
    planejamento: plan(),
    planejamentoArquivado: null,
    eventos: [
      {
        id: "ev-1",
        titulo: "Estudo de Atos",
        rfBlocoId: "rf-1",
        status: "estudei",
        tempoAcumulado: 3600,
        questoes: 12,
      },
    ],
    editais: catalog(),
    revisoes: [{ id: "rev-1", discId: "disc-1" }],
    habitos: { diarios: [{ id: "hab-1" }] },
    arquivo: [{ id: "arch-1" }],
    config: {
      firestoreSync: {
        enabled: true,
        mode: "primary",
        conflict,
        basePlan: conflict?.basePlan || null,
        baseRevision: conflict?.basePlan?.revision ?? 3,
        baseDigest: conflict?.basePlan
          ? computeRetaFinalPlanDigest(conflict.basePlan)
          : null,
        baseRemoteUpdatedAt: "2026-10-21T10:00:00.000Z",
        removedBlocks: [{ id: "rf-old", revision: 2 }],
        minRetainedRevision: 2,
        hasPendingWrites: true,
        lastPushAt: null,
        lastError: "Conflito Reta Final: merge-review.",
        remoteUpdatedAt: "2026-10-21T10:00:00.000Z",
        ...extraConfig,
      },
    },
  };
  state.config = { ...state.config, ...topConfig };
  return state;
}

function idbFor(state) {
  const current = createLocalStateEnvelope(state, {
    slot: "current",
    savedAt: "2026-10-21T10:00:00.000Z",
  });
  const previous = createLocalStateEnvelope(appState(), {
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
      reta_final_drafts: {},
      reta_final_journal: {},
    },
    keyPaths: { reta_final_drafts: "draftId", reta_final_journal: "id" },
  });
}

function readState(idb) {
  return idb.getRecord("app_state", "main_state_current")?.payload;
}

function journal(idb) {
  return (idb.journalKeys?.() || []).map((key) =>
    idb.getRecord("reta_final_journal", key),
  );
}

function renderInto(items) {
  document.body.innerHTML = "";
  const host = document.createElement("div");
  host.innerHTML = renderRetaFinalConflictReview(items);
  document.body.appendChild(host);
  return host;
}

function eventStub() {
  return { preventDefault() {}, stopPropagation() {} };
}

async function invokeAction(name, element) {
  const handler = actions[name];
  expect(typeof handler).toBe("function");
  return handler(element, eventStub());
}

beforeEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Reta Final conflict review view", () => {
  it("compares base/local/remote and escapes HTML and attributes", () => {
    const state = appState({
      conflict: firestoreConflict({
        reason: '<script>alert(1)</script> "quoted"',
        remotePlan: plan({
          revision: 7,
          blocks: [
            block("rf-1", {
              minutos: 90,
              observacao: "<img src=x onerror=alert(1)>",
            }),
          ],
        }),
      }),
    });
    const conflicts = collectRetaFinalConflicts(state);

    const html = renderRetaFinalConflictReview(conflicts);

    expect(html).toContain("data-rf-conflict-review");
    expect(html).toContain("Base");
    expect(html).toContain("Local");
    expect(html).toContain("Remoto");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&quot;quoted&quot;");
    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend>");
    expect(html).toContain('type="radio"');
    expect(html).toContain("min-height:44px");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("onclick=");
    expect(html).not.toContain("onkeydown=");
  });

  it("puts Cancel first in the focus flow and never makes Apply the default action", () => {
    const html = renderRetaFinalConflictReview(
      collectRetaFinalConflicts(appState()),
    );
    const cancelIndex = html.indexOf('data-action="rf-conflict-cancel"');
    const firstRadio = html.indexOf('type="radio"');
    const applyIndex = html.indexOf('data-action="rf-conflict-apply"');

    expect(cancelIndex).toBeGreaterThan(-1);
    expect(cancelIndex).toBeLessThan(firstRadio);
    expect(applyIndex).toBeGreaterThan(firstRadio);
    expect(html).not.toMatch(/<button[^>]*autofocus/);
  });

  it("returns an empty string when there is no conflict", () => {
    expect(renderRetaFinalConflictReview([])).toBe("");
    expect(renderRetaFinalConflictReview({ config: {} })).toBe("");
    expect(collectRetaFinalConflicts({ config: {} })).toEqual([]);
  });

  it("shows complete long values and the main plan fields", () => {
    const longValue = "x".repeat(220);
    const conflict = firestoreConflict({
      basePlan: plan({
        revision: 3,
        blocks: [block("rf-1", { observacao: longValue })],
      }),
    });
    const html = renderRetaFinalConflictReview(appState({ conflict }));

    expect(html).toContain("Ver completo");
    expect(html).toContain(longValue);
    expect(html).toContain("minutosPadrao");
    expect(html).toContain("disciplinas");
  });

  it("normalizes both conflict sources into stable unique ids and keeps duplicates", () => {
    const state = appState({
      conflict: null,
      topConfig: {
        syncMergeConflicts: {
          type: "reta-final-three-way",
          items: [
            {
              planId: "plan-1",
              blockId: "rf-1",
              fieldPath: "retaFinal.blocos.rf-1.minutos",
              base: 45,
              local: 60,
              remote: 90,
              reason: "a",
            },
            {
              planId: "plan-1",
              blockId: "rf-1",
              fieldPath: "retaFinal.blocos.rf-1.minutos",
              base: 45,
              local: 75,
              remote: 90,
              reason: "b",
            },
          ],
        },
      },
    });

    const conflicts = collectRetaFinalConflicts(state);

    expect(conflicts).toHaveLength(2);
    expect(conflicts[0].conflictId).toMatch(
      /^reta-final:three-way:plan-1:rf-1:/,
    );
    expect(conflicts[1].conflictId).not.toBe(conflicts[0].conflictId);
    expect(conflicts.map((item) => item.conflictId)).toEqual([
      ...new Set(conflicts.map((item) => item.conflictId)),
    ]);
  });

  it("normalizes a legacy merge-collision parent without syncMergeConflicts", async () => {
    const source = appState({
      extraConfig: {
        conflict: {
          reason: "merge-collision",
          detectedAt: NOW,
          remoteUpdatedAt: NOW,
          items: [
            {
              planId: "plan-1",
              blockId: "rf-1",
              fieldPath: "retaFinal.blocos.rf-1.minutos",
              base: 45,
              local: 60,
              remote: 90,
              reason: "colisao",
            },
          ],
        },
      },
    });

    const items = collectRetaFinalConflicts(source);
    const mergeItems = items.filter((item) => item.source === "merge");
    expect(mergeItems).toHaveLength(1);
    expect(() => renderRetaFinalConflictReview(source)).not.toThrow();

    const idb = idbFor(source);
    await resolveRetaFinalConflictAtomically({
      db: idb.database,
      conflictId: mergeItems[0].conflictId,
      choice: "local",
      expectedPlanId: "plan-1",
      expectedRevision: source.planejamento.revision,
      now: NOW,
      deviceId: "device-a",
    });
    const persisted = readState(idb);
    expect(persisted.config.firestoreSync.conflict).toBeNull();
    expect(persisted.config.syncMergeConflicts).toBeUndefined();
  });

  it("removes only the requested conflict and preserves the other one", () => {
    const state = appState({
      topConfig: {
        syncMergeConflicts: {
          type: "reta-final-three-way",
          items: [
            {
              planId: "plan-1",
              blockId: "rf-1",
              fieldPath: "retaFinal.blocos.rf-1.minutos",
              base: 45,
              local: 60,
              remote: 90,
              reason: "a",
            },
          ],
        },
      },
    });
    const [firestore, merge] = collectRetaFinalConflicts(state);

    const withoutMerge = removeRetaFinalConflict(state, merge.conflictId);

    expect(withoutMerge.config.firestoreSync.conflict).toBeTruthy();
    expect(withoutMerge.config.syncMergeConflicts).toBeUndefined();
    expect(collectRetaFinalConflicts(withoutMerge)).toHaveLength(1);
    expect(collectRetaFinalConflicts(withoutMerge)[0].conflictId).toBe(
      firestore.conflictId,
    );
  });
});

describe("Reta Final conflict actions", () => {
  let resolveMock;
  let confirmMock;
  let notifyMock;
  let refreshMock;

  beforeEach(() => {
    resolveMock = vi.fn(() =>
      Promise.resolve({ applied: true, syncStatus: "pending" }),
    );
    confirmMock = vi.fn((_message, onYes) => onYes());
    notifyMock = vi.fn();
    refreshMock = vi.fn();
    registerRetaFinalConflictActions({
      resolve: resolveMock,
      confirm: confirmMock,
      notify: notifyMock,
      refresh: refreshMock,
    });
  });

  it("cancels without writing or resolving the conflict", async () => {
    const host = renderInto(collectRetaFinalConflicts(appState()));
    const cancel = host.querySelector('[data-action="rf-conflict-cancel"]');
    host.querySelector('input[value="local"]').checked = true;

    await invokeAction("rf-conflict-cancel", cancel);

    expect(resolveMock).not.toHaveBeenCalled();
    expect(confirmMock).not.toHaveBeenCalled();
    expect(host.querySelector('input[value="local"]').checked).toBe(false);
  });

  it("Escape cancels and no global Enter applies a choice", async () => {
    const host = renderInto(collectRetaFinalConflicts(appState()));
    const textarea = host.querySelector("textarea");
    host.querySelector('input[value="remote"]').checked = true;

    textarea.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await Promise.resolve();
    host.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await Promise.resolve();

    expect(resolveMock).not.toHaveBeenCalled();
    expect(confirmMock).not.toHaveBeenCalled();
    expect(host.querySelector('input[value="remote"]').checked).toBe(false);
  });

  it("requires an explicit choice before applying", async () => {
    const host = renderInto(collectRetaFinalConflicts(appState()));
    const apply = host.querySelector('[data-action="rf-conflict-apply"]');

    await invokeAction("rf-conflict-apply", apply);

    expect(resolveMock).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      expect.stringMatching(/escolha/i),
      "error",
    );
  });

  it("confirms before applying the local choice", async () => {
    const host = renderInto(collectRetaFinalConflicts(appState()));
    host.querySelector('input[value="local"]').checked = true;
    const apply = host.querySelector('[data-action="rf-conflict-apply"]');

    await invokeAction("rf-conflict-apply", apply);

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(resolveMock).toHaveBeenCalledWith(
      expect.stringMatching(/^reta-final:merge-review:plan-1:plan$/),
      { choice: "local", patch: undefined },
      expect.objectContaining({ confirmed: true }),
    );
  });

  it("does not apply invalid manual JSON", async () => {
    const host = renderInto(collectRetaFinalConflicts(appState()));
    host.querySelector('input[value="manual"]').checked = true;
    host.querySelector("textarea").value = "{ not-json";
    const apply = host.querySelector('[data-action="rf-conflict-apply"]');

    await invokeAction("rf-conflict-apply", apply);

    expect(resolveMock).not.toHaveBeenCalled();
    expect(confirmMock).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      expect.stringMatching(/JSON/i),
      "error",
    );
  });
});

describe("resolveRetaFinalConflictAtomically", () => {
  it("commits state, checkpoint and operation in one transaction and rebases on the remote", async () => {
    const source = appState();
    const idb = idbFor(source);

    const result = await resolveRetaFinalConflictAtomically({
      db: idb.database,
      conflictId: "reta-final:merge-review:plan-1:plan",
      choice: "local",
      expectedPlanId: "plan-1",
      expectedRevision: 4,
      now: NOW,
      deviceId: "device-a",
    });

    expect(result).toMatchObject({
      applied: true,
      revision: 8,
      localCommitted: true,
      syncPending: true,
    });
    const persisted = readState(idb);
    expect(persisted.planejamento.revision).toBe(8);
    expect(persisted.planejamento.retaFinal.blocos[0].minutos).toBe(60);
    expect(persisted.config.firestoreSync.conflict).toBeNull();
    expect(persisted.config.firestoreSync.baseRevision).toBe(7);
    expect(persisted.config.firestoreSync.basePlan.revision).toBe(7);
    expect(persisted.config.firestoreSync.baseDigest).toBe(
      computeRetaFinalPlanDigest(persisted.config.firestoreSync.basePlan),
    );
    expect(persisted.config.firestoreSync.hasPendingWrites).toBe(true);
    expect(persisted.config.firestoreSync.lastPushAt).toBeNull();
    expect(persisted.config.firestoreSync.lastError).toBeNull();
    expect(persisted.config.firestoreSync.removedBlocks).toEqual([
      { id: "rf-old", revision: 2 },
    ]);
    expect(persisted.config.firestoreSync.minRetainedRevision).toBe(2);
    expect(persisted.eventos).toEqual(source.eventos);
    expect(persisted.eventos[0].rfBlocoId).toBe("rf-1");
    expect(persisted.editais).toEqual(source.editais);
    expect(persisted.revisoes).toEqual(source.revisoes);
    expect(persisted.habitos).toEqual(source.habitos);
    expect(persisted.arquivo).toEqual(source.arquivo);
    const records = journal(idb);
    expect(records.map((record) => record.type).sort()).toEqual([
      "checkpoint",
      "conflict_resolution",
      "sync_intent",
    ]);
    const operation = records.find(
      (record) => record.type === "conflict_resolution",
    );
    expect(operation).toMatchObject({
      planId: "plan-1",
      choice: "local",
      baseRevision: 7,
      deviceId: "device-a",
      timestamp: NOW,
    });
    expect(operation.before.revision).toBe(4);
    expect(operation.after.revision).toBe(8);
    expect(
      records.find((record) => record.type === "checkpoint"),
    ).toMatchObject({
      planId: "plan-1",
      revision: 4,
      kind: "manual",
    });
  });

  it("keeps the conflict and the previous state when the transaction aborts", async () => {
    const source = appState();
    const idb = idbFor(source);
    const before = readState(idb);
    idb.failNextWriteInStore("reta_final_journal");

    await expect(
      resolveRetaFinalConflictAtomically({
        db: idb.database,
        conflictId: "reta-final:merge-review:plan-1:plan",
        choice: "local",
        expectedPlanId: "plan-1",
        expectedRevision: 4,
        now: NOW,
        deviceId: "device-a",
      }),
    ).rejects.toMatchObject({ name: "QuotaExceededError" });

    expect(readState(idb)).toEqual(before);
    expect(before.config.firestoreSync.conflict).toBeTruthy();
    expect(journal(idb)).toEqual([]);
  });

  it("rejects a concurrent local revision and preserves the newer version", async () => {
    const source = appState();
    source.planejamento = plan({ revision: 5 });
    const idb = idbFor(source);
    const before = readState(idb);

    await expect(
      resolveRetaFinalConflictAtomically({
        db: idb.database,
        conflictId: "reta-final:merge-review:plan-1:plan",
        choice: "local",
        expectedPlanId: "plan-1",
        expectedRevision: 4,
        now: NOW,
        deviceId: "device-a",
      }),
    ).rejects.toMatchObject({ code: "RETA_FINAL_STALE" });

    expect(readState(idb)).toEqual(before);
    expect(readState(idb).planejamento.revision).toBe(5);
    expect(journal(idb)).toEqual([]);
  });

  it("rejects an invalid manual patch without writing", async () => {
    const source = appState();
    const idb = idbFor(source);
    const before = readState(idb);

    await expect(
      resolveRetaFinalConflictAtomically({
        db: idb.database,
        conflictId: "reta-final:merge-review:plan-1:plan",
        choice: "manual",
        patch: { planId: "other-plan" },
        expectedPlanId: "plan-1",
        expectedRevision: 4,
        now: NOW,
        deviceId: "device-a",
      }),
    ).rejects.toMatchObject({ code: "RETA_FINAL_CONFLICT" });

    expect(readState(idb)).toEqual(before);
    expect(journal(idb)).toEqual([]);
  });

  it("refuses prototype-pollution field paths and manual patches", async () => {
    const source = appState({
      topConfig: {
        syncMergeConflicts: {
          type: "reta-final-three-way",
          detectedAt: NOW,
          total: 1,
          items: [
            {
              planId: "plan-1",
              blockId: "rf-1",
              fieldPath: "retaFinal.blocos.rf-1.__proto__.polluted",
              base: null,
              local: null,
              remote: true,
              reason: "inseguro",
            },
          ],
        },
      },
    });
    const item = collectRetaFinalConflicts(source).find((entry) =>
      entry.fieldPath.includes("__proto__"),
    );
    expect(item).toMatchObject({ resolvable: false });
    const idb = idbFor(source);
    const before = readState(idb);

    await expect(
      resolveRetaFinalConflictAtomically({
        db: idb.database,
        conflictId: item.conflictId,
        choice: "remote",
        expectedPlanId: "plan-1",
        expectedRevision: 4,
        now: NOW,
        deviceId: "device-a",
      }),
    ).rejects.toMatchObject({ code: "RETA_FINAL_CONFLICT" });
    expect(readState(idb)).toEqual(before);
    expect({}.polluted).toBeUndefined();

    const manual = await resolveRetaFinalConflict(
      "reta-final:merge-review:plan-1:plan",
      {
        choice: "manual",
        patch: JSON.parse('{"__proto__":{"polluted":true}}'),
      },
      {
        db: idb.database,
        state: source,
        confirmed: true,
        now: NOW,
        deviceId: "device-a",
      },
    );
    expect(manual).toMatchObject({ applied: false });
    expect({}.polluted).toBeUndefined();
  });

  it("allows keeping local when the remote plan is absent without inventing a base", async () => {
    const conflict = firestoreConflict({
      remotePlan: null,
      cause: "missing-remote-plan",
    });
    const source = appState({ conflict });
    const idb = idbFor(source);

    const result = await resolveRetaFinalConflictAtomically({
      db: idb.database,
      conflictId: "reta-final:missing-remote-plan:plan-1:plan",
      choice: "local",
      expectedPlanId: "plan-1",
      expectedRevision: 4,
      now: NOW,
      deviceId: "device-a",
    });

    expect(result.revision).toBe(5);
    const persisted = readState(idb);
    expect(persisted.config.firestoreSync.baseRevision).toBe(3);
    expect(persisted.config.firestoreSync.basePlan.planId).toBe("plan-1");
  });

  it("refuses manual resolution without a compatible remote", async () => {
    const conflict = firestoreConflict({
      remotePlan: null,
      cause: "missing-remote-plan",
    });
    const source = appState({ conflict });
    const idb = idbFor(source);
    const before = readState(idb);

    await expect(
      resolveRetaFinalConflictAtomically({
        db: idb.database,
        conflictId: "reta-final:missing-remote-plan:plan-1:plan",
        choice: "manual",
        patch: { retaFinal: { minutosPadrao: 90 } },
        expectedPlanId: "plan-1",
        expectedRevision: 4,
        now: NOW,
        deviceId: "device-a",
      }),
    ).rejects.toMatchObject({ code: "RETA_FINAL_CONFLICT" });

    expect(readState(idb)).toEqual(before);
    const html = renderRetaFinalConflictReview(source);
    expect(html).toMatch(/value="manual"[^>]*disabled/);
  });

  it("refuses adopting a remote plan older than the known base", async () => {
    const conflict = firestoreConflict({
      remotePlan: plan({ revision: 2 }),
    });
    const source = appState({ conflict });
    const idb = idbFor(source);
    const before = readState(idb);

    await expect(
      resolveRetaFinalConflictAtomically({
        db: idb.database,
        conflictId: "reta-final:merge-review:plan-1:plan",
        choice: "remote",
        expectedPlanId: "plan-1",
        expectedRevision: 4,
        now: NOW,
        deviceId: "device-a",
      }),
    ).rejects.toMatchObject({ code: "RETA_FINAL_CONFLICT" });

    expect(readState(idb)).toEqual(before);
  });

  it("refuses and disables remote/manual for a different plan lineage", async () => {
    const conflict = firestoreConflict({
      remotePlan: plan({ planId: "plan-2" }),
    });
    const source = appState({ conflict });
    const idb = idbFor(source);
    const before = readState(idb);

    await expect(
      resolveRetaFinalConflictAtomically({
        db: idb.database,
        conflictId: "reta-final:merge-review:plan-1:plan",
        choice: "remote",
        expectedPlanId: "plan-1",
        expectedRevision: 4,
        now: NOW,
        deviceId: "device-a",
      }),
    ).rejects.toMatchObject({ code: "RETA_FINAL_CONFLICT" });
    expect(readState(idb)).toEqual(before);

    const html = renderRetaFinalConflictReview(source);
    expect(html).toMatch(/value="remote"[^>]*disabled/);
    expect(html).toMatch(/value="manual"[^>]*disabled/);
  });

  it("refuses a merge-field resolution when the current value changed", async () => {
    const source = appState({
      topConfig: {
        syncMergeConflicts: {
          type: "reta-final-three-way",
          detectedAt: NOW,
          total: 1,
          items: [
            {
              planId: "plan-1",
              blockId: "rf-1",
              fieldPath: "retaFinal.blocos.rf-1.minutos",
              base: 45,
              local: 60,
              remote: 90,
              reason: "colisao",
            },
          ],
        },
      },
    });
    source.planejamento.retaFinal.blocos[0].minutos = 70;
    const item = collectRetaFinalConflicts(source).find(
      (entry) => entry.source === "merge",
    );
    const idb = idbFor(source);
    const before = readState(idb);

    await expect(
      resolveRetaFinalConflictAtomically({
        db: idb.database,
        conflictId: item.conflictId,
        choice: "remote",
        expectedPlanId: "plan-1",
        expectedRevision: 4,
        now: NOW,
        deviceId: "device-a",
      }),
    ).rejects.toMatchObject({ code: "RETA_FINAL_STALE" });
    expect(readState(idb)).toEqual(before);
  });

  it("adopts the remote plan with remote revision plus one and preserves local in a checkpoint", async () => {
    const source = appState();
    const idb = idbFor(source);

    const result = await resolveRetaFinalConflictAtomically({
      db: idb.database,
      conflictId: "reta-final:merge-review:plan-1:plan",
      choice: "remote",
      expectedPlanId: "plan-1",
      expectedRevision: 4,
      now: NOW,
      deviceId: "device-a",
    });

    expect(result.revision).toBe(8);
    const persisted = readState(idb);
    expect(persisted.planejamento.retaFinal.blocos[0].minutos).toBe(90);
    expect(persisted.eventos).toEqual(source.eventos);
    const checkpoint = journal(idb).find(
      (record) => record.type === "checkpoint",
    );
    expect(checkpoint.plan.retaFinal.blocos[0].minutos).toBe(60);
    const operation = journal(idb).find(
      (record) => record.type === "conflict_resolution",
    );
    expect(operation.choice).toBe("remote");
    expect(operation.baseRevision).toBe(7);
  });

  it("applies a valid manual patch on the proposed plan", async () => {
    const source = appState();
    const idb = idbFor(source);

    const result = await resolveRetaFinalConflictAtomically({
      db: idb.database,
      conflictId: "reta-final:merge-review:plan-1:plan",
      choice: "manual",
      patch: { retaFinal: { blocos: [block("rf-1", { minutos: 75 })] } },
      expectedPlanId: "plan-1",
      expectedRevision: 4,
      now: NOW,
      deviceId: "device-a",
    });

    expect(result.revision).toBe(8);
    expect(readState(idb).planejamento.retaFinal.blocos[0].minutos).toBe(75);
  });

  it("allows adopting a retired remote plan, but refuses to resurrect it from an active local", async () => {
    const conflict = firestoreConflict({
      remotePlan: plan({ revision: 7, ativo: false }),
      cause: "retirement-mismatch",
    });
    const source = appState({ conflict });
    const idb = idbFor(source);

    const adopted = await resolveRetaFinalConflictAtomically({
      db: idb.database,
      conflictId: "reta-final:retirement-mismatch:plan-1:plan",
      choice: "remote",
      expectedPlanId: "plan-1",
      expectedRevision: 4,
      now: NOW,
      deviceId: "device-a",
    });
    expect(adopted.revision).toBe(8);
    expect(readState(idb).planejamento.ativo).toBe(false);

    const localSource = appState({ conflict });
    const localIdb = idbFor(localSource);
    await expect(
      resolveRetaFinalConflictAtomically({
        db: localIdb.database,
        conflictId: "reta-final:retirement-mismatch:plan-1:plan",
        choice: "local",
        expectedPlanId: "plan-1",
        expectedRevision: 4,
        now: NOW,
        deviceId: "device-a",
      }),
    ).rejects.toMatchObject({ code: "RETA_FINAL_CONFLICT" });
    expect(readState(localIdb).config.firestoreSync.conflict).toBeTruthy();
  });

  it("does not resolve a conflict that was already removed", async () => {
    const source = appState();
    const idb = idbFor(source);
    await expect(
      resolveRetaFinalConflictAtomically({
        db: idb.database,
        conflictId: "reta-final:merge-review:plan-1:missing",
        choice: "local",
        expectedPlanId: "plan-1",
        expectedRevision: 4,
        now: NOW,
        deviceId: "device-a",
      }),
    ).rejects.toMatchObject({ code: "RETA_FINAL_CONFLICT" });
  });

  it("resolves one of several field conflicts and keeps the others", async () => {
    const mergeItems = [
      {
        planId: "plan-1",
        blockId: "rf-1",
        fieldPath: "retaFinal.blocos.rf-1.minutos",
        base: 45,
        local: 60,
        remote: 90,
        reason: "minutos",
      },
      {
        planId: "plan-1",
        blockId: "rf-1",
        fieldPath: "retaFinal.blocos.rf-1.observacao",
        base: null,
        local: "local",
        remote: "remote",
        reason: "observacao",
      },
    ];
    const source = appState({
      conflict: null,
      topConfig: {
        syncMergeConflicts: { type: "reta-final-three-way", items: mergeItems },
      },
    });
    const idb = idbFor(source);

    const result = await resolveRetaFinalConflictAtomically({
      db: idb.database,
      conflictId:
        "reta-final:three-way:plan-1:rf-1:retaFinal.blocos.rf-1.minutos",
      choice: "remote",
      expectedPlanId: "plan-1",
      expectedRevision: 4,
      now: NOW,
      deviceId: "device-a",
    });

    expect(result.applied).toBe(true);
    const persisted = readState(idb);
    expect(persisted.planejamento.retaFinal.blocos[0].minutos).toBe(90);
    expect(persisted.config.syncMergeConflicts.items).toHaveLength(1);
    expect(persisted.config.syncMergeConflicts.items[0].fieldPath).toContain(
      "observacao",
    );
    expect(persisted.config.firestoreSync.conflict).toBeNull();
  });
});

describe("resolveRetaFinalConflict (confirmation gate)", () => {
  it("refuses to write without explicit confirmation", async () => {
    const source = appState();
    const idb = idbFor(source);
    const before = readState(idb);

    const result = await resolveRetaFinalConflict(
      "reta-final:merge-review:plan-1:plan",
      { choice: "local" },
      { db: idb.database, state: source },
    );

    expect(result).toMatchObject({
      applied: false,
      reason: "CONFIRMATION_REQUIRED",
    });
    expect(readState(idb)).toEqual(before);
  });

  it("applies locally and reports pending, never synced", async () => {
    const source = appState();
    const idb = idbFor(source);

    const result = await resolveRetaFinalConflict(
      "reta-final:merge-review:plan-1:plan",
      { choice: "local" },
      {
        db: idb.database,
        state: source,
        confirmed: true,
        now: NOW,
        deviceId: "device-a",
      },
    );

    expect(result).toMatchObject({
      applied: true,
      revision: 8,
      syncStatus: "pending",
    });
    expect(readState(idb).config.firestoreSync.lastPushAt).toBeNull();
  });
});

describe("sync center integration", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../../src/js/sync/firestore-sync-engine.js?v=8.37");
  });

  it("renders the Reta Final review instead of the generic Firestore panel", async () => {
    vi.resetModules();
    const localPlan = plan({ revision: 4 });
    const conflict = {
      type: "reta-final-conflict",
      cause: "merge-review",
      detectedAt: NOW,
      remoteUpdatedAt: NOW,
      basePlan: plan({ revision: 3 }),
      localPlan,
      remotePlan: plan({ revision: 5 }),
      proposedPlan: localPlan,
      reason: "divergencia",
    };
    vi.doMock("../../src/js/sync/firestore-sync-engine.js?v=8.37", () => ({
      getFirestoreSyncStatus: () => ({
        configured: true,
        signedIn: true,
        enabled: true,
        mode: "primary",
        hasPendingWrites: true,
        conflict,
        lastPushAt: null,
        lastError: null,
      }),
    }));
    const store = await import("../../src/js/store.js?v=8.37");
    store.state.planejamento = localPlan;
    store.state.config = {
      ...(store.state.config || {}),
      firestoreSync: {
        ...(store.state.config?.firestoreSync || {}),
        conflict,
      },
    };

    const view =
      await import("../../src/js/views/config/sync-center.js?v=8.37");
    const html = view._renderFirestoreCard();

    expect(html).toContain('data-testid="rf-conflict-review"');
    expect(html).not.toContain('data-testid="firestore-sync-conflict"');
  });

  it("normalizes a legacy merge-collision parent and clears it with the last item", async () => {
    const mergeItem = {
      planId: "plan-1",
      blockId: "rf-1",
      fieldPath: "retaFinal.blocos.rf-1.minutos",
      base: 45,
      local: 60,
      remote: 90,
      reason: "colisao",
    };
    const parent = {
      reason: "merge-collision",
      detectedAt: NOW,
      remoteUpdatedAt: NOW,
      total: 1,
      items: [mergeItem],
    };
    const source = appState({
      extraConfig: { conflict: parent, hasPendingWrites: true },
      topConfig: {
        syncMergeConflicts: {
          type: "reta-final-three-way",
          detectedAt: NOW,
          total: 1,
          items: [mergeItem],
        },
      },
    });
    vi.resetModules();
    vi.doMock("../../src/js/sync/firestore-sync-engine.js?v=8.37", () => ({
      getFirestoreSyncStatus: () => ({
        configured: true,
        signedIn: true,
        enabled: true,
        mode: "primary",
        hasPendingWrites: true,
        conflict: parent,
        lastPushAt: null,
        lastError: null,
      }),
    }));
    const store = await import("../../src/js/store.js?v=8.37");
    store.state.planejamento = source.planejamento;
    store.state.config = source.config;
    const view =
      await import("../../src/js/views/config/sync-center.js?v=8.37");
    const html = view._renderFirestoreCard();
    expect(html).toContain('data-testid="rf-conflict-review"');
    expect(html).not.toContain('data-testid="firestore-sync-conflict"');

    const item = collectRetaFinalConflicts(source).find(
      (entry) => entry.source === "merge",
    );
    const idb = idbFor(source);
    await resolveRetaFinalConflictAtomically({
      db: idb.database,
      conflictId: item.conflictId,
      choice: "local",
      expectedPlanId: "plan-1",
      expectedRevision: source.planejamento.revision,
      now: NOW,
      deviceId: "device-a",
    });
    const persisted = readState(idb);
    expect(persisted.config.syncMergeConflicts).toBeUndefined();
    expect(persisted.config.firestoreSync.conflict).toBeNull();
  });
});
