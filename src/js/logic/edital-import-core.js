function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasNonEmptyName(value) {
  return isObject(value) && typeof value.nome === 'string' && value.nome.trim().length > 0;
}

export function normalizeEditalImportName(name) {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateEditalImportPayload(payload) {
  const errors = [];

  if (!isObject(payload)) {
    return { valid: false, errors: ['payload: deve ser um objeto JSON.'] };
  }

  if (payload.versao !== 1) errors.push('versao: deve ser 1.');
  if (payload.tipo !== 'edital') errors.push('tipo: deve ser "edital".');
  if (typeof payload.nome !== 'string' || payload.nome.trim().length === 0) {
    errors.push('nome: campo obrigatório.');
  }

  if (!Array.isArray(payload.disciplinas) || payload.disciplinas.length === 0) {
    errors.push('disciplinas: deve ser um array não vazio.');
  } else {
    payload.disciplinas.forEach((disciplina, disciplinaIndex) => {
      const disciplinaPath = `disciplinas[${disciplinaIndex}]`;
      if (!isObject(disciplina)) {
        errors.push(`${disciplinaPath}: deve ser um objeto.`);
        return;
      }

      if (!hasNonEmptyName(disciplina)) {
        errors.push(`${disciplinaPath}.nome: campo obrigatório.`);
      }

      for (const collectionName of ['topicos', 'aulas']) {
        const collection = disciplina[collectionName];
        if (collection === undefined) continue;
        if (!Array.isArray(collection)) {
          errors.push(`${disciplinaPath}.${collectionName}: deve ser um array.`);
          continue;
        }

        collection.forEach((item, itemIndex) => {
          const itemPath = `${disciplinaPath}.${collectionName}[${itemIndex}]`;
          if (!hasNonEmptyName(item)) {
            errors.push(`${itemPath}.nome: campo obrigatório.`);
          }
        });
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

function appendUniqueNamedItems(target, seen, items = []) {
  for (const item of items) {
    const key = normalizeEditalImportName(item.nome);
    if (seen.has(key)) continue;

    const copy = { ...item };
    seen.set(key, copy);
    target.push(copy);
  }
}

export function canonicalizeEditalImportPayload(payload) {
  const validation = validateEditalImportPayload(payload);
  if (!validation.valid) throw new TypeError(validation.errors[0]);

  const canonicalPayload = JSON.parse(JSON.stringify(payload));
  canonicalPayload.disciplinas = [];
  const disciplinesByName = new Map();

  for (const importedDiscipline of payload.disciplinas) {
    const disciplineKey = normalizeEditalImportName(importedDiscipline.nome);
    let canonical = disciplinesByName.get(disciplineKey);

    if (!canonical) {
      canonical = { ...importedDiscipline, topicos: [], aulas: [] };
      disciplinesByName.set(disciplineKey, {
        discipline: canonical,
        topicos: new Map(),
        aulas: new Map(),
      });
      canonicalPayload.disciplinas.push(canonical);
    } else {
      canonical = canonical.discipline;
    }

    const seen = disciplinesByName.get(disciplineKey);
    appendUniqueNamedItems(canonical.topicos, seen.topicos, importedDiscipline.topicos);
    appendUniqueNamedItems(canonical.aulas, seen.aulas, importedDiscipline.aulas);
  }

  return canonicalPayload;
}

function optionalProvenanceString(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function buildEditalSourceIdentity(payload) {
  const source = isObject(payload) ? payload : {};
  const centralId = optionalProvenanceString(source.centralId);
  const sourceRef = optionalProvenanceString(source.sourceRef);
  const sourceRevision = optionalProvenanceString(source.sourceRevision);
  const nameKey = normalizeEditalImportName(source.nome);
  const identityKind = centralId ? 'centralId' : sourceRef ? 'sourceRef' : 'name';
  const canonicalValue = centralId || sourceRef || nameKey;

  return {
    source: 'central-concursos',
    centralId,
    sourceRef,
    sourceRevision,
    nameKey,
    identityKind,
    canonicalValue,
    fingerprint: `edital:v1|${identityKind}:${canonicalValue}`,
  };
}

function hasMatchingProvenance(sourceIdentity, importMetadata) {
  if (!isObject(importMetadata) || importMetadata.tipo !== 'edital') return false;

  const centralId = optionalProvenanceString(importMetadata.centralId);
  const sourceRef = optionalProvenanceString(importMetadata.sourceRef);
  const fingerprint = optionalProvenanceString(importMetadata.fingerprint);

  return Boolean(
    (sourceIdentity.centralId && sourceIdentity.centralId === centralId) ||
      (sourceIdentity.sourceRef && sourceIdentity.sourceRef === sourceRef) ||
      (sourceIdentity.fingerprint && sourceIdentity.fingerprint === fingerprint)
  );
}

export function findEditalImportCandidates(payload, editais) {
  const sourceIdentity = buildEditalSourceIdentity(payload);
  const candidates = { active: [], archived: [] };

  for (const edital of Array.isArray(editais) ? editais : []) {
    if (!isObject(edital)) continue;

    const reasons = [];
    const nameKey = normalizeEditalImportName(edital.nome);
    if (sourceIdentity.nameKey && nameKey === sourceIdentity.nameKey) reasons.push('name');
    if (hasMatchingProvenance(sourceIdentity, edital.importMetadata)) reasons.push('provenance');
    if (reasons.length === 0) continue;

    const archived = edital.arquivado === true;
    const candidate = {
      editalId: edital.id,
      nome: edital.nome,
      archived,
      reasons,
      previousRevision: optionalProvenanceString(edital.importMetadata?.sourceRevision),
    };
    candidates[archived ? 'archived' : 'active'].push(candidate);
  }

  return candidates;
}

function findNameMatches(items, name) {
  const key = normalizeEditalImportName(name);
  if (!key || !Array.isArray(items)) return [];
  return items.filter((item) => normalizeEditalImportName(item?.nome) === key);
}

function recordMatch(summary, collection, action) {
  const isTopico = collection === 'topicos';
  const suffix =
    action === 'reuse'
      ? isTopico
        ? 'Reutilizados'
        : 'Reutilizadas'
      : action === 'create_conflict'
        ? 'Conflitantes'
        : isTopico
          ? 'Novos'
          : 'Novas';
  summary[`${collection}${suffix}`] += 1;
}

function createSummary() {
  return {
    disciplinasReutilizadas: 0,
    disciplinasNovas: 0,
    disciplinasConflitantes: 0,
    topicosReutilizados: 0,
    topicosNovos: 0,
    topicosConflitantes: 0,
    aulasReutilizadas: 0,
    aulasNovas: 0,
    aulasConflitantes: 0,
  };
}

function planNestedItems(importedItems, existingItems, collection, type, parentId, summary, conflicts) {
  return importedItems.map((item) => {
    const matches = findNameMatches(existingItems, item.nome);
    const action = matches.length === 0 ? 'create' : matches.length === 1 ? 'reuse' : 'create_conflict';
    recordMatch(summary, collection, action);

    if (action === 'create_conflict') {
      conflicts.push({
        tipo: type,
        nome: item.nome,
        existingIds: matches.map(({ id }) => id),
        parentDisciplineId: parentId,
      });
    }

    return {
      nome: item.nome,
      action,
      existingId: action === 'reuse' ? matches[0].id : null,
      ...(action === 'create_conflict' ? { conflictIds: matches.map(({ id }) => id) } : {}),
    };
  });
}

function planCreatedNestedItems(importedItems, collection, summary) {
  return importedItems.map((item) => {
    recordMatch(summary, collection, 'create');
    return { nome: item.nome, action: 'create', existingId: null };
  });
}

function compareSignatureEntries(left, right) {
  const leftId = String(left.id ?? '');
  const rightId = String(right.id ?? '');
  if (leftId < rightId) return -1;
  if (leftId > rightId) return 1;
  if (left.name < right.name) return -1;
  if (left.name > right.name) return 1;
  return 0;
}

function signatureEntries(items) {
  return (Array.isArray(items) ? items : [])
    .filter(isObject)
    .map((item) => ({ id: item.id ?? null, name: normalizeEditalImportName(item.nome) }))
    .sort(compareSignatureEntries);
}

function signatureDiscipline(discipline) {
  return {
    id: discipline.id ?? null,
    name: normalizeEditalImportName(discipline.nome),
    topicos: signatureEntries(discipline.assuntos),
    aulas: signatureEntries(discipline.aulas),
  };
}

function buildTargetSignatureForPlan(editais, destination) {
  if (!isObject(destination)) return null;

  if (destination.mode === 'merge') {
    const target = (Array.isArray(editais) ? editais : []).find(
      (edital) => edital?.id === destination.editalId
    );
    if (!isObject(target) || target.arquivado === true) return null;

    const disciplinas = (Array.isArray(target.disciplinas) ? target.disciplinas : [])
      .filter(isObject)
      .map(signatureDiscipline)
      .sort(compareSignatureEntries);

    return JSON.stringify({
      mode: 'merge',
      target: {
        id: target.id ?? null,
        archived: target.arquivado === true,
        name: normalizeEditalImportName(target.nome),
        disciplinas,
      },
    });
  }

  if (destination.mode !== 'create') return null;
  const activeEditais = (Array.isArray(editais) ? editais : []).filter(
    (edital) => isObject(edital) && edital.arquivado !== true
  );
  const principalForced = activeEditais.length === 0;
  const makePrincipal = principalForced || destination.makePrincipal === true;

  if (!makePrincipal) {
    return JSON.stringify({ mode: 'create', makePrincipal: false, hasActiveEdital: true });
  }

  const activeSignature = activeEditais
    .map((edital) => ({ id: edital.id ?? null, archived: edital.arquivado === true }))
    .sort(compareSignatureEntries);
  return JSON.stringify({
    mode: 'create',
    makePrincipal: true,
    principalForced,
    activeEditais: activeSignature,
  });
}

export function buildEditalImportTargetSignature(editais, destination) {
  return buildTargetSignatureForPlan(editais, destination);
}

export function isEditalImportPlanCurrent(plan, editais) {
  if (!isObject(plan) || typeof plan.targetSignature !== 'string') return false;
  return buildEditalImportTargetSignature(editais, plan.destination) === plan.targetSignature;
}

export function buildEditalImportPlan({ payload, editais, destination }) {
  const validation = validateEditalImportPayload(payload);
  if (!validation.valid) throw new TypeError(validation.errors[0]);

  const canonicalPayload = canonicalizeEditalImportPayload(payload);
  const existingEditais = Array.isArray(editais) ? editais : [];
  if (!isObject(destination) || !['merge', 'create'].includes(destination.mode)) {
    throw new TypeError('Modo de destino inválido.');
  }

  let target = null;
  let principalForced = false;
  let resolvedDestination;

  if (destination.mode === 'merge') {
    if (typeof destination.editalId !== 'string' || destination.editalId.length === 0) {
      throw new TypeError('Escolha um edital ativo para mesclar.');
    }
    target = existingEditais.find((edital) => edital?.id === destination.editalId) ?? null;
    if (!target) throw new Error('O edital de destino não existe.');
    if (target.arquivado === true) throw new Error('O edital de destino está arquivado e não pode receber merge.');
    resolvedDestination = { mode: 'merge', editalId: target.id, makePrincipal: false };
  } else {
    principalForced = !existingEditais.some((edital) => edital && edital.arquivado !== true);
    resolvedDestination = {
      mode: 'create',
      editalId: null,
      makePrincipal: principalForced || destination.makePrincipal === true,
    };
  }

  const summary = createSummary();
  const conflicts = [];
  const plannedDisciplines = canonicalPayload.disciplinas.map((importedDiscipline) => {
    const matches =
      resolvedDestination.mode === 'merge'
        ? findNameMatches(target.disciplinas, importedDiscipline.nome)
        : [];
    const action = matches.length === 0 ? 'create' : matches.length === 1 ? 'reuse' : 'create_conflict';
    const existing = action === 'reuse' ? matches[0] : null;
    recordMatch(summary, 'disciplinas', action);

    if (action === 'create_conflict') {
      conflicts.push({
        tipo: 'disciplina',
        nome: importedDiscipline.nome,
        existingIds: matches.map(({ id }) => id),
      });
    }

    const parentId = existing?.id ?? null;
    const canMatchChildren = action === 'reuse';
    return {
      nome: importedDiscipline.nome,
      action,
      existingId: existing?.id ?? null,
      ...(action === 'create_conflict' ? { conflictIds: matches.map(({ id }) => id) } : {}),
      topicos: canMatchChildren
        ? planNestedItems(
            importedDiscipline.topicos,
            existing.assuntos,
            'topicos',
            'topico',
            parentId,
            summary,
            conflicts
          )
        : planCreatedNestedItems(importedDiscipline.topicos, 'topicos', summary),
      aulas: canMatchChildren
        ? planNestedItems(
            importedDiscipline.aulas,
            existing.aulas,
            'aulas',
            'aula',
            parentId,
            summary,
            conflicts
          )
        : planCreatedNestedItems(importedDiscipline.aulas, 'aulas', summary),
    };
  });

  const sourceIdentity = buildEditalSourceIdentity(canonicalPayload);
  return {
    source: {
      centralId: sourceIdentity.centralId,
      sourceRef: sourceIdentity.sourceRef,
      sourceRevision: sourceIdentity.sourceRevision,
      fingerprint: sourceIdentity.fingerprint,
    },
    destination: resolvedDestination,
    targetSignature: buildTargetSignatureForPlan(existingEditais, resolvedDestination),
    edital: {
      action: resolvedDestination.mode === 'merge' ? 'reuse' : 'create',
      existingId: target?.id ?? null,
      nome: canonicalPayload.nome,
    },
    disciplinas: plannedDisciplines,
    conflicts,
    summary,
    ...(principalForced ? { principalForced: true } : {}),
  };
}
