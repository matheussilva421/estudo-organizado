import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}/src/index.html`;
const OUTPUT_DIR = 'screenshots/main-tabs';

const tabs = [
  { view: 'home', file: '01-home.png' },
  { view: 'med', file: '02-study-organizer.png' },
  { view: 'cronometro', file: '03-cronometro.png' },
  { view: 'calendar', file: '04-calendario.png' },
  { view: 'ciclo', file: '05-ciclo-de-estudos.png' },
  { view: 'dashboard', file: '06-dashboard.png' },
  { view: 'revisoes', file: '07-revisoes.png' },
  { view: 'historico-sessoes', file: '08-historico.png' },
  { view: 'habitos', file: '09-habitos.png' },
  { view: 'editais', file: '10-editais.png' },
  { view: 'vertical', file: '11-edital-verticalizado.png' },
  { view: 'banca-analyzer', file: '12-inteligencia-de-banca.png' },
  { view: 'config', file: '13-configuracoes.png' },
];

const server = spawn('npx', ['http-server', '.', '-p', String(PORT), '-s'], { stdio: 'ignore' });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  await wait(1200);
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    defaultViewport: { width: 1600, height: 1000 },
    headless: true,
  });

  const page = await browser.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#main-content', { timeout: 10_000 });

  for (const tab of tabs) {
    const selector = `.nav-item[data-view="${tab.view}"]`;
    const el = await page.$(selector);
    if (!el) continue;
    await el.click();
    await wait(900);
    await page.screenshot({ path: `${OUTPUT_DIR}/${tab.file}`, fullPage: true });
  }

  await browser.close();
  console.log(`Screenshots saved to ${OUTPUT_DIR}`);
} finally {
  server.kill('SIGTERM');
}
