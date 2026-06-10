import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Duas definições exportadas com o mesmo nome em módulos diferentes já causaram
// bugs reais aqui: toggleAulaDashboard (cópia em dashboard-view divergiu da
// canônica em editais-crud) e getFilteredVertItems (cópia legada em views.js
// ignorava edital global, disciplinas arquivadas e busca normalizada). Este
// teste falha quando um novo nome exportado passa a ter mais de uma definição.
// Wrappers/delegações intencionais entram na allowlist abaixo, com o motivo.

const ALLOWED_DUPLICATES = new Set([
  'esc', // utils.js e ui/dom.js — implementações idênticas (escape de HTML)
  'createExportableState', // store.js é wrapper fino de store/export-state.js
  'runMigrations', // domínios distintos: schema do IndexedDB vs migrações de state
  'pwRenderWeightPreview', // planejamento-wizard.js delega para planejamento/step-renderers.js
  'openModal', // app/modals.js (em uso) vs ui/dialog.js (não importado) — decisão pendente
  'closeModal', // idem openModal
  'getRuntimeFirebaseConfig', // firebase-config.js local (gitignored) sobrepõe o default — intencional
  'getRuntimeAppCheckSiteKey', // idem firebase-config
]);

function collectFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'vendor' || entry.name === 'sync') continue;
      collectFiles(p, out);
    } else if (entry.name.endsWith('.js')) {
      out.push(p);
    }
  }
  return out;
}

describe('exports duplicados entre módulos', () => {
  it('nenhuma função exportada é definida em mais de um módulo (fora da allowlist)', () => {
    const files = collectFiles('src/js');
    const defs = new Map();

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) {
        const name = match[1];
        if (!defs.has(name)) defs.set(name, []);
        defs.get(name).push(file);
      }
    }

    const duplicates = [...defs.entries()]
      .filter(([name, places]) => places.length > 1 && !ALLOWED_DUPLICATES.has(name))
      .map(([name, places]) => `${name} definida em: ${places.join(', ')}`);

    expect(duplicates).toEqual([]);
  });
});
