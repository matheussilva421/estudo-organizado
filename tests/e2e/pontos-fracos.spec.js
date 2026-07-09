import { expect, test } from '@playwright/test';
import { bootE2EApp, collectConsoleErrors, createE2EState } from '../helpers/e2e-state.js';

function localDateStr(daysAgo = 0) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function buildState() {
  const state = createE2EState();
  state.editais[0].disciplinas[0].assuntos = [
    {
      id: 'ass_fraco',
      nome: 'Licitações',
      concluido: false,
      dataConclusao: null,
      revisoesFetas: [],
      adiamentos: 0,
      linkedAulaIds: [],
    },
    {
      id: 'ass_forte',
      nome: 'Atos Administrativos',
      concluido: false,
      dataConclusao: null,
      revisoesFetas: [],
      adiamentos: 0,
      linkedAulaIds: [],
    },
    {
      id: 'ass_pouco',
      nome: 'Improbidade',
      concluido: false,
      dataConclusao: null,
      revisoesFetas: [],
      adiamentos: 0,
      linkedAulaIds: [],
    },
    {
      id: 'ass_nunca',
      nome: 'Servidores Públicos',
      concluido: false,
      dataConclusao: null,
      revisoesFetas: [],
      adiamentos: 0,
      linkedAulaIds: [],
    },
  ];
  const evento = (id, assId, questoes, daysAgo) => ({
    id,
    titulo: `Sessão ${id}`,
    data: localDateStr(daysAgo),
    dataEstudo: localDateStr(daysAgo),
    duracao: 60,
    status: 'estudei',
    tempoAcumulado: 3600,
    discId: 'disc_1',
    assId,
    aulaId: null,
    sessao: { questoes },
  });
  state.eventos = [
    evento('ev_fraco', 'ass_fraco', { total: 20, acertos: 6, erros: 14 }, 3),
    evento('ev_forte', 'ass_forte', { total: 20, acertos: 18, erros: 2 }, 2),
    evento('ev_pouco', 'ass_pouco', { total: 4, acertos: 1, erros: 3 }, 1),
  ];
  return state;
}

test.describe('Aba Pontos Fracos', () => {
  test('ranqueia o pior assunto no topo, separa seções e abre o modal pré-selecionado', async ({
    page,
  }) => {
    const consoleErrors = collectConsoleErrors(page);

    await bootE2EApp(page, buildState());
    await page.waitForFunction(() => typeof window.EstudoApp?.navigate === 'function');

    await page.evaluate(() => window.EstudoApp.navigate('pontos-fracos'));
    await expect(page.locator('#topbar-title')).toHaveText('Pontos Fracos');

    const main = page.locator('#main-content');
    await expect(main).toContainText('Licitações');
    await expect(main).toContainText('Atos Administrativos');
    await expect(main).toContainText('30%');
    await expect(main).toContainText('90%');

    // pior (30%) antes do melhor (90%)
    const html = await main.innerHTML();
    expect(html.indexOf('Licitações')).toBeLessThan(html.indexOf('Atos Administrativos'));

    // seções de baixa confiabilidade
    await expect(main).toContainText('Dados insuficientes');
    await expect(main).toContainText('Improbidade');
    await expect(main).toContainText('Sem questões registradas');
    await expect(main).toContainText('Servidores Públicos');

    // ação rápida abre o modal com disciplina e assunto pré-selecionados
    await page
      .locator('button[data-action="add-evento-para-assunto"][data-assunto-id="ass_fraco"]')
      .first()
      .click();
    await expect(page.locator('#modal-event-title')).toHaveText('Iniciar Estudo');
    await expect(page.locator('#event-disc')).toHaveValue('disc_1');
    await expect(page.locator('#event-assunto')).toHaveValue('ass_fraco');

    expect(consoleErrors).toEqual([]);
  });

  test('troca de janela e filtro por disciplina re-renderizam o ranking', async ({ page }) => {
    await bootE2EApp(page, buildState());
    await page.waitForFunction(() => typeof window.EstudoApp?.navigate === 'function');
    await page.evaluate(() => window.EstudoApp.navigate('pontos-fracos'));

    const main = page.locator('#main-content');
    await expect(main).toContainText('Licitações');

    // janela "Tudo" mantém os dados (eventos recentes)
    await page.locator('button[data-action="set-pf-window"][data-days="null"]').click();
    await expect(main).toContainText('todo o histórico');
    await expect(main).toContainText('Licitações');

    // filtro por disciplina segue funcionando (única disciplina → nada some)
    await page
      .locator('select[data-action="set-pf-disc-filter"]')
      .selectOption('disc_1');
    await expect(main).toContainText('Licitações');
  });
});
