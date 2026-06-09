// Audita o contraste WCAG dos tokens de texto por tema em src/css/base/themes.css.
// Uso: node scripts/check-theme-contrast.mjs
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../src/css/base/themes.css', import.meta.url), 'utf8');
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

for (const [, name, body] of blocks) {
  const get = (t) => {
    const r = body.match(new RegExp(`--${t}:\\s*(#[0-9a-fA-F]{6})`));
    return r ? r[1] : null;
  };
  const muted = get('text-muted');
  const card = get('card');
  const bg = get('bg');
  const sec = get('text-secondary');
  if (!muted || !card) continue;
  const mc = ratio(muted, card);
  console.log(
    name.padEnd(9),
    'muted/card:',
    mc.toFixed(2),
    mc < 4.5 ? '← FALHA AA' : '',
    ' muted/bg:',
    bg ? ratio(muted, bg).toFixed(2) : '-',
    ' sec/card:',
    sec ? ratio(sec, card).toFixed(2) : '-'
  );
}
