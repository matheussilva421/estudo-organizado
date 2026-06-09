import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Regressão de acessibilidade: --text-muted é usado em texto pequeno
// (hints, labels de 11-12px), então precisa de contraste AA (>= 4.5:1)
// sobre --card em todos os temas premium.

const css = readFileSync('src/css/base/themes.css', 'utf8');
const blocks = [...css.matchAll(/\[data-theme='([a-z]+)'\]\s*\{([\s\S]*?)\n\}/g)];

function lum(hex) {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(f, b) {
  const l1 = Math.max(lum(f), lum(b));
  const l2 = Math.min(lum(f), lum(b));
  return (l1 + 0.05) / (l2 + 0.05);
}

function token(body, name) {
  const m = body.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  return m ? m[1] : null;
}

describe('themes.css — contraste WCAG AA', () => {
  const themes = blocks
    .map(([, name, body]) => ({ name, body }))
    .filter(({ body }) => token(body, 'text-muted') && token(body, 'card'));

  it('encontra os temas premium', () => {
    expect(themes.map((t) => t.name)).toEqual(
      expect.arrayContaining(['grafite', 'ardosia', 'platina', 'terminal', 'neon', 'arrakis'])
    );
  });

  it.each(blocks.map(([, name, body]) => [name, body]))(
    'tema %s: --text-muted tem contraste >= 4.5 sobre --card',
    (name, body) => {
      const muted = token(body, 'text-muted');
      const card = token(body, 'card');
      if (!muted || !card) return;
      expect(ratio(muted, card)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it.each(blocks.map(([, name, body]) => [name, body]))(
    'tema %s: --text-secondary tem contraste >= 4.5 sobre --card',
    (name, body) => {
      const sec = token(body, 'text-secondary');
      const card = token(body, 'card');
      if (!sec || !card) return;
      expect(ratio(sec, card)).toBeGreaterThanOrEqual(4.5);
    }
  );
});
