// =============================================
// SESSION SAVE — Registro de Sessão
// Data extraction, validation, and persistence logic
// =============================================

import { state, saveStateToDB } from '../store.js?v=8.37';
import {
  getDisc,
  syncCicloToEventos,
  getCycleProgress,
  touchPlanejamento,
  invalidateDashCaches,
  invalidateStreakCache,
  invalidatePendingRevCache,
} from '../logic.js?v=8.37';
import { showToast, closeModal, showConfirm } from '../app.js?v=8.37';
import { todayStr, uid } from '../utils.js?v=8.37';
import { updateBadges, renderCurrentView } from '../components.js?v=8.37';

// =============================================
// PERFORM SAVE
// =============================================

function getSeqStatus(seq) {
  if (seq?.status) return seq.status;
  return seq?.concluido ? 'concluida' : 'pendente';
}

function markPlanningSequenceCompleted(seq) {
  seq.concluido = true;
  seq.status = 'concluida';
  seq.finalizadoEm = new Date().toISOString();
  delete seq.puladaEm;
  delete seq.autoConcluida; // conclusão manual confirmada: nunca regride sozinha
  touchPlanejamento();
}

function formatPlanningMinutes(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  return `${mins}min`;
}

/**
 * Pós-save do planejamento ("todo estudo da disciplina conta"):
 * syncCicloToEventos() reconcilia o status derivado (qualquer sessão da
 * disciplina avança as etapas) e regenera a agenda. O prompt de conclusão
 * antecipada permanece apenas no fluxo vinculado (evento com seqId, criado por
 * "Iniciar Estudo"/agenda) quando a etapa segue pendente — sessões livres
 * nunca mostram prompt: a reconciliação age sozinha.
 */
function reconcilePlanningAfterSave(ev) {
  if (!state.planejamento?.ativo || !Array.isArray(state.planejamento.sequencia)) return;

  syncCicloToEventos();

  const seq = ev?.seqId
    ? state.planejamento.sequencia.find((s) => s.id === ev.seqId)
    : null;
  if (!seq || getSeqStatus(seq) !== 'pendente') return;

  const targetMinutes = Math.max(0, Math.round(Number(seq.minutosAlvo) || 0));
  if (targetMinutes <= 0) return;
  const entry = getCycleProgress()[seq.id];
  const studiedMinutes = entry ? entry.usedMins : 0;
  const remainingMinutes = Math.max(targetMinutes - studiedMinutes, 0);

  showConfirm(
    `Concluir mesmo assim esta etapa do planejamento? VocÃª estudou ${formatPlanningMinutes(studiedMinutes)} de ${formatPlanningMinutes(targetMinutes)}. Se cancelar, ela continua pendente com ${formatPlanningMinutes(remainingMinutes)} restantes.`,
    () => {
      markPlanningSequenceCompleted(seq);
      syncCicloToEventos();
      saveStateToDB().then(() => {
        renderCurrentView();
        showToast('Etapa concluÃ­da manualmente.', 'success');
      });
    },
    { title: 'SessÃ£o parcial', label: 'Concluir mesmo assim' }
  );
}

export function performSave({
  currentEventId,
  selectedTipos,
  selectedMateriais,
  sessionStartTime,
  sessionEndTime,
  sessionMode,
}) {
  let ev = null;
  const isLivre = currentEventId === 'crono_livre';

  if (isLivre) {
    ev = state.cronoLivre;
  } else {
    ev = state.eventos.find((e) => e.id === currentEventId);
  }

  if (!ev) {
    showToast('Evento não encontrado', 'error');
    return false;
  }

  // Validation
  if (selectedTipos.length === 0) {
    showToast('Selecione ao menos um tipo de estudo', 'error');
    return false;
  }

  const discId = document.getElementById('reg-disciplina')?.value;
  const assId = document.getElementById('reg-assunto')?.value || '';
  const aulaId = document.getElementById('reg-aula')?.value || '';

  // Note: assId and aulaId already contain the full ID (e.g. 'ass_xxx') from the select.
  // Do NOT strip prefixes — they are part of the canonical ID used in lookups.

  if (isLivre && !discId) {
    showToast(
      'Em sessões livres, escolha pelo menos uma Disciplina para vincular o tempo estudado',
      'error'
    );
    return false;
  }

  // Se for Sessão Livre, cria um evento real permanente pro Histórico
  if (isLivre && discId) {
    const d = getDisc(discId);
    let assName = 'Estudo Genérico';
    if (d) {
      if (aulaId) {
        const achado = d.disc.aulas?.find((a) => a.id === aulaId);
        if (achado) assName = achado.nome;
      } else {
        const achado = d.disc.assuntos?.find((a) => a.id === assId);
        if (achado) assName = achado.nome;
      }
    }
    const evtReal = {
      id: 'ev_' + uid(),
      titulo: assName,
      data: todayStr(),
      status: 'agendado', // Will turn 'estudei' down there
      dataEstudo: null,
      discId: discId,
      assId: assId || null,
      aulaId: aulaId || null,
      tipoInfo: 'Sessão Livre',
      tempoAcumulado: Math.round(state.cronoLivre.tempoAcumulado || 0),
    };
    state.eventos.push(evtReal);
    ev = evtReal; // Swap reference!
  }

  // Validate questões if type selected
  const hasQuestoes = selectedTipos.includes('questoes') || selectedTipos.includes('simulado');
  let questoes = null;
  if (hasQuestoes) {
    const total = parseInt(document.getElementById('reg-q-total')?.value, 10) || 0;
    const acertos = parseInt(document.getElementById('reg-q-acertos')?.value, 10) || 0;
    const erros = parseInt(document.getElementById('reg-q-erros')?.value, 10) || 0;
    if (total <= 0) {
      showToast('Informe o total de questões', 'error');
      return false;
    }
    if (acertos < 0 || erros < 0) {
      showToast('Acertos e erros não podem ser negativos', 'error');
      return false;
    }
    if (acertos + erros > total) {
      showToast('Acertos + Erros não pode ser maior que o Total', 'error');
      return false;
    }
    questoes = { total, acertos, erros };
  }

  // Validate vídeo if type selected
  let videoaula = null;
  if (selectedTipos.includes('videoaula')) {
    let titulo = document.getElementById('reg-video-titulo')?.value.trim() || '';
    const tempoRaw = parseInt(document.getElementById('reg-video-tempo')?.value || '0', 10);
    const tempoMin = Number.isFinite(tempoRaw) && tempoRaw > 0 ? tempoRaw : 0;
    if (!titulo && discId && aulaId) {
      const d = getDisc(discId);
      const aula = d?.disc?.aulas?.find((a) => a.id === aulaId);
      if (aula?.nome) titulo = aula.nome;
    }
    videoaula = { titulo, tempoMin };
  }

  // Validate páginas if needed
  const showPaginas =
    ['leitura', 'informativo', 'sumula'].some((t) => selectedTipos.includes(t)) ||
    ['pdf', 'livro', 'lei_seca', 'informativo_mat'].some((m) => selectedMateriais.includes(m));

  let paginas = null;
  if (showPaginas) {
    const simplesVisible = document.getElementById('pag-simples')?.style.display !== 'none';
    if (simplesVisible) {
      const total = parseInt(document.getElementById('reg-pag-total')?.value || '0');
      if (total > 0) paginas = { modo: 'simples', total };
    } else {
      const inicio = parseInt(document.getElementById('reg-pag-inicio')?.value || '0');
      const fim = parseInt(document.getElementById('reg-pag-fim')?.value || '0');
      if (inicio < 0 || fim < 0) {
        showToast('Páginas não podem ser negativas', 'error');
        return false;
      }
      if (fim > inicio) paginas = { modo: 'detalhado', inicio, fim, total: fim - inicio };
      else if (fim > 0 || inicio > 0) {
        showToast('Página final deve ser maior que a página inicial', 'error');
        return false;
      }
    }
  }

  // Topic status
  const statusTopico = document.getElementById('reg-status-topico')?.value || 'em_andamento';

  // Handle Editing Flow
  const isEditingOld = ev.status === 'estudei' && !ev._isPastSession;
  if (isEditingOld) {
    Object.keys(state.habitos).forEach((tipo) => {
      if (state.habitos[tipo]) {
        state.habitos[tipo] = state.habitos[tipo].filter((h) => h.eventoId !== ev.id);
      }
    });
  }

  // Save data to event
  ev.status = 'estudei';

  const editedData = document.getElementById('reg-data-estudo')?.value;
  const editedMins = parseInt(document.getElementById('reg-tempo-mins')?.value, 10);

  if (ev._isPastSession) {
    delete ev._isPastSession;
    ev.dataEstudo = editedData || ev.data;
    if (editedData) ev.data = editedData;
  } else if (isEditingOld) {
    if (editedData) {
      ev.data = editedData;
      ev.dataEstudo = editedData;
    }
  } else {
    ev.dataEstudo = todayStr();
  }

  if (!isNaN(editedMins) && editedMins > 0) {
    ev.tempoAcumulado = editedMins * 60;
  }

  ev.discId = discId || ev.discId;
  // Allow clearing selections when user chooses "Sem tópico" / "Sem material"
  ev.assId = assId || null;
  ev.aulaId = aulaId || null;

  // Build titulo from discipline + topic
  if (discId) {
    const d = getDisc(discId);
    if (d) {
      let titulo = d.disc.nome;
      if (aulaId) {
        const aula = d.disc.aulas?.find((a) => a.id === aulaId);
        if (aula) titulo += ' — ' + aula.nome;
      } else if (assId) {
        const ass = d.disc.assuntos?.find((a) => a.id === assId);
        if (ass) titulo += ' — ' + ass.nome;
      }
      ev.titulo = titulo;
    }
  }

  ev.sessao = {
    tiposEstudo: [...selectedTipos],
    materiais: [...selectedMateriais],
    materialDetalhe: document.getElementById('reg-material-detalhe')?.value.trim() || '',
    questoes,
    paginas,
    videoaula,
    statusTopico,
    comentarios: document.getElementById('reg-comentarios')?.value.trim() || '',
    observacoes: document.getElementById('reg-observacao')?.value.trim() || '',
    horaInicio: sessionStartTime ? sessionStartTime.toTimeString().slice(0, 8) : null,
    horaFim: sessionEndTime ? sessionEndTime.toTimeString().slice(0, 8) : null,
    modo: sessionMode,
  };

  // Progress: mark as concluded
  if (statusTopico === 'finalizado' && discId) {
    const d = getDisc(discId);
    if (d) {
      if (aulaId) {
        const achadoAula = d.disc.aulas?.find((a) => a.id === aulaId);
        if (achadoAula && !achadoAula.estudada) {
          achadoAula.estudada = true;
          // getAulasWeeklyStats só conta aulas com dataEstudo — o toggle manual
          // (editais-crud/aula-operations) grava; o caminho da sessão também precisa.
          achadoAula.dataEstudo = ev.dataEstudo || ev.data || todayStr();
        }
      }

      if (assId) {
        const ass = d.disc.assuntos?.find((a) => a.id === assId);
        if (ass && !ass.concluido) {
          ass.concluido = true;
          // Data REAL do estudo: numa sessão passada, as revisões (1/7/30/90)
          // devem contar a partir da conclusão de fato, não de "hoje".
          ass.dataConclusao = ev.dataEstudo || ev.data || todayStr();
          ass.revisoesFetas = [];
        }
      }
    }
  }

  // Register habits. Use the session's study date (not "today") so that editing a past/manual
  // session keeps its habit entries on the correct day and weekly stats don't drift.
  const habitoData = ev.dataEstudo || ev.data || todayStr();
  selectedTipos.forEach((tipo) => {
    if (state.habitos[tipo]) {
      state.habitos[tipo].push({
        id: 'hab_' + uid(),
        data: habitoData,
        eventoId: ev.id,
        tempoMin: Math.round((ev.tempoAcumulado || 0) / 60),
        ...(questoes && (tipo === 'questoes' || tipo === 'simulado') ? questoes : {}),
      });
    }
  });

  if (paginas && paginas.total > 0) {
    if (!state.habitos.paginas) state.habitos.paginas = [];
    state.habitos.paginas.push({
      id: 'hab_' + uid(),
      data: habitoData,
      eventoId: ev.id,
      tempoMin: Math.round((ev.tempoAcumulado || 0) / 60),
      total: parseInt(paginas.total, 10),
    });
  }

  // Limpa o cronometro livre da memória caso tenha sido ele
  if (isLivre) {
    state.cronoLivre = { _timerStart: null, tempoAcumulado: 0 };
  }

  // NOTE: o progresso por disciplina (ciclo/dashboard/previsão) é DERIVADO de state.eventos no
  // momento do render (ver getStudiedMinutesByDiscipline em logic/cycle.js). Não mantemos mais
  // contadores incrementais em state.ciclo aqui — isso evita contagem dupla ao editar e drift ao
  // excluir uma sessão, e faz a troca de disciplina na edição refletir automaticamente.

  // Reconcilia o planejamento: toda sessão concluída da disciplina avança o
  // ciclo, com ou sem vínculo explícito (seqId).
  reconcilePlanningAfterSave(ev);

  // O flush direto via saveStateToDB() não passa por scheduleSave(), que é quem
  // dispara app:invalidateCaches — sem isto o renderCurrentView abaixo (e o
  // dashboard/home) leria estatísticas velhas dos caches de progress.js.
  invalidateDashCaches();
  invalidateStreakCache();
  invalidatePendingRevCache();

  // FLUSH IMEDIATO para operações críticas - registro de sessão é dado importante
  saveStateToDB().then(() => {
    closeModal('modal-registro-sessao');

    // Bug 1 Fix: Explicitly flush UI updates after save completes
    setTimeout(() => {
      document.dispatchEvent(new Event('app:refreshMEDSections'));
      updateBadges();
      renderCurrentView();
      showToast('Sessão registrada com sucesso! ✅', 'success');
    }, 50);
  });

  return true;
}
