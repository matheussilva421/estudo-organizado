import { scheduleSave, state } from './store.js';
import { cutoffDateStr, formatTime, todayStr, getHabitType } from './utils.js';

// =============================================
// TIMER ENGINE
// =============================================
export let timerIntervals = {};   // eventId → intervalId
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
  document.dispatchEvent(new CustomEvent('app:showToast', { detail: { msg: _pomodoroMode ? 'Modo Pomodoro ativado.' : 'Modo Contínuo ativado.', type: 'info' } }));
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
          document.dispatchEvent(new CustomEvent('app:showToast', { detail: { msg: 'Pomodoro concluído! Descanse 5 minutos.', type: 'success' } }));
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
  document.dispatchEvent(new CustomEvent('app:showToast', { detail: { msg: `+${minutes} minuto(s) adicionado(s)`, type: 'info' } }));
  document.dispatchEvent(new Event('app:renderCurrentView'));
}

export function toggleTimer(eventId) {
  const ev = state.eventos.find(e => e.id === eventId);
  if (!ev) return;
  if (ev._timerStart) {
    // PAUSE
    ev.tempoAcumulado = getElapsedSeconds(ev);
    delete ev._timerStart;
    if (timerIntervals[eventId]) { clearInterval(timerIntervals[eventId]); delete timerIntervals[eventId]; }
  } else {
    // START
    ev._timerStart = Date.now();
    reattachTimers(); // Start the interval immediately so card reflects seconds
  }
  scheduleSave();
  document.dispatchEvent(new CustomEvent('app:refreshEventCard', { detail: { eventId } }));
  document.dispatchEvent(new Event('app:updateBadges'));
}

export function marcarEstudei(eventId) {
  // Open the Registro da Sessão de Estudo modal instead of immediately marking
  if (typeof window.openRegistroSessao === 'function') {
    window.openRegistroSessao(eventId);
    return;
  }
  // Fallback: original behavior if registro module not loaded
  _marcarEstudeiDirect(eventId);
}

export function _marcarEstudeiDirect(eventId) {
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
  document.dispatchEvent(new Event('app:refreshMEDSections'));

  if (ev.habito) {
    const h = getHabitType(ev.habito);
    //if (h) promptHabitRegistration(ev, h);
  } else {
    document.dispatchEvent(new CustomEvent('app:showToast', { detail: { msg: 'Evento marcado como Estudei! ✅', type: 'success' } }));
  }
}

export function deleteEvento(eventId) {
  document.dispatchEvent(new CustomEvent('app:showConfirm', {
    detail: {
      msg: 'Excluir este evento permanentemente?',
      onYes: () => {
        if (timerIntervals[eventId]) {
          clearInterval(timerIntervals[eventId]);
          delete timerIntervals[eventId];
        }
        state.eventos = state.eventos.filter(e => e.id !== eventId);
        scheduleSave();
        document.dispatchEvent(new CustomEvent('app:eventoDeleted', { detail: { eventId } }));
      },
      opts: { danger: true, label: 'Excluir', title: 'Excluir evento' }
    }
  }));
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

export function calcRevisionDates(dataConclusao, feitas, adiamentos = 0) {
  const freqs = state.config.frequenciaRevisao || [1, 7, 30, 90];
  const cacheKey = `${dataConclusao}:${feitas.length}:${adiamentos}:${freqs.join(',')}`;
  if (_revDateCache.has(cacheKey)) return _revDateCache.get(cacheKey);

  const base = new Date(dataConclusao + 'T00:00:00');
  base.setDate(base.getDate() + adiamentos); // shift the revision schedule by the number of postponed days

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
        if (!ass.concluido || !ass.dataConclusao) continue;
        const revDates = calcRevisionDates(ass.dataConclusao, ass.revisoesFetas || [], ass.adiamentos || 0);
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

// =============================================
// DASHBOARD ANALYTICS
// =============================================
export function getPerformanceStats() {
  let questionsTotal = 0;
  let questionsCorrect = 0;
  let questionsWrong = 0;

  state.eventos.forEach(ev => {
    if (ev.status === 'estudei' && ev.sessao && ev.sessao.questoes) {
      questionsTotal += ev.sessao.questoes.total || 0;
      questionsCorrect += ev.sessao.questoes.acertos || 0;
      questionsWrong += ev.sessao.questoes.erros || 0;
    }
  });

  return { questionsTotal, questionsCorrect, questionsWrong };
}

export function getPagesReadStats() {
  let pagesTotal = 0;
  state.eventos.forEach(ev => {
    if (ev.status === 'estudei' && ev.sessao && ev.sessao.paginas && ev.sessao.paginas.total) {
      pagesTotal += ev.sessao.paginas.total;
    }
  });
  return pagesTotal;
}

export function getSyllabusProgress() {
  let totalAssuntos = 0;
  let totalConcluidos = 0;

  state.editais.forEach(ed => {
    ed.disciplinas.forEach(d => {
      totalAssuntos += d.assuntos.length;
      totalConcluidos += d.assuntos.filter(a => a.concluido).length;
    });
  });

  return { totalAssuntos, totalConcluidos };
}

export function getConsistencyStreak() {
  const dates = new Set();
  state.eventos.forEach(ev => {
    if (ev.status === 'estudei' && ev.dataEstudo) {
      dates.add(ev.dataEstudo);
    }
  });

  const todayStrDate = new Date().toISOString().split('T')[0];
  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;

  // Calculate max streak (inefficient but works for small local DB)
  const sortedDates = Array.from(dates).sort();
  if (sortedDates.length > 0) {
    let prev = new Date(sortedDates[0]);
    tempStreak = 1;
    maxStreak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      let curr = new Date(sortedDates[i]);
      let diff = (curr - prev) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        tempStreak++;
        if (tempStreak > maxStreak) maxStreak = tempStreak;
      } else if (diff > 1) {
        tempStreak = 1; // reset
      }
      prev = curr;
    }

    // Current Streak
    let currDay = new Date(todayStrDate);
    while (dates.has(currDay.toISOString().split('T')[0])) {
      currentStreak++;
      currDay.setDate(currDay.getDate() - 1);
    }
  }

  // Generate last 30 days heatmap
  const heatmap = [];
  const startDay = new Date(todayStrDate);
  startDay.setDate(startDay.getDate() - 29); // 30 days including today

  for (let i = 0; i < 30; i++) {
    const dStr = startDay.toISOString().split('T')[0];
    heatmap.push(dates.has(dStr));
    startDay.setDate(startDay.getDate() + 1);
  }

  return { currentStreak, maxStreak, heatmap };
}

export function getSubjectStats() {
  const stats = {};

  // Initialize with all known disciplines to show rows even if 0
  state.editais.forEach(ed => {
    ed.disciplinas.forEach(d => {
      stats[d.id] = { id: d.id, nome: d.nome, tempo: 0, acertos: 0, erros: 0 };
    });
  });

  state.eventos.forEach(ev => {
    if (ev.status === 'estudei' && ev.discId && stats[ev.discId]) {
      stats[ev.discId].tempo += (ev.tempoAcumulado || 0);
      if (ev.sessao && ev.sessao.questoes) {
        stats[ev.discId].acertos += (ev.sessao.questoes.acertos || 0);
        stats[ev.discId].erros += (ev.sessao.questoes.erros || 0);
      }
    }
  });

  return Object.values(stats).sort((a, b) => a.nome.localeCompare(b.nome));
}

export function getCurrentWeekStats() {
  // Determine start of current week (Monday or Sunday based on JS defaults vs config)
  // Assuming start of week is Sunday (0) or Monday (1)
  const today = new Date();
  const primeirodiaSemana = state.config.primeirodiaSemana || 1;
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 && primeirodiaSemana === 1 ? -6 : (primeirodiaSemana === 1 ? 1 : 0));
  const startOfWeek = new Date(today.setDate(diff));
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const startStr = startOfWeek.toISOString().split('T')[0];
  const endStr = endOfWeek.toISOString().split('T')[0];

  let totalSeconds = 0;
  let totalQuestions = 0;

  // Daily array from Monday to Sunday
  const dailySeconds = [0, 0, 0, 0, 0, 0, 0];

  state.eventos.forEach(ev => {
    if (ev.status === 'estudei' && ev.dataEstudo >= startStr && ev.dataEstudo <= endStr) {
      const elapsed = ev.tempoAcumulado || 0;
      totalSeconds += elapsed;
      if (ev.sessao && ev.sessao.questoes) {
        totalQuestions += (ev.sessao.questoes.total || ev.sessao.questoes.acertos + ev.sessao.questoes.erros || 0);
      }

      const evDate = new Date(ev.dataEstudo + 'T00:00:00');
      let dIndex = evDate.getDay() - primeirodiaSemana;
      if (dIndex < 0) dIndex += 7;
      dailySeconds[dIndex] += elapsed;
    }
  });

  return {
    startStr,
    endStr,
    totalSeconds,
    totalQuestions,
    dailySeconds
  };
}

// =============================================
// PLANEJAMENTO DE ESTUDOS (WIZARD)
// =============================================

export function calculateRelevanceWeights(relevanciaDraft) {
  let totalPeso = 0;
  const result = {};

  for (const discId in relevanciaDraft) {
    const r = relevanciaDraft[discId];
    const imp = parseInt(r.importancia, 10) || 3;
    const con = parseInt(r.conhecimento, 10) || 3;

    // Conhecimento 0 -> Fato 6 (muita atenção)
    // Conhecimento 5 -> Fato 1 (pouca atenção)
    const fatorConhecimento = 6 - con;
    const peso = imp * fatorConhecimento;

    result[discId] = { importancia: imp, conhecimento: con, peso };
    totalPeso += peso;
  }

  for (const discId in result) {
    result[discId].percentual = totalPeso > 0 ? (result[discId].peso / totalPeso) * 100 : 0;
  }

  return result;
}

export function generatePlanejamento(draft) {
  const plan = {
    ativo: true,
    tipo: draft.tipo,
    disciplinas: draft.disciplinas,
    relevancia: calculateRelevanceWeights(draft.relevancia),
    horarios: draft.horarios,
    sequencia: []
  };

  if (plan.tipo === 'ciclo') {
    const horasSemanais = parseFloat(plan.horarios.horasSemanais) || 0;
    const totalMinutes = horasSemanais * 60;
    const minSessao = parseInt(plan.horarios.sessaoMin, 10) || 30;
    const maxSessao = parseInt(plan.horarios.sessaoMax, 10) || 120;

    const sortedDiscs = [...plan.disciplinas].sort((a, b) => {
      const wA = plan.relevancia[a]?.peso || 0;
      const wB = plan.relevancia[b]?.peso || 0;
      return wB - wA;
    });

    sortedDiscs.forEach(discId => {
      const perc = plan.relevancia[discId]?.percentual || 0;
      let targetMinutes = Math.round((perc / 100) * totalMinutes);

      if (targetMinutes < minSessao) targetMinutes = minSessao;

      let remaining = targetMinutes;
      while (remaining > 0) {
        let block = Math.min(remaining, maxSessao);
        if (block < minSessao && remaining === targetMinutes) {
          block = minSessao;
        } else if (block < minSessao && remaining < targetMinutes) {
          // just drop the tail if it's too small, or merge with previous
          break;
        }
        plan.sequencia.push({
          id: 'seq_' + Date.now() + Math.random(),
          discId: discId,
          minutosAlvo: block,
          concluido: false
        });
        remaining -= block;
      }
    });
  } else if (plan.tipo === 'semanal') {
    // Semanal behavior
  }

  state.planejamento = plan;
  scheduleSave();
  return plan;
}

export function deletePlanejamento() {
  document.dispatchEvent(new CustomEvent('app:showConfirm', {
    detail: {
      msg: 'Deseja excluir este Planejamento de Estudos? Você precisará criar um novo depois para gerar sequências.',
      title: 'Excluir Planejamento',
      onYes: () => {
        state.planejamento = { ativo: false, tipo: null, disciplinas: [], relevancia: {}, horarios: {}, sequencia: [] };
        scheduleSave();
        document.dispatchEvent(new Event('app:renderCurrentView'));
      }
    }
  }));
}
