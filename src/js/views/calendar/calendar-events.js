/**
 * Calendar Events Module
 * Event indexing, filtering by date, and discipline-color utilities.
 */
import { state } from '../../store.js?v=8.37';
import { filterEventsBySelectedEdital } from '../../edital-filter.js?v=8.37';

// ── Discipline-color memo ──
let _discColorMemo = null;

export function getDiscColor(discId) {
  if (!discId) return '';
  if (!_discColorMemo) {
    _discColorMemo = new Map();
    for (const ed of state.editais || []) {
      for (const d of ed.disciplinas || []) {
        _discColorMemo.set(d.id, d.cor || ed.cor || '');
      }
    }
  }
  return _discColorMemo.get(discId) || '';
}

export function resetDiscColorMemo() {
  _discColorMemo = null;
}

// Reset memo on any state change (cheap; fires on every save)
if (typeof document !== 'undefined') {
  document.addEventListener('app:invalidateCaches', resetDiscColorMemo);
}

// ── Event indexing by date ──
export function indexEventsByDate() {
  const eventsByDate = {};
  for (const e of filterEventsBySelectedEdital(state.eventos || [], { allowAll: false })) {
    if (!eventsByDate[e.data]) eventsByDate[e.data] = [];
    eventsByDate[e.data].push(e);
  }
  return eventsByDate;
}
