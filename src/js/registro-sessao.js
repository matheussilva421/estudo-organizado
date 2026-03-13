// =============================================
// REGISTRO DA SESSÃO DE ESTUDO
// Módulo dedicado ao registro pós-sessão
// =============================================

import { state, scheduleSave } from './store.js?v=8.2';
import { getAllDisciplinas, getDisc, getElapsedSeconds, _pomodoroMode, timerIntervals } from './logic.js?v=8.2';
import { openModal, closeModal, showToast, showConfirm } from './app.js?v=8.2';
import { todayStr, esc, uid } from './utils.js?v=8.2';
import { renderCurrentView, updateBadges } from './components.js?v=8.2';

// =============================================
// STUDY TYPES & MATERIALS DEFINITIONS
// =============================================

const TIPOS_ESTUDO = [
  { id: 'questoes', label: 'Questões', icon: '❓' },
  { id: 'revisao', label: 'Revisão', icon: '🔄' },
  { id: 'leitura', label: 'Leitura seca', icon: '📖' },
  { id: 'informativo', label: 'Informativos', icon: '📰' },
  { id: 'discursiva', label: 'Discursiva', icon: '✍️' },
  { id: 'simulado', label: 'Simulado', icon: '📝' },
  { id: 'sumula', label: 'Súmulas', icon: '⚖️' },
  { id: 'videoaula', label: 'Vídeoaula', icon: '🎬' },
];

const MATERIAIS = [
  { id: 'pdf', label: 'PDF', icon: '📄' },
  { id: 'livro', label: 'Livro', icon: '📕' },
  { id: 'lei_seca', label: 'Lei seca', icon: '⚖️' },
  { id: 'caderno', label: 'Caderno', icon: '📓' },
  { id: 'videoaula_mat', label: 'Vídeoaula', icon: '🎬' },
  { id: 'flashcards', label: 'Flashcards / Anki', icon: '🃏' },
  { id: 'jurisprudencia', label: 'Jurisprudência', icon: '🏛️' },
  { id: 'informativo_mat', label: 'Informativo', icon: '📰' },
  { id: 'outro', label: 'Outro', icon: '📦' },
];

// Internal state for the form
let _selectedTipos = [];
let _selectedMateriais = [];
let _currentEventId = null;
let _sessionStartTime = null;
let _sessionEndTime = null;
let _sessionMode = 'cronometro';
let _savedTimerStart = null;
let _savedTempoAcumulado = 0;
let _currentEv = null;

// =============================================
// OPEN REGISTRO SESSÃO
// =============================================

export function openRegistroSessao(eventId) {
  let ev = null;
  if (eventId === 'crono_livre') {
    ev = { ...state.cronoLivre, id: 'crono_livre', sessao: {} };
  } else {
    ev = state.eventos.find(e => e.id === eventId);
    if (!ev) { showToast('Evento não encontrado', 'error'); return; }
  }

  // Save timer state for rollback if user cancels
  _savedTimerStart = ev._timerStart || null;
  _savedTempoAcumulado = ev.tempoAcumulado || 0;

  // Stop timer if running
  if (ev._timerStart) {
    ev.tempoAcumulado = getElapsedSeconds(ev);
    _sessionEndTime = new Date();
    _sessionStartTime = new Date(ev._timerStart);
    delete ev._timerStart;
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

  // Build and render the form
  const body = document.getElementById('modal-registro-body');
  if (body) {
    body.innerHTML = renderRegistroForm(ev);
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
          }
        }
      }
    }
  }, 100);
}

// =============================================
// RENDER FORM HTML
// =============================================

function renderRegistroForm(ev) {
  const elapsed = ev.tempoAcumulado || 0;
  const fmtTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const horaInicio = _sessionStartTime ? _sessionStartTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
  const horaFim = _sessionEndTime ? _sessionEndTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  let dataStr = '';
  if (ev.data) {
    // ev.data is usually YYYY-MM-DD
    const parts = ev.data.split('-');
    if (parts.length === 3) {
      dataStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
    } else {
      dataStr = ev.data;
    }
  } else {
    dataStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  const modeLabel = _sessionMode === 'pomodoro' ? `🍅 Pomodoro (${state?.config?.pomodoroFoco || 25}/${state?.config?.pomodoroPausa || 5})` : '⏱ Cronômetro';


  // Discipline options
  const allDiscs = getAllDisciplinas();
  const discOptions = allDiscs.map(d =>
    `<option value="${d.disc.id}">${d.disc.icone || '📖'} ${d.disc.nome} — ${d.edital.nome}</option>`
  ).join('');

  // Study type chips
  const tipoChips = TIPOS_ESTUDO.map(t => {
    const sel = _selectedTipos.includes(t.id);
    return `<button type="button" class="chip ${sel ? 'chip-active' : ''}"
      onclick="toggleStudyType('${t.id}')"
      data-tipo="${t.id}">
      ${t.icon} ${t.label}
    </button>`;
  }).join('');

  // Material chips
  const materialChips = MATERIAIS.map(m => {
    const sel = _selectedMateriais.includes(m.id);
    return `<button type="button" class="chip ${sel ? 'chip-active' : ''}"
      onclick="toggleMaterial('${m.id}')"
      data-mat="${m.id}">
      ${m.icon} ${m.label}
    </button>`;
  }).join('');

  return `
    <!-- 1) RESUMO DA SESSÃO -->
    <div class="reg-block reg-summary">
      <div class="reg-summary-grid">
        <div class="reg-stat">
          <div class="reg-stat-label">Tempo estudado ${ev.status === 'estudei' || ev._isPastSession ? '(minutos)' : ''}</div>
          <div class="reg-stat-value" style="color:var(--green);font-family:'DM Mono',monospace;font-size:24px;">
            ${ev.status === 'estudei' || ev._isPastSession ? 
              `<input type="number" id="reg-tempo-mins" class="reg-input" value="${Math.round(elapsed / 60)}" min="1" style="width:100px;text-align:center;font-size:20px;padding:4px;">` : 
              fmtTime(elapsed)}
          </div>
        </div>
        <div class="reg-stat">
          <div class="reg-stat-label">Data</div>
          <div class="reg-stat-value">
            ${ev.status === 'estudei' || ev._isPastSession ? 
              `<input type="date" id="reg-data-estudo" class="reg-input" value="${ev.data || todayStr()}" style="width:140px;font-size:14px;padding:4px;">` : 
              dataStr}
          </div>
        </div>
        <div class="reg-stat">
          <div class="reg-stat-label">Horário</div>
          <div class="reg-stat-value">${horaInicio} — ${horaFim}</div>
        </div>
        <div class="reg-stat">
          <div class="reg-stat-label">Modo</div>
          <div class="reg-stat-value">${modeLabel}</div>
        </div>
      </div>
    </div>

    <!-- 2) O QUE FOI ESTUDADO -->
    <div class="reg-block">
      <h3 class="reg-block-title">📚 O que foi estudado</h3>
      <div class="reg-row">
        <div class="reg-field" style="flex:1;">
          <label class="reg-label">Disciplina <span class="req">*</span></label>
          <select id="reg-disciplina" class="reg-select" onchange="onDisciplinaChange()">
            <option value="">Selecione uma disciplina...</option>
            ${discOptions}
          </select>
        </div>
      </div>
      <div class="reg-row" style="flex-direction:column; gap:12px;">
        <div class="reg-field" style="flex:1;">
          <label class="reg-label">Tópico do Edital (opcional)</label>
          <div style="display:flex;gap:8px;">
            <select id="reg-assunto" class="reg-select" style="flex:1;">
              <option value="">Selecione a disciplina primeiro</option>
            </select>
            <button type="button" class="btn-inline" onclick="addNovoTopico()" title="Criar novo tópico">
              + Novo
            </button>
          </div>
        </div>
        <div class="reg-field" id="reg-aula-container" style="flex:1; display:none;">
          <label class="reg-label">Material / Aula (opcional)</label>
          <select id="reg-aula" class="reg-select" style="flex:1;">
            <option value="">Selecione a disciplina primeiro</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 3) COMO FOI ESTUDADO -->
    <div class="reg-block">
      <h3 class="reg-block-title">🎯 Tipo de estudo na sessão <span class="req">*</span></h3>
      <div class="chip-group" id="tipo-chips">
        ${tipoChips}
      </div>
    </div>

    <div class="reg-block">
      <h3 class="reg-block-title">🧰 Materiais utilizados</h3>
      <div class="chip-group" id="material-chips">
        ${materialChips}
      </div>
      <div class="reg-field" style="margin-top:12px;">
        <input type="text" id="reg-material-detalhe" class="reg-input"
          placeholder="Detalhe do material (ex.: Aula 03 Estratégia, CF/88 arts. 5º ao 17)">
      </div>
    </div>

    <!-- 4) RESULTADOS DA SESSÃO -->
    <div id="reg-resultados">
      ${renderConditionalFields()}
    </div>

    <!-- 5) PROGRESSO DO TÓPICO -->
    <div class="reg-block">
      <h3 class="reg-block-title">📈 Progresso do tópico</h3>
      <div class="reg-field">
        <label class="reg-label">Status do tópico/assunto</label>
        <select id="reg-status-topico" class="reg-select">
          <option value="nao_iniciado">Não iniciado</option>
          <option value="em_andamento" selected>Em andamento</option>
          <option value="finalizado">Finalizado nesta sessão ✅</option>
        </select>
      </div>
    </div>

    <!-- 6) COMENTÁRIOS -->
    <div class="reg-block">
      <h3 class="reg-block-title">💬 Comentários / Observações</h3>
      <textarea id="reg-comentarios" class="reg-textarea" rows="3"
        placeholder="Dificuldades, pontos de revisão, pegadinhas...">${ev.sessao?.comentarios || ''}</textarea>
    </div>

    <div class="reg-block">
      <div style="flex:1;">
        <h3 class="reg-block-title">Resumo / Detalhes <small style="color:var(--text-secondary);font-weight:400;">(Opcional)</small></h3>
        <textarea id="reg-observacao" class="reg-textarea" placeholder="Anotações, comentários ou percepções sobre o que você estudou hoje..." wrap="soft" spellcheck="true">${ev.sessao?.observacoes || ''}</textarea>
      </div>
    </div>

    <!-- 7) AÇÕES / FOOTER -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:32px; padding-top:24px; border-top:1px solid rgba(255,255,255,0.08);">
      ${ev.status === 'estudei' && !ev._isPastSession ? 
        `<button type="button" class="btn-outline" style="color:#f85149; border-color:rgba(248,81,73,0.3); background:rgba(248,81,73,0.05);" onclick="deleteCompletedSession('${ev.id}')">
          <i class="fa fa-trash"></i> Excluir
        </button>`
        : ev._isPastSession ? 
        `<button type="button" class="btn-outline" onclick="voltarPastSessionUI('${_currentEventId}', '${ev.discId}')">
          <i class="fa fa-arrow-left"></i> Voltar
        </button>` 
        : 
        `<button type="button" class="btn-outline" style="color:#f85149; border-color:rgba(248,81,73,0.3); background:rgba(248,81,73,0.05);" onclick="discardTimerUI('${_currentEventId}')">
          <i class="fa fa-trash"></i> Descartar
        </button>`
      }

      <div style="display:flex; gap:12px; justify-content:flex-end; flex:1;">
        <button type="button" class="btn-outline" onclick="cancelRegistro()">Cancelar</button>
        ${!ev._isPastSession && ev.status !== 'estudei' ? `
        <button type="button" class="btn-outline" onclick="saveAndStartNew()" style="color:var(--green); border-color:rgba(57,211,83,0.4);">
          Salvar e iniciar nova ↻
        </button>` : ''}
        <button type="button" class="btn-primary" onclick="saveRegistroSessao()" style="font-weight:600; padding:12px 24px;">
          <i class="fa fa-save"></i> ${ev.status === 'estudei' && !ev._isPastSession ? 'Salvar Alterações' : 'Salvar Registro'}
        </button>
      </div>
    </div>
  `;
}

// =============================================
// CONDITIONAL FIELDS (Resultados)
// =============================================

function renderConditionalFields() {
  const showQuestoes = _selectedTipos.includes('questoes') || _selectedTipos.includes('simulado');
  const showPaginas = ['leitura', 'informativo', 'sumula'].some(t => _selectedTipos.includes(t)) ||
    ['pdf', 'livro', 'lei_seca', 'informativo_mat'].some(m => _selectedMateriais.includes(m));
  const showVideo = _selectedTipos.includes('videoaula');

  if (!showQuestoes && !showPaginas && !showVideo) {
    return '<div class="reg-block" style="opacity:0.5;text-align:center;padding:16px;"><em>Selecione tipos de estudo para preencher resultados</em></div>';
  }

  let html = '<div class="reg-block"><h3 class="reg-block-title">📊 Resultados da sessão</h3>';

  if (showQuestoes) {
    const qs = _currentEv.sessao?.questoes || {};
    html += `
      <div class="reg-results-card">
        <div class="reg-results-header">❓ Questões</div>
        <div class="reg-row" style="gap:12px;">
          <div class="reg-field">
            <label class="reg-label">Total</label>
            <input type="number" id="reg-q-total" class="reg-input" min="0" placeholder="0"
              value="${qs.total || ''}" oninput="validateQuestoes()">
          </div>
          <div class="reg-field">
            <label class="reg-label" style="color:var(--green);">Acertos</label>
            <input type="number" id="reg-q-acertos" class="reg-input" min="0" placeholder="0"
              value="${qs.acertos || qs.certas || ''}" oninput="validateQuestoes()">
          </div>
          <div class="reg-field">
            <label class="reg-label" style="color:var(--red);">Erros</label>
            <input type="number" id="reg-q-erros" class="reg-input" min="0" placeholder="0"
              value="${qs.erros || qs.erradas || ''}" oninput="validateQuestoes()">
          </div>
        </div>
        <div id="reg-q-feedback" style="font-size:12px;margin-top:4px;"></div>
      </div>
    `;
  }

  if (showPaginas) {
    const pg = _currentEv.sessao?.paginas || {};
    const modo = pg.modo || 'simples';
    html += `
      <div class="reg-results-card">
        <div class="reg-results-header">📖 Páginas lidas</div>
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <button type="button" class="chip ${modo === 'simples' ? 'chip-active' : ''}" id="pag-modo-simples"
            onclick="setPaginaMode('simples')">Simples</button>
          <button type="button" class="chip ${modo === 'detalhado' ? 'chip-active' : ''}" id="pag-modo-detalhado"
            onclick="setPaginaMode('detalhado')">Detalhado</button>
        </div>
        <div id="pag-simples" style="${modo === 'simples' ? '' : 'display:none;'}">
          <div class="reg-field">
            <label class="reg-label">Total de páginas</label>
            <input type="number" id="reg-pag-total" class="reg-input" min="0" placeholder="0" value="${pg.total || ''}">
          </div>
        </div>
        <div id="pag-detalhado" style="${modo === 'detalhado' ? '' : 'display:none;'}">
          <div class="reg-row" style="gap:12px;">
            <div class="reg-field">
              <label class="reg-label">Página inicial</label>
              <input type="number" id="reg-pag-inicio" class="reg-input" min="0" placeholder="0" value="${pg.inicio || ''}">
            </div>
            <div class="reg-field">
              <label class="reg-label">Página final</label>
              <input type="number" id="reg-pag-fim" class="reg-input" min="0" placeholder="0" value="${pg.fim || ''}">
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (showVideo) {
    const vid = _currentEv.sessao?.videoaula || {};
    html += `
      <div class="reg-results-card">
        <div class="reg-results-header">🎬 Vídeoaula</div>
        <div class="reg-field" style="margin-bottom:8px;">
          <label class="reg-label">Título da aula</label>
          <input type="text" id="reg-video-titulo" class="reg-input" placeholder="Ex.: Aula 05 - Direito Constitucional" value="${vid.titulo || ''}">
        </div>
        <div class="reg-field">
          <label class="reg-label">Tempo assistido (minutos)</label>
          <input type="number" id="reg-video-tempo" class="reg-input" min="0" placeholder="0" value="${vid.tempoMin || ''}">
        </div>
      </div>
    `;
  }

  html += '</div>';
  return html;
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
  if (container) container.innerHTML = renderConditionalFields();
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
  if (container) container.innerHTML = renderConditionalFields();
}

export function onDisciplinaChange() {
  const discId = document.getElementById('reg-disciplina')?.value;
  const assSelect = document.getElementById('reg-assunto');
  const aulaSelect = document.getElementById('reg-aula');
  const aulaContainer = document.getElementById('reg-aula-container');
  if (!assSelect) return;

  if (!discId) {
    assSelect.innerHTML = '<option value="">Selecione a disciplina primeiro</option>';
    if (aulaSelect) aulaSelect.innerHTML = '<option value="">Selecione a disciplina primeiro</option>';
    if (aulaContainer) aulaContainer.style.display = '';
    return;
  }

  const d = getDisc(discId);
  if (!d) return;

  const assuntos = d.disc.assuntos || [];
  if (assuntos.length > 0) {
    let html = '<option value="">Sem tópico específico</option>';
    html += assuntos.map(a => `<option value="${a.id}">${a.concluido ? '✅ ' : ''}${esc(a.nome)}</option>`).join('');
    assSelect.innerHTML = html;
  } else {
    assSelect.innerHTML = '<option value="">Nenhum tópico cadastrado</option>';
  }

  const aulas = d.disc.aulas || [];
  const pendingAulas = aulas.filter(a => !a.estudada);
  if (aulaSelect && aulaContainer) {
    let ht = '<option value="">Sem material/aula específico</option>';
    if (pendingAulas.length > 0) {
      ht += pendingAulas.map(a => `<option value="${a.id}">${esc(a.nome)}</option>`).join('');
    }
    aulaSelect.innerHTML = ht;
    aulaContainer.style.display = '';
  }
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
    <div style="margin-bottom:12px;color:var(--text-secondary);font-size:14px;">
      Adicionar tópico em <strong>${d.disc.nome}</strong>
    </div>
    <input type="text" id="prompt-input-topico" class="form-control" placeholder="Nome do novo tópico..." autofocus>
  `;

  const saveBtn = document.getElementById('modal-prompt-save');
  saveBtn.onclick = () => {
    const nome = document.getElementById('prompt-input-topico')?.value.trim();
    if (!nome) { showToast('Informe o nome do tópico', 'error'); return; }

    const novoTopico = {
      id: 'ass_' + uid(),
      nome,
      concluido: false,
      revisoesFetas: []
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

  if ((ac + er > total && total > 0) || (total === 0 && ac + er > 0)) {
    fb.innerHTML = '<span style="color:var(--red);">⚠️ Acertos + Erros não pode ser maior que o Total</span>';
  } else if (total > 0) {
    const pct = Math.round((ac / total) * 100);
    fb.innerHTML = `<span style="color:var(--green);">${pct}% de aproveitamento</span>`;
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
// SAVE
// =============================================

export function saveRegistroSessao() {
  let ev = null;
  const isLivre = _currentEventId === 'crono_livre';

  if (isLivre) {
    ev = state.cronoLivre;
  } else {
    ev = state.eventos.find(e => e.id === _currentEventId);
  }

  if (!ev) { showToast('Evento não encontrado', 'error'); return false; }

  // Validation
  if (_selectedTipos.length === 0) {
    showToast('Selecione ao menos um tipo de estudo', 'error'); return false;
  }

  const discId = document.getElementById('reg-disciplina')?.value;
  let assId = document.getElementById('reg-assunto')?.value || '';
  let aulaId = document.getElementById('reg-aula')?.value || '';

  // Note: assId and aulaId already contain the full ID (e.g. 'ass_xxx') from the select.
  // Do NOT strip prefixes — they are part of the canonical ID used in lookups.

  if (isLivre && !discId) {
    showToast('Em sessões livres, escolha pelo menos uma Disciplina para vincular o tempo estudado', 'error'); return false;
  }

  // Se for Sessão Livre, cria um evento real permanente pro Histórico
  if (isLivre && discId) {
    const d = getDisc(discId);
    let assName = 'Estudo Genérico';
    if (d) {
      if (aulaId) {
        const achado = d.disc.aulas?.find(a => a.id === aulaId);
        if (achado) assName = achado.nome;
      } else {
        const achado = d.disc.assuntos?.find(a => a.id === assId);
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
      tempoAcumulado: Math.round(state.cronoLivre.tempoAcumulado || 0)
    };
    state.eventos.push(evtReal);
    ev = evtReal; // Swap reference!
  }

  // Validate questões if type selected
  const hasQuestoes = _selectedTipos.includes('questoes') || _selectedTipos.includes('simulado');
  let questoes = null;
  if (hasQuestoes) {
    const total = parseInt(document.getElementById('reg-q-total')?.value, 10) || 0;
    const acertos = parseInt(document.getElementById('reg-q-acertos')?.value, 10) || 0;
    const erros = parseInt(document.getElementById('reg-q-erros')?.value, 10) || 0;
    if (total <= 0) { showToast('Informe o total de questões', 'error'); return false; }
    if (acertos + erros > total) { showToast('Acertos + Erros não pode ser maior que o Total', 'error'); return false; }
    questoes = { total, acertos, erros };
  }

  // Validate vídeo if type selected
  let videoaula = null;
  if (_selectedTipos.includes('videoaula')) {
    const titulo = document.getElementById('reg-video-titulo')?.value.trim() || '';
    const tempoMin = parseInt(document.getElementById('reg-video-tempo')?.value || '0');
    if (tempoMin <= 0) { showToast('Informe o tempo de vídeo assistido', 'error'); return false; }
    videoaula = { titulo, tempoMin };
  }

  // Validate páginas if needed
  const showPaginas = ['leitura', 'informativo', 'sumula'].some(t => _selectedTipos.includes(t)) ||
    ['pdf', 'livro', 'lei_seca', 'informativo_mat'].some(m => _selectedMateriais.includes(m));

  let paginas = null;
  if (showPaginas) {
    const simplesVisible = document.getElementById('pag-simples')?.style.display !== 'none';
    if (simplesVisible) {
      const total = parseInt(document.getElementById('reg-pag-total')?.value || '0');
      if (total > 0) paginas = { modo: 'simples', total };
    } else {
      const inicio = parseInt(document.getElementById('reg-pag-inicio')?.value || '0');
      const fim = parseInt(document.getElementById('reg-pag-fim')?.value || '0');
      if (fim > inicio) paginas = { modo: 'detalhado', inicio, fim, total: fim - inicio };
      else if (fim > 0 || inicio > 0) { showToast('Página final deve ser maior que a página inicial', 'error'); return false; }
    }
  }

  // Topic status
  const statusTopico = document.getElementById('reg-status-topico')?.value || 'em_andamento';

  // Handle Editing Flow
  const isEditingOld = ev.status === 'estudei' && !ev._isPastSession;
  if (isEditingOld) {
    Object.keys(state.habitos).forEach(tipo => {
      if (state.habitos[tipo]) {
        state.habitos[tipo] = state.habitos[tipo].filter(h => h.eventoId !== ev.id);
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
        const aula = d.disc.aulas?.find(a => a.id === aulaId);
        if (aula) titulo += ' — ' + aula.nome;
      } else if (assId) {
        const ass = d.disc.assuntos?.find(a => a.id === assId);
        if (ass) titulo += ' — ' + ass.nome;
      }
      ev.titulo = titulo;
    }
  }

  ev.sessao = {
    tiposEstudo: [..._selectedTipos],
    materiais: [..._selectedMateriais],
    materialDetalhe: document.getElementById('reg-material-detalhe')?.value.trim() || '',
    questoes,
    paginas,
    videoaula,
    statusTopico,
    comentarios: document.getElementById('reg-comentarios')?.value.trim() || '',
    observacoes: document.getElementById('reg-observacao')?.value.trim() || '',
    horaInicio: _sessionStartTime ? _sessionStartTime.toTimeString().slice(0, 8) : null,
    horaFim: _sessionEndTime ? _sessionEndTime.toTimeString().slice(0, 8) : null,
    modo: _sessionMode,
  };

  // Progress: mark as concluded
  if (statusTopico === 'finalizado' && discId) {
    const d = getDisc(discId);
    if (d) {
      if (aulaId) {
        const achadoAula = d.disc.aulas?.find(a => a.id === aulaId);
        if (achadoAula && !achadoAula.estudada) {
          achadoAula.estudada = true;
        }
      }
      
      if (assId) {
        const ass = d.disc.assuntos?.find(a => a.id === assId);
        if (ass && !ass.concluido) {
          ass.concluido = true;
          ass.dataConclusao = todayStr();
          ass.revisoesFetas = [];
        }
      }
    }
  }

  // Register habits
  _selectedTipos.forEach(tipo => {
    if (state.habitos[tipo]) {
      state.habitos[tipo].push({
        id: 'hab_' + uid(),
        data: todayStr(),
        eventoId: ev.id,
        tempoMin: Math.round((ev.tempoAcumulado || 0) / 60),
        ...(questoes && (tipo === 'questoes' || tipo === 'simulado') ? questoes : {})
      });
    }
  });

  if (paginas && paginas.total > 0) {
    if (!state.habitos.paginas) state.habitos.paginas = [];
    state.habitos.paginas.push({
      id: 'hab_' + uid(),
      data: todayStr(),
      eventoId: ev.id,
      tempoMin: Math.round((ev.tempoAcumulado || 0) / 60),
      total: parseInt(paginas.total, 10)
    });
  }

  // Limpa o cronometro livre da memória caso tenha sido ele
  if (isLivre) {
    state.cronoLivre = { _timerStart: null, tempoAcumulado: 0 };
  }

  // Update legacy study cycle progress
  if (state.ciclo && state.ciclo.ativo && discId) {
    const discEntry = getDisc(discId);
    const discNome = discEntry ? discEntry.disc.nome : null;
    const cycleDisc = discId ? state.ciclo.disciplinas.find(d => {
      // Try to match by discId first (linked editais), fallback to name match
      const discEntry = getDisc(discId);
      return d.id === discId || (discEntry && d.nome === discEntry.disc.nome);
    }) : null;
    if (cycleDisc && !cycleDisc.concluido) {
      const addedMin = Math.round((ev.tempoAcumulado || 0) / 60);
      cycleDisc.estudadoMin = (cycleDisc.estudadoMin || 0) + addedMin;
      if (cycleDisc.estudadoMin >= cycleDisc.planejadoMin) {
        cycleDisc.concluido = true;

        // Check if entire cycle was concluded by this action
        const allCompleted = state.ciclo.disciplinas.every(d => d.concluido);
        if (allCompleted) {
          state.ciclo.ciclosCompletos = (state.ciclo.ciclosCompletos || 0) + 1;
        }
      }
    }
  }

  // Update new Planejamento sequence progress
  if (state.planejamento && state.planejamento.ativo && ev.seqId) {
    if (state.planejamento.sequencia) {
      const seq = state.planejamento.sequencia.find(s => s.id === ev.seqId);
      if (seq && !seq.concluido) {
        // We can check if they studied enough, but marking it unconditionally is safer UX for now
        // if they hit "Concluir" in the session register.
        seq.concluido = true;
      }
    }
  }

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

export function saveAndStartNew() {
  const success = saveRegistroSessao();
  if (!success) return;
  // Navigate to MED after the save's setTimeout(50ms) completes to avoid race condition
  setTimeout(() => {
    _currentEventId = null;
    _selectedTipos = [];
    _selectedMateriais = [];
    _savedTimerStart = null;
    _savedTempoAcumulado = 0;
    if (typeof window.navigate === 'function') window.navigate('med');
  }, 400);
}

// Rollback timer state if user cancels the registro modal
export function cancelRegistro() {
  const isLivre = _currentEventId === 'crono_livre';
  const ev = isLivre ? state.cronoLivre : state.eventos.find(e => e.id === _currentEventId);

  if (ev) {
    if (ev._isPastSession) {
      state.eventos = state.eventos.filter(e => e.id !== _currentEventId);
      scheduleSave();
    } else if (_savedTimerStart) {
      ev._timerStart = _savedTimerStart;
      ev.tempoAcumulado = _savedTempoAcumulado;
    }
  }

  _savedTimerStart = null;
  _savedTempoAcumulado = 0;
  closeModal('modal-registro-sessao');
  renderCurrentView();
}

// Proxies the discardTimer correctly inside modal
window.discardTimerUI = function (eventId) {
  closeModal('modal-registro-sessao');
  setTimeout(() => {
    if (typeof window.discardTimer === 'function') {
      window.discardTimer(eventId);
    }
  }, 100);
}

window.voltarPastSessionUI = function(eventId, discId) {
  state.eventos = state.eventos.filter(e => e.id !== eventId);
  scheduleSave();
  closeModal('modal-registro-sessao');
  setTimeout(() => {
    if (typeof window.openAddPastSessionModal === 'function') {
      window.openAddPastSessionModal(discId);
    }
  }, 100);
}

window.openRegistroSessao = openRegistroSessao;

// Listener para fechar modal via data-action - chama cancelRegistro para rollback do timer
document.addEventListener('click', (e) => {
  if (e.target.dataset.action === 'close-modal' && e.target.dataset.modal === 'modal-registro-sessao') {
    cancelRegistro();
  }
});

// Global deletion handler for previously registered sessions
window.deleteCompletedSession = function(id) {
  showConfirm('Tem certeza que deseja excluir permanentemente este registro de estudo do seu histórico?', () => {
    state.eventos = state.eventos.filter(e => e.id !== id);
    Object.keys(state.habitos).forEach(tipo => {
      if (state.habitos[tipo]) {
        state.habitos[tipo] = state.habitos[tipo].filter(h => h.eventoId !== id);
      }
    });
    scheduleSave();
    closeModal('modal-registro-sessao');
    renderCurrentView();
    showToast('Sessão excluída com sucesso.', 'info');
  }, { danger: true, label: 'Excluir', title: 'Excluir sessão' });
};
