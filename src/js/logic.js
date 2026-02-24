import { scheduleSave, state } from './store.js';
import { currentView, cutoffDateStr, formatTime, showConfirm, showToast, timerIntervals, todayStr } from './app.js';
import { refreshEventCard, refreshMEDSections, removeDOMCard } from './views.js';
import { getHabitType, renderCurrentView, updateBadges } from './components.js';

// =============================================
// TIMER ENGINE
// =============================================
export let _pomodoroMode = false;
export let _pomodoroAlarm = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

export function isTimerActive(eventId) {
  const ev = state.eventos.find(e => e.id === eventId);
  return !!(ev && ev._timerStart);
}

export function getElapsedSeconds(ev) {
  const base = ev.tempoAcumulado || 0;
  if (!ev._timerStart) return base;
  return base + Math.floor((Date.now() - ev._timerStart) / 1000);
}

export function toggleTimerMode() {
  _pomodoroMode = !_pomodoroMode;
  const btn = document.getElementById('timer-mode-btn');
  if (btn) {
    btn.innerHTML = _pomodoroMode ? '<i class="fa fa-stopwatch"></i> Pomodoro (25/5)' : '<i class="fa fa-clock"></i> Contínuo';
    btn.style.backgroundColor = _pomodoroMode ? 'var(--red)' : '';
    btn.style.color = _pomodoroMode ? '#fff' : '';
  }
  if (typeof showToast === 'function') {
    showToast(_pomodoroMode ? 'Modo Pomodoro ativado.' : 'Modo Contínuo ativado.', 'info');
  }
}

export function reattachTimers() {
  Object.keys(timerIntervals).forEach(id => {
    clearInterval(timerIntervals[id]);
    delete timerIntervals[id];
  });
  state.eventos.forEach(ev => {
    if (!ev._timerStart) return;
    timerIntervals[ev.id] = setInterval(() => {
      const elapsed = getElapsedSeconds(ev);

      // POMODORO CHECK
      if (_pomodoroMode && ev._timerStart) {
        const sessionSeconds = Math.floor((Date.now() - ev._timerStart) / 1000);
        if (sessionSeconds >= 1500) { // 25 minutes
          _pomodoroAlarm.play().catch(e => console.log('Audio error:', e));
          toggleTimer(ev.id); // Auto-pause
          if (typeof showToast === 'function') {
            showToast('Pomodoro concluído! Descanse 5 minutos.', 'success');
          }
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Pomodoro Concluído! 🍅", { body: "Descanse 5 minutos.", icon: 'favicon.ico' });
          }
          return; // Stop current interval frame
        }
      }

      document.querySelectorAll(`[data-timer="${ev.id}"]`).forEach(el => {
        el.textContent = formatTime(elapsed);
      });
    }, 1000);
  });
}

export function addTimerMinutes(eventId, minutes) {
  const ev = state.eventos.find(e => e.id === eventId);
  if (!ev) return;
  ev.tempoAcumulado = (ev.tempoAcumulado || 0) + (minutes * 60);
  scheduleSave();
  if (typeof showToast === 'function') {
    showToast(`+${minutes} minuto(s) adicionado(s)`, 'info');
  }
  renderCurrentView();
}

export function toggleTimer(eventId) {
  const ev = state.eventos.find(e => e.id === eventId);
  if (!ev) return;
  if (ev._timerStart) {
    // PAUSE
    ev.tempoAcumulado = getElapsedSeconds(ev);
    delete ev._timerStart;
  } else {
    // START
    ev._timerStart = Date.now();
  }
  scheduleSave();
  refreshEventCard(eventId);
  updateBadges();
}

export function marcarEstudei(eventId) {
  const ev = state.eventos.find(e => e.id === eventId);
  if (!ev) return;

  if (ev._timerStart) {
    ev.tempoAcumulado = getElapsedSeconds(ev);
    delete ev._timerStart;
  }

  if (timerIntervals[eventId]) { clearInterval(timerIntervals[eventId]); delete timerIntervals[eventId]; }

  ev.status = 'estudei';
  ev.dataEstudo = todayStr();

  if (ev.assId && ev.discId) {
    const d = getDisc(ev.discId);
    if (d) {
      const ass = d.disc.assuntos.find(a => a.id === ev.assId);
      if (ass && !ass.concluido) {
        ass.concluido = true;
        ass.dataConclusao = todayStr();
        ass.revisoesFetas = [];
      }
    }
  }
  scheduleSave();
  refreshMEDSections();

  if (ev.habito) {
    const h = getHabitType(ev.habito);
    //if (h) promptHabitRegistration(ev, h);
  } else {
    showToast('Evento marcado como Estudei! ✅', 'success');
  }
}

export function deleteEvento(eventId) {
  showConfirm('Excluir este evento permanentemente?', () => {
    if (timerIntervals[eventId]) {
      clearInterval(timerIntervals[eventId]);
      delete timerIntervals[eventId];
    }
    state.eventos = state.eventos.filter(e => e.id !== eventId);
    scheduleSave();
    if (currentView === 'med') {
      removeDOMCard(eventId);
    } else {
      renderCurrentView();
    }
  }, { danger: true, label: 'Excluir', title: 'Excluir evento' });
}

export function totalStudySeconds(days = null) {
  const cutoffStr = days ? cutoffDateStr(days) : null;
  return state.eventos
    .filter(e => e.status === 'estudei' && e.tempoAcumulado && (!cutoffStr || e.data >= cutoffStr))
    .reduce((s, e) => s + (e.tempoAcumulado || 0), 0);
}

// =============================================
// REVISIONS
// =============================================
export const _revDateCache = new Map();
export function invalidateRevCache() { _revDateCache.clear(); }

export function calcRevisionDates(dataConclusao, feitas) {
  const freqs = state.config.frequenciaRevisao || [1, 7, 30, 90];
  const cacheKey = `${dataConclusao}: ${feitas.length}: ${freqs.join(',')}`;
  if (_revDateCache.has(cacheKey)) return _revDateCache.get(cacheKey);

  const base = new Date(dataConclusao + 'T00:00:00');
  const dates = freqs.slice(feitas.length).map(d => {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + d);
    return dt.toISOString().split('T')[0];
  });
  _revDateCache.set(cacheKey, dates);
  return dates;
}

export let _pendingRevCache = null;
export function invalidatePendingRevCache() { _pendingRevCache = null; }

export function getPendingRevisoes() {
  if (_pendingRevCache) return _pendingRevCache;
  const today = todayStr();
  const pending = [];
  for (const edital of state.editais) {
    for (const disc of (edital.disciplinas || [])) {
        for (const ass of disc.assuntos) {
          if ((!ass.concluído && !ass.concluido) || !ass.dataConclusao) continue;
          const revDates = calcRevisionDates(ass.dataConclusao, ass.revisoesFetas || []);
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

// =============================================
// DISCIPLINE UTILS
// =============================================
export let _discCache = null;
export let _discIndex = null;
export function invalidateDiscCache() { _discCache = null; _discIndex = null; }

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
