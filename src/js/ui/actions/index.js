/**
 * Consolidador de Ações por Domínio
 * Re-exporta todas as ações organizadas por módulo
 * Importa todos os módulos para registrar ações no dispatcher
 */

// Dispatcher registry
export { setupActionDispatcher, registerAction, actions } from './dispatcher.js';

// Import all action modules to register their actions
// These imports execute registerAction() calls automatically
import './eventos.js';
import './editais.js';
import './revisoes.js';
import './habitos.js';
import './config.js';
import './navegacao.js';
import './modais.js';
import './planejamento.js';
