// =============================================
// MODAL RENDERING — Registro de Sessão
// HTML generation for the post-study registration modal
// =============================================

import { state } from '../store.js?v=8.37';
import { getActiveDisciplinas, getDisc } from '../logic.js?v=8.37';
import { todayStr, esc, trunc } from '../utils.js?v=8.37';
import { sumTopicQuestoes, sumTopicPaginas } from './session-topics.js';

// =============================================
// STUDY TYPES & MATERIALS DEFINITIONS
// =============================================

export const TIPOS_ESTUDO = [
  { id: 'leitura', label: 'Leitura', icon: '📖' },
  { id: 'videoaula', label: 'Vídeoaula', icon: '🎬' },
  { id: 'questoes', label: 'Questões', icon: '❓' },
  { id: 'revisao', label: 'Revisão', icon: '🔄' },
  { id: 'informativo', label: 'Informativos', icon: '📰' },
  { id: 'discursiva', label: 'Discursiva', icon: '✍️' },
  { id: 'simulado', label: 'Simulado', icon: '📝' },
  { id: 'sumula', label: 'Súmulas', icon: '⚖️' },
];

export const MATERIAIS = [
  { id: 'pdf', label: 'PDF', icon: '📄' },
  { id: 'videoaula_mat', label: 'Vídeoaula', icon: '🎬' },
  { id: 'lei_seca', label: 'Lei seca', icon: '⚖️' },
  { id: 'livro', label: 'Livro', icon: '📕' },
  { id: 'caderno', label: 'Caderno', icon: '📓' },
  { id: 'flashcards', label: 'Flashcards / Anki', icon: '🃏' },
  { id: 'jurisprudencia', label: 'Jurisprudência', icon: '🏛️' },
  { id: 'informativo_mat', label: 'Informativo', icon: '📰' },
  { id: 'outro', label: 'Outro', icon: '📦' },
];

// =============================================
// TOPICS LIST (registro multi-tópico)
// =============================================

function getTopicoItemNome(item, discId) {
  const d = discId ? getDisc(discId) : null;
  const partes = [];
  if (item.assId) {
    const ass = d?.disc?.assuntos?.find((a) => a.id === item.assId);
    partes.push(ass?.nome || 'Tópico');
  }
  if (item.aulaId) {
    const aula = d?.disc?.aulas?.find((a) => a.id === item.aulaId);
    partes.push('🎬 ' + (aula?.nome || 'Aula'));
  }
  return partes.join(' · ') || 'Item';
}

/**
 * Lista editável dos tópicos da sessão. Campos por item usam data-topico-idx
 * (os ids #reg-* globais ficam intactos — contrato do modal).
 */
export function renderTopicosList({ topicos, discId }) {
  if (!Array.isArray(topicos) || topicos.length === 0) {
    return '<div class="reg-note text-secondary reg-topicos-empty">Nenhum item na lista — o registro usa os campos globais abaixo (uma sessão, um tópico).</div>';
  }

  return topicos
    .map((item, i) => {
      const questoes = item.questoes || {};
      const paginas = item.paginas || {};
      return `
        <div class="reg-topico-item" data-topico-idx="${i}">
          <div class="reg-topico-header">
            <span class="reg-topico-nome" title="${esc(getTopicoItemNome(item, discId))}">${esc(trunc(getTopicoItemNome(item, discId), 90))}</span>
            <button type="button" class="btn-inline reg-topico-remove" data-action="remove-topico-sessao" data-topico-idx="${i}" title="Remover da lista">✕</button>
          </div>
          <div class="reg-topico-fields">
            <div class="reg-field">
              <label class="reg-label">Questões</label>
              <input type="number" class="reg-input" min="0" placeholder="Total" value="${questoes.total || ''}"
                data-action="update-topico-field" data-topico-idx="${i}" data-field="q-total">
            </div>
            <div class="reg-field">
              <label class="reg-label reg-label-positive">Acertos</label>
              <input type="number" class="reg-input" min="0" placeholder="0" value="${questoes.acertos || ''}"
                data-action="update-topico-field" data-topico-idx="${i}" data-field="q-acertos">
            </div>
            <div class="reg-field">
              <label class="reg-label reg-label-negative">Erros</label>
              <input type="number" class="reg-input" min="0" placeholder="0" value="${questoes.erros || ''}"
                data-action="update-topico-field" data-topico-idx="${i}" data-field="q-erros">
            </div>
            <div class="reg-field">
              <label class="reg-label">Páginas</label>
              <input type="number" class="reg-input" min="0" placeholder="0" value="${paginas.total || ''}"
                data-action="update-topico-field" data-topico-idx="${i}" data-field="pag-total">
            </div>
            <div class="reg-field">
              <label class="reg-label">Status</label>
              <select class="reg-select" data-action="update-topico-field" data-topico-idx="${i}" data-field="status">
                <option value="nao_iniciado" ${item.statusTopico === 'nao_iniciado' ? 'selected' : ''}>Não iniciado</option>
                <option value="em_andamento" ${item.statusTopico === 'em_andamento' || !item.statusTopico ? 'selected' : ''}>Em andamento</option>
                <option value="finalizado" ${item.statusTopico === 'finalizado' ? 'selected' : ''}>Finalizado ✅</option>
              </select>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

// =============================================
// RENDER FORM HTML
// =============================================

export function renderRegistroForm({ ev, sessionStartTime, sessionEndTime, sessionMode, selectedTipos, selectedMateriais, sessionTopicos = [] }) {
  const elapsed = ev.tempoAcumulado || 0;
  const fmtTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const horaInicio = sessionStartTime
    ? sessionStartTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '--:--';
  const horaFim = sessionEndTime
    ? sessionEndTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  let dataStr;
  if (ev.data) {
    const parts = ev.data.split('-');
    dataStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : ev.data;
  } else {
    dataStr = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  const modeLabel =
    sessionMode === 'pomodoro'
      ? `🍅 Pomodoro (${state?.config?.pomodoroFoco || 25}/${state?.config?.pomodoroPausa || 5})`
      : '⏱ Cronômetro';

  // Discipline options
  const allDiscs = getActiveDisciplinas();
  const discOptions = allDiscs
    .map(
      (d) =>
        `<option value="${d.disc.id}">${d.disc.icone || '📖'} ${d.disc.nome} — ${d.edital.nome}</option>`
    )
    .join('');

  // Study type chips
  const tipoChips = TIPOS_ESTUDO.map((t) => {
    const sel = selectedTipos.includes(t.id);
    return `<button type="button" class="chip ${sel ? 'chip-active' : ''}"
      data-action="toggle-study-type"
      data-tipo="${t.id}">
      ${t.icon} ${t.label}
    </button>`;
  }).join('');

  // Material chips
  const materialChips = MATERIAIS.map((m) => {
    const sel = selectedMateriais.includes(m.id);
    return `<button type="button" class="chip ${sel ? 'chip-active' : ''}"
      data-action="toggle-material"
      data-mat="${m.id}">
      ${m.icon} ${m.label}
    </button>`;
  }).join('');

  const discId = ev.discId || '';
  const aulaId = ev.aulaId || '';
  // Todo estudo da disciplina avança o ciclo automaticamente (reconciliação
  // em session-save) — o antigo vínculo opt-in foi removido.
  const hasPendingPlanning =
    state?.planejamento?.ativo &&
    Array.isArray(state.planejamento.sequencia) &&
    state.planejamento.sequencia.some(
      (seq) => (!seq.status && !seq.concluido) || seq.status === 'pendente'
    );
  const planningLinkHtml = hasPendingPlanning
    ? `
      <div class="reg-note text-secondary">
        <i class="fa fa-circle-info"></i>
        Este tempo avança automaticamente o seu ciclo de estudos.
      </div>
    `
    : '';

  return `
    <!-- 1) RESUMO DA SESSÃO -->
    <div class="reg-block reg-summary">
      <div class="reg-summary-grid">
        <div class="reg-stat">
          <div class="reg-stat-label">Tempo estudado ${ev.status === 'estudei' || ev._isPastSession ? '(minutos)' : ''}</div>
          <div class="reg-stat-value reg-stat-value-mono">
            ${
              ev.status === 'estudei' || ev._isPastSession
                ? `<input type="number" id="reg-tempo-mins" class="reg-input reg-input-time" value="${Math.round(elapsed / 60)}" min="1">`
                : fmtTime(elapsed)
            }
          </div>
        </div>
        <div class="reg-stat">
          <div class="reg-stat-label">Data</div>
          <div class="reg-stat-value">
            ${
              ev.status === 'estudei' || ev._isPastSession
                ? `<input type="date" id="reg-data-estudo" class="reg-input reg-input-date" value="${ev.data || todayStr()}">`
                : dataStr
            }
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
        <div class="reg-field flex-1">
          <label class="reg-label">Disciplina <span class="req">*</span></label>
          <select id="reg-disciplina" class="reg-select" data-action="on-disciplina-change">
            <option value="">Selecione uma disciplina...</option>
            ${discOptions}
          </select>
          ${planningLinkHtml}
        </div>
      </div>
      <div class="reg-row reg-row-column">
        <div class="reg-field flex-1">
          <label class="reg-label">Tópico do Edital (opcional)</label>
          <div class="cluster-sm">
            <select id="reg-assunto" class="reg-select flex-1" data-action="on-assunto-change">
              <option value="">Selecione a disciplina primeiro</option>
            </select>
            <button type="button" class="btn-inline" data-action="add-novo-topico" title="Criar novo tópico">
              + Novo
            </button>
          </div>
        </div>
        <div class="reg-field flex-1 hidden" id="reg-aula-container">
          <label class="reg-label">Material / Aula (opcional)</label>
          <select id="reg-aula" class="reg-select flex-1" data-action="on-aula-change">
            <option value="">Selecione a disciplina primeiro</option>
          </select>
        </div>
      </div>

      <!-- Registro multi-tópico: os selects acima viram a "linha editora" -->
      <div class="reg-topicos-toolbar">
        <button type="button" class="btn-inline" data-action="add-topico-sessao">
          + Adicionar à lista de tópicos
        </button>
        <span class="reg-note text-secondary">Estude vários tópicos/aulas na mesma sessão adicionando-os à lista.</span>
      </div>
      <div id="reg-topicos-lista">
        ${renderTopicosList({ topicos: sessionTopicos, discId: ev.discId || '' })}
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
      <div class="reg-field mt-3">
        <input type="text" id="reg-material-detalhe" class="reg-input"
          placeholder="Detalhe do material (ex.: Aula 03 Estratégia, CF/88 arts. 5º ao 17)">
      </div>
    </div>

    <!-- 4) RESULTADOS DA SESSÃO -->
    <div id="reg-resultados">
      ${renderConditionalFields({ selectedTipos, selectedMateriais, sessao: ev.sessao || {}, discId, aulaId, sessionTopicos })}
    </div>

    <!-- 5) PROGRESSO DO TÓPICO -->
    <div id="reg-progresso">
      ${renderProgressoTopico({ sessionTopicos, discId, statusAtual: ev.sessao?.statusTopico })}
    </div>

    <!-- 6) COMENTÁRIOS -->
    <div class="reg-block">
      <h3 class="reg-block-title">💬 Comentários / Observações</h3>
      <textarea id="reg-comentarios" class="reg-textarea" rows="3"
        placeholder="Dificuldades, pontos de revisão, pegadinhas...">${esc(ev.sessao?.comentarios || '')}</textarea>
    </div>

    <div class="reg-block">
      <div class="reg-full-width">
        <h3 class="reg-block-title">Resumo / Detalhes <small class="reg-title-subtitle">(Opcional)</small></h3>
        <textarea id="reg-observacao" class="reg-textarea" placeholder="Anotações, comentários ou percepções sobre o que você estudou hoje..." wrap="soft" spellcheck="true">${esc(ev.sessao?.observacoes || '')}</textarea>
      </div>
    </div>

    <!-- 7) AÇÕES / FOOTER -->
    <div class="reg-footer-actions">
      ${
        ev.status === 'estudei' && !ev._isPastSession
          ? `<button type="button" class="btn-outline reg-btn-danger" data-action="delete-completed-session" data-session-id="${ev.id}">
          <i class="fa fa-trash"></i> Excluir
        </button>`
          : ev._isPastSession
            ? `<button type="button" class="btn-outline" data-action="voltar-past-session-ui" data-event-id="${ev.id}" data-disc-id="${ev.discId}">
          <i class="fa fa-arrow-left"></i> Voltar
        </button>`
            : `<button type="button" class="btn-outline reg-btn-danger" data-action="discard-timer-ui" data-event-id="${ev.id}">
          <i class="fa fa-trash"></i> Descartar
        </button>`
      }

      <div class="reg-footer-buttons">
        <button type="button" class="btn-outline" data-action="cancel-registro">Cancelar</button>
        ${
          !ev._isPastSession && ev.status !== 'estudei'
            ? `
        <button type="button" class="btn-outline reg-btn-success" data-action="save-and-start-new">
          Salvar e iniciar nova ↻
        </button>`
            : ''
        }
        <button type="button" class="btn-primary reg-btn-primary" data-action="save-registro-sessao">
          <i class="fa fa-save"></i> ${ev.status === 'estudei' && !ev._isPastSession ? 'Salvar Alterações' : 'Salvar Registro'}
        </button>
      </div>
    </div>
  `;
}

// =============================================
// CONDITIONAL FIELDS (Resultados)
// =============================================

/**
 * Resumo somente-leitura dos resultados no modo multi-tópico: questões e
 * páginas são somadas dos itens da lista (mesma derivação do save) — os
 * inputs globais (#reg-q-… e #reg-pag-…) não existem neste modo.
 */
function renderResultadosDerivados({ sessionTopicos, showVideo }) {
  const questoes = sumTopicQuestoes(sessionTopicos) || { total: 0, acertos: 0, erros: 0 };
  const paginas = sumTopicPaginas(sessionTopicos);
  const pct = questoes.total > 0 ? Math.round((questoes.acertos / questoes.total) * 100) : null;

  return `
    <div class="reg-results-card reg-results-derived">
      <div class="reg-results-header">📋 Somatório da lista de tópicos</div>
      <div class="reg-summary-grid">
        <div class="reg-stat">
          <div class="reg-stat-label">Questões</div>
          <div class="reg-stat-value">${questoes.total}</div>
        </div>
        <div class="reg-stat">
          <div class="reg-stat-label reg-label-positive">Acertos</div>
          <div class="reg-stat-value">${questoes.acertos}</div>
        </div>
        <div class="reg-stat">
          <div class="reg-stat-label reg-label-negative">Erros</div>
          <div class="reg-stat-value">${questoes.erros}</div>
        </div>
        <div class="reg-stat">
          <div class="reg-stat-label">Páginas</div>
          <div class="reg-stat-value">${paginas?.total || 0}</div>
        </div>
      </div>
      ${pct !== null ? `<div class="reg-feedback-text">${pct}% de aproveitamento</div>` : ''}
      <div class="reg-note text-secondary">
        Somado automaticamente dos itens da lista de tópicos${showVideo ? ' — só a vídeoaula é preenchida aqui' : ''}.
      </div>
    </div>
  `;
}

export function renderConditionalFields({ selectedTipos, selectedMateriais, sessao, discId, aulaId, sessionTopicos = [] }) {
  const hasTopicos = Array.isArray(sessionTopicos) && sessionTopicos.length > 0;
  const showQuestoes = !hasTopicos && (selectedTipos.includes('questoes') || selectedTipos.includes('simulado'));
  const showPaginas =
    !hasTopicos &&
    (['leitura', 'informativo', 'sumula'].some((t) => selectedTipos.includes(t)) ||
      ['pdf', 'livro', 'lei_seca', 'informativo_mat'].some((m) => selectedMateriais.includes(m)));
  const showVideo = selectedTipos.includes('videoaula');

  if (!hasTopicos && !showQuestoes && !showPaginas && !showVideo) {
    return '<div class="reg-block reg-no-results"><em>Selecione tipos de estudo para preencher resultados</em></div>';
  }

  let html = '<div class="reg-block"><h3 class="reg-block-title">📊 Resultados da sessão</h3>';

  if (hasTopicos) {
    html += renderResultadosDerivados({ sessionTopicos, showVideo });
  }

  if (showQuestoes) {
    const qs = sessao.questoes || {};
    html += `
      <div class="reg-results-card">
        <div class="reg-results-header">❓ Questões</div>
        <div class="reg-results-row">
          <div class="reg-field">
            <label class="reg-label">Total</label>
            <input type="number" id="reg-q-total" class="reg-input" min="0" placeholder="0"
              value="${qs.total || ''}" data-action="validate-questoes">
          </div>
          <div class="reg-field">
            <label class="reg-label reg-label-positive">Acertos</label>
            <input type="number" id="reg-q-acertos" class="reg-input" min="0" placeholder="0"
              value="${qs.acertos || qs.certas || ''}" data-action="validate-questoes">
          </div>
          <div class="reg-field">
            <label class="reg-label reg-label-negative">Erros</label>
            <input type="number" id="reg-q-erros" class="reg-input" min="0" placeholder="0"
              value="${qs.erros || qs.erradas || ''}" data-action="validate-questoes">
          </div>
        </div>
        <div id="reg-q-feedback" class="reg-feedback-text"></div>
      </div>
    `;
  }

  if (showPaginas) {
    const pg = sessao.paginas || {};
    const modo = pg.modo || 'simples';
    html += `
      <div class="reg-results-card">
        <div class="reg-results-header">📖 Páginas lidas</div>
        <div class="reg-mode-toggle-row">
          <button type="button" class="chip ${modo === 'simples' ? 'chip-active' : ''}" id="pag-modo-simples"
            data-action="set-pagina-mode" data-mode="simples">Simples</button>
          <button type="button" class="chip ${modo === 'detalhado' ? 'chip-active' : ''}" id="pag-modo-detalhado"
            data-action="set-pagina-mode" data-mode="detalhado">Detalhado</button>
        </div>
        <div id="pag-simples" class="${modo === 'simples' ? '' : 'hidden'}">
          <div class="reg-field">
            <label class="reg-label">Total de páginas</label>
            <input type="number" id="reg-pag-total" class="reg-input" min="0" placeholder="0" value="${pg.total || ''}">
          </div>
        </div>
        <div id="pag-detalhado" class="${modo === 'detalhado' ? '' : 'hidden'}">
          <div class="reg-results-row">
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
    const vid = sessao.videoaula || {};
    let aulaNomeSelecionada = '';
    if (discId && aulaId) {
      const disc = getDisc(discId);
      const aula = disc?.disc?.aulas?.find((a) => a.id === aulaId);
      if (aula?.nome) aulaNomeSelecionada = aula.nome;
    }
    const videoTituloPrefill = vid.titulo || aulaNomeSelecionada || '';
    html += `
      <div class="reg-results-card">
        <div class="reg-results-header">🎬 Vídeoaula</div>
        ${
          aulaNomeSelecionada
            ? `
          <div class="reg-linked-info">
            Aula vinculada automaticamente: <strong>${esc(trunc(aulaNomeSelecionada, 96))}</strong>
          </div>
        `
            : ''
        }
        <div class="reg-field reg-field-spaced">
          <label class="reg-label">Título da aula (opcional)</label>
          <input type="text" id="reg-video-titulo" class="reg-input" placeholder="Opcional: será preenchido com Material / Aula quando selecionado" value="${esc(videoTituloPrefill)}">
        </div>
        <div class="reg-field">
          <label class="reg-label">Tempo assistido (minutos) (opcional)</label>
          <input type="number" id="reg-video-tempo" class="reg-input" min="0" placeholder="0" value="${vid.tempoMin || ''}">
        </div>
      </div>
    `;
  }

  html += '</div>';
  return html;
}

// =============================================
// PROGRESSO DO TÓPICO
// =============================================

const STATUS_TOPICO_LABEL = {
  nao_iniciado: 'Não iniciado',
  em_andamento: 'Em andamento',
  finalizado: 'Finalizado ✅',
};

/**
 * Bloco "Progresso do tópico". Legado (lista vazia): select global
 * #reg-status-topico com statusAtual selecionado — re-renders não podem
 * resetar a escolha do usuário. Multi-tópico: o status vem de cada item
 * da lista (o select global seria ignorado no save), então vira uma nota
 * com o status por item.
 */
export function renderProgressoTopico({ sessionTopicos = [], discId = '', statusAtual = 'em_andamento' }) {
  const hasTopicos = Array.isArray(sessionTopicos) && sessionTopicos.length > 0;

  if (!hasTopicos) {
    const atual = STATUS_TOPICO_LABEL[statusAtual] ? statusAtual : 'em_andamento';
    const sel = (v) => (atual === v ? ' selected' : '');
    return `
      <div class="reg-block">
        <h3 class="reg-block-title">📈 Progresso do tópico</h3>
        <div class="reg-field">
          <label class="reg-label">Status do tópico/assunto</label>
          <select id="reg-status-topico" class="reg-select">
            <option value="nao_iniciado"${sel('nao_iniciado')}>Não iniciado</option>
            <option value="em_andamento"${sel('em_andamento')}>Em andamento</option>
            <option value="finalizado"${sel('finalizado')}>Finalizado nesta sessão ✅</option>
          </select>
        </div>
      </div>
    `;
  }

  const pills = sessionTopicos
    .map((item) => {
      const nome = getTopicoItemNome(item, discId);
      const status = STATUS_TOPICO_LABEL[item.statusTopico] || STATUS_TOPICO_LABEL.em_andamento;
      const done = item.statusTopico === 'finalizado';
      return `<span class="reg-progresso-pill ${done ? 'reg-progresso-pill-done' : ''}" title="${esc(nome)}">${esc(trunc(nome, 48))} · ${status}</span>`;
    })
    .join('');

  return `
    <div class="reg-block">
      <h3 class="reg-block-title">📈 Progresso do tópico</h3>
      <div class="reg-note text-secondary">O status é definido por item na lista de tópicos acima.</div>
      <div class="reg-progresso-pills">${pills}</div>
    </div>
  `;
}
