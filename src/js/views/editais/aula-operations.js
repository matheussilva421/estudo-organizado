/**
 * Aula (Lesson) Operations
 * Extracted from editais-crud.js — toggleAulaEstudada, addBulkAulas,
 * addAssunto, deleteAula, runLessonMapperUI
 */

import { showConfirm, showToast } from '../../app.js?v=8.37';
import { todayStr, uid } from '../../utils.js?v=8.37';
import { scheduleSave } from '../../store.js?v=8.37';
import { getDisc } from '../../logic.js?v=8.37';
import { mapAulasToAssuntos } from '../../lesson-mapper.js?v=8.37';
import { getEditingSubjectCtx } from './shared-state.js';
import { openDiscManager } from './disc-manager.js';

export function toggleAulaEstudada(discId, aulaId) {
  const d = getDisc(discId);
  if (!d) return;
  const aulaObj = (d.disc.aulas || []).find((a) => a.id === aulaId);
  if (!aulaObj) return;

  aulaObj.estudada = !aulaObj.estudada;
  aulaObj.dataEstudo = aulaObj.estudada ? todayStr() : null;
  scheduleSave();
  openDiscManager(getEditingSubjectCtx().editaId, discId);
}

export function addBulkAulas(discId) {
  const textarea = document.getElementById('new-aula-bulk');
  if (!textarea) return;

  const lines = textarea.value
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    showToast('Nenhum texto de aula encontrado.', 'error');
    return;
  }

  const d = getDisc(discId);
  if (!d) return;

  if (!d.disc.aulas) d.disc.aulas = [];

  lines.forEach((lineNome) => {
    d.disc.aulas.push({
      id: 'aula_' + uid(),
      nome: lineNome,
      descricao: '',
      estudada: false,
      dataEstudo: null,
      progress: 0,
      linkedAssuntoIds: [],
    });
  });

  scheduleSave();
  textarea.value = '';
  showToast(`${lines.length} Aulas adicionadas!`, 'success');
  openDiscManager(getEditingSubjectCtx().editaId, discId);
}

export function addAssunto(discId) {
  const input = document.getElementById('new-assunto-nome');
  if (!input) return;
  const lines = input.value
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return;
  const d = getDisc(discId);
  if (!d) return;
  if (!d.disc.assuntos) d.disc.assuntos = [];
  lines.forEach((nome) => {
    d.disc.assuntos.push({
      id: 'ass_' + uid(),
      nome: nome,
      concluido: false,
      revisoesFetas: [],
      adiamentos: 0,
      linkedAulaIds: [],
    });
  });
  input.value = '';
  scheduleSave();
  openDiscManager(getEditingSubjectCtx().editaId, discId);
}

export function deleteAula(discId, aulaId) {
  showConfirm('Tem certeza que deseja apagar esta Aula?', () => {
    const d = getDisc(discId);
    if (!d) return;

    // Remove backlinks
    d.disc.assuntos.forEach((ass) => {
      if (ass.linkedAulaIds) {
        ass.linkedAulaIds = ass.linkedAulaIds.filter((id) => id !== aulaId);
      }
    });

    d.disc.aulas = d.disc.aulas.filter((a) => a.id !== aulaId);
    scheduleSave();
    openDiscManager(getEditingSubjectCtx().editaId, discId);
  });
}

export function runLessonMapperUI(editaId, discId) {
  showConfirm(
    'Deseja aplicar Inteligência Artificial para conectar automaticamente as Aulas aos Assuntos deste Edital com base em similaridade (NLP + Levenshtein)?',
    () => {
      const resultCount = mapAulasToAssuntos(editaId, discId);
      if (resultCount > 0) {
        showToast(`${resultCount} Aulas Conectadas Automaticamente!`, 'success');
      } else {
        showToast('Nenhum Tópico bateu com 70%+ de precisão com esta base de Aulas.', 'info');
      }
      openDiscManager(getEditingSubjectCtx().editaId, discId);
    },
    { label: 'Rodar Auto-Link', title: 'Mapeador ML' }
  );
}
