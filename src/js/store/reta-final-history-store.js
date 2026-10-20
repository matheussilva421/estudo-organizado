import {
  invertRetaFinalOperation,
  verifyRetaFinalCheckpoint,
} from "../logic/reta-final-history.js";
import {
  RETA_FINAL_DRAFT_STORE,
  RETA_FINAL_JOURNAL_STORE,
} from "./indexeddb.js";

const clone = (value) =>
  value === undefined ? undefined : structuredClone(value);
const safeSyncStatuses = new Set([
  "synced",
  "complete",
  "completed",
  "acknowledged",
]);

function failWithTransactionError(event, transaction) {
  if (event?.target?.error) return event.target.error;
  if (transaction?.error) return transaction.error;
  const error = new Error("Transação IndexedDB abortada.");
  error.name = "AbortError";
  return error;
}

function requireDatabase(database) {
  if (!database || typeof database.transaction !== "function") {
    throw new TypeError("Instância IndexedDB indisponível.");
  }
}

function runTransaction(database, storeNames, mode, action) {
  try {
    requireDatabase(database);
  } catch (error) {
    return Promise.reject(error);
  }
  return new Promise((resolve, reject) => {
    let transaction;
    let result;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error || new Error("Falha na transação de histórico."));
    };
    try {
      transaction = database.transaction(storeNames, mode);
      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      transaction.onerror = (event) =>
        fail(failWithTransactionError(event, transaction));
      transaction.onabort = (event) =>
        fail(failWithTransactionError(event, transaction));
      result = action(transaction, fail);
    } catch (error) {
      fail(error);
    }
  });
}

function journalRecords(database, mode, action) {
  return runTransaction(
    database,
    [RETA_FINAL_JOURNAL_STORE],
    mode,
    (transaction, fail) => {
      const store = transaction.objectStore(RETA_FINAL_JOURNAL_STORE);
      return action(store, transaction, fail);
    },
  );
}

/** Lists checkpoint records and attaches read-time integrity without hiding corrupt evidence. */
export function listRetaFinalCheckpoints(database, planId) {
  if (typeof planId !== "string" || !planId.trim())
    return Promise.reject(new TypeError("planId inválido."));
  return journalRecords(database, "readonly", (store, _transaction, fail) => {
    const holder = { records: [] };
    const request = store.getAll();
    request.onsuccess = () => {
      holder.records = (request.result || [])
        .filter(
          (record) => record?.type === "checkpoint" && record.planId === planId,
        )
        .map((record) => {
          const integrity = verifyRetaFinalCheckpoint(record);
          return {
            ...record,
            integrity: integrity.valid ? "valid" : "invalid",
            integrityDiagnostics: clone(integrity.diagnostics),
          };
        })
        .sort(
          (left, right) =>
            String(left.createdAt).localeCompare(String(right.createdAt)) ||
            left.revision - right.revision ||
            left.id.localeCompare(right.id),
        );
    };
    request.onerror = (event) => fail(failWithTransactionError(event));
    return holder;
  }).then((holder) => holder.records);
}

/** Stores a manual or automatic checkpoint and reports success only after transaction completion. */
export function saveRetaFinalCheckpoint(database, checkpoint) {
  const integrity = verifyRetaFinalCheckpoint(checkpoint);
  if (!integrity.valid) {
    const error = new TypeError("Checkpoint inválido ou sem checksum válido.");
    error.code = integrity.diagnostics[0]?.code || "CHECKPOINT_INVALID";
    return Promise.reject(error);
  }
  return journalRecords(database, "readwrite", (store, transaction, fail) => {
    const holder = { checkpoint: null };
    const request = store.get(checkpoint.id);
    request.onsuccess = () => {
      const existing = request.result;
      if (existing && JSON.stringify(existing) !== JSON.stringify(checkpoint)) {
        const error = Object.assign(
          new Error("Checkpoint id já pertence a outro snapshot."),
          {
            code: "CHECKPOINT_ID_CONFLICT",
          },
        );
        try {
          transaction.abort();
        } catch {
          fail(error);
        }
        fail(error);
        return;
      }
      if (!existing) store.put(checkpoint);
      holder.checkpoint = clone(checkpoint);
    };
    request.onerror = (event) => fail(failWithTransactionError(event));
    return holder;
  }).then((holder) => holder.checkpoint);
}

/** Lists applied Task 7 draft operations with their durable commit revision. */
export function listRetaFinalOperations(database, planId) {
  if (typeof planId !== "string" || !planId.trim())
    return Promise.reject(new TypeError("planId inválido."));
  return runTransaction(
    database,
    [RETA_FINAL_DRAFT_STORE],
    "readonly",
    (transaction, fail) => {
      const holder = { operations: [] };
      const request = transaction.objectStore(RETA_FINAL_DRAFT_STORE).getAll();
      request.onsuccess = () => {
        holder.operations = (request.result || [])
          .filter(
            (draft) => draft?.state === "applied" && draft.planId === planId,
          )
          .flatMap((draft) =>
            (Array.isArray(draft.operations) ? draft.operations : []).map(
              (operation, index) => {
                const record = {
                  ...operation,
                  planId: draft.planId,
                  draftId: draft.draftId,
                  baseRevision: operation.baseRevision ?? draft.baseRevision,
                  committedRevision:
                    operation.committedRevision ?? draft.appliedRevision,
                  createdAt:
                    operation.createdAt ?? draft.appliedAt ?? draft.createdAt,
                  index,
                };
                return {
                  ...record,
                  inverseAvailable: !invertRetaFinalOperation(record).blocking,
                };
              },
            ),
          )
          .sort(
            (left, right) =>
              left.committedRevision - right.committedRevision ||
              String(left.createdAt).localeCompare(String(right.createdAt)) ||
              left.index - right.index,
          );
      };
      request.onerror = (event) => fail(failWithTransactionError(event));
      return holder;
    },
  ).then((holder) => holder.operations);
}

function checkpointIsProtected(checkpoint, records) {
  if (
    checkpoint.kind !== "automatic" ||
    checkpoint.pending === true ||
    checkpoint.conflicted === true ||
    checkpoint.unsynchronized === true ||
    checkpoint.syncPending === true ||
    !verifyRetaFinalCheckpoint(checkpoint).valid ||
    typeof checkpoint.draftId !== "string"
  ) {
    return true;
  }
  const linked = records.filter(
    (record) => record?.draftId === checkpoint.draftId,
  );
  const intents = linked.filter((record) => record.type === "sync_intent");
  if (!intents.length) return true;
  if (
    linked.some(
      (record) =>
        record.type === "conflict" ||
        record.conflicted === true ||
        record.pending === true ||
        record.unsynchronized === true,
    )
  ) {
    return true;
  }
  return intents.some(
    (intent) =>
      !safeSyncStatuses.has(String(intent.status || "").toLowerCase()),
  );
}

/** Removes only the oldest eligible automatic snapshots; protected/manual evidence stays put. */
export function pruneRetaFinalCheckpoints(
  database,
  planId,
  { keepAutomatic = 20 } = {},
) {
  if (typeof planId !== "string" || !planId.trim())
    return Promise.reject(new TypeError("planId inválido."));
  if (!Number.isSafeInteger(keepAutomatic) || keepAutomatic < 0)
    return Promise.reject(
      new TypeError("keepAutomatic deve ser um inteiro não negativo."),
    );

  return journalRecords(database, "readwrite", (store, _transaction, fail) => {
    const holder = { removed: [] };
    const request = store.getAll();
    request.onsuccess = () => {
      const records = request.result || [];
      const checkpoints = records.filter(
        (record) => record?.type === "checkpoint" && record.planId === planId,
      );
      const automatic = checkpoints.filter(
        (record) => record.kind === "automatic",
      );
      const validCheckpoints = checkpoints.filter(
        (record) => verifyRetaFinalCheckpoint(record).valid,
      );
      let excess = Math.max(0, automatic.length - keepAutomatic);
      let recoverableCount = validCheckpoints.length;
      const eligible = automatic
        .filter((record) => !checkpointIsProtected(record, records))
        .sort(
          (left, right) =>
            String(left.createdAt).localeCompare(String(right.createdAt)) ||
            left.revision - right.revision ||
            left.id.localeCompare(right.id),
        );
      for (const checkpoint of eligible) {
        if (excess <= 0 || recoverableCount <= 1) break;
        store.delete(checkpoint.id);
        holder.removed.push(checkpoint.id);
        excess -= 1;
        recoverableCount -= 1;
      }
    };
    request.onerror = (event) => fail(failWithTransactionError(event));
    return holder;
  }).then((holder) => holder.removed);
}
