import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createE2EState } from "../helpers/e2e-state.js";

const THEMES = [
  "grafite",
  "ardosia",
  "platina",
  "terminal",
  "neon",
  "arrakis",
  "codex",
  "plasma",
];

const VIEWPORTS = [
  { name: "desktop", width: 1366, height: 900 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
  { name: "small", width: 320, height: 720 },
];

function localDateStr(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function visualState(theme) {
  const state = createE2EState();
  state.config.tema = theme;
  state.config.globalSyncPaused = true;
  state.planejamento = {
    ativo: true,
    tipo: "reta_final",
    planId: "plan-visual",
    schemaVersionRetaFinal: 2,
    revision: 2,
    updatedAt: "2026-10-20T10:00:00.000Z",
    disciplinas: ["disc_1"],
    relevancia: {},
    horarios: { dataFinal: localDateStr(30) },
    materiasPorDia: 3,
    sequencia: [],
    slotOverrides: [],
    ciclosCompletos: 0,
    dataInicioCicloAtual: "2026-01-01T00:00:00.000Z",
    retaFinal: {
      nome: "Reta Final Visual",
      dataFinal: localDateStr(30),
      minutosPadrao: 60,
      capacidade: {
        minutosPorDiaSemana: {
          0: 0,
          1: 120,
          2: 120,
          3: 90,
          4: 120,
          5: 60,
          6: 0,
        },
        folgas: [0, 6],
        excecoesPorData: { [localDateStr(2)]: 30 },
        maximoDiario: 180,
      },
      blocos: [
        {
          id: "rf-visual-1",
          discId: "disc_1",
          topicos: [{ assId: "ass_1", aulaId: null }],
          minutos: 90,
          status: "pendente",
          ordem: 0,
          dataOriginal: localDateStr(0),
          dataPlanejada: localDateStr(0),
          data: localDateStr(0),
          rolagens: 0,
        },
        {
          id: "rf-visual-2",
          discId: "disc_1",
          topicos: [{ assId: "ass_1", aulaId: null }],
          minutos: 45,
          status: "pendente",
          ordem: 1,
          dataOriginal: localDateStr(1),
          dataPlanejada: localDateStr(1),
          data: localDateStr(1),
          rolagens: 0,
        },
        {
          id: "rf-visual-3",
          discId: "disc_1",
          topicos: [{ assId: "ass_1", aulaId: null }],
          minutos: 60,
          status: "pendente",
          ordem: 2,
          dataOriginal: localDateStr(3),
          dataPlanejada: localDateStr(3),
          data: localDateStr(3),
          rolagens: 0,
        },
      ],
    },
  };
  return state;
}

for (const theme of THEMES) {
  test("visual " + theme, async ({ browser }) => {
    const state = visualState(theme);
    const output = path.resolve("test-results", "rf-visual");
    fs.mkdirSync(output, { recursive: true });

    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        hasTouch: viewport.name !== "desktop",
      });
      await page.addInitScript((serialized) => {
        window.Chart = class {
          destroy() {}
        };
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem("estudo_state", serialized);
      }, JSON.stringify(state));
      await page.goto("/");
      await page.waitForFunction(
        () => window.EstudoApp?.state?.planejamento?.tipo === "reta_final",
      );
      await page.evaluate(() => window.EstudoApp.navigate("ciclo"));
      await expect(
        page.locator('[data-action="rf-open-planner"]'),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.waitForTimeout(150);
      await page.screenshot({
        path: path.join(output, theme + "-" + viewport.name + "-view.png"),
        fullPage: true,
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);

      await page
        .locator('[data-action="rf-open-planner"]')
        .dispatchEvent("click");
      await expect(page.locator("[data-rf-planner]")).toBeVisible();
      await page.waitForTimeout(350);
      await page.screenshot({
        path: path.join(output, theme + "-" + viewport.name + "-planner.png"),
      });
      await page
        .locator('[data-action="rf-plan-capacity"]')
        .dispatchEvent("click");
      await expect(page.locator("[data-rf-capacity-form]")).toBeVisible();
      const panelOverflow = await page.evaluate(() => {
        const panel = document.querySelector("[data-rf-detail-panel]");
        return panel ? panel.scrollWidth - panel.clientWidth : 999;
      });
      expect(panelOverflow).toBeLessThanOrEqual(1);
      const targets = await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            ".rf-capacity-exceptions .btn, .rf-capacity-exception .btn, .rf-detail-actions .btn",
          ),
        ].map((element) => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }),
      );
      for (const target of targets) {
        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.height).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({
        path: path.join(output, theme + "-" + viewport.name + "-capacity.png"),
      });
      await page.keyboard.press("Escape");
      await page.close();
    }
  });
}

test("os oito temas têm paletas computadas distintas", async ({ page }) => {
  await page.addInitScript(
    (serialized) => {
      window.Chart = class {
        destroy() {}
      };
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("estudo_state", serialized);
    },
    JSON.stringify(visualState("grafite")),
  );
  await page.goto("/");
  const values = await page.evaluate(
    (themes) =>
      themes.map((theme) => {
        document.documentElement.setAttribute("data-theme", theme);
        const style = getComputedStyle(document.documentElement);
        return (
          style.getPropertyValue("--card").trim() +
          "|" +
          style.getPropertyValue("--app-bg").trim()
        );
      }),
    THEMES,
  );
  expect(new Set(values).size).toBe(THEMES.length);
  expect(values.every((value) => value.startsWith("|") === false)).toBe(true);
});
