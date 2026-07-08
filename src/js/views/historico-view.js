// =============================================
// HISTORICO DE SESSOES
// =============================================

import { state } from '../store.js?v=8.37';
import { formatDate, formatTime, esc, normalizeSearch, cutoffDateStr } from '../utils.js?v=8.37';
import { getDisc } from '../logic.js?v=8.37';
import { getUiSection, setUiSection } from '../ui-state.js?v=8.37';
import {
  disciplineBelongsToSelectedEdital,
  eventBelongsToSelectedEdital,
} from '../edital-filter.js?v=8.37';

const PAGE_SIZE = 30; // grupos por dia exibidos por página

function getFilters() {
  return getUiSection('historico');
}

function applyFilters(eventos, filters) {
  const { rangeDays, disciplinaId, busca } = filters;
  const buscaNorm = busca ? normalizeSearch(busca) : '';
  let cutoff = null;
  if (rangeDays && rangeDays !== 'all') {
    const days = Number(rangeDays);
    if (Number.isFinite(days) && days > 0) {
      // cutoffDateStr usa a data LOCAL; toISOString (UTC) avançaria um dia à noite
      // em fusos negativos e excluiria sessões do limite da janela.
      cutoff = cutoffDateStr(days);
    }
  }
  return eventos.filter((ev) => {
    if (!eventBelongsToSelectedEdital(ev, { allowAll: false })) return false;
    const dt = ev.dataEstudo || ev.data || '';
    if (cutoff && dt < cutoff) return false;
    if (disciplinaId && ev.discId !== disciplinaId) return false;
    if (buscaNorm) {
      const haystack = normalizeSearch(`${ev.titulo || ''} ${ev.descricao || ''}`);
      if (!haystack.includes(buscaNorm)) return false;
    }
    return true;
  });
}

function buildFilterToolbar(filters, disciplinas, totalAfter, totalBefore) {
  const opts = [
    { value: '7', label: 'Últimos 7d' },
    { value: '30', label: 'Últimos 30d' },
    { value: '90', label: 'Últimos 90d' },
    { value: '365', label: 'Último ano' },
    { value: 'all', label: 'Tudo' },
  ];
  const rangeSel = String(filters.rangeDays ?? 'all');
  const discOptions = disciplinas
    .map(
      (entry) =>
        `<option value="${esc(entry.disc.id)}" ${filters.disciplinaId === entry.disc.id ? 'selected' : ''}>${esc(entry.disc.nome)}</option>`
    )
    .join('');
  return `
    <div class="card p-12 historico-toolbar" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin-bottom:12px;">
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--text-secondary);">
        Período
        <select class="form-control" data-action="historico-set-range" style="min-width:140px;">
          ${opts.map((o) => `<option value="${o.value}" ${rangeSel === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--text-secondary);">
        Disciplina
        <select class="form-control" data-action="historico-set-disciplina" style="min-width:160px;">
          <option value="">Todas</option>
          ${discOptions}
        </select>
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--text-secondary);flex:1;min-width:160px;">
        Busca
        <input type="search" class="form-control" placeholder="Buscar título ou descrição…" value="${esc(filters.busca || '')}" data-action="historico-set-busca" />
      </label>
      <div style="display:flex;gap:6px;align-items:flex-end;">
        ${
          rangeSel !== 'all' || filters.disciplinaId || (filters.busca || '').trim()
            ? '<button class="btn btn-ghost btn-sm" data-action="historico-clear-filters" title="Limpar todos os filtros"><i class="fa fa-times" aria-hidden="true"></i> Limpar filtros</button>'
            : ''
        }
        <button class="btn btn-ghost btn-sm" data-action="historico-export-csv" title="Exportar resultado filtrado em CSV"><i class="fa fa-download"></i> CSV</button>
        <button class="btn btn-ghost btn-sm" data-action="historico-export-json" title="Exportar resultado filtrado em JSON"><i class="fa fa-download"></i> JSON</button>
      </div>
      <div style="flex-basis:100%;font-size:11px;color:var(--text-secondary);">
        Exibindo ${totalAfter} de ${totalBefore} sessões.
      </div>
    </div>
  `;
}

let _renderedDayCount = PAGE_SIZE;
// `_skipNextReset` is set by `loadMoreHistorico` to preserve the counter across
// the immediately-following render. Otherwise, every fresh mount of this view
// (including navigating away and back) resets to PAGE_SIZE.
let _skipNextReset = false;

export function renderHistoricoSessoes(el) {
  if (_skipNextReset) {
    _skipNextReset = false;
  } else {
    _renderedDayCount = PAGE_SIZE;
  }
  const filters = getFilters();
  const allEventos = [...(state.eventos || []), ...(state.arquivo || [])].filter(
    (ev) => ev && ev.status === 'estudei'
  );
  // Baseline do contador "Exibindo X de Y": a view é sempre escopada ao edital
  // selecionado (allowAll:false), então Y precisa contar só o que está nesse escopo —
  // senão "0 de 53" sugere que os filtros locais escondem sessões que eles nem veem.
  const eventosNoEdital = allEventos.filter((ev) =>
    eventBelongsToSelectedEdital(ev, { allowAll: false })
  );
  const eventosFiltrados = applyFilters(allEventos, filters).sort((a, b) => {
    const dateA = String(a.dataEstudo || a.data || '');
    const dateB = String(b.dataEstudo || b.data || '');
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    const timeA = Number(new Date(a.updatedAt || a.createdAt || a.criadoEm || 0).getTime()) || 0;
    const timeB = Number(new Date(b.updatedAt || b.createdAt || b.criadoEm || 0).getTime()) || 0;
    return timeB - timeA;
  });

  // Derive disciplinas inline (avoids importing getAllDisciplinas, which would
  // require additional mocking in unit tests).
  const disciplinas = [];
  for (const ed of state.editais || []) {
    for (const d of ed.disciplinas || []) {
      if (!d.arquivada && disciplineBelongsToSelectedEdital(d.id, { allowAll: false })) {
        disciplinas.push({ disc: d, edital: ed });
      }
    }
  }
  disciplinas.sort((a, b) =>
    String(a.disc.nome).localeCompare(String(b.disc.nome), 'pt-BR', { sensitivity: 'base' })
  );
  const toolbar = buildFilterToolbar(
    filters,
    disciplinas,
    eventosFiltrados.length,
    eventosNoEdital.length
  );

  if (eventosFiltrados.length === 0) {
    const semSessoes = allEventos.length === 0;
    const foraDoEdital = !semSessoes && eventosNoEdital.length === 0;
    const titulo = semSessoes
      ? 'Nenhuma sessão registrada ainda'
      : foraDoEdital
        ? 'Nenhuma sessão neste edital'
        : 'Nenhuma sessão dentro do filtro';
    const hint = semSessoes
      ? 'Quando você finalizar uma sessão de estudo, ela aparecerá aqui.'
      : foraDoEdital
        ? 'As sessões registradas pertencem a editais arquivados — veja-as em "Editais Anteriores".'
        : 'Ajuste o período, disciplina ou busca para ver mais resultados.';
    el.innerHTML = `
      ${toolbar}
      <div class="card p-24 session-empty-state">
        <div class="session-empty-icon">🕘</div>
        <div class="session-empty-title">${titulo}</div>
        <div class="session-empty-hint">${hint}</div>
      </div>
    `;
    return;
  }

  // Group by date
  const gruposPorData = new Map();
  eventosFiltrados.forEach((ev) => {
    const dateKey = ev.dataEstudo || ev.data || '__sem_data__';
    if (!gruposPorData.has(dateKey)) gruposPorData.set(dateKey, new Map());
    const discInfo = ev.discId ? getDisc(ev.discId) : null;
    const discId = discInfo?.disc?.id || '__sem_disciplina__';
    if (!gruposPorData.get(dateKey).has(discId)) {
      gruposPorData.get(dateKey).set(discId, {
        discId,
        discNome: discInfo?.disc?.nome || 'Sem disciplina',
        discIcone: discInfo?.disc?.icone || '📚',
        discCor: discInfo?.disc?.cor || discInfo?.edital?.cor || '#64748b',
        itens: [],
      });
    }
    gruposPorData.get(dateKey).get(discId).itens.push(ev);
  });

  const dateKeys = [...gruposPorData.keys()].sort((a, b) => {
    if (a === '__sem_data__') return 1;
    if (b === '__sem_data__') return -1;
    return String(b).localeCompare(String(a));
  });

  const totalDias = dateKeys.length;
  const visibleDays = dateKeys.slice(0, _renderedDayCount);
  const remainingDays = totalDias - visibleDays.length;

  const totalSessoes = eventosFiltrados.length;
  const totalTempo = eventosFiltrados.reduce((sum, ev) => sum + (Number(ev.tempoAcumulado) || 0), 0);

  el.innerHTML = `
    ${toolbar}
    <div class="card p-16 session-history-summary">
      <div class="session-history-header">
        <div class="dash-label">HISTÓRICO DE SESSÕES (filtrado)</div>
        <div class="session-history-badges">
          <span class="badge">${totalSessoes} sessões</span>
          <span class="badge">⏱ ${formatTime(totalTempo)}</span>
        </div>
      </div>
      <div class="session-history-hint">Agrupado pela data real do estudo e por disciplina.</div>
    </div>

    ${visibleDays
      .map((dateKey) => {
        const disciplinasGrupo = [...gruposPorData.get(dateKey).values()].sort((a, b) =>
          String(a.discNome).localeCompare(String(b.discNome), 'pt-BR', { sensitivity: 'base' })
        );
        const dateLabel = dateKey === '__sem_data__' ? 'Sem data' : formatDate(dateKey);
        const sessoesNoDia = disciplinasGrupo.reduce((sum, d) => sum + d.itens.length, 0);
        return `
        <section class="card p-16 session-group-section">
          <div class="session-group-header">
            <div class="session-group-title">${esc(dateLabel)}</div>
            <div class="session-group-count">${sessoesNoDia} sessão(ões)</div>
          </div>
          <div class="session-group-list">
            ${disciplinasGrupo
              .map((group) => {
                const discName =
                  group.discNome === 'Sem disciplina' || !group.discNome
                    ? 'Disciplina não vinculada'
                    : group.discNome;
                const discIcon = group.discIcone || '📚';
                const discColor = group.discCor || '#64748b';
                return `
              <div class="session-disc-card" style="--session-disc-color:${esc(discColor)};">
                <div class="session-disc-header">
                  <div class="session-disc-title">${esc(discIcon)} ${esc(discName)}</div>
                  <div class="session-disc-count">${group.itens.length} registro(s)</div>
                </div>
                <div class="custom-scrollbar session-scroll-container">
                  ${group.itens
                    .map((ev) => {
                      const questoes = ev.sessao?.questoes || ev.questoes || {};
                      const acertos = Number(questoes.acertos ?? questoes.certas ?? 0) || 0;
                      const erros = Number(questoes.erros ?? questoes.erradas ?? 0) || 0;
                      const totalExplicito = Number(questoes.total ?? questoes.quantidade);
                      const totalQuestoes =
                        Number.isFinite(totalExplicito) && totalExplicito > 0
                          ? totalExplicito
                          : acertos + erros;
                      const percAcertos =
                        totalQuestoes > 0 ? Math.round((acertos / totalQuestoes) * 100) : 0;
                      const paginasRaw = ev.sessao?.paginas;
                      const paginas =
                        Number(
                          (paginasRaw && typeof paginasRaw === 'object'
                            ? paginasRaw.total
                            : paginasRaw) ??
                            ev.paginas ??
                            0
                        ) || 0;
                      const tempoLabel = formatTime(Number(ev.tempoAcumulado) || 0);
                      const discInfo = ev.discId ? getDisc(ev.discId) : null;
                      const assunto =
                        ev.assId && discInfo?.disc?.assuntos
                          ? discInfo.disc.assuntos.find((a) => a.id === ev.assId)?.nome
                          : '';
                      const eventId = esc(String(ev.id || ''));
                      // Sessão multi-tópico: lista os itens de topicos[] com
                      // questões próprias; sessões antigas caem no fallback
                      // escalar (assunto) abaixo.
                      const topicosList = Array.isArray(ev.sessao?.topicos)
                        ? ev.sessao.topicos
                        : [];
                      const topicosHtml = topicosList
                        .map((item) => {
                          const nomeAss = item.assId
                            ? discInfo?.disc?.assuntos?.find((a) => a.id === item.assId)?.nome
                            : '';
                          const nomeAula = item.aulaId
                            ? discInfo?.disc?.aulas?.find((a) => a.id === item.aulaId)?.nome
                            : '';
                          const nome =
                            [nomeAss, nomeAula ? `🎬 ${nomeAula}` : '']
                              .filter(Boolean)
                              .join(' · ') || 'Item';
                          const q = item.questoes;
                          const qBadge =
                            q && Number(q.total) > 0 ? ` — ❓ ${q.acertos}/${q.total}` : '';
                          const doneBadge = item.statusTopico === 'finalizado' ? ' ✅' : '';
                          return `<div class="session-detail-subject">• ${esc(nome)}${esc(qBadge)}${doneBadge}</div>`;
                        })
                        .join('');
                      return `
                    <div class="session-detail-card">
                      <div class="session-detail-row">
                        <div class="session-detail-content">
                          <div class="session-detail-title">${esc(ev.titulo || 'Sessão de estudo')}</div>
                          ${topicosHtml || (assunto ? `<div class="session-detail-subject">Tópico: ${esc(assunto)}</div>` : '')}
                        </div>
                        <div class="session-detail-actions">
                          <button class="btn btn-ghost btn-sm session-item-btn" data-action="edit-session-record" data-session-id="${eventId}" aria-label="Editar sessão" title="Editar"><i class="fa fa-pen"></i></button>
                          <button class="btn btn-ghost btn-sm session-item-btn session-item-btn-danger" data-action="delete-session-record" data-session-id="${eventId}" aria-label="Apagar sessão" title="Apagar"><i class="fa fa-trash"></i></button>
                        </div>
                      </div>
                      <div class="session-item-badges">
                        <span class="badge session-item-badge">⏱ ${tempoLabel}</span>
                        <span class="badge session-item-badge">❓ ${totalQuestoes > 0 ? `${acertos}/${totalQuestoes} (${percAcertos}%)` : '-'}</span>
                        <span class="badge session-item-badge">📄 ${paginas > 0 ? paginas : '-'}</span>
                      </div>
                    </div>
                  `;
                    })
                    .join('')}
                </div>
              </div>
            `;
              })
              .join('')}
          </div>
        </section>
      `;
      })
      .join('')}

    ${
      remainingDays > 0
        ? `<div style="text-align:center;margin:16px 0;">
        <button class="btn btn-ghost" data-action="historico-load-more">Carregar mais ${Math.min(PAGE_SIZE, remainingDays)} dia(s) (${remainingDays} restantes)</button>
      </div>`
        : ''
    }
  `;
}

// ── Action helpers (called from view router / event delegation) ──

export function setHistoricoFilter(patch) {
  setUiSection('historico', patch);
  _renderedDayCount = PAGE_SIZE; // reset paging on filter change
}

export function loadMoreHistorico() {
  _renderedDayCount += PAGE_SIZE;
  _skipNextReset = true;
}

function buildExportRows() {
  const filters = getFilters();
  const allEventos = [...(state.eventos || []), ...(state.arquivo || [])].filter(
    (ev) => ev && ev.status === 'estudei'
  );
  const filtered = applyFilters(allEventos, filters);
  return filtered.map((ev) => {
    const discInfo = ev.discId ? getDisc(ev.discId) : null;
    const questoes = ev.sessao?.questoes || ev.questoes || {};
    const acertos = Number(questoes.acertos ?? questoes.certas ?? 0) || 0;
    const erros = Number(questoes.erros ?? questoes.erradas ?? 0) || 0;
    const totalExplicito = Number(questoes.total ?? questoes.quantidade);
    const total =
      Number.isFinite(totalExplicito) && totalExplicito > 0 ? totalExplicito : acertos + erros;
    const paginasRaw = ev.sessao?.paginas;
    const paginas =
      Number(
        (paginasRaw && typeof paginasRaw === 'object' ? paginasRaw.total : paginasRaw) ??
          ev.paginas ??
          0
      ) || 0;
    return {
      data: ev.dataEstudo || ev.data || '',
      titulo: ev.titulo || '',
      disciplina: discInfo?.disc?.nome || '',
      tempoSegundos: Number(ev.tempoAcumulado) || 0,
      questoesAcertos: acertos,
      questoesErros: erros,
      questoesTotal: total,
      paginas,
    };
  });
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportHistoricoCsv() {
  const rows = buildExportRows();
  if (rows.length === 0) return false;
  const header = Object.keys(rows[0]);
  const csv = [
    header.join(','),
    ...rows.map((r) =>
      header
        .map((k) => {
          const v = r[k];
          const s = v == null ? '' : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(',')
    ),
  ].join('\n');
  downloadFile(`historico-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
  return true;
}

export function exportHistoricoJson() {
  const rows = buildExportRows();
  if (rows.length === 0) return false;
  downloadFile(
    `historico-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(rows, null, 2),
    'application/json'
  );
  return true;
}
