import { state } from '../store.js?v=8.37';

// =============================================
// DISCIPLINE UTILS
// =============================================

export let _discCache = null;
export let _discIndex = null;

export function invalidateDiscCache() {
  _discCache = null;
  _discIndex = null;
}

export function getAllDisciplinas() {
  if (_discCache) return _discCache;
  const result = [];
  _discIndex = new Map();
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue;
    for (const disc of edital.disciplinas) {
      const entry = { disc, edital };
      result.push(entry);
      _discIndex.set(disc.id, entry);
    }
  }
  _discCache = result;
  return result;
}

export function getDisc(id) {
  if (!_discIndex) getAllDisciplinas();
  return _discIndex.get(id) || null;
}
