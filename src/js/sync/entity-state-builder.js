export function pickNewestEntityDocs(docs = []) {
  const byKey = new Map();
  for (const doc of docs) {
    const current = byKey.get(doc.key);
    if (!current || Number(doc.revision || 0) > Number(current.revision || 0)) {
      byKey.set(doc.key, doc);
    }
  }
  return Array.from(byKey.values());
}

export function rebuildStateFromEntityDocs(docs = []) {
  const newest = pickNewestEntityDocs(docs);
  const state = {
    editais: [],
    eventos: [],
    arquivo: [],
    revisoes: [],
    habitos: {},
    planejamento: { sequencia: [] },
    config: { entityTombstones: [] }
  };

  for (const doc of newest) {
    if (doc.deletedAt || doc.payload === null) {
      state.config.entityTombstones.push({
        key: doc.key,
        collection: doc.collection,
        id: doc.id,
        deletedAt: doc.deletedAt,
        deletedBy: doc.updatedBy,
        revision: doc.revision
      });
      continue;
    }

    if (doc.collection === 'editais') state.editais.push({ ...doc.payload, disciplinas: [] });
    if (doc.collection === 'eventos') state.eventos.push(doc.payload);
    if (doc.collection === 'arquivo') state.arquivo.push(doc.payload);
    if (doc.collection === 'revisoes') state.revisoes.push(doc.payload);
    if (doc.collection.startsWith('habitos.')) {
      const type = doc.collection.split('.')[1];
      if (!state.habitos[type]) state.habitos[type] = [];
      state.habitos[type].push(doc.payload);
    }
    if (doc.collection === 'planejamento.sequencia') state.planejamento.sequencia.push(doc.payload);
  }

  for (const doc of newest.filter((item) => item.collection === 'disciplinas' && item.payload)) {
    const editalId = doc.key.split('/')[1];
    const edital = state.editais.find((item) => item.id === editalId);
    if (edital) edital.disciplinas.push({ ...doc.payload, assuntos: [], aulas: [] });
  }

  for (const doc of newest.filter((item) => ['assuntos', 'aulas'].includes(item.collection) && item.payload)) {
    const segments = doc.key.split('/');
    const edital = state.editais.find((item) => item.id === segments[1]);
    const disciplina = (edital?.disciplinas || []).find((item) => item.id === segments[3]);
    if (!disciplina) continue;
    const target = doc.collection === 'assuntos' ? 'assuntos' : 'aulas';
    disciplina[target].push(doc.payload);
  }

  return state;
}

export function applyEntityDocsToState(baseState = {}, docs = []) {
  const rebuilt = rebuildStateFromEntityDocs(docs);
  const habitos = { ...(baseState.habitos || {}) };
  for (const type of Object.keys(rebuilt.habitos || {})) {
    habitos[type] = rebuilt.habitos[type];
  }
  return {
    ...baseState,
    ...rebuilt,
    habitos,
    config: {
      ...(baseState.config || {}),
      ...(rebuilt.config || {})
    },
    planejamento: {
      ...(baseState.planejamento || {}),
      ...(rebuilt.planejamento || {})
    }
  };
}
