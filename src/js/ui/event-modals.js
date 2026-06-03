/**
 * Event Modals
 * Event creation, editing, and session registration modals
 */

import { state, scheduleSave } from '../store.js?v=8.37';
import { esc, todayStr, trunc, uid, getEventStatus, addCleanupListener } from '../utils.js?v=8.37';
import { getDisc, getActiveDisciplinas, reattachTimers } from '../logic.js?v=8.37';
import { filterEventsBySelectedEdital, getSelectedEditalId } from '../edital-filter.js?v=8.37';
import { renderCurrentView, renderEventCard } from '../components.js?v=8.37';
import { currentView, openModal, closeModal, showConfirm, showToast } from '../app.js?v=8.37';
import { openRegistroSessao } from '../registro-sessao.js?v=8.37';

// =============================================
// ADD EVENT MODAL
// =============================================
function allowAllEditaisInEventModal() {
  return currentView === 'home';
}

function getEventsInEventModalScope() {
  return filterEventsBySelectedEdital(state.eventos || [], {
    allowAll: allowAllEditaisInEventModal(),
  });
}

// Holds the id of the event currently being edited (null when creating a new one).
let editingEventId = null;

export function openAddEventModal(dateStr = null, editId = null) {
  const editEv = editId ? state.eventos.find((e) => e.id === editId) : null;
  editingEventId = editEv ? editEv.id : null;

  const selectedEditalId = getSelectedEditalId({ allowAll: allowAllEditaisInEventModal() });
  const allDiscs = getActiveDisciplinas().filter(
    ({ edital }) => !selectedEditalId || edital.id === selectedEditalId
  );
  const discOptions = allDiscs
    .map(
      ({ disc, edital }) =>
        `<option value="${disc.id}" data-edital="${edital.id}">${esc(edital.nome)} → ${esc(disc.nome)}</option>`
    )
    .join('');

  const defaultDate = editEv ? editEv.data : dateStr || todayStr();

  document.getElementById('modal-event-title').textContent = editEv
    ? 'Editar Estudo'
    : 'Iniciar Estudo';
  document.getElementById('modal-event-body').innerHTML = `
    <div id="event-conteudo-fields">
      <div class="form-group">
        <label class="form-label">Disciplina</label>
        <select class="form-control" id="event-disc" data-action="load-assuntos">
          <option value="">Sem disciplina específica</option>
          ${discOptions}
        </select>
      </div>
      <div class="form-group event-form-group--hidden" id="event-assunto-group">
        <label class="form-label">Tópico do Edital (opcional)</label>
        <select class="form-control" id="event-assunto">
          <option value="">Sem tópico específico</option>
        </select>
      </div>
      <div class="form-group event-form-group--hidden mt-3" id="event-aula-group">
        <label class="form-label event-form-label--inline">
          Material / Aula (opcional)
        </label>
        <select class="form-control" id="event-aula">
          <option value="">Sem material/aula específica</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Título do Evento</label>
      <input type="text" class="form-control" id="event-titulo" placeholder="Ex: Estudar Direito Constitucional">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Data</label>
        <input type="date" class="form-control" id="event-data" value="${defaultDate}"
          data-action="update-day-load">
        <div id="day-load-hint" class="event-form-hint"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Duração Prevista</label>
        <select class="form-control" id="event-duracao">
          <option value="30">30 min</option>
          <option value="60" selected>1 hora</option>
          <option value="90">1h30</option>
          <option value="120">2 horas</option>
          <option value="180">3 horas</option>
          <option value="240">4 horas</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Anotações (opcional)</label>
      <textarea class="form-control" id="event-notas" rows="2" placeholder="Observações rápidas sobre o estudo..."></textarea>
    </div>
    <details class="event-form-details">
      <summary>📝 Fontes e referências (opcional)</summary>
      <div class="event-form-details-content">
        <div class="form-group event-form-group--compact">
          <label class="form-label">Fontes de Estudo</label>
          <input type="text" class="form-control" id="event-fontes" placeholder="Ex: Gran Cursos pág. 45, Art. 37 CF/88...">
        </div>
        <div class="form-group event-form-group--compact">
          <label class="form-label">Legislação Pertinente</label>
          <input type="text" class="form-control" id="event-legislacao" placeholder="Ex: Lei 8.112/90, CF Art. 5º...">
        </div>
      </div>
    </details>
    <div class="modal-footer-standard--padded">
      <button class="btn btn-ghost" data-action="close-modal" data-modal="modal-event">Cancelar</button>
      <button class="btn btn-primary" data-action="save-event">${editEv ? 'Salvar' : 'Salvar / Iniciar'}</button>
    </div>
  `;
  openModal('modal-event');

  if (editEv) {
    // Editing replaces the detail modal — close it so only the edit form is shown.
    closeModal('modal-event-detail');
    prefillEventForm(editEv);
  }

  requestAnimationFrame(() => updateDayLoad(defaultDate));
}

// Populate the event form fields from an existing event (edit mode).
function prefillEventForm(ev) {
  const discSel = document.getElementById('event-disc');
  if (discSel && ev.discId) {
    discSel.value = ev.discId;
    // Build the dependent assunto/aula selects for this disciplina, then
    // restore the previously chosen options.
    loadAssuntos();
    const assSel = document.getElementById('event-assunto');
    const aulaSel = document.getElementById('event-aula');
    if (assSel && ev.assId) assSel.value = ev.assId;
    if (aulaSel && ev.aulaId) aulaSel.value = ev.aulaId;
  }

  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '';
  };
  // Title is set last so loadAssuntos' auto-fill does not overwrite it.
  const tituloInput = document.getElementById('event-titulo');
  if (tituloInput) {
    tituloInput.value = ev.titulo || '';
    tituloInput.dataset.autoFilled = 'false';
  }
  setVal('event-duracao', String(ev.duracao || 60));
  setVal('event-notas', ev.notas);
  setVal('event-fontes', ev.fontes);
  setVal('event-legislacao', ev.legislacao);
}

// Tech 3: Real-time day-load hint
export function updateDayLoad(dateStr) {
  const el = document.getElementById('day-load-hint');
  if (!el || !dateStr) return;
  const evts = getEventsInEventModalScope().filter((e) => e.data === dateStr && e.status !== 'estudei');
  const mins = evts.reduce((s, e) => s + (e.duracao || 0), 0);
  if (evts.length === 0) {
    el.textContent = '📅 Dia livre';
    el.style.color = 'var(--accent)';
  } else {
    const horas = (mins / 60).toFixed(1);
    const color = mins > 480 ? 'var(--red)' : mins > 300 ? 'var(--orange)' : 'var(--text-muted)';
    el.textContent = `⚠️ ${evts.length} evento(s) já agendado(s) neste dia — ${horas}h previstas`;
    el.style.color = color;
  }
}

export function loadAssuntos() {
  const discId = document.getElementById('event-disc').value;
  const assuntoGroup = document.getElementById('event-assunto-group');
  const assuntoSel = document.getElementById('event-assunto');
  const aulaGroup = document.getElementById('event-aula-group');
  const aulaSel = document.getElementById('event-aula');

  if (!discId) {
    assuntoGroup.style.display = 'none';
    if (aulaGroup) aulaGroup.style.display = 'none';
    return;
  }

  const d = getDisc(discId);
  const tituloInput = document.getElementById('event-titulo');
  if (d && (!tituloInput.value || tituloInput.dataset.autoFilled === 'true')) {
    tituloInput.value = `Estudar ${d.disc.nome} `;
    tituloInput.dataset.autoFilled = 'true';
  }

  if (!d) return;

  const pendingAssuntos = d.disc.assuntos.filter((a) => !a.concluido);
  if (pendingAssuntos.length > 0) {
    let html = '<option value="">Sem tópico específico</option>';
    html += pendingAssuntos
      .map((a) => `<option value="${a.id}" title="${esc(a.nome)}">${esc(trunc(a.nome))}</option>`)
      .join('');
    assuntoSel.innerHTML = html;
    assuntoGroup.style.display = '';
  } else {
    assuntoGroup.style.display = 'none';
  }

  const aulas = d.disc.aulas || [];
  const pendingAulas = aulas.filter((a) => !a.estudada);
  if (pendingAulas.length > 0 && aulaGroup && aulaSel) {
    let ht = '<option value="">Sem material/aula específico</option>';
    ht += pendingAulas
      .map((a) => `<option value="${a.id}" title="${esc(a.nome)}">${esc(trunc(a.nome))}</option>`)
      .join('');
    aulaSel.innerHTML = ht;
    aulaGroup.style.display = '';
  } else if (aulaGroup) {
    aulaGroup.style.display = 'none';
  }

  const buildTitle = () => {
    const rawAss = assuntoSel.value;
    const rawAul = aulaSel ? aulaSel.value : '';
    let name = '';

    if (rawAul) {
      const aulaObj = d.disc.aulas?.find((a) => a.id === rawAul);
      if (aulaObj) name = aulaObj.nome;
    } else if (rawAss) {
      const assObj = d.disc.assuntos?.find((a) => a.id === rawAss);
      if (assObj) name = assObj.nome;
    }

    if (name) {
      tituloInput.value = name;
      tituloInput.dataset.autoFilled = 'true';
    } else {
      tituloInput.value = `Estudar ${d.disc.nome} `;
    }
  };

  assuntoSel.onchange = () => {
    if (!tituloInput.value || tituloInput.dataset.autoFilled === 'true') buildTitle();
  };
  if (aulaSel)
    aulaSel.onchange = () => {
      if (!tituloInput.value || tituloInput.dataset.autoFilled === 'true') buildTitle();
    };
}

// Clear auto-filled flag if user manually types in title
addCleanupListener(document, 'input', (e) => {
  if (e.target && e.target.id === 'event-titulo') {
    e.target.dataset.autoFilled = 'false';
  }
});

export function saveEvent() {
  const titulo = document.getElementById('event-titulo').value.trim();
  const data = document.getElementById('event-data').value;
  const duracao = parseInt(document.getElementById('event-duracao').value || '60');
  const notas = document.getElementById('event-notas').value.trim();
  const fontes = document.getElementById('event-fontes')?.value.trim() || '';
  const legislacao = document.getElementById('event-legislacao')?.value.trim() || '';

  const discId = document.getElementById('event-disc')?.value || '';
  const assId = document.getElementById('event-assunto')?.value || '';
  const aulaId = document.getElementById('event-aula')?.value || '';
  let autoTitle = titulo;

  if (!titulo && discId) {
    const d = getDisc(discId);
    autoTitle = `Estudar ${d?.disc.nome || 'Disciplina'} `;
  }

  if (!autoTitle) {
    showToast('Informe um título para o evento', 'error');
    return;
  }

  // Edit mode: update the existing event in place instead of creating a new one.
  if (editingEventId) {
    const ev = state.eventos.find((e) => e.id === editingEventId);
    if (ev) {
      ev.titulo = autoTitle;
      ev.data = data;
      ev.duracao = duracao;
      ev.notas = notas;
      ev.fontes = fontes;
      ev.legislacao = legislacao;
      ev.discId = discId || null;
      ev.assId = assId || null;
      ev.aulaId = aulaId || null;
    }
    editingEventId = null;
    scheduleSave();
    closeModal('modal-event');
    renderCurrentView();
    showToast('Evento atualizado!', 'success');
    return;
  }

  const doSave = () => {
    const evento = {
      id: 'ev_' + uid(),
      titulo: autoTitle,
      data,
      duracao,
      notas,
      fontes,
      legislacao,
      status: 'agendado',
      tempoAcumulado: 0,
      tipo: 'conteudo',
      discId: discId || null,
      assId: assId || null,
      aulaId: aulaId || null,
      habito: null,
      criadoEm: new Date().toISOString(),
    };

    state.eventos.push(evento);
    scheduleSave();
    closeModal('modal-event');
    renderCurrentView();
    showToast('Estudo iniciado/agendado!', 'success');
  };

  const existingOnDay = getEventsInEventModalScope().filter(
    (e) => e.data === data && e.status !== 'estudei'
  );
  const totalDuracao = existingOnDay.reduce((s, e) => s + (e.duracao || 0), 0) + duracao;
  if (existingOnDay.length >= 3 || totalDuracao > 480) {
    const horas = Math.round((totalDuracao / 60) * 10) / 10;
    const msg =
      existingOnDay.length >= 3
        ? `Você já tem ${existingOnDay.length} evento(s) neste dia. Adicionar mais pode gerar sobrecarga.`
        : `Você já tem ${Math.round(((totalDuracao - duracao) / 60) * 10) / 10}h agendadas neste dia. Com este evento seriam ${horas}h.`;
    showConfirm(msg, doSave, { label: 'Adicionar mesmo assim', title: 'Muitos eventos no dia' });
    return;
  }

  doSave();
}

// =============================================
// REGISTRO DE SESSÃO ANTERIOR (DIRETO)
// =============================================
export function openAddPastSessionModal(discId) {
  const d = getDisc(discId);
  if (!d) return;

  let assuntoOptions = '<option value="">Sem tópico específico</option>';

  const assuntos = d.disc.assuntos || [];
  if (assuntos.length > 0) {
    assuntoOptions += assuntos
      .map(
        (a) =>
          `<option value="${a.id}" title="${esc(a.nome)}">${a.concluido ? '✅ ' : ''}${esc(trunc(a.nome, 100))}</option>`
      )
      .join('');
  }

  let aulaOptions = '<option value="">Sem material/aula específico</option>';
  const aulas = d.disc.aulas || [];
  if (aulas.length > 0) {
    aulaOptions += aulas
      .map(
        (a) =>
          `<option value="${a.id}" title="${esc(a.nome)}">${a.estudada ? '✅ ' : ''}${esc(trunc(a.nome, 100))}</option>`
      )
      .join('');
  }

  document.getElementById('modal-event-title').textContent = 'Registrar Sessão Anterior';
  document.getElementById('modal-event-body').innerHTML = `
    <div class="config-sub">
      Disciplina: <strong>${esc(d.disc.nome)}</strong>
    </div>
    
    <div class="form-group" id="event-assunto-group">
      <label class="form-label">Tópico do Edital (opcional)</label>
      <select class="form-control" id="past-event-assunto">
        ${assuntoOptions}
      </select>
    </div>

    <div class="form-group mt-3" id="event-aula-group">
      <label class="form-label">Material / Aula (opcional)</label>
      <select class="form-control" id="past-event-aula">
        ${aulaOptions}
      </select>
    </div>

    <div class="form-row mt-5">
      <div class="form-group">
        <label class="form-label">Data do Estudo</label>
        <input type="date" class="form-control" id="past-event-data" value="${todayStr()}">
      </div>
      <div class="form-group">
        <label class="form-label">Tempo Estudado (minutos)</label>
        <input type="number" class="form-control" id="past-event-duracao" value="60" min="1">
      </div>
    </div>
    
    <div class="modal-footer-standard--padded">
      <button class="btn btn-ghost" data-action="close-modal" data-modal="modal-event">Cancelar</button>
      <button class="btn btn-primary" data-action="save-past-event" data-disc-id="${discId}">Continuar Registro</button>
    </div>
  `;
  openModal('modal-event');
}

export function savePastEvent(discId) {
  const d = getDisc(discId);
  const data = document.getElementById('past-event-data').value;
  const duracao = parseInt(document.getElementById('past-event-duracao').value, 10) || 60;

  const assId = document.getElementById('past-event-assunto')?.value || null;
  const aulaId = document.getElementById('past-event-aula')?.value || null;

  if (!data || duracao <= 0) {
    showToast('Preencha a data e o tempo estudado corretamente.', 'error');
    return;
  }

  let assuntoNome = '';

  if (aulaId) {
    const achado = d.disc.aulas?.find((a) => a.id === aulaId);
    if (achado) assuntoNome = ' — ' + achado.nome;
  } else if (assId) {
    const achado = d.disc.assuntos?.find((a) => a.id === assId);
    if (achado) assuntoNome = ' — ' + achado.nome;
  }

  const evento = {
    id: 'ev_' + uid(),
    titulo: d.disc.nome + assuntoNome,
    data: data,
    status: 'agendado',
    duracao: duracao,
    tempoAcumulado: duracao * 60,
    discId: discId,
    assId: assId,
    aulaId: aulaId,
    sessao: {},
    _isPastSession: true,
  };

  state.eventos.push(evento);
  scheduleSave();
  closeModal('modal-event');

  openRegistroSessao(evento.id);
}

// =============================================
// EVENT DETAIL MODAL
// =============================================
export function openEventDetail(eventId) {
  const ev = state.eventos.find((e) => e.id === eventId);
  if (!ev) return;

  const disc = ev.discId ? getDisc(ev.discId) : null;
  // getEventStatus returns a string ('estudei' | 'agendado' | 'atrasado').
  // Map it to the label/class the modal renders.
  const statusKey = getEventStatus(ev);
  const STATUS_VIEW = {
    estudei: { label: 'Concluído', class: 'badge-success' },
    agendado: { label: 'Agendado', class: 'badge-muted' },
    atrasado: { label: 'Atrasado', class: 'badge-danger' },
  };
  const status = STATUS_VIEW[statusKey] || { label: statusKey || '—', class: 'badge-muted' };

  const title = document.getElementById('modal-event-detail-title');
  const body = document.getElementById('modal-event-detail-body');
  if (!title || !body) {
    console.error('openEventDetail: elementos do modal de evento não encontrados');
    return;
  }

  title.textContent = ev.titulo;

  const editBtn = document.getElementById('modal-event-detail-edit');
  const deleteBtn = document.getElementById('modal-event-detail-delete');
  if (editBtn) editBtn.dataset.eventId = eventId;
  if (deleteBtn) deleteBtn.dataset.eventId = eventId;

  body.innerHTML = `
    <div class="event-detail-grid">
      <div class="event-detail-field">
        <div class="event-detail-label">Status</div>
        <div class="event-detail-value"><span class="badge ${status.class}">${status.label}</span></div>
      </div>
      <div class="event-detail-field">
        <div class="event-detail-label">Data</div>
        <div class="event-detail-value">${ev.data || '—'}</div>
      </div>
      <div class="event-detail-field">
        <div class="event-detail-label">Duração</div>
        <div class="event-detail-value">${ev.duracao ? `${ev.duracao} min` : '—'}</div>
      </div>
      <div class="event-detail-field">
        <div class="event-detail-label">Tempo Acumulado</div>
        <div class="event-detail-value">${ev.tempoAcumulado > 0 ? formatTime(ev.tempoAcumulado) : '—'}</div>
      </div>
      ${
        disc
          ? `
        <div class="event-detail-field">
          <div class="event-detail-label">Disciplina</div>
          <div class="event-detail-value">${disc.disc.icone || '📚'} ${esc(disc.disc.nome)}</div>
        </div>
      `
          : ''
      }
      ${
        ev.assId
          ? `
        <div class="event-detail-field">
          <div class="event-detail-label">Assunto</div>
          <div class="event-detail-value">${esc(getAssuntoName(ev.discId, ev.assId))}</div>
        </div>
      `
          : ''
      }
      ${
        ev.aulaId
          ? `
        <div class="event-detail-field">
          <div class="event-detail-label">Aula</div>
          <div class="event-detail-value">${esc(getAulaName(ev.discId, ev.aulaId))}</div>
        </div>
      `
          : ''
      }
      ${
        ev.notas
          ? `
        <div class="event-detail-field event-detail-field--full">
          <div class="event-detail-label">Anotações</div>
          <div class="event-detail-value event-detail-notes">${esc(ev.notas)}</div>
        </div>
      `
          : ''
      }
      ${
        ev.fontes
          ? `
        <div class="event-detail-field event-detail-field--full">
          <div class="event-detail-label">Fontes</div>
          <div class="event-detail-value">${esc(ev.fontes)}</div>
        </div>
      `
          : ''
      }
      ${
        ev.legislacao
          ? `
        <div class="event-detail-field event-detail-field--full">
          <div class="event-detail-label">Legislação</div>
          <div class="event-detail-value">${esc(ev.legislacao)}</div>
        </div>
      `
          : ''
      }
    </div>
  `;

  openModal('modal-event-detail');
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

function getAssuntoName(discId, assId) {
  const d = getDisc(discId);
  if (!d) return '';
  const a = d.disc.assuntos?.find((x) => x.id === assId);
  return a ? a.nome : '';
}

function getAulaName(discId, aulaId) {
  const d = getDisc(discId);
  if (!d) return '';
  const a = d.disc.aulas?.find((x) => x.id === aulaId);
  return a ? a.nome : '';
}

export function refreshEventCard(eventId) {
  const card = document.querySelector(`.event-card[data-event-id="${eventId}"]`);
  if (!card) {
    renderCurrentView();
    reattachTimers();
    return;
  }
  const ev = state.eventos.find((e) => e.id === eventId);
  if (!ev) return;
  const template = document.createElement('template');
  template.innerHTML = renderEventCard(ev).trim();
  const newCard = template.content.firstElementChild;
  if (newCard) card.replaceWith(newCard);
  reattachTimers();
}

export function removeDOMCard(eventId) {
  const card = document.querySelector(`[data-event-id="${eventId}"]`);
  if (card) card.remove();
}
