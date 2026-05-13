import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const filesToScan = [
  'src/index.html',
  'src/js/app.js',
  'src/js/components.js',
  'src/js/logic.js',
  'src/js/main.js',
  'src/js/planejamento-wizard.js',
  'src/js/registro-sessao.js',
  'src/js/registro-sessao/modal-renderer.js',
  'src/js/registro-sessao/session-save.js',
  'src/js/views.js',
  'src/js/views/banca-view.js',
  'src/js/views/calendar-view.js',
  'src/js/views/dashboard-view.js',
  'src/js/views/editais-view.js',
  'src/js/views/home-view.js'
];

const inlineHandlerPattern = /\son(?:click|change|input|submit|keydown|keyup|focus|blur|mouseover|mouseout)\s*=/i;

describe('inline event handlers', () => {
  it('keeps app-owned markup on delegated data-action handlers', () => {
    const offenders = filesToScan.flatMap(file => {
      const source = readFileSync(file, 'utf8');
      return source
        .split(/\r?\n/)
        .map((line, index) => ({ file, lineNumber: index + 1, line }))
        .filter(({ line }) => inlineHandlerPattern.test(line))
        .map(({ file, lineNumber, line }) => `${file}:${lineNumber}: ${line.trim()}`);
    });

    expect(offenders).toEqual([]);
  });

  it('keeps app-owned scripts external so script-src can be tightened', () => {
    const html = readFileSync('src/index.html', 'utf8');
    const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/gi)];
    const csp = html.match(/Content-Security-Policy"\s+content="([^"]+)"/i)?.[1] || '';
    const scriptSrc = csp.match(/script-src\s+([^;]+)/i)?.[1] || '';

    expect(inlineScripts.map(match => match[0])).toEqual([]);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });
});
