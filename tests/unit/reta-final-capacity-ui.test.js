import { afterEach, describe, expect, it } from "vitest";
import { renderCapacityExceptionRow } from "../../src/js/views/reta-final-planner.js";
import { registerRetaFinalEditorActions } from "../../src/js/ui/actions/reta-final-editor.js";
import { actions } from "../../src/js/ui/actions/dispatcher.js";

registerRetaFinalEditorActions();

afterEach(() => {
  document.body.innerHTML = "";
});

function panelWithRows() {
  document.body.innerHTML =
    "<div data-rf-detail-panel>" +
    "<div data-exception-list>" +
    renderCapacityExceptionRow("2026-10-30", "30") +
    renderCapacityExceptionRow("2026-10-31", "45") +
    "</div>" +
    '<button type="button" data-action="rf-plan-capacity-add-exception">Adicionar</button>' +
    "</div>";
}

describe("capacidade — exceções", () => {
  it("identifica a data no nome acessível do botão remover", () => {
    const html = renderCapacityExceptionRow("2026-10-30", "30");
    expect(html).toContain('aria-label="Remover exceção 2026-10-30"');
  });

  it("move o foco para a próxima exceção ao remover", () => {
    panelWithRows();
    const buttons = [
      ...document.querySelectorAll(
        '[data-action="rf-plan-capacity-remove-exception"]',
      ),
    ];
    actions["rf-plan-capacity-remove-exception"](buttons[0]);
    expect(document.querySelectorAll("[data-exception-row]")).toHaveLength(1);
    expect(document.activeElement).toBe(buttons[1]);
  });

  it("devolve o foco para Adicionar quando a última exceção sai", () => {
    panelWithRows();
    const buttons = [
      ...document.querySelectorAll(
        '[data-action="rf-plan-capacity-remove-exception"]',
      ),
    ];
    actions["rf-plan-capacity-remove-exception"](buttons[0]);
    actions["rf-plan-capacity-remove-exception"](buttons[1]);
    expect(document.querySelectorAll("[data-exception-row]")).toHaveLength(0);
    expect(document.activeElement?.dataset.action).toBe(
      "rf-plan-capacity-add-exception",
    );
  });
});
