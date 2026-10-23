import {
  normalizeNameKey,
  validateRetaFinalPayload,
} from "./reta-final-core.js";
import { validateRetaFinalPortable } from "./reta-final-portable.js";

const PORTABLE_BLOCK_FIELDS = [
  "discId",
  "topicos",
  "minutos",
  "dataPlanejada",
  "prioridade",
  "observacao",
  "notas",
  "fixado",
  "arquivado",
];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, clone(item)]),
  );
}

function stable(value) {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (isRecord(value))
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + stable(value[key]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}

function same(a, b) {
  return stable(a) === stable(b);
}

function baseResult(entries = []) {
  const conflicts = entries.filter((entry) => entry.kind === "CONFLICT");
  const summary = {
    total: entries.length,
    creates: 0,
    unchanged: 0,
    updates: 0,
    moves: 0,
    archiveCandidates: 0,
    conflicts: conflicts.length,
  };
  for (const entry of entries) {
    if (entry.kind === "CREATE") summary.creates += 1;
    else if (entry.kind === "UNCHANGED") summary.unchanged += 1;
    else if (entry.kind === "UPDATE") summary.updates += 1;
    else if (entry.kind === "MOVE") summary.moves += 1;
    else if (entry.kind === "ARCHIVE_CANDIDATE") summary.archiveCandidates += 1;
  }
  return {
    entries,
    conflicts,
    commands: conflicts.length
      ? []
      : entries.flatMap((entry) => (entry.command ? [entry.command] : [])),
    summary,
  };
}

function conflictEntry(reason, proposed, blockId) {
  return {
    kind: "CONFLICT",
    ...(blockId ? { blockId } : {}),
    proposed: clone(proposed),
    reason,
  };
}

function catalogDisciplines(catalog) {
  const result = [];
  for (const edital of Array.isArray(catalog) ? catalog : []) {
    if (edital?.arquivado) continue;
    for (const discipline of Array.isArray(edital?.disciplinas)
      ? edital.disciplinas
      : []) {
      if (discipline && !discipline.arquivado) result.push(discipline);
    }
  }
  return result;
}

function uniqueById(items, id) {
  const matches = items.filter((item) => item?.id === id);
  return matches.length === 1 ? matches[0] : null;
}

function resolveV1Name(items, name) {
  const key = normalizeNameKey(name);
  const matches = items.filter((item) => normalizeNameKey(item?.nome) === key);
  if (
    matches.length === 1 &&
    typeof matches[0]?.id === "string" &&
    matches[0].id.trim()
  ) {
    return { id: matches[0].id, ambiguous: false };
  }
  return {
    id: null,
    ambiguous: matches.length > 1,
    missing: matches.length === 0,
  };
}

function comparePortableBlock(
  current,
  proposed,
  order,
  sourceRevision,
  currentOrder = current?.ordem,
) {
  if (
    current &&
    ((proposed.dataOriginal !== undefined &&
      proposed.dataOriginal !== current.dataOriginal) ||
      (proposed.provenance !== undefined &&
        !same(proposed.provenance, current.provenance)))
  ) {
    return conflictEntry(
      "dataOriginal/provenance não podem ser alterados pelos comandos editoriais disponíveis.",
      proposed,
      current.id,
    );
  }
  if (current?.arquivado === true && proposed.arquivado === true) {
    const changedArchivedContent =
      PORTABLE_BLOCK_FIELDS.some(
        (field) =>
          field !== "arquivado" &&
          !same(current[field] ?? undefined, proposed[field] ?? undefined),
      ) || order !== currentOrder;
    return changedArchivedContent
      ? conflictEntry(
          "Um bloco já arquivado não pode ser editado por este fluxo.",
          proposed,
          current.id,
        )
      : {
          kind: "UNCHANGED",
          blockId: current.id,
          proposed: clone(proposed),
          reason: "O bloco já está arquivado como no arquivo portátil.",
        };
  }
  if (current && current.arquivado === true && proposed.arquivado !== true) {
    const changedWhileRestoring =
      PORTABLE_BLOCK_FIELDS.some(
        (field) =>
          field !== "arquivado" &&
          !same(
            current[field] ?? (field === "arquivado" ? false : undefined),
            proposed[field] ?? (field === "arquivado" ? false : undefined),
          ),
      ) || order !== currentOrder;
    if (changedWhileRestoring) {
      return conflictEntry(
        "Restaurar e editar o bloco exige mais de um comando; revise em operações separadas.",
        proposed,
        current.id,
      );
    }
  }
  if (current && current.arquivado !== true && proposed.arquivado === true) {
    const changedWhileArchiving =
      PORTABLE_BLOCK_FIELDS.some(
        (field) =>
          field !== "arquivado" &&
          !same(
            current[field] ?? (field === "arquivado" ? false : undefined),
            proposed[field] ?? (field === "arquivado" ? false : undefined),
          ),
      ) || order !== currentOrder;
    if (changedWhileArchiving) {
      return conflictEntry(
        "Arquivar e editar o bloco exige mais de um comando; revise em operações separadas.",
        proposed,
        current.id,
      );
    }
  }
  if (proposed.arquivado) {
    if (!current) {
      return conflictEntry(
        "Bloco arquivado ausente do plano; não é possível arquivar uma identidade inexistente.",
        proposed,
        proposed.id,
      );
    }
    return {
      kind: "ARCHIVE_CANDIDATE",
      blockId: current?.id || proposed.id,
      proposed: clone(proposed),
      reason:
        "O arquivo propõe arquivamento; requer aprovação humana no rascunho.",
      command: {
        type: "ARCHIVE",
        blockIds: [current?.id || proposed.id],
        sourceRevision,
      },
    };
  }
  if (!current) {
    if (
      proposed.dataOriginal !== undefined &&
      proposed.dataOriginal !== proposed.dataPlanejada
    ) {
      return conflictEntry(
        "dataOriginal diferente de dataPlanejada não pode ser preservada pelo comando CREATE.",
        proposed,
        proposed.id,
      );
    }
    const input = {
      discId: proposed.discId,
      topicos: clone(proposed.topicos),
      minutos: proposed.minutos,
      dataPlanejada: proposed.dataPlanejada,
      ordem: order,
      ...(proposed.prioridade !== undefined
        ? { prioridade: proposed.prioridade }
        : {}),
      ...(proposed.observacao !== undefined
        ? { observacao: proposed.observacao }
        : {}),
      ...(typeof proposed.notas === "string" ? { notas: proposed.notas } : {}),
      ...(proposed.fixado !== undefined ? { fixado: proposed.fixado } : {}),
    };
    return {
      kind: "CREATE",
      blockId: proposed.id,
      proposed: clone(proposed),
      reason: "Bloco novo; será criado apenas no rascunho.",
      command: {
        type: "CREATE",
        input,
        ...(proposed.provenance
          ? { sourceProvenance: clone(proposed.provenance) }
          : {}),
        sourceRevision,
      },
    };
  }

  if (current.arquivado === true && proposed.arquivado !== true) {
    return {
      kind: "UPDATE",
      blockId: current.id,
      proposed: clone(proposed),
      reason:
        "O arquivo propõe restaurar um bloco arquivado; requer aprovação humana.",
      command: { type: "UNARCHIVE", blockIds: [current.id], sourceRevision },
    };
  }

  if (
    Object.prototype.hasOwnProperty.call(proposed, "notas") &&
    typeof current.notas === "string" &&
    current.notas !== proposed.notas
  ) {
    return conflictEntry(
      "As notas do arquivo diferem das notas atuais; preservação exige decisão humana.",
      proposed,
      current.id,
    );
  }
  const target = { ...proposed, ordem: order };
  const patch = {};
  for (const field of PORTABLE_BLOCK_FIELDS) {
    if (
      !same(
        current[field] ?? (field === "arquivado" ? false : undefined),
        target[field] ?? (field === "arquivado" ? false : undefined),
      )
    ) {
      if (
        field !== "dataPlanejada" ||
        proposed.dataPlanejada !== current.dataPlanejada
      ) {
        patch[field] =
          field === "topicos" ? clone(proposed[field]) : proposed[field];
      }
    }
  }
  const dateChanged = proposed.dataPlanejada !== current.dataPlanejada;
  const orderChanged = order !== currentOrder;
  const changedFields = Object.keys(patch);
  if (!changedFields.length && !dateChanged && !orderChanged) {
    return {
      kind: "UNCHANGED",
      blockId: current.id,
      proposed: clone(proposed),
      reason: "Identidade e intenção já correspondem ao plano.",
    };
  }
  const positionalOnly = changedFields.every(
    (field) => field === "dataPlanejada",
  );
  if ((dateChanged || orderChanged) && positionalOnly) {
    return {
      kind: "MOVE",
      blockId: current.id,
      proposed: clone(proposed),
      reason: "Data planejada ou ordem mudou.",
      command: {
        type: "MOVE",
        blockIds: [current.id],
        targetDate: proposed.dataPlanejada,
        ...(orderChanged ? { targetOrder: order } : {}),
        sourceRevision,
      },
    };
  }
  if (dateChanged) patch.dataPlanejada = proposed.dataPlanejada;
  if (orderChanged) patch.ordem = order;
  return {
    kind: "UPDATE",
    blockId: current.id,
    proposed: clone(proposed),
    reason: "Campos de intenção diferem do plano atual.",
    command: {
      type: "PATCH",
      blockIds: [current.id],
      patch,
      ...(proposed.provenance
        ? { sourceProvenance: clone(proposed.provenance) }
        : {}),
      sourceRevision,
    },
  };
}

function compareV2(plan, payload, catalog) {
  const validation = validateRetaFinalPortable(payload);
  if (!validation.valid)
    return baseResult([conflictEntry(validation.errors[0], payload)]);
  if (payload.planId !== plan.planId) {
    return baseResult([
      conflictEntry(
        "planId diferente do plano ativo; importação bloqueada.",
        payload,
      ),
    ]);
  }
  if (
    payload.provenance !== undefined &&
    !same(payload.provenance, plan.provenance)
  ) {
    return baseResult([
      conflictEntry(
        "provenance do plano difere e não pode ser alterada pelos comandos editoriais.",
        payload,
      ),
    ]);
  }

  const disciplines = catalogDisciplines(catalog);
  const currentOrder = new Map(
    [...plan.retaFinal.blocos]
      .sort((a, b) => (a?.ordem ?? 0) - (b?.ordem ?? 0))
      .map((block, index) => [block?.id, index]),
  );
  const entries = [];
  for (const [index, proposed] of payload.blocos.entries()) {
    const sameId = plan.retaFinal.blocos.filter(
      (block) => block?.id === proposed.id,
    );
    const current = sameId.length === 1 ? sameId[0] : null;
    if (sameId.length > 1) {
      entries.push(
        conflictEntry(
          "ID de bloco duplicado no plano ativo.",
          proposed,
          proposed.id,
        ),
      );
      continue;
    }
    const discipline = uniqueById(disciplines, proposed.discId);
    if (!discipline) {
      entries.push(
        conflictEntry(
          "discId não existe de forma única no catálogo ativo.",
          proposed,
          proposed.id,
        ),
      );
      continue;
    }
    const invalidRef = proposed.topicos.find((topic) => {
      if (topic.assId) {
        const locations = disciplines.flatMap((item) =>
          (item.assuntos || [])
            .filter((candidate) => candidate?.id === topic.assId)
            .map((candidate) => ({ item, candidate })),
        );
        return locations.length !== 1 || locations[0].item !== discipline;
      }
      const locations = disciplines.flatMap((item) =>
        (item.aulas || [])
          .filter((candidate) => candidate?.id === topic.aulaId)
          .map((candidate) => ({ item, candidate })),
      );
      return locations.length !== 1 || locations[0].item !== discipline;
    });
    if (invalidRef) {
      entries.push(
        conflictEntry(
          "Referência de assunto/aula não corresponde de forma única à disciplina.",
          proposed,
          proposed.id,
        ),
      );
      continue;
    }
    entries.push(
      comparePortableBlock(
        current,
        proposed,
        index,
        payload.exportRevision,
        current ? currentOrder.get(current.id) : undefined,
      ),
    );
  }

  const incomingIds = new Set(payload.blocos.map((block) => block.id));
  for (const current of plan.retaFinal.blocos) {
    if (!incomingIds.has(current.id)) {
      entries.push({
        kind: "ARCHIVE_CANDIDATE",
        blockId: current.id,
        proposed: clone(current),
        reason:
          "Bloco ausente no arquivo não representa exclusão; arquivamento requer aprovação humana.",
        command: {
          type: "ARCHIVE",
          blockIds: [current.id],
          sourceRevision: payload.exportRevision,
        },
      });
    }
  }

  if (payload.dataFinal !== plan.retaFinal.dataFinal) {
    const canExtend = payload.dataFinal > plan.retaFinal.dataFinal;
    entries.push(
      canExtend
        ? {
            kind: "UPDATE",
            proposed: { dataFinal: payload.dataFinal },
            reason: "Prazo final mudou.",
            command: {
              type: "EXTEND_DEADLINE",
              input: { dataFinal: payload.dataFinal },
              sourceRevision: payload.exportRevision,
            },
          }
        : conflictEntry(
            "O prazo importado reduziria o prazo atual e não pode ser aplicado por este fluxo.",
            { dataFinal: payload.dataFinal },
          ),
    );
  }
  if (payload.minutosPadrao !== plan.retaFinal.minutosPadrao) {
    entries.push({
      kind: "UPDATE",
      proposed: { minutosPadrao: payload.minutosPadrao },
      reason: "Duração padrão mudou.",
      command: {
        type: "SET_MINUTOS_PADRAO",
        input: { minutosPadrao: payload.minutosPadrao },
        sourceRevision: payload.exportRevision,
      },
    });
  }
  if (
    !same(payload.capacidade, plan.retaFinal.capacidade) &&
    payload.capacidade !== undefined
  ) {
    entries.push({
      kind: "UPDATE",
      proposed: { capacidade: clone(payload.capacidade) },
      reason: "Capacidade mudou.",
      command: {
        type: "SET_CAPACITY",
        input: { capacidade: clone(payload.capacidade) },
        sourceRevision: payload.exportRevision,
      },
    });
  }
  if (payload.nome !== plan.retaFinal.nome) {
    entries.push(
      conflictEntry(
        "O nome do plano não é editável pelos comandos disponíveis.",
        { nome: payload.nome },
      ),
    );
  }
  return baseResult(entries);
}

function compareV1(plan, payload, catalog) {
  const validation = validateRetaFinalPayload(payload);
  if (!validation.valid)
    return baseResult([conflictEntry(validation.errors[0], payload)]);
  const disciplines = catalogDisciplines(catalog);
  const currentBlocks = plan.retaFinal.blocos;
  const claimed = new Set();
  const entries = [];
  let order = 0;
  for (const day of payload.dias) {
    for (const legacy of day.blocos) {
      const disc = resolveV1Name(disciplines, legacy.disciplina);
      const proposed = {
        disciplina: legacy.disciplina,
        dataPlanejada: day.data,
        sourceRevision: null,
      };
      if (disc.ambiguous) {
        entries.push(
          conflictEntry(
            `Disciplina "${legacy.disciplina}" ambígua no catálogo.`,
            proposed,
          ),
        );
        order += 1;
        continue;
      }
      if (disc.missing) {
        entries.push(
          conflictEntry(
            `Disciplina "${legacy.disciplina}" não existe no catálogo do plano ativo.`,
            proposed,
          ),
        );
        order += 1;
        continue;
      }
      const discipline = uniqueById(disciplines, disc.id);
      const refs = [];
      let refConflict = null;
      for (const name of Array.isArray(legacy.topicos) ? legacy.topicos : []) {
        const resolved = resolveV1Name(discipline.assuntos || [], name);
        if (resolved.ambiguous || resolved.missing) {
          refConflict = `Tópico "${name}" ${resolved.ambiguous ? "ambíguo" : "ausente"} na disciplina.`;
          break;
        }
        refs.push({ assId: resolved.id, aulaId: null });
      }
      if (!refConflict && legacy.aula) {
        const resolved = resolveV1Name(discipline.aulas || [], legacy.aula);
        if (resolved.ambiguous || resolved.missing) {
          refConflict = `Aula "${legacy.aula}" ${resolved.ambiguous ? "ambígua" : "ausente"} na disciplina.`;
        } else refs.push({ assId: null, aulaId: resolved.id });
      }
      if (refConflict) {
        entries.push(conflictEntry(refConflict, proposed));
        order += 1;
        continue;
      }
      const wanted = {
        discId: disc.id,
        topicos: refs,
        minutos:
          legacy.minutos ??
          payload.minutosPadrao ??
          plan.retaFinal.minutosPadrao,
        dataPlanejada: day.data,
      };
      const matching = currentBlocks.filter(
        (block) =>
          block.discId === wanted.discId &&
          same(block.topicos, wanted.topicos) &&
          !claimed.has(block.id),
      );
      if (matching.length > 1) {
        entries.push(
          conflictEntry(
            "Mais de um bloco atual corresponde à mesma entrada v1.",
            wanted,
          ),
        );
      } else if (matching.length === 1) {
        const current = matching[0];
        claimed.add(current.id);
        const portable = { id: current.id, ...wanted };
        entries.push(comparePortableBlock(current, portable, order, null));
      } else {
        const portable = { id: `legacy-import-${order}`, ...wanted };
        entries.push(comparePortableBlock(null, portable, order, null));
      }
      order += 1;
    }
  }
  if (entries.some((entry) => entry.kind === "CONFLICT")) {
    return baseResult(entries.filter((entry) => entry.kind === "CONFLICT"));
  }
  for (const current of currentBlocks) {
    if (!claimed.has(current.id)) {
      entries.push({
        kind: "ARCHIVE_CANDIDATE",
        blockId: current.id,
        proposed: clone(current),
        reason:
          "Bloco ausente no arquivo v1 não representa exclusão; arquivamento requer aprovação humana.",
        command: { type: "ARCHIVE", blockIds: [current.id] },
      });
    }
  }
  return baseResult(entries);
}

/** Purely classifies an import and creates Task 3 commands for a draft; never applies them. */
export function compareRetaFinalImport(
  plan,
  payload,
  { catalog = [], basePlan } = {},
) {
  void basePlan;
  if (
    !isRecord(plan) ||
    plan.tipo !== "reta_final" ||
    !isRecord(plan.retaFinal) ||
    !Array.isArray(plan.retaFinal.blocos)
  ) {
    return baseResult([
      conflictEntry("Plano ativo inválido para comparação.", payload),
    ]);
  }
  let result;
  if (isRecord(payload) && payload.versao === 1)
    result = compareV1(plan, payload, catalog);
  else if (isRecord(payload) && payload.versao === 2)
    result = compareV2(plan, payload, catalog);
  else {
    const validation = validateRetaFinalPortable(payload);
    return baseResult([
      conflictEntry(validation.errors[0] || "Versão não reconhecida.", payload),
    ]);
  }
  if (!result.conflicts.length) {
    const revision = payload.exportRevision ?? `legacy-${plan.revision}`;
    result.entries.forEach((entry, index) => {
      if (!entry.command) return;
      const blockId = entry.blockId || "plan";
      entry.command.operationId = `reta-final-import:${plan.planId}:${revision}:${index}:${entry.command.type}:${blockId}`;
    });
    result.commands = result.entries.flatMap((entry) =>
      entry.command ? [entry.command] : [],
    );
  }
  return result;
}
