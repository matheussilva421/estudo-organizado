// =============================================
// REGISTRO DA SESSÃO DE ESTUDO
// Módulo orquestrador — coordena sub-módulos de
// renderização e persistência
// =============================================

import { state, scheduleSave } from './store.js?v=8.37';
import {
  getDisc,
  getElapsedSeconds,
  _pomodoroMode,
  timerIntervals,
  discardTimer,
  syncCicloToEventos,
  touchPlanejamento,
  invalidateDashCaches,
  invalidateStreakCache,
  invalidatePendingRevCache,
} from './logic.js?v=8.37';
import { openModal, closeModal, showToast, showConfirm, navigate } from './app.js?v=8.37';
import { esc, trunc, uid } from './utils.js?v=8.37';
import { renderCurrentView } from './components.js?v=8.37';
import { openAddPastSessionModal } from './ui/event-modals.js?v=8.37';
import { recordSyncTombstone } from './sync/sync-center.js?v=8.37';

// Sub-módulos
import {
  TIPOS_ESTUDO,
  MATERIAIS,
  renderRegistroForm,
  renderConditionalFields,
  renderTopicosList,
} from './registro-sessao/modal-renderer.js?v=8.37';
import { performSave } from './registro-sessao/session-save.js?v=8.37';
import { normalizeSessionTopics } from './registro-sessao/session-topics.js';

// Re-export domain constants
export { TIPOS_ESTUDO, MATERIAIS };

// =============================================
// INTERNAL STATE
// =============================================

let _selectedTipos = [];
let _selectedMateriais = [];
let _currentEventId = null;
let _sessionStartTime = null;
let _sessionEndTime = null;
let _sessionMode = 'cronometro';
let _savedTimerStart = null;
let _savedTempoAcumulado = 0;
let _currentEv = null;
// Registro multi-tópico: itens {assId|aulaId, questoes, paginas, statusTopico}.
// Lista vazia = caminho legado (campos globais valem sozinhos).
let _sessionTopicos = [];
// Disciplina "dona" da lista atual (sessão multi-tópico = uma disciplina).
let _sessionTopicosDiscId = '';

export function getSessionTopicos() {
  return _sessionTopicos;
}

function renderSessionTopicosList() {
  const container = document.getElementById('reg-topicos-lista');
  if (!container) return;
  const discId = document.getElementById('reg-disciplina')?.value || _currentEv?.discId || '';
  container.innerHTML = renderTopicosList({ topicos: _sessionTopicos, discId });
}

export function addTopicoSessao() {
  const discId = document.getElementById('reg-disciplina')?.value;
  if (!discId) {
    showToast('Selecione uma disciplina primeiro', 'error');
    return;
  }
  const assId = document.getElementById('reg-assunto')?.value || null;
  const aulaId = document.getElementById('reg-aula')?.value || null;
  if (!assId && !aulaId) {
    showToast('Selecione um tópico e/ou uma aula para adicionar à lista', 'error');
    return;
  }
  const duplicado = _sessionTopicos.some(
    (item) => (item.assId || null) === assId && (item.aulaId || null) === aulaId
  );
  if (duplicado) {
    showToast('Este item já está na lista', 'info');
    return;
  }
  _sessionTopicos.push({
    assId,
    aulaId,
    questoes: null,
    paginas: null,
    statusTopico: 'em_andamento',
  });
  _sessionTopicosDiscId = discId;
  renderSessionTopicosList();
}

export function removeTopicoSessao(idx) {
  if (!Number.isInteger(idx) || idx < 0 || idx >= _sessionTopicos.length) return;
  _sessionTopicos.splice(idx, 1);
  renderSessionTopicosList();
}

/**
 * Atualiza um campo de um item da lista (inputs com data-topico-idx). Não
 * re-renderiza — o valor mora no input; a lista é a fonte no save.
 */
export function updateTopicoField(idx, field, value) {
  const item = _sessionTopicos[idx];
  if (!item) return;
  if (field === 'status') {
    item.statusTopico = value || 'em_andamento';
    return;
  }
  if (field === 'pag-total') {
    const total = parseInt(value, 10) || 0;
    item.paginas = total > 0 ? { modo: 'simples', total } : null;
    return;
  }
  const questoes = item.questoes || { total: 0, acertos: 0, erros: 0 };
  const num = parseInt(value, 10) || 0;
  if (field === 'q-total') questoes.total = num;
  else if (field === 'q-acertos') questoes.acertos = num;
  else if (field === 'q-erros') questoes.erros = num;
  else return;
  item.questoes =
    questoes.total > 0 || questoes.acertos > 0 || questoes.erros > 0 ? questoes : null;
}

// =============================================
// OPEN REGISTRO SESSÃO
// =============================================

export function openRegistroSessao(eventId) {
  let ev = null;
  if (eventId === 'crono_livre') {
    ev = { ...state.cronoLivre, id: 'crono_livre', sessao: {} };
  } else {
    ev = state.eventos.find((e) => e.id === eventId);
    if (!ev) {
      showToast('Evento não encontrado', 'error');
      return;
    }
  }

  // Save timer state for rollback if user cancels
  _savedTimerStart = ev._timerStart || null;
  _savedTempoAcumulado = ev.tempoAcumulado || 0;

  // Stop timer if running
  if (ev._timerStart) {
    ev.tempoAcumulado = getElapsedSeconds(ev);
    _sessionEndTime = new Date();
    _sessionStartTime = new Date(ev._timerStart);
    ev._timerStart = null;
    if (timerIntervals[eventId]) {
      clearInterval(timerIntervals[eventId]);
      delete timerIntervals[eventId];
    }
  } else {
    _sessionEndTime = new Date();
    const totalSecs = ev.tempoAcumulado || 0;
    _sessionStartTime = new Date(_sessionEndTime.getTime() - totalSecs * 1000);
  }

  _currentEv = ev;
  _currentEventId = eventId;
  _selectedTipos = ev.sessao?.tiposEstudo || [];
  _selectedMateriais = ev.sessao?.materiais || [];
  _sessionMode = _pomodoroMode ? 'pomodoro' : 'cronometro';
  // Multi-tópico: reedição carrega topicos[] existentes; sessão antiga
  // (estudei com escalares) converte em lista de 1 item. Sessão nova começa
  // vazia (caminho legado até o usuário adicionar itens).
  _sessionTopicos =
    (Array.isArray(ev.sessao?.topicos) && ev.sessao.topicos.length > 0) ||
    ev.status === 'estudei'
      ? normalizeSessionTopics(ev)
      : [];
  _sessionTopicosDiscId = ev.discId || '';

  // Build and render the form via sub-module
  const body = document.getElementById('modal-registro-body');
  if (body) {
    body.innerHTML = renderRegistroForm({
      ev,
      sessionStartTime: _sessionStartTime,
      sessionEndTime: _sessionEndTime,
      sessionMode: _sessionMode,
      selectedTipos: _selectedTipos,
      selectedMateriais: _selectedMateriais,
      sessionTopicos: _sessionTopicos,
    });
  }

  openModal('modal-registro-sessao');

  // Pre-fill discipline if event already has one
  setTimeout(() => {
    if (ev.discId) {
      const discSelect = document.getElementById('reg-disciplina');
      if (discSelect) {
        discSelect.value = ev.discId;
        onDisciplinaChange();
        if (ev.assId) {
          const assSelect = document.getElementById('reg-assunto');
          if (assSelect) {
            assSelect.value = ev.assId;
          }
        }
        if (ev.aulaId) {
          const aulaSelect = document.getElementById('reg-aula');
          if (aulaSelect) {
            aulaSelect.value = ev.aulaId;
            onAulaChange();
          }
        }
      }
    }
  }, 100);
}

// =============================================
// INTERACTIVE FUNCTIONS
// =============================================

export function toggleStudyType(typeId) {
  const idx = _selectedTipos.indexOf(typeId);
  if (idx >= 0) _selectedTipos.splice(idx, 1);
  else _selectedTipos.push(typeId);

  // Update chip visual
  const chip = document.querySelector(`[data-tipo="${typeId}"]`);
  if (chip) chip.classList.toggle('chip-active');

  // Re-render conditional fields
  const container = document.getElementById('reg-resultados');
  if (container) {
    const discId = document.getElementById('reg-disciplina')?.value || _currentEv?.discId || '';
    const aulaId = document.getElementById('reg-aula')?.value || _currentEv?.aulaId || '';
    container.innerHTML = renderConditionalFields({
      selectedTipos: _selectedTipos,
      selectedMateriais: _selectedMateriais,
      sessao: _currentEv.sessao || {},
      discId,
      aulaId,
    });
  }
}

export function toggleMaterial(matId) {
  const idx = _selectedMateriais.indexOf(matId);
  if (idx >= 0) _selectedMateriais.splice(idx, 1);
  else _selectedMateriais.push(matId);

  // Update chip visual
  const chip = document.querySelector(`[data-mat="${matId}"]`);
  if (chip) chip.classList.toggle('chip-active');

  // Re-render conditional fields (materials affect page fields)
  const container = document.getElementById('reg-resultados');
  if (container) {
    const discId = document.getElementById('reg-disciplina')?.value || _currentEv?.discId || '';
    const aulaId = document.getElementById('reg-aula')?.value || _currentEv?.aulaId || '';
    container.innerHTML = renderConditionalFields({
      selectedTipos: _selectedTipos,
      selectedMateriais: _selectedMateriais,
      sessao: _currentEv.sessao || {},
      discId,
      aulaId,
    });
  }
}

function buildAulaOptions(aulas, linkedIds = new Set()) {
  let html = '<option value="">Sem material/aula específico</option>';
  if (aulas.length > 0) {
    // Aulas vinculadas ao assunto selecionado (linkedAulaIds) vêm primeiro.
    const ordered = [...aulas].sort(
      (a, b) => Number(linkedIds.has(b.id)) - Number(linkedIds.has(a.id))
    );
    html += ordered
      .map((a) => {
        const nomeCompleto = esc(a.nome);
        const nomeCurto = esc(trunc(a.nome, 96));
        const prefixo = (a.estudada ? '✓ ' : '') + (linkedIds.has(a.id) ? '🔗 ' : '');
        return `<option value="${a.id}" title="${nomeCompleto}">${prefixo}${nomeCurto}</option>`;
      })
      .join('');
  }
  return html;
}

export function onDisciplinaChange() {
  const discId = document.getElementById('reg-disciplina')?.value;
  const assSelect = document.getElementById('reg-assunto');
  const aulaSelect = document.getElementById('reg-aula');
  const aulaContainer = document.getElementById('reg-aula-container');

  // Sessão multi-tópico é de UMA disciplina: trocar a disciplina com itens na
  // lista esvazia a lista (os ids de assunto/aula pertencem à anterior).
  if (_sessionTopicos.length > 0 && discId !== _sessionTopicosDiscId) {
    _sessionTopicos = [];
    renderSessionTopicosList();
    showToast('Lista de tópicos esvaziada: a sessão é de uma única disciplina.', 'info');
  }
  _sessionTopicosDiscId = discId || '';

  if (!assSelect) return;

  if (!discId) {
    assSelect.innerHTML = '<option value="">Selecione a disciplina primeiro</option>';
    if (aulaSelect)
      aulaSelect.innerHTML = '<option value="">Selecione a disciplina primeiro</option>';
    if (aulaContainer) aulaContainer.style.display = '';
    return;
  }

  const d = getDisc(discId);
  if (!d) return;

  const assuntos = d.disc.assuntos || [];
  if (assuntos.length > 0) {
    let html = '<option value="">Sem tópico específico</option>';
    html += assuntos
      .map((a) => {
        const nomeCompleto = esc(a.nome);
        const nomeCurto = esc(trunc(a.nome, 96));
        const prefixo = a.concluido ? '✓ ' : '';
        return `<option value="${a.id}" title="${nomeCompleto}">${prefixo}${nomeCurto}</option>`;
      })
      .join('');
    assSelect.innerHTML = html;
  } else {
    assSelect.innerHTML = '<option value="">Nenhum tópico cadastrado</option>';
  }

  const aulas = d.disc.aulas || [];
  if (aulaSelect && aulaContainer) {
    aulaSelect.innerHTML = buildAulaOptions(aulas);
    aulaContainer.style.display = '';
  }
}

/**
 * Assunto selecionado reordena o select de aulas: as vinculadas ao assunto
 * (linkedAulaIds) vêm primeiro, marcadas com 🔗.
 */
export function onAssuntoChange() {
  const discId = document.getElementById('reg-disciplina')?.value;
  const assId = document.getElementById('reg-assunto')?.value;
  const aulaSelect = document.getElementById('reg-aula');
  if (!aulaSelect || !discId) return;

  const d = getDisc(discId);
  if (!d) return;
  const ass = assId ? d.disc.assuntos?.find((a) => a.id === assId) : null;
  const linkedIds = new Set(ass?.linkedAulaIds || []);
  const selecionada = aulaSelect.value;
  aulaSelect.innerHTML = buildAulaOptions(d.disc.aulas || [], linkedIds);
  if (selecionada) aulaSelect.value = selecionada;
}

export function onAulaChange() {
  const inputTitulo = document.getElementById('reg-video-titulo');
  const aulaSelect = document.getElementById('reg-aula');
  if (!inputTitulo || !aulaSelect) return;

  // Preserve manually typed value; auto-fill only when empty.
  if ((inputTitulo.value || '').trim()) return;
  const aulaId = aulaSelect.value;
  if (!aulaId) return;

  const discId = document.getElementById('reg-disciplina')?.value || _currentEv?.discId || '';
  if (!discId) return;
  const d = getDisc(discId);
  const aula = d?.disc?.aulas?.find((a) => a.id === aulaId);
  if (aula?.nome) inputTitulo.value = aula.nome;
}

export function addNovoTopico() {
  const discId = document.getElementById('reg-disciplina')?.value;
  if (!discId) {
    showToast('Selecione uma disciplina primeiro', 'error');
    return;
  }

  const d = getDisc(discId);
  if (!d) return;

  document.getElementById('modal-prompt-title').textContent = 'Novo Tópico';
  document.getElementById('modal-prompt-body').innerHTML = `
    <div class="prompt-hint">
      Adicionar tópico em <strong>${esc(d.disc.nome)}</strong>
    </div>
    <input type="text" id="prompt-input-topico" class="form-control" placeholder="Nome do novo tópico..." autofocus>
  `;

  const saveBtn = document.getElementById('modal-prompt-save');
  saveBtn.onclick = () => {
    const nome = document.getElementById('prompt-input-topico')?.value.trim();
    if (!nome) {
      showToast('Informe o nome do tópico', 'error');
      return;
    }

    const novoTopico = {
      id: 'ass_' + uid(),
      nome,
      concluido: false,
      revisoesFetas: [],
    };

    d.disc.assuntos.push(novoTopico);
    scheduleSave();
    closeModal('modal-prompt');

    // Refresh topic select
    onDisciplinaChange();

    // Auto-select the new topic
    const assSelect = document.getElementById('reg-assunto');
    if (assSelect) assSelect.value = novoTopico.id;

    showToast(`Tópico "${nome}" criado!`, 'success');
  };

  openModal('modal-prompt');
  setTimeout(() => document.getElementById('prompt-input-topico')?.focus(), 100);
}

export function validateQuestoes() {
  const total = parseInt(document.getElementById('reg-q-total')?.value || '0');
  const ac = parseInt(document.getElementById('reg-q-acertos')?.value || '0');
  const er = parseInt(document.getElementById('reg-q-erros')?.value || '0');
  const fb = document.getElementById('reg-q-feedback');
  if (!fb) return;

  if (ac < 0 || er < 0) {
    fb.innerHTML =
      '<span class="reg-feedback-error">⚠️ Acertos e erros não podem ser negativos</span>';
  } else if ((ac + er > total && total > 0) || (total === 0 && ac + er > 0)) {
    fb.innerHTML =
      '<span class="reg-feedback-error">⚠️ Acertos + Erros não pode ser maior que o Total</span>';
  } else if (total > 0) {
    const pct = Math.round((ac / total) * 100);
    fb.innerHTML = `<span class="reg-feedback-success">${esc(pct)}% de aproveitamento</span>`;
  } else {
    fb.innerHTML = '';
  }
}

export function setPaginaMode(mode) {
  const simples = document.getElementById('pag-simples');
  const detalhado = document.getElementById('pag-detalhado');
  const btnSimples = document.getElementById('pag-modo-simples');
  const btnDetalhado = document.getElementById('pag-modo-detalhado');

  if (mode === 'simples') {
    if (simples) simples.style.display = '';
    if (detalhado) detalhado.style.display = 'none';
    if (btnSimples) btnSimples.classList.add('chip-active');
    if (btnDetalhado) btnDetalhado.classList.remove('chip-active');
  } else {
    if (simples) simples.style.display = 'none';
    if (detalhado) detalhado.style.display = '';
    if (btnSimples) btnSimples.classList.remove('chip-active');
    if (btnDetalhado) btnDetalhado.classList.add('chip-active');
  }
}

// =============================================
// SAVE — delegates to sub-module
// =============================================

export function saveRegistroSessao() {
  return performSave({
    currentEventId: _currentEventId,
    selectedTipos: _selectedTipos,
    selectedMateriais: _selectedMateriais,
    sessionStartTime: _sessionStartTime,
    sessionEndTime: _sessionEndTime,
    sessionMode: _sessionMode,
    sessionTopicos: _sessionTopicos,
  });
}

export function saveAndStartNew() {
  const success = saveRegistroSessao();
  if (!success) return;
  // Navigate to MED after the save's setTimeout(50ms) completes to avoid race condition
  setTimeout(() => {
    _currentEventId = null;
    _selectedTipos = [];
    _selectedMateriais = [];
    _sessionTopicos = [];
    _sessionTopicosDiscId = '';
    _savedTimerStart = null;
    _savedTempoAcumulado = 0;
    if (typeof navigate === 'function') navigate('med');
  }, 400);
}

// =============================================
// CANCEL / DISCARD / NAVIGATION
// =============================================

// Rollback timer state if user cancels the registro modal
export function cancelRegistro() {
  const isLivre = _currentEventId === 'crono_livre';
  const ev = isLivre ? state.cronoLivre : state.eventos.find((e) => e.id === _currentEventId);

  if (ev) {
    if (ev._isPastSession) {
      state.eventos = state.eventos.filter((e) => e.id !== _currentEventId);
      scheduleSave();
    } else if (_savedTimerStart) {
      ev._timerStart = _savedTimerStart;
      ev.tempoAcumulado = _savedTempoAcumulado;
    } else if (ev && !ev._timerStart) {
      ev._timerStart = null;
    }
  }

  _savedTimerStart = null;
  _savedTempoAcumulado = 0;
  closeModal('modal-registro-sessao');
  renderCurrentView();
}

// Proxies the discardTimer correctly inside modal
export function discardTimerUI(eventId) {
  closeModal('modal-registro-sessao');
  setTimeout(() => {
    discardTimer(eventId);
  }, 100);
}

export function voltarPastSessionUI(eventId, discId) {
  // Tombstone para o merge de sync não ressuscitar o evento descartado
  recordSyncTombstone(state, 'eventos', eventId);
  state.eventos = state.eventos.filter((e) => e.id !== eventId);
  scheduleSave();
  closeModal('modal-registro-sessao');
  setTimeout(() => {
    openAddPastSessionModal(discId);
  }, 100);
}

// Global deletion handler for previously registered sessions
function getLinkedPlanningSequenceForDeletedSession(eventToDelete) {
  const seqId = eventToDelete?.seqId;
  if (!seqId || !state.planejamento?.sequencia) return null;

  const seq = state.planejamento.sequencia.find((s) => s.id === seqId);
  if (!seq) return null;
  // Conclusão derivada (autoConcluida) reabre sozinha via reconciliação em
  // syncCicloToEventos — o prompt fica só para conclusões manuais.
  if (seq.autoConcluida) return null;

  const hasOtherCompletedSessionForSeq = state.eventos.some(
    (ev) => ev.id !== eventToDelete.id && ev.seqId === seqId && ev.status === 'estudei'
  );
  return hasOtherCompletedSessionForSeq ? null : seq;
}

function reopenPlanningSequence(seq) {
  seq.concluido = false;
  seq.status = 'pendente';
  delete seq.finalizadoEm;
  delete seq.puladaEm;
  delete seq.autoConcluida;
  touchPlanejamento();
  syncCicloToEventos();
  scheduleSave();
  renderCurrentView();
}

export function deleteCompletedSession(id) {
  showConfirm(
    'Tem certeza que deseja excluir permanentemente este registro de estudo do seu histórico?',
    () => {
      const ev = state.eventos.find((e) => e.id === id);
      const linkedSeqToReopen = getLinkedPlanningSequenceForDeletedSession(ev);
      // Tombstones para o merge de sync não ressuscitar a sessão nem os
      // registros de hábito vinculados em outro dispositivo.
      recordSyncTombstone(state, 'eventos', id);
      state.eventos = state.eventos.filter((e) => e.id !== id);
      Object.keys(state.habitos).forEach((tipo) => {
        if (state.habitos[tipo]) {
          for (const h of state.habitos[tipo]) {
            if (h.eventoId === id) recordSyncTombstone(state, `habitos.${tipo}`, h.id);
          }
          state.habitos[tipo] = state.habitos[tipo].filter((h) => h.eventoId !== id);
        }
      });
      // O renderCurrentView abaixo roda ANTES do app:invalidateCaches debounced
      // do scheduleSave (100ms) — sem invalidação explícita, o dashboard/home
      // re-renderizaria com a sessão excluída ainda contada nos caches.
      invalidateDashCaches();
      invalidateStreakCache();
      invalidatePendingRevCache();
      // Reconcilia o planejamento após a exclusão: etapas autoConcluida sem
      // sessões que as sustentem reabrem e a agenda é regenerada.
      syncCicloToEventos();
      scheduleSave();
      closeModal('modal-registro-sessao');
      renderCurrentView();
      showToast('Sessão excluída com sucesso.', 'info');
      if (linkedSeqToReopen) {
        showConfirm(
          'Reabrir esta etapa no planejamento? Se você confirmar, ela volta para pendente e novas previsões podem ser geradas.',
          () => {
            reopenPlanningSequence(linkedSeqToReopen);
            showToast('Etapa reaberta no planejamento.', 'info');
          },
          { title: 'Reabrir etapa', label: 'Reabrir etapa' }
        );
      }
    },
    { danger: true, label: 'Excluir', title: 'Excluir sessão' }
  );
}

// Listener para fechar modal via data-action - chama cancelRegistro para rollback do timer
document.addEventListener('click', (e) => {
  if (
    e.target.dataset.action === 'close-modal' &&
    e.target.dataset.modal === 'modal-registro-sessao'
  ) {
    cancelRegistro();
  }
});
