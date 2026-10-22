/**
 * Prévia unificada de impacto e aplicação do rascunho.
 *
 * KPIs oficiais vêm do plano aplicado; KPIs simulados vêm apenas do snapshot
 * do rascunho. A aplicação é local e atômica (Task 7); a confirmação remota
 * depende de ACK e nunca é presumida aqui.
 */

import { esc } from "../utils.js?v=8.37";
import { validateRetaFinalDraft } from "../logic/reta-final-drafts.js";
import {
  computeRetaFinalHeaderMetrics,
  computeRetaFinalSummary,
} from "../logic/reta-final-core.js";
import { projectRetaFinalSchedule } from "../logic/reta-final-schedule.js";

function formatHours(minutes) {
  const total = Math.max(0, Number(minutes) || 0);
  const horas = total / 60;
  return Number.isInteger(horas)
    ? horas + "h"
    : horas.toFixed(1).replace(".", ",") + "h";
}

function formatBrDate(value) {
  const [year, month, day] = String(value || "").split("-");
  if (!year || !month || !day) return value || "";
  return day + "/" + month + "/" + year;
}

function metricsFor(plan, today, dataProva) {
  const retaFinal = plan?.retaFinal || { blocos: [] };
  return {
    header: computeRetaFinalHeaderMetrics(retaFinal, {
      hoje: today,
      dataProva,
    }),
    summary: computeRetaFinalSummary(retaFinal),
  };
}

function projectPlan(plan, events, today) {
  const occupied = new Set(
    (events || [])
      .filter(
        (event) =>
          event?.rfBlocoId &&
          (event.status === "estudei" || Number(event.tempoAcumulado) > 0),
      )
      .map((event) => event.rfBlocoId),
  );
  const completed = new Set(
    (events || [])
      .filter((event) => event?.rfBlocoId && event.status === "estudei")
      .map((event) => event.rfBlocoId),
  );
  return projectRetaFinalSchedule(plan, {
    today,
    occupiedBlocoIds: occupied,
    completedBlocoIds: completed,
  });
}

function dayLoad(projection) {
  const map = new Map();
  for (const block of projection.blocos || []) {
    if (!block?.dataEfetiva) continue;
    const entry = map.get(block.dataEfetiva) || {
      date: block.dataEfetiva,
      blocos: 0,
      minutos: 0,
    };
    entry.blocos += 1;
    entry.minutos += Number(block.minutos) || 0;
    map.set(block.dataEfetiva, entry);
  }
  return [...map.values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

/**
 * @param {{basePlan:Object, draft:Object, events?:Array, catalog?:Array, today?:string, dataProva?:string}} input
 */
export function buildRetaFinalImpactPreview({
  basePlan,
  draft,
  events = [],
  catalog = [],
  today,
  dataProva = null,
} = {}) {
  if (!basePlan || !draft) {
    return {
      status: "blocked",
      blocked: true,
      diff: [],
      diagnostics: [
        { code: "PREVIEW_MISSING", message: "Plano ou rascunho ausente." },
      ],
      unallocated: [],
      officialMetrics: null,
      simulatedMetrics: null,
    };
  }
  const validation = validateRetaFinalDraft(draft, basePlan, {
    events,
    catalog,
    today,
    catalogIntents: draft.catalogIntents || [],
  });
  const officialMetrics = metricsFor(basePlan, today, dataProva);
  const simulatedMetrics = metricsFor(draft.snapshot, today, dataProva);
  const officialProjection = projectPlan(basePlan, events, today);
  const simulatedProjection = projectPlan(draft.snapshot, events, today);
  const unallocated = simulatedProjection.blocos
    .filter(
      (block) =>
        block?.categoriaTemporal === "nao_alocado" ||
        block?.categoriaTemporal === "nao_coberto",
    )
    .map((block) => ({
      id: block.id,
      motivo:
        block.categoriaTemporal === "nao_alocado"
          ? "não alocado"
          : "não coberto",
    }));
  const diagnostics = [...(validation.errors || [])];
  const diff = validation.diff || [];
  const pastDateChanges = diff.filter(
    (entry) =>
      (entry.fieldsChanged || []).includes("dataPlanejada") &&
      entry.after?.dataPlanejada &&
      today &&
      entry.after.dataPlanejada < today,
  );
  if (pastDateChanges.length) {
    diagnostics.push({
      code: "DATA_PASSADA",
      message:
        pastDateChanges.length +
        " bloco(s) ficariam com data planejada no passado; revise antes de aplicar.",
    });
  }
  if (validation.status === "ready" && diff.length === 0) {
    diagnostics.push({
      code: "SEM_ALTERACOES",
      message: "O rascunho não possui alterações para aplicar.",
    });
  }
  if (unallocated.length) {
    diagnostics.push({
      code: "BLOCO_NAO_ALOCADO",
      message:
        unallocated.length + " bloco(s) ficaram sem alocação na simulação.",
    });
  }
  return {
    status: validation.status,
    blocked:
      validation.status !== "ready" ||
      diff.length === 0 ||
      pastDateChanges.length > 0,
    diff,
    diagnostics,
    unallocated,
    officialMetrics,
    simulatedMetrics,
    dayImpact: {
      official: dayLoad(officialProjection),
      simulated: dayLoad(simulatedProjection),
    },
    deltaMinutos:
      (simulatedMetrics.header.minutosRestantes || 0) -
      (officialMetrics.header.minutosRestantes || 0),
  };
}

function metricRow(label, official, simulated) {
  return (
    '<tr><th scope="row">' +
    esc(label) +
    "</th><td>" +
    esc(official) +
    "</td><td>" +
    esc(simulated) +
    "</td></tr>"
  );
}

function renderDiffEntry(entry) {
  const fields = (entry.fieldsChanged || []).join(", ");
  if (!fields) return "";
  return (
    "<li><code>" +
    esc(entry.blockId || "plano") +
    "</code> — " +
    esc(fields) +
    (entry.before && entry.after && entry.fieldsChanged?.includes("minutos")
      ? " (" +
        esc(String(entry.before.minutos)) +
        " → " +
        esc(String(entry.after.minutos)) +
        " min)"
      : "") +
    "</li>"
  );
}

/** Renderiza a comparação oficial × simulada com aviso de bloqueio. */
export function renderRetaFinalApplyPreview(preview, { draftId } = {}) {
  if (!preview?.officialMetrics) {
    return '<div class="config-desc">Prévia indisponível.</div>';
  }
  const official = preview.officialMetrics.header;
  const simulated = preview.simulatedMetrics.header;
  const diffItems = (preview.diff || []).map(renderDiffEntry).filter(Boolean);
  return (
    '<section class="rf-apply-preview" data-rf-apply-preview data-status="' +
    esc(preview.status) +
    '">' +
    '<header class="rf-planner-header">' +
    '<div><div class="rf-detail-eyebrow">Prévia da aplicação</div>' +
    '<h3 class="rf-detail-title" id="rf-detail-title">Oficial × simulado</h3></div>' +
    '<span class="rf-status-badge">Aplicação local</span>' +
    "</header>" +
    '<table class="rf-apply-table"><thead><tr><th>Indicador</th><th>Oficial</th><th>Simulado</th></tr></thead><tbody>' +
    metricRow(
      "Concluído",
      official.percConcluido + "%",
      simulated.percConcluido + "%",
    ) +
    metricRow(
      "Blocos concluídos",
      official.blocosConcluidos + "/" + official.totalBlocos,
      simulated.blocosConcluidos + "/" + simulated.totalBlocos,
    ) +
    metricRow(
      "Horas restantes",
      formatHours(official.minutosRestantes),
      formatHours(simulated.minutosRestantes),
    ) +
    metricRow(
      "Ritmo necessário",
      formatHours(official.ritmoMinutosPorDia),
      formatHours(simulated.ritmoMinutosPorDia),
    ) +
    "</tbody></table>" +
    '<div class="config-desc">Diferença de horas restantes: ' +
    (preview.deltaMinutos >= 0 ? "+" : "") +
    esc(String(preview.deltaMinutos)) +
    " min.</div>" +
    '<h4 class="rf-detail-section-title">Blocos alterados (' +
    diffItems.length +
    ")</h4>" +
    (diffItems.length
      ? '<ul class="rf-apply-diff">' + diffItems.join("") + "</ul>"
      : '<p class="config-desc">Nenhuma alteração pendente.</p>') +
    '<h4 class="rf-detail-section-title">Carga por dia — simulado (' +
    (preview.dayImpact?.simulated?.length || 0) +
    " dias)</h4>" +
    (preview.dayImpact?.simulated?.length
      ? '<ul class="rf-apply-days">' +
        preview.dayImpact.simulated
          .map(
            (day) =>
              "<li><span>" +
              esc(formatBrDate(day.date)) +
              "</span><span>" +
              day.blocos +
              " bloco(s) · " +
              formatHours(day.minutos) +
              "</span></li>",
          )
          .join("") +
        "</ul>"
      : '<p class="config-desc">Nenhum dia alocado na simulação.</p>') +
    (preview.unallocated.length
      ? '<div class="restore-preview-warning">Sem alocação: ' +
        preview.unallocated
          .map((item) => esc(item.id) + " (" + esc(item.motivo) + ")")
          .join(", ") +
        ". Nada é excluído para fingir viabilidade.</div>"
      : "") +
    (preview.blocked
      ? '<div class="restore-preview-warning" role="alert">Aplicação bloqueada: ' +
        esc(preview.diagnostics[0]?.message || "rascunho incompatível") +
        "</div>"
      : "") +
    '<div class="config-desc">Aplicar grava localmente e marca a sincronização como pendente. “Sincronizado” só aparece após confirmação remota (ACK).</div>' +
    '<footer class="rf-detail-actions">' +
    '<button type="button" class="btn btn-ghost" data-action="rf-close-detail">Cancelar</button>' +
    '<button type="button" class="btn btn-primary" data-action="rf-apply-draft" data-draft-id="' +
    esc(draftId || "") +
    '"' +
    (preview.blocked ? ' disabled aria-disabled="true"' : "") +
    ">Aplicar localmente</button>" +
    "</footer>" +
    "</section>"
  );
}
