import { state } from '../store.js?v=8.37';
import { cutoffDateStr, getLocalDateStr } from '../utils.js?v=8.37';

export function totalStudySeconds(days = null) {
  const cutoffStr = days ? cutoffDateStr(days) : null;
  return state.eventos
    .filter((e) => {
      if (e.status !== 'estudei' || !e.tempoAcumulado) return false;
      const studyDate = e.dataEstudo || e.data;
      return !cutoffStr || (studyDate && studyDate >= cutoffStr);
    })
    .reduce((s, e) => s + (e.tempoAcumulado || 0), 0);
}

// =============================================
// CONTENT PROGRESS
// =============================================

function makeProgressAxis(done, total) {
  const safeDone = Number.isFinite(done) ? Math.max(0, done) : 0;
  const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
  return {
    done: safeDone,
    total: safeTotal,
    pct: safeTotal > 0 ? Math.round((safeDone / safeTotal) * 100) : 0,
  };
}

export function calculateContentProgress(source) {
  const disciplinas = Array.isArray(source) ? source : [source].filter(Boolean);
  const topicsTotal = disciplinas.reduce((sum, disc) => sum + (disc.assuntos || []).length, 0);
  const topicsDone = disciplinas.reduce(
    (sum, disc) => sum + (disc.assuntos || []).filter((ass) => ass.concluido).length,
    0
  );
  const lessonsTotal = disciplinas.reduce((sum, disc) => sum + (disc.aulas || []).length, 0);
  const lessonsDone = disciplinas.reduce(
    (sum, disc) => sum + (disc.aulas || []).filter((aula) => aula.estudada).length,
    0
  );

  const topics = makeProgressAxis(topicsDone, topicsTotal);
  const lessons = makeProgressAxis(lessonsDone, lessonsTotal);
  const activeAxes = [topics, lessons].filter((axis) => axis.total > 0);
  const overallDone = topics.done + lessons.done;
  const overallTotal = topics.total + lessons.total;
  const overallPct =
    activeAxes.length > 0
      ? Math.round(activeAxes.reduce((sum, axis) => sum + axis.pct, 0) / activeAxes.length)
      : 0;

  return {
    topics,
    lessons,
    overall: {
      done: overallDone,
      total: overallTotal,
      pct: overallPct,
    },
  };
}

// =============================================
// DASHBOARD ANALYTICS
// =============================================
let _perfCache = null;
let _pagesCache = null;
let _syllabusCache = null;
let _subjectCache = null;
let _weekCache = null;
let _aggregatedStatsCache = null;

export function invalidateDashCaches() {
  _perfCache = null;
  _pagesCache = null;
  _syllabusCache = null;
  _subjectCache = null;
  _weekCache = null;
  _aggregatedStatsCache = null;
}

// Pre-aggregate all event stats in a single pass for better performance
export function getAggregatedStats() {
  if (_aggregatedStatsCache) return _aggregatedStatsCache;

  const stats = {
    questionsTotal: 0,
    questionsCorrect: 0,
    questionsWrong: 0,
    pagesTotal: 0,
    subjectStats: {},
    subjectLast7Days: {}, // discId → [s0..s6] (mais antigo → mais recente)
    weekDailySeconds: [0, 0, 0, 0, 0, 0, 0],
    weekTotalSeconds: 0,
    weekTotalQuestions: 0,
    weekQuestionsCorrect: 0,
    weekQuestionsWrong: 0,
    weekTotalPages: 0,
    weekAulasCompleted: 0,
    weekStartStr: '',
    weekEndStr: '',
    prevWeekTotalSeconds: 0,
    prevWeekTotalQuestions: 0,
    prevWeekQuestionsCorrect: 0,
    prevWeekQuestionsWrong: 0,
    prevWeekTotalPages: 0,
    prevWeekAulasCompleted: 0,
    prevWeekStartStr: '',
    prevWeekEndStr: '',
    last7DaysStartStr: '',
    streakDates: new Set(),
  };

  // Initialize subject stats with all disciplines
  (state.editais || []).forEach((ed) => {
    if (!ed.disciplinas) return;
    ed.disciplinas.forEach((d) => {
      stats.subjectStats[d.id] = {
        id: d.id,
        nome: d.nome,
        tempo: 0,
        acertos: 0,
        erros: 0,
        arquivada: !!d.arquivada,
      };
      stats.subjectLast7Days[d.id] = [0, 0, 0, 0, 0, 0, 0];
    });
  });

  // Determine week boundaries once
  const now = new Date();
  const primeirodiaSemana = state.config.primeirodiaSemana ?? 1;
  let dayOffset = now.getDay() - primeirodiaSemana;
  if (dayOffset < 0) dayOffset += 7;
  const startOfWeek = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - dayOffset,
    0,
    0,
    0,
    0
  );
  const startStr = getLocalDateStr(startOfWeek);
  const endStr = getLocalDateStr(
    new Date(
      startOfWeek.getFullYear(),
      startOfWeek.getMonth(),
      startOfWeek.getDate() + 6,
      23,
      59,
      59,
      999
    )
  );
  stats.weekStartStr = startStr;
  stats.weekEndStr = endStr;

  // Semana anterior
  const prevStartObj = new Date(startOfWeek);
  prevStartObj.setDate(prevStartObj.getDate() - 7);
  const prevEndObj = new Date(startOfWeek);
  prevEndObj.setDate(prevEndObj.getDate() - 1);
  const prevStartStr = getLocalDateStr(prevStartObj);
  const prevEndStr = getLocalDateStr(prevEndObj);
  stats.prevWeekStartStr = prevStartStr;
  stats.prevWeekEndStr = prevEndStr;

  // Últimos 7 dias (para sparkline) — termina hoje
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last7Start = new Date(today0);
  last7Start.setDate(last7Start.getDate() - 6);
  const last7StartStr = getLocalDateStr(last7Start);
  stats.last7DaysStartStr = last7StartStr;

  // Single pass through all events
  state.eventos.forEach((ev) => {
    if (ev.status !== 'estudei') return;

    const studyDate = ev.dataEstudo || ev.data;
    const elapsed = ev.tempoAcumulado || 0;
    const qs = ev.sessao?.questoes || ev.questoes;

    // Global stats
    let totalQs = 0;
    if (qs) {
      totalQs = qs.total ?? (qs.acertos || qs.certas || 0) + (qs.erros || qs.erradas || 0);
      stats.questionsTotal += totalQs;
      stats.questionsCorrect += qs.acertos || qs.certas || 0;
      stats.questionsWrong += qs.erros || qs.erradas || 0;
    }
    stats.pagesTotal += ev.sessao?.paginas?.total || ev.paginas || 0;

    // Subject stats
    if (ev.discId && stats.subjectStats[ev.discId]) {
      stats.subjectStats[ev.discId].tempo += elapsed;
      if (qs) {
        stats.subjectStats[ev.discId].acertos += qs.acertos || qs.certas || 0;
        stats.subjectStats[ev.discId].erros += qs.erros || qs.erradas || 0;
      }
    }

    // Week stats
    if (studyDate >= startStr && studyDate <= endStr) {
      stats.weekTotalSeconds += elapsed;
      stats.weekTotalQuestions += totalQs;
      if (qs) {
        stats.weekQuestionsCorrect += qs.acertos || qs.certas || 0;
        stats.weekQuestionsWrong += qs.erros || qs.erradas || 0;
      }
      stats.weekTotalPages += ev.sessao?.paginas?.total || ev.paginas || 0;
      const evDate = new Date(studyDate + 'T00:00:00');
      let dIndex = evDate.getDay() - primeirodiaSemana;
      if (dIndex < 0) dIndex += 7;
      stats.weekDailySeconds[dIndex] += elapsed;
    } else if (studyDate >= prevStartStr && studyDate <= prevEndStr) {
      // Semana anterior (para deltas)
      stats.prevWeekTotalSeconds += elapsed;
      stats.prevWeekTotalQuestions += totalQs;
      if (qs) {
        stats.prevWeekQuestionsCorrect += qs.acertos || qs.certas || 0;
        stats.prevWeekQuestionsWrong += qs.erros || qs.erradas || 0;
      }
      stats.prevWeekTotalPages += ev.sessao?.paginas?.total || ev.paginas || 0;
    }

    // Sparkline 7 dias por disciplina
    if (ev.discId && stats.subjectLast7Days[ev.discId] && studyDate >= last7StartStr) {
      const d = new Date(studyDate + 'T00:00:00');
      const diffDays = Math.round((d - last7Start) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        stats.subjectLast7Days[ev.discId][diffDays] += elapsed;
      }
    }

    // Streak dates
    if (studyDate) {
      stats.streakDates.add(studyDate);
    }
  });

  _aggregatedStatsCache = stats;
  return stats;
}

export function getPerformanceStats() {
  const agg = getAggregatedStats();
  return {
    questionsTotal: agg.questionsTotal,
    questionsCorrect: agg.questionsCorrect,
    questionsWrong: agg.questionsWrong,
  };
}

export function getPagesReadStats() {
  const agg = getAggregatedStats();
  return agg.pagesTotal;
}

export function getSyllabusProgress() {
  if (_syllabusCache) return _syllabusCache;
  let totalAulas = 0;
  let aulasEstudadas = 0;

  (state.editais || []).forEach((ed) => {
    if (!ed.disciplinas) return;
    (ed.disciplinas || []).forEach((d) => {
      totalAulas += d.aulas ? d.aulas.length : 0;
      aulasEstudadas += d.aulas ? d.aulas.filter((a) => a.estudada).length : 0;
    });
  });

  _syllabusCache = { totalAssuntos: totalAulas, totalConcluidos: aulasEstudadas };
  return _syllabusCache;
}

let _streakCache = null;
export function invalidateStreakCache() {
  _streakCache = null;
}

export function getConsistencyStreak() {
  if (_streakCache) return _streakCache;
  const agg = getAggregatedStats();
  const dates = agg.streakDates;

  const todayStrDate = getLocalDateStr();
  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak;

  // Calculate max streak
  const sortedDates = Array.from(dates).sort();
  if (sortedDates.length > 0) {
    tempStreak = 1;
    maxStreak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const curr = new Date(sortedDates[i] + 'T00:00:00');
      const prevNorm = new Date(sortedDates[i - 1] + 'T00:00:00');
      const diff = Math.round((curr - prevNorm) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        tempStreak++;
        if (tempStreak > maxStreak) maxStreak = tempStreak;
      } else if (diff > 1) {
        tempStreak = 1;
      }
    }

    // Current Streak
    const currDay = new Date(todayStrDate + 'T00:00:00');
    while (dates.has(getLocalDateStr(currDay)) && currentStreak < 3650) {
      currentStreak++;
      currDay.setDate(currDay.getDate() - 1);
    }
  }

  // Generate last 30 days heatmap
  const heatmap = [];
  const startDay = new Date(todayStrDate + 'T00:00:00');
  startDay.setDate(startDay.getDate() - 29);

  for (let i = 0; i < 30; i++) {
    const dStr = getLocalDateStr(startDay);
    heatmap.push(dates.has(dStr));
    startDay.setDate(startDay.getDate() + 1);
  }

  _streakCache = { currentStreak, maxStreak, heatmap };
  return _streakCache;
}

export function getSubjectStats() {
  const agg = getAggregatedStats();
  // Disciplinas arquivadas ficam fora: este resultado alimenta a recomendação
  // preditiva ("foque mais em X"), e uma arquivada com pouco tempo venceria o
  // sort por menor tempo — sugerindo exatamente o que o usuário engavetou.
  return [...Object.values(agg.subjectStats)]
    .filter((s) => !s.arquivada)
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export function getCurrentWeekStats() {
  const agg = getAggregatedStats();
  return {
    totalSeconds: agg.weekTotalSeconds,
    totalQuestions: agg.weekTotalQuestions,
    questionsCorrect: agg.weekQuestionsCorrect,
    questionsWrong: agg.weekQuestionsWrong,
    totalPages: agg.weekTotalPages,
    dailySeconds: agg.weekDailySeconds,
    startStr: agg.weekStartStr,
    endStr: agg.weekEndStr,
  };
}

/**
 * Conta aulas com flag `estudada=true` cujo `dataEstudo` cai dentro da semana atual / anterior.
 * Retorna { thisWeek, prevWeek, totalPending }.
 */
export function getAulasWeeklyStats() {
  const agg = getAggregatedStats();
  let thisWeek = 0;
  let prevWeek = 0;
  let totalPending = 0;
  (state.editais || []).forEach((ed) => {
    (ed.disciplinas || []).forEach((disc) => {
      if (disc.arquivada) return;
      (disc.aulas || []).forEach((a) => {
        if (!a.estudada) {
          totalPending += 1;
          return;
        }
        if (!a.dataEstudo) return;
        if (a.dataEstudo >= agg.weekStartStr && a.dataEstudo <= agg.weekEndStr) {
          thisWeek += 1;
        } else if (a.dataEstudo >= agg.prevWeekStartStr && a.dataEstudo <= agg.prevWeekEndStr) {
          prevWeek += 1;
        }
      });
    });
  });
  return { thisWeek, prevWeek, totalPending };
}

/**
 * Estatísticas da semana anterior — usado para deltas (Δ vs semana passada).
 */
export function getPreviousWeekStats() {
  const agg = getAggregatedStats();
  return {
    totalSeconds: agg.prevWeekTotalSeconds,
    totalQuestions: agg.prevWeekTotalQuestions,
    questionsCorrect: agg.prevWeekQuestionsCorrect,
    questionsWrong: agg.prevWeekQuestionsWrong,
    totalPages: agg.prevWeekTotalPages,
    startStr: agg.prevWeekStartStr,
    endStr: agg.prevWeekEndStr,
  };
}

/**
 * Retorna array de 7 valores (segundos) representando o tempo por dia
 * dos últimos 7 dias (mais antigo → mais recente) para uma disciplina.
 */
export function getDisciplineSparkline(discId) {
  const agg = getAggregatedStats();
  return agg.subjectLast7Days[discId] || [0, 0, 0, 0, 0, 0, 0];
}

/**
 * Sugere a próxima aula a estudar: primeira aula com `estudada=false`
 * dentro do edital/concurso ativo (ou primeiro edital se não houver filtro).
 * Retorna { aula, disc, edital } ou null.
 */
export function getNextSuggestedLesson(editalId = null) {
  const editais = state.editais || [];
  const candidates = editalId ? editais.filter((e) => e.id === editalId) : editais;
  for (const edital of candidates) {
    for (const disc of edital.disciplinas || []) {
      if (disc.arquivada) continue;
      const aula = (disc.aulas || []).find((a) => !a.estudada);
      if (aula) return { aula, disc, edital };
    }
  }
  return null;
}

/**
 * Progresso por disciplina (% aulas estudadas) agrupado por edital.
 * Retorna [{ edital, disciplinas: [{ disc, total, estudadas, percent, tempo, acertos, erros }] }]
 */
export function getDisciplineProgressByEdital() {
  const agg = getAggregatedStats();
  return (state.editais || []).map((edital) => {
    const disciplinas = (edital.disciplinas || [])
      .filter((d) => !d.arquivada)
      .map((disc) => {
        const total = disc.aulas ? disc.aulas.length : 0;
        const estudadas = disc.aulas ? disc.aulas.filter((a) => a.estudada).length : 0;
        const percent = total > 0 ? Math.round((estudadas / total) * 100) : 0;
        const subj = agg.subjectStats[disc.id] || { tempo: 0, acertos: 0, erros: 0 };
        const sparkline = agg.subjectLast7Days[disc.id] || [0, 0, 0, 0, 0, 0, 0];
        return {
          disc,
          total,
          estudadas,
          percent,
          tempo: subj.tempo,
          acertos: subj.acertos,
          erros: subj.erros,
          sparkline,
        };
      });
    return { edital, disciplinas };
  });
}

/**
 * Progresso de aulas filtrado por edital (ou agregado se editalId for null).
 */
export function getSyllabusProgressByEdital(editalId) {
  if (!editalId) return getSyllabusProgress();
  const ed = (state.editais || []).find((e) => e.id === editalId);
  if (!ed) return { totalAssuntos: 0, totalConcluidos: 0 };
  let total = 0;
  let estudadas = 0;
  (ed.disciplinas || []).forEach((d) => {
    if (d.arquivada) return;
    total += d.aulas ? d.aulas.length : 0;
    estudadas += d.aulas ? d.aulas.filter((a) => a.estudada).length : 0;
  });
  return { totalAssuntos: total, totalConcluidos: estudadas };
}

export function getPredictiveStats(metaHoras, subjectStats = null) {
  const weekStats = getCurrentWeekStats();
  const today = new Date();
  const primeirodiaSemana = state.config.primeirodiaSemana ?? 1;
  let dIndex = today.getDay() - primeirodiaSemana;
  if (dIndex < 0) dIndex += 7;

  // Dias passados e restantes (1 a 7)
  const daysPassed = dIndex + 1;
  const daysRemaining = 7 - daysPassed;

  // O que foi feito até hoje dividido pelos dias decorridos = ritmo
  const burnRateSecs = weekStats.totalSeconds / daysPassed;
  const projectedSeconds = weekStats.totalSeconds + burnRateSecs * daysRemaining;
  const targetSeconds = (metaHoras || 0) * 3600;

  const projectedPerc = targetSeconds > 0 ? (projectedSeconds / targetSeconds) * 100 : 0;

  let status = 'verde';
  let suggestion = 'Ritmo excelente! Você vai bater a meta semanal com folga.';

  if (targetSeconds > 0 && projectedSeconds < targetSeconds) {
    const deficitSecs = targetSeconds - projectedSeconds;

    if (daysRemaining > 0) {
      const extraPerDayMinutes = Math.ceil(deficitSecs / 60 / daysRemaining);
      if (projectedPerc >= 80) {
        status = 'amarelo';
        suggestion = `Luz Amarela: Estude +${extraPerDayMinutes} min/dia para alcançar a meta semanal.`;
      } else {
        status = 'vermelho';
        suggestion = `Risco Alto: Você precisará de um gás de +${extraPerDayMinutes} min extras por dia para não fechar a semana em déficit.`;
      }
    } else {
      // Se for o último dia (domingo/sábado), mostrar apenas o déficit de hoje
      const deficitTodayMins = Math.ceil((targetSeconds - weekStats.totalSeconds) / 60);
      if (deficitTodayMins > 0) {
        status = 'vermelho';
        suggestion = `Último dia da semana! Ainda faltam ${deficitTodayMins} minutos para bater a meta.`;
      }
    }
  } else if (targetSeconds > 0 && weekStats.totalSeconds >= targetSeconds) {
    status = 'verde';
    suggestion = 'Meta semanal concluída! Descanse ou avance matérias atrasadas.';
  }

  // Tenta sugerir a matéria mais negligenciada se não estiver verde
  if (status !== 'verde' && daysRemaining > 0) {
    if (!subjectStats) subjectStats = getSubjectStats();
    if (subjectStats && subjectStats.length > 0) {
      // Ordena da menos estudada pra mais estudada (baseado no tempo acumulado total)
      const sorted = [...subjectStats].sort((a, b) => a.tempo - b.tempo);
      const worst = sorted[0].nome;
      suggestion += ` Recomendação: foque um pouco mais em ${worst}.`;
    }
  }

  return {
    status,
    projectedPerc: Math.round(projectedPerc),
    suggestion,
    projectedSeconds,
    targetSeconds,
    burnRate: burnRateSecs,
    daysRemaining,
  };
}
