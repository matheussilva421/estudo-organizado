/**
 * Inline Editing Handlers
 * Extracted from editais-crud.js — editSubjectInline, editLessonInline
 */

import { scheduleSave, state } from '../../store.js?v=8.37';
import { renderCurrentView } from '../../components.js?v=8.37';
import { getDisc } from '../../logic.js?v=8.37';
import { getEditingSubjectCtx } from './shared-state.js';
import { openDiscManager } from './disc-manager.js';

function findSubject(discId, assId) {
  for (const edital of state.editais || []) {
    const disc = (edital.disciplinas || []).find((d) => d.id === discId);
    const subject = (disc?.assuntos || []).find((a) => a.id === assId);
    if (subject) return subject;
  }
  return null;
}

export function editSubjectInline(discId, assId, el) {
  const subject = findSubject(discId, assId);
  const currentText = subject?.nome || el.innerText || '';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentText;
  input.style.width = '100%';
  input.style.border = '1px solid var(--accent)';
  input.style.padding = '4px 8px';
  input.style.borderRadius = '4px';
  input.style.background = 'var(--bg)';
  input.style.color = 'var(--text)';

  input.onblur = () => {
    const newVal = input.value.trim();
    if (newVal && newVal !== currentText) {
      const ass = subject || findSubject(discId, assId);
      if (ass) {
        ass.nome = newVal;
        scheduleSave();
      }
    }
    renderCurrentView();
  };
  input.onkeydown = (e) => {
    if (e.key === 'Enter') input.blur();
    else if (e.key === 'Escape') {
      input.value = currentText;
      input.blur();
    }
  };

  el.innerHTML = '';
  el.appendChild(input);
  input.focus();
}

export function editLessonInline(discId, aulaId, el) {
  const d = getDisc(discId);
  if (!d) return;
  const aulaObj = (d.disc.aulas || []).find((a) => a.id === aulaId);
  if (!aulaObj) return;

  const originalText = aulaObj.nome;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = originalText;
  input.className = 'form-control sm-item-input';
  input.style.width = '100%';

  const finish = () => {
    const val = input.value.trim();
    if (val && val !== originalText) {
      aulaObj.nome = val;
      scheduleSave();
      const subjCtx = getEditingSubjectCtx();
      openDiscManager(subjCtx.editaId, discId);
    } else {
      const subjCtx = getEditingSubjectCtx();
      openDiscManager(subjCtx.editaId, discId);
    }
  };

  input.onblur = finish;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') finish();
    if (e.key === 'Escape') {
      const subjCtx = getEditingSubjectCtx();
      openDiscManager(subjCtx.editaId, discId);
    }
  };

  el.innerHTML = '';
  el.appendChild(input);
  input.focus();
  input.select();
}
