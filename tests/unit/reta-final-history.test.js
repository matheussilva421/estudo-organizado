import { describe, expect, it } from "vitest";
import {
  appendRetaFinalDraftOperation,
  createRetaFinalDraft,
} from "../../src/js/logic/reta-final-drafts.js";
import { applyRetaFinalCommand } from "../../src/js/logic/reta-final-commands.js";
import {
  createRetaFinalCheckpoint,
  invertRetaFinalOperation,
  proposeRetaFinalRedo,
  proposeRetaFinalRestore,
  proposeRetaFinalUndo,
} from "../../src/js/logic/reta-final-history.js";
import { commitRetaFinalDraft } from "../../src/js/store/reta-final-commit.js";
import { listRetaFinalCheckpoints } from "../../src/js/store/reta-final-history-store.js";
import { createLocalStateEnvelope } from "../../src/js/store/normalize-state.js";
import { createTransactionalIdb } from "./reta-final-draft-idb-helper.js";

const NOW = "2026-10-20T12:30:00.000Z";
const TODAY = "2026-10-20";

function makeBlock(id, ordem, overrides = {}) {
  return {
    id,
    discId: "disc-1",
    topicos: [{ assId: "ass-1", aulaId: null }],
    minutos: 60,
    status: "pendente",
    ordem,
    dataOriginal: TODAY,
    dataPlanejada: TODAY,
    data: TODAY,
    rolagens: 0,
    ...overrides,
  };
}

function plan(
  revision = 4,
  blocks = [makeBlock("rf_1", 0), makeBlock("rf_2", 1)],
) {
  return {
    ativo: true,
    tipo: "reta_final",
    planId: "plan-1",
    schemaVersionRetaFinal: 2,
    revision,
    updatedAt: "2026-10-19T10:00:00.000Z",
    retaFinal: {
      dataFinal: "2026-11-30",
      minutosPadrao: 60,
      blocos: blocks,
    },
  };
}

function appState(sourcePlan) {
  return {
    schemaVersion: 12,
    planejamento: sourcePlan,
    planejamentoArquivado: null,
    eventos: [],
    editais: [
      {
        id: "edital-1",
        disciplinas: [
          {
            id: "disc-1",
            assuntos: [{ id: "ass-1", nome: "Tema" }],
            aulas: [],
          },
        ],
      },
    ],
    config: {},
  };
}

function idbFor(sourcePlan) {
  const state = appState(sourcePlan);
  return createTransactionalIdb({
    stores: {
      app_state: {
        main_state_current: createLocalStateEnvelope(state, {
          slot: "current",
        }),
        main_state_previous: createLocalStateEnvelope(state, {
          slot: "previous",
        }),
        main_state: state,
      },
      reta_final_drafts: {},
      reta_final_journal: {},
    },
    keyPaths: { reta_final_drafts: "draftId", reta_final_journal: "id" },
  });
}

async function saveDraft(idb, draft) {
  const tx = idb.database.transaction(["reta_final_drafts"], "readwrite");
  tx.objectStore("reta_final_drafts").put(draft);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

function append(draft, command, context = {}) {
  const result = appendRetaFinalDraftOperation(draft, command, {
    today: TODAY,
    events: [],
    catalog: [
      {
        id: "edital-1",
        disciplinas: [
          {
            id: "disc-1",
            assuntos: [{ id: "ass-1", nome: "Tema" }],
            aulas: [],
          },
        ],
      },
    ],
    activeTimerIds: [],
    now: NOW,
    ...context,
  });
  expect(result.valid).toBe(true);
  return result.draft;
}

describe("Reta Final history checkpoints and inverses", () => {
  it("copies plan intent into an immutable checkpoint and detects checksum changes", () => {
    const source = plan();
    const checkpoint = createRetaFinalCheckpoint(source, {
      checkpointId: "manual-before-edit",
      createdAt: NOW,
      kind: "manual",
      label: "Antes da revisão",
    });

    source.retaFinal.blocos[0].minutos = 999;

    expect(checkpoint.plan.retaFinal.blocos[0].minutos).toBe(60);
    expect(checkpoint).not.toHaveProperty("events");
    expect(checkpoint.checksum).toMatch(/^fnv1a64:/);
    expect(createRetaFinalCheckpoint).toBeDefined();
  });

  it("proposes a selective rf_2 restore while leaving later study events untouched", () => {
    const checkpoint = createRetaFinalCheckpoint(plan(), {
      checkpointId: "auto-before-change",
      createdAt: NOW,
      kind: "automatic",
    });
    const current = plan(6, [
      makeBlock("rf_1", 0, { minutos: 120 }),
      makeBlock("rf_2", 1, { minutos: 90 }),
    ]);
    const laterStudy = {
      id: "event-after-checkpoint",
      rfBlocoId: "rf_2",
      status: "estudei",
      tempoAcumulado: 42,
      questoes: 7,
      revisoes: [{ id: "review-1" }],
    };
    const events = [laterStudy];
    const result = proposeRetaFinalRestore(current, checkpoint, {
      blockIds: ["rf_2"],
      events,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0]).toMatchObject({
      type: "PATCH",
      blockIds: ["rf_2"],
      patch: { minutos: 60 },
    });
    const applied = applyRetaFinalCommand(current, result.operations[0], {
      events,
    });
    expect(applied.valid).toBe(true);
    expect(applied.plan.retaFinal.blocos.map((block) => block.minutos)).toEqual(
      [120, 60],
    );
    expect(events).toEqual([laterStudy]);
    expect(result.diff.map((item) => item.blockId)).toEqual(["rf_2"]);
  });

  it("fails closed on a checkpoint checksum mismatch", () => {
    const checkpoint = createRetaFinalCheckpoint(plan(), {
      checkpointId: "tampered",
      createdAt: NOW,
      kind: "manual",
    });
    checkpoint.plan.retaFinal.blocos[0].minutos = 45;

    const result = proposeRetaFinalRestore(plan(5), checkpoint, { events: [] });

    expect(result.operations).toEqual([]);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "CHECKPOINT_CHECKSUM_INVALID",
          blocking: true,
        }),
      ]),
    );
  });

  it("stores before and after provenance when appending a new operation", () => {
    const draft = createRetaFinalDraft(plan(), {
      draftId: "provenance-draft",
      now: NOW,
    });

    const changed = append(draft, {
      operationId: "operation-set-minutes",
      type: "PATCH",
      blockIds: ["rf_2"],
      patch: { minutos: 90 },
    });

    expect(changed.operations[0]).toMatchObject({
      operationId: "operation-set-minutes",
      baseRevision: 4,
      before: plan(),
      after: changed.snapshot,
      diff: [
        expect.objectContaining({
          blockId: "rf_2",
          fieldsChanged: ["minutos"],
        }),
      ],
      createdAt: NOW,
    });
    expect(changed.operations[0].provenanceChecksum).toMatch(/^fnv1a64:/);
  });

  it("returns a PATCH inverse for a verified editable operation and blocks legacy records", () => {
    const draft = createRetaFinalDraft(plan(), {
      draftId: "inverse-draft",
      now: NOW,
    });
    const changed = append(draft, {
      operationId: "forward-minutes",
      type: "PATCH",
      blockIds: ["rf_2"],
      patch: { minutos: 90 },
    });
    const inverse = invertRetaFinalOperation(changed.operations[0]);

    expect(inverse).toMatchObject({
      type: "PATCH",
      blockIds: ["rf_2"],
      patch: { minutos: 60 },
    });
    const legacy = invertRetaFinalOperation({
      operationId: "old-operation",
      command: {
        operationId: "old-operation",
        type: "ARCHIVE",
        blockIds: ["rf_2"],
      },
    });
    expect(legacy).toMatchObject({
      blocking: true,
      diagnostics: [
        expect.objectContaining({ code: "OPERATION_PROVENANCE_MISSING" }),
      ],
    });
  });

  it("blocks deadline inverses that would shorten the current deadline", () => {
    const changed = append(
      createRetaFinalDraft(plan(), { draftId: "deadline-draft", now: NOW }),
      {
        operationId: "extend-deadline",
        type: "EXTEND_DEADLINE",
        input: { dataFinal: "2026-12-31" },
      },
    );

    expect(invertRetaFinalOperation(changed.operations[0])).toMatchObject({
      blocking: true,
      diagnostics: [expect.objectContaining({ code: "UNDO_UNSUPPORTED" })],
    });
  });

  it("inverts ARCHIVE through the explicit UNARCHIVE command", () => {
    const draft = createRetaFinalDraft(plan(), {
      draftId: "archive-draft",
      now: NOW,
    });
    const archived = append(draft, {
      operationId: "archive-rf-2",
      type: "ARCHIVE",
      blockIds: ["rf_2"],
    });
    const inverse = invertRetaFinalOperation(archived.operations[0]);

    expect(inverse).toMatchObject({ type: "UNARCHIVE", blockIds: ["rf_2"] });
    const restored = applyRetaFinalCommand(archived.snapshot, inverse, {
      events: [],
    });
    expect(restored.valid).toBe(true);
    expect(restored.plan.retaFinal.blocos[1].arquivado).toBe(false);
  });

  it("commits undo and redo as new revisions and rejects stale history drafts by CAS", async () => {
    const base = plan();
    const idb = idbFor(base);
    const original = append(
      createRetaFinalDraft(base, { draftId: "original-draft", now: NOW }),
      {
        operationId: "original-op",
        type: "PATCH",
        blockIds: ["rf_2"],
        patch: { minutos: 90 },
      },
    );
    await saveDraft(idb, original);
    await expect(
      commitRetaFinalDraft({
        db: idb.database,
        draftId: original.draftId,
        expectedPlanId: original.planId,
        expectedRevision: original.baseRevision,
        context: { now: NOW, today: TODAY, makeId: () => "event-1" },
      }),
    ).resolves.toMatchObject({ revision: 5 });
    await expect(
      listRetaFinalCheckpoints(idb.database, original.planId),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "rf-checkpoint:original-draft",
        kind: "automatic",
        integrity: "valid",
      }),
    ]);
    const appliedPlan = idb.getRecord("app_state", "main_state_current").payload
      .planejamento;
    const appliedOperation = idb.getRecord(
      "reta_final_drafts",
      original.draftId,
    ).operations[0];
    expect(appliedOperation.committedRevision).toBe(5);
    expect(
      proposeRetaFinalUndo(plan(6), appliedOperation, {
        draftId: "stale-undo-proposal",
        now: NOW,
        events: [],
      }),
    ).toMatchObject({
      draft: null,
      diagnostics: [
        expect.objectContaining({
          code: "HISTORY_REVISION_MISMATCH",
          blocking: true,
        }),
      ],
    });

    const undoProposal = proposeRetaFinalUndo(appliedPlan, appliedOperation, {
      draftId: "undo-draft",
      now: NOW,
      events: [],
      catalog: [
        {
          id: "edital-1",
          disciplinas: [
            {
              id: "disc-1",
              assuntos: [{ id: "ass-1", nome: "Tema" }],
              aulas: [],
            },
          ],
        },
      ],
    });
    expect(undoProposal.diagnostics).toEqual([]);
    const undo = undoProposal.draft;
    await saveDraft(idb, undo);
    await expect(
      commitRetaFinalDraft({
        db: idb.reopen(),
        draftId: undo.draftId,
        expectedPlanId: undo.planId,
        expectedRevision: undo.baseRevision,
        context: { now: NOW, today: TODAY, makeId: () => "event-2" },
      }),
    ).resolves.toMatchObject({
      revision: 6,
      plan: { retaFinal: { blocos: [expect.any(Object), { minutos: 60 }] } },
    });

    const undonePlan = idb.getRecord("app_state", "main_state_current").payload
      .planejamento;
    const appliedUndo = idb.getRecord("reta_final_drafts", undo.draftId)
      .operations[0];
    const redoProposal = proposeRetaFinalRedo(undonePlan, appliedUndo, {
      draftId: "redo-draft",
      now: NOW,
      events: [],
      catalog: [
        {
          id: "edital-1",
          disciplinas: [
            {
              id: "disc-1",
              assuntos: [{ id: "ass-1", nome: "Tema" }],
              aulas: [],
            },
          ],
        },
      ],
    });
    expect(redoProposal.diagnostics).toEqual([]);
    const redo = redoProposal.draft;
    await saveDraft(idb, redo);
    const stale = append(
      createRetaFinalDraft(undonePlan, {
        draftId: "stale-history-draft",
        now: NOW,
      }),
      {
        operationId: "stale-op",
        type: "PATCH",
        blockIds: ["rf_2"],
        patch: { minutos: 75 },
      },
    );
    await saveDraft(idb, stale);

    await expect(
      commitRetaFinalDraft({
        db: idb.reopen(),
        draftId: redo.draftId,
        expectedPlanId: redo.planId,
        expectedRevision: redo.baseRevision,
        context: { now: NOW, today: TODAY, makeId: () => "event-3" },
      }),
    ).resolves.toMatchObject({ revision: 7 });
    await expect(
      commitRetaFinalDraft({
        db: idb.reopen(),
        draftId: stale.draftId,
        expectedPlanId: stale.planId,
        expectedRevision: stale.baseRevision,
        context: { now: NOW, today: TODAY, makeId: () => "event-4" },
      }),
    ).rejects.toMatchObject({ code: "RETA_FINAL_STALE" });
  });
});

describe("Reta Final history scope protections", () => {
  it("keeps global deadline and capacity unchanged on selective restore", () => {
    const saved = plan();
    saved.retaFinal.dataFinal = "2026-12-31";
    saved.retaFinal.capacidade = {
      minutosPorDiaSemana: { 1: 90 },
      folgas: [0],
      maximoDiario: 120,
    };
    const checkpoint = createRetaFinalCheckpoint(saved, {
      checkpointId: "selective-global-check",
      createdAt: NOW,
      kind: "manual",
    });
    const current = plan(6, [
      makeBlock("rf_1", 0),
      makeBlock("rf_2", 1, { minutos: 90 }),
    ]);
    current.retaFinal.dataFinal = "2026-12-20";
    current.retaFinal.capacidade = {
      minutosPorDiaSemana: { 1: 60 },
      folgas: [0],
      maximoDiario: 90,
    };

    const result = proposeRetaFinalRestore(current, checkpoint, {
      blockIds: ["rf_2"],
      events: [],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0]).toMatchObject({
      type: "PATCH",
      blockIds: ["rf_2"],
    });
    expect(
      result.operations.some((operation) =>
        ["EXTEND_DEADLINE", "SET_CAPACITY", "SET_MINUTOS_PADRAO"].includes(
          operation.type,
        ),
      ),
    ).toBe(false);
  });

  it("restores minutosPadrao on a full restore through a safe command", () => {
    const saved = plan();
    saved.retaFinal.minutosPadrao = 45;
    const checkpoint = createRetaFinalCheckpoint(saved, {
      checkpointId: "full-minutes-check",
      createdAt: NOW,
      kind: "manual",
    });
    const current = plan(6);

    const result = proposeRetaFinalRestore(current, checkpoint, { events: [] });
    expect(result.diagnostics).toEqual([]);
    expect(result.operations).toEqual([
      expect.objectContaining({
        type: "SET_MINUTOS_PADRAO",
        input: { minutosPadrao: 45 },
      }),
    ]);
    let restored = current;
    for (const operation of result.operations) {
      const applied = applyRetaFinalCommand(restored, operation, {
        events: [],
      });
      expect(applied.valid).toBe(true);
      restored = applied.plan;
    }
    expect(restored.retaFinal.minutosPadrao).toBe(45);
  });

  it("rejects undo of an operation from another plan with the same revision", () => {
    const operation = append(
      createRetaFinalDraft(plan(), { draftId: "cross-plan", now: NOW }),
      {
        operationId: "cross-plan-op",
        type: "PATCH",
        blockIds: ["rf_2"],
        patch: { minutos: 90 },
      },
    ).operations[0];
    operation.committedRevision = 5;
    const other = plan(5);
    other.planId = "another-plan";

    expect(
      proposeRetaFinalUndo(other, operation, {
        draftId: "cross-plan-undo",
        now: NOW,
        events: [],
      }),
    ).toMatchObject({
      draft: null,
      diagnostics: [expect.objectContaining({ code: "HISTORY_PLAN_MISMATCH" })],
    });
  });

  it("rejects undo when a later operation changed the same field in the same commit", async () => {
    const base = plan();
    const idb = idbFor(base);
    let draft = createRetaFinalDraft(base, {
      draftId: "overlap-draft",
      now: NOW,
    });
    draft = append(draft, {
      operationId: "first-patch",
      type: "PATCH",
      blockIds: ["rf_2"],
      patch: { minutos: 90 },
    });
    draft = append(draft, {
      operationId: "later-patch",
      type: "PATCH",
      blockIds: ["rf_2"],
      patch: { minutos: 120 },
    });
    await saveDraft(idb, draft);
    await commitRetaFinalDraft({
      db: idb.database,
      draftId: draft.draftId,
      expectedPlanId: draft.planId,
      expectedRevision: draft.baseRevision,
      context: { now: NOW, today: TODAY, makeId: () => "overlap-event" },
    });
    const applied = idb.getRecord("app_state", "main_state_current").payload
      .planejamento;
    const firstOperation = idb.getRecord("reta_final_drafts", draft.draftId)
      .operations[0];

    expect(
      proposeRetaFinalUndo(applied, firstOperation, {
        draftId: "overlap-undo",
        now: NOW,
        events: [],
        catalog: [
          {
            id: "edital-1",
            disciplinas: [
              {
                id: "disc-1",
                assuntos: [{ id: "ass-1", nome: "Tema" }],
                aulas: [],
              },
            ],
          },
        ],
      }),
    ).toMatchObject({
      draft: null,
      diagnostics: [
        expect.objectContaining({ code: "HISTORY_LATER_OPERATION" }),
      ],
    });
  });
});
