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
  if (evento.status === 'perdido' || evento.status === 'substituido') return evento.status;
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
  { key: 'questoes', label: 'Questões', icon: '📝', color: 'var(--question)' },
  { key: 'revisao', label: 'Revisão', icon: '🔄', color: 'var(--success)' },
  { key: 'discursiva', label: 'Discursiva', icon: '✍️', color: 'var(--warning)' },
  { key: 'simulado', label: 'Simulado', icon: '🎯', color: 'var(--warning)' },
  { key: 'leitura', label: 'Leitura Seca', icon: '📖', color: 'var(--text-secondary)' },
  { key: 'informativo', label: 'Informativos', icon: '📰', color: 'var(--info)' },
  { key: 'sumula', label: 'Súmulas', icon: '⚖️', color: 'var(--question)' },
  { key: 'videoaula', label: 'Videoaula', icon: '📺', color: 'var(--info)' },
  { key: 'paginas', label: 'Páginas Lidas', icon: '🧾', color: 'var(--text-secondary)' },
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
// SHARED VISUAL HELPERS (Batch 1)
// =============================================

/**
 * Formata delta numérico com seta padronizada (▲ ▼ —).
 * @param {number} value - Variação numérica (positiva, negativa ou zero)
 * @param {Object} [opts]
 * @param {string} [opts.suffix=''] - Sufixo (ex: '%', 'h')
 * @param {number} [opts.fractionDigits=0] - Casas decimais
 * @param {boolean} [opts.html=true] - Se true, retorna HTML com classes; caso contrário texto puro
 * @returns {string}
 */
export function formatDelta(value, opts = {}) {
  const { suffix = '', fractionDigits = 0, html = true } = opts;
  if (value == null || Number.isNaN(value)) {
    return html ? '<span class="delta delta-neutral">—</span>' : '—';
  }
  const num = Number(value);
  const abs = Math.abs(num).toFixed(fractionDigits);
  let arrow;
  let cls;
  if (num > 0) {
    arrow = '▲';
    cls = 'delta-up';
  } else if (num < 0) {
    arrow = '▼';
    cls = 'delta-down';
  } else {
    arrow = '—';
    cls = 'delta-neutral';
  }
  const text = num === 0 ? `${arrow}` : `${arrow} ${abs}${suffix}`;
  return html ? `<span class="delta ${cls}">${text}</span>` : text;
}

/**
 * Normaliza string para busca: lowercase + sem acento + trim.
 * @param {string} str
 * @returns {string}
 */
export function normalizeSearch(str) {
  if (str == null) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Gera SVG inline de sparkline a partir de uma série numérica.
 * @param {number[]} data - Série de valores
 * @param {Object} [opts]
 * @param {number} [opts.width=80]
 * @param {number} [opts.height=24]
 * @param {string} [opts.stroke='currentColor']
 * @param {number} [opts.strokeWidth=1.5]
 * @param {boolean} [opts.fill=false] - Se true, preenche área abaixo da linha
 * @returns {string} SVG markup
 */
export function renderSparkline(data, opts = {}) {
  const { width = 80, height = 24, stroke = 'currentColor', strokeWidth = 1.5, fill = false } = opts;
  const values = Array.isArray(data) ? data : [];
  // null/undefined = semana/dia sem dado → gap na linha (segmentos separados)
  const isNum = (v) => typeof v === 'number' && !Number.isNaN(v);
  const nums = values.filter(isNum);
  if (nums.length === 0) {
    return `<svg class="sparkline sparkline-empty" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"></svg>`;
  }
  const max = Math.max(...nums, 1);
  const min = Math.min(...nums, 0);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const toXY = (v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - strokeWidth) - strokeWidth / 2;
    return [x.toFixed(2), y.toFixed(2)];
  };

  const segments = [];
  let atual = [];
  values.forEach((v, i) => {
    if (isNum(v)) {
      atual.push([v, i]);
    } else if (atual.length) {
      segments.push(atual);
      atual = [];
    }
  });
  if (atual.length) segments.push(atual);

  const parts = segments.map((seg) => {
    if (seg.length === 1) {
      const [x, y] = toXY(seg[0][0], seg[0][1]);
      return `<circle cx="${x}" cy="${y}" r="${strokeWidth}" fill="${stroke}"/>`;
    }
    const points = seg.map(([v, i]) => toXY(v, i).join(',')).join(' ');
    const fillPath = fill
      ? `<polygon points="${seg[0][1] * stepX},${height} ${points} ${seg[seg.length - 1][1] * stepX},${height}" fill="${stroke}" opacity="0.18"/>`
      : '';
    return `${fillPath}<polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
  });

  return `<svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">${parts.join('')}</svg>`;
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
