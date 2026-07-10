// =============================================
// Memoização de computeWeakPoints (o núcleo é puro e não pode importar nada,
// então o cache mora aqui). Uma entrada, chaveada por cutoff+filtros: os dados
// (eventos/arquivo/editais) só mudam via mutações que já disparam
// 'app:invalidateCaches' (mesmo fan-out dos caches do Dashboard), e a virada
// de dia muda o próprio cutoffStr.
// =============================================

import { computeWeakPoints } from './weak-points.js';

let _cacheKey = null;
let _cacheResult = null;

export function computeWeakPointsMemo(args) {
  const key = `${args.cutoffStr ?? ''}|${args.editalFilterId ?? ''}|${args.discFilterId ?? ''}`;
  if (_cacheResult && _cacheKey === key) return _cacheResult;
  _cacheResult = computeWeakPoints(args);
  _cacheKey = key;
  return _cacheResult;
}

export function invalidateWeakPointsMemo() {
  _cacheKey = null;
  _cacheResult = null;
}

if (typeof document !== 'undefined') {
  document.addEventListener('app:invalidateCaches', invalidateWeakPointsMemo);
}
