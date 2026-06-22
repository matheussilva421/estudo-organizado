import { state } from '../store.js?v=8.37';
import { todayStr, getLocalDateStr } from '../utils.js?v=8.37';

// =============================================
// REVISION DATES & SPACED-REPETITION ENGINE
// =============================================

export const _revDateCache = new Map();
export function invalidateRevCache() {
  _revDateCache.clear();
}

export function calcRevisionDates(dataConclusao, feitas, adiamentos = 0) {
  const freqs = state.config.frequenciaRevisao || [1, 7, 30, 90];
  const cacheKey = `${dataConclusao}:${feitas.length}:${adiamentos}:${freqs.join(',')}`;
  if (_revDateCache.has(cacheKey)) return _revDateCache.get(cacheKey);

  const base = new Date(dataConclusao + 'T00:00:00');
  base.setDate(base.getDate() + adiamentos); // shift the revision schedule by the number of postponed days

  const dates = freqs.slice(feitas.length).map((d) => {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + d);
    return getLocalDateStr(dt);
  });
  _revDateCache.set(cacheKey, dates);
  return dates;
}

export let _pendingRevCache = null;
export function invalidatePendingRevCache() {
  _pendingRevCache = null;
}

export function getPendingRevisoes() {
  if (_pendingRevCache) return _pendingRevCache;
  const today = todayStr();
  const pending = [];
  for (const edital of state.editais) {
    if (edital.arquivado) continue;
    for (const disc of edital.disciplinas || []) {
      if (disc.arquivada) continue;
      for (const ass of disc.assuntos || []) {
        if (!ass.concluido || !ass.dataConclusao) continue;
        const revDates = calcRevisionDates(
          ass.dataConclusao,
          ass.revisoesFetas || [],
          ass.adiamentos || 0
        );
        for (const rd of revDates) {
          if (rd <= today) {
            pending.push({ assunto: ass, disc, edital, data: rd });
            break;
          }
        }
      }
    }
  }
  _pendingRevCache = pending;
  return pending;
}
