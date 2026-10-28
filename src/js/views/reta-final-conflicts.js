/**
 * Reta Final conflict review.
 *
 * This module owns the stable normalization of the two conflict sources
 * (`config.firestoreSync.conflict` and `config.syncMergeConflicts`) plus the
 * escaped review markup. It never writes state and never chooses a side.
 */
import { esc } from "../utils.js?v=8.37";

const MAX_VALUE_LENGTH = 180;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function valueText(value) {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function shortValue(value) {
  const text = valueText(value);
  if (text.length <= MAX_VALUE_LENGTH) return text;
  return `${text.slice(0, MAX_VALUE_LENGTH - 1)}…`;
}

function renderCell(value) {
  const full = valueText(value);
  const short = shortValue(value);
  if (full === short) return esc(short);
  return `${esc(short)}<details class="rf-conflict-full-value"><summary>Ver completo</summary><pre>${esc(full)}</pre></details>`;
}

function statusText(plan) {
  if (!isRecord(plan)) return "—";
  return plan.ativo === true ? "Ativo" : "Aposentado";
}

function blockCount(plan) {
  return Array.isArray(plan?.retaFinal?.blocos)
    ? plan.retaFinal.blocos.length
    : 0;
}

function stableValue(value) {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function blockFieldRows(item) {
  const maps = [item.basePlan, item.localPlan, item.remotePlan].map(
    (planValue) => {
      return new Map(
        (planValue?.retaFinal?.blocos || []).map((block) => [block?.id, block]),
      );
    },
  );
  const ids = [...new Set(maps.flatMap((map) => [...map.keys()]))].sort();
  const existing = new Set(
    item.mergeConflicts
      .filter((entry) => isRecord(entry))
      .map((entry) => entry.fieldPath),
  );
  const rows = [];
  for (const id of ids) {
    const blocks = maps.map((map) => map.get(id) || null);
    if (blocks.some((block) => !block)) {
      rows.push({
        field: `retaFinal.blocos.${id}.$existence`,
        base: blocks[0] ? "presente" : "ausente",
        local: blocks[1] ? "presente" : "ausente",
        remote: blocks[2] ? "presente" : "ausente",
      });
      continue;
    }
    const keys = [
      ...new Set(blocks.flatMap((block) => Object.keys(block || {}))),
    ].sort();
    for (const key of keys) {
      if (key === "id") continue;
      const values = blocks.map((block) => block?.[key]);
      if (
        stableValue(values[0]) === stableValue(values[1]) &&
        stableValue(values[1]) === stableValue(values[2])
      ) {
        continue;
      }
      const field = `retaFinal.blocos.${id}.${key}`;
      if (existing.has(field)) continue;
      rows.push({
        field,
        base: values[0],
        local: values[1],
        remote: values[2],
      });
    }
  }
  return rows;
}

function isResolvableField(fieldPath) {
  if (typeof fieldPath !== "string" || !fieldPath.trim()) return false;
  if (fieldPath.includes("$")) return false;
  if (
    fieldPath
      .split(".")
      .some((segment) =>
        ["__proto__", "prototype", "constructor"].includes(segment),
      )
  ) {
    return false;
  }
  if (["schema", "planId", "revision", "updatedAt"].includes(fieldPath))
    return false;
  if (
    fieldPath.startsWith("operations") ||
    fieldPath.startsWith("pendingOperations")
  )
    return false;
  return true;
}

function uniqueIdFactory() {
  const seen = new Map();
  return (baseId) => {
    const count = (seen.get(baseId) || 0) + 1;
    seen.set(baseId, count);
    return count === 1 ? baseId : `${baseId}:${count}`;
  };
}

/**
 * Normalizes both conflict sources into stable review items.
 * Duplicate keys receive a deterministic suffix instead of silently dropping
 * later occurrences.
 */
export function collectRetaFinalConflicts(sourceState = {}) {
  const config =
    isRecord(sourceState) && isRecord(sourceState.config)
      ? sourceState.config
      : {};
  const firestore = isRecord(config.firestoreSync) ? config.firestoreSync : {};
  const statePlan = isRecord(sourceState?.planejamento)
    ? sourceState.planejamento
    : null;
  const conflict = isRecord(firestore.conflict) ? firestore.conflict : null;
  const localPlan = isRecord(conflict?.localPlan)
    ? conflict.localPlan
    : statePlan;
  const planId =
    (typeof conflict?.localPlan?.planId === "string" &&
      conflict.localPlan.planId) ||
    (typeof conflict?.remotePlan?.planId === "string" &&
      conflict.remotePlan.planId) ||
    (typeof conflict?.proposedPlan?.planId === "string" &&
      conflict.proposedPlan.planId) ||
    (typeof conflict?.basePlan?.planId === "string" &&
      conflict.basePlan.planId) ||
    (typeof statePlan?.planId === "string" && statePlan.planId) ||
    "unknown";
  const nextId = uniqueIdFactory();
  const items = [];

  if (conflict?.type === "reta-final-conflict") {
    const cause =
      typeof conflict.cause === "string" && conflict.cause.trim()
        ? conflict.cause
        : "unknown";
    const subcause =
      typeof conflict.subcause === "string" && conflict.subcause.trim()
        ? conflict.subcause
        : null;
    const differences = Array.isArray(conflict.differences)
      ? conflict.differences.filter((item) => typeof item === "string")
      : [];
    const baseId = `reta-final:${cause}:${planId}:plan`;
    items.push({
      conflictId: nextId(baseId),
      source: "firestore",
      sourceIndex: null,
      mergeIndex: null,
      cause,
      subcause,
      differences,
      planId,
      blockId: null,
      fieldPath: "$plan",
      base: null,
      local: null,
      remote: null,
      basePlan: isRecord(conflict.basePlan) ? conflict.basePlan : null,
      localPlan: isRecord(conflict.localPlan) ? conflict.localPlan : null,
      remotePlan: isRecord(conflict.remotePlan) ? conflict.remotePlan : null,
      proposedPlan: isRecord(conflict.proposedPlan)
        ? conflict.proposedPlan
        : null,
      mergeConflicts: Array.isArray(conflict.mergeConflicts)
        ? conflict.mergeConflicts
        : [],
      detectedAt: conflict.detectedAt || null,
      remoteUpdatedAt: conflict.remoteUpdatedAt || null,
      reason: conflict.reason || "",
      localRevision: localPlan?.revision ?? null,
      resolvable: true,
      remoteAvailable: isRecord(conflict.remotePlan),
      remoteCompatible:
        isRecord(conflict.remotePlan) && conflict.remotePlan.planId === planId,
    });
  }

  const merge = isRecord(config.syncMergeConflicts)
    ? config.syncMergeConflicts
    : null;
  const mergeItems =
    merge?.type === "reta-final-three-way" &&
    Array.isArray(merge.items) &&
    merge.items.length > 0
      ? merge.items
      : Array.isArray(conflict?.items)
        ? conflict.items
        : [];
  /*
   * Some legacy merge paths store the field conflicts under the parent
   * Firestore conflict (`merge-collision`) instead of `syncMergeConflicts`.
   * Normalize both shapes so the review does not fall back to the generic
   * destructive panel.
   */
  mergeItems.forEach((raw, index) => {
    if (!isRecord(raw)) return;
    const itemPlanId =
      (typeof raw.planId === "string" && raw.planId) ||
      (typeof statePlan?.planId === "string" && statePlan.planId) ||
      planId;
    const blockId =
      typeof raw.blockId === "string" && raw.blockId ? raw.blockId : null;
    const fieldPath =
      typeof raw.fieldPath === "string" && raw.fieldPath
        ? raw.fieldPath
        : "field";
    const baseId = `reta-final:three-way:${itemPlanId}:${blockId || "plan"}:${fieldPath}`;
    items.push({
      conflictId: nextId(baseId),
      source: "merge",
      sourceIndex: index,
      mergeIndex: index,
      cause: "three-way",
      planId: itemPlanId,
      blockId,
      fieldPath,
      base: raw.base ?? null,
      local: raw.local ?? null,
      remote: raw.remote ?? null,
      basePlan: null,
      localPlan: null,
      remotePlan: null,
      proposedPlan: null,
      mergeConflicts: [],
      detectedAt: merge?.detectedAt || conflict?.detectedAt || null,
      remoteUpdatedAt: null,
      reason: raw.reason || "",
      localRevision: statePlan?.revision ?? null,
      resolvable: isResolvableField(fieldPath),
      remoteAvailable: true,
    });
  });

  return items;
}

/** Removes only the resolved conflict from a cloned state. */
export function removeRetaFinalConflict(targetState, conflictId) {
  if (!isRecord(targetState) || !isRecord(targetState.config))
    return targetState;
  const conflict = collectRetaFinalConflicts(targetState).find(
    (item) => item.conflictId === conflictId,
  );
  if (!conflict) return targetState;

  if (conflict.source === "firestore") {
    if (isRecord(targetState.config.firestoreSync)) {
      targetState.config.firestoreSync.conflict = null;
    }
    return targetState;
  }

  const merge = targetState.config.syncMergeConflicts;
  const parent = targetState.config.firestoreSync?.conflict;
  const container =
    isRecord(merge) && Array.isArray(merge.items) && merge.items.length > 0
      ? merge
      : isRecord(parent) && Array.isArray(parent.items)
        ? parent
        : null;
  if (!container) return targetState;
  const index = conflict.mergeIndex;
  if (Number.isInteger(index) && index >= 0 && index < container.items.length) {
    container.items.splice(index, 1);
  } else {
    container.items = container.items.filter(
      (item) =>
        !isRecord(item) ||
        item.planId !== conflict.planId ||
        (item.blockId || null) !== conflict.blockId ||
        item.fieldPath !== conflict.fieldPath,
    );
  }
  container.total = container.items.length;
  if (container.items.length > 0) return targetState;

  if (container === merge) {
    delete targetState.config.syncMergeConflicts;
    if (
      isRecord(parent) &&
      (parent.reason === "merge-collision" || Array.isArray(parent.items))
    ) {
      targetState.config.firestoreSync.conflict = null;
    }
  } else {
    if (
      isRecord(merge) &&
      Array.isArray(merge.items) &&
      merge.items.length === 0
    ) {
      delete targetState.config.syncMergeConflicts;
    }
    targetState.config.firestoreSync.conflict = null;
  }
  return targetState;
}

function compareRows(item) {
  if (item.source === "merge") {
    return [
      {
        field: item.fieldPath || "campo",
        base: item.base,
        local: item.local,
        remote: item.remote,
        reason: item.reason,
      },
    ];
  }

  const rows = [
    {
      field: "planId",
      base: item.basePlan?.planId,
      local: item.localPlan?.planId,
      remote: item.remotePlan?.planId,
    },
    {
      field: "revision",
      base: item.basePlan?.revision,
      local: item.localPlan?.revision,
      remote: item.remotePlan?.revision,
    },
    {
      field: "situação",
      base: statusText(item.basePlan),
      local: statusText(item.localPlan),
      remote: item.remotePlan ? statusText(item.remotePlan) : "—",
    },
    {
      field: "dataFinal",
      base: item.basePlan?.retaFinal?.dataFinal,
      local: item.localPlan?.retaFinal?.dataFinal,
      remote: item.remotePlan?.retaFinal?.dataFinal,
    },
    {
      field: "minutosPadrao",
      base: item.basePlan?.retaFinal?.minutosPadrao,
      local: item.localPlan?.retaFinal?.minutosPadrao,
      remote: item.remotePlan?.retaFinal?.minutosPadrao,
    },
    {
      field: "disciplinas",
      base: Array.isArray(item.basePlan?.disciplinas)
        ? item.basePlan.disciplinas.length
        : "—",
      local: Array.isArray(item.localPlan?.disciplinas)
        ? item.localPlan.disciplinas.length
        : "—",
      remote: Array.isArray(item.remotePlan?.disciplinas)
        ? item.remotePlan.disciplinas.length
        : "—",
    },
    {
      field: "blocos",
      base: blockCount(item.basePlan),
      local: blockCount(item.localPlan),
      remote: item.remotePlan ? blockCount(item.remotePlan) : "—",
    },
    ...blockFieldRows(item),
  ];
  for (const mergeConflict of item.mergeConflicts) {
    if (!isRecord(mergeConflict)) continue;
    rows.push({
      field: mergeConflict.fieldPath || "campo",
      base: mergeConflict.base,
      local: mergeConflict.local,
      remote: mergeConflict.remote,
      reason: mergeConflict.reason,
    });
  }
  return rows;
}

function renderCompareTable(rows) {
  return `
    <div class="rf-conflict-compare-wrap">
      <table class="rf-conflict-compare">
        <caption class="rf-conflict-compare-caption">Comparação base, local e remota</caption>
        <thead>
          <tr><th scope="col">Campo</th><th scope="col">Base</th><th scope="col">Local</th><th scope="col">Remoto</th></tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
            <tr>
              <th scope="row">${renderCell(row.field)}</th>
              <td>${renderCell(row.base)}</td>
              <td>${renderCell(row.local)}</td>
              <td>${renderCell(row.remote)}</td>
            </tr>
            ${row.reason ? `<tr class="rf-conflict-reason"><td colspan="4">${esc(row.reason)}</td></tr>` : ""}
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderChoice({ name, value, label, hint, disabled }) {
  const id = `${name}-${value}`;
  return `
    <div class="rf-conflict-choice">
      <label for="${esc(id)}" class="rf-conflict-choice-label" style="min-height:44px">
        <input type="radio" id="${esc(id)}" name="${esc(name)}" value="${esc(value)}" ${disabled ? "disabled" : ""} />
        <span>${esc(label)}</span>
      </label>
      <span class="rf-conflict-choice-hint">${esc(hint)}</span>
    </div>
  `;
}

function renderConflictItem(item, index) {
  const name = `rf-conflict-choice-${item.conflictId}`;
  const manualId = `rf-conflict-manual-${item.conflictId}`;
  const titleId = `rf-conflict-title-${item.conflictId}`;
  const localHint =
    item.source === "merge"
      ? "Mantém o valor local deste campo e cria uma nova revisão local."
      : item.remotePlan
        ? "Mantém o conteúdo deste dispositivo e o rebaseia sobre a revisão remota. Um checkpoint guarda a versão anterior."
        : "Mantém o conteúdo deste dispositivo e cria uma nova revisão local. Nenhuma base remota será presumida.";
  const remoteHint =
    item.source === "merge"
      ? "Usa o valor remoto deste campo. O restante do plano local é preservado."
      : item.remotePlan
        ? "Usa o plano remoto. O plano local atual fica preservado em checkpoint antes da troca."
        : "Indisponível: não há plano remoto verificável para adotar.";
  const manualHint =
    "Edite o JSON abaixo. Um plano inválido ou com referência quebrada não é gravado.";
  const remoteDisabled =
    !item.resolvable || (item.source === "firestore" && !item.remoteCompatible);
  const localDisabled = !item.resolvable;
  const manualDisabled =
    !item.resolvable || (item.source === "firestore" && !item.remoteCompatible);

  return `
    <article class="rf-conflict-card" data-rf-conflict-card data-conflict-id="${esc(item.conflictId)}" aria-labelledby="${esc(titleId)}">
      <header class="rf-conflict-card-header">
        <h4 id="${esc(titleId)}" class="rf-conflict-title">
          ${item.source === "firestore" ? "Plano remoto divergente" : "Campo em conflito"}
        </h4>
        <p class="rf-conflict-subtitle">
          Plano <code>${esc(item.planId)}</code>
          ${item.blockId ? ` · bloco <code>${esc(item.blockId)}</code>` : ""}
          · causa <code>${esc(item.cause)}</code>
          ${item.subcause ? ` · subcausa <code>${esc(item.subcause)}</code>` : ""}
        </p>
        ${item.reason ? `<p class="rf-conflict-reason-text">${esc(item.reason)}</p>` : ""}
        ${
          Array.isArray(item.differences) && item.differences.length
            ? `<details class="rf-conflict-differences"><summary>${item.differences.length} diferenca(s) de conteudo</summary><ul>${item.differences
                .slice(0, 12)
                .map((path) => `<li><code>${esc(path)}</code></li>`)
                .join("")}</ul></details>`
            : ""
        }
      </header>

      ${renderCompareTable(compareRows(item))}

      <button
        type="button"
        class="btn btn-outline btn-sm rf-conflict-cancel"
        data-action="rf-conflict-cancel"
        data-conflict-id="${esc(item.conflictId)}"
        style="min-height:44px;min-width:44px"
      >Cancelar e manter o conflito</button>

      <fieldset class="rf-conflict-choices" ${item.resolvable ? "" : "disabled"}>
        <legend>Escolha uma resolução para esta revisão</legend>
        ${renderChoice({
          name,
          value: "local",
          label: "Manter a versão local",
          hint: localHint,
          disabled: localDisabled,
        })}
        ${renderChoice({
          name,
          value: "remote",
          label: "Usar a versão remota",
          hint: remoteHint,
          disabled: remoteDisabled,
        })}
        ${renderChoice({
          name,
          value: "manual",
          label: "Resolver manualmente",
          hint: manualHint,
          disabled: manualDisabled,
        })}
        <div class="rf-conflict-manual">
          <label for="${esc(manualId)}" class="rf-conflict-manual-label">JSON do plano corrigido</label>
          <textarea
            id="${esc(manualId)}"
            class="form-control rf-conflict-manual-input"
            data-action="rf-conflict-manual-input"
            data-conflict-id="${esc(item.conflictId)}"
            rows="6"
            spellcheck="false"
            placeholder='{ "retaFinal": { "blocos": [] } }'
            style="min-height:88px"
            ${manualDisabled ? "disabled" : ""}
          ></textarea>
          <p class="rf-conflict-manual-status" data-rf-conflict-manual-status role="status"></p>
        </div>
      </fieldset>

      ${
        item.resolvable
          ? ""
          : '<p class="rf-conflict-unresolvable" role="note">Este conflito de metadados exige revisar a base/linhagem do plano; não há escolha segura por campo.</p>'
      }

      <div class="rf-conflict-actions">
        <button
          type="button"
          class="btn btn-primary btn-sm"
          data-action="rf-conflict-apply"
          data-conflict-id="${esc(item.conflictId)}"
          data-conflict-source="${esc(item.source)}"
          style="min-height:44px;min-width:44px"
          ${item.resolvable ? "" : "disabled"}
        >Aplicar escolha</button>
      </div>
    </article>
  `;
}

/** Renders the conflict review; returns an empty string when nothing is pending. */
export function renderRetaFinalConflictReview(conflicts, options = {}) {
  const items = Array.isArray(conflicts)
    ? conflicts
    : collectRetaFinalConflicts(conflicts);
  const reviewable = items.filter(
    (item) => isRecord(item) && typeof item.conflictId === "string",
  );
  if (reviewable.length === 0) return "";
  const heading = options.heading || "Revisão de conflitos da Reta Final";

  return `
    <section
      class="sync-conflict-panel rf-conflict-review"
      data-testid="rf-conflict-review"
      data-rf-conflict-review
      aria-labelledby="rf-conflict-review-title"
    >
      <div class="sync-conflict-header">
        <i class="fa fa-code-merge"></i>
        <div>
          <div class="sync-conflict-title" id="rf-conflict-review-title">${esc(heading)}</div>
          <div class="sync-conflict-sub">
            Nenhuma escolha é aplicada sem confirmação. Cancelar mantém o conflito e não grava nada.
          </div>
        </div>
      </div>
      <div class="rf-conflict-list">
        ${reviewable.map((item, index) => renderConflictItem(item, index)).join("")}
      </div>
    </section>
  `;
}
