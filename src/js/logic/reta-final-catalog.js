import { normalizeNameKey } from './reta-final-core.js';

const ENTITY_COLLECTIONS = {
  assunto: 'assuntos',
  aula: 'aulas',
};

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isId(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function listDisciplines(catalog) {
  const disciplines = [];
  if (!Array.isArray(catalog)) return disciplines;
  for (const edital of catalog) {
    for (const discipline of Array.isArray(edital?.disciplinas) ? edital.disciplinas : []) {
      if (isRecord(discipline)) disciplines.push(discipline);
    }
  }
  return disciplines;
}

function listEntityLocations(catalog, entity) {
  const collection = ENTITY_COLLECTIONS[entity];
  const locations = [];
  for (const discipline of listDisciplines(catalog)) {
    for (const item of Array.isArray(discipline[collection]) ? discipline[collection] : []) {
      if (isRecord(item)) locations.push({ discipline, item });
    }
  }
  return locations;
}

function allCatalogIds(catalog) {
  const ids = new Set();
  for (const edital of Array.isArray(catalog) ? catalog : []) {
    if (isId(edital?.id)) ids.add(edital.id);
  }
  for (const discipline of listDisciplines(catalog)) {
    if (isId(discipline.id)) ids.add(discipline.id);
    for (const entity of Object.keys(ENTITY_COLLECTIONS)) {
      for (const { item } of listEntityLocations(
        [
          {
            disciplinas: [discipline],
          },
        ],
        entity,
      )) {
        if (isId(item.id)) ids.add(item.id);
      }
    }
  }
  return ids;
}

function normalizeProposal(value, entity) {
  if (typeof value === 'string') {
    return { valid: true, hasId: false, nome: value.trim(), id: null };
  }
  if (!isRecord(value)) return { valid: false, nome: '', id: null, hasId: false };

  const alias = entity === 'assunto' ? 'assId' : 'aulaId';
  const hasGenericId = Object.prototype.hasOwnProperty.call(value, 'id');
  const hasAliasId = Object.prototype.hasOwnProperty.call(value, alias);
  if (hasGenericId && hasAliasId && value.id !== value[alias]) {
    return { valid: false, nome: '', id: null, hasId: true };
  }

  const hasId = hasGenericId || hasAliasId;
  const id = hasGenericId ? value.id : hasAliasId ? value[alias] : null;
  const nome = typeof value.nome === 'string' ? value.nome.trim() : '';
  if (hasId && !isId(id)) return { valid: false, nome, id, hasId: true };
  if (!hasId && !nome) return { valid: false, nome, id: null, hasId: false };
  return { valid: true, hasId, nome, id };
}

function conflict(code, entity, discId, nome, extra = {}) {
  return {
    code,
    entity,
    discId: isId(discId) ? discId : null,
    ...(nome ? { nome } : {}),
    ...extra,
  };
}

function addConflict(conflicts, item) {
  const signature = [
    item.code,
    item.entity,
    item.discId,
    normalizeNameKey(item.nome || ''),
    (item.candidateIds || []).join('|'),
  ].join(':');
  if (!conflicts.some((current) => current._signature === signature)) {
    conflicts.push({ ...item, _signature: signature });
  }
}

function uniqueDiscipline(catalog, discId) {
  if (!isId(discId)) return null;
  const matches = listDisciplines(catalog).filter((discipline) => discipline.id === discId);
  return matches.length === 1 ? matches[0] : null;
}

function resolveExplicitId(catalog, discipline, discId, entity, proposal) {
  const locations = listEntityLocations(catalog, entity).filter(
    ({ item }) => item.id === proposal.id,
  );
  if (locations.length !== 1 || locations[0].discipline.id !== discId) {
    return {
      ok: false,
      conflict: conflict(
        locations.length > 1 ? 'REFERENCIA_AMBIGUA' : 'REFERENCIA_INVALIDA',
        entity,
        discId,
        proposal.nome,
        {
          candidateIds: locations
            .map(({ item }) => item.id)
            .filter(isId)
            .sort(),
        },
      ),
    };
  }
  if (locations[0].discipline !== discipline) {
    return {
      ok: false,
      conflict: conflict('REFERENCIA_INVALIDA', entity, discId, proposal.nome),
    };
  }
  return { ok: true, id: proposal.id };
}

function resolveByName(discipline, discId, entity, proposal) {
  const collection = ENTITY_COLLECTIONS[entity];
  const key = normalizeNameKey(proposal.nome);
  if (!key) {
    return {
      ok: false,
      conflict: conflict('CONTEUDO_INVALIDO', entity, discId, proposal.nome),
    };
  }
  const matches = (Array.isArray(discipline[collection]) ? discipline[collection] : []).filter(
    (item) => normalizeNameKey(item?.nome) === key,
  );
  if (matches.length > 1) {
    return {
      ok: false,
      conflict: conflict('REFERENCIA_AMBIGUA', entity, discId, proposal.nome, {
        candidateIds: matches
          .map((item) => item?.id)
          .filter(isId)
          .sort(),
      }),
    };
  }
  if (matches.length === 1) {
    if (!isId(matches[0]?.id)) {
      return {
        ok: false,
        conflict: conflict('REFERENCIA_INVALIDA', entity, discId, proposal.nome),
      };
    }
    return { ok: true, id: matches[0].id };
  }
  return { ok: true, id: null, key };
}

function addRef(refs, seenRefs, entity, id) {
  const key = entity + ':' + id;
  if (seenRefs.has(key)) return;
  seenRefs.add(key);
  refs.push(entity === 'assunto' ? { assId: id, aulaId: null } : { assId: null, aulaId: id });
}

/**
 * Resolves proposed academic references inside one explicit discipline.
 *
 * Inputs in assuntos/aulas may be a name string or { id?, nome }; assId and
 * aulaId are accepted as aliases for id. IDs are authoritative. A missing
 * name match reserves an ID and returns a draft-only create intent shaped as
 * { entity, id, discId, nome }. Pass those intents as command context
 * catalogIntents when validating PATCH/CREATE; the command validator still
 * requires an exact ID, entity, and discipline match.
 *
 * refs is directly usable as the Task 3 topicos array. The function never
 * mutates catalog or the proposal. Repeating normalized names is deduplicated.
 */
export function resolveRetaFinalCatalog(
  catalog,
  { discId, assuntos = [], aulas = [], makeId } = {},
) {
  const refs = [];
  const createIntents = [];
  const conflicts = [];
  const discipline = uniqueDiscipline(catalog, discId);

  if (!discipline) {
    return {
      refs,
      createIntents,
      conflicts: [conflict('DISCIPLINA_INVALIDA', 'disciplina', discId)],
    };
  }

  const usedCatalogIds = allCatalogIds(catalog);
  const reservedIds = new Set();
  const seenRefs = new Set();
  const seenProposals = new Set();

  const processEntity = (values, entity) => {
    if (!Array.isArray(values)) {
      addConflict(conflicts, conflict('CONTEUDO_INVALIDO', entity, discId));
      return;
    }
    for (const value of values) {
      const proposal = normalizeProposal(value, entity);
      if (!proposal.valid) {
        addConflict(conflicts, conflict('CONTEUDO_INVALIDO', entity, discId, proposal.nome));
        continue;
      }

      const dedupeKey = proposal.hasId
        ? entity + ':id:' + proposal.id
        : entity + ':name:' + normalizeNameKey(proposal.nome);
      if (seenProposals.has(dedupeKey)) continue;
      seenProposals.add(dedupeKey);

      const resolved = proposal.hasId
        ? resolveExplicitId(catalog, discipline, discId, entity, proposal)
        : resolveByName(discipline, discId, entity, proposal);
      if (!resolved.ok) {
        addConflict(conflicts, resolved.conflict);
        continue;
      }

      let id = resolved.id;
      if (!id) {
        if (typeof makeId !== 'function') {
          addConflict(conflicts, conflict('ID_INVALIDO', entity, discId, proposal.nome));
          continue;
        }
        try {
          id = makeId(entity, discId, resolved.key);
        } catch {
          id = null;
        }
        if (!isId(id) || usedCatalogIds.has(id) || reservedIds.has(id)) {
          addConflict(conflicts, conflict('ID_INDISPONIVEL', entity, discId, proposal.nome));
          continue;
        }
        reservedIds.add(id);
        createIntents.push({ entity, id, discId, nome: proposal.nome });
      }
      addRef(refs, seenRefs, entity, id);
    }
  };

  processEntity(assuntos, 'assunto');
  processEntity(aulas, 'aula');

  return {
    refs,
    createIntents,
    conflicts: conflicts.map(({ _signature, ...item }) => item),
  };
}
