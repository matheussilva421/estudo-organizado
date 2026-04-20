import { expect, test } from '@playwright/test';

test('debug navigation', async ({ page }) => {
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));

  // Seed state
  const state = {
    schemaVersion: 7,
    editais: [{
      id: 'ed_1',
      nome: 'Concurso TRF',
      cor: '#10b981',
      disciplinas: [{
        id: 'disc_1',
        nome: 'Direito Constitucional',
        icone: '📚',
        cor: '#10b981',
        assuntos: [{ id: 'ass_1', nome: 'Controle', concluido: false }],
        aulas: []
      }]
    }],
    eventos: [],
    habitos: { questoes: [], revisao: [], discursiva: [], simulado: [], leitura: [], informativo: [], sumula: [], videoaula: [], paginas: [] },
    config: { tema: 'dark' }
  };

  await page.addInitScript((serializedState) => {
    window.Chart = class { destroy() {} };
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('estudo_state', serializedState);
  }, JSON.stringify(state));

  await page.goto('/');
  await page.waitForTimeout(3000);

  // Check initial state
  let title = await page.locator('#topbar-title').textContent();
  console.log('INITIAL TITLE:', title);

  // Try direct navigation via window.EstudoApp
  await page.evaluate(() => {
    console.log('Calling window.EstudoApp.navigate("editais")');
    window.EstudoApp?.navigate?.('editais');
  });

  await page.waitForTimeout(2000);

  title = await page.locator('#topbar-title').textContent();
  console.log('TITLE AFTER NAVIGATE:', title);

  const content = await page.locator('#main-content').innerHTML();
  console.log('CONTENT:', content.substring(0, 300));

  expect(title).toContain('Editais');
});
