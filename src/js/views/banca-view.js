/**
 * Banca Analyzer View Module
 * Renderiza analisador de banca (renderBancaAnalyzerModule)
 */

import { scheduleSave, state } from '../store.js?v=8.37';
import { esc, uid } from '../utils.js?v=8.37';
import { openModal, closeModal, showConfirm, showToast } from '../app.js?v=8.37';
import { getActiveDashboardDiscCtx } from '../state/dashboard-context.js?v=8.37';
import {
  applyRankingToEdital,
  commitEditalOrdering,
  revertEditalOrdering,
} from '../relevance.js?v=8.37';

// ── Analyzer Context State ──
const analyzerCtx = {
  editaId: null,
  parsedHotTopics: null,
  tempMatchResults: [],
};

export function getAnalyzerCtx() {
  return analyzerCtx;
}
export function setAnalyzerCtx(ctx) {
  Object.assign(analyzerCtx, ctx);
}

// ── Main Banca Analyzer Render ──
export function renderBancaAnalyzerModule(el) {
  if (state.editais.length === 0) {
    el.innerHTML =
      '<div class="card p-24" style="text-align:center;margin-top:24px;"><i class="fa fa-folder-open" style="font-size:32px;color:var(--text-muted);margin-bottom:16px;"></i><h3 style="margin-bottom:8px;">Nenhum Edital Cadastrado</h3><p style="color:var(--text-secondary);">Crie um Edital primeiro para usar a Inteligência da Banca.</p></div>';
    return;
  }

  if (!analyzerCtx.editaId) {
    analyzerCtx.editaId = getActiveDashboardDiscCtx()?.editaId || state.editais[0].id;
  }

  renderBancaAnalyzerContent(el);
}

// ── Render Banca Analyzer Content ──
export function renderBancaAnalyzerContent(el) {
  const edital = state.editais.find((e) => e.id === analyzerCtx.editaId);
  if (!edital) return;

  const hotTopics = state.bancaRelevance?.hotTopics || [];
  const editaisOptions = state.editais
    .map(
      (e) =>
        `<option value="${e.id}" ${e.id === analyzerCtx.editaId ? 'selected' : ''}>${esc(e.nome)}</option>`
    )
    .join('');

  const discOptions = (edital.disciplinas || [])
    .map((d) => {
      const hasTopics = hotTopics.some((ht) => ht.disciplinaId === d.id);
      return `<option value="${d.id}">${hasTopics ? '✅ ' : '⚪ '}${esc(d.nome)}</option>`;
    })
    .join('');

  // Clear Temp Matches on re-render
  analyzerCtx.tempMatchResults = [];

  const savedDiscsHtml = (edital.disciplinas || [])
    .filter((d) => hotTopics.some((ht) => ht.disciplinaId === d.id))
    .map((d) => {
      const topicCount = hotTopics.filter((ht) => ht.disciplinaId === d.id).length;
      return `<div style="display:inline-flex; align-items:center; background:var(--bg-hover); border:1px solid var(--border); border-radius:16px; padding:4px 12px; font-size:12px; gap:8px;">
          <span style="font-weight:600; cursor:pointer;" data-action="carregar-analise-banca" data-disc-id="${d.id}" title="Visualizar e Editar">${esc(d.nome)} (${topicCount})</span>
          <button class="icon-btn" style="width:20px;height:20px;font-size:11px;color:var(--red);" data-action="excluir-analise-banca" data-disc-id="${d.id}" title="Excluir Importação" aria-label="Excluir importação de ${esc(d.nome)}"><i class="fa fa-trash" aria-hidden="true"></i></button>
      </div>`;
    })
    .join('');

  const savedAnalysisSection = savedDiscsHtml
    ? `
      <div style="margin-top:24px; border-top:1px solid var(--border); padding-top:16px;">
          <div class="dash-label" style="margin-bottom:12px; font-size:11px;">Análises Salvas (Edição Rápida)</div>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${savedDiscsHtml}
          </div>
      </div>
      `
    : '';

  el.innerHTML = `
      <div class="banca-analyzer-shell">
        <div class="card p-16 banca-analyzer-header" style="display:flex; justify-content:space-between; align-items:center;">
            <div>
               <h2 style="margin:0; font-size:18px;">Inteligência de Banca / Análise Preditiva</h2>
               <div style="font-size:13px; color:var(--text-secondary); margin-top:4px;">Cruze os Assuntos mais Cobrados com o seu Edital Atual para gerar as Prioridades P1/P2/P3.</div>
            </div>
            <div>
               <select id="banca-edital-select" class="form-control" style="width:300px; font-weight:600;" data-action="mudar-edital-analisador">
                   ${editaisOptions}
               </select>
            </div>
        </div>

        <div class="banca-analyzer-grid">
            <!-- PAINEL ESQUERDO: IMPORTAÇÃO -->
            <div class="card p-16 banca-analyzer-left">
                <div class="dash-label" style="margin-bottom:8px;">1. Planejamento (Hot Topics)</div>
                <input type="text" id="banca-disc-search" class="form-control" style="margin-bottom:8px;font-size:13px;" placeholder="Buscar matéria..." data-action="filtrar-dropdown-banca">
                <select id="banca-disc-select" class="form-control" style="margin-bottom:12px;font-weight:600;" data-action="filtrar-view-por-disciplina">
                    <option value="" disabled selected>-- Escolha a Matéria --</option>
                    ${discOptions}
                </select>

                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">Cole aqui o Ranking da Banca respectivo à matéria (com porcentagens, ou ordenados por lista).</div>
                <textarea id="banca-input-text" class="form-control" rows="12" style="font-family:inherit;font-size:13px;resize:vertical;" placeholder="Ex:\n1. Atos Administrativos (25%)\n2. Licitações (18%)\n3. Improbidade Administrativa"></textarea>

                <button class="btn btn-primary" style="width:100%; margin-top:12px;" data-action="parse-banca-text"><i class="fa fa-bolt"></i> Processar Matéria</button>

                <div style="margin-top:16px; font-size:11px; color:var(--text-muted); line-height:1.5;">
                    <i class="fa fa-info-circle"></i> O algoritmo irá limpar a sujeira (porcentagens, numeração) simulando o Match NLP via Levenshtein e Stopwords nos Assuntos reais.
                </div>
                ${savedAnalysisSection}
            </div>

            <!-- PAINEL DIREITO: PREVISÃO E MATCH -->
            <div class="card p-16 banca-analyzer-right">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:12px;">
                    <div class="dash-label" style="margin:0;">2. Previsão de Match (Simulação)</div>
                    <div id="banca-stats" style="font-size:12px;font-weight:600;color:var(--accent);">Aguardando Input...</div>
                </div>

                <div id="banca-match-empty" style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; color:var(--text-muted);">
                     <i class="fa fa-brain" style="font-size:48px; margin-bottom:16px; opacity:0.3;"></i>
                     <div style="text-align:center;">Selecione a Matéria e clique em Processar<br>para visualizar o Ranking Inteligente.</div>
                </div>

                <div id="banca-match-results" style="display:none; flex:1; overflow-y:auto; padding-right:8px;" class="custom-scrollbar">
                    <!-- Tabela populada via JS -->
                </div>

                <div style="margin-top:16px; border-top:1px solid var(--border); padding-top:16px; text-align:right;">
                    <button class="btn btn-primary" id="banca-apply-btn" style="display:none;" data-action="apply-banca-ranking"><i class="fa fa-save"></i> Gravar P1/P2/P3 no Edital Local</button>
                </div>
            </div>
        </div>
      </div>
      `;
}

// ── Change Edital in Analyzer ──
export function mudarEditalAnalisador(editaId) {
  analyzerCtx.editaId = editaId;
  renderBancaAnalyzerContent(document.getElementById('main-content'));
}

// ── Filter View by Discipline ──
export function filtrarViewPorDisciplina(discId) {
  const hotTopics = state.bancaRelevance?.hotTopics || [];
  const hasTopics = hotTopics.some((ht) => ht.disciplinaId === discId);

  // Reset selection state when the result set changes
  analyzerCtx.selectedAssuntos = new Set();
  analyzerCtx.selectionInitialized = false;

  if (hasTopics) {
    analyzerCtx.tempMatchResults = applyRankingToEdital(analyzerCtx.editaId).filter(
      (res) => res.discId === discId
    );
    renderBancaMatches();
  } else {
    analyzerCtx.tempMatchResults = [];
    renderBancaMatches();
  }
}

// ── Load Saved Analysis ──
export function carregarAnaliseBanca(discId) {
  const selectEl = document.getElementById('banca-disc-select');
  if (selectEl) selectEl.value = discId;

  const hotTopics = state.bancaRelevance?.hotTopics || [];
  const topicsForDisc = hotTopics.filter((ht) => ht.disciplinaId === discId);

  if (topicsForDisc.length > 0) {
    topicsForDisc.sort((a, b) => {
      if (a.rank && b.rank) return a.rank - b.rank;
      if (a.weight && b.weight) return b.weight - a.weight;
      return 0;
    });

    const textStr = topicsForDisc
      .map((ht) => {
        const wStr = ht.weight ? ` (${ht.weight} %)` : '';
        return `${ht.rank ? ht.rank + '.' : '-'} ${ht.nome}${wStr} `;
      })
      .join('\n');

    const textarea = document.getElementById('banca-input-text');
    if (textarea) textarea.value = textStr;
  }

  filtrarViewPorDisciplina(discId);
}

// ── Delete Analysis ──
export function excluirAnaliseBanca(discId) {
  const edital = state.editais.find((e) => e.id === analyzerCtx.editaId);
  const discName = edital?.disciplinas?.find((d) => d.id === discId)?.nome || 'esta disciplina';

  showConfirm(
    `Tem certeza que deseja apagar a análise preditiva salva de "${discName}" ?\nOs Hot Topics importados serão removidos.`,
    () => {
      state.bancaRelevance.hotTopics = state.bancaRelevance.hotTopics.filter(
        (ht) => ht.disciplinaId !== discId
      );

      if (analyzerCtx.editaId) {
        revertEditalOrdering(analyzerCtx.editaId, discId);
      } else {
        scheduleSave();
      }

      const selectEl = document.getElementById('banca-disc-select');
      if (selectEl && selectEl.value === discId) {
        selectEl.value = '';
        const textEl = document.getElementById('banca-input-text');
        if (textEl) textEl.value = '';
        analyzerCtx.tempMatchResults = [];
      }

      renderBancaAnalyzerContent(document.getElementById('main-content'));
      showToast('Análise excluída e Assuntos Reordenados para o Default.', 'success');
    },
    { title: 'Excluir Análise', danger: true }
  );
}

// ── Parse Banca Text ──
export function parseBancaText() {
  const discId = document.getElementById('banca-disc-select').value;
  if (!discId) {
    showToast('Selecione uma matéria no campo acima antes de processar.', 'error');
    return;
  }

  // Ensure analyzerCtx.editaId is set (fallback if view rendered before state loaded)
  if (!analyzerCtx.editaId) {
    analyzerCtx.editaId = getActiveDashboardDiscCtx()?.editaId || state.editais[0]?.id;
  }

  const rawArgs = document.getElementById('banca-input-text').value;
  if (!rawArgs.trim()) {
    showToast('Nenhum texto informado.', 'error');
    return;
  }

  const lines = rawArgs
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);
  const parsedRows = [];

  lines.forEach((line, idx) => {
    let weight = undefined;
    let extName = line;

    const rankMatch = extName.match(/^(\d+)[.)\u2013\u2014-]\s+(.*)/);
    if (rankMatch) {
      extName = rankMatch[2];
    }

    const percMatch = extName.match(
      /(.*?)(?:(?:\s*\()|\s*[\u2013\u2014-])?\s*(\d+(?:[.,]\d+)?)\s*%(?:\))?/
    );
    if (percMatch && percMatch[2]) {
      extName = percMatch[1].trim();
      weight = parseFloat(percMatch[2].replace(',', '.'));
    } else {
      if (extName.toUpperCase().includes('ALTA')) weight = 100;
      else if (extName.toUpperCase().match(/\bM[EÉ]DIA\b/)) weight = 60;
      else if (extName.toUpperCase().includes('BAIXA')) weight = 30;
    }

    parsedRows.push({
      id: uid(),
      nome: extName.replace(/[*\u2013\u2014•-]/g, '').trim(),
      rank: idx + 1,
      weight: weight,
      disciplinaId: discId,
    });
  });

  // Sem linhas reconhecíveis, não substitui a análise salva da disciplina
  // (o replace abaixo apagaria os tópicos existentes e diria "sucesso").
  if (parsedRows.length === 0) {
    showToast('Nenhum tópico reconhecido no texto informado.', 'error');
    return;
  }

  let existingTopics =
    state.bancaRelevance && state.bancaRelevance.hotTopics ? state.bancaRelevance.hotTopics : [];
  existingTopics = existingTopics.filter((ht) => ht.disciplinaId !== discId);

  if (!state.bancaRelevance) state.bancaRelevance = {};
  state.bancaRelevance.hotTopics = existingTopics.concat(parsedRows);
  scheduleSave();

  const selectOpt = document.querySelector(`#banca-disc-select option[value="${discId}"]`);
  if (selectOpt && !selectOpt.text.startsWith('✅')) {
    selectOpt.text = selectOpt.text.replace('⚪', '✅');
  }
  document.getElementById('banca-input-text').value = '';

  // Apply ranking
  const results = applyRankingToEdital(analyzerCtx.editaId);
  analyzerCtx.tempMatchResults = results.filter((res) => res.discId === discId);

  // Reset selection so newly-parsed rows get default selection (HIGH/MEDIUM auto-checked)
  analyzerCtx.selectedAssuntos = new Set();
  analyzerCtx.selectionInitialized = false;

  renderBancaMatches();
  showToast('Matéria processada com sucesso!', 'success');
}

// ── Render Banca Matches ──
export function renderBancaMatches() {
  const container = document.getElementById('banca-match-results');
  const emptyView = document.getElementById('banca-match-empty');
  const applyBtn = document.getElementById('banca-apply-btn');
  const statsDiv = document.getElementById('banca-stats');

  if (!analyzerCtx.tempMatchResults || analyzerCtx.tempMatchResults.length === 0) {
    container.style.display = 'none';
    applyBtn.style.display = 'none';
    emptyView.style.display = 'flex';
    statsDiv.textContent = 'Aguardando Input...';
    return;
  }

  // Initialize per-row selection state on first render of these results.
  // Default: HIGH/MEDIUM are checked, LOW is unchecked (user explicitly opts in).
  if (!analyzerCtx.selectedAssuntos) analyzerCtx.selectedAssuntos = new Set();
  for (const res of analyzerCtx.tempMatchResults) {
    const key = res.assuntoId || res.assuntoNome;
    if (!analyzerCtx.selectedAssuntos.has(key) && !analyzerCtx.selectionInitialized) {
      if (res.matchData?.confidence !== 'LOW') {
        analyzerCtx.selectedAssuntos.add(key);
      }
    }
  }
  analyzerCtx.selectionInitialized = true;

  let p1c = 0,
    p2c = 0,
    lowMatchCount = 0;

  const rows = analyzerCtx.tempMatchResults.map((res) => {
    if (res.priority === 'P1') p1c++;
    if (res.priority === 'P2') p2c++;
    if (res.matchData?.confidence === 'LOW') lowMatchCount++;

    const stIcon =
      res.priority === 'P1' ? 'fa-fire' : res.priority === 'P2' ? 'fa-bolt' : 'fa-check';
    const stColor =
      res.priority === 'P1'
        ? 'var(--red)'
        : res.priority === 'P2'
          ? 'var(--orange)'
          : 'var(--text-muted)';

    const confBadgeColor =
      res.matchData.confidence === 'HIGH'
        ? 'var(--green)'
        : res.matchData.confidence === 'MEDIUM'
          ? 'var(--yellow)'
          : 'var(--text-muted)';

    const key = res.assuntoId || res.assuntoNome;
    const checked = analyzerCtx.selectedAssuntos.has(key) ? 'checked' : '';

    return `
      <div class="banca-match-row" style="display:grid; grid-template-columns:24px 30px minmax(0,1fr) minmax(0,1fr) 45px 40px; gap:8px; border-bottom:1px solid var(--border); padding:10px 0; align-items:center;">
                <div><input type="checkbox" data-action="banca-toggle-row" data-key="${esc(key)}" ${checked} title="Incluir este tópico ao gravar"></div>
                <div style="color:${stColor}; font-size:14px; text-align:center;"><i class="fa ${stIcon}"></i></div>
                <div>
                   <div style="font-size:13px; font-weight:700; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title="${esc(res.assuntoNome)}">${esc(res.assuntoNome)}</div>
                   <div style="font-size:11px; color:var(--text-muted);">${esc(res.discNome)}</div>
                </div>
                <div>
                   <div style="font-size:12px; font-weight:600; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title="${res.matchData.matchedItem ? esc(res.matchData.matchedItem.nome) : 'Sem Incidencia'}">
                       ${res.matchData.matchedItem ? esc(res.matchData.matchedItem.nome) : '<span style="color:var(--text-muted);"><i>Sem Incidência</i></span>'}
                   </div>
                   <div style="font-size:10px; color:${confBadgeColor};">${res.matchData.reason} | Score: ${res.finalScore.toFixed(0)}</div>
                </div>
                <div>
                     <span class="event-tag" style="background:${stColor}; font-weight:900;">${res.priority}</span>
                </div>
                <div>
                     <button class="btn btn-ghost btn-sm" title="Corrigir Erro Textual" data-action="open-match-corrector" data-assunto-nome="${esc(res.assuntoNome)}"><i class="fa fa-edit"></i></button>
                </div>
            </div>
      `;
  });

  emptyView.style.display = 'none';
  const lowBadge =
    lowMatchCount > 0
      ? `<span class="badge" style="background:rgba(148,163,184,0.18);color:var(--text-muted);font-weight:600;" title="Matches de baixa confiança não vêm marcados por padrão. Revise antes de gravar.">⚠ ${lowMatchCount} incerto(s)</span>`
      : '';
  container.innerHTML = `
      <div class="banca-match-toolbar" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;border-bottom:1px solid var(--border);padding-bottom:8px;">
        <button class="btn btn-ghost btn-sm" data-action="banca-select-all">Selecionar todos</button>
        <button class="btn btn-ghost btn-sm" data-action="banca-deselect-all">Desmarcar todos</button>
        <button class="btn btn-ghost btn-sm" data-action="banca-select-high-only">Só alta confiança</button>
        <span style="margin-left:auto;font-size:11px;color:var(--text-muted);" id="banca-selected-count"></span>
        ${lowBadge}
      </div>
      <div class="dash-label" style="margin-bottom:8px;display:flex;justify-content:space-between;">
           <span>Matéria Processada (Assuntos do Edital local)</span>
           <span>Prioridade Reordenada</span>
        </div>
      ${rows.join('')}
    `;

  container.style.display = 'block';
  applyBtn.style.display = 'inline-block';
  applyBtn.disabled = analyzerCtx.selectedAssuntos.size === 0;
  statsDiv.textContent = `P1: ${p1c} | P2: ${p2c} | Selecionados: ${analyzerCtx.selectedAssuntos.size}/${analyzerCtx.tempMatchResults.length}`;
  const cntEl = document.getElementById('banca-selected-count');
  if (cntEl) cntEl.textContent = `${analyzerCtx.selectedAssuntos.size} selecionado(s)`;
}

// ── Per-row selection helpers (Batch 3) ──
export function bancaToggleRow(key) {
  if (!analyzerCtx.selectedAssuntos) analyzerCtx.selectedAssuntos = new Set();
  if (analyzerCtx.selectedAssuntos.has(key)) analyzerCtx.selectedAssuntos.delete(key);
  else analyzerCtx.selectedAssuntos.add(key);
  renderBancaMatches();
}

export function bancaSelectAll() {
  analyzerCtx.selectedAssuntos = new Set(
    (analyzerCtx.tempMatchResults || []).map((r) => r.assuntoId || r.assuntoNome)
  );
  renderBancaMatches();
}

export function bancaDeselectAll() {
  analyzerCtx.selectedAssuntos = new Set();
  renderBancaMatches();
}

export function bancaSelectHighOnly() {
  analyzerCtx.selectedAssuntos = new Set(
    (analyzerCtx.tempMatchResults || [])
      .filter((r) => r.matchData?.confidence === 'HIGH')
      .map((r) => r.assuntoId || r.assuntoNome)
  );
  renderBancaMatches();
}

// ── Apply Banca Ranking ──
export function applyBancaRanking() {
  const selected = analyzerCtx.selectedAssuntos || new Set();
  if (selected.size === 0) {
    showToast('Nenhum tópico selecionado para gravar.', 'error');
    return;
  }
  const filtered = (analyzerCtx.tempMatchResults || []).filter((r) =>
    selected.has(r.assuntoId || r.assuntoNome)
  );
  if (filtered.length === 0) {
    showToast('Nenhum tópico selecionado para gravar.', 'error');
    return;
  }
  if (commitEditalOrdering(analyzerCtx.editaId, filtered)) {
    showToast(
      `Prioridades gravadas! (${filtered.length} de ${analyzerCtx.tempMatchResults.length} tópicos)`,
      'success'
    );
  } else {
    showToast('Falha crítica ao gravar novo Edital na Store', 'error');
  }
}

// ── Open Match Corrector ──
export function openMatchCorrector(assuntoNome) {
  let hotTopics = state.bancaRelevance?.hotTopics || [];

  const lenOriginal = hotTopics.length;
  hotTopics = hotTopics.filter((ht) => ht.nome.length < 150);
  if (hotTopics.length !== lenOriginal) {
    state.bancaRelevance.hotTopics = hotTopics;
    scheduleSave();
  }

  const optionsHtml = hotTopics
    .map(
      (ht) =>
        `<option value = "${ht.id}" style = "width:100%;max-width:350px;" > ${esc(ht.nome)} (Rank: ${ht.rank || ht.weight})</option> `
    )
    .join('');

  // Onboarding hint — shown only the first time the user opens this modal
  let onboardingHtml = '';
  try {
    if (!localStorage.getItem('estudo_onboarding_match_corrector_seen')) {
      onboardingHtml = `
        <div class="onboarding-hint" style="background:rgba(78,161,255,0.08);border:1px solid rgba(78,161,255,0.25);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:var(--text-secondary);line-height:1.5;">
          <strong style="color:var(--accent);">💡 Como funciona:</strong> O parser tentou cruzar este tópico do seu Edital com os "hot topics" colados da banca. Se o match foi errado, escolha aqui o tema correto — daqui pra frente esse assunto sempre vai casar com a sua escolha (HIGH 100%).
        </div>`;
      localStorage.setItem('estudo_onboarding_match_corrector_seen', '1');
    }
  } catch {
    /* ignore localStorage failures */
  }

  document.getElementById('modal-match-corrector-title').textContent = 'Corrigir Assunto';
  document.getElementById('modal-match-corrector-body').innerHTML = `
    ${onboardingHtml}
    <div class="form-group" >
            <div style="margin-bottom:8px;font-size:13px;font-weight:700;">${esc(assuntoNome)}</div>
            <label class="form-label" style="margin-top:16px;">Qual tema real da Banca equivale a esse tópico do Edital?</label>
            <select id="corrector-select" class="form-control" style="max-width:350px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
                <option value="NONE">⚠️ Nenhuma Correspondência (Sem Incidência Real)</option>
                ${optionsHtml}
            </select>
            <div style="font-size:11px;color:var(--text-muted);margin-top:8px;">
                Isto forçará um *Match 100% (HIGH)* daqui pra frente.
            </div>
        </div>

    <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">
      <button class="btn btn-ghost" data-action="close-modal" data-modal="modal-match-corrector">Cancelar</button>
      <button class="btn btn-primary" data-action="save-match-correction" data-assunto-nome="${esc(assuntoNome)}">Forçar Correção</button>
    </div>
  `;
  openModal('modal-match-corrector');
}

// ── Save Match Correction ──
export function saveMatchCorrection(assuntoOrigemRaw) {
  const overrideId = document.getElementById('corrector-select').value;

  if (!state.bancaRelevance) state.bancaRelevance = {};
  if (!state.bancaRelevance.userMappings) state.bancaRelevance.userMappings = {};

  state.bancaRelevance.userMappings[assuntoOrigemRaw] = overrideId;
  scheduleSave();

  closeModal('modal-match-corrector');

  if (analyzerCtx.parsedHotTopics || analyzerCtx.tempMatchResults) {
    const discId = document.getElementById('banca-disc-select').value;
    if (discId) {
      analyzerCtx.tempMatchResults = applyRankingToEdital(analyzerCtx.editaId).filter(
        (res) => res.discId === discId
      );
      renderBancaMatches();
    }
  }
}
