import { describe, expect, it } from "vitest";
import { compareRetaFinalImport } from "../../src/js/logic/reta-final-import-compare.js";
import { exportRetaFinalPortable } from "../../src/js/logic/reta-final-portable.js";

function block(id, overrides = {}) {
  return {
    id,
    discId: "disc-1",
    topicos: [{ assId: "ass-1", aulaId: null }],
    minutos: 60,
    ordem: 0,
    dataPlanejada: "2026-10-21",
    dataOriginal: "2026-10-21",
    status: "pendente",
    rolagens: 0,
    ...overrides,
  };
}

function plan(blocks = [block("rf-keep")], overrides = {}) {
  return {
    ativo: true,
    tipo: "reta_final",
    schemaVersionRetaFinal: 2,
    planId: "plan-1",
    revision: 8,
    retaFinal: {
      nome: "Reta Final",
      dataFinal: "2026-11-30",
      minutosPadrao: 60,
      blocos: blocks,
    },
    ...overrides,
  };
}

const catalog = [
  {
    id: "ed-1",
    disciplinas: [
      {
        id: "disc-1",
        nome: "Direito Penal",
        assuntos: [{ id: "ass-1", nome: "Crimes" }],
        aulas: [{ id: "aula-1", nome: "Aula 01" }],
      },
    ],
  },
];

describe("compareRetaFinalImport", () => {
  it("classifies create, unchanged, update, move, and missing content explicitly", () => {
    const current = plan([
      block("rf-keep", { ordem: 0 }),
      block("rf-update", { ordem: 1 }),
      block("rf-move", { ordem: 2 }),
      block("rf-absent", { ordem: 3 }),
    ]);
    const payload = exportRetaFinalPortable(current);
    payload.blocos = payload.blocos.filter((item) => item.id !== "rf-absent");
    payload.blocos.find((item) => item.id === "rf-update").minutos = 90;
    payload.blocos.find((item) => item.id === "rf-move").dataPlanejada =
      "2026-10-25";
    payload.blocos.push({
      ...payload.blocos[0],
      id: "rf-new",
      dataPlanejada: "2026-10-26",
      dataOriginal: "2026-10-26",
    });

    const result = compareRetaFinalImport(current, payload, { catalog });

    expect(result.entries.map((entry) => entry.kind)).toEqual([
      "UNCHANGED",
      "UPDATE",
      "MOVE",
      "CREATE",
      "ARCHIVE_CANDIDATE",
    ]);
    expect(
      result.entries.find((entry) => entry.kind === "ARCHIVE_CANDIDATE"),
    ).toMatchObject({ blockId: "rf-absent", command: { type: "ARCHIVE" } });
    expect(result.summary).toMatchObject({
      unchanged: 1,
      updates: 1,
      moves: 1,
      creates: 1,
      archiveCandidates: 1,
      conflicts: 0,
    });
  });

  it("rejects a different plan identity as a blocking conflict", () => {
    const current = plan();
    const payload = exportRetaFinalPortable(current);
    payload.planId = "another-plan";

    const result = compareRetaFinalImport(current, payload, { catalog });

    expect(result.conflicts).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ kind: "CONFLICT" });
    expect(result.commands).toEqual([]);
  });

  it("turns repeated v1 aula titles into a conflict instead of first-match selection", () => {
    const current = plan();
    const legacy = {
      versao: 1,
      nome: "Reta Final",
      dataFinal: "2026-11-30",
      minutosPadrao: 60,
      dias: [
        {
          data: "2026-10-21",
          blocos: [
            { disciplina: "Direito Penal", aula: "Aula 01", topicos: [] },
          ],
        },
      ],
    };
    const ambiguousCatalog = [
      {
        ...catalog[0],
        disciplinas: [
          {
            ...catalog[0].disciplinas[0],
            aulas: [
              { id: "aula-1", nome: "Aula 01" },
              { id: "aula-2", nome: "Aula 01" },
            ],
          },
        ],
      },
    ];

    const result = compareRetaFinalImport(current, legacy, {
      catalog: ambiguousCatalog,
    });

    expect(
      result.entries.some(
        (entry) => entry.kind === "CONFLICT" && /amb.g/i.test(entry.reason),
      ),
    ).toBe(true);
    expect(result.commands).toEqual([]);
  });

  it("does not remove absent blocks and supplies only a draft archive command for review", () => {
    const current = plan([block("rf-keep"), block("rf-absent", { ordem: 1 })]);
    const payload = exportRetaFinalPortable(current);
    payload.blocos = payload.blocos.filter((item) => item.id === "rf-keep");
    const before = JSON.parse(JSON.stringify(current));

    const result = compareRetaFinalImport(current, payload, { catalog });

    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ARCHIVE_CANDIDATE",
          blockId: "rf-absent",
          command: expect.objectContaining({
            type: "ARCHIVE",
            blockIds: ["rf-absent"],
          }),
        }),
      ]),
    );
    expect(current).toEqual(before);
    expect(current.retaFinal.blocos.map((item) => item.id)).toEqual([
      "rf-keep",
      "rf-absent",
    ]);
  });

  it("generates Task 3 draft commands without applying them to the official plan", () => {
    const current = plan([
      block("rf-update"),
      block("rf-move", { ordem: 1 }),
      block("rf-archive", { ordem: 2 }),
    ]);
    const payload = exportRetaFinalPortable(current);
    payload.blocos[0].minutos = 90;
    payload.blocos[1].dataPlanejada = "2026-10-25";
    payload.blocos = payload.blocos.filter((item) => item.id !== "rf-archive");
    payload.blocos.push({ ...payload.blocos[0], id: "rf-create" });
    const before = JSON.parse(JSON.stringify(current));

    const result = compareRetaFinalImport(current, payload, { catalog });

    expect(result.commands.map((command) => command.type)).toEqual(
      expect.arrayContaining(["PATCH", "MOVE", "CREATE", "ARCHIVE"]),
    );
    expect(
      result.entries.find((entry) => entry.kind === "CREATE"),
    ).toMatchObject({
      blockId: "rf-create",
      command: { type: "CREATE" },
    });
    expect(current).toEqual(before);
  });

  it("reports catalog reference mismatches as conflicts", () => {
    const current = plan();
    const payload = exportRetaFinalPortable(current);
    payload.blocos[0].discId = "missing-discipline";

    const result = compareRetaFinalImport(current, payload, { catalog });

    expect(result.conflicts).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ kind: "CONFLICT" });
    expect(result.commands).toEqual([]);
  });

  it("blocks provenance and original-date changes that have no Task 3 command", () => {
    const current = plan([
      block("rf-1", {
        dataOriginal: "2026-10-20",
        provenance: { source: "manual" },
      }),
    ]);
    const provenanceChange = exportRetaFinalPortable(current);
    provenanceChange.blocos[0].provenance = { source: "imported" };
    const provenanceResult = compareRetaFinalImport(current, provenanceChange, {
      catalog,
    });
    expect(provenanceResult.entries.map((entry) => entry.kind)).toEqual([
      "CONFLICT",
    ]);

    const dateChange = exportRetaFinalPortable(current);
    dateChange.blocos[0].dataOriginal = "2026-10-19";
    const dateResult = compareRetaFinalImport(current, dateChange, { catalog });
    expect(dateResult.entries.map((entry) => entry.kind)).toEqual(["CONFLICT"]);

    const planProvenanceChange = exportRetaFinalPortable(current);
    planProvenanceChange.provenance = { source: "imported" };
    const planProvenanceResult = compareRetaFinalImport(
      current,
      planProvenanceChange,
      { catalog },
    );
    expect(planProvenanceResult.entries.map((entry) => entry.kind)).toEqual([
      "CONFLICT",
    ]);
  });

  it("preserves omitted provenance and blocks creates whose original date cannot be represented", () => {
    const current = plan(
      [block("rf-1", { provenance: { source: "manual" } })],
      {
        provenance: { source: "manual-plan" },
      },
    );
    const omitted = exportRetaFinalPortable(current);
    delete omitted.provenance;
    delete omitted.blocos[0].provenance;
    expect(
      compareRetaFinalImport(current, omitted, { catalog }).entries.map(
        (entry) => entry.kind,
      ),
    ).toEqual(["UNCHANGED"]);

    const empty = plan([]);
    const notRepresentable = exportRetaFinalPortable(empty);
    notRepresentable.blocos.push({
      id: "rf-new",
      discId: "disc-1",
      topicos: [{ assId: "ass-1", aulaId: null }],
      minutos: 60,
      dataPlanejada: "2026-10-21",
      dataOriginal: "2026-10-20",
      provenance: { source: "portable-file" },
    });
    expect(
      compareRetaFinalImport(empty, notRepresentable, { catalog }).entries.map(
        (entry) => entry.kind,
      ),
    ).toEqual(["CONFLICT"]);

    notRepresentable.blocos[0].dataOriginal = "2026-10-21";
    const createResult = compareRetaFinalImport(empty, notRepresentable, {
      catalog,
    });
    expect(createResult.entries[0].command).toMatchObject({
      type: "CREATE",
      sourceProvenance: { source: "portable-file" },
    });
  });

  it("blocks archive toggles combined with edits that need a second command", () => {
    const archivedCurrent = plan([block("rf-1", { arquivado: true })]);
    const unarchiveAndEdit = exportRetaFinalPortable(archivedCurrent);
    unarchiveAndEdit.blocos[0].arquivado = false;
    unarchiveAndEdit.blocos[0].minutos = 90;
    expect(
      compareRetaFinalImport(archivedCurrent, unarchiveAndEdit, { catalog })
        .entries[0].kind,
    ).toBe("CONFLICT");

    const activeCurrent = plan();
    const archiveAndEdit = exportRetaFinalPortable(activeCurrent);
    archiveAndEdit.blocos[0].arquivado = true;
    archiveAndEdit.blocos[0].minutos = 90;
    expect(
      compareRetaFinalImport(activeCurrent, archiveAndEdit, { catalog })
        .entries[0].kind,
    ).toBe("CONFLICT");
  });

  it("keeps an identical archived block unchanged on repeated portable imports", () => {
    const current = plan([block("rf-archived", { arquivado: true })]);
    const payload = exportRetaFinalPortable(current);

    const result = compareRetaFinalImport(current, payload, { catalog });

    expect(result.entries.map((entry) => entry.kind)).toEqual(["UNCHANGED"]);
    expect(result.commands).toEqual([]);
  });
});
