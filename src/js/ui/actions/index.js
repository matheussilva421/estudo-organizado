/**
 * Consolidador de Ações por Domínio
 * Re-exporta todas as ações organizadas por módulo
 */

// Dispatcher registry
export { setupActionDispatcher, registerAction, actions } from './dispatcher.js';

// Eventos e Cronômetro
export * from './eventos.js';

// Editais e Disciplinas
export * from './editais.js';

// Revisões
export * from './revisoes.js';

// Hábitos
export * from './habitos.js';

// Configurações
export * from './config.js';

// Navegação
export * from './navegacao.js';

// Modais
export * from './modais.js';
