import { vi } from 'vitest';

export async function loadAppModules() {
  vi.resetModules();

  const store = await import('../../src/js/store.js?v=8.3');
  const logic = await import('../../src/js/logic.js?v=8.3');

  return { store, logic };
}
