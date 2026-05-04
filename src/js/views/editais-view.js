/**
 * Editais/Vertical View Module
 * Renderiza view de editais (renderEditais, renderEditalTree) e vertical (renderVertical, renderVerticalList)
 */

import { state } from '../store.js?v=8.37';
import { esc } from '../utils.js?v=8.37';

// ── Vertical View State ──
let vertSearch = '';
let vertFilterStatus = 'todos';
let vertFilterEdital = '';
let discFilterStatus = 'ativas';

export function getVertSearch() {
  return vertSearch;
}
export function setVertSearch(val) {
  vertSearch = val;
}
export function getVertFilterStatus() {
  return vertFilterStatus;
}
export function setVertFilterStatus(val) {
  vertFilterStatus = val;
}
export function getVertFilterEdital() {
  return vertFilterEdital;
}
export function setVertFilterEdital(val) {
  vertFilterEdital = val;
}
export function getDiscFilterStatus() {
  return discFilterStatus;
}
export function setDiscFilterStatus(val) {
  discFilterStatus = val;
}

// ── Helper: Get Filtered Vertical Items ──
export function getFilteredVertItems() {
  const items = [];
  for (const edital of state.editais || []) {
    if (vertFilterEdital && edital.id !== vertFilterEdital) continue;
    for (const disc of edital.disciplinas || []) {
      if (disc.arquivada) continue;
      for (const ass of disc.assuntos || []) {
        if (vertFilterStatus === 'pendentes' && ass.concluido) continue;
        if (vertFilterStatus === 'concluidos' && !ass.concluido) continue;
        if (vertSearch) {
          const search = vertSearch.toLowerCase();
          if (!disc.nome.toLowerCase().includes(search) && !ass.nome.toLowerCase().includes(search))
            continue;
        }
        items.push({ ass, disc, edital });
      }
    }
  }
  return items;
}

// ── Vertical View: Main Render ──
export function renderVertical(el) {
  el.innerHTML = `
    <!-- Filters row — full re-render only when filter chips change -->
    <div class="vertical-toolbar flex gap-sm mb-4 items-center" style="flex-wrap:wrap;">
      <div class="vertical-toolbar-search relative" style="flex:1; min-width:180px;">
        <i class="fa fa-search text-muted text-base absolute" style="left:10px; top:50%; transform:translateY(-50%);"></i>
        <input class="form-control" style="padding-left:32px;" id="vert-search" value="${esc(vertSearch)}"
          placeholder="Buscar assunto ou disciplina..."
          data-action="vert-search">
      </div>
      <select class="form-control vertical-toolbar-select" style="width:auto;" data-action="set-vert-filter-edital">
        <option value="">Todos os editais</option>
        ${state.editais.map((e) => `<option value="${e.id}" ${vertFilterEdital === e.id ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}
      </select>
      <div class="filter-row vertical-toolbar-filters gap-xs" style="margin:0;" role="group" aria-label="Filtro de status">
        ${['todos', 'pendentes', 'concluidos']
          .map(
            (s) => `
          <button type="button" class="filter-chip ${vertFilterStatus === s ? 'active' : ''}" data-action="set-vert-filter-status" data-status="${s}" aria-pressed="${vertFilterStatus === s}">
            ${{ todos: 'Todos', pendentes: 'Pendentes', concluidos: 'Concluídos' }[s]}
          </button>`
          )
          .join('')}
      </div>
    </div>

    <!-- isolated list container — only this gets re-rendered on search -->
    <div id="vert-list-container" class="w-full" style="display:block;"></div>
  `;
  renderVerticalList(document.getElementById('vert-list-container'));
}

// ── Vertical View: List Render ──
export function renderVerticalList(container) {
  if (!container) return;
  const allItems = getFilteredVertItems();
  const total = allItems.length;
  const concluidos = allItems.filter((i) => i.ass.concluido).length;
  const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  if (total === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📋</div>
      <h4>${state.editais.length === 0 ? 'Nenhum edital cadastrado' : 'Nenhum assunto encontrado'}</h4>
      <p>${state.editais.length === 0 ? 'Crie um edital em Editais para usar esta visualização.' : 'Tente ajustar os filtros.'}</p>
    </div>`;
    return;
  }

  // Card Progresso Global
  let html = `
    <div class="card vertical-progress-card mb-6" style="padding:20px; border:none; height:auto; min-height:0;">
      <div class="flex justify-between mb-3" style="align-items:flex-end;">
        <div>
          <div class="text-base font-bold text-primary mb-2" style="letter-spacing:1px;">PROGRESSO NO EDITAL</div>
          <div class="text-base font-semibold text-muted">${concluidos} de ${total} tópicos concluídos</div>
        </div>
        <div class="text-2xl font-extrabold text-primary leading-none">${pct}<span class="text-xl" style="opacity:0.7;">%</span></div>
      </div>
      <div class="progress-track w-full" style="height:14px; border-radius:10px; overflow:hidden; padding:2px;">
        <div class="progress-bar" style="width:${pct}%; transition:width 0.3s; border-radius:10px;"></div>
      </div>
    </div>
  `;

  // Agrupar itens por disciplina
  const discMap = {};
  allItems.forEach((item) => {
    const did = item.disc.id;
    if (!discMap[did]) {
      discMap[did] = { disc: item.disc, edital: item.edital, items: [] };
    }
    discMap[did].items.push(item);
  });

  // Agrupar logs de questoes do 'state.eventos'
  const eventosAgrupados = {};
  if (state.eventos) {
    state.eventos.forEach((ev) => {
      if (ev.status === 'estudei' && ev.discId) {
        if (!eventosAgrupados[ev.discId])
          eventosAgrupados[ev.discId] = { sCertas: 0, sErradas: 0, assuntos: {} };
        const evtQs = ev.sessao?.questoes || ev.questoes || { certas: 0, erradas: 0 };
        eventosAgrupados[ev.discId].sCertas += evtQs.acertos || evtQs.certas || 0;
        eventosAgrupados[ev.discId].sErradas += evtQs.erros || evtQs.erradas || 0;
        if (ev.assId) {
          if (!eventosAgrupados[ev.discId].assuntos[ev.assId]) {
            eventosAgrupados[ev.discId].assuntos[ev.assId] = { certas: 0, erradas: 0 };
          }
          eventosAgrupados[ev.discId].assuntos[ev.assId].certas +=
            evtQs.acertos || evtQs.certas || 0;
          eventosAgrupados[ev.discId].assuntos[ev.assId].erradas +=
            evtQs.erros || evtQs.erradas || 0;
        }
      }
    });
  }

  const hiReg = vertSearch
    ? new RegExp(`(${vertSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    : null;
  const highlight = (str) => (hiReg ? esc(str).replace(hiReg, '<mark>$1</mark>') : esc(str));

  Object.values(discMap).forEach((dMap) => {
    const discId = dMap.disc.id;
    const evStats = eventosAgrupados[discId] || { sCertas: 0, sErradas: 0, assuntos: {} };
    const dCertas = evStats.sCertas;
    const dErradas = evStats.sErradas;
    const dTotalQ = dCertas + dErradas;
    const dPctQ = dTotalQ > 0 ? Math.round((dCertas / dTotalQ) * 100) : 0;

    const dTotalItems = dMap.items.length;
    const dConcluidos = dMap.items.filter((i) => i.ass.concluido).length;
    const dPctConcluido = dTotalItems > 0 ? Math.round((dConcluidos / dTotalItems) * 100) : 0;

    const cor = dMap.disc.cor || dMap.edital.cor || 'var(--accent)';

    html += `
      <div class="card vertical-disc-card mb-3" style="overflow:hidden; border:none; height:auto; min-height:0;">

        <!-- HEADER DISCIPLINA -->
        <div class="vertical-disc-header flex-between" style="padding:12px 16px; background:var(--card); cursor:pointer;" data-action="toggle-vert-disc" data-disc-id="${discId}">
          <div class="vertical-disc-header-main flex font-semibold text-primary items-center gap-md" style="font-size:15px; min-width:0;">
            <div style="width:5px;height:24px;background:${cor};border-radius:4px;"></div>
            <span class="text-ellipsis" title="${esc(dMap.disc.nome)}">${esc(dMap.disc.nome)}</span>
          </div>

          <div class="vertical-disc-header-meta flex items-center gap-lg">
            <!-- Stats Questões -->
            <div class="vertical-disc-score flex text-sm font-bold text-mono items-center rounded-xl gap-md" style="border:1px solid var(--border); padding:2px 10px; background:transparent;">
              <span class="text-green">${dCertas}</span>
              <span class="text-red">${dErradas}</span>
              <span class="text-secondary">${dTotalQ}</span>
              <span style="color:var(--bg);background:${dPctQ >= 70 ? 'var(--green)' : dPctQ >= 50 ? 'var(--orange)' : 'var(--text-muted)'};padding:2px 6px;border-radius:8px;">${dPctQ}</span>
            </div>

            <!-- Progress Bar Progresso -->
            <div class="vertical-disc-progress flex items-center gap-sm rounded-xl" style="background:var(--bg); padding:4px; width:120px;">
              <span class="text-xs font-extrabold text-primary" style="min-width:24px; text-align:right;">${dPctConcluido}%</span>
              <div class="flex-1" style="height:6px; background:var(--border); border-radius:3px; overflow:hidden;">
                <div style="height:100%;width:${dPctConcluido}%;background:${cor};border-radius:3px;"></div>
              </div>
            </div>

            <!-- Ações -->
            <div class="vertical-disc-actions flex text-muted items-center gap-sm">
              <button class="btn btn-ghost btn-sm text-xs" style="padding:2px 8px; height:auto;" data-action="add-novo-topico-vertical" data-edital-id="${dMap.edital.id}" data-disc-id="${discId}" title="Adicionar Tópico Manualmente">
                <i class="fa fa-plus"></i> Assunto
              </button>
              <i class="fa fa-edit" data-action="open-disc-manager" data-edital-id="${dMap.edital.id}" data-disc-id="${discId}" title="Gerenciar Disciplina e Tópicos" style="cursor:pointer;margin-left:8px;"></i>
              <i id="vert-disc-icon-${discId}" class="fa fa-chevron-down text-center" style="width:16px;"></i>
            </div>
          </div>
        </div>

        <!-- LISTA DE TÓPICOS ANINHADA -->
        <div id="vert-disc-body-${discId}" class="border-t" style="display:none; padding:16px;">
          <div style="overflow-x:auto;">
            <table class="w-full text-base text-center" style="border-collapse:collapse;">
              <thead>
                <tr class="text-primary font-semibold border-b">
                  <th style="padding:10px;text-align:left;">Tópicos</th>
                  <th class="text-green" style="padding:10px;"><i class="fa fa-check"></i></th>
                  <th class="text-red" style="padding:10px;"><i class="fa fa-times"></i></th>
                  <th class="text-muted" style="padding:10px;"><i class="fa fa-bullseye" title="Total de questões"></i></th>
                  <th style="padding:10px;">%</th>
                  <th style="padding:10px;"><i class="fa fa-calendar-alt"></i></th>
                </tr>
              </thead>
              <tbody>
    `;

    dMap.items.forEach(({ ass, edital: _edital, disc: _disc }) => {
      const aStats =
        evStats.assuntos && evStats.assuntos[ass.id]
          ? evStats.assuntos[ass.id]
          : { certas: 0, erradas: 0 };
      const aCertas = aStats.certas;
      const aErradas = aStats.erradas;
      const aTotalQ = aCertas + aErradas;
      const aPctQ = aTotalQ > 0 ? Math.round((aCertas / aTotalQ) * 100) : 0;

      const _revCount = (ass.revisoesFetas || []).length;
      let dataStr = '-';
      if (ass.dataConclusao) {
        const d = ass.dataConclusao.split('-');
        if (d.length === 3) dataStr = `${d[2]}/${d[1]}/${d[0].substring(2)}`;
      }

      const chColor = ass.concluido ? 'var(--text-muted)' : 'var(--text-primary)';
      const decor = ass.concluido
        ? 'text-decoration:line-through;opacity:0.6;'
        : 'font-weight:600;';

      html += `
                <tr style="border-bottom:1px solid var(--bg);">
                  <td class="flex items-center gap-md" style="padding:12px 10px; text-align:left;">
                    <input type="checkbox" style="cursor:pointer;width:16px;height:16px;accent-color:var(--accent);" ${ass.concluido ? 'checked' : ''} data-action="toggle-assunto" data-disc-id="${discId}" data-assunto-id="${ass.id}" />
                    <span style="color:${chColor};${decor}">${highlight(ass.nome).toUpperCase()}</span>
                  </td>
                  <td class="td-mono font-bold text-green">${aCertas}</td>
                  <td class="td-mono font-bold text-red">${aErradas}</td>
                  <td class="td-mono font-bold text-secondary">${aTotalQ}</td>
                  <td class="td-mono">
                    <div class="font-bold text-sm rounded-sm" style="display:inline-block; padding:2px 6px; background:${aTotalQ > 0 ? (aPctQ >= 70 ? 'var(--green)' : aPctQ >= 50 ? 'var(--orange)' : 'var(--text-muted)') : 'transparent'}; color:${aTotalQ > 0 ? 'var(--bg)' : 'var(--text-muted)'}; border:${aTotalQ > 0 ? 'none' : '1px solid var(--border)'};">${aTotalQ > 0 ? aPctQ : 0}</div>
                  </td>
                  <td class="text-muted text-base" style="padding:12px 10px;">${dataStr}</td>
                </tr>
      `;
    });

    html += `
              </tbody>
            </table>
          </div>
        </div>
      </div>
          `;
  });

  container.innerHTML = html;
}

// ── Toggle Disciplina Expand/Collapse ──
export function toggleVertDisc(id) {
  const body = document.getElementById('vert-disc-body-' + id);
  const icon = document.getElementById('vert-disc-icon-' + id);
  if (!body || !icon) return;
  if (body.style.display === 'none') {
    body.style.display = 'block';
    icon.classList.remove('fa-chevron-down');
    icon.classList.add('fa-chevron-up');
  } else {
    body.style.display = 'none';
    icon.classList.remove('fa-chevron-up');
    icon.classList.add('fa-chevron-down');
  }
}

// ── Editais View: Main Render ──
export function renderEditais(el) {
  el.innerHTML = `
    ${
      state.editais.length === 0
        ? `
      <div class="empty-state" style="padding:80px 20px;">
        <div class="icon">📋</div>
        <h4>Nenhum edital cadastrado</h4>
        <p class="mb-4">Crie seu edital com disciplinas e assuntos para organizar seus estudos.</p>
        <button class="btn btn-primary" data-action="open-edital-modal"><i class="fa fa-plus"></i> Criar Edital</button>
      </div>
    `
        : `
      <div class="edital-tree">
        ${state.editais.map((edital) => renderEditalTree(edital)).join('')}
      </div>
    `
    }
        `;
}

// ── Editais View: Tree Render ──
export function renderEditalTree(edital) {
  const editalIndex = state.editais.findIndex((item) => item.id === edital.id);
  const isFirstEdital = editalIndex <= 0;
  const isLastEdital = editalIndex === -1 || editalIndex >= state.editais.length - 1;
  const ativas = (edital.disciplinas || []).filter((d) => !d.arquivada);
  const arquivadas = (edital.disciplinas || []).filter((d) => d.arquivada);
  const discCountText =
    arquivadas.length > 0
      ? `${ativas.length} ativas · ${arquivadas.length} arq.`
      : `${ativas.length} disc.`;

  const filteredDisciplinas = (edital.disciplinas || []).filter((d) => {
    if (discFilterStatus === 'ativas') return !d.arquivada;
    if (discFilterStatus === 'arquivadas') return d.arquivada;
    return true;
  });

  return `
    <div class="tree-edital" id="edital-${edital.id}">
      <div class="tree-edital-header" data-action="toggle-edital" data-edital-id="${edital.id}">
        <span class="flex-shrink-0" style="width:10px; height:10px; border-radius:50%; background:${edital.cor || '#8aa4bf'}; display:inline-block;"></span>
        <span class="flex-1 text-lg font-bold">${esc(edital.nome)}</span>
        <span class="text-sm" style="opacity:0.7;">${discCountText}</span>
        <button type="button" class="icon-btn" title="Mover edital para cima" data-action="move-edital" data-edital-id="${edital.id}" data-dir="-1" ${isFirstEdital ? 'disabled' : ''}><i class="fa fa-chevron-up"></i></button>
        <button type="button" class="icon-btn" title="Mover edital para baixo" data-action="move-edital" data-edital-id="${edital.id}" data-dir="1" ${isLastEdital ? 'disabled' : ''}><i class="fa fa-chevron-down"></i></button>
        <button class="icon-btn" title="Adicionar Tópicos" data-action="navigate-with-ctx" data-view="vertical" data-ctx="${encodeURIComponent(JSON.stringify({ editaId: edital.id }))}">📝</button>
        <button class="icon-btn" title="Analisador de Bancas" data-action="navigate-with-ctx" data-view="banca-analyzer" data-ctx="${encodeURIComponent(JSON.stringify({ editaId: edital.id }))}">🧠</button>
        <button class="icon-btn" title="Editar" data-action="open-edital-modal" data-edital-id="${edital.id}">✏️</button>
        <button class="icon-btn" title="Excluir" data-action="delete-edital" data-edital-id="${edital.id}">🗑️</button>
        <i class="fa fa-chevron-down text-base" style="opacity:0.7;"></i>
      </div>
      <div class="flex border-b justify-end" style="padding:10px 16px;">
        <button class="btn btn-ghost btn-sm" data-action="open-disc-modal" data-edital-id="${edital.id}" style="margin-right:15px;margin-bottom:10px;">+ Disciplina</button>
      </div>
      <div class="disc-filter-row flex gap-xs" style="padding:8px 16px; border-bottom:1px solid var(--border);" role="group" aria-label="Filtro de disciplinas">
        <button type="button" class="filter-chip ${discFilterStatus === 'ativas' ? 'active' : ''}" data-action="set-disc-filter" data-filter="ativas">Ativas</button>
        <button type="button" class="filter-chip ${discFilterStatus === 'arquivadas' ? 'active' : ''}" data-action="set-disc-filter" data-filter="arquivadas">Arquivadas</button>
        <button type="button" class="filter-chip ${discFilterStatus === 'todas' ? 'active' : ''}" data-action="set-disc-filter" data-filter="todas">Todas</button>
      </div>
      <div id="edital-tree-${edital.id}">
        <div class="disc-grid">
          ${filteredDisciplinas
            .map((disc) => {
              const isArchived = disc.arquivada === true;
              const archivedClass = isArchived ? 'disc-card-archived' : '';
              const archivedBadge = isArchived
                ? '<div class="disc-archived-badge">Arquivada</div>'
                : '';

              const totaisTopicos = disc.assuntos ? disc.assuntos.length : 0;
              const topicosEstudados = disc.assuntos
                ? disc.assuntos.filter((a) => a.concluido).length
                : 0;
              const totaisAulas = disc.aulas ? disc.aulas.length : 0;
              const aulasEstudadas = disc.aulas ? disc.aulas.filter((a) => a.estudada).length : 0;

              let qResolvidas = 0;
              if (state.eventos) {
                const evts = state.eventos.filter(
                  (e) => e.discId === disc.id && e.status === 'estudei'
                );
                evts.forEach((e) => {
                  const qs = e.sessao?.questoes || e.questoes;
                  if (qs)
                    qResolvidas += (qs.acertos || qs.certas || 0) + (qs.erros || qs.erradas || 0);
                });
              }

              return `
              <div class="disc-card ${archivedClass}" style="--card-color: ${disc.cor || 'var(--accent)'};" data-action="open-disc-dashboard" data-edital-id="${edital.id}" data-disc-id="${disc.id}">
                ${archivedBadge}
                <div class="disc-card-title">${disc.icone || '📚'} ${esc(disc.nome)}</div>
                <div class="disc-stats">
                  <div class="disc-stat">
                    <span class="disc-stat-val">${topicosEstudados}/${totaisTopicos}</span>
                    <span class="disc-stat-label">Tópicos<br>do Edital</span>
                  </div>
                  <div class="disc-stat">
                    <span class="disc-stat-val">${aulasEstudadas}/${totaisAulas}</span>
                    <span class="disc-stat-label">Aulas<br>Estudadas</span>
                  </div>
                  <div class="disc-stat">
                    <span class="disc-stat-val">${qResolvidas}</span>
                    <span class="disc-stat-label">Questões<br>Resolvidas</span>
                  </div>
                </div>
                <div class="disc-overlay">
                  <button class="disc-action" data-action="open-disc-dashboard" data-edital-id="${edital.id}" data-disc-id="${disc.id}">
                    <i class="fa fa-folder-open"></i>
                    <span>Visualizar</span>
                  </button>
                  <button class="disc-action" data-action="open-disc-manager" data-edital-id="${edital.id}" data-disc-id="${disc.id}">
                    <i class="fa fa-edit"></i>
                    <span>Editar</span>
                  </button>
                  ${
                    isArchived
                      ? `
                  <button class="disc-action" data-action="unarchive-disc" data-edital-id="${edital.id}" data-disc-id="${disc.id}">
                    <i class="fa fa-archive"></i>
                    <span>Desarquivar</span>
                  </button>
                  `
                      : `
                  <button class="disc-action" data-action="archive-disc" data-edital-id="${edital.id}" data-disc-id="${disc.id}">
                    <i class="fa fa-archive"></i>
                    <span>Arquivar</span>
                  </button>
                  <button class="disc-action" data-action="delete-disc" data-edital-id="${edital.id}" data-disc-id="${disc.id}">
                    <i class="fa fa-trash"></i>
                    <span>Remover</span>
                  </button>
                  `
                  }
                </div>
              </div>
            `;
            })
            .join('')}
          ${filteredDisciplinas.length === 0 ? `<div class="text-muted" style="font-style:italic; grid-column:1/-1; padding:16px;">${discFilterStatus === 'arquivadas' ? 'Nenhuma disciplina arquivada' : discFilterStatus === 'ativas' ? 'Nenhuma disciplina ativa' : 'Nenhuma disciplina'}</div>` : ''}
        </div>
      </div>
    </div>
          `;
}
