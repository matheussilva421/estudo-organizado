/**
 * Reta Final View
 * Renderiza o plano tipo 'reta_final': lista de blocos agrupada por data
 * (badge "rolado de DD/MM"), resumo por disciplina até a dataFinal (substitui
 * a Previsão de Sessões) e seção "Não cobertos". Pós-dataFinal exibe banner
 * com "Restaurar planejamento anterior".
 */

import { esc, todayStr } from '../utils.js?v=8.37';
import { state } from '../store.js?v=8.37';
import { getDisc } from '../logic.js?v=8.37';
import {
  computeRetaFinalSummary,
  getRetaFinalBlocoFiltroCategoria,
  getRetaFinalTopicoLabel,
} from '../logic/reta-final-core.js';
import { syncRetaFinalToEventos } from '../logic/reta-final.js';

function formatBrDate(dateStr) {
  const [year, month, day] = String(dateStr || '').split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

function formatShortDate(dateStr) {
  const [, month, day] = String(dateStr || '').split('-');
  if (!month || !day) return '';
  return `${day}/${month}`;
}

function formatMinutes(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  return `${mins}min`;
}

// Filtros do cronograma dia a dia (estado de sessão — não persiste).
const filtrosCronograma = {
  concluidos: true,
  atrasados: true,
  proximos: true,
};

const FILTRO_POR_CATEGORIA = {
  concluido: 'concluidos',
  atrasado: 'atrasados',
  futuro: 'proximos',
};

/**
 * Alterna um filtro do cronograma ('concluidos' | 'atrasados' | 'proximos').
 * @returns {boolean} novo valor do filtro
 */
export function toggleRetaFinalFiltro(nome) {
  if (!(nome in filtrosCronograma)) return false;
  filtrosCronograma[nome] = !filtrosCronograma[nome];
  return filtrosCronograma[nome];
}

function blocoVisivel(bloco, hoje) {
  const filtro = FILTRO_POR_CATEGORIA[getRetaFinalBlocoFiltroCategoria(bloco, hoje)];
  return !filtro || filtrosCronograma[filtro];
}

function renderFiltrosHtml() {
  const botoes = [
    { nome: 'concluidos', icone: 'fa-check', label: 'Concluídos' },
    { nome: 'atrasados', icone: 'fa-forward', label: 'Atrasados' },
    { nome: 'proximos', icone: 'fa-calendar', label: 'Próximos dias' },
  ];
  return `
    <div class="rf-filtros" role="group" aria-label="Filtrar cronograma">
      ${botoes
        .map(({ nome, icone, label }) => {
          const ativo = filtrosCronograma[nome];
          return `<button type="button" class="rf-filtro-btn ${ativo ? 'rf-filtro-btn--ativo' : ''}" data-action="rf-toggle-filtro" data-filtro="${nome}" aria-pressed="${ativo}" title="${ativo ? 'Esconder' : 'Mostrar'}: ${label}"><i class="fa ${icone}"></i> ${label}</button>`;
        })
        .join('')}
    </div>
  `;
}

function renderBlocoCard(bloco, hoje) {
  const discEntry = getDisc(bloco.discId);
  const cor = discEntry ? discEntry.disc.cor || discEntry.edital.cor || '#8aa4bf' : '#7f8a99';
  const nome = discEntry ? discEntry.disc.nome : 'Disciplina';
  const topicos = getRetaFinalTopicoLabel(bloco, discEntry?.disc);
  const roladoBadge =
    bloco.dataOriginal && bloco.data !== bloco.dataOriginal
      ? `<span class="rf-rolado-badge" title="${(Number(bloco.rolagens) || 0)} rolagem(ns)"><i class="fa fa-forward"></i> rolado de ${formatShortDate(bloco.dataOriginal)}</span>`
      : '';
  let statusBadge = '';
  if (bloco.status === 'concluido') {
    statusBadge = '<span class="rf-status-badge rf-status-badge--concluido"><i class="fa fa-check"></i> concluído</span>';
  } else if (bloco.status === 'nao_coberto') {
    statusBadge = '<span class="rf-status-badge rf-status-badge--nao-coberto">não coberto</span>';
  }

  return `
    <div class="rf-bloco-card ${bloco.status === 'concluido' ? 'rf-bloco-card--concluido' : ''}" data-bloco-id="${esc(bloco.id)}">
      <div class="rf-bloco-color" style="background:${cor};"></div>
      <div class="rf-bloco-body">
        <div class="rf-bloco-title">${discEntry?.disc.icone || '📚'} ${esc(nome)}</div>
        ${topicos ? `<div class="rf-bloco-topicos">${esc(topicos)}</div>` : ''}
      </div>
      <div class="rf-bloco-meta">
        <span><i class="fa fa-clock"></i> ${formatMinutes(bloco.minutos)}</span>
        ${roladoBadge}
        ${statusBadge}
        ${
          bloco.status === 'pendente' && bloco.data === hoje
            ? '<span class="rf-status-badge">hoje</span>'
            : ''
        }
      </div>
      ${
        bloco.status === 'pendente'
          ? `
        <div class="rf-bloco-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-action="rf-quick-mark" data-bloco-id="${esc(bloco.id)}" title="Marcar como estudado" aria-label="Marcar como estudado"><i class="fa fa-check"></i></button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="rf-associar-historico" data-bloco-id="${esc(bloco.id)}" title="Associar sessão do histórico" aria-label="Associar sessão do histórico"><i class="fa fa-link"></i></button>
        </div>
      `
          : ''
      }
    </div>
  `;
}

function renderDiasHtml(blocos, hoje) {
  const porData = new Map();
  let totalCronograma = 0;
  for (const bloco of blocos) {
    if (bloco.status === 'nao_coberto') continue;
    totalCronograma++;
    if (!blocoVisivel(bloco, hoje)) continue;
    if (!porData.has(bloco.data)) porData.set(bloco.data, []);
    porData.get(bloco.data).push(bloco);
  }

  const datas = [...porData.keys()].sort();
  if (datas.length === 0) {
    return totalCronograma > 0
      ? '<div class="config-desc">Nenhum bloco visível com os filtros atuais.</div>'
      : '<div class="config-desc">Nenhum bloco no cronograma.</div>';
  }

  return datas
    .map((data) => {
      const isHoje = data === hoje;
      const label = isHoje ? `HOJE — ${formatBrDate(data)}` : formatBrDate(data);
      return `
        <div class="rf-day-group">
          <div class="rf-day-header ${isHoje ? 'rf-day-header--hoje' : ''}">${label}</div>
          ${porData
            .get(data)
            .map((bloco) => renderBlocoCard(bloco, hoje))
            .join('')}
        </div>
      `;
    })
    .join('');
}

function renderResumoHtml(summary) {
  const rows = Object.entries(summary.porDisciplina)
    .map(([discId, stats]) => {
      const discEntry = getDisc(discId);
      const nome = discEntry ? discEntry.disc.nome : 'Disciplina';
      const cor = discEntry ? discEntry.disc.cor || discEntry.edital.cor || '#8aa4bf' : '#7f8a99';
      return `
        <div class="rf-summary-row">
          <div class="rf-summary-disc">
            <span class="rf-summary-dot" style="background:${cor};"></span>
            <span class="text-ellipsis">${esc(nome)}</span>
          </div>
          <div class="rf-summary-meta">
            ${stats.blocosConcluidos}/${stats.blocos} blocos · ${formatMinutes(stats.minutosConcluidos)} de ${formatMinutes(stats.minutos)}
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <h4 class="ciclo-predict-title"><i class="fa fa-flag-checkered ciclo-predict-title-icon"></i> RESUMO ATÉ A DATA FINAL</h4>
    ${rows || '<div class="config-desc">Sem disciplinas no cronograma.</div>'}
    <div class="rf-summary-row">
      <div class="rf-summary-disc"><strong>Total restante</strong></div>
      <div class="rf-summary-meta"><strong>${formatMinutes(summary.minutosRestantes)}</strong></div>
    </div>
  `;
}

/**
 * Renderiza a view da Reta Final
 * @param {HTMLElement} el - Elemento container
 * @param {Object} plan - state.planejamento (tipo 'reta_final')
 */
export function renderRetaFinal(el, plan = state.planejamento) {
  // Rolagem/reconcile no render: cobre a virada de dia com o app aberto
  // (o init() cobre o boot).
  syncRetaFinalToEventos();

  const retaFinal = plan?.retaFinal || { blocos: [] };
  const blocos = retaFinal.blocos || [];
  const hoje = todayStr();
  const summary = computeRetaFinalSummary(retaFinal);
  const aposDataFinal = Boolean(retaFinal.dataFinal) && hoje > retaFinal.dataFinal;
  const temArquivado = Boolean(state.planejamentoArquivado?.plan);

  const bannerHtml = aposDataFinal
    ? `
      <div class="card rf-banner">
        <div>
          🏁 <strong>Reta Final encerrada em ${esc(formatBrDate(retaFinal.dataFinal))}.</strong>
          ${temArquivado ? 'Você pode restaurar o planejamento anterior.' : ''}
        </div>
        ${
          temArquivado
            ? '<button class="btn btn-primary btn-sm" data-action="restaurar-planejamento-arquivado"><i class="fa fa-undo"></i> Restaurar planejamento anterior</button>'
            : ''
        }
      </div>
    `
    : '';

  const naoCobertos = blocos.filter((b) => b.status === 'nao_coberto');
  const naoCobertosHtml =
    naoCobertos.length > 0
      ? `
        <div class="card ciclo-sequence-card">
          <div class="ciclo-sequence-header">
            <div class="ciclo-sequence-title">Não cobertos (${naoCobertos.length})</div>
          </div>
          ${naoCobertos.map((bloco) => renderBlocoCard(bloco, hoje)).join('')}
        </div>
      `
      : '';

  el.innerHTML = `
    <div class="ciclo-header-actions">
      <h2 class="ciclo-header-title">🏁 ${esc(retaFinal.nome || 'Reta Final')}</h2>
      <div class="ciclo-header-buttons">
        <button class="btn btn-primary btn-sm" data-action="open-reta-final-import"><i class="fa fa-file-import"></i> Importar Reta Final</button>
        <div class="ciclo-kebab-wrap">
          <button class="btn btn-ghost btn-sm ciclo-kebab-btn" data-action="ciclo-toggle-kebab" aria-haspopup="true" aria-expanded="false" title="Mais ações"><i class="fa fa-ellipsis-v"></i></button>
          <div class="ciclo-kebab-menu" role="menu" hidden>
            ${
              temArquivado
                ? '<button class="ciclo-kebab-item" role="menuitem" data-action="restaurar-planejamento-arquivado"><i class="fa fa-undo"></i> Restaurar planejamento anterior</button>'
                : ''
            }
            <button class="ciclo-kebab-item ciclo-kebab-item--danger" role="menuitem" data-action="remover-planejamento"><i class="fa fa-trash"></i> Remover planejamento</button>
          </div>
        </div>
      </div>
    </div>

    ${bannerHtml}

    <div class="grid-2 ciclo-layout">
      <div class="ciclo-content-col">
        <div class="card ciclo-sequence-card">
          <div class="ciclo-sequence-header">
            <div class="ciclo-sequence-title">Cronograma dia a dia — até ${esc(formatBrDate(retaFinal.dataFinal))}</div>
          </div>
          ${renderFiltrosHtml()}
          <div class="custom-scrollbar scroll-area-md" id="rf-dias-lista">
            ${renderDiasHtml(blocos, hoje)}
          </div>
        </div>
        ${naoCobertosHtml}
      </div>

      <div class="card ciclo-side-panel">
        <div class="ciclo-predict-box">
          ${renderResumoHtml(summary)}
        </div>
      </div>
    </div>
  `;
}
