/**
 * Contrast Audit — Estudo Organizado
 *
 * Lê src/css/base/themes.css, extrai os tokens de cor de cada um dos 6 temas
 * e calcula os ratios de contraste WCAG dos pares críticos (texto sobre card,
 * cores semânticas sobre card, texto do accent sobre o accent).
 *
 * Os tokens de cor em themes.css são literais (hex/rgba) — sem var() encadeado —
 * então o cálculo é determinístico e não precisa de browser.
 *
 * Uso:
 *   node scripts/contrast-audit.mjs            # imprime tabela + JSON (report)
 *   node scripts/contrast-audit.mjs --enforce  # exit 1 se algum par de corpo < 4.5
 *
 * Programático:
 *   import { auditContrast } from './scripts/contrast-audit.mjs';
 *   const data = auditContrast(); // { grafite: { 'text-primary/card': 16.45, ... }, ... }
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const THEMES_CSS = join(__dirname, '..', 'src', 'css', 'base', 'themes.css');

export const THEMES = ['grafite', 'ardosia', 'platina', 'terminal', 'neon', 'arrakis'];

// Pares avaliados: [nome, tokenFg, tokenBg]. AA corpo = 4.5; texto grande = 3.
const PAIRS = [
  ['text-primary/card', '--text-primary', '--card'],
  ['text-secondary/card', '--text-secondary', '--card'],
  ['text-muted/card', '--text-muted', '--card'],
  ['danger/card', '--danger', '--card'],
  ['success/card', '--success', '--card'],
  ['warning/card', '--warning', '--card'],
  ['accent/card', '--accent', '--card'],
  ['accent-text/accent', '--accent-text', '--accent'],
];

// Tokens que carregam texto de corpo (devem ficar >= 4.5:1).
export const BODY_TEXT_PAIRS = ['text-primary/card', 'text-secondary/card', 'text-muted/card'];

function parseColor(c) {
  c = String(c).trim();
  if (c.startsWith('#')) {
    if (c.length === 4) {
      return [
        parseInt(c[1] + c[1], 16),
        parseInt(c[2] + c[2], 16),
        parseInt(c[3] + c[3], 16),
        1,
      ];
    }
    return [
      parseInt(c.slice(1, 3), 16),
      parseInt(c.slice(3, 5), 16),
      parseInt(c.slice(5, 7), 16),
      1,
    ];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(',').map((s) => parseFloat(s));
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  return null;
}

function blend(fg, bg) {
  const a = fg[3];
  return [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a),
    1,
  ];
}

function luminance(rgb) {
  const s = rgb.slice(0, 3).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
}

export function contrastRatio(fg, bg) {
  const f = fg[3] < 1 ? blend(fg, bg) : fg;
  const l1 = luminance(f);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Extrai o mapa de tokens de cada bloco [data-theme='X'] do themes.css. */
export function parseThemeTokens(css = readFileSync(THEMES_CSS, 'utf-8')) {
  const out = {};
  for (const theme of THEMES) {
    const re = new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([\\s\\S]*?)\\}`, 'm');
    const block = css.match(re);
    if (!block) continue;
    const tokens = {};
    const varRe = /(--[\w-]+)\s*:\s*([^;]+);/g;
    let m;
    while ((m = varRe.exec(block[1])) !== null) {
      tokens[m[1]] = m[2].trim();
    }
    out[theme] = tokens;
  }
  return out;
}

/** Retorna { theme: { 'pair-name': ratio } } arredondado a 2 casas. */
export function auditContrast(css) {
  const themes = parseThemeTokens(css);
  const result = {};
  for (const theme of THEMES) {
    const tokens = themes[theme];
    if (!tokens) continue;
    const row = {};
    for (const [name, fgTok, bgTok] of PAIRS) {
      const fg = parseColor(tokens[fgTok]);
      const bg = parseColor(tokens[bgTok]);
      if (!fg || !bg) continue;
      row[name] = Math.round(contrastRatio(fg, bg) * 100) / 100;
    }
    result[theme] = row;
  }
  return result;
}

// --- CLI -------------------------------------------------------------------
const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  const enforce = process.argv.includes('--enforce');
  const data = auditContrast();
  const cols = PAIRS.map(([n]) => n);

  console.log('\nWCAG contrast por tema (fg/bg). AA corpo >= 4.5, texto grande >= 3.\n');
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('theme', 10) + cols.map((c) => pad(c, 20)).join(''));
  for (const theme of THEMES) {
    const row = data[theme] || {};
    console.log(pad(theme, 10) + cols.map((c) => pad(row[c] ?? '-', 20)).join(''));
  }

  const failures = [];
  for (const theme of THEMES) {
    for (const name of BODY_TEXT_PAIRS) {
      const r = data[theme]?.[name];
      if (r != null && r < 4.5) failures.push(`${theme} ${name} = ${r}`);
    }
  }
  if (failures.length) {
    console.log('\nFALHAS de corpo (< 4.5:1):');
    failures.forEach((f) => console.log('  ' + f));
  } else {
    console.log('\nTexto de corpo: AA OK em todos os temas.');
  }

  if (enforce && failures.length) process.exit(1);
}
