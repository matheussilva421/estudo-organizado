export function computeEntityChecksum(entity) {
  if (!entity) return '';
  const clone = { ...entity };
  delete clone._sync;
  return JSON.stringify(clone);
}

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
    config: { entityTombstones: [] },
  };

  for (const doc of newest) {
    if (doc.deletedAt || doc.payload === null) {
      state.config.entityTombstones.push({
        key: doc.key,
        collection: doc.collection,
        id: doc.id,
        deletedAt: doc.deletedAt,
        deletedBy: doc.updatedBy,
        revision: doc.revision,
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

  for (const doc of newest.filter(
    (item) => ['assuntos', 'aulas'].includes(item.collection) && item.payload
  )) {
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
      ...(rebuilt.config || {}),
    },
    planejamento: {
      ...(baseState.planejamento || {}),
      ...(rebuilt.planejamento || {}),
    },
  };
}

export function mergeEntityDocsIntoState(baseState = {}, docs = []) {
  const state = JSON.parse(JSON.stringify(baseState));
  const newest = pickNewestEntityDocs(docs);
  const collisions = [];
  const tombstones = state.config?.entityTombstones || [];
  const tombstoneKeys = new Map(tombstones.map((t) => [t.key, t]));

  function getLocalEntity(doc) {
    const { collection, id, key } = doc;
    if (collection === 'editais') return (state.editais || []).find((e) => e.id === id);
    if (collection === 'eventos') return (state.eventos || []).find((e) => e.id === id);
    if (collection === 'arquivo') return (state.arquivo || []).find((e) => e.id === id);
    if (collection === 'revisoes') return (state.revisoes || []).find((e) => e.id === id);
    if (collection.startsWith('habitos.')) {
      const type = collection.split('.')[1];
      return (state.habitos?.[type] || []).find((e) => e.id === id);
    }
    if (collection === 'planejamento.sequencia') {
      return (state.planejamento?.sequencia || []).find((e) => e.id === id);
    }
    if (collection === 'disciplinas') {
      const editalId = key.split('/')[1];
      const edital = (state.editais || []).find((e) => e.id === editalId);
      return (edital?.disciplinas || []).find((d) => d.id === id);
    }
    if (collection === 'assuntos' || collection === 'aulas') {
      const segments = key.split('/');
      const edital = (state.editais || []).find((e) => e.id === segments[1]);
      const disciplina = (edital?.disciplinas || []).find((d) => d.id === segments[3]);
      return (disciplina?.[collection] || []).find((a) => a.id === id);
    }
    return null;
  }

  function classifyCollision(local, remoteDoc) {
    const localRev = local?._sync?.revision || 0;
    const remoteRev = remoteDoc?.payload?._sync?.revision || remoteDoc?.revision || 0;
    const isRemoteDelete = remoteDoc.deletedAt || remoteDoc.payload === null;

    if (isRemoteDelete && remoteRev > localRev) return 'remote-delete';
    if (isRemoteDelete) return 'local-delete';

    if (!local) return 'remote-newer';

    const localChecksum = local._sync?.checksum || computeEntityChecksum(local);
    const remoteChecksum =
      remoteDoc.payload?._sync?.checksum || computeEntityChecksum(remoteDoc.payload);

    if (localChecksum === remoteChecksum) return 'same-checksum';

    if (remoteRev > localRev) return 'remote-newer';
    if (localRev > remoteRev) return 'local-newer';
    if (localRev === remoteRev && localChecksum !== remoteChecksum)
      return 'same-revision-different-checksum';
    return 'both-changed';
  }

  function entitiesDiffer(local, remote) {
    if (!local || !remote) return true;
    const localChecksum = local._sync?.checksum || computeEntityChecksum(local);
    const remoteChecksum = remote._sync?.checksum || computeEntityChecksum(remote);
    if (localChecksum === remoteChecksum) return false;
    return true;
  }

  function upsertEntity(doc) {
    const { collection, id, key, payload } = doc;
    if (!payload) return;

    if (collection === 'editais') {
      if (!Array.isArray(state.editais)) state.editais = [];
      const idx = state.editais.findIndex((e) => e.id === id);
      if (idx === -1) state.editais.push({ ...payload, disciplinas: [] });
      else
        state.editais[idx] = {
          ...payload,
          disciplinas: state.editais[idx].disciplinas || [],
        };
      return;
    }

    if (collection === 'eventos' || collection === 'arquivo' || collection === 'revisoes') {
      if (!Array.isArray(state[collection])) state[collection] = [];
      const idx = state[collection].findIndex((e) => e.id === id);
      if (idx === -1) state[collection].push(payload);
      else state[collection][idx] = payload;
      return;
    }

    if (collection.startsWith('habitos.')) {
      const type = collection.split('.')[1];
      if (!state.habitos) state.habitos = {};
      if (!Array.isArray(state.habitos[type])) state.habitos[type] = [];
      const idx = state.habitos[type].findIndex((e) => e.id === id);
      if (idx === -1) state.habitos[type].push(payload);
      else state.habitos[type][idx] = payload;
      return;
    }

    if (collection === 'planejamento.sequencia') {
      if (!state.planejamento) state.planejamento = {};
      if (!Array.isArray(state.planejamento.sequencia)) state.planejamento.sequencia = [];
      const idx = state.planejamento.sequencia.findIndex((e) => e.id === id);
      if (idx === -1) state.planejamento.sequencia.push(payload);
      else state.planejamento.sequencia[idx] = payload;
      return;
    }

    if (collection === 'disciplinas') {
      const editalId = key.split('/')[1];
      const edital = (state.editais || []).find((e) => e.id === editalId);
      if (!edital) return;
      if (!Array.isArray(edital.disciplinas)) edital.disciplinas = [];
      const idx = edital.disciplinas.findIndex((d) => d.id === id);
      if (idx === -1) edital.disciplinas.push({ ...payload, assuntos: [], aulas: [] });
      else
        edital.disciplinas[idx] = {
          ...payload,
          assuntos: edital.disciplinas[idx].assuntos || [],
          aulas: edital.disciplinas[idx].aulas || [],
        };
      return;
    }

    if (collection === 'assuntos' || collection === 'aulas') {
      const segments = key.split('/');
      const edital = (state.editais || []).find((e) => e.id === segments[1]);
      if (!edital) return;
      const disciplina = (edital.disciplinas || []).find((d) => d.id === segments[3]);
      if (!disciplina) return;
      if (!Array.isArray(disciplina[collection])) disciplina[collection] = [];
      const idx = disciplina[collection].findIndex((a) => a.id === id);
      if (idx === -1) disciplina[collection].push(payload);
      else disciplina[collection][idx] = payload;
      return;
    }
  }

  function applyTombstone(tombstone) {
    const { collection, id, key } = tombstone;
    if (collection === 'editais') {
      state.editais = (state.editais || []).filter((e) => e.id !== id);
      return;
    }
    if (collection === 'eventos' || collection === 'arquivo' || collection === 'revisoes') {
      state[collection] = (state[collection] || []).filter((e) => e.id !== id);
      return;
    }
    if (collection.startsWith('habitos.')) {
      const type = collection.split('.')[1];
      if (state.habitos?.[type]) {
        state.habitos[type] = state.habitos[type].filter((e) => e.id !== id);
      }
      return;
    }
    if (collection === 'planejamento.sequencia') {
      if (state.planejamento?.sequencia) {
        state.planejamento.sequencia = state.planejamento.sequencia.filter((e) => e.id !== id);
      }
      return;
    }
    if (collection === 'disciplinas') {
      const editalId = key.split('/')[1];
      const edital = (state.editais || []).find((e) => e.id === editalId);
      if (edital) edital.disciplinas = (edital.disciplinas || []).filter((d) => d.id !== id);
      return;
    }
    if (collection === 'assuntos' || collection === 'aulas') {
      const segments = key.split('/');
      const edital = (state.editais || []).find((e) => e.id === segments[1]);
      if (!edital) return;
      const disciplina = (edital.disciplinas || []).find((d) => d.id === segments[3]);
      if (disciplina)
        disciplina[collection] = (disciplina[collection] || []).filter((a) => a.id !== id);
    }
  }

  for (const doc of newest) {
    if (doc.deletedAt || doc.payload === null) {
      const existingTombstone = tombstoneKeys.get(doc.key);
      if (existingTombstone && existingTombstone.revision >= doc.revision) continue;
      applyTombstone(doc);
      const newTombstone = {
        key: doc.key,
        collection: doc.collection,
        id: doc.id,
        deletedAt: doc.deletedAt,
        deletedBy: doc.updatedBy,
        revision: doc.revision,
      };
      if (existingTombstone) {
        Object.assign(existingTombstone, newTombstone);
      } else {
        tombstones.push(newTombstone);
        tombstoneKeys.set(doc.key, newTombstone);
      }
      continue;
    }

    const local = getLocalEntity(doc);
    if (local && entitiesDiffer(local, doc.payload)) {
      const localRev = local._sync?.revision || 0;
      const remoteRev = doc.payload._sync?.revision || 0;
      const hint = classifyCollision(local, doc);
      if (hint === 'same-checksum') continue;
      if (
        hint === 'both-changed' ||
        hint === 'same-revision-different-checksum' ||
        (localRev > 0 && remoteRev > 0 && localRev !== remoteRev)
      ) {
        collisions.push({
          key: doc.key,
          collection: doc.collection,
          id: doc.id,
          localRevision: localRev,
          remoteRevision: remoteRev,
          localUpdatedAt: local._sync?.updatedAt || null,
          remoteUpdatedAt: doc.payload._sync?.updatedAt || doc.updatedAt || null,
          hint,
        });
        continue;
      }
    }

    upsertEntity(doc);
  }

  if (!state.config) state.config = {};
  state.config.entityTombstones = tombstones;

  return { mergedState: state, collisions };
}

export function replaceEntityInStateByRecord(targetState = {}, record = {}) {
  if (!record || !record.entity || !record.collection || !record.id) return false;
  const { collection, id, key, entity } = record;

  if (collection === 'editais') {
    const index = (targetState.editais || []).findIndex((item) => item.id === id);
    if (index === -1) return false;
    targetState.editais[index] = entity;
    return true;
  }

  if (collection === 'eventos' || collection === 'arquivo' || collection === 'revisoes') {
    const list = targetState[collection];
    if (!Array.isArray(list)) return false;
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) return false;
    list[index] = entity;
    return true;
  }

  if (collection.startsWith('habitos.')) {
    const type = collection.replace('habitos.', '');
    const list = targetState.habitos?.[type];
    if (!Array.isArray(list)) return false;
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) return false;
    list[index] = entity;
    return true;
  }

  if (collection === 'planejamento.sequencia') {
    const list = targetState.planejamento?.sequencia;
    if (!Array.isArray(list)) return false;
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) return false;
    list[index] = entity;
    return true;
  }

  const segments = String(key || '').split('/');
  const edital = (targetState.editais || []).find((item) => item.id === segments[1]);
  if (!edital) return false;

  if (collection === 'disciplinas') {
    const list = edital.disciplinas || [];
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) return false;
    list[index] = entity;
    return true;
  }

  if (collection === 'assuntos' || collection === 'aulas') {
    const disciplina = (edital.disciplinas || []).find((item) => item.id === segments[3]);
    if (!disciplina) return false;
    const listName = collection === 'assuntos' ? 'assuntos' : 'aulas';
    const list = disciplina[listName] || [];
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) return false;
    list[index] = entity;
    return true;
  }

  return false;
}
