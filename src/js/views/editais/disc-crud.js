/**
 * Discipline CRUD Operations
 * Extracted from editais-crud.js — openDiscModal, selectIcon, selectDiscColor,
 * saveDisc, saveDiscManager, moveSubject
 */

import { closeModal, showToast, openModal } from '../../app.js?v=8.37';
import { esc, uid } from '../../utils.js?v=8.37';
import { scheduleSave, state } from '../../store.js?v=8.37';
import { renderCurrentView } from '../../components.js?v=8.37';
import { COLORS, DISC_ICONS, getEditingDiscCtx, setEditingDiscCtx, getEditingSubjectCtx } from './shared-state.js';
import { openDiscManager } from './disc-manager.js';

// ── Discipline Modal ──
export function openDiscModal(editaId, discId) {
  setEditingDiscCtx({ editaId, discId: discId || null });
  const edital = state.editais.find((e) => e.id === editaId);
  const existingDisc = discId && edital ? edital.disciplinas.find((d) => d.id === discId) : null;
  const isEdit = !!existingDisc;

  document.getElementById('modal-disc-title').textContent = isEdit
    ? 'Editar Disciplina'
    : 'Nova Disciplina';
  document.getElementById('modal-disc-body').innerHTML = `
      <div class="form-group" >
      <label class="form-label">Nome da Disciplina</label>
      <input type="text" class="form-control" id="disc-nome" placeholder="Ex: Direito Constitucional" value="${isEdit ? esc(existingDisc.nome) : ''}" autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">Ícone</label>
      <div class="icon-grid" id="disc-icons">
        ${DISC_ICONS.map((ic, _i) => `<div class="icon-grid-item ${ic === (isEdit ? existingDisc.icone : DISC_ICONS[0]) ? 'selected-icon' : ''}" data-action="select-icon" data-icon="${ic}" role="button" tabindex="0" aria-pressed="${ic === (isEdit ? existingDisc.icone : DISC_ICONS[0])}" aria-label="Selecionar ícone ${ic}">${ic}</div>`).join('')}
      </div>
      <input type="hidden" id="disc-icone" value="${isEdit ? existingDisc.icone : DISC_ICONS[0]}">
    </div>
    <div class="form-group">
      <label class="form-label">Cor</label>
      <div class="color-row" id="disc-colors">
        ${COLORS.map((c, _i) => `<div class="color-swatch ${c === (isEdit ? existingDisc.cor : COLORS[0]) ? 'selected' : ''}" style="background:${c};" data-disc-color="${c}" data-action="select-disc-color" data-color="${c}" role="button" tabindex="0" aria-pressed="${c === (isEdit ? existingDisc.cor : COLORS[0])}" title="${c}" aria-label="Selecionar cor ${c}"></div>`).join('')}
      </div>
      <input type="hidden" id="disc-cor" value="${isEdit ? existingDisc.cor : COLORS[0]}">
    </div>
    `;
  openModal('modal-disc');
}

export function selectIcon(icon, el) {
  document.querySelectorAll('#disc-icons > .icon-grid-item').forEach((d) => {
    d.classList.remove('selected-icon');
  });
  el.classList.add('selected-icon');
  document.getElementById('disc-icone').value = icon;
}

export function selectDiscColor(color) {
  document
    .querySelectorAll('#disc-colors .color-swatch')
    .forEach((s) => s.classList.remove('selected'));
  document
    .querySelector(`#disc-colors .color-swatch[data-disc-color="${color}"]`)
    ?.classList.add('selected');
  document.getElementById('disc-cor').value = color;
}

export function saveDisc() {
  const nomeEl = document.getElementById('disc-nome');
  if (!nomeEl) return;
  const nome = nomeEl.value.trim();
  if (!nome) {
    showToast('Informe o nome da disciplina', 'error');
    return;
  }
  const icone = document.getElementById('disc-icone')?.value || '📖';
  const cor = document.getElementById('disc-cor')?.value || '#8aa4bf';
  const discCtx = getEditingDiscCtx();
  if (!discCtx) return;
  const { editaId, discId } = discCtx;
  const edital = state.editais.find((e) => e.id === editaId);
  if (!edital) return;
  if (!edital.disciplinas) edital.disciplinas = [];

  if (discId) {
    // Edit existing discipline
    const disc = edital.disciplinas.find((d) => d.id === discId);
    if (disc) {
      disc.nome = nome;
      disc.icone = icone;
      disc.cor = cor;
      showToast('Disciplina atualizada!', 'success');
    }
  } else {
    // Create new
    edital.disciplinas.push({ id: uid(), nome, icone, cor, assuntos: [] });
    showToast('Disciplina criada!', 'success');
  }
  scheduleSave();
  closeModal('modal-disc');
  renderCurrentView();
}

export function saveDiscManager(editalId, discId) {
  const edital = state.editais.find((e) => e.id === editalId);
  if (!edital) return;
  const disc = edital.disciplinas?.find((d) => d.id === discId);
  if (!disc) return;
  const nomeEl = document.getElementById('dm-nome');
  const corPickerEl = document.getElementById('dm-cor-picker');
  const corEl = document.getElementById('dm-cor');
  if (nomeEl) disc.nome = nomeEl.value.trim() || disc.nome;
  if (corPickerEl || corEl) disc.cor = corPickerEl?.value || corEl?.value || disc.cor;
  scheduleSave();
  closeModal('modal-disc-manager');
  renderCurrentView();
  showToast('Disciplina atualizada!', 'success');
}

export function moveSubject(discId, idx, dir) {
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue;
    const disc = edital.disciplinas.find((d) => d.id === discId);
    if (!disc || !disc.assuntos) continue;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= disc.assuntos.length) return;
    const temp = disc.assuntos[idx];
    disc.assuntos[idx] = disc.assuntos[targetIdx];
    disc.assuntos[targetIdx] = temp;
    scheduleSave();
    const subjCtx = getEditingSubjectCtx();
    openDiscManager(subjCtx?.editaId || edital.id, discId);
    return;
  }
}
