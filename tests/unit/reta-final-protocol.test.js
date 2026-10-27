import { describe, expect, it } from "vitest";
import {
  buildRetaFinalSyncDescriptor,
  classifyRetaFinalRemoteError,
  compareRetaFinalPlanIntent,
  computeRetaFinalPlanDigest,
  getRetaFinalPlan,
  getRetaFinalSyncCapabilities,
  readRetaFinalSyncDescriptor,
  shouldRefreshRetaFinalBase,
  validateRetaFinalEnvelopeWrite,
  validateRetaFinalRemoteWrite,
} from "../../src/js/sync/reta-final-protocol.js";

const CAPABILITIES = {
  schema: 2,
  granularMerge: true,
  guards: { envelope: "rules-v2", probe: 1 },
};

function plan(overrides = {}) {
  return {
    ativo: true,
    tipo: "reta_final",
    schemaVersionRetaFinal: 2,
    planId: "plan-1",
    generation: 1,
    revision: 3,
    updatedAt: "2026-10-20T12:00:00.000Z",
    retaFinal: {
      dataFinal: "2026-12-20",
      blocos: [
        {
          id: "b1",
          discId: "d1",
          topicos: [{ assId: "a1" }],
          minutos: 30,
          ordem: 0,
          dataPlanejada: "2026-10-22",
          data: "2026-10-23",
          dataEfetiva: "2026-10-23",
          categoriaTemporal: "futuro",
          naoAlocado: false,
          concluido: false,
          atrasoDias: 1,
        },
      ],
    },
    ...overrides,
  };
}

function descriptor(overrides = {}) {
  const subject = plan();
  return {
    schema: 2,
    planId: subject.planId,
    lineageId: subject.planId,
    generation: 1,
    revision: subject.revision,
    baseRevision: 2,
    snapshotRevision: 3,
    baseSnapshotRevision: 2,
    baseRemoteUpdatedAt: "2026-10-20T11:00:00.000Z",
    digest: computeRetaFinalPlanDigest(subject),
    deviceId: "web-device1",
    state: "active",
    capabilities: CAPABILITIES,
    ...overrides,
  };
}

function remoteDescriptor(overrides = {}) {
  return descriptor({
    snapshotRevision: 2,
    baseSnapshotRevision: 1,
    ...overrides,
  });
}

function envelope(overrides = {}) {
  const localPlan = plan();
  return {
    version: 1,
    payloadUpdatedAt: "2026-10-20T12:00:00.000Z",
    payload: { planejamento: localPlan },
    retaFinalSync: descriptor({
      revision: localPlan.revision,
      digest: computeRetaFinalPlanDigest(localPlan),
    }),
    ...overrides,
  };
}

describe("reta-final-protocol", () => {
  describe("getRetaFinalSyncCapabilities()", () => {
    it("returns the versioned v2 capability contract", () => {
      expect(getRetaFinalSyncCapabilities({})).toEqual(CAPABILITIES);
    });

    it("returns a fresh object that callers cannot use to mutate the contract", () => {
      const first = getRetaFinalSyncCapabilities({});
      first.guards.probe = 99;
      expect(getRetaFinalSyncCapabilities({}).guards.probe).toBe(1);
    });
  });

  describe("getRetaFinalPlan()", () => {
    it("returns only an active reta_final v2 plan", () => {
      expect(getRetaFinalPlan({ planejamento: plan() })).toMatchObject({
        planId: "plan-1",
      });
      expect(
        getRetaFinalPlan({ planejamento: plan({ ativo: false }) }),
      ).toBeNull();
      expect(
        getRetaFinalPlan({ planejamento: plan({ tipo: "sequencia" }) }),
      ).toBeNull();
      expect(
        getRetaFinalPlan({ planejamento: plan({ schemaVersionRetaFinal: 1 }) }),
      ).toBeNull();
      expect(getRetaFinalPlan({})).toBeNull();
    });
  });

  describe("computeRetaFinalPlanDigest()", () => {
    it("is deterministic across key insertion order", () => {
      const left = plan();
      const right = plan();
      right.retaFinal = {
        blocos: left.retaFinal.blocos.map((block) => ({ ...block })),
        dataFinal: left.retaFinal.dataFinal,
      };
      right.retaFinal.blocos[0] = Object.fromEntries(
        Object.entries(right.retaFinal.blocos[0]).reverse(),
      );

      expect(computeRetaFinalPlanDigest(left)).toBe(
        computeRetaFinalPlanDigest(right),
      );
    });

    it("ignores derived projection fields at any depth", () => {
      const clean = plan();
      const projected = plan();
      projected.retaFinal.blocos[0] = {
        ...projected.retaFinal.blocos[0],
        data: "2026-11-01",
        dataEfetiva: "2026-11-02",
        categoriaTemporal: "atrasado",
        naoAlocado: true,
        concluido: true,
        atrasoDias: 8,
      };

      expect(computeRetaFinalPlanDigest(projected)).toBe(
        computeRetaFinalPlanDigest(clean),
      );
    });

    it("changes when human intent changes", () => {
      const changed = plan();
      changed.retaFinal.blocos[0].minutos = 45;
      expect(computeRetaFinalPlanDigest(changed)).not.toBe(
        computeRetaFinalPlanDigest(plan()),
      );
    });

    it("is a short lowercase alphanumeric digest", () => {
      const digest = computeRetaFinalPlanDigest(plan());
      expect(digest).toMatch(/^[a-z0-9]{16,128}$/);
    });
  });

  describe("buildRetaFinalSyncDescriptor()", () => {
    it("builds the complete descriptor for a publish", () => {
      const subject = plan();
      const value = buildRetaFinalSyncDescriptor({
        plan: subject,
        baseRevision: 2,
        baseRemoteUpdatedAt: "2026-10-20T11:00:00.000Z",
        deviceId: "web-device1",
        capabilities: CAPABILITIES,
      });

      expect(value).toEqual({
        schema: 2,
        planId: "plan-1",
        lineageId: "plan-1",
        generation: 1,
        revision: 3,
        baseRevision: 2,
        snapshotRevision: 2,
        baseSnapshotRevision: 1,
        baseRemoteUpdatedAt: "2026-10-20T11:00:00.000Z",
        digest: computeRetaFinalPlanDigest(subject),
        deviceId: "web-device1",
        state: "active",
        capabilities: CAPABILITIES,
      });
    });

    it("uses revision 0/null base for the first publication", () => {
      const value = buildRetaFinalSyncDescriptor({
        plan: plan(),
        baseRevision: 0,
        baseRemoteUpdatedAt: null,
        deviceId: "web-device1",
        capabilities: CAPABILITIES,
      });
      expect(value.baseRevision).toBe(0);
      expect(value.baseRemoteUpdatedAt).toBeNull();
    });

    it("rejects a base newer than the local revision", () => {
      expect(() =>
        buildRetaFinalSyncDescriptor({
          plan: plan({ revision: 2 }),
          baseRevision: 3,
          baseRemoteUpdatedAt: null,
          deviceId: "web-device1",
          capabilities: CAPABILITIES,
        }),
      ).toThrow(/baseRevision/);
    });

    it("rejects a plan without planId", () => {
      expect(() =>
        buildRetaFinalSyncDescriptor({
          plan: plan({ planId: "" }),
          baseRevision: 0,
          baseRemoteUpdatedAt: null,
          deviceId: "web-device1",
          capabilities: CAPABILITIES,
        }),
      ).toThrow(/planId/);
    });

    it("deduplicates removed block ids and keeps the list optional", () => {
      const subject = plan();
      subject.retaFinal.removedBlockIds = ["b2", "b2", "b3"];
      const value = buildRetaFinalSyncDescriptor({
        plan: subject,
        baseRevision: 0,
        baseRemoteUpdatedAt: null,
        deviceId: "web-device1",
        capabilities: CAPABILITIES,
      });
      expect(value.removedBlockIds).toEqual(["b2", "b3"]);

      delete subject.retaFinal.removedBlockIds;
      expect(
        buildRetaFinalSyncDescriptor({
          plan: subject,
          baseRevision: 0,
          baseRemoteUpdatedAt: null,
          deviceId: "web-device1",
          capabilities: CAPABILITIES,
        }),
      ).not.toHaveProperty("removedBlockIds");
    });

    it("builds a retired descriptor for a known lineage", () => {
      const value = buildRetaFinalSyncDescriptor({
        plan: plan({ ativo: false, revision: 4 }),
        baseRevision: 3,
        baseRemoteUpdatedAt: "2026-10-20T11:00:00.000Z",
        deviceId: "web-device1",
        capabilities: CAPABILITIES,
        state: "retired",
      });
      expect(value.state).toBe("retired");
      expect(value.revision).toBe(4);
      expect(value.baseRevision).toBe(3);
    });
  });

  describe("readRetaFinalSyncDescriptor()", () => {
    it("returns a valid descriptor and null when absent or invalid", () => {
      const value = descriptor();
      expect(readRetaFinalSyncDescriptor({ retaFinalSync: value })).toEqual(
        value,
      );
      expect(readRetaFinalSyncDescriptor({})).toBeNull();
      expect(
        readRetaFinalSyncDescriptor({ retaFinalSync: { schema: 1 } }),
      ).toBeNull();
      expect(readRetaFinalSyncDescriptor(null)).toBeNull();
    });
  });

  describe("validateRetaFinalRemoteWrite()", () => {
    it("accepts a current base only for capable clients", () => {
      const localPlan = plan({ revision: 4 });
      const result = validateRetaFinalRemoteWrite({
        clientCapabilities: CAPABILITIES,
        remotePlan: plan(),
        localPlan,
        baseRevision: 3,
      });
      expect(result).toEqual({ allowed: true, reason: "base-current" });
    });

    it("denies a client without the v2 envelope guard", () => {
      const result = validateRetaFinalRemoteWrite({
        clientCapabilities: { schema: 1 },
        remotePlan: plan(),
        localPlan: plan({ revision: 4 }),
        baseRevision: 3,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("capability");
    });

    it("denies stale and rollback bases", () => {
      const stale = validateRetaFinalRemoteWrite({
        clientCapabilities: CAPABILITIES,
        remotePlan: plan(),
        localPlan: plan({ revision: 4 }),
        baseRevision: 2,
      });
      const rollback = validateRetaFinalRemoteWrite({
        clientCapabilities: CAPABILITIES,
        remotePlan: plan(),
        localPlan: plan({ revision: 2 }),
        baseRevision: 4,
      });
      expect(stale).toMatchObject({ allowed: false, reason: "stale-base" });
      expect(rollback).toMatchObject({ allowed: false, reason: "rollback" });
    });

    it("denies a different lineage", () => {
      const result = validateRetaFinalRemoteWrite({
        clientCapabilities: CAPABILITIES,
        remotePlan: plan({ planId: "plan-2" }),
        localPlan: plan({ revision: 4 }),
        baseRevision: 3,
      });
      expect(result).toMatchObject({ allowed: false, reason: "lineage" });
    });
  });

  describe("validateRetaFinalEnvelopeWrite()", () => {
    it("allows a first create only with baseRevision 0", () => {
      const local = envelope();
      local.retaFinalSync = descriptor({
        revision: 1,
        baseRevision: 0,
        snapshotRevision: 1,
        baseSnapshotRevision: 0,
        baseRemoteUpdatedAt: null,
      });
      local.payload.planejamento.revision = 1;

      expect(
        validateRetaFinalEnvelopeWrite({
          envelope: local,
          remoteEnvelope: null,
        }),
      ).toMatchObject({
        allowed: true,
        reason: "create",
      });

      local.retaFinalSync.baseRevision = 1;
      const denied = validateRetaFinalEnvelopeWrite({
        envelope: local,
        remoteEnvelope: null,
      });
      expect(denied.allowed).toBe(false);
    });

    it("rejects a retired descriptor on create and adoption", () => {
      const create = envelope({
        retaFinalSync: descriptor({
          revision: 1,
          baseRevision: 0,
          snapshotRevision: 1,
          baseSnapshotRevision: 0,
          state: "retired",
        }),
      });
      create.payload.planejamento.revision = 1;
      expect(
        validateRetaFinalEnvelopeWrite({
          envelope: create,
          remoteEnvelope: null,
        }),
      ).toMatchObject({
        allowed: false,
      });

      const adoption = envelope({
        retaFinalSync: descriptor({
          baseRevision: 0,
          snapshotRevision: 1,
          baseSnapshotRevision: 0,
          state: "retired",
        }),
      });
      const remote = {
        version: 1,
        payloadUpdatedAt: "2026-10-20T11:00:00.000Z",
        payload: { planejamento: null },
      };
      expect(
        validateRetaFinalEnvelopeWrite({
          envelope: adoption,
          remoteEnvelope: remote,
        }),
      ).toMatchObject({
        allowed: false,
        reason: "adoption-base",
      });
    });

    it("accepts adoption over a legacy document with the same payloadUpdatedAt", () => {
      const remote = {
        version: 1,
        payloadUpdatedAt: "2026-10-20T11:00:00.000Z",
        payload: { planejamento: null },
      };
      const local = envelope({
        retaFinalSync: descriptor({
          baseRevision: 0,
          snapshotRevision: 1,
          baseSnapshotRevision: 0,
        }),
      });
      expect(
        validateRetaFinalEnvelopeWrite({
          envelope: local,
          remoteEnvelope: remote,
        }),
      ).toMatchObject({
        allowed: true,
        reason: "adopt",
      });

      remote.payloadUpdatedAt = "2026-10-20T11:30:00.000Z";
      const denied = validateRetaFinalEnvelopeWrite({
        envelope: local,
        remoteEnvelope: remote,
      });
      expect(denied).toMatchObject({ allowed: false, reason: "adoption-base" });
    });

    it("denies a legacy client overwriting a v2 document", () => {
      const local = envelope();
      delete local.retaFinalSync;
      const denied = validateRetaFinalEnvelopeWrite({
        envelope: local,
        remoteEnvelope: envelope(),
      });
      expect(denied).toMatchObject({ allowed: false, reason: "legacy-write" });
      expect(denied.conflict).toMatchObject({ type: "reta-final-conflict" });
    });

    it("accepts an advance with the exact remote base and revision plus one", () => {
      const remote = envelope({
        retaFinalSync: remoteDescriptor({ revision: 3, baseRevision: 2 }),
      });
      const localPlan = plan({ revision: 4 });
      const local = envelope({
        payload: { planejamento: localPlan },
        retaFinalSync: descriptor({
          revision: 4,
          baseRevision: 3,
          digest: computeRetaFinalPlanDigest(localPlan),
        }),
      });

      expect(
        validateRetaFinalEnvelopeWrite({
          envelope: local,
          remoteEnvelope: remote,
        }),
      ).toMatchObject({
        allowed: true,
        reason: "advance",
      });
    });

    it("accepts retirement as a normal advance and refuses resurrection", () => {
      const remote = envelope({
        retaFinalSync: remoteDescriptor({ revision: 3, baseRevision: 2 }),
      });
      const retiredPlan = plan({ revision: 4, ativo: false });
      const retired = envelope({
        payload: { planejamento: retiredPlan },
        retaFinalSync: descriptor({
          revision: 4,
          baseRevision: 3,
          state: "retired",
          digest: computeRetaFinalPlanDigest(retiredPlan),
        }),
      });
      expect(
        validateRetaFinalEnvelopeWrite({
          envelope: retired,
          remoteEnvelope: remote,
        }),
      ).toMatchObject({
        allowed: true,
        reason: "advance",
      });

      const retiredRemote = envelope({
        retaFinalSync: remoteDescriptor({
          revision: 4,
          baseRevision: 3,
          state: "retired",
        }),
      });
      const activeAgain = envelope({
        retaFinalSync: descriptor({
          revision: 5,
          baseRevision: 4,
          state: "active",
        }),
      });
      expect(
        validateRetaFinalEnvelopeWrite({
          envelope: activeAgain,
          remoteEnvelope: retiredRemote,
        }),
      ).toMatchObject({ allowed: false, reason: "retired-lineage" });
    });

    it("accepts an identical replay and rejects a same-revision digest change", () => {
      const remote = envelope({
        retaFinalSync: remoteDescriptor({ revision: 3, baseRevision: 2 }),
      });
      const replay = envelope({ retaFinalSync: { ...remote.retaFinalSync } });
      expect(
        validateRetaFinalEnvelopeWrite({
          envelope: replay,
          remoteEnvelope: remote,
        }),
      ).toMatchObject({
        allowed: true,
        reason: "replay",
      });

      replay.retaFinalSync = {
        ...replay.retaFinalSync,
        digest: "f".repeat(32),
      };
      const denied = validateRetaFinalEnvelopeWrite({
        envelope: replay,
        remoteEnvelope: remote,
      });
      expect(denied).toMatchObject({
        allowed: false,
        reason: "replay-descriptor-mismatch",
      });
    });

    it("rejects an identical descriptor when the replay payload changed", () => {
      const remote = envelope({
        retaFinalSync: remoteDescriptor({ revision: 3, baseRevision: 2 }),
      });
      const replay = envelope({ retaFinalSync: { ...remote.retaFinalSync } });
      replay.payload = {
        ...replay.payload,
        planejamento: { ...replay.payload.planejamento, revision: 99 },
      };
      expect(
        validateRetaFinalEnvelopeWrite({
          envelope: replay,
          remoteEnvelope: remote,
        }),
      ).toMatchObject({
        allowed: false,
        reason: "replay-payload-mismatch",
      });

      const timestampChanged = envelope({
        retaFinalSync: { ...remote.retaFinalSync },
      });
      timestampChanged.payloadUpdatedAt = "2026-10-20T13:00:00.000Z";
      expect(
        validateRetaFinalEnvelopeWrite({
          envelope: timestampChanged,
          remoteEnvelope: remote,
        }),
      ).toMatchObject({ allowed: false, reason: "replay-payload-mismatch" });
    });

    it("compares the replay payload literally, including nested derived fields", () => {
      const remote = envelope({
        retaFinalSync: remoteDescriptor({ revision: 3, baseRevision: 2 }),
      });
      remote.payload.eventos = [
        { id: "ev1", data: "2026-10-20", status: "agendado" },
      ];
      const replay = envelope({ retaFinalSync: { ...remote.retaFinalSync } });
      replay.payload.eventos = [
        { id: "ev1", data: "2026-10-21", status: "agendado" },
      ];

      expect(
        validateRetaFinalEnvelopeWrite({
          envelope: replay,
          remoteEnvelope: remote,
        }),
      ).toMatchObject({ allowed: false, reason: "replay-payload-mismatch" });
    });

    it("rejects an unchanged-plan advance whose plan map differs from the remote", () => {
      const remote = envelope({
        retaFinalSync: remoteDescriptor({ revision: 3, baseRevision: 2 }),
      });
      const advance = envelope({
        retaFinalSync: {
          ...remoteDescriptor({ revision: 3, baseRevision: 2 }),
          snapshotRevision: remote.retaFinalSync.snapshotRevision + 1,
          baseSnapshotRevision: remote.retaFinalSync.snapshotRevision,
        },
      });
      advance.payload.planejamento = {
        ...advance.payload.planejamento,
        updatedAt: "2026-10-21T00:00:00.000Z",
      };

      expect(
        validateRetaFinalEnvelopeWrite({
          envelope: advance,
          remoteEnvelope: remote,
        }),
      ).toMatchObject({ allowed: false, reason: "plan-payload-mismatch" });
    });

    it("keeps minRetainedRevision optional in the descriptor", () => {
      const value = buildRetaFinalSyncDescriptor({
        plan: plan(),
        baseRevision: 2,
        baseRemoteUpdatedAt: null,
        deviceId: "web-device1",
        capabilities: CAPABILITIES,
        minRetainedRevision: 1,
      });
      expect(value.minRetainedRevision).toBe(1);
    });

    it("rejects rollback and revision jumps", () => {
      const remote = envelope({
        retaFinalSync: remoteDescriptor({ revision: 3, baseRevision: 2 }),
      });
      const rollbackPlan = plan({ revision: 2 });
      const rollback = envelope({
        payload: { planejamento: rollbackPlan },
        retaFinalSync: descriptor({
          revision: 2,
          baseRevision: 3,
          digest: computeRetaFinalPlanDigest(rollbackPlan),
        }),
      });
      expect(
        validateRetaFinalEnvelopeWrite({
          envelope: rollback,
          remoteEnvelope: remote,
        }),
      ).toMatchObject({
        allowed: false,
        reason: "rollback",
      });

      const jumpPlan = plan({ revision: 5 });
      const jump = envelope({
        payload: { planejamento: jumpPlan },
        retaFinalSync: descriptor({
          revision: 5,
          baseRevision: 3,
          digest: computeRetaFinalPlanDigest(jumpPlan),
        }),
      });
      expect(
        validateRetaFinalEnvelopeWrite({
          envelope: jump,
          remoteEnvelope: remote,
        }),
      ).toMatchObject({
        allowed: false,
        reason: "revision-jump",
      });
    });

    it("allows tombstone compaction only when the floor reaches the remote head", () => {
      const remotePlan = plan({ revision: 5 });
      const remote = envelope({
        payload: { planejamento: remotePlan },
        retaFinalSync: remoteDescriptor({
          revision: 5,
          baseRevision: 4,
          removedBlockIds: ["a", "b"],
          minRetainedRevision: 3,
          digest: computeRetaFinalPlanDigest(remotePlan),
        }),
      });
      const localPlan = plan({ revision: 6 });
      const compacted = envelope({
        payload: { planejamento: localPlan },
        retaFinalSync: descriptor({
          revision: 6,
          baseRevision: 5,
          removedBlockIds: ["a"],
          minRetainedRevision: 5,
          digest: computeRetaFinalPlanDigest(localPlan),
        }),
      });
      expect(
        validateRetaFinalEnvelopeWrite({
          envelope: compacted,
          remoteEnvelope: remote,
        }),
      ).toMatchObject({
        allowed: true,
        reason: "advance",
      });

      const badFloor = envelope({
        payload: { planejamento: localPlan },
        retaFinalSync: descriptor({
          revision: 6,
          baseRevision: 5,
          removedBlockIds: ["a"],
          minRetainedRevision: 4,
          digest: computeRetaFinalPlanDigest(localPlan),
        }),
      });
      expect(
        validateRetaFinalEnvelopeWrite({
          envelope: badFloor,
          remoteEnvelope: remote,
        }),
      ).toMatchObject({ allowed: false, reason: "tombstone-downgrade" });
    });

    it("rejects a different planId, lineage or generation", () => {
      const remote = envelope({
        retaFinalSync: remoteDescriptor({ revision: 3, baseRevision: 2 }),
      });
      for (const change of [
        { planId: "plan-2" },
        { lineageId: "lineage-2" },
        { generation: 2 },
      ]) {
        const local = envelope({
          retaFinalSync: descriptor({
            revision: 4,
            baseRevision: 3,
            ...change,
          }),
        });
        const result = validateRetaFinalEnvelopeWrite({
          envelope: local,
          remoteEnvelope: remote,
        });
        expect(result).toMatchObject({ allowed: false, reason: "lineage" });
      }
    });

    it("returns a conflict payload carrying both plans", () => {
      const remote = envelope({
        retaFinalSync: remoteDescriptor({ revision: 3, baseRevision: 2 }),
      });
      const local = envelope({
        retaFinalSync: descriptor({ revision: 4, baseRevision: 2 }),
      });
      const result = validateRetaFinalEnvelopeWrite({
        envelope: local,
        remoteEnvelope: remote,
      });
      expect(result.conflict).toMatchObject({
        type: "reta-final-conflict",
        cause: "stale-base",
        localRevision: 4,
        remoteRevision: 3,
        localPlan: local.payload.planejamento,
        remotePlan: remote.payload.planejamento,
      });
    });
  });

  describe("classifyRetaFinalRemoteError()", () => {
    it("classifies permission-denied as non retryable", () => {
      expect(
        classifyRetaFinalRemoteError({ code: "permission-denied" }),
      ).toEqual({
        type: "permission-denied",
        retryable: false,
        code: "permission-denied",
      });
    });

    it("classifies 409, aborted and failed-precondition as conflicts", () => {
      for (const error of [
        { status: 409 },
        { code: "aborted" },
        { code: "failed-precondition" },
      ]) {
        expect(classifyRetaFinalRemoteError(error)).toMatchObject({
          type: "conflict",
          retryable: true,
        });
      }
    });

    it("classifies offline and unavailable errors as retryable", () => {
      for (const error of [
        { code: "unavailable" },
        new Error("Failed to fetch"),
        { code: "deadline-exceeded" },
      ]) {
        expect(classifyRetaFinalRemoteError(error)).toMatchObject({
          type: "offline",
          retryable: true,
        });
      }
    });

    it("fails closed for unknown errors", () => {
      expect(classifyRetaFinalRemoteError(new Error("boom"))).toMatchObject({
        type: "unknown",
        retryable: false,
      });
    });
  });

  describe("shouldRefreshRetaFinalBase()", () => {
    it("requires a matching revision inside the retained window", () => {
      expect(
        shouldRefreshRetaFinalBase({
          baseRevision: 4,
          remoteRevision: 4,
          minRetainedRevision: 2,
        }),
      ).toBe(false);
      expect(
        shouldRefreshRetaFinalBase({
          baseRevision: 3,
          remoteRevision: 4,
          minRetainedRevision: 2,
        }),
      ).toBe(true);
      expect(
        shouldRefreshRetaFinalBase({
          baseRevision: 1,
          remoteRevision: 4,
          minRetainedRevision: 2,
        }),
      ).toBe(true);
    });

    it("fails closed for invalid revisions", () => {
      expect(
        shouldRefreshRetaFinalBase({
          baseRevision: null,
          remoteRevision: 4,
          minRetainedRevision: 2,
        }),
      ).toBe(true);
      expect(
        shouldRefreshRetaFinalBase({
          baseRevision: 4,
          remoteRevision: null,
          minRetainedRevision: 2,
        }),
      ).toBe(true);
    });
  });
});

describe("compareRetaFinalPlanIntent()", () => {
  function basePlan() {
    return {
      ativo: true,
      tipo: "reta_final",
      schemaVersionRetaFinal: 2,
      planId: "plan-1",
      generation: 1,
      revision: 0,
      updatedAt: "2026-10-20T12:00:00.000Z",
      operations: [{ operationId: "op-1" }],
      retaFinal: {
        dataFinal: "2026-12-20",
        blocos: [
          {
            id: "b1",
            discId: "d1",
            topicos: [{ assId: "a1" }],
            minutos: 30,
            ordem: 0,
            dataPlanejada: "2026-10-22",
            data: "2026-10-22",
            status: "pendente",
            rolagens: 0,
          },
          {
            id: "b2",
            discId: "d1",
            topicos: [{ assId: "a2" }],
            minutos: 45,
            ordem: 1,
            dataPlanejada: "2026-10-23",
            data: "2026-10-23",
            status: "pendente",
            rolagens: 0,
          },
        ],
      },
    };
  }

  it("ignores projection drift, per-device metadata and block order", () => {
    const left = basePlan();
    const right = JSON.parse(JSON.stringify(left));
    right.updatedAt = "2026-10-27T17:09:00.000Z";
    right.operations = [];
    right.retaFinal.blocos.reverse();
    right.retaFinal.blocos[0].data = "2026-10-27";
    right.retaFinal.blocos[0].status = "atrasado";
    right.retaFinal.blocos[0].rolagens = 3;
    right.retaFinal.blocos[0].dataEfetiva = "2026-10-27";

    expect(compareRetaFinalPlanIntent(left, right)).toMatchObject({
      equivalent: true,
      differences: [],
      blockCount: 2,
    });
  });

  it("reports real intent divergence by stable block path", () => {
    const left = basePlan();
    const right = JSON.parse(JSON.stringify(left));
    right.retaFinal.blocos[1].dataPlanejada = "2026-11-01";
    right.retaFinal.blocos[1].minutos = 90;

    const result = compareRetaFinalPlanIntent(left, right);

    expect(result.equivalent).toBe(false);
    expect(result.differences).toEqual(
      expect.arrayContaining([
        "retaFinal.blocos.b2.dataPlanejada",
        "retaFinal.blocos.b2.minutos",
      ]),
    );
    expect(result.changedBlockIds).toEqual(["b2"]);
  });

  it("reports a removed block as a divergence", () => {
    const left = basePlan();
    const right = JSON.parse(JSON.stringify(left));
    right.retaFinal.blocos.pop();

    expect(compareRetaFinalPlanIntent(left, right).differences).toContain(
      "retaFinal.blocos.b2",
    );
  });

  it("carries the remote wire digest for an unchanged plan", () => {
    const descriptor = buildRetaFinalSyncDescriptor({
      plan: basePlan(),
      baseRevision: 0,
      baseRemoteUpdatedAt: "2026-10-27T17:08:44.079Z",
      deviceId: "web-device1",
      capabilities: CAPABILITIES,
      state: "active",
      revision: 0,
      snapshotRevision: 2,
      baseSnapshotRevision: 1,
      wireDigest: "abcdefabcdef1234",
    });

    expect(descriptor.digest).toBe("abcdefabcdef1234");
  });
});
