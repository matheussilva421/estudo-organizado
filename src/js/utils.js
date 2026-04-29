// =============================================
// HELPERS & UTILITIES (Pure Functions)
// =============================================

/**
 * Gera identificador único baseado em timestamp + random
 * @returns {string} ID único
 */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * Escape de HTML para prevenir XSS
 * @param {string|number} str - String para escapar
 * @returns {string} String escaped
 */
export function esc(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Retorna data local no formato YYYY-MM-DD
 * @param {Date} [dateObj=new Date()] - Data opcional
 * @returns {string} Data no formato ISO date
 */
export function getLocalDateStr(dateObj = new Date()) {
  const d = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000);
  return d.toISOString().split('T')[0];
}

export let _todayCache = null;
let _todayCacheTime = 0;

/**
 * Invalida cache da função todayStr
 */
export function invalidateTodayCache() {
  _todayCache = null;
}

/**
 * Retorna data de hoje em formato YYYY-MM-DD com cache
 * @returns {string} Data de hoje
 */
export function todayStr() {
  const now = Date.now();
  // Invalidate cache every 60 seconds (60000ms) to ensure midnight rollovers are caught
  if (!_todayCache || now - _todayCacheTime > 60000) {
    _todayCache = getLocalDateStr();
    _todayCacheTime = now;
  }
  return _todayCache;
}

/**
 * Formata data ISO para formato locale pt-BR
 * @param {string} str - Data no formato YYYY-MM-DD
 * @returns {string} Data formatada
 */
export function formatDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * Formata segundos para HH:MM:SS ou MM:SS
 * @param {number} seconds - Segundos totais
 * @returns {string} Tempo formatado
 */
export function formatTime(seconds) {
  seconds = Math.floor(seconds || 0);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Formata minutos para formato legível (1h30m, 45m, etc)
 * @param {number} minutes - Minutos totais
 * @returns {string} Tempo formatado
 */
export function formatH(minutes) {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ''}`;
  return `${m}m`;
}

/**
 * Trunca string para tamanho máximo com ellipsis
 * @param {any} value - Valor para truncar
 * @param {number} [max=80] - Tamanho máximo
 * @returns {string} String truncada
 */
export function trunc(value, max = 80) {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 3))}...`;
}

/**
 * Determina status de um evento baseado na data e status
 * @param {Object} evento - Objeto do evento
 * @returns {'estudei'|'agendado'|'atrasado'} Status do evento
 */
export function getEventStatus(evento) {
  const today = todayStr();
  if (evento.status === 'estudei') return 'estudei';
  if (!evento.data || evento.data > today) return 'agendado';
  if (evento.data < today) return 'atrasado';
  return 'agendado';
}

/**
 * Retorna data de X dias atrás no formato YYYY-MM-DD
 * @param {number} days - Dias para subtrair
 * @returns {string} Data calculada
 */
export function cutoffDateStr(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return getLocalDateStr(d);
}

export const HABIT_TYPES = [
  { key: 'questoes', label: 'Questões', icon: '📝', color: '#8aa4bf' },
  { key: 'revisao', label: 'Revisão', icon: '🔄', color: '#7dd3a8' },
  { key: 'discursiva', label: 'Discursiva', icon: '✍️', color: '#d8a657' },
  { key: 'simulado', label: 'Simulado', icon: '🎯', color: '#ef7777' },
  { key: 'leitura', label: 'Leitura Seca', icon: '📖', color: '#a7a4d6' },
  { key: 'informativo', label: 'Informativos', icon: '📰', color: '#7fb7c7' },
  { key: 'sumula', label: 'Súmulas', icon: '⚖️', color: '#8e9fd0' },
  { key: 'videoaula', label: 'Videoaula', icon: '📺', color: '#d58c9d' },
  { key: 'paginas', label: 'Páginas Lidas', icon: '🧾', color: '#79b8ad' },
];

/**
 * Retorna tipo de hábito pela chave
 * @param {string} key - Chave do tipo de hábito
 * @returns {{key: string, label: string, icon: string, color: string}|undefined} Tipo de hábito
 */
export function getHabitType(key) {
  return HABIT_TYPES.find((h) => h.key === key);
}

// =============================================
// CLEANUP REGISTRY PARA EVENT LISTENERS
// =============================================

/**
 * Registry centralizado de listeners para cleanup no unload
 * Previne memory leaks de listeners adicionados globalmente
 */
const cleanupRegistry = new Set();

/**
 * Adiciona event listener com cleanup automático no beforeunload
 * @param {EventTarget} target - Elemento ou objeto alvo (window, document, element)
 * @param {string} event - Nome do evento
 * @param {Function} handler - Função handler
 * @param {Object|boolean} [options] - Opções do listener (capture, once, passive)
 */
export function addCleanupListener(target, event, handler, options) {
  target.addEventListener(event, handler, options);
  cleanupRegistry.add({ target, event, handler, options });
}

/**
 * Remove todos os listeners registrados e limpa o registry
 * Deve ser chamado no beforeunload
 */
export function cleanupAllListeners() {
  cleanupRegistry.forEach(({ target, event, handler, options }) => {
    target.removeEventListener(event, handler, options);
  });
  cleanupRegistry.clear();
}

// Registrar cleanup no beforeunload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    cleanupAllListeners();
  });
}
