// Testes de guarda do Visual Layout Lab — garantem o ISOLAMENTO do lab:
// storage prefixado, nenhum import de src/js/, fora do precache do SW e
// CSS linkado idêntico ao index.html (anti-drift).

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RENDERERS, renderCard } from '../../src/lab/visual-layout-lab-render.js';
import { REGISTRY, SCREENS } from '../../src/lab/visual-layout-lab-registry.js';

const LAB_DIR = join(__dirname, '..', '..', 'src', 'lab');
const SRC_DIR = join(__dirname, '..', '..', 'src');
const STORAGE_PREFIX = 'estudo-organizado-visual-layout-lab:';

function labFiles(ext) {
  return readdirSync(LAB_DIR).filter((f) => f.endsWith(ext));
}

function readLab(name) {
  return readFileSync(join(LAB_DIR, name), 'utf8');
}

describe('lab guards — storage prefixado', () => {
  it('todo uso de localStorage no lab passa pelo wrapper labStorage', () => {
    for (const file of labFiles('.js')) {
      const src = readLab(file);
      const uses = src.match(/localStorage\.(get|set|remove)Item/g) || [];
      if (file === 'visual-layout-lab.js') {
        // único arquivo autorizado a tocar localStorage, sempre via labKey()
        for (const line of src.split('\n')) {
          if (/localStorage\.(get|set|remove)Item/.test(line)) {
            expect(line, `${file}: acesso a localStorage sem labKey(): ${line.trim()}`).toMatch(
              /labKey\(/
            );
          }
        }
      } else {
        expect(uses, `${file} não deve acessar localStorage`).toEqual([]);
      }
    }
  });

  it('o prefixo de storage está definido e correto na cola DOM', () => {
    const src = readLab('visual-layout-lab.js');
    expect(src).toContain(`'${STORAGE_PREFIX}'`);
  });

  it('nenhum arquivo do lab toca IndexedDB, Firestore, Drive ou fetch', () => {
    for (const file of labFiles('.js')) {
      const src = readLab(file);
      expect(src, `${file} não deve usar indexedDB`).not.toMatch(/indexedDB/i);
      expect(src, `${file} não deve usar firebase/firestore`).not.toMatch(/firebase|firestore/i);
      expect(src, `${file} não deve usar fetch/XHR`).not.toMatch(/\bfetch\s*\(|XMLHttpRequest/);
    }
  });
});

describe('lab guards — isolamento de módulos', () => {
  it('nenhum arquivo do lab importa módulos de src/js/', () => {
    for (const file of labFiles('.js')) {
      const src = readLab(file);
      const imports = src.match(/from\s+['"][^'"]+['"]/g) || [];
      for (const imp of imports) {
        expect(imp, `${file}: import proibido ${imp}`).not.toMatch(/\/js\/|\.\.\/js/);
        expect(imp, `${file}: imports devem ser locais ao lab`).toMatch(/\.\/visual-layout-lab/);
      }
    }
  });
});

describe('lab guards — service worker', () => {
  it('src/lab/ não está no precache ASSET_PATHS do sw.js', () => {
    const sw = readFileSync(join(SRC_DIR, 'sw.js'), 'utf8');
    expect(sw).not.toMatch(/lab\//);
  });
});

describe('lab guards — CSS anti-drift', () => {
  it('o HTML do lab linka as MESMAS entradas CSS do index.html', () => {
    const extractCss = (html) =>
      [...html.matchAll(/href="([^"]+\.css)[^"]*"/g)]
        .map((m) => m[1].replace(/\?v=[\d.]+$/, ''))
        .filter((href) => !href.startsWith('http'))
        .map((href) => href.replace(/^\.\.\//, '').replace(/^css\//, 'css/'));

    const appCss = extractCss(readFileSync(join(SRC_DIR, 'index.html'), 'utf8'));
    const labCss = extractCss(readLab('visual-layout-lab.html')).map((href) =>
      href.replace(/^\.\.\//, '')
    );

    for (const entry of appCss) {
      expect(labCss, `lab HTML deve linkar ${entry}`).toContain(entry);
    }
  });

  it('o HTML do lab usa os mesmos CDNs de fonte/ícone do app', () => {
    const lab = readLab('visual-layout-lab.html');
    expect(lab).toMatch(/fonts\.googleapis\.com/);
    expect(lab).toMatch(/font-awesome/);
  });
});

describe('lab contrato — registry × renderers', () => {
  it('toda tela do seletor tem registry', () => {
    for (const screen of SCREENS) {
      expect(REGISTRY[screen.id], `registry de ${screen.id}`).toBeDefined();
      expect(REGISTRY[screen.id].length).toBeGreaterThan(0);
    }
  });

  it('todo card do registry tem renderer e produz markup não-vazio', () => {
    for (const screen of SCREENS) {
      for (const card of REGISTRY[screen.id]) {
        expect(RENDERERS[card.id], `renderer faltando: ${card.id}`).toBeTypeOf('function');
        const html = renderCard(card.id);
        expect(html.length, `markup vazio: ${card.id}`).toBeGreaterThan(40);
        expect(html).not.toContain('CARD SEM RENDERER');
      }
    }
  });

  it('ids do registry são únicos entre todas as telas', () => {
    const all = SCREENS.flatMap((s) => REGISTRY[s.id].map((c) => c.id));
    expect(new Set(all).size).toBe(all.length);
  });

  it('spans e alturas default são válidos', () => {
    for (const screen of SCREENS) {
      for (const card of REGISTRY[screen.id]) {
        expect(card.span, `${card.id} span`).toBeGreaterThanOrEqual(1);
        expect(card.span, `${card.id} span`).toBeLessThanOrEqual(4);
        expect(['sm', 'md', 'lg', 'xl'], `${card.id} height`).toContain(card.height);
      }
    }
  });
});
