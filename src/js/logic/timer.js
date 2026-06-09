import { scheduleSave, state } from '../store.js?v=8.37';
import { formatTime } from '../utils.js?v=8.37';

// =============================================
// TIMER ENGINE
// =============================================

/**
 * Mapa de intervals ativos por eventId
 * @type {Object.<string, number>}
 */
export const timerIntervals = {}; // eventId → intervalId

/**
 * Flag de modo Pomodoro
 * @type {boolean}
 */
export let _pomodoroMode = false;

// Restore pomodoro mode after IndexedDB state is loaded (event fired from app.js init)
document.addEventListener('app:stateLoaded', () => {
  if (state?.config?.pomodoroMode) _pomodoroMode = true;
});

export const _pomodoroAlarm = new Audio(
  'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'
);

/**
 * Verifica se timer está ativo
 * @param {string} eventId - ID do evento ou 'crono_livre'
 * @returns {boolean} True se timer estiver rodando
 */
export function isTimerActive(eventId) {
  if (eventId === 'crono_livre') return !!(state.cronoLivre && state.cronoLivre._timerStart);
  const ev = state.eventos.find((e) => e.id === eventId);
  return !!(ev && ev._timerStart);
}

/**
 * Calcula tempo decorrido em segundos
 * @param {Object} ev - Evento ou cronoLivre
 * @returns {number} Segundos decorridos
 */
export function getElapsedSeconds(ev) {
  const base = ev.tempoAcumulado || 0;
  if (!ev._timerStart) return base;
  return base + Math.floor((Date.now() - ev._timerStart) / 1000);
}

/**
 * Alterna entre modo Pomodoro e Contínuo
 */
export function toggleTimerMode() {
  _pomodoroMode = !_pomodoroMode;
  // Persist pomodoro preference
  if (state?.config) {
    state.config.pomodoroMode = _pomodoroMode;
    scheduleSave();
  }
  const foco = state?.config?.pomodoroFoco || 25;
  const pausa = state?.config?.pomodoroPausa || 5;
  // Update cronômetro view button (only exists when view is active)
  const cronoBtn = document.getElementById('crono-mode-btn');
  if (cronoBtn) {
    cronoBtn.innerHTML = _pomodoroMode ? `🍅 Pomodoro (${foco}/${pausa})` : '⏱ Modo Contínuo';
    cronoBtn.classList.toggle('timer-mode-pill--pomodoro', _pomodoroMode);
  }
  // Update topbar button
  const topBtn = document.getElementById('timer-mode-btn');
  if (topBtn) {
    topBtn.innerHTML = _pomodoroMode
      ? '<i class="fa fa-clock"></i> Pomodoro'
      : '<i class="fa fa-clock"></i> Contínuo';
  }
  document.dispatchEvent(
    new CustomEvent('app:showToast', {
      detail: {
        msg: _pomodoroMode ? 'Modo Pomodoro ativado.' : 'Modo Contínuo ativado.',
        type: 'info',
      },
    })
  );
}

// GUI Hooks for Crono Livre Customization
export function setCronoLivreGoal(minutes) {
  if (!state.cronoLivre) state.cronoLivre = { _timerStart: null, tempoAcumulado: 0 };
  state.cronoLivre.duracaoMinutos = parseInt(minutes, 10) || 0;
  scheduleSave();
  document.dispatchEvent(new Event('app:renderCurrentView'));
}

export function setCronoLivreDisc(discId) {
  if (!state.cronoLivre) state.cronoLivre = { _timerStart: null, tempoAcumulado: 0 };
  state.cronoLivre.discId = discId;
  state.cronoLivre.assId = null; // reset assunto
  scheduleSave();
  document.dispatchEvent(new Event('app:renderCurrentView'));
}

export function setCronoLivreAss(assId) {
  if (!state.cronoLivre) state.cronoLivre = { _timerStart: null, tempoAcumulado: 0 };
  state.cronoLivre.assId = assId;
  scheduleSave();
  document.dispatchEvent(new Event('app:renderCurrentView'));
}

export function reattachTimers() {
  Object.keys(timerIntervals).forEach((id) => {
    clearInterval(timerIntervals[id]);
    delete timerIntervals[id];
  });

  const allTimers = [];
  if (state.cronoLivre && state.cronoLivre._timerStart) {
    allTimers.push({ id: 'crono_livre', ev: state.cronoLivre });
  }
  state.eventos.forEach((e) => {
    if (e._timerStart) allTimers.push({ id: e.id, ev: e });
  });

  allTimers.forEach(({ id, ev }) => {
    let _cachedNodes = null;
    timerIntervals[id] = setInterval(() => {
      const elapsed = getElapsedSeconds(ev);

      // POMODORO CHECK
      if (_pomodoroMode && ev._timerStart) {
        const sessionSeconds = Math.floor((Date.now() - ev._timerStart) / 1000);
        const focoTargetSecs = (state?.config?.pomodoroFoco || 25) * 60;
        const pausaTargetMins = state?.config?.pomodoroPausa || 5;
        if (sessionSeconds >= focoTargetSecs) {
          _pomodoroAlarm.play().catch((e) => console.warn('Audio error:', e));
          toggleTimer(id); // Auto-pause
          document.dispatchEvent(
            new CustomEvent('app:showToast', {
              detail: {
                msg: `Pomodoro concluído! Descanse ${pausaTargetMins} minutos.`,
                type: 'success',
              },
            })
          );
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Pomodoro Concluído! 🍅', {
              body: `Descanse ${pausaTargetMins} minutos.`,
              icon: 'favicon.ico',
            });
          }
          return; // Stop current interval frame
        }
      }

      if (!_cachedNodes || _cachedNodes.length === 0 || !document.body.contains(_cachedNodes[0])) {
        _cachedNodes = document.querySelectorAll(`[data-timer="${id}"]`);
      }
      _cachedNodes.forEach((el) => {
        el.textContent = formatTime(elapsed);
      });
    }, 1000);
  });
}

// Otimizado: adiciona apenas um timer específico sem recriar todos
export function startTimerForEvent(eventId) {
  const ev =
    eventId === 'crono_livre' ? state.cronoLivre : state.eventos.find((e) => e.id === eventId);
  if (!ev || !ev._timerStart) return;

  // Clear existing interval for this specific timer only
  if (timerIntervals[eventId]) {
    clearInterval(timerIntervals[eventId]);
    delete timerIntervals[eventId];
  }

  let _cachedNodes = null;
  timerIntervals[eventId] = setInterval(() => {
    const elapsed = getElapsedSeconds(ev);

    // POMODORO CHECK
    if (_pomodoroMode && ev._timerStart) {
      const sessionSeconds = Math.floor((Date.now() - ev._timerStart) / 1000);
      const focoTargetSecs = (state?.config?.pomodoroFoco || 25) * 60;
      const pausaTargetMins = state?.config?.pomodoroPausa || 5;
      if (sessionSeconds >= focoTargetSecs) {
        _pomodoroAlarm.play().catch((e) => console.warn('Audio error:', e));
        toggleTimer(eventId); // Auto-pause
        document.dispatchEvent(
          new CustomEvent('app:showToast', {
            detail: {
              msg: `Pomodoro concluído! Descanse ${pausaTargetMins} minutos.`,
              type: 'success',
            },
          })
        );
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Pomodoro Concluído! 🍅', {
            body: `Descanse ${pausaTargetMins} minutos.`,
            icon: 'favicon.ico',
          });
        }
        return;
      }
    }

    if (!_cachedNodes || _cachedNodes.length === 0 || !document.body.contains(_cachedNodes[0])) {
      _cachedNodes = document.querySelectorAll(`[data-timer="${eventId}"]`);
    }
    _cachedNodes.forEach((el) => {
      el.textContent = formatTime(elapsed);
    });
  }, 1000);
}

export function addTimerMinutes(eventId, minutes) {
  const ev =
    eventId === 'crono_livre' ? state.cronoLivre : state.eventos.find((e) => e.id === eventId);
  if (!ev) return;
  if (eventId === 'crono_livre') {
    ev.duracaoMinutos = Math.max(0, (ev.duracaoMinutos || 0) + minutes);
  } else {
    ev.duracao = Math.max(0, (ev.duracao || 0) + minutes);
  }
  scheduleSave();
  document.dispatchEvent(
    new CustomEvent('app:showToast', {
      detail: { msg: `+${minutes} minuto(s) adicionado(s) à meta`, type: 'info' },
    })
  );
  document.dispatchEvent(new Event('app:renderCurrentView'));
}

export function toggleTimer(eventId) {
  const ev =
    eventId === 'crono_livre' ? state.cronoLivre : state.eventos.find((e) => e.id === eventId);
  if (!ev) return;
  if (ev._timerStart) {
    // PAUSE
    ev.tempoAcumulado = getElapsedSeconds(ev);
    ev._timerStart = null;
    if (timerIntervals[eventId]) {
      clearInterval(timerIntervals[eventId]);
      delete timerIntervals[eventId];
    }
  } else {
    // START
    ev._timerStart = Date.now();
    startTimerForEvent(eventId); // Otimizado: cria apenas este timer, não recria todos
  }
  scheduleSave();
  document.dispatchEvent(new CustomEvent('app:refreshEventCard', { detail: { eventId } }));
  document.dispatchEvent(new Event('app:updateBadges'));
}

export function discardTimer(eventId) {
  const ev =
    eventId === 'crono_livre' ? state.cronoLivre : state.eventos.find((e) => e.id === eventId);
  if (!ev) return;
  document.dispatchEvent(
    new CustomEvent('app:showConfirm', {
      detail: {
        msg: 'Descartar esta sessão? O tempo de estudo será zerado.',
        onYes: () => {
          if (timerIntervals[eventId]) {
            clearInterval(timerIntervals[eventId]);
            delete timerIntervals[eventId];
          }
          ev.tempoAcumulado = 0;
          ev._timerStart = null;
          scheduleSave();
          document.dispatchEvent(new Event('app:renderCurrentView'));
        },
        opts: { title: 'Descartar Sessão', label: 'Descartar', danger: true },
      },
    })
  );
}
