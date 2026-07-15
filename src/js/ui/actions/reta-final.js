/**
 * Ações da Reta Final
 * Import do cronograma JSON e restauração do planejamento arquivado.
 */

import { registerAction } from './dispatcher.js';
import { closeModal, navigate, showConfirm, showToast } from '../../app.js?v=8.37';
import { renderCurrentView } from '../../components.js?v=8.37';
import { scheduleSave } from '../../store.js?v=8.37';
import {
  invalidateDiscCache,
  invalidateDashCaches,
  syncCicloToEventos,
  getActiveTimerEventIds,
  toggleTimer,
} from '../../logic.js?v=8.37';

registerAction('open-reta-final-import', () => {
  // Pode ser acionado de dentro do wizard de planejamento — fecha antes.
  closeModal('modal-planejamento');
  import('../../views/reta-final-import.js?v=8.37').then(({ openRetaFinalImport }) =>
    openRetaFinalImport()
  );
});

registerAction('rf-set-filtro', (el) => {
  return import('../../views/reta-final-view.js?v=8.37').then(({ setRetaFinalFiltro }) => {
    setRetaFinalFiltro(el.dataset.filtro);
    renderCurrentView();
  });
});

registerAction('rf-quick-mark', (el) => {
  const blocoId = el.dataset.blocoId;
  import('../../logic/reta-final.js').then(({ quickCompleteRetaFinalBloco }) => {
    if (!quickCompleteRetaFinalBloco(blocoId)) {
      showToast('Não foi possível marcar este bloco como estudado.', 'error');
      return;
    }
    invalidateDashCaches();
    renderCurrentView();
    showToast(
      'Bloco marcado como estudado — edite a sessão no Histórico para adicionar tempo/questões.',
      'success'
    );
  });
});

registerAction('rf-start-timer', (el) => {
  const blocoId = el.dataset.blocoId;
  return import('../../logic/reta-final.js').then(({ getRetaFinalBlocoEvento }) => {
    const ev = getRetaFinalBlocoEvento(blocoId);
    if (!ev) {
      showToast('Não foi possível iniciar o cronômetro deste bloco.', 'error');
      return;
    }
    const start = () => {
      navigate('cronometro');
      // Mesmo padrão de switch-to-event-timer: o toggle após o render da view.
      setTimeout(() => toggleTimer(ev.id), 100);
    };
    const ativos = getActiveTimerEventIds().filter((id) => id !== ev.id);
    if (ativos.length > 0) {
      showConfirm(
        'Já há uma sessão em andamento. Pausar a sessão atual e iniciar este bloco?',
        () => {
          ativos.forEach((id) => toggleTimer(id));
          start();
        },
        { label: 'Pausar e iniciar', title: 'Sessão em andamento' }
      );
    } else {
      start();
    }
  });
});

registerAction('rf-associar-historico', (el) => {
  const blocoId = el.dataset.blocoId;
  import('../../views/reta-final-associar.js?v=8.37').then(({ openAssociarHistorico }) => {
    if (!openAssociarHistorico(blocoId)) {
      showToast('Não foi possível abrir a associação para este bloco.', 'error');
    }
  });
});

registerAction('restaurar-planejamento-arquivado', () => {
  showConfirm(
    'Restaurar o planejamento anterior? O plano da Reta Final será substituído (sessões estudadas são preservadas).',
    () => {
      import('../../logic/reta-final.js').then(({ restaurarPlanejamentoArquivado }) => {
        if (!restaurarPlanejamentoArquivado()) {
          showToast('Nenhum planejamento arquivado para restaurar.', 'error');
          return;
        }
        invalidateDiscCache();
        invalidateDashCaches();
        // Reagenda os eventos do plano restaurado (ciclo/grade).
        syncCicloToEventos();
        scheduleSave();
        renderCurrentView();
        showToast('Planejamento anterior restaurado!', 'success');
      });
    },
    { label: 'Restaurar', title: 'Restaurar planejamento' }
  );
});
