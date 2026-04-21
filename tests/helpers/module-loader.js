import { vi } from 'vitest';

/**
 * Carrega módulos da aplicação para testes unitários
 * Retorna objeto com todos os módulos principais
 */
export async function loadAppModules() {
  vi.resetModules();

  const store = await import('../../src/js/store.js?v=8.13');
  const logic = await import('../../src/js/logic.js?v=8.13');
  const app = await import('../../src/js/app.js?v=8.13');
  const components = await import('../../src/js/components.js?v=8.13');
  const views = await import('../../src/js/views.js?v=8.13');

  return { store, logic, app, components, views };
}
