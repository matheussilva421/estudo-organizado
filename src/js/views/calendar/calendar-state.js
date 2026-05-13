/**
 * Calendar State Module
 * Manages selected month/week/day state for the calendar view.
 */
import { state } from '../../store.js?v=8.37';
import { todayStr } from '../../utils.js?v=8.37';
import { renderCurrentView } from '../../components.js?v=8.37';

// ── Module-level state ──
let calDate = new Date();
let calViewMode = 'mes';
let selectedDayStr = todayStr();

// ── State getters/setters ──
export function getCalDate() {
  return calDate;
}

export function getCalViewMode() {
  return calViewMode;
}

export function getSelectedDayStr() {
  return selectedDayStr;
}

export function setCalDate(d) {
  calDate = d;
}

export function setCalViewMode(mode) {
  calViewMode = mode;
  renderCurrentView();
}

export function setSelectedCalendarDay(dateStr) {
  selectedDayStr = dateStr || todayStr();
  renderCurrentView();
}

// ── Mobile detection ──
export function isMobileCalendar() {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

// ── Calendar header update ──
export function updateCalendarHeader() {
  const title = document.getElementById('cal-title');
  if (title) {
    const monthName = calDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    title.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  }
  const todayBtn = document.getElementById('cal-today-btn');
  if (todayBtn) {
    const today = todayStr();
    const current = calDate.toISOString().split('T')[0];
    const isCurrentMonth = today.slice(0, 7) === current.slice(0, 7);
    if (todayBtn.classList.contains('cal-view-btn')) {
      todayBtn.classList.toggle('active', isCurrentMonth);
    }
  }
}

// ── Navigation: reset to today ──
export function resetCalDate() {
  calDate = new Date();
  renderCurrentView();
}
