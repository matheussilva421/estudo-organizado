import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Divs com data-action são clicáveis via delegação, mas sem role="button" ficam
// invisíveis para teclado/leitores de tela (a delegação Enter/Space do dispatcher
// exige [data-action][role="button"]). Este guard falha quando um novo div
// clicável nasce sem semântica. Wrappers não-interativos entram na allowlist.

const NON_INTERACTIVE_ACTIONS = new Set([
  'stop-propagation', // wrapper que apenas isola cliques dos botões internos
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

describe('a11y de divs clicáveis (data-action)', () => {
  it('todo <div data-action> interativo declara role', () => {
    const offenders = [];
    for (const file of collectFiles('src/js')) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/<div[^>]*data-action="([a-z-]+)"[^>]*>/g)) {
        const action = match[1];
        if (NON_INTERACTIVE_ACTIONS.has(action)) continue;
        if (!match[0].includes('role=')) {
          offenders.push(`${file}: ${action}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
