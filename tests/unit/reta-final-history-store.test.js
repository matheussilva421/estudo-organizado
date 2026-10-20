import { describe, expect, it } from "vitest";
import { createRetaFinalCheckpoint } from "../../src/js/logic/reta-final-history.js";
import {
  appendRetaFinalDraftOperation,
  createRetaFinalDraft,
} from "../../src/js/logic/reta-final-drafts.js";
import {
  listRetaFinalOperations,
  listRetaFinalCheckpoints,
  pruneRetaFinalCheckpoints,
  saveRetaFinalCheckpoint,
} from "../../src/js/store/reta-final-history-store.js";
import { createTransactionalIdb } from "./reta-final-draft-idb-helper.js";

function plan(revision = 3) {
  return {
    ativo: true,
    tipo: "reta_final",
    planId: "plan-history-store",
    schemaVersionRetaFinal: 2,
    revision,
    retaFinal: {
      dataFinal: "2026-11-30",
      minutosPadrao: 60,
      blocos: [
        {
          id: "rf_1",
          discId: "disc-1",
          topicos: [{ assId: "ass-1", aulaId: null }],
          minutos: 60,
          status: "pendente",
          ordem: 0,
          dataPlanejada: "2026-10-20",
        },
      ],
    },
  };
}

function idb(records = []) {
  const journal = Object.fromEntries(
    records.map((record) => [record.id, record]),
  );
  return createTransactionalIdb({
    stores: { reta_final_drafts: {}, reta_final_journal: journal },
    keyPaths: { reta_final_drafts: "draftId", reta_final_journal: "id" },
  });
}

function checkpoint(index, kind = "automatic") {
  return createRetaFinalCheckpoint(plan(index), {
    checkpointId: `checkpoint-${String(index).padStart(2, "0")}`,
    draftId: `draft-${String(index).padStart(2, "0")}`,
    createdAt: `2026-10-${String(index).padStart(2, "0")}T10:00:00.000Z`,
    kind,
    label: kind === "manual" ? "Protegido" : undefined,
  });
}

function syncedIntent(sourceCheckpoint, status = "synced") {
  return {
    id: `rf-sync-intent:${sourceCheckpoint.draftId}`,
    type: "sync_intent",
    planId: sourceCheckpoint.planId,
    revision: sourceCheckpoint.revision + 1,
    status,
    operationIds: [],
    createdAt: sourceCheckpoint.createdAt,
    draftId: sourceCheckpoint.draftId,
  };
}

describe("Reta Final checkpoint journal store", () => {
  it("persists a manual checkpoint and verifies its checksum when listing", async () => {
    const database = idb();
    const manual = checkpoint(1, "manual");

    await expect(
      saveRetaFinalCheckpoint(database.database, manual),
    ).resolves.toEqual(manual);
    await expect(
      listRetaFinalCheckpoints(database.reopen(), "plan-history-store"),
    ).resolves.toEqual([
      expect.objectContaining({
        id: manual.id,
        kind: "manual",
        integrity: "valid",
      }),
    ]);
  });

  it("fails closed for corrupt checkpoint records without deleting their evidence", async () => {
    const corrupt = checkpoint(1, "manual");
    corrupt.checksum = "fnv1a64:0000000000000000";
    const database = idb([corrupt]);

    await expect(
      listRetaFinalCheckpoints(database.database, "plan-history-store"),
    ).resolves.toEqual([
      expect.objectContaining({ id: corrupt.id, integrity: "invalid" }),
    ]);
    expect(database.getRecord("reta_final_journal", corrupt.id)).toEqual(
      corrupt,
    );
  });

  it("lists committed draft operations with their durable revision for audit", async () => {
    const draft = {
      draftId: "applied-draft",
      planId: "plan-history-store",
      baseRevision: 5,
      appliedRevision: 6,
      state: "applied",
      operations: [
        {
          operationId: "audit-op",
          command: { operationId: "audit-op", type: "PATCH" },
        },
      ],
    };
    const database = createTransactionalIdb({
      stores: {
        reta_final_drafts: { "applied-draft": draft },
        reta_final_journal: {},
      },
      keyPaths: { reta_final_drafts: "draftId", reta_final_journal: "id" },
    });

    await expect(
      listRetaFinalOperations(database.database, "plan-history-store"),
    ).resolves.toEqual([
      expect.objectContaining({
        operationId: "audit-op",
        planId: "plan-history-store",
        baseRevision: 5,
        committedRevision: 6,
        inverseAvailable: false,
      }),
    ]);
  });

  it("keeps manual checkpoints while pruning the oldest eligible automatic beyond 20", async () => {
    const checkpoints = Array.from({ length: 21 }, (_, index) =>
      checkpoint(index + 1),
    );
    const manual = checkpoint(22, "manual");
    const database = idb([
      ...checkpoints.flatMap((record) => [record, syncedIntent(record)]),
      manual,
    ]);

    await expect(
      pruneRetaFinalCheckpoints(database.database, "plan-history-store"),
    ).resolves.toEqual(["checkpoint-01"]);

    expect(database.getRecord("reta_final_journal", manual.id)).toEqual(manual);
    expect(
      database.getRecord("reta_final_journal", "checkpoint-01"),
    ).toBeUndefined();
    expect(
      await listRetaFinalCheckpoints(database.reopen(), "plan-history-store"),
    ).toHaveLength(21);
  });

  it("removes only the oldest eligible automatic among 21 checkpoints", async () => {
    const checkpoints = Array.from({ length: 21 }, (_, index) =>
      checkpoint(index + 1),
    );
    const database = idb(
      checkpoints.flatMap((record) => [record, syncedIntent(record)]),
    );

    const removed = await pruneRetaFinalCheckpoints(
      database.database,
      "plan-history-store",
    );

    expect(removed).toEqual(["checkpoint-01"]);
    expect(
      await listRetaFinalCheckpoints(database.reopen(), "plan-history-store"),
    ).toHaveLength(20);
  });

  it("never prunes automatic checkpoints with pending or conflicted sync intents", async () => {
    const checkpoints = Array.from({ length: 21 }, (_, index) =>
      checkpoint(index + 1),
    );
    const intents = checkpoints.map((record, index) =>
      syncedIntent(
        record,
        index === 0 ? "pending" : index === 1 ? "conflict" : "synced",
      ),
    );
    const database = idb(
      checkpoints.flatMap((record, index) => [record, intents[index]]),
    );

    const removed = await pruneRetaFinalCheckpoints(
      database.database,
      "plan-history-store",
    );

    expect(removed).toEqual(["checkpoint-03"]);
    expect(
      database.getRecord("reta_final_journal", "checkpoint-01"),
    ).toBeDefined();
    expect(
      database.getRecord("reta_final_journal", "checkpoint-02"),
    ).toBeDefined();
  });

  it("keeps the previous readable journal when saving aborts or quota is exhausted", async () => {
    const existing = checkpoint(1, "manual");
    const database = idb([existing]);
    const next = checkpoint(2, "manual");
    database.failNextWriteInStore("reta_final_journal");

    await expect(
      saveRetaFinalCheckpoint(database.database, next),
    ).rejects.toMatchObject({ name: "QuotaExceededError" });
    expect(database.getRecord("reta_final_journal", existing.id)).toEqual(
      existing,
    );
    expect(database.getRecord("reta_final_journal", next.id)).toBeUndefined();

    const interrupted = saveRetaFinalCheckpoint(database.reopen(), next);
    await Promise.resolve();
    await Promise.resolve();
    database.lastTransaction.abort();
    await expect(interrupted).rejects.toMatchObject({ name: "AbortError" });
    expect(database.getRecord("reta_final_journal", existing.id)).toEqual(
      existing,
    );
    expect(database.getRecord("reta_final_journal", next.id)).toBeUndefined();
  });

  it("does not report pruning success or remove records when the delete aborts", async () => {
    const checkpoints = Array.from({ length: 21 }, (_, index) =>
      checkpoint(index + 1),
    );
    const database = idb(
      checkpoints.flatMap((record) => [record, syncedIntent(record)]),
    );
    database.failNextWriteInStore("reta_final_journal");

    await expect(
      pruneRetaFinalCheckpoints(database.database, "plan-history-store"),
    ).rejects.toMatchObject({ name: "QuotaExceededError" });

    expect(database.getRecord("reta_final_journal", "checkpoint-01")).toEqual(
      checkpoints[0],
    );
    expect(
      await listRetaFinalCheckpoints(database.reopen(), "plan-history-store"),
    ).toHaveLength(21);
  });

  it("reports inverse availability from the actual inverse result", async () => {
    const base = plan();
    let draft = createRetaFinalDraft(base, {
      draftId: "operations-draft",
      now: "2026-10-20T12:00:00.000Z",
    });
    draft = appendRetaFinalDraftOperation(
      draft,
      {
        operationId: "patch-minutes",
        type: "PATCH",
        blockIds: ["rf_1"],
        patch: { minutos: 90 },
      },
      { today: "2026-10-20", events: [], catalog: [] },
    ).draft;
    draft = appendRetaFinalDraftOperation(
      draft,
      {
        operationId: "extend-deadline",
        type: "EXTEND_DEADLINE",
        input: { dataFinal: "2026-12-31" },
      },
      { today: "2026-10-20", events: [], catalog: [] },
    ).draft;
    const applied = {
      ...draft,
      state: "applied",
      appliedRevision: 4,
      appliedAt: "2026-10-20T12:00:00.000Z",
      operations: draft.operations.map((operation) => ({
        ...operation,
        committedRevision: 4,
      })),
    };
    const database = createTransactionalIdb({
      stores: { reta_final_drafts: { "operations-draft": applied } },
      keyPaths: { reta_final_drafts: "draftId" },
    });

    const operations = await listRetaFinalOperations(
      database.database,
      base.planId,
    );
    expect(
      operations.find((operation) => operation.operationId === "patch-minutes"),
    ).toMatchObject({ inverseAvailable: true });
    expect(
      operations.find(
        (operation) => operation.operationId === "extend-deadline",
      ),
    ).toMatchObject({ inverseAvailable: false });
  });
});
