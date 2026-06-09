import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// O browser trata './mod.js' e './mod.js?v=8.37' como MÓDULOS DIFERENTES:
// cada specifier cria uma instância própria, com estado de módulo separado.
// Foi exatamente isso que quebrou o filtro do Analisador de Banca (o render
// usava uma instância e os handlers de ação mutavam outra). Este teste
// garante que nenhum módulo é importado com e sem query de versão ao mesmo
// tempo. Arquivos de sync ficam fora da varredura (restrição do projeto).

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

describe('consistência de specifiers de módulo (?v=)', () => {
  it('nenhum módulo é importado simultaneamente com e sem query de versão', () => {
    const files = collectFiles('src/js');
    const specs = new Map();

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/from\s+'(\.[^']+)'/g)) {
        const spec = match[1];
        const resolved = path.normalize(path.join(path.dirname(file), spec.split('?')[0]));
        if (!specs.has(resolved)) specs.set(resolved, { versioned: [], plain: [] });
        specs.get(resolved)[spec.includes('?v=') ? 'versioned' : 'plain'].push(file);
      }
    }

    const duals = [...specs.entries()]
      .filter(([, s]) => s.versioned.length > 0 && s.plain.length > 0)
      .map(([mod, s]) => `${mod} — sem ?v em: ${s.plain.join(', ')}`);

    expect(duals).toEqual([]);
  });
});
