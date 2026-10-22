import { afterEach, describe, expect, it } from "vitest";
import {
  closeRetaFinalBlockDetail,
  openRetaFinalBlockDetail,
  renderRetaFinalBlockDetail,
} from "../../src/js/views/reta-final-detail.js";
import { renderRetaFinalBlocoCard } from "../../src/js/views/reta-final-view.js";

const HOJE = "2026-10-22";

function block(overrides = {}) {
  return {
    id: "rf-1",
    discId: "disc-1",
    topicos: [{ assId: "ass-1", aulaId: "aula-1" }],
    minutos: 90,
    status: "pendente",
    ordem: 0,
    dataOriginal: "2026-10-20",
    dataPlanejada: "2026-10-21",
    data: HOJE,
    rolagens: 1,
    prioridade: 4,
    observacao: "Revisar antes da prova.",
    ...overrides,
  };
}

function disciplina(nomeAssunto = "Atos administrativos") {
  return {
    id: "disc-1",
    nome: "Direito Administrativo",
    icone: "⚖️",
    cor: "#123456",
    assuntos: [{ id: "ass-1", nome: nomeAssunto }],
    aulas: [{ id: "aula-1", nome: "Aula 07 — Licitações" }],
  };
}

function evento(overrides = {}) {
  return {
    id: "ev-1",
    rfBlocoId: "rf-1",
    titulo: "Direito Administrativo — Atos administrativos",
    status: "estudei",
    dataEstudo: "2026-10-21",
    tempoAcumulado: 45 * 60,
    ...overrides,
  };
}

afterEach(() => {
  closeRetaFinalBlockDetail(document);
  document.body.className = "";
  document.body.innerHTML = "";
});

describe("renderRetaFinalBlockDetail", () => {
  it("renders the complete subject text without truncation", () => {
    const longo = "A".repeat(320) + " " + "B".repeat(320);
    const html = renderRetaFinalBlockDetail(block(), {
      disciplina: disciplina(longo),
      events: [evento()],
    });
    expect(html).toContain(longo);
    expect(html.length).toBeGreaterThan(longo.length);
    expect(html).not.toMatch(/…|\.\.\.\s*<\/p>/);
  });

  it("escapes markup from catalog content and never emits a script tag", () => {
    const html = renderRetaFinalBlockDetail(block(), {
      disciplina: disciplina('<script>alert(1)</script>'),
      events: [],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("alert(1)");
  });

  it("shows dates, duration, priority, status and study associations", () => {
    const html = renderRetaFinalBlockDetail(block(), {
      disciplina: disciplina(),
      events: [evento(), evento({ id: "ev-2", status: "pendente", dataEstudo: null, tempoAcumulado: 0 })],
    });
    expect(html).toContain("20/10/2026");
    expect(html).toContain("21/10/2026");
    expect(html).toContain("22/10/2026");
    expect(html).toContain("1h 30min");
    expect(html).toContain("Prioridade");
    expect(html).toContain("4");
    expect(html).toContain("Pendente");
    expect(html).toContain("45min");
    expect(html).toContain("Revisar antes da prova.");
    expect(html).toContain('data-field="topicos"');
    expect(html).toContain("Aula 07 — Licitações");
  });

  it("renders completed blocks with a dialog-friendly edit action", () => {
    const html = renderRetaFinalBlockDetail(block({ status: "concluido" }), {
      disciplina: disciplina(),
      events: [evento()],
    });
    expect(html).toContain("Concluído");
    expect(html).toContain('data-action="rf-open-editor"');
    expect(html).toContain('data-action="rf-close-detail"');
  });

  it("reports unresolved catalog references instead of hiding them", () => {
    const html = renderRetaFinalBlockDetail(block(), {
      disciplina: { id: "disc-1", nome: "Disciplina", assuntos: [], aulas: [] },
      events: [],
    });
    expect(html).toContain("Tópico sem referência no catálogo (ass-1)");
    expect(html).toContain("Aula sem referência no catálogo (aula-1)");
  });
});

describe("openRetaFinalBlockDetail", () => {
  function plan() {
    return {
      ativo: true,
      tipo: "reta_final",
      planId: "plan-1",
      schemaVersionRetaFinal: 2,
      revision: 2,
      retaFinal: {
        dataFinal: "2026-12-31",
        minutosPadrao: 60,
        blocos: [block()],
      },
    };
  }

  it("opens a modal dialog and focuses the close button", () => {
    const panel = openRetaFinalBlockDetail("rf-1", {
      plan: plan(),
      editais: [{ id: "ed-1", disciplinas: [disciplina()] }],
      eventos: [evento()],
      today: HOJE,
    });
    expect(panel).toBeTruthy();
    expect(panel.getAttribute("role")).toBe("dialog");
    expect(panel.getAttribute("aria-modal")).toBe("true");
    expect(panel.textContent).toContain("Atos administrativos");
    expect(document.activeElement?.dataset.action).toBe("rf-close-detail");
    expect(panel.querySelector('[data-action="rf-close-detail"]')).toBeTruthy();
  });

  it("returns null for unknown blocks and does not mutate the plan", () => {
    const base = plan();
    const snapshot = JSON.stringify(base);
    expect(openRetaFinalBlockDetail("missing", { plan: base, editais: [] })).toBeNull();
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it("closes and restores focus to the invoking element", () => {
    const trigger = document.createElement("button");
    trigger.dataset.action = "rf-open-detail";
    document.body.append(trigger);
    trigger.focus();
    openRetaFinalBlockDetail("rf-1", {
      plan: plan(),
      editais: [{ id: "ed-1", disciplinas: [disciplina()] }],
      eventos: [],
      today: HOJE,
    });
    closeRetaFinalBlockDetail(document);
    expect(document.querySelector("[data-rf-detail-panel]")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("renderRetaFinalBlocoCard", () => {
  const discEntry = { disc: disciplina(), edital: { id: "ed-1", cor: "#111" } };

  it("exposes the full detail through a native button on pending blocks", () => {
    const html = renderRetaFinalBlocoCard(block(), HOJE, { discEntry });
    document.body.innerHTML = '<div id="host">' + html + '</div>';
    const trigger = document.querySelector('[data-action="rf-open-detail"]');
    expect(trigger).toBeTruthy();
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("type")).toBe("button");
    expect(trigger.textContent).toContain("Atos administrativos");
  });

  it("keeps quick-mark and timer outside the detail trigger", () => {
    const html = renderRetaFinalBlocoCard(block(), HOJE, { discEntry });
    document.body.innerHTML = '<div id="host">' + html + '</div>';
    const quick = document.querySelector('[data-action="rf-quick-mark"]');
    const timer = document.querySelector('[data-action="rf-start-timer"]');
    const detail = document.querySelector('[data-action="rf-open-detail"]');
    expect(quick).toBeTruthy();
    expect(timer).toBeTruthy();
    expect(detail.contains(quick)).toBe(false);
    expect(detail.contains(timer)).toBe(false);
  });

  it("also exposes the detail trigger on completed blocks", () => {
    const html = renderRetaFinalBlocoCard(
      block({ status: "concluido" }),
      HOJE,
      { discEntry }
    );
    expect(html).toContain('data-action="rf-open-detail"');
    expect(html).toContain("rf-bloco-card--concluido");
  });

  it("escapes catalog text inside the card", () => {
    const html = renderRetaFinalBlocoCard(block(), HOJE, {
      discEntry: { disc: disciplina("<script>alert(7)</script>"), edital: { id: "ed-1" } },
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(7)&lt;/script&gt;");
  });
});
