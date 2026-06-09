// Validação manual assistida (Playwright headed) — Banca, teclado do
// Calendário, temas e perf do toggleEdital. Não é um teste de CI: roda
// visível, tira screenshots em test-results/manual-validation/ e imprime
// um relatório PASS/FAIL por etapa.
//
// Pré-requisito: servidor estático em http://127.0.0.1:18345 (npx http-server src -p 18345 -c-1)
// Uso: node scripts/manual-validation.mjs [--headless]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:18345';
const OUT = 'test-results/manual-validation';
const headless = process.argv.includes('--headless');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function report(step, ok, detail = '') {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ' — ' + detail : ''}`);
}

function buildState() {
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  const mkAss = (id, nome) => ({
    id, nome, concluido: false, dataConclusao: null, revisoesFetas: [], adiamentos: 0, linkedAulaIds: [],
  });
  const editais = [
    {
      id: 'ed_1', nome: 'Concurso TRF', cor: '#0f766e',
      disciplinas: [
        { id: 'disc_1', nome: 'Direito Constitucional', icone: '📚', cor: '#0f766e', assuntos: [mkAss('ass_1', 'Controle de Constitucionalidade'), mkAss('ass_2', 'Direitos Fundamentais')], aulas: [] },
        { id: 'disc_2', nome: 'Direito Administrativo', icone: '⚖️', cor: '#8a4fff', assuntos: [mkAss('ass_3', 'Atos Administrativos')], aulas: [] },
      ],
    },
    {
      id: 'ed_2', nome: 'Concurso PF', cor: '#b45309',
      disciplinas: [
        { id: 'disc_3', nome: 'Informática', icone: '💻', cor: '#b45309', assuntos: [mkAss('ass_4', 'Redes de Computadores')], aulas: [] },
      ],
    },
  ];
  return {
    schemaVersion: 7,
    ciclo: { ativo: false, ciclosCompletos: 0, disciplinas: [] },
    planejamento: { ativo: false, tipo: null, disciplinas: [], relevancia: {}, horarios: {}, sequencia: [], ciclosCompletos: 0, dataInicioCicloAtual: null },
    editais,
    eventos: [
      { id: 'ev_1', titulo: 'Estudar Constitucional', data: today, duracao: 60, status: 'agendado', tempoAcumulado: 0, discId: 'disc_1', assId: 'ass_1', aulaId: null },
    ],
    arquivo: [],
    habitos: { questoes: [], simulado: [], discursiva: [], leitura: [] },
    config: { metas: {}, primeirodiaSemana: 1 },
    bancaRelevance: {
      hotTopics: [
        { disciplinaId: 'disc_1', nome: 'Controle de Constitucionalidade', rank: 1, weight: 30 },
        { disciplinaId: 'disc_1', nome: 'Direitos Fundamentais', rank: 2, weight: 20 },
      ],
    },
  };
}

const browser = await chromium.launch({ headless, slowMo: headless ? 0 : 150 });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

await page.addInitScript((serialized) => {
  window.Chart = class { destroy() {} };
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('estudo_state', serialized);
}, JSON.stringify(buildState()));

await page.goto(BASE);
await page.waitForFunction(() => typeof window.EstudoApp?.navigate === 'function');

// ── 1. Intelig. de Banca: fluxos que estavam quebrados ──
await page.evaluate(() => window.EstudoApp.navigate('banca-analyzer'));
await page.waitForSelector('#banca-edital-select');
await page.screenshot({ path: `${OUT}/01-banca-inicial.png` });

// 1a. Trocar edital no select
await page.selectOption('#banca-edital-select', 'ed_2');
await page.waitForTimeout(300);
const tituloAposTroca = await page.evaluate(() => document.getElementById('banca-edital-select')?.value);
report('Banca: trocar edital via select', tituloAposTroca === 'ed_2', `select=${tituloAposTroca}`);
await page.screenshot({ path: `${OUT}/02-banca-edital-trocado.png` });

// 1b. Voltar e filtrar por disciplina com análise salva
await page.selectOption('#banca-edital-select', 'ed_1');
await page.waitForTimeout(300);
await page.selectOption('#banca-disc-select', 'disc_1');
await page.waitForTimeout(400);
const matchesVisiveis = await page.evaluate(() => document.body.innerText.includes('Controle de Constitucionalidade'));
report('Banca: filtrar por disciplina mostra hot topics salvos', matchesVisiveis);
await page.screenshot({ path: `${OUT}/03-banca-filtro-disciplina.png` });

// 1c. Clicar numa análise salva (carregar-analise-banca)
const savedLink = page.locator('[data-action="carregar-analise-banca"]').first();
if (await savedLink.count()) {
  await savedLink.click();
  await page.waitForTimeout(400);
  const textarea = await page.evaluate(() => document.getElementById('banca-input-text')?.value || '');
  report('Banca: abrir análise salva preenche o textarea', textarea.includes('Controle'), `len=${textarea.length}`);
  await page.screenshot({ path: `${OUT}/04-banca-analise-salva.png` });
} else {
  report('Banca: abrir análise salva', false, 'link de análise salva não encontrado na UI');
}

// ── 2. Calendário: navegação por teclado ──
await page.evaluate(() => window.EstudoApp.navigate('calendar'));
await page.waitForSelector('.cal-grid .cal-cell');
const focusableCells = await page.evaluate(
  () => document.querySelectorAll('.cal-grid .cal-cell[tabindex="0"]').length
);
report('Calendário: exatamente 1 célula com tabindex=0', focusableCells === 1, `count=${focusableCells}`);

await page.evaluate(() => document.querySelector('.cal-grid .cal-cell[tabindex="0"]')?.focus());
const before = await page.evaluate(() => document.activeElement?.dataset?.date);
await page.keyboard.press('ArrowRight');
const after = await page.evaluate(() => document.activeElement?.dataset?.date);
report('Calendário: ArrowRight move o foco para o dia seguinte', !!after && after !== before, `${before} -> ${after}`);

await page.keyboard.press('ArrowDown');
const afterDown = await page.evaluate(() => document.activeElement?.dataset?.date);
report('Calendário: ArrowDown move +7 dias', !!afterDown && afterDown !== after, `${after} -> ${afterDown}`);

await page.keyboard.press('Enter');
await page.waitForTimeout(400);
const dayPanelOpen = await page.evaluate(
  () => !!document.querySelector('#cal-day-panel, .cal-day-panel, [id*="day-panel"]') ||
    document.body.innerText.includes('Adicionar sessão') || document.body.innerText.includes('Adicionar sessao')
);
report('Calendário: Enter seleciona o dia (painel/da ação visível)', dayPanelOpen);
await page.screenshot({ path: `${OUT}/05-calendario-teclado.png` });

// ── 3. Temas ajustados: aplicar cada um e medir contraste real ──
const themes = ['grafite', 'ardosia', 'platina', 'terminal', 'neon', 'arrakis'];
await page.evaluate(() => window.EstudoApp.navigate('home'));
for (const theme of themes) {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.waitForTimeout(200);
  const ratio = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const parse = (str) => {
      const m = str.trim().match(/^#([0-9a-f]{6})$/i);
      if (!m) return null;
      return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    };
    const lum = (rgb) => {
      const a = rgb.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    };
    const muted = parse(css.getPropertyValue('--text-muted'));
    const card = parse(css.getPropertyValue('--card'));
    if (!muted || !card) return null;
    const l1 = Math.max(lum(muted), lum(card));
    const l2 = Math.min(lum(muted), lum(card));
    return (l1 + 0.05) / (l2 + 0.05);
  });
  report(`Tema ${theme}: --text-muted contraste AA em runtime`, ratio !== null && ratio >= 4.5, `ratio=${ratio?.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/06-tema-${theme}.png` });
}
await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

// ── 4. Perf do toggleEdital ──
await page.evaluate(() => window.EstudoApp.navigate('editais'));
await page.waitForSelector('[data-action="toggle-edital"]');
const toggleMs = await page.evaluate(async () => {
  const header = document.querySelector('[data-action="toggle-edital"]');
  const times = [];
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    header.click();
    times.push(performance.now() - t0);
    await new Promise((r) => setTimeout(r, 30));
  }
  return times.reduce((a, b) => a + b, 0) / times.length;
});
report('Editais: toggleEdital médio < 16ms (update cirúrgico)', toggleMs < 16, `${toggleMs.toFixed(2)}ms/click`);
await page.screenshot({ path: `${OUT}/07-editais-toggle.png` });

// ── 5. Erros de console acumulados ──
const relevantes = consoleErrors.filter((e) => !e.includes('favicon'));
report('Sem erros de console durante toda a validação', relevantes.length === 0, relevantes.slice(0, 3).join(' | '));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} etapas PASS. Screenshots em ${OUT}/`);
process.exit(failed.length ? 1 : 0);
