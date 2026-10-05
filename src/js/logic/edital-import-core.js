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
