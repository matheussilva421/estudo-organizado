/**
 * Discipline Manager (Subject Manager + Bulk Add)
 * Extracted from editais-crud.js — openDiscManager, switchManagerTab
 */

import { openModal } from '../../app.js?v=8.37';
import { esc } from '../../utils.js?v=8.37';
import { scheduleSave, state } from '../../store.js?v=8.37';
import {
  getActiveDiscManagerTab,
  setActiveDiscManagerTab,
} from '../state/disc-manager-state.js';
import { COLORS, getEditingSubjectCtx, setEditingSubjectCtx } from './shared-state.js';

export function captureDiscManagerScroll() {
  const tab = getActiveDiscManagerTab() || 'topicos';
  const panel = document.querySelector(`#tab-manager-${tab} .sm-list`);
  return panel ? { tab, top: panel.scrollTop } : null;
}

function restoreDiscManagerScroll(snapshot) {
  if (!snapshot) return;
  const panel = document.querySelector(`#tab-manager-${snapshot.tab} .sm-list`);
  if (panel) panel.scrollTop = snapshot.top;
}

export function openDiscManager(editaId, discId, options = {}) {
  let disc = null;
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue;
    const d = edital.disciplinas.find((x) => x.id === discId);
    if (d) {
      disc = d;
      break;
    }
  }
  if (!disc) return;

  setEditingSubjectCtx({ editaId, discId });
  // Default tab when opening
  if (!getActiveDiscManagerTab()) {
    setActiveDiscManagerTab('topicos');
  }

  // Render subject items
  const subjectsHtml =
    disc.assuntos
      .map(
        (ass, idx) =>
          `
      <div class="sm-list-item" draggable="true"
    data-disc-id="${disc.id}"
    data-ass-idx="${idx}"
    data-dnd-subject=""
    data-dnd-disc="${disc.id}"
    data-dnd-idx="${idx}">
      <div class="sm-drag-handle" title="Arrastar">☰</div>
      <div class="sm-item-text" data-action="edit-subject-inline" data-disc-id="${disc.id}" data-assunto-id="${ass.id}">
        ${esc(ass.nome)}
        ` +
          (ass.relevance
            ? `<span class="relevance-badge relevance-badge-${ass.relevance.priority === 'P1' ? 'p1' : ass.relevance.priority === 'P2' ? 'p2' : 'muted'}" title="${esc(ass.relevance.reason)}">${ass.relevance.priority}</span>`
            : '') +
          `
        ${
          ass.linkedAulaIds && ass.linkedAulaIds.length > 0
            ? `
           <div class="linked-aulas-list">
             ${ass.linkedAulaIds
               .map((auId) => {
                 const aulaObj = (disc.aulas || []).find((a) => a.id === auId);
                 return aulaObj
                   ? `<span class="linked-aula-tag"><i class="fa fa-play-circle"></i> ${esc(aulaObj.nome)}</span>`
                   : '';
               })
               .join('')}
           </div>
        `
            : ''
        }
      </div>
      <div class="sm-item-actions">
        <button aria-label="Subir tópico" data-action="move-subject" data-disc-id="${disc.id}" data-idx="${idx}" data-dir="-1" title="Subir"><i class="fa fa-chevron-up"></i></button>
        <button aria-label="Descer tópico" data-action="move-subject" data-disc-id="${disc.id}" data-idx="${idx}" data-dir="1" title="Descer"><i class="fa fa-chevron-down"></i></button>
        <button aria-label="Excluir tópico" data-action="delete-assunto" data-disc-id="${disc.id}" data-assunto-id="${ass.id}" title="Excluir"><i class="fa fa-trash"></i></button>
      </div>
    </div>
      `
      )
      .join('') || '<div class="sm-empty-state">Nenhum tópico no Edital.</div>';

  // Render Lesson items
  const aulasHtml =
    (disc.aulas || [])
      .map(
        (aula, _idx) => `
      <div class="sm-list-item sm-list-item--lesson">
      <div class="sm-item-content">
          <div class="sm-item-text sm-item-text--clickable" data-action="edit-lesson-inline" data-disc-id="${disc.id}" data-aula-id="${aula.id}">
             <input type="checkbox" ${aula.estudada ? 'checked' : ''} data-action="toggle-aula-estudada" data-disc-id="${disc.id}" data-aula-id="${aula.id}" class="sm-checkbox" title="Marcar como Estudada">
             <span class="${aula.estudada ? 'sm-text-concluded' : ''}">${esc(aula.nome)}</span>
          </div>
          ${
            aula.linkedAssuntoIds && aula.linkedAssuntoIds.length > 0
              ? `
           <div class="sm-linked-info">
             <strong>Cobre: </strong> ${aula.linkedAssuntoIds
               .map((asId) => {
                 const assObj = disc.assuntos.find((a) => a.id === asId);
                 return assObj ? esc(assObj.nome) : '';
               })
               .filter((n) => n)
               .join(', ')}
           </div>
        `
              : '<div class="sm-linked-info sm-linked-info--empty">Não conectada a assunto do edital.</div>'
          }
      </div>
      <div class="sm-item-actions">
         <button aria-label="Excluir aula" data-action="delete-aula" data-disc-id="${disc.id}" data-aula-id="${aula.id}" title="Excluir"><i class="fa fa-trash"></i></button>
      </div>
    </div>
      `
      )
      .join('') || '<div class="sm-empty-state">Nenhuma Aula adicionada.</div>';

  const colorOptions = COLORS.map(
    (c) =>
      `<option value="${c}" ${disc.cor === c ? 'selected' : ''}" data-color-option="${c}">${c}</option>`
  ).join('');

  document.getElementById('modal-disc-manager-title').textContent =
    disc.nome || 'Gerenciar Disciplina';
  document.getElementById('modal-disc-manager-body').innerHTML = `
      <!--Configurações Globais da Disciplina-->
    <div class="sm-header">
      <div class="sm-form-group">
        <label>Nome</label>
        <input type="text" id="dm-nome" value="${esc(disc.nome)}">
      </div>
      <div class="sm-form-group sm-form-group--narrow">
        <label>Cor</label>
        <div class="sm-color-picker-group">
          <input type="color" id="dm-cor-picker" value="${disc.cor || COLORS[0]}">
          <select id="dm-cor" class="form-control" data-action="sync-color-to-picker">
            ${colorOptions}
          </select>
        </div>
      </div>
    </div>

    <!--TABS de Navegação Wave 39 -->
    <div class="manager-tabs" role="tablist" aria-label="Gerenciamento de disciplina">
        <button type="button" data-action="switch-manager-tab" data-tab="topicos" class="manager-tab ${getActiveDiscManagerTab() === 'topicos' ? 'manager-tab--active' : ''}" role="tab" aria-selected="${getActiveDiscManagerTab() === 'topicos'}" aria-controls="tab-manager-topicos">
            Tópicos do Edital (${disc.assuntos.length})
        </button>
        <button type="button" data-action="switch-manager-tab" data-tab="aulas" class="manager-tab ${getActiveDiscManagerTab() === 'aulas' ? 'manager-tab--active' : ''}" role="tab" aria-selected="${getActiveDiscManagerTab() === 'aulas'}" aria-controls="tab-manager-aulas">
            Meus Materiais/Aulas (${disc.aulas ? disc.aulas.length : 0})
        </button>
    </div>

    <!--ABA TÓPICOS-->
    <div id="tab-manager-topicos" class="${getActiveDiscManagerTab() === 'topicos' ? 'tab-content active' : 'tab-content--hidden'}">
        <div class="sm-add-form">
           <textarea class="form-control" id="new-assunto-nome" placeholder="Novo tópico (Digite ou cole vários separados por quebra de linha)" rows="1"></textarea>
           <button class="btn btn-primary" data-action="add-assunto" data-disc-id="${disc.id}">Adicionar Tópico</button>
        </div>
        <div class="sm-list custom-scrollbar">
           ${subjectsHtml}
        </div>
    </div>

    <!--ABA AULAS-->
    <div id="tab-manager-aulas" class="${getActiveDiscManagerTab() === 'aulas' ? 'tab-content active' : 'tab-content--hidden'}">
        <div class="sm-bulk-import-form">
           <div>
               <label>Adição em Lote (Copie e paste o índice do seu PDF/Cursinho aqui)</label>
      <textarea class="form-control form-control--resize sm-bulk-textarea" id="new-aula-bulk" placeholder="Aula 00 - Concordância Nominal\nAula 01 - Crase..."></textarea>
           </div>
           <button class="btn btn-primary" data-action="add-bulk-aulas" data-disc-id="${disc.id}">Importar Lote</button>
        </div>

        ${
          disc.aulas && disc.aulas.length > 0 && disc.assuntos.length > 0
            ? `
          <div class="sm-auto-link-card">
             <div class="sm-auto-link-card-text">O Sistema pode analisar os nomes e conectá-los automaticamente ao Edital.</div>
             <button class="btn btn-ghost btn-sm" data-action="run-lesson-mapper" data-edital-id="${editaId}" data-disc-id="${disc.id}"><i class="fa fa-magic"></i> Auto-Link ML</button>
          </div>
        `
            : ''
        }

        <div class="sm-list custom-scrollbar">
          ${aulasHtml}
        </div>
    </div>

    <!--BOTOES INFERIORES-->
      <div class="sm-footer-actions">
        <button class="btn btn-ghost btn-text-danger" data-action="delete-disc" data-edital-id="${editaId}" data-disc-id="${discId}">Remover Disciplina</button>
        <button class="btn btn-primary" data-action="save-disc-manager" data-edital-id="${editaId}" data-disc-id="${discId}">Salvar alterações</button>
      </div>
    `;
  restoreDiscManagerScroll(options.scrollSnapshot);
  openModal('modal-disc-manager');
}

export function switchManagerTab(tabName) {
  setActiveDiscManagerTab(tabName);
  const ctx = getEditingSubjectCtx();
  if (ctx) {
    openDiscManager(ctx.editaId, ctx.discId);
  }
}
