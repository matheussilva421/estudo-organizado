/**
 * Editais CRUD Module
 * Main barrel — re-exports from sub-modules in editais/ directory.
 * Keeps toggle/dashboard functions and edital modal that don't fit
 * a specific sub-module domain.
 */

import { closeModal, showToast, openModal } from '../app.js?v=8.37';
import {
  esc,
  formatDate,
  formatTime,
  todayStr,
  uid,
} from '../utils.js?v=8.37';
import { scheduleSave, state } from '../store.js?v=8.37';
import { invalidatePendingRevCache } from '../logic.js?v=8.37';
import { getUiSection, setUiSection } from '../ui-state.js?v=8.37';
import { renderCurrentView } from '../components.js?v=8.37';
import {
  setActiveDashboardDiscCtx,
  clearActiveDashboardDiscCtx,
  getActiveDashboardDiscCtx,
  getActiveDashboardTab,
  setActiveDashboardTab,
  resetActiveDashboardTab,
} from '../state/dashboard-context.js?v=8.37';
import { initDiscDashboardChart, renderDisciplinaDashboard } from './dashboard-view.js';
import { COLORS, DISC_ICONS } from './editais/shared-state.js';

function captureDashboardScroll() {
  const tab = getActiveDashboardTab() || 'topicos';
  const panel = document.querySelector(`[data-dashboard-scroll="${tab}"]`);
  return panel ? { tab, top: panel.scrollTop } : null;
}

function restoreDashboardScroll(snapshot) {
  if (!snapshot) return;
  const panel = document.querySelector(`[data-dashboard-scroll="${snapshot.tab}"]`);
  if (panel) panel.scrollTop = snapshot.top;
}

// ── Shared State (re-exported for backward compat) ──
export {
  getEditingSubjectCtx,
  setEditingSubjectCtx,
  getEditingDiscCtx,
  setEditingDiscCtx,
} from './editais/shared-state.js';

// ── Re-exports from sub-modules ──
export { COLORS, DISC_ICONS } from './editais/shared-state.js';
export { deleteAssunto, deleteDisc, deleteEdital } from './editais/delete-operations.js';
export { openDiscModal, selectIcon, selectDiscColor, saveDisc, saveDiscManager, moveSubject } from './editais/disc-crud.js';
export { openDiscManager, switchManagerTab } from './editais/disc-manager.js';
export { editSubjectInline, editLessonInline } from './editais/inline-editing.js';
export { toggleAulaEstudada, addBulkAulas, addAssunto, deleteAula, runLessonMapperUI } from './editais/aula-operations.js';

// ── Toggle & Dashboard ──
export function toggleEdital(id) {
  const el = document.getElementById(`edital-tree-${id}`);
  if (!el) return;
  const willCollapse = el.style.display !== 'none';
  el.style.display = willCollapse ? 'none' : '';
  // Persist per-edital collapsed state via ui-state helper (keeps in-memory
  // cache and localStorage in sync).
  const collapsed = { ...(getUiSection('editais').collapsed || {}) };
  collapsed[id] = willCollapse;
  setUiSection('editais', { collapsed });
  // Toggle chevron rotation
  const header = document.querySelector(
    `[data-action="toggle-edital"][data-edital-id="${id}"]`
  );
  if (header) {
    header.classList.toggle('tree-edital-header--collapsed', willCollapse);
    header.setAttribute('aria-expanded', String(!willCollapse));
  }
}

export function toggleAssunto(discId, assId) {
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue;
    const disc = edital.disciplinas.find((d) => d.id === discId);
    if (disc) {
      const ass = (disc.assuntos || []).find((a) => a.id === assId);
      if (ass) {
        ass.concluido = !ass.concluido;
        ass.dataConclusao = ass.concluido ? todayStr() : null;
        if (ass.concluido) ass.revisoesFetas = [];
        invalidatePendingRevCache();
        scheduleSave();

        // Re-render local dashboard if open, otherwise full view
        const ctx = getActiveDashboardDiscCtx();
        if (ctx && ctx.discId === discId) {
          const scrollSnapshot = captureDashboardScroll();
          openDiscDashboard(ctx.editaId, discId);
          restoreDashboardScroll(scrollSnapshot);
        } else {
          renderCurrentView();
        }
        return;
      }
    }
  }
}

export function toggleAulaDashboard(editaId, discId, aulaId) {
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue;
    const disc = edital.disciplinas.find((d) => d.id === discId);
    if (!disc) continue;

    const aula = (disc.aulas || []).find((a) => a.id === aulaId);
    if (!aula) return;

    aula.estudada = !aula.estudada;
    aula.dataEstudo = aula.estudada ? todayStr() : null;
    scheduleSave();

    const ctx = getActiveDashboardDiscCtx();
    if (ctx && ctx.discId === discId) {
      const scrollSnapshot = captureDashboardScroll();
      openDiscDashboard(editaId, discId);
      restoreDashboardScroll(scrollSnapshot);
    } else {
      renderCurrentView();
    }

    showToast(aula.estudada ? 'Aula marcada como estudada.' : 'Aula desmarcada.', 'success');
    return;
  }
}

export function openDiscDashboard(editaId, discId) {
  const edital = state.editais.find((e) => e.id === editaId);
  if (!edital || !edital.disciplinas) return;
  const disc = edital.disciplinas.find((d) => d.id === discId);
  if (!disc) return;

  setActiveDashboardDiscCtx({ editaId, discId });

  // Set window Topbar
  const topbarTitle = document.getElementById('topbar-title');
  const actions = document.getElementById('topbar-actions');
  if (!topbarTitle || !actions) return;
  topbarTitle.textContent = `${disc.icone || '📚'} ${disc.nome} `;
  actions.innerHTML =
    '<button class="btn btn-ghost btn-sm" data-action="close-disc-dashboard"><i class="fa fa-arrow-left"></i> Voltar</button>';

  const el = document.getElementById('main-content');
  el.innerHTML = renderDisciplinaDashboard(edital, disc);
  setTimeout(() => initDiscDashboardChart(disc.id), 100);
}

export function closeDiscDashboard() {
  clearActiveDashboardDiscCtx();
  resetActiveDashboardTab();
  renderCurrentView();
}

export function switchDashboardTab(tabName) {
  setActiveDashboardTab(tabName);
  const ctx = getActiveDashboardDiscCtx();
  if (ctx && ctx.editaId && ctx.discId) {
    const edital = state.editais.find((e) => e.id === ctx.editaId);
    const disc = edital?.disciplinas?.find((d) => d.id === ctx.discId);
    if (disc) {
      openDiscDashboard(ctx.editaId, ctx.discId);
      return;
    }
  }

  renderCurrentView();
}

// ── Private Helpers (used by dashboard view) ──
function _renderHistoricoDisciplina(tempos) {
  const reverseTempos = [...tempos].reverse().slice(0, 50);
  if (reverseTempos.length === 0) {
    return '<div class="empty-state-centered">Nenhuma sessão de estudo registrada.</div>';
  }

  return `
    <div class="custom-scrollbar">
      <table class="session-history-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Tempo</th>
            <th>Pág.</th>
            <th>Questões</th>
            <th>Acerto</th>
          </tr>
        </thead>
        <tbody>
          ${reverseTempos
            .map((t) => {
              const dateStr = formatDate(t.data);
              const tempoStr = formatTime(t.tempoAcumulado || 0).substring(0, 5);
              const qs = t.sessao?.questoes || t.questoes || { certas: 0, erradas: 0 };
              const totQs = (qs.acertos || qs.certas || 0) + (qs.erros || qs.erradas || 0);
              const certas = qs.acertos || qs.certas || 0;
              const perc = totQs > 0 ? Math.round((certas / totQs) * 100) : 0;
              const _percColor =
                perc >= 70 ? 'var(--green)' : perc >= 50 ? 'var(--accent)' : 'var(--red)';
              const pags = t.sessao?.paginas?.total || t.paginas || null;

              return `
              <tr class="session-history-row" data-action="open-registro-sessao" data-event-id="${t.id}">
                <td>${dateStr}</td>
                <td class="session-history-time">${tempoStr}</td>
                <td>${pags ?? '-'}</td>
                <td>${certas} / ${totQs}</td>
                <td class="session-history-acerto ${totQs > 0 ? (perc >= 70 ? 'text-green' : perc >= 50 ? 'text-accent' : 'text-red') : ''}">${totQs > 0 ? perc + '%' : '-'}</td>
              </tr>
            `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
          `;
}

function _renderAulasDisciplinaDashboard(edital, disc) {
  if (!disc.aulas || disc.aulas.length === 0) {
    return `<div class="empty-state-column">
      <div class="empty-state-icon">🗂️</div>
      <div class="empty-state-title">Nenhuma aula ou material cadastrado.</div>
      <div class="empty-state-hint">Vá em "Gerenciar" nesta matéria para importar suas Aulas.</div>
    </div>`;
  }

  return `
    <div class="custom-scrollbar">
      ${disc.aulas
        .map((aul) => {
          const itemClass = aul.estudada ? 'aula-item aula-item-concluded' : 'aula-item';
          const titleClass = aul.estudada ? 'aula-title aula-title-concluded' : 'aula-title';

          return `
        <div class="${itemClass}">
          <div class="check-circle ${aul.estudada ? 'done' : ''}" data-action="toggle-aula-dashboard" data-edital-id="${edital.id}" data-disc-id="${disc.id}" data-aula-id="${aul.id}" title="${aul.estudada ? 'Desmarcar aula' : 'Marcar aula como estudada'}">${aul.estudada ? '<i class="fa fa-check"></i>' : ''}</div>
          <div class="${titleClass}">
             ${esc(aul.nome)}
             ${aul.linkedAssuntoIds && aul.linkedAssuntoIds.length > 0 ? `<div class="aula-linked-count">🔗 ${aul.linkedAssuntoIds.length} tópico(s) do edital conectado(s)</div>` : ''}
          </div>
          ${
            !aul.estudada
              ? `
            <button class="btn btn-ghost btn-sm" data-action="add-evento-para-assunto" data-edital-id="${edital.id}" data-disc-id="${disc.id}" data-assunto-id="aul_${aul.id}">+ Agenda</button>
          `
              : ''
          }
        </div>
      `;
        })
        .join('')}
    </div>
  `;
}

function _renderBancaDisciplinaDashboard(edital, disc) {
  const hasHotTopics =
    state.bancaRelevance &&
    state.bancaRelevance.hotTopics &&
    state.bancaRelevance.hotTopics.some((ht) => ht.disciplinaId === disc.id);
  const hasAulas = disc.aulas && disc.aulas.length > 0;

  if (!hasHotTopics) {
    return `
         <div class="banca-empty-state">
           <i class="fa fa-robot banca-empty-icon"></i>
           <div class="banca-empty-title">Nenhuma análise encontrada</div>
           <div class="banca-empty-hint">Use o Analisador de Banca no menu principal para injetar o sumário de exigência desta disciplina.</div>
         </div>
       `;
  }

  return `
       <div class="custom-scrollbar pt-2">
         <div class="banca-status-card">
            <div class="banca-status-label">STATUS DO MAPEADOR DE INTELIGÊNCIA</div>

            <div class="banca-status-row">
              <span>Dados de Banca extraídos:</span>
              <span class="banca-status-success">✅ ATIVO</span>
            </div>

            <div class="banca-status-row">
              <span>Aulas atreladas aos Tópicos P1 e P2:</span>
              <span class="${hasAulas ? 'banca-status-success' : 'banca-status-warning'}">${hasAulas ? '✅ CONECTADAS' : '⚠️ FALTA IMPORTAR'}</span>
            </div>
         </div>

         <div class="banca-info-text">
            A inteligência da prova injetou prioridades (P1 e P2) diretamente na sua janela de <strong>Tópicos do Edital</strong>. Veja as marcações em chamas 🔥 ao lado dos tópicos que demandam mais a sua atenção.
         </div>

         <button class="btn btn-outline banca-action-btn" data-action="navigate" data-view="banca-analyzer">
            Abrir Analisador Preditivo
         </button>
       </div>
   `;
}

// ── Edital Modal ──
export function openEditaModal(editaId = null) {
  const edital = editaId ? state.editais.find((e) => e.id === editaId) : null;
  document.getElementById('modal-edital-title').textContent = edital
    ? 'Editar Edital'
    : 'Novo Edital';
  document.getElementById('modal-edital-body').innerHTML = `
      <div class="form-group" >
      <label class="form-label">Nome do Edital</label>
      <input type="text" class="form-control" id="edital-nome" placeholder="Ex: Concurso TRF 2025" value="${edital ? esc(edital.nome) : ''}" autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">Cor</label>
      <div class="color-row" id="edital-colors">
        ${COLORS.map((c) => `<div class="color-swatch ${edital && edital.cor === c ? 'selected' : ''}" style="background:${c};" data-action="select-color" data-color="${c}" data-container="edital-colors" data-color-value="${c}" title="${c}" aria-label="Selecionar cor ${c}"></div>`).join('')}
      </div>
      <input type="hidden" id="edital-cor" value="${edital ? edital.cor : COLORS[0]}">
    </div>
    <div class="modal-footer-standard">
      <button class="btn btn-ghost" data-action="close-modal" data-modal="modal-edital">Cancelar</button>
      <button class="btn btn-primary" data-action="save-edital" data-edital-id="${editaId || ''}">Salvar Edital</button>
    </div>
    `;
  if (!edital) {
    document.querySelector('#edital-colors .color-swatch').classList.add('selected');
  }
  openModal('modal-edital');
}

export function selectColor(color, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('selected'));
  container.querySelector(`[data-color-value="${color}"]`)?.classList.add('selected');
  const input = document.getElementById(
    containerId === 'edital-colors'
      ? 'edital-cor'
      : containerId === 'disc-colors'
        ? 'disc-cor'
        : 'edital-cor'
  );
  if (input) input.value = color;
}

export function saveEdital(editaId) {
  const nomeEl = document.getElementById('edital-nome');
  if (!nomeEl) return;
  const nome = nomeEl.value.trim();
  if (!nome) {
    showToast('Informe o nome do edital', 'error');
    return;
  }
  const cor = document.getElementById('edital-cor')?.value || COLORS[0];

  if (editaId) {
    const edital = state.editais.find((e) => e.id === editaId);
    if (edital) {
      edital.nome = nome;
      edital.cor = cor;
    }
  } else {
    state.editais.push({
      id: uid(),
      nome,
      cor,
      disciplinas: [],
    });
  }
  scheduleSave();
  closeModal('modal-edital');
  renderCurrentView();
  showToast('Edital salvo!', 'success');
}

export function moveEdital(editaId, dir) {
  const currentIndex = state.editais.findIndex((edital) => edital.id === editaId);
  const targetIndex = currentIndex + Number(dir);
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= state.editais.length) return;

  const [edital] = state.editais.splice(currentIndex, 1);
  state.editais.splice(targetIndex, 0, edital);
  scheduleSave();
  renderCurrentView();
}
