/**
 * Pontos Fracos View Module
 * Ranking de assuntos por taxa de acerto em questões (pior → melhor),
 * agrupado por disciplina, com janela temporal e ação rápida de estudo.
 */

import { state } from '../store.js?v=8.37';
import { esc, cutoffDateStr, renderSparkline } from '../utils.js?v=8.37';
import { renderCurrentView } from '../components.js?v=8.37';
import { MIN_QUESTOES_CONFIAVEL } from '../logic/weak-points.js';
import { computeWeakPointsMemo } from '../logic/weak-points-memo.js';

// Estado de UI da aba (module-level, mesmo padrão de dashPeriod)
export let pfWindowDays = 90; // 30 | 90 | null (Tudo)
let pfEditalId = null;
let pfDiscId = null;
let pfIncluirArquivados = false;
// Cards de disciplina expandidos na grade (chave editalId|discId) — estado de
// sessão, não persiste.
const pfExpanded = new Set();

// Valor especial do select de editais: agrega ativos E arquivados.
export const PF_TODOS_ARQUIVADOS = '__todos_arquivados__';

export function setPfWindow(days) {
  pfWindowDays = days;
  renderCurrentView();
}

export function setPfEditalFilter(editalId) {
  if (editalId === PF_TODOS_ARQUIVADOS) {
    pfEditalId = null;
    pfIncluirArquivados = true;
  } else {
    pfEditalId = editalId || null;
    pfIncluirArquivados = false;
  }
  pfDiscId = null; // trocar de edital invalida o filtro de disciplina
  renderCurrentView();
}

export function setPfDiscFilter(discId) {
  pfDiscId = discId || null;
  renderCurrentView();
}

export function togglePfCard(key) {
  if (!key) return;
  if (pfExpanded.has(key)) pfExpanded.delete(key);
  else pfExpanded.add(key);
  renderCurrentView();
}

const FAIXA_COLORS = {
  vermelho: 'var(--red)',
  amarelo: 'var(--accent)',
  verde: 'var(--green)',
};

function taxaBadge(taxa, faixa) {
  if (taxa === null) return '<span class="text-muted">—</span>';
  return `<span class="font-bold" style="color:${FAIXA_COLORS[faixa]};">${taxa}%</span>`;
}

function taxaBar(taxa, faixa) {
  if (taxa === null) return '';
  return `
    <div style="height:6px; border-radius:var(--radius-xxs); background:var(--bg-tertiary, rgba(128,128,128,.15)); overflow:hidden;">
      <div style="width:${taxa}%; height:100%; border-radius:var(--radius-xxs); background:${FAIXA_COLORS[faixa]};"></div>
    </div>`;
}

function acaoBtn(a) {
  return `<button type="button" class="btn btn-ghost btn-sm" data-action="add-evento-para-assunto"
    data-edital-id="${a.editalId}" data-disc-id="${a.discId}" data-assunto-id="${a.assId}"
    title="Abrir o modal de estudo com este assunto pré-selecionado">
    <i class="fa fa-play"></i> Estudar / Agendar
  </button>`;
}

function sparklineSemanal(a) {
  const taxas = (a.serie || []).map((s) => s.taxa);
  if (taxas.filter((t) => t !== null).length < 2) return '';
  const titulo = taxas.map((t) => (t === null ? '—' : `${t}%`)).join(' · ');
  return `<span class="pf-sparkline" title="Evolução semanal (antiga → recente): ${titulo}">${renderSparkline(
    taxas,
    { width: 56, height: 16, stroke: FAIXA_COLORS[a.faixa] || 'var(--accent)' }
  )}</span>`;
}

function assuntoRow(a) {
  return `
    <div class="flex-between" style="gap:12px; padding:8px 0; border-bottom:1px solid var(--border, rgba(128,128,128,.15));">
      <div style="flex:1; min-width:0;">
        <div class="flex-between" style="gap:8px;">
          <span class="text-md" title="${esc(a.nome)}">${a.concluido ? '✅ ' : ''}${esc(a.nome)}</span>
          ${taxaBadge(a.taxa, a.faixa)}
        </div>
        ${taxaBar(a.taxa, a.faixa)}
        <div class="flex-between" style="gap:8px;">
          <div class="text-sm text-muted">${a.acertos} acertos · ${a.erros} erros · ${a.total} questões${a.confiavel ? '' : ' · <span title="Menos de ' + MIN_QUESTOES_CONFIAVEL + ' questões: taxa pouco confiável, posição suavizada pela média geral">⚠ poucas questões</span>'}</div>
          ${sparklineSemanal(a)}
        </div>
      </div>
      ${acaoBtn(a)}
    </div>`;
}

function discCardKey(disc) {
  return `${disc.editalId}|${disc.discId}`;
}

function topAssuntoRow(a) {
  return `
    <div class="pf-top-row">
      <span class="pf-top-nome" title="${esc(a.nome)}">${esc(a.nome)}</span>
      ${taxaBadge(a.taxa, a.faixa)}
    </div>`;
}

/**
 * Card compacto por edital+disciplina na grade: taxa geral, nº de questões e
 * top 3 assuntos mais fracos (por taxa ajustada). Expandido, ocupa a largura
 * da grade e lista todos os assuntos com o botão "Estudar / Agendar".
 */
function discCard(disc, assuntos, editalArquivado) {
  const key = discCardKey(disc);
  const expanded = pfExpanded.has(key);
  const respondidas = disc.acertos + disc.erros;
  const editalBadge = `· ${esc(disc.editalNome)}${editalArquivado ? ' 📦' : ''}`;
  return `
    <div class="card pf-card ${expanded ? 'pf-card--expanded' : ''}">
      <button type="button" class="pf-card-header" data-action="pf-toggle-card" data-key="${esc(key)}"
        aria-expanded="${expanded}" title="${expanded ? 'Recolher assuntos' : 'Ver todos os assuntos'}">
        <span class="pf-card-title">${disc.icone || '📚'} ${esc(disc.discNome)}
          <span class="text-sm text-muted">${editalBadge}</span>
        </span>
        <span class="pf-card-taxa">${taxaBadge(disc.taxa, disc.faixa)}</span>
        <i class="fa fa-chevron-${expanded ? 'up' : 'down'} pf-card-chevron" aria-hidden="true"></i>
      </button>
      <div class="pf-card-sub text-sm text-muted">${respondidas} questões respondidas · ${assuntos.length} assunto(s)</div>
      <div class="pf-card-body">
        ${expanded ? assuntos.map(assuntoRow).join('') : assuntos.slice(0, 3).map(topAssuntoRow).join('')}
      </div>
    </div>`;
}

function windowTabs() {
  const options = [
    { days: 30, label: '30d' },
    { days: 90, label: '90d' },
    { days: null, label: 'Tudo' },
  ];
  return `
    <div class="cal-view-tabs" role="tablist" aria-label="Período dos pontos fracos">
      ${options
        .map(
          (o) => `
        <button type="button" class="cal-view-tab ${pfWindowDays === o.days ? 'active' : ''}"
          data-action="set-pf-window" data-days="${o.days}" role="tab"
          aria-selected="${pfWindowDays === o.days}">${o.label}</button>`
        )
        .join('')}
    </div>`;
}

function filterSelects() {
  const editais = (state.editais || []).filter(Boolean);
  const temArquivados = editais.some((ed) => ed.arquivado);
  const editalOptions = editais
    .map(
      (ed) =>
        `<option value="${ed.id}" ${pfEditalId === ed.id ? 'selected' : ''}>${
          ed.arquivado ? '📦 ' : ''
        }${esc(ed.nome)}${ed.arquivado ? ' (arquivado)' : ''}</option>`
    )
    .join('');
  // Disciplinas do universo atualmente filtrado: edital específico (mesmo
  // arquivado), ou os ativos ("Todos"), ou tudo ("Todos + arquivados").
  const discs = editais
    .filter((ed) =>
      pfEditalId ? ed.id === pfEditalId : pfIncluirArquivados || !ed.arquivado
    )
    .flatMap((ed) => (ed.disciplinas || []).filter((d) => d && !d.arquivada));
  const discOptions = discs
    .map(
      (d) => `<option value="${d.id}" ${pfDiscId === d.id ? 'selected' : ''}>${esc(d.nome)}</option>`
    )
    .join('');
  return `
    <select class="form-control" style="width:auto;" data-action="set-pf-edital-filter" aria-label="Filtrar por edital">
      <option value="">Todos os editais</option>
      ${
        temArquivados
          ? `<option value="${PF_TODOS_ARQUIVADOS}" ${pfIncluirArquivados ? 'selected' : ''}>Todos + arquivados</option>`
          : ''
      }
      ${editalOptions}
    </select>
    <select class="form-control" style="width:auto;" data-action="set-pf-disc-filter" aria-label="Filtrar por disciplina">
      <option value="">Todas as disciplinas</option>
      ${discOptions}
    </select>`;
}

export function renderPontosFracos(el) {
  const cutoffStr = pfWindowDays ? cutoffDateStr(pfWindowDays) : null;
  // Série semanal cabe dentro da janela principal: 30d→4, 90d→12, Tudo→12
  const seriesWeeks = pfWindowDays ? Math.min(12, Math.floor(pfWindowDays / 7)) : 12;
  const result = computeWeakPointsMemo({
    eventos: state.eventos || [],
    arquivo: state.arquivo || [],
    editais: state.editais || [],
    cutoffStr,
    editalFilterId: pfEditalId,
    includeArquivados: pfIncluirArquivados,
    discFilterId: pfDiscId,
    seriesWeeks,
    todayStr: cutoffDateStr(0),
  });

  // Ranking agrupado por disciplina (disciplinas já vêm da pior para a melhor).
  // Ordena pela taxa ajustada (média bayesiana): amostras pequenas não dominam o topo.
  const grupos = result.disciplinas
    .map((disc) => ({
      disc,
      assuntos: disc.assuntos
        .filter((a) => a.total > 0)
        .slice()
        .sort((a, b) => {
          if (a.taxaAjustada === null || b.taxaAjustada === null)
            return (a.taxaAjustada === null) - (b.taxaAjustada === null);
          return a.taxaAjustada - b.taxaAjustada || b.total - a.total;
        }),
    }))
    .filter((g) => g.assuntos.length > 0);

  const periodoLabel = pfWindowDays ? `últimos ${pfWindowDays} dias` : 'todo o histórico';

  const arquivadoPorEdital = new Map(
    (state.editais || []).filter(Boolean).map((ed) => [ed.id, !!ed.arquivado])
  );
  const rankingHtml = grupos.length
    ? `<div class="pf-grid">${grupos
        .map((g) => discCard(g.disc, g.assuntos, arquivadoPorEdital.get(g.disc.editalId)))
        .join('')}</div>`
    : `<div class="card pf-card mb-4"><div class="card-body text-muted">
         Nenhuma questão registrada em ${periodoLabel}.
         Registre acertos e erros nas suas sessões de estudo para ver seus pontos fracos aqui.
       </div></div>`;

  const semHtml = result.semQuestoes.length
    ? `<details class="card pf-card mb-4">
        <summary style="cursor:pointer; padding:12px 16px;">
          🕳️ Sem questões registradas (${result.semQuestoes.length})
        </summary>
        <div class="card-body">
          ${result.semQuestoes
            .map(
              (a) => `
            <div class="flex-between" style="gap:12px; padding:6px 0;">
              <span class="text-md">${esc(a.nome)}
                <span class="text-sm text-muted">· ${esc(a.discNome)}</span>
              </span>
              ${acaoBtn(a)}
            </div>`
            )
            .join('')}
        </div>
      </details>`
    : '';

  const orfaosHtml =
    result.orfaos.total > 0
      ? `<div class="text-sm text-muted mb-4">
          ℹ️ ${result.orfaos.total} questões registradas em assuntos que não existem mais foram
          contabilizadas apenas no total da disciplina.
        </div>`
      : '';

  el.innerHTML = `
    <div class="flex-between mb-4" style="flex-wrap:wrap; gap:12px;">
      <div class="text-md text-secondary">
        Seus pontos fracos por taxa de acerto — <strong class="text-primary">${periodoLabel}</strong>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        ${filterSelects()}
        ${windowTabs()}
      </div>
    </div>
    ${rankingHtml}
    ${semHtml}
    ${orfaosHtml}
  `;
}
