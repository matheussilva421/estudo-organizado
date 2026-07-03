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

function getDiscName(discId) {
  if (!discId) return 'Disciplina';
  for (const edital of state.editais || []) {
    const disc = (edital.disciplinas || []).find((item) => item.id === discId);
    if (disc) return disc.nome || 'Disciplina';
  }
  return 'Disciplina';
}

function getSlotOverrideTitle(slot) {
  const originalName = getDiscName(slot.originalDiscId);
  if (slot.status === 'substituido') {
    return `${originalName} substituida por ${getDiscName(slot.actualDiscId)}`;
  }
  return `${originalName} perdida`;
}

export function getVisibleSlotOverridesByDate() {
  const byDate = {};
  for (const slot of state.planejamento?.slotOverrides || []) {
    if (!slot?.data) continue;
    if (slot.status !== 'perdido' && slot.status !== 'substituido') continue;
    if (!byDate[slot.data]) byDate[slot.data] = [];
    byDate[slot.data].push({
      id: slot.id || `slot_${slot.data}_${slot.slotIndex}`,
      data: slot.data,
      status: slot.status,
      titulo: getSlotOverrideTitle(slot),
      discId: slot.originalDiscId,
      slotIndex: Number(slot.slotIndex) || 0,
      isSlotOverride: true,
    });
  }
  return byDate;
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
  const slotOverridesByDate = getVisibleSlotOverridesByDate();
  for (const [data, slots] of Object.entries(slotOverridesByDate)) {
    if (!eventsByDate[data]) eventsByDate[data] = [];
    eventsByDate[data].push(...slots);
  }
  return eventsByDate;
}
