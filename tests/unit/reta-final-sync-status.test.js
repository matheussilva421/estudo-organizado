import { describe, expect, it } from "vitest";
import { deriveSyncDisplayState } from "../../src/js/sync/sync-status-ui.js?v=8.37&test=rf-status";

describe("Reta Final sync display state", () => {
  it("prioriza conflito sobre qualquer outro estado", () => {
    expect(
      deriveSyncDisplayState({
        firestoreSync: {
          conflict: { type: "reta-final-conflict" },
          lastPushAt: "x",
        },
        online: true,
      }),
    ).toBe("conflict");
  });

  it("mostra offline quando a rede cai, mesmo com push anterior", () => {
    expect(
      deriveSyncDisplayState({
        firestoreSync: { lastPushAt: "2026-10-21T10:00:00.000Z" },
        online: false,
      }),
    ).toBe("offline");
  });

  it("mostra blocked-guard quando a sonda remota não foi confirmada", () => {
    expect(
      deriveSyncDisplayState({
        firestoreSync: { lastError: "blocked-guard: permission-denied" },
        online: true,
      }),
    ).toBe("blocked-guard");
  });

  it("permanece pendente enquanto houver escrita local não confirmada", () => {
    expect(
      deriveSyncDisplayState({
        firestoreSync: {
          hasPendingWrites: true,
          lastPushAt: "2026-10-21T10:00:00.000Z",
        },
        online: true,
      }),
    ).toBe("pending");
  });

  it("só promove a sincronizado com ACK de push e sem pendências", () => {
    expect(
      deriveSyncDisplayState({
        firestoreSync: {
          hasPendingWrites: false,
          lastPushAt: "2026-10-21T10:00:00.000Z",
        },
        online: true,
      }),
    ).toBe("synced");
  });

  it("não promove a sincronizado sem ACK, mesmo com remoteUpdatedAt", () => {
    expect(
      deriveSyncDisplayState({
        firestoreSync: {
          hasPendingWrites: false,
          lastPushAt: null,
          remoteUpdatedAt: "2026-10-21T10:00:00.000Z",
        },
        online: true,
      }),
    ).toBe("idle");
  });

  it("mostra erro quando a última tentativa falhou", () => {
    expect(
      deriveSyncDisplayState({
        firestoreSync: { lastError: "network down" },
        online: true,
      }),
    ).toBe("error");
  });

  it("não promove a sincronizado com conflito de merge pendente", () => {
    expect(
      deriveSyncDisplayState({
        firestoreSync: {
          hasPendingWrites: false,
          lastPushAt: "2026-10-21T10:00:00.000Z",
        },
        online: true,
        mergeConflict: true,
      }),
    ).toBe("conflict");
  });

  it("não promove a sincronizado quando há alteração local posterior ao ACK", () => {
    expect(
      deriveSyncDisplayState({
        firestoreSync: {
          hasPendingWrites: false,
          lastPushAt: "2026-10-21T10:00:00.000Z",
        },
        online: true,
        localBackupAt: "2026-10-21T10:05:00.000Z",
      }),
    ).toBe("pending");
  });
});
