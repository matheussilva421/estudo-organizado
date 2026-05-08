// =============================================
// UI STATE (per-device, localStorage-backed)
// =============================================
// Estado de UI (filtros, abas ativas, toggles de visualização) que NÃO deve
// sincronizar entre dispositivos. Substitui variáveis de módulo espalhadas
// como `_activeEditalId`, `_hideConcluidosCiclo`, filtros do verticalizado etc.

const STORAGE_KEY = 'estudo_ui_state';

const DEFAULT_UI_STATE = {
  home: { activeEditalId: null },
  ciclo: { hideConcluidos: false },
  verticalizado: { filtroStatus: 'todos', filtroEdital: '', busca: '' },
  historico: { rangeDays: 'all', disciplinaId: '', busca: '' },
  habitos: { showStreak: true },
  editais: { collapsed: {} },
};

let _cache = null;

function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeRaw(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (err) {
    console.warn('[ui-state] persist failed:', err);
  }
}

function loadCache() {
  if (_cache) return _cache;
  const stored = readRaw() || {};
  _cache = {};
  for (const key of Object.keys(DEFAULT_UI_STATE)) {
    _cache[key] = { ...DEFAULT_UI_STATE[key], ...(stored[key] || {}) };
  }
  return _cache;
}

/**
 * Lê uma seção inteira do estado de UI.
 * @param {keyof DEFAULT_UI_STATE} section
 */
export function getUiSection(section) {
  const cache = loadCache();
  if (!cache[section]) cache[section] = { ...(DEFAULT_UI_STATE[section] || {}) };
  return cache[section];
}

/**
 * Atualiza (merge) uma seção e persiste.
 * @param {keyof DEFAULT_UI_STATE} section
 * @param {Object} patch
 */
export function setUiSection(section, patch) {
  const cache = loadCache();
  cache[section] = { ...(cache[section] || {}), ...patch };
  writeRaw(cache);
  return cache[section];
}

/**
 * Reset total — útil para testes / "limpar dados".
 */
export function resetUiState() {
  _cache = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
