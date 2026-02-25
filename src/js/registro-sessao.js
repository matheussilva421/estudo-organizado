// =============================================
// REGISTRO DA SESSÃO DE ESTUDO
// Módulo dedicado ao registro pós-sessão
// =============================================

import { state, scheduleSave } from './store.js';
import { getAllDisciplinas, getDisc, getElapsedSeconds, _pomodoroMode } from './logic.js';
import { openModal, closeModal, showToast } from './app.js';
import { todayStr } from './utils.js';
import { renderCurrentView, updateBadges } from './components.js';

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

// =============================================
// OPEN REGISTRO SESSÃO
// =============================================

export function openRegistroSessao(eventId) {
  const ev = state.eventos.find(e => e.id === eventId);
  if (!ev) { showToast('Evento não encontrado', 'error'); return; }

  // Save timer state for rollback if user cancels
  _savedTimerStart = ev._timerStart || null;
  _savedTempoAcumulado = ev.tempoAcumulado || 0;

  // Stop timer if running
  if (ev._timerStart) {
    ev.tempoAcumulado = getElapsedSeconds(ev);
    _sessionEndTime = new Date();
    _sessionStartTime = new Date(ev._timerStart);
    delete ev._timerStart;
  } else {
    _sessionEndTime = new Date();
    const totalSecs = ev.tempoAcumulado || 0;
    _sessionStartTime = new Date(_sessionEndTime.getTime() - totalSecs * 1000);
  }

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
          if (assSelect) assSelect.value = ev.assId;
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
  const dataStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const modeLabel = _sessionMode === 'pomodoro' ? '🍅 Pomodoro 25/5' : '⏱ Cronômetro';

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
          <div class="reg-stat-label">Tempo estudado</div>
          <div class="reg-stat-value" style="color:var(--green);font-family:'DM Mono',monospace;font-size:28px;">
            ${fmtTime(elapsed)}
          </div>
        </div>
        <div class="reg-stat">
          <div class="reg-stat-label">Data</div>
          <div class="reg-stat-value">${dataStr}</div>
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
      <div class="reg-row">
        <div class="reg-field" style="flex:1;">
          <label class="reg-label">Assunto / Tópico <span class="req">*</span></label>
          <div style="display:flex;gap:8px;">
            <select id="reg-assunto" class="reg-select" style="flex:1;">
              <option value="">Selecione a disciplina primeiro</option>
            </select>
            <button type="button" class="btn-inline" onclick="addNovoTopico()" title="Criar novo tópico">
              + Novo
            </button>
          </div>
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
        placeholder="Dificuldades, pontos de revisão, pegadinhas..."></textarea>
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
    html += `
      <div class="reg-results-card">
        <div class="reg-results-header">❓ Questões</div>
        <div class="reg-row" style="gap:12px;">
          <div class="reg-field">
            <label class="reg-label">Total</label>
            <input type="number" id="reg-q-total" class="reg-input" min="0" placeholder="0"
              oninput="validateQuestoes()">
          </div>
          <div class="reg-field">
            <label class="reg-label" style="color:var(--green);">Acertos</label>
            <input type="number" id="reg-q-acertos" class="reg-input" min="0" placeholder="0"
              oninput="validateQuestoes()">
          </div>
          <div class="reg-field">
            <label class="reg-label" style="color:var(--red);">Erros</label>
            <input type="number" id="reg-q-erros" class="reg-input" min="0" placeholder="0"
              oninput="validateQuestoes()">
          </div>
        </div>
        <div id="reg-q-feedback" style="font-size:12px;margin-top:4px;"></div>
      </div>
    `;
  }

  if (showPaginas) {
    html += `
      <div class="reg-results-card">
        <div class="reg-results-header">📖 Páginas lidas</div>
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <button type="button" class="chip chip-active" id="pag-modo-simples"
            onclick="setPaginaMode('simples')">Simples</button>
          <button type="button" class="chip" id="pag-modo-detalhado"
            onclick="setPaginaMode('detalhado')">Detalhado</button>
        </div>
        <div id="pag-simples">
          <div class="reg-field">
            <label class="reg-label">Total de páginas</label>
            <input type="number" id="reg-pag-total" class="reg-input" min="0" placeholder="0">
          </div>
        </div>
        <div id="pag-detalhado" style="display:none;">
          <div class="reg-row" style="gap:12px;">
            <div class="reg-field">
              <label class="reg-label">Página inicial</label>
              <input type="number" id="reg-pag-inicio" class="reg-input" min="0" placeholder="0">
            </div>
            <div class="reg-field">
              <label class="reg-label">Página final</label>
              <input type="number" id="reg-pag-fim" class="reg-input" min="0" placeholder="0">
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (showVideo) {
    html += `
      <div class="reg-results-card">
        <div class="reg-results-header">🎬 Vídeoaula</div>
        <div class="reg-field" style="margin-bottom:8px;">
          <label class="reg-label">Título da aula</label>
          <input type="text" id="reg-video-titulo" class="reg-input" placeholder="Ex.: Aula 05 - Direito Constitucional">
        </div>
        <div class="reg-field">
          <label class="reg-label">Tempo assistido (minutos)</label>
          <input type="number" id="reg-video-tempo" class="reg-input" min="0" placeholder="0">
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
  if (!assSelect) return;

  if (!discId) {
    assSelect.innerHTML = '<option value="">Selecione a disciplina primeiro</option>';
    return;
  }

  const d = getDisc(discId);
  if (!d || !d.disc.assuntos || d.disc.assuntos.length === 0) {
    assSelect.innerHTML = '<option value="">Nenhum tópico cadastrado</option>';
    return;
  }

  const options = d.disc.assuntos.map(a => {
    const status = a.concluido ? ' ✅' : '';
    return `<option value="${a.id}">${a.nome}${status}</option>`;
  });
  assSelect.innerHTML = '<option value="">Selecione um tópico...</option>' + options.join('');
}

export function addNovoTopico() {
  const discId = document.getElementById('reg-disciplina')?.value;
  if (!discId) {
    showToast('Selecione uma disciplina primeiro', 'error');
    return;
  }

  const nome = prompt('Nome do novo tópico:');
  if (!nome || !nome.trim()) return;

  const d = getDisc(discId);
  if (!d) return;

  const novoTopico = {
    id: 'ass_' + Date.now() + Math.random(),
    nome: nome.trim(),
    concluido: false,
    revisoesFetas: []
  };

  d.disc.assuntos.push(novoTopico);
  scheduleSave();

  // Refresh topic select
  onDisciplinaChange();

  // Auto-select the new topic
  const assSelect = document.getElementById('reg-assunto');
  if (assSelect) assSelect.value = novoTopico.id;

  showToast(`Tópico "${nome.trim()}" criado!`, 'success');
}

export function validateQuestoes() {
  const total = parseInt(document.getElementById('reg-q-total')?.value || '0');
  const ac = parseInt(document.getElementById('reg-q-acertos')?.value || '0');
  const er = parseInt(document.getElementById('reg-q-erros')?.value || '0');
  const fb = document.getElementById('reg-q-feedback');
  if (!fb) return;

  if (ac + er > total && total > 0) {
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
  const ev = state.eventos.find(e => e.id === _currentEventId);
  if (!ev) { showToast('Evento não encontrado', 'error'); return false; }

  // Validation
  if (_selectedTipos.length === 0) {
    showToast('Selecione ao menos um tipo de estudo', 'error'); return false;
  }

  const discId = document.getElementById('reg-disciplina')?.value;
  const assId = document.getElementById('reg-assunto')?.value;

  // Validate questões if type selected
  const hasQuestoes = _selectedTipos.includes('questoes') || _selectedTipos.includes('simulado');
  let questoes = null;
  if (hasQuestoes) {
    const total = parseInt(document.getElementById('reg-q-total')?.value || '0');
    const acertos = parseInt(document.getElementById('reg-q-acertos')?.value || '0');
    const erros = parseInt(document.getElementById('reg-q-erros')?.value || '0');
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
    }
  }

  // Topic status
  const statusTopico = document.getElementById('reg-status-topico')?.value || 'em_andamento';

  // Save data to event
  ev.status = 'estudei';
  ev.dataEstudo = todayStr();
  ev.discId = discId || ev.discId;
  ev.assId = assId || ev.assId;

  // Build titulo from discipline + topic
  if (discId) {
    const d = getDisc(discId);
    if (d) {
      let titulo = d.disc.nome;
      if (assId) {
        const ass = d.disc.assuntos.find(a => a.id === assId);
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
    horaInicio: _sessionStartTime ? _sessionStartTime.toTimeString().slice(0, 8) : null,
    horaFim: _sessionEndTime ? _sessionEndTime.toTimeString().slice(0, 8) : null,
    modo: _sessionMode,
  };

  // Topic progress: mark as concluded if "finalizado"
  if (statusTopico === 'finalizado' && discId && assId) {
    const d = getDisc(discId);
    if (d) {
      const ass = d.disc.assuntos.find(a => a.id === assId);
      if (ass && !ass.concluido) {
        ass.concluido = true;
        ass.dataConclusao = todayStr();
        ass.revisoesFetas = [];
      }
    }
  }

  // Register habits
  _selectedTipos.forEach(tipo => {
    if (state.habitos[tipo]) {
      state.habitos[tipo].push({
        id: 'hab_' + Date.now() + Math.random(),
        data: todayStr(),
        eventoId: ev.id,
        tempoMin: Math.round((ev.tempoAcumulado || 0) / 60),
        ...(questoes && (tipo === 'questoes' || tipo === 'simulado') ? questoes : {})
      });
    }
  });

  // Update study cycle progress
  if (state.ciclo && state.ciclo.ativo && discId) {
    const discEntry = getDisc(discId);
    const discNome = discEntry ? discEntry.disc.nome : null;
    const cycleDisc = discNome ? state.ciclo.disciplinas.find(d => d.nome === discNome) : null;
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

  scheduleSave();
  closeModal('modal-registro-sessao');
  updateBadges();
  renderCurrentView();
  showToast('Sessão registrada com sucesso! ✅', 'success');
  return true;
}

export function saveAndStartNew() {
  const success = saveRegistroSessao();
  if (!success) return;
  // Reset internal state for next session
  _currentEventId = null;
  _selectedTipos = [];
  _selectedMateriais = [];
  _savedTimerStart = null;
  _savedTempoAcumulado = 0;
  // After saving, navigate to MED to start a new session
  setTimeout(() => {
    if (typeof window.navigate === 'function') window.navigate('med');
  }, 300);
}

// Rollback timer state if user cancels the registro modal
export function cancelRegistro() {
  const ev = _currentEventId ? state.eventos.find(e => e.id === _currentEventId) : null;
  if (ev && _savedTimerStart) {
    ev._timerStart = _savedTimerStart;
    ev.tempoAcumulado = _savedTempoAcumulado;
  }
  _savedTimerStart = null;
  _savedTempoAcumulado = 0;
  closeModal('modal-registro-sessao');
  renderCurrentView();
}
