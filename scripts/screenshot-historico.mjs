// Validação visual pontual: screenshot da view Histórico de Sessões
// (toolbar de filtros + empty state e lista populada) após o fix de
// proporção dos cards. Requer http-server em 127.0.0.1:18345 (ou sobe um).
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { createE2EState } from '../tests/helpers/e2e-state.js';

const PORT = 18345;
const BASE = `http://127.0.0.1:${PORT}`;

async function seed(page, state) {
  await page.addInitScript((serialized) => {
    window.Chart = class {
      destroy() {}
    };
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('estudo_state', serialized);
  }, JSON.stringify(state));
}

let server = null;
try {
  const probe = await fetch(BASE).catch(() => null);
  if (!probe) {
    server = spawn('npx', ['http-server', 'src', '-p', String(PORT), '-c-1'], {
      shell: true,
      stdio: 'ignore',
    });
    await wait(2500);
  }

  const browser = await chromium.launch();

  // Caso 1: sem sessões (empty state + toolbar)
  let page = await browser.newPage({ viewport: { width: 1575, height: 833 } });
  await seed(page, createE2EState());
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.click('.nav-item[data-view="historico-sessoes"]');
  await page.waitForSelector('.historico-toolbar');
  await page.screenshot({ path: 'test-results/historico-empty.png' });
  await page.close();

  // Caso 2: com sessões em dois dias
  const state = createE2EState();
  for (let i = 0; i < 4; i++) {
    state.eventos.push({
      id: `ev_shot_${i}`,
      titulo: `Sessão de validação ${i + 1}`,
      data: '2026-06-08',
      dataEstudo: i < 2 ? '2026-06-09' : '2026-06-08',
      duracao: 60,
      status: 'estudei',
      tempoAcumulado: 1800 + i * 600,
      tipo: 'conteudo',
      discId: 'disc_1',
      assId: 'ass_1',
      habito: null,
      questoes: { acertos: 6 + i, erros: 2 },
      criadoEm: '2026-06-08T12:00:00.000Z',
    });
  }
  page = await browser.newPage({ viewport: { width: 1575, height: 833 } });
  await seed(page, state);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.click('.nav-item[data-view="historico-sessoes"]');
  await page.waitForSelector('.session-history-summary');
  await page.screenshot({ path: 'test-results/historico-populated.png' });
  await page.close();

  await browser.close();
  console.log('Screenshots em test-results/historico-empty.png e historico-populated.png');
} finally {
  if (server) server.kill();
}
