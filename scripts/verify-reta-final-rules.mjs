#!/usr/bin/env node
/**
 * Proves the Reta Final v2 Firestore barrier against an already running local
 * Firestore emulator. This script deliberately does not start or stop any
 * emulator process.
 *
 * Requires the official harness installed locally (not in package.json):
 *   npm install --no-save @firebase/rules-unit-testing@5.0.0
 *
 * Usage:
 *   node scripts/verify-reta-final-rules.mjs --rules firestore.rules
 *   node scripts/verify-reta-final-rules.mjs --rules .tmp/old.rules
 *   node scripts/verify-reta-final-rules.mjs --host 127.0.0.1 --port 8090
 *
 * Exit codes: 0 proven / vulnerability reproduced, 1 assertion failure,
 * 2 NOT_RUN (emulator or harness unavailable).
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const CAPABILITIES = {
  schema: 2,
  granularMerge: true,
  guards: { envelope: "rules-v2", probe: 1 },
};
const INSTALL_HINT = "npm install --no-save @firebase/rules-unit-testing@5.0.0";

function parseArgs(argv) {
  const args = { rules: "firestore.rules", host: "127.0.0.1", port: 8090 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--rules") args.rules = argv[++index];
    else if (arg.startsWith("--rules="))
      args.rules = arg.slice("--rules=".length);
    else if (arg === "--host") args.host = argv[++index];
    else if (arg.startsWith("--host=")) args.host = arg.slice("--host=".length);
    else if (arg === "--port") args.port = Number(argv[++index]);
    else if (arg.startsWith("--port="))
      args.port = Number(arg.slice("--port=".length));
  }
  return args;
}

function notRun(message) {
  console.error(`NOT_RUN: ${message}`);
  process.exit(2);
}

function plan({ planId = "plan-1", revision = 2, ativo = true } = {}) {
  return {
    ativo,
    tipo: "reta_final",
    schemaVersionRetaFinal: 2,
    planId,
    revision,
    retaFinal: { dataFinal: "2026-12-20", blocos: [] },
  };
}

function repeated(char) {
  return char.repeat(32);
}

function envelope({
  planId = "plan-1",
  lineageId = planId,
  generation = 1,
  revision = 3,
  baseRevision = 2,
  snapshotRevision = baseRevision === 0 ? 1 : 2,
  baseSnapshotRevision = Math.max(0, snapshotRevision - 1),
  digest = repeated("b"),
  state = "active",
  payloadUpdatedAt = "2026-10-20T12:00:00.000Z",
  deviceId = "web-rules-test",
  withDescriptor = true,
  removedBlockIds,
  minRetainedRevision,
  payload,
} = {}) {
  const value = {
    version: 1,
    schemaVersion: 6,
    deviceId,
    baseRemoteUpdatedAt: null,
    payloadUpdatedAt,
    sentAt: payloadUpdatedAt,
    payload: payload ?? {
      config: {},
      planejamento: plan({ planId, revision, ativo: state !== "retired" }),
    },
  };
  if (withDescriptor) {
    value.retaFinalSync = {
      schema: 2,
      planId,
      lineageId,
      generation,
      revision,
      baseRevision,
      snapshotRevision,
      baseSnapshotRevision,
      baseRemoteUpdatedAt: null,
      digest,
      deviceId,
      capabilities: CAPABILITIES,
      state,
    };
    if (removedBlockIds) value.retaFinalSync.removedBlockIds = removedBlockIds;
    if (minRetainedRevision !== undefined) {
      value.retaFinalSync.minRetainedRevision = minRetainedRevision;
    }
  }
  return value;
}

function legacyEnvelope(payloadUpdatedAt = "2026-10-20T12:30:00.000Z") {
  return {
    version: 1,
    schemaVersion: 6,
    deviceId: "legacy-device",
    baseRemoteUpdatedAt: null,
    payloadUpdatedAt,
    sentAt: payloadUpdatedAt,
    payload: { config: {}, planejamento: plan({ revision: 1 }) },
  };
}

// Real pre-v2 shape: the planning has no planId, revision or
// schemaVersionRetaFinal, exactly like the snapshot written by 9.70.
function legacyRetaFinalPlan() {
  return {
    ativo: true,
    tipo: "reta_final",
    disciplinas: ["d1"],
    relevancia: {},
    horarios: { dataFinal: "2026-12-20" },
    materiasPorDia: 3,
    sequencia: [],
    skippedSlots: [],
    slotOverrides: [],
    ciclosCompletos: 0,
    dataInicioCicloAtual: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-10-22T17:45:50.000Z",
    retaFinal: {
      nome: "Reta Final legada",
      dataFinal: "2026-12-20",
      minutosPadrao: 60,
      importadoEm: "2026-09-01T12:00:00.000Z",
      blocos: [
        {
          id: "rf_001",
          discId: "d1",
          topicos: [{ assId: "a1", aulaId: null }],
          minutos: 60,
          data: "2026-10-10",
          dataOriginal: "2026-10-10",
          status: "pendente",
          rolagens: 0,
        },
      ],
    },
  };
}

function legacyRetaFinalEnvelope(
  payloadUpdatedAt = "2026-10-22T17:45:50.000Z",
) {
  return {
    version: 1,
    schemaVersion: 6,
    deviceId: "legacy-device",
    baseRemoteUpdatedAt: null,
    payloadUpdatedAt,
    sentAt: payloadUpdatedAt,
    payload: { config: {}, planejamento: legacyRetaFinalPlan() },
  };
}

function largeSanitizedPayload(planId = "rfplan_local") {
  const blocos = Array.from({ length: 180 }, (_, index) => ({
    id: `rf_${String(index).padStart(3, "0")}`,
    discId: `d${index % 3}`,
    topicos: [{ assId: `a${index % 5}`, aulaId: null }],
    minutos: 60,
    dataPlanejada: "2026-10-26",
    ordem: index,
    notas: "n".repeat(120),
  }));
  const eventos = Array.from({ length: 389 }, (_, index) => ({
    id: `ev_${index}`,
    discId: `d${index % 3}`,
    status: "estudei",
    tempo: 30,
    notas: "e".repeat(480),
  }));
  const editais = Array.from({ length: 4 }, (_, index) => ({
    id: `ed_${index}`,
    nome: `Edital ${index}`,
    conteudo: "x".repeat(150000),
    disciplinas: [
      {
        id: `d${index % 3}`,
        nome: `Disciplina ${index}`,
        assuntos: [{ id: `a${index % 5}`, nome: "Assunto sintetico" }],
      },
    ],
  }));
  return {
    config: {},
    planejamento: {
      ativo: true,
      tipo: "reta_final",
      schemaVersionRetaFinal: 2,
      planId,
      revision: 0,
      retaFinal: { dataFinal: "2027-02-28", blocos },
    },
    eventos,
    editais,
    habitos: {
      questoes: Array.from({ length: 82 }, (_, index) => ({
        id: `q_${index}`,
        total: 20,
        notas: "q".repeat(300),
      })),
    },
  };
}

function guardDoc(deviceId = "web-rules-test") {
  return {
    schema: 2,
    guardVersion: 1,
    deviceId,
    checkedAt: new Date().toISOString(),
  };
}

function firestoreCode(error) {
  return String(error?.code || error?.message || error).toLowerCase();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rulesPath = path.resolve(args.rules);
  if (!fs.existsSync(rulesPath)) notRun(`rules file not found: ${rulesPath}`);
  const rulesText = fs.readFileSync(rulesPath, "utf8");
  const newRules = rulesText.includes("retaFinalSync");
  const projectId = newRules ? "demo-reta-final-new" : "demo-reta-final-legacy";

  let testing;
  try {
    testing = await import("@firebase/rules-unit-testing");
  } catch (error) {
    notRun(
      `@firebase/rules-unit-testing is not installed locally. Run: ${INSTALL_HINT}`,
    );
  }
  const { initializeTestEnvironment, assertSucceeds } = testing;
  const { doc, getDoc, setDoc, deleteDoc } = await import("firebase/firestore");

  let environment;
  try {
    environment = await initializeTestEnvironment({
      projectId,
      firestore: {
        host: args.host,
        port: Number(args.port),
        rules: rulesText,
      },
    });
  } catch (error) {
    notRun(
      `emulator unavailable at ${args.host}:${args.port} or rules rejected: ${error.message}`,
    );
  }

  const owner = "uid-owner";
  const intruder = "uid-intruder";
  const ownerDb = environment.authenticatedContext(owner).firestore();
  const intruderDb = environment.authenticatedContext(intruder).firestore();
  const uidDb = (uid) => environment.authenticatedContext(uid).firestore();

  const results = [];
  const ok = (label, detail = "allowed") => ({ label, ok: true, detail });
  const failed = (label, detail) => ({ label, ok: false, detail });

  async function expectAllowed(label, operation) {
    try {
      await assertSucceeds(operation());
      return ok(label);
    } catch (error) {
      return failed(label, `expected allow, got ${firestoreCode(error)}`);
    }
  }

  async function expectDenied(label, operation) {
    try {
      await operation();
      return failed(label, "expected permission-denied, got allowed");
    } catch (error) {
      const code = firestoreCode(error);
      return {
        label,
        ok:
          code.includes("permission-denied") ||
          code.includes("permission_denied"),
        detail: code,
      };
    }
  }

  const seed = async (uid, value) => {
    const seeded = value?.retaFinalSync
      ? {
          ...value,
          retaFinalSync: {
            ...value.retaFinalSync,
            snapshotRevision: 1,
            baseSnapshotRevision: 0,
          },
        }
      : value;
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "users", uid, "snapshots", "main"),
        seeded,
      );
    });
  };
  const seedEntity = async (uid, entityId, value) => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "users", uid, "entities", entityId),
        value,
      );
    });
  };

  // Baseline: a valid legacy create must pass, including a plain snapshot.
  results.push(
    await expectAllowed("minimal legacy snapshot", () =>
      setDoc(
        doc(uidDb("uid-minimal"), "users", "uid-minimal", "snapshots", "main"),
        {
          version: 1,
          schemaVersion: 6,
          deviceId: "legacy-device",
          baseRemoteUpdatedAt: null,
          payloadUpdatedAt: "2026-10-20T10:00:00.000Z",
          sentAt: "2026-10-20T10:00:00.000Z",
          payload: { config: {} },
        },
      ),
    ),
  );
  results.push(
    await expectAllowed("baseline legacy create", () =>
      setDoc(
        doc(ownerDb, "users", owner, "snapshots", "main"),
        legacyEnvelope("2026-10-20T10:00:00.000Z"),
      ),
    ),
  );

  // Legacy compatibility matrix: entity-primary collections and documents.
  const entityDoc = (overrides = {}) => ({
    version: 1,
    key: "eventos/ev_1",
    collection: "eventos",
    id: "ev_1",
    revision: 1,
    payload: { id: "ev_1", titulo: "Evento" },
    ...overrides,
  });
  const entityPath = (uid, entityId) =>
    doc(uidDb(uid), "users", uid, "entities", entityId);

  for (const collection of [
    "disciplinas",
    "assuntos",
    "aulas",
    "planejamento.sequencia",
  ]) {
    const uid = "uid-entity-" + collection.replace(".", "-");
    results.push(
      await expectAllowed(
        "legacy entity " + collection + " revision 0",
        () =>
          setDoc(
            entityPath(uid, collection + "-x1"),
            entityDoc({
              key: collection + "/x1",
              collection,
              id: "x1",
              revision: 0,
            }),
          ),
      ),
    );
  }

  results.push(
    await expectAllowed("legacy entity optional fields absent", () =>
      setDoc(
        entityPath("uid-entity-min", "eventos-min"),
        entityDoc({ key: "eventos/ev_min", id: "ev_min", revision: 1 }),
      ),
    ),
  );
  results.push(
    await expectAllowed("legacy entity optional fields null", () =>
      setDoc(
        entityPath("uid-entity-null", "eventos-null"),
        entityDoc({
          key: "eventos/ev_null",
          id: "ev_null",
          schemaVersion: 6,
          checksum: null,
          updatedAt: null,
          deletedAt: null,
          updatedBy: null,
          sentAt: "2026-10-20T10:00:00.000Z",
        }),
      ),
    ),
  );
  results.push(
    await expectAllowed("legacy entity tombstone payload null", () =>
      setDoc(
        entityPath("uid-entity-tomb", "eventos-tomb"),
        entityDoc({
          key: "eventos/ev_tomb",
          id: "ev_tomb",
          revision: 2,
          payload: null,
          deletedAt: "2026-10-20T10:00:00.000Z",
        }),
      ),
    ),
  );
  results.push(
    await expectAllowed("entity tombstone with payload marker", () =>
      setDoc(
        entityPath("uid-entity-soft", "eventos-soft"),
        entityDoc({
          key: "eventos/ev_soft",
          id: "ev_soft",
          revision: 2,
          deletedAt: "2026-10-20T10:00:00.000Z",
          payload: {
            id: "ev_soft",
            titulo: "soft delete",
            deletedAt: "2026-10-20T10:00:00.000Z",
          },
        }),
      ),
    ),
  );
  results.push(
    await expectDenied("entity tombstone payload without marker denied", () =>
      setDoc(
        entityPath("uid-entity-soft-deny", "eventos-soft-deny"),
        entityDoc({
          key: "eventos/ev_soft_deny",
          id: "ev_soft_deny",
          revision: 2,
          deletedAt: "2026-10-20T10:00:00.000Z",
          payload: { id: "ev_soft_deny" },
        }),
      ),
    ),
  );
  results.push(
    await expectAllowed("event notes in entity payload", () =>
      setDoc(
        entityPath("uid-entity-notes", "eventos-notes"),
        entityDoc({
          key: "eventos/ev_notes",
          id: "ev_notes",
          revision: 1,
          payload: {
            id: "ev_notes",
            notas: "acentuação ç • marcador " + "x".repeat(856),
          },
        }),
      ),
    ),
  );
  results.push(
    await expectDenied("unknown entity collection denied", () =>
      setDoc(
        entityPath("uid-entity-unknown", "x"),
        entityDoc({ key: "x/y", collection: "x", id: "y" }),
      ),
    ),
  );
  await seedEntity(
    "uid-entity-cas",
    "eventos-cas",
    entityDoc({ key: "eventos/ev_cas", id: "ev_cas", revision: 3 }),
  );
  results.push(
    await expectDenied("entity stale revision denied", () =>
      setDoc(
        entityPath("uid-entity-cas", "eventos-cas"),
        entityDoc({ key: "eventos/ev_cas", id: "ev_cas", revision: 2 }),
      ),
    ),
  );
  results.push(
    await expectAllowed("entity same revision idempotent", () =>
      setDoc(
        entityPath("uid-entity-cas", "eventos-cas"),
        entityDoc({ key: "eventos/ev_cas", id: "ev_cas", revision: 3 }),
      ),
    ),
  );
  results.push(
    await expectAllowed("entity revision advance", () =>
      setDoc(
        entityPath("uid-entity-cas", "eventos-cas"),
        entityDoc({ key: "eventos/ev_cas", id: "ev_cas", revision: 4 }),
      ),
    ),
  );
  await seedEntity(
    "uid-entity-cas-mut",
    "eventos-cas-mut",
    entityDoc({
      key: "eventos/ev_cas_mut",
      id: "ev_cas_mut",
      revision: 3,
      payload: { id: "ev_cas_mut", titulo: "original" },
    }),
  );
  results.push(
    await expectDenied("entity same revision content mutation denied", () =>
      setDoc(
        entityPath("uid-entity-cas-mut", "eventos-cas-mut"),
        entityDoc({
          key: "eventos/ev_cas_mut",
          id: "ev_cas_mut",
          revision: 3,
          payload: { id: "ev_cas_mut", titulo: "mutated" },
        }),
      ),
    ),
  );
  await seedEntity(
    "uid-entity-jump",
    "eventos-jump",
    entityDoc({ key: "eventos/ev_jump", id: "ev_jump", revision: 3 }),
  );
  results.push(
    await expectAllowed("entity revision jump allowed for offline batches", () =>
      setDoc(
        entityPath("uid-entity-jump", "eventos-jump"),
        entityDoc({
          key: "eventos/ev_jump",
          id: "ev_jump",
          revision: 5,
          payload: { id: "ev_jump", titulo: "batch" },
        }),
      ),
    ),
  );
  await seedEntity(
    "uid-entity-merge",
    "eventos-merge",
    entityDoc({
      key: "eventos/ev_merge",
      id: "ev_merge",
      revision: 3,
      payload: { id: "ev_merge", titulo: "original" },
    }),
  );
  results.push(
    await expectDenied("entity same revision merge mutation denied", () =>
      setDoc(
        entityPath("uid-entity-merge", "eventos-merge"),
        { payload: { id: "ev_merge", titulo: "merged" } },
        { merge: true },
      ),
    ),
  );
  const tombstoneReplay = entityDoc({
    key: "eventos/ev_tomb_replay",
    id: "ev_tomb_replay",
    revision: 2,
    payload: null,
    deletedAt: "2026-10-20T10:00:00.000Z",
  });
  await seedEntity("uid-entity-tomb-replay", "eventos-tomb-replay", tombstoneReplay);
  results.push(
    await expectAllowed("entity tombstone identical replay allowed", () =>
      setDoc(
        entityPath("uid-entity-tomb-replay", "eventos-tomb-replay"),
        tombstoneReplay,
      ),
    ),
  );

  await seed("uid-legacy-update", legacyEnvelope("2026-10-20T10:00:00.000Z"));
  results.push(
    await expectAllowed("legacy snapshot update", () =>
      setDoc(
        doc(
          uidDb("uid-legacy-update"),
          "users",
          "uid-legacy-update",
          "snapshots",
          "main",
        ),
        legacyEnvelope("2026-10-20T11:00:00.000Z"),
      ),
    ),
  );
  await seed("uid-owner-read", legacyEnvelope());
  results.push(
    await expectAllowed("owner reads own snapshot", () =>
      getDoc(
        doc(
          uidDb("uid-owner-read"),
          "users",
          "uid-owner-read",
          "snapshots",
          "main",
        ),
      ),
    ),
  );
  await seed("uid-partial-v2", envelope({ revision: 2, baseRevision: 1 }));
  results.push(
    await expectDenied("partial v2 payload update denied", () =>
      setDoc(
        doc(
          uidDb("uid-partial-v2"),
          "users",
          "uid-partial-v2",
          "snapshots",
          "main",
        ),
        { payload: { hacked: true } },
        { merge: true },
      ),
    ),
  );

  // 1. Legacy overwrite over a seeded v2 document.
  await seed(
    "uid-legacy-overwrite",
    envelope({ revision: 2, baseRevision: 1 }),
  );
  const legacyOverwrite = await expectAllowed("legacy overwrite over v2", () =>
    setDoc(
      doc(
        uidDb("uid-legacy-overwrite"),
        "users",
        "uid-legacy-overwrite",
        "snapshots",
        "main",
      ),
      legacyEnvelope("2026-10-20T13:00:00.000Z"),
    ),
  );
  if (newRules) {
    const holds =
      !legacyOverwrite.ok &&
      legacyOverwrite.detail.includes("permission-denied");
    results.push({
      label: legacyOverwrite.label,
      ok: holds,
      detail: holds ? "denied (barrier holds)" : legacyOverwrite.detail,
    });
  } else {
    results.push({
      label: legacyOverwrite.label,
      ok: legacyOverwrite.ok,
      detail: legacyOverwrite.ok
        ? "ALLOWED (vulnerability reproduced)"
        : legacyOverwrite.detail,
    });
  }

  if (!newRules) {
    results.push(
      await expectDenied("guard probe denied by legacy rules", () =>
        setDoc(
          doc(
            uidDb("uid-guard-legacy"),
            "users",
            "uid-guard-legacy",
            "syncMeta",
            "reta-final-guard",
          ),
          guardDoc(),
        ),
      ),
    );
    results.push(
      await expectDenied("intruder cannot write another uid snapshot", () =>
        setDoc(
          doc(intruderDb, "users", "uid-legacy-overwrite", "snapshots", "main"),
          legacyEnvelope("2026-10-20T14:00:00.000Z"),
        ),
      ),
    );
    report(results, { newRules, host: args.host, port: args.port });
    await environment.clearFirestore();
    await environment.cleanup();
    return;
  }

  // 2. Create, advance and stale base.
  results.push(
    await expectAllowed("v2 create with baseRevision 0", () =>
      setDoc(
        doc(uidDb("uid-create"), "users", "uid-create", "snapshots", "main"),
        envelope({ revision: 1, baseRevision: 0 }),
      ),
    ),
  );

  await seed("uid-advance", envelope({ revision: 2, baseRevision: 1 }));
  results.push(
    await expectAllowed("v2 advance with correct base", () =>
      setDoc(
        doc(uidDb("uid-advance"), "users", "uid-advance", "snapshots", "main"),
        envelope({ revision: 3, baseRevision: 2 }),
      ),
    ),
  );

  // Academic-only pushes are fail-closed: any content change must advance the
  // plan revision until the client provides a server-verifiable intent proof.
  const academicPlan = plan({ revision: 2 });
  await seed(
    "uid-academic",
    envelope({
      revision: 2,
      baseRevision: 1,
      payload: { config: {}, planejamento: academicPlan, eventos: [] },
    }),
  );
  const academicPayload = {
    config: {},
    planejamento: academicPlan,
    eventos: [{ id: "ev-1", status: "estudei", tempoAcumulado: 60 }],
  };
  results.push(
    await expectAllowed("academic-only write keeps the plan revision", () =>
      setDoc(
        doc(
          uidDb("uid-academic"),
          "users",
          "uid-academic",
          "snapshots",
          "main",
        ),
        envelope({ revision: 2, baseRevision: 1, payload: academicPayload }),
      ),
    ),
  );
  await seed(
    "uid-academic-merge",
    envelope({
      revision: 2,
      baseRevision: 1,
      payload: { config: {}, planejamento: academicPlan, eventos: [] },
    }),
  );
  const mergeEnvelope = envelope({
    revision: 2,
    baseRevision: 1,
    payload: {
      config: {},
      planejamento: academicPlan,
      eventos: [{ id: "ev-merge" }],
    },
  });
  results.push(
    await expectAllowed("academic merge omitting planejamento allowed", () =>
      setDoc(
        doc(
          uidDb("uid-academic-merge"),
          "users",
          "uid-academic-merge",
          "snapshots",
          "main",
        ),
        {
          payload: { eventos: [{ id: "ev-merge" }] },
          retaFinalSync: mergeEnvelope.retaFinalSync,
          payloadUpdatedAt: mergeEnvelope.payloadUpdatedAt,
          sentAt: mergeEnvelope.sentAt,
        },
        { merge: true },
      ),
    ),
  );
  await seed(
    "uid-academic-merge-bad",
    envelope({
      revision: 2,
      baseRevision: 1,
      payload: { config: {}, planejamento: academicPlan, eventos: [] },
    }),
  );
  const tamperedPlan = {
    ...academicPlan,
    retaFinal: { ...academicPlan.retaFinal, minutosPadrao: 90 },
  };
  const tamperedEnvelope = envelope({
    revision: 2,
    baseRevision: 1,
    payload: { config: {}, planejamento: tamperedPlan, eventos: [] },
  });
  results.push(
    await expectDenied("academic merge tampering plan denied", () =>
      setDoc(
        doc(
          uidDb("uid-academic-merge-bad"),
          "users",
          "uid-academic-merge-bad",
          "snapshots",
          "main",
        ),
        {
          payload: { planejamento: tamperedPlan },
          retaFinalSync: tamperedEnvelope.retaFinalSync,
          payloadUpdatedAt: tamperedEnvelope.payloadUpdatedAt,
          sentAt: tamperedEnvelope.sentAt,
        },
        { merge: true },
      ),
    ),
  );
  await seed(
    "uid-academic-retired",
    envelope({
      revision: 2,
      baseRevision: 1,
      state: "retired",
      payload: { config: {}, eventos: [] },
    }),
  );
  results.push(
    await expectAllowed("academic-only retired write without planejamento", () =>
      setDoc(
        doc(
          uidDb("uid-academic-retired"),
          "users",
          "uid-academic-retired",
          "snapshots",
          "main",
        ),
        envelope({
          revision: 2,
          baseRevision: 1,
          state: "retired",
          payload: { config: {}, eventos: [{ id: "ev-retired" }] },
        }),
      ),
    ),
  );
  const intentPlan = {
    ...plan({ revision: 2 }),
    retaFinal: {
      dataFinal: "2026-12-20",
      minutosPadrao: 60,
      blocos: [
        {
          id: "b1",
          discId: "disc-1",
          topicos: [],
          minutos: 60,
          dataOriginal: "2026-10-20",
          data: "2026-10-20",
        },
      ],
    },
  };
  await seed(
    "uid-academic-intent",
    envelope({
      revision: 2,
      baseRevision: 1,
      payload: { config: {}, planejamento: intentPlan, eventos: [] },
    }),
  );
  results.push(
    await expectDenied("academic write changing plan intent denied", () =>
      setDoc(
        doc(
          uidDb("uid-academic-intent"),
          "users",
          "uid-academic-intent",
          "snapshots",
          "main",
        ),
        envelope({
          revision: 2,
          baseRevision: 1,
          payload: {
            config: {},
            planejamento: {
              ...intentPlan,
              retaFinal: {
                ...intentPlan.retaFinal,
                blocos: [{ ...intentPlan.retaFinal.blocos[0], minutos: 120 }],
              },
            },
            eventos: [],
          },
        }),
      ),
    ),
  );
  await seed(
    "uid-academic-derived",
    envelope({
      revision: 2,
      baseRevision: 1,
      payload: { config: {}, planejamento: intentPlan, eventos: [] },
    }),
  );
  results.push(
    await expectDenied("academic write changing derived plan field denied", () =>
      setDoc(
        doc(
          uidDb("uid-academic-derived"),
          "users",
          "uid-academic-derived",
          "snapshots",
          "main",
        ),
        envelope({
          revision: 2,
          baseRevision: 1,
          payload: {
            config: {},
            planejamento: {
              ...intentPlan,
              retaFinal: {
                ...intentPlan.retaFinal,
                blocos: [{ ...intentPlan.retaFinal.blocos[0], data: "2026-10-21" }],
              },
            },
            eventos: [],
          },
        }),
      ),
    ),
  );
  results.push(
    await expectDenied("academic write changing only the digest", () =>
      setDoc(
        doc(
          uidDb("uid-academic"),
          "users",
          "uid-academic",
          "snapshots",
          "main",
        ),
        envelope({
          revision: 2,
          baseRevision: 1,
          digest: repeated("c"),
          payload: academicPayload,
        }),
      ),
    ),
  );
  results.push(
    await expectDenied("snapshot revision jump", () =>
      setDoc(
        doc(
          uidDb("uid-academic"),
          "users",
          "uid-academic",
          "snapshots",
          "main",
        ),
        envelope({
          revision: 2,
          baseRevision: 1,
          snapshotRevision: 4,
          baseSnapshotRevision: 2,
          payload: academicPayload,
        }),
      ),
    ),
  );
  results.push(
    await expectDenied("stale snapshot revision", () =>
      setDoc(
        doc(
          uidDb("uid-academic"),
          "users",
          "uid-academic",
          "snapshots",
          "main",
        ),
        envelope({
          revision: 2,
          baseRevision: 1,
          snapshotRevision: 2,
          baseSnapshotRevision: 0,
          payload: academicPayload,
        }),
      ),
    ),
  );

  await seed("uid-stale", envelope({ revision: 3, baseRevision: 2 }));
  results.push(
    await expectDenied("v2 stale base after another write", () =>
      setDoc(
        doc(uidDb("uid-stale"), "users", "uid-stale", "snapshots", "main"),
        envelope({ revision: 4, baseRevision: 2, digest: repeated("c") }),
      ),
    ),
  );

  // 3. Replay and digest collision.
  await seed("uid-replay", envelope({ revision: 2, baseRevision: 1 }));
  const replay = envelope({
    revision: 3,
    baseRevision: 2,
    digest: repeated("d"),
  });
  await assertSucceeds(
    setDoc(
      doc(uidDb("uid-replay"), "users", "uid-replay", "snapshots", "main"),
      replay,
    ),
  );
  results.push(
    await expectAllowed("v2 identical replay", () =>
      setDoc(
        doc(uidDb("uid-replay"), "users", "uid-replay", "snapshots", "main"),
        replay,
      ),
    ),
  );
  results.push(
    await expectDenied("v2 same revision different digest", () =>
      setDoc(
        doc(uidDb("uid-replay"), "users", "uid-replay", "snapshots", "main"),
        {
          ...replay,
          retaFinalSync: { ...replay.retaFinalSync, digest: repeated("e") },
        },
      ),
    ),
  );
  results.push(
    await expectDenied("v2 replay with changed payload", () => {
      const changed = {
        ...replay,
        payload: {
          ...replay.payload,
          planejamento: { ...replay.payload.planejamento, revision: 99 },
        },
      };
      return setDoc(
        doc(uidDb("uid-replay"), "users", "uid-replay", "snapshots", "main"),
        changed,
      );
    }),
  );
  await seed(
    "uid-replay-tombstone",
    envelope({
      revision: 3,
      baseRevision: 2,
      removedBlockIds: ["b1", "b2"],
      minRetainedRevision: 2,
    }),
  );
  results.push(
    await expectDenied("replay with reduced removedBlockIds", () =>
      setDoc(
        doc(
          uidDb("uid-replay-tombstone"),
          "users",
          "uid-replay-tombstone",
          "snapshots",
          "main",
        ),
        envelope({
          revision: 3,
          baseRevision: 2,
          removedBlockIds: ["b1"],
          minRetainedRevision: 2,
        }),
      ),
    ),
  );

  // 4. Rollback and identity changes.
  await seed("uid-rollback", envelope({ revision: 3, baseRevision: 2 }));
  results.push(
    await expectDenied("v2 rollback", () =>
      setDoc(
        doc(
          uidDb("uid-rollback"),
          "users",
          "uid-rollback",
          "snapshots",
          "main",
        ),
        envelope({ revision: 2, baseRevision: 3, digest: repeated("9") }),
      ),
    ),
  );
  results.push(
    await expectDenied("v2 planId change", () =>
      setDoc(
        doc(
          uidDb("uid-rollback"),
          "users",
          "uid-rollback",
          "snapshots",
          "main",
        ),
        envelope({ planId: "plan-2", revision: 4, baseRevision: 3 }),
      ),
    ),
  );
  results.push(
    await expectDenied("v2 generation change", () =>
      setDoc(
        doc(
          uidDb("uid-rollback"),
          "users",
          "uid-rollback",
          "snapshots",
          "main",
        ),
        envelope({ generation: 2, revision: 4, baseRevision: 3 }),
      ),
    ),
  );
  await seed(
    "uid-tombstone-floor",
    envelope({
      revision: 2,
      baseRevision: 1,
      removedBlockIds: ["b1"],
      minRetainedRevision: 2,
    }),
  );
  results.push(
    await expectDenied("advance reducing minRetainedRevision", () =>
      setDoc(
        doc(
          uidDb("uid-tombstone-floor"),
          "users",
          "uid-tombstone-floor",
          "snapshots",
          "main",
        ),
        envelope({
          revision: 3,
          baseRevision: 2,
          removedBlockIds: ["b1"],
          minRetainedRevision: 1,
        }),
      ),
    ),
  );
  await seed(
    "uid-tombstone-list",
    envelope({
      revision: 2,
      baseRevision: 1,
      removedBlockIds: ["b1", "b2"],
      minRetainedRevision: 1,
    }),
  );
  results.push(
    await expectDenied("advance reducing removedBlockIds", () =>
      setDoc(
        doc(
          uidDb("uid-tombstone-list"),
          "users",
          "uid-tombstone-list",
          "snapshots",
          "main",
        ),
        envelope({
          revision: 3,
          baseRevision: 2,
          removedBlockIds: ["b1"],
          minRetainedRevision: 1,
        }),
      ),
    ),
  );
  results.push(
    await expectAllowed("advance adding a tombstone", () =>
      setDoc(
        doc(
          uidDb("uid-tombstone-list"),
          "users",
          "uid-tombstone-list",
          "snapshots",
          "main",
        ),
        envelope({
          revision: 3,
          baseRevision: 2,
          removedBlockIds: ["b1", "b2", "b3"],
          minRetainedRevision: 1,
        }),
      ),
    ),
  );
  const compactionIds = Array.from({ length: 200 }, (_, index) => `t${index}`);
  await seed(
    "uid-compaction-ok",
    envelope({
      revision: 100,
      baseRevision: 99,
      removedBlockIds: compactionIds,
      minRetainedRevision: 99,
    }),
  );
  results.push(
    await expectAllowed(
      "tombstone compaction raises floor to remote head",
      () =>
        setDoc(
          doc(
            uidDb("uid-compaction-ok"),
            "users",
            "uid-compaction-ok",
            "snapshots",
            "main",
          ),
          envelope({
            revision: 101,
            baseRevision: 100,
            removedBlockIds: compactionIds.slice(0, 199),
            minRetainedRevision: 100,
          }),
        ),
    ),
  );
  await seed(
    "uid-compaction-bad",
    envelope({
      revision: 100,
      baseRevision: 99,
      removedBlockIds: compactionIds,
      minRetainedRevision: 99,
    }),
  );
  results.push(
    await expectDenied(
      "tombstone compaction with floor below remote head",
      () =>
        setDoc(
          doc(
            uidDb("uid-compaction-bad"),
            "users",
            "uid-compaction-bad",
            "snapshots",
            "main",
          ),
          envelope({
            revision: 101,
            baseRevision: 100,
            removedBlockIds: compactionIds.slice(0, 199),
            minRetainedRevision: 99,
          }),
        ),
    ),
  );
  await seed(
    "uid-replay-order",
    envelope({
      revision: 3,
      baseRevision: 2,
      removedBlockIds: ["b1", "b2"],
      minRetainedRevision: 2,
    }),
  );
  results.push(
    await expectDenied("replay with reordered removedBlockIds", () =>
      setDoc(
        doc(
          uidDb("uid-replay-order"),
          "users",
          "uid-replay-order",
          "snapshots",
          "main",
        ),
        envelope({
          revision: 3,
          baseRevision: 2,
          removedBlockIds: ["b2", "b1"],
          minRetainedRevision: 2,
        }),
      ),
    ),
  );
  await seed("uid-payload-lineage", envelope({ revision: 2, baseRevision: 1 }));
  results.push(
    await expectDenied("active payload with different planId", () => {
      const value = envelope({ revision: 3, baseRevision: 2 });
      value.payload.planejamento = plan({ planId: "plan-2", revision: 3 });
      return setDoc(
        doc(
          uidDb("uid-payload-lineage"),
          "users",
          "uid-payload-lineage",
          "snapshots",
          "main",
        ),
        value,
      );
    }),
  );
  await seed(
    "uid-payload-lineage-retired",
    envelope({ revision: 2, baseRevision: 1 }),
  );
  results.push(
    await expectDenied("retired payload with different planId", () => {
      const value = envelope({
        revision: 3,
        baseRevision: 2,
        state: "retired",
      });
      value.payload.planejamento = plan({
        planId: "plan-2",
        revision: 3,
        ativo: false,
      });
      return setDoc(
        doc(
          uidDb("uid-payload-lineage-retired"),
          "users",
          "uid-payload-lineage-retired",
          "snapshots",
          "main",
        ),
        value,
      );
    }),
  );

  // 5. Adoption over a legacy document.
  await seed("uid-adopt", legacyEnvelope("2026-10-20T11:00:00.000Z"));
  results.push(
    await expectAllowed("v2 adoption with matching payloadUpdatedAt", () => {
      const value = envelope({ revision: 1, baseRevision: 0 });
      value.retaFinalSync.baseRemoteUpdatedAt = "2026-10-20T11:00:00.000Z";
      return setDoc(
        doc(uidDb("uid-adopt"), "users", "uid-adopt", "snapshots", "main"),
        value,
      );
    }),
  );
  await seed("uid-adopt-bad", legacyEnvelope("2026-10-20T11:00:00.000Z"));
  results.push(
    await expectDenied("v2 adoption with divergent payloadUpdatedAt", () => {
      const value = envelope({ revision: 1, baseRevision: 0 });
      value.retaFinalSync.baseRemoteUpdatedAt = "2026-10-20T10:00:00.000Z";
      return setDoc(
        doc(
          uidDb("uid-adopt-bad"),
          "users",
          "uid-adopt-bad",
          "snapshots",
          "main",
        ),
        value,
      );
    }),
  );

  // 5b. Adoption over a real pre-v2 planning and its CAS boundaries.
  await seed(
    "uid-adopt-legacy",
    legacyRetaFinalEnvelope("2026-10-22T17:45:50.000Z"),
  );
  results.push(
    await expectAllowed("v2 adoption over a real pre-v2 plan", () => {
      const value = envelope({
        planId: "rfplan_local",
        revision: 0,
        baseRevision: 0,
      });
      value.retaFinalSync.baseRemoteUpdatedAt = "2026-10-22T17:45:50.000Z";
      return setDoc(
        doc(
          uidDb("uid-adopt-legacy"),
          "users",
          "uid-adopt-legacy",
          "snapshots",
          "main",
        ),
        value,
      );
    }),
  );
  results.push(
    await expectAllowed("plan advance after a legacy adoption", () => {
      const value = envelope({
        planId: "rfplan_local",
        revision: 1,
        baseRevision: 0,
        snapshotRevision: 2,
        baseSnapshotRevision: 1,
      });
      return setDoc(
        doc(
          uidDb("uid-adopt-legacy"),
          "users",
          "uid-adopt-legacy",
          "snapshots",
          "main",
        ),
        value,
      );
    }),
  );
  results.push(
    await expectDenied("second lineage cannot reuse an adopted document", () => {
      const value = envelope({
        planId: "rfplan_other",
        revision: 0,
        baseRevision: 0,
      });
      value.retaFinalSync.baseRemoteUpdatedAt = "2026-10-22T17:45:50.000Z";
      return setDoc(
        doc(
          uidDb("uid-adopt-legacy"),
          "users",
          "uid-adopt-legacy",
          "snapshots",
          "main",
        ),
        value,
      );
    }),
  );

  await seed(
    "uid-adopt-race",
    legacyRetaFinalEnvelope("2026-10-22T17:45:50.000Z"),
  );
  results.push(
    await expectAllowed(
      "legacy writer updates the document during migration",
      () =>
        setDoc(
          doc(
            uidDb("uid-adopt-race"),
            "users",
            "uid-adopt-race",
            "snapshots",
            "main",
          ),
          legacyRetaFinalEnvelope("2026-10-22T18:10:00.000Z"),
        ),
    ),
  );
  results.push(
    await expectDenied(
      "v2 adoption blocked after a concurrent legacy write",
      () => {
        const value = envelope({
          planId: "rfplan_local",
          revision: 0,
          baseRevision: 0,
        });
        value.retaFinalSync.baseRemoteUpdatedAt =
          "2026-10-22T17:45:50.000Z";
        return setDoc(
          doc(
            uidDb("uid-adopt-race"),
            "users",
            "uid-adopt-race",
            "snapshots",
            "main",
          ),
          value,
        );
      },
    ),
  );

  // 5c. Academic payload survives the adoption write and the readback.
  await seed(
    "uid-adopt-academic",
    legacyRetaFinalEnvelope("2026-10-22T17:45:50.000Z"),
  );
  results.push(
    await expectAllowed("v2 adoption keeps academic payload", () => {
      const value = envelope({
        planId: "rfplan_local",
        revision: 0,
        baseRevision: 0,
      });
      value.retaFinalSync.baseRemoteUpdatedAt = "2026-10-22T17:45:50.000Z";
      value.payload.eventos = [
        {
          id: "ev-adopt",
          status: "estudei",
          tempo: 30,
          notas: "nota-sintetica",
        },
      ];
      value.payload.habitos = { questoes: [{ id: "q-adopt", total: 10 }] };
      value.payload.editais = [{ id: "ed-adopt", nome: "Sintetico" }];
      return setDoc(
        doc(
          uidDb("uid-adopt-academic"),
          "users",
          "uid-adopt-academic",
          "snapshots",
          "main",
        ),
        value,
      );
    }),
  );
  results.push(
    await expectAllowed("academic payload readback after adoption", async () => {
      const snap = await getDoc(
        doc(
          uidDb("uid-adopt-academic"),
          "users",
          "uid-adopt-academic",
          "snapshots",
          "main",
        ),
      );
      const data = snap.data();
      const preserved =
        data?.payload?.eventos?.[0]?.notas === "nota-sintetica" &&
        data?.payload?.eventos?.[0]?.tempo === 30 &&
        data?.payload?.habitos?.questoes?.[0]?.total === 10 &&
        data?.payload?.editais?.[0]?.id === "ed-adopt";
      if (!preserved) throw new Error("academic payload was not preserved");
    }),
  );

  // 5d. A sanitized Reta Final snapshot with the real data shape fits 1 MiB.
  const largePayload = largeSanitizedPayload("rfplan_local");
  const largeEnvelope = envelope({
    planId: "rfplan_local",
    revision: 0,
    baseRevision: 0,
    payload: largePayload,
    payloadUpdatedAt: "2026-10-26T20:00:00.000Z",
  });
  console.log(
    `LARGE_SANITIZED_JSON_BYTES=${Buffer.byteLength(JSON.stringify(largeEnvelope), "utf8")}`,
  );
  results.push(
    await expectAllowed("large sanitized snapshot fits Firestore 1 MiB", () =>
      setDoc(
        doc(
          uidDb("uid-large-sanitized"),
          "users",
          "uid-large-sanitized",
          "snapshots",
          "main",
        ),
        largeEnvelope,
      ),
    ),
  );
  results.push(
    await expectAllowed("large sanitized snapshot readback intact", async () => {
      const snap = await getDoc(
        doc(
          uidDb("uid-large-sanitized"),
          "users",
          "uid-large-sanitized",
          "snapshots",
          "main",
        ),
      );
      const data = snap.data();
      const intact =
        data?.payload?.planejamento?.retaFinal?.blocos?.length === 180 &&
        data?.payload?.eventos?.length === 389 &&
        data?.payload?.editais?.length === 4 &&
        data?.payload?.habitos?.questoes?.length === 82 &&
        data?.retaFinalSync?.planId === "rfplan_local";
      if (!intact) throw new Error("large sanitized payload was not preserved");
    }),
  );

  // 5e. Stale adoption outbox can rebase to snapshotRevision 2 when the plan
  // is unchanged and the academic payload is the only difference.
  const rebasePlan = plan({ planId: "rfplan_local", revision: 0, ativo: true });
  const rebaseSeedPayload = {
    config: {},
    planejamento: rebasePlan,
    eventos: [{ id: "ev_seed" }],
    editais: [],
    disciplinas: [],
  };
  await seed(
    "uid-rebase-snapshot",
    envelope({
      planId: "rfplan_local",
      revision: 0,
      baseRevision: 0,
      payload: rebaseSeedPayload,
      payloadUpdatedAt: "2026-10-27T17:08:44.079Z",
      deviceId: "remote-device",
    }),
  );
  results.push(
    await expectAllowed("stale adoption rebase to snapshotRevision 2", () => {
      const value = envelope({
        planId: "rfplan_local",
        revision: 0,
        baseRevision: 0,
        snapshotRevision: 2,
        baseSnapshotRevision: 1,
        payload: {
          config: {},
          planejamento: rebasePlan,
          eventos: [{ id: "ev_seed" }, { id: "ev_rebase" }],
          editais: [],
          disciplinas: [],
        },
        payloadUpdatedAt: "2026-10-27T17:20:00.000Z",
        deviceId: "web-rebase",
      });
      value.retaFinalSync.baseRemoteUpdatedAt =
        "2026-10-27T17:08:44.079Z";
      return setDoc(
        doc(
          uidDb("uid-rebase-snapshot"),
          "users",
          "uid-rebase-snapshot",
          "snapshots",
          "main",
        ),
        value,
      );
    }),
  );
  results.push(
    await expectAllowed("stale adoption rebase readback", async () => {
      const snap = await getDoc(
        doc(
          uidDb("uid-rebase-snapshot"),
          "users",
          "uid-rebase-snapshot",
          "snapshots",
          "main",
        ),
      );
      const data = snap.data();
      const intact =
        data?.retaFinalSync?.snapshotRevision === 2 &&
        data?.retaFinalSync?.baseSnapshotRevision === 1 &&
        data?.payload?.eventos?.length === 2;
      if (!intact) throw new Error("rebased snapshot readback mismatch");
    }),
  );

  // 5f. A rebase that keeps the plan unchanged must carry the remote wire
  // digest and the exact remote plan map. Projection drift stays client-side;
  // a different digest or a changed plan map is denied by the rules.
  const carriedPlan = plan({ planId: "rfplan_carried", revision: 0, ativo: true });
  const carriedDigest = repeated("c");
  const carriedPayload = {
    config: {},
    planejamento: carriedPlan,
    eventos: [{ id: "ev_carried_seed" }],
    editais: [],
    disciplinas: [],
  };
  await seed(
    "uid-rebase-carried",
    envelope({
      planId: "rfplan_carried",
      revision: 0,
      baseRevision: 0,
      digest: carriedDigest,
      payload: carriedPayload,
      payloadUpdatedAt: "2026-10-27T17:08:44.079Z",
      deviceId: "remote-device",
    }),
  );
  results.push(
    await expectAllowed(
      "rebase carries the remote digest with the unchanged plan",
      () =>
        setDoc(
          doc(
            uidDb("uid-rebase-carried"),
            "users",
            "uid-rebase-carried",
            "snapshots",
            "main",
          ),
          envelope({
            planId: "rfplan_carried",
            revision: 0,
            baseRevision: 0,
            snapshotRevision: 2,
            baseSnapshotRevision: 1,
            digest: carriedDigest,
            payload: {
              ...carriedPayload,
              eventos: [{ id: "ev_carried_seed" }, { id: "ev_carried_new" }],
            },
            payloadUpdatedAt: "2026-10-27T17:20:00.000Z",
            deviceId: "web-rebase",
          }),
        ),
    ),
  );
  results.push(
    await expectDenied("rebase with a different digest is denied", () =>
      setDoc(
        doc(
          uidDb("uid-rebase-carried"),
          "users",
          "uid-rebase-carried",
          "snapshots",
          "main",
        ),
        envelope({
          planId: "rfplan_carried",
          revision: 0,
          baseRevision: 0,
          snapshotRevision: 3,
          baseSnapshotRevision: 2,
          digest: repeated("d"),
          payload: carriedPayload,
          payloadUpdatedAt: "2026-10-27T17:30:00.000Z",
          deviceId: "web-rebase",
        }),
      ),
    ),
  );
  results.push(
    await expectDenied("rebase with a changed plan map is denied", () =>
      setDoc(
        doc(
          uidDb("uid-rebase-carried"),
          "users",
          "uid-rebase-carried",
          "snapshots",
          "main",
        ),
        envelope({
          planId: "rfplan_carried",
          revision: 0,
          baseRevision: 0,
          snapshotRevision: 3,
          baseSnapshotRevision: 2,
          digest: carriedDigest,
          payload: {
            ...carriedPayload,
            planejamento: plan({
              planId: "rfplan_carried",
              revision: 1,
              ativo: true,
            }),
          },
          payloadUpdatedAt: "2026-10-27T17:30:00.000Z",
          deviceId: "web-rebase",
        }),
      ),
    ),
  );

  // 6. Retirement.
  await seed("uid-retire", envelope({ revision: 2, baseRevision: 1 }));
  results.push(
    await expectAllowed("v2 retirement advance", () =>
      setDoc(
        doc(uidDb("uid-retire"), "users", "uid-retire", "snapshots", "main"),
        envelope({ revision: 3, baseRevision: 2, state: "retired" }),
      ),
    ),
  );
  results.push(
    await expectDenied("v2 retired resurrection", () =>
      setDoc(
        doc(uidDb("uid-retire"), "users", "uid-retire", "snapshots", "main"),
        envelope({
          revision: 4,
          baseRevision: 3,
          snapshotRevision: 3,
          state: "active",
        }),
      ),
    ),
  );
  results.push(
    await expectDenied("v2 retired create", () =>
      setDoc(
        doc(
          uidDb("uid-retired-create"),
          "users",
          "uid-retired-create",
          "snapshots",
          "main",
        ),
        envelope({ revision: 1, baseRevision: 0, state: "retired" }),
      ),
    ),
  );
  await seed("uid-retired-active", envelope({ revision: 2, baseRevision: 1 }));
  results.push(
    await expectDenied("retired payload with active plan", () => {
      const value = envelope({
        revision: 3,
        baseRevision: 2,
        state: "retired",
      });
      value.payload.planejamento = plan({ revision: 3, ativo: true });
      return setDoc(
        doc(
          uidDb("uid-retired-active"),
          "users",
          "uid-retired-active",
          "snapshots",
          "main",
        ),
        value,
      );
    }),
  );
  await seed("uid-active-missing", envelope({ revision: 2, baseRevision: 1 }));
  results.push(
    await expectDenied("active descriptor without active plan", () => {
      const value = envelope({ revision: 3, baseRevision: 2 });
      delete value.payload.planejamento;
      return setDoc(
        doc(
          uidDb("uid-active-missing"),
          "users",
          "uid-active-missing",
          "snapshots",
          "main",
        ),
        value,
      );
    }),
  );
  await seed(
    "uid-active-retired-payload",
    envelope({ revision: 2, baseRevision: 1 }),
  );
  results.push(
    await expectDenied("active descriptor with retired payload", () => {
      const value = envelope({ revision: 3, baseRevision: 2 });
      value.payload.planejamento = plan({ revision: 3, ativo: false });
      return setDoc(
        doc(
          uidDb("uid-active-retired-payload"),
          "users",
          "uid-active-retired-payload",
          "snapshots",
          "main",
        ),
        value,
      );
    }),
  );
  await seed("uid-retired-absent", envelope({ revision: 2, baseRevision: 1 }));
  results.push(
    await expectAllowed("retired descriptor with absent plan", () => {
      const value = envelope({
        revision: 3,
        baseRevision: 2,
        state: "retired",
      });
      delete value.payload.planejamento;
      return setDoc(
        doc(
          uidDb("uid-retired-absent"),
          "users",
          "uid-retired-absent",
          "snapshots",
          "main",
        ),
        value,
      );
    }),
  );

  // 7. Guard and owner scope.
  results.push(
    await expectAllowed("guard create by owner", () =>
      setDoc(
        doc(
          uidDb("uid-guard"),
          "users",
          "uid-guard",
          "syncMeta",
          "reta-final-guard",
        ),
        guardDoc(),
      ),
    ),
  );
  results.push(
    await expectDenied("guard denied to another uid", () =>
      setDoc(
        doc(intruderDb, "users", "uid-guard", "syncMeta", "reta-final-guard"),
        guardDoc("other-device"),
      ),
    ),
  );
  results.push(
    await expectDenied("guard delete denied", () =>
      deleteDoc(
        doc(
          uidDb("uid-guard"),
          "users",
          "uid-guard",
          "syncMeta",
          "reta-final-guard",
        ),
      ),
    ),
  );
  results.push(
    await expectDenied("intruder cannot overwrite snapshot", () =>
      setDoc(
        doc(intruderDb, "users", "uid-advance", "snapshots", "main"),
        envelope({ revision: 4, baseRevision: 3 }),
      ),
    ),
  );

  report(results, { newRules, host: args.host, port: args.port });
  await environment.clearFirestore();
  await environment.cleanup();
}

function report(results, { newRules, host, port }) {
  const failures = results.filter((result) => !result.ok);
  for (const result of results) {
    console.log(
      `${result.ok ? "PASS" : "FAIL"} ${result.label}: ${result.detail}`,
    );
  }
  console.log(
    `\nRULES_MODE=${newRules ? "new" : "legacy"} TARGET=${host}:${port}`,
  );
  console.log(
    `RESULT ${failures.length === 0 ? "PASS" : "FAIL"} (${results.length - failures.length}/${results.length})`,
  );
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
