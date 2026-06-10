/**
 * Delete Operations for Editais
 * Extracted from editais-crud.js — deleteAssunto, deleteDisc, deleteEdital
 */

import { showConfirm } from '../../app.js?v=8.37';
import {
  getDisc,
  invalidateDiscCache,
  invalidateDashCaches,
  invalidatePendingRevCache,
} from '../../logic.js?v=8.37';
import { scheduleSave, state } from '../../store.js?v=8.37';
import { renderCurrentView } from '../../components.js?v=8.37';
import { getEditingSubjectCtx } from './shared-state.js';
import { openDiscManager } from './disc-manager.js';

export function deleteAssunto(discId, assId) {
  showConfirm(
    'Excluir este assunto? Eventos vinculados serão desvinculados.',
    () => {
      const entry = getDisc(discId);
      if (entry) {
        entry.disc.assuntos = entry.disc.assuntos.filter((a) => a.id !== assId);

        if (state.eventos) {
          state.eventos.forEach((e) => {
            if (e.assId === assId) {
              delete e.assId;
            }
          });
        }

        invalidateDiscCache();
        invalidateDashCaches();
        invalidatePendingRevCache();
        scheduleSave();
        renderCurrentView();
        const subjCtx = getEditingSubjectCtx();
        if (
          typeof subjCtx !== 'undefined' &&
          subjCtx &&
          subjCtx.discId === discId
        ) {
          openDiscManager(subjCtx.editaId, discId);
        }
      }
    },
    { danger: true, label: 'Excluir', title: 'Excluir assunto' }
  );
}

export function deleteDisc(editaId, discId) {
  showConfirm(
    'Excluir esta disciplina e todos seus assuntos?\n\nEsta ação não pode ser desfeita.',
    () => {
      const edital = state.editais.find((e) => e.id === editaId);
      if (!edital || !edital.disciplinas) return;
      edital.disciplinas = edital.disciplinas.filter((d) => d.id !== discId);

      if (state.eventos) {
        state.eventos.forEach((e) => {
          if (e.discId === discId) {
            delete e.discId;
            delete e.assId;
          }
        });
      }
      if (state.planejamento && state.planejamento.disciplinas) {
        state.planejamento.disciplinas = state.planejamento.disciplinas.filter(
          (id) => id !== discId
        );
        if (state.planejamento.relevancia && state.planejamento.relevancia[discId])
          delete state.planejamento.relevancia[discId];
        if (state.planejamento.sequencia)
          state.planejamento.sequencia = state.planejamento.sequencia.filter(
            (s) => s.discId !== discId
          );
      }

      invalidateDiscCache();
      invalidateDashCaches();
      invalidatePendingRevCache();
      scheduleSave();
      renderCurrentView();
    },
    { danger: true, label: 'Excluir disciplina', title: 'Excluir disciplina' }
  );
}

export function deleteEdital(editaId) {
  const edital = state.editais.find((e) => e.id === editaId);
  const nome = edital ? edital.nome : 'edital';
  showConfirm(
    `Excluir "${nome}" completamente ?

      Todos os grupos, disciplinas e assuntos serão removidos.Esta ação não pode ser desfeita.`,
    () => {
      const discIds = edital && edital.disciplinas ? edital.disciplinas.map((d) => d.id) : [];
      state.editais = state.editais.filter((e) => e.id !== editaId);

      if (discIds.length > 0 && state.eventos) {
        state.eventos.forEach((e) => {
          if (discIds.includes(e.discId)) {
            delete e.discId;
            delete e.assId;
          }
        });
      }
      if (discIds.length > 0 && state.planejamento && state.planejamento.disciplinas) {
        state.planejamento.disciplinas = state.planejamento.disciplinas.filter(
          (id) => !discIds.includes(id)
        );
        discIds.forEach((id) => {
          if (state.planejamento.relevancia && state.planejamento.relevancia[id])
            delete state.planejamento.relevancia[id];
        });
        if (state.planejamento.sequencia)
          state.planejamento.sequencia = state.planejamento.sequencia.filter(
            (s) => !discIds.includes(s.discId)
          );
      }

      invalidateDiscCache();
      invalidatePendingRevCache();
      scheduleSave();
      renderCurrentView();
    },
    { danger: true, label: 'Excluir edital', title: 'Excluir edital' }
  );
}
