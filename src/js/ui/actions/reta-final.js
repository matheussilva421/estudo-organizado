/**
 * Ações da Reta Final
 * Import do cronograma JSON e restauração do planejamento arquivado.
 */

import { registerAction } from './dispatcher.js';
import { closeModal, showConfirm, showToast } from '../../app.js?v=8.37';
import { renderCurrentView } from '../../components.js?v=8.37';
import { scheduleSave } from '../../store.js?v=8.37';
import {
  invalidateDiscCache,
  invalidateDashCaches,
  syncCicloToEventos,
} from '../../logic.js?v=8.37';

registerAction('open-reta-final-import', () => {
  // Pode ser acionado de dentro do wizard de planejamento — fecha antes.
  closeModal('modal-planejamento');
  import('../../views/reta-final-import.js?v=8.37').then(({ openRetaFinalImport }) =>
    openRetaFinalImport()
  );
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
