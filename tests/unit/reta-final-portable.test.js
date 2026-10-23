import { describe, expect, it } from "vitest";
import {
  exportRetaFinalPortable,
  validateRetaFinalPortable,
} from "../../src/js/logic/reta-final-portable.js";
import { compareRetaFinalImport } from "../../src/js/logic/reta-final-import-compare.js";

function plan(overrides = {}) {
  return {
    ativo: true,
    tipo: "reta_final",
    schemaVersionRetaFinal: 2,
    planId: "plan-1",
    revision: 8,
    sourceRevision: 3,
    provenance: { source: "manual" },
    config: { dataProva: "2026-12-01" },
    eventos: [{ id: "event-1", status: "estudei", tempoAcumulado: 900 }],
    credential: "must-not-export",
    retaFinal: {
      nome: "Reta Final",
      dataFinal: "2026-11-30",
      minutosPadrao: 60,
      capacidade: { maximoDiario: 180 },
      blocos: [
        {
          id: "rf-1",
          discId: "disc-1",
          topicos: [{ assId: "ass-1", aulaId: null }],
          minutos: 60,
          ordem: 0,
          dataPlanejada: "2026-10-21",
          dataOriginal: "2026-10-20",
          prioridade: 2,
          observacao: "Revisar",
          fixado: true,
          arquivado: false,
          provenance: { source: "manual" },
          status: "concluido",
          tempoAcumulado: 900,
          historico: [{ id: "history-1" }],
        },
      ],
      ...overrides.retaFinal,
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

describe("validateRetaFinalPortable", () => {
  it("recognizes a valid legacy v1 schedule", () => {
    const result = validateRetaFinalPortable({
      versao: 1,
      nome: "Reta Final",
      dataFinal: "2026-11-30",
      minutosPadrao: 60,
      dias: [
        {
          data: "2026-10-21",
          blocos: [{ disciplina: "Direito Penal", topicos: ["Crimes"] }],
        },
      ],
    });

    expect(result).toEqual({ valid: true, version: 1, errors: [] });
  });

  it("rejects duplicate block ids and malformed catalog references in v2", () => {
    const payload = exportRetaFinalPortable(plan());
    payload.blocos.push({ ...payload.blocos[0] });
    expect(validateRetaFinalPortable(payload).valid).toBe(false);

    const broken = exportRetaFinalPortable(plan());
    broken.blocos[0].topicos = [{ assId: null, aulaId: null }];
    expect(validateRetaFinalPortable(broken).valid).toBe(false);

    const repeated = exportRetaFinalPortable(plan());
    repeated.blocos[0].topicos = [
      { assId: "ass-1", aulaId: null },
      { assId: "ass-1", aulaId: null },
    ];
    expect(validateRetaFinalPortable(repeated).valid).toBe(false);

    const repeatedAula = exportRetaFinalPortable(plan());
    repeatedAula.blocos[0].topicos = [
      { assId: null, aulaId: "aula-1" },
      { assId: null, aulaId: "aula-1" },
    ];
    expect(validateRetaFinalPortable(repeatedAula).valid).toBe(false);
  });

  it("rejects non-portable fields nested in capacity and topic references", () => {
    const withPrivateCapacity = exportRetaFinalPortable(plan());
    withPrivateCapacity.capacidade.events = [{ id: "event-1" }];
    expect(validateRetaFinalPortable(withPrivateCapacity).valid).toBe(false);

    const withTopicState = exportRetaFinalPortable(plan());
    withTopicState.blocos[0].topicos[0].status = "concluido";
    expect(validateRetaFinalPortable(withTopicState).valid).toBe(false);
  });

  it("strips and rejects session, credential, history, and academic provenance keys", () => {
    const source = plan();
    source.provenance = {
      source: "manual",
      status: "estudei",
      tempoAcumulado: 900,
      snapshot: { id: "event-1" },
      sessão: "private-session-value",
      credencial: "private-credential-value",
      histórico: ["private-history-value"],
    };
    source.retaFinal.blocos[0].provenance = {
      source: "manual",
      status: "concluido",
      tempoAcumulado: 900,
      sessão: "private-block-session-value",
    };

    const portable = exportRetaFinalPortable(source);
    const serialized = JSON.stringify(portable);
    expect(serialized).not.toContain("private-session-value");
    expect(serialized).not.toContain("private-credential-value");
    expect(serialized).not.toContain("private-history-value");
    expect(serialized).not.toContain("private-block-session-value");
    expect(serialized).not.toContain("estudei");
    expect(serialized).not.toContain("tempoAcumulado");
    expect(serialized).not.toContain("event-1");

    portable.provenance.sessão = "reintroduced-private-session";
    expect(validateRetaFinalPortable(portable).valid).toBe(false);
    portable.provenance = { source: "manual", status: "estudei" };
    expect(validateRetaFinalPortable(portable).valid).toBe(false);
  });
});

describe("exportRetaFinalPortable", () => {
  it("rejects a duplicated aulaId reference inside one block", () => {
    const portable = exportRetaFinalPortable(plan());
    portable.blocos[0].topicos = [
      { assId: null, aulaId: "aula-1" },
      { assId: "ass-1", aulaId: "aula-1" },
    ];
    const result = validateRetaFinalPortable(portable);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/referência de aula repetida/i);
  });

  it("transports notas in v2 exports and reimports without losing them", () => {
    const source = plan();
    source.retaFinal.blocos[0].notas = "Roteiro importado\n• Habeas corpus";
    const portable = exportRetaFinalPortable(source);
    expect(portable.blocos[0].notas).toBe("Roteiro importado\n• Habeas corpus");
    expect(validateRetaFinalPortable(portable).valid).toBe(true);

    const current = plan();
    delete current.retaFinal.blocos[0].notas;
    const comparison = compareRetaFinalImport(current, portable, {
      catalog,
    });
    const update = comparison.entries.find(
      (entry) => entry.blockId === "rf-1" && entry.kind === "UPDATE",
    );
    expect(update.command.patch.notas).toBe("Roteiro importado\n• Habeas corpus");
  });

  it("rejects invalid v2 notas types and excessive length", () => {
    const portable = exportRetaFinalPortable(plan());
    portable.blocos[0].notas = 42;
    expect(validateRetaFinalPortable(portable).valid).toBe(false);
    portable.blocos[0].notas = "x".repeat(10_001);
    expect(validateRetaFinalPortable(portable).valid).toBe(false);
  });

  it("treats divergent v2 notes as a human conflict", () => {
    const current = plan();
    current.retaFinal.blocos[0].notas = "Nota pessoal";
    const portable = exportRetaFinalPortable(plan());
    portable.blocos[0].notas = "Nota do arquivo";
    const comparison = compareRetaFinalImport(current, portable, {
      catalog,
    });
    expect(comparison.entries.some((entry) => entry.kind === "CONFLICT")).toBe(
      true,
    );
  });

  it("preserves plan and block identity, revision, provenance, and intent", () => {
    const source = plan();
    const portable = exportRetaFinalPortable(source);

    expect(portable).toMatchObject({
      versao: 2,
      tipo: "reta_final",
      nome: "Reta Final",
      planId: "plan-1",
      exportRevision: 8,
      sourceRevision: 3,
      provenance: { source: "manual" },
      dataFinal: "2026-11-30",
      minutosPadrao: 60,
      capacidade: { maximoDiario: 180 },
      blocos: [
        {
          id: "rf-1",
          discId: "disc-1",
          topicos: [{ assId: "ass-1", aulaId: null }],
          minutos: 60,
          dataPlanejada: "2026-10-21",
          dataOriginal: "2026-10-20",
          prioridade: 2,
          observacao: "Revisar",
          fixado: true,
          arquivado: false,
          provenance: { source: "manual" },
        },
      ],
    });
    expect(source.retaFinal.blocos[0].dataPlanejada).toBe("2026-10-21");
  });

  it("exports only portable schedule intent, without events or sessions", () => {
    const portable = exportRetaFinalPortable(plan());
    const serialized = JSON.stringify(portable);

    expect(serialized).not.toContain("event-1");
    expect(serialized).not.toContain("history-1");
    expect(serialized).not.toContain("tempoAcumulado");
    expect(serialized).not.toContain("status");
    expect(serialized).not.toContain("credential");
    expect(serialized).not.toContain("must-not-export");
    expect(portable).not.toHaveProperty("eventos");
    expect(portable).not.toHaveProperty("config");
  });

  it("reimports the same v2 ids and content as unchanged without duplicate commands", () => {
    const current = plan();
    const portable = exportRetaFinalPortable(current);
    const result = compareRetaFinalImport(current, portable, { catalog });

    expect(result.entries.map((entry) => entry.kind)).toEqual(["UNCHANGED"]);
    expect(result.entries[0].blockId).toBe("rf-1");
    expect(result.commands).toEqual([]);
    expect(new Set(portable.blocos.map((block) => block.id)).size).toBe(1);
  });
});
