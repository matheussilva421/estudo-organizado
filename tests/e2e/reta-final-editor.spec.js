import { expect, test } from '@playwright/test';

function localDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

const TEXTO_LONGO =
  'Controle concentrado de constitucionalidade e seus efeitos. '.repeat(9).trim();

function editorState() {
  const hoje = localDateStr(0);
  return {
    schemaVersion: 7,
    ciclo: { ativo: false, ciclosCompletos: 0, disciplinas: [] },
    planejamento: {
      ativo: true,
      tipo: 'reta_final',
      planId: 'plan-e2e-1',
      schemaVersionRetaFinal: 2,
      revision: 2,
      updatedAt: '2026-10-20T10:00:00.000Z',
      disciplinas: ['disc_1', 'disc_2'],
      relevancia: {},
      horarios: { dataFinal: localDateStr(30) },
      materiasPorDia: 3,
      sequencia: [],
      slotOverrides: [],
      ciclosCompletos: 0,
      dataInicioCicloAtual: '2026-01-01T00:00:00.000Z',
      retaFinal: {
        nome: 'Reta Final E2E',
        dataFinal: localDateStr(30),
        minutosPadrao: 60,
        blocos: [
          {
            id: 'rf-e2e-1',
            discId: 'disc_1',
            topicos: [{ assId: 'ass_1', aulaId: null }],
            minutos: 60,
            status: 'pendente',
            ordem: 0,
            dataOriginal: hoje,
            dataPlanejada: hoje,
            data: hoje,
            rolagens: 0,
          },
          {
            id: 'rf-e2e-2',
            discId: 'disc_2',
            topicos: [{ assId: 'ass_3', aulaId: null }],
            minutos: 30,
            status: 'pendente',
            ordem: 1,
            dataOriginal: hoje,
            dataPlanejada: hoje,
            data: hoje,
            rolagens: 0,
          },
          {
            id: 'rf-e2e-3',
            discId: 'disc_1',
            topicos: [{ assId: 'ass_2', aulaId: null }],
            minutos: 45,
            status: 'pendente',
            ordem: 2,
            dataOriginal: hoje,
            dataPlanejada: hoje,
            data: hoje,
            rolagens: 0,
          },
        ],
      },
    },
    editais: [
      {
        id: 'ed_1',
        nome: 'Concurso E2E',
        cor: '#0f766e',
        disciplinas: [
          {
            id: 'disc_1',
            nome: 'Direito Constitucional',
            icone: '📚',
            cor: '#0f766e',
            assuntos: [
              { id: 'ass_1', nome: TEXTO_LONGO },
              { id: 'ass_2', nome: '<script>window.__rfXss = 1</script>' },
            ],
            aulas: [],
          },
          {
            id: 'disc_2',
            nome: 'Direito Penal',
            icone: '⚖️',
            cor: '#b91c1c',
            assuntos: [{ id: 'ass_3', nome: 'Crimes contra a vida' }],
            aulas: [],
          },
        ],
      },
    ],
    eventos: [],
    arquivo: [],
    habitos: {
      questoes: [],
      revisao: [],
      discursiva: [],
      simulado: [],
      leitura: [],
      informativo: [],
      sumula: [],
      videoaula: [],
      paginas: [],
    },
    revisoes: [],
    config: {
      visualizacao: 'mes',
      primeirodiaSemana: 1,
      mostrarNumeroSemana: false,
      agruparEventos: true,
      frequenciaRevisao: [1, 7, 30, 90],
      materiasPorDia: 3,
      globalSyncPaused: true,
      metas: { horasSemana: 10, questoesSemana: 50 },
    },
    cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
    bancaRelevance: { hotTopics: [], userMappings: {}, lessonMappings: {} },
    driveFileId: null,
    lastSync: null,
  };
}

async function bootEditor(page) {
  await page.addInitScript((state) => {
    window.Chart = class {
      destroy() {}
    };
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('estudo_state', JSON.stringify(state));
  }, editorState());
  await page.goto('/');
  await page.click('[data-view="ciclo"]');
  await expect(page.locator('[data-action="rf-open-detail"]').first()).toBeVisible();
}

test.describe('Reta Final — editor inteligente', () => {
  test('abre o assunto completo, escapa HTML e fecha com Escape', async ({ page }) => {
    await bootEditor(page);
    await page.locator('[data-action="rf-open-detail"]').first().click();
    const panel = page.locator('[data-rf-detail-panel]');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(TEXTO_LONGO);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    expect(await page.evaluate(() => window.__rfXss)).toBeUndefined();
  });

  test('persiste a edição no rascunho após reload sem tocar no plano oficial', async ({ page }) => {
    await bootEditor(page);
    await page.locator('[data-action="rf-open-detail"]').first().click();
    await page.locator('[data-action="rf-open-editor"]').click();
    const minutos = page.locator('input[name="minutos"]');
    await expect(minutos).toHaveValue('60');
    await minutos.fill('75');
    await page.locator('[data-action="rf-editor-save"]').click();
    await expect(page.locator('.toast')).toContainText('Rascunho salvo');
    await page.reload();
    await page.click('[data-view="ciclo"]');
    await page.locator('[data-action="rf-open-detail"]').first().click();
    await page.locator('[data-action="rf-open-editor"]').click();
    await expect(page.locator('input[name="minutos"]')).toHaveValue('75');
    await expect(page.locator('[data-kpi="horas"]')).toContainText('2,3h');
  });

  test('seleciona apenas os visíveis sob filtro e expande para todo o cronograma', async ({ page }) => {
    await bootEditor(page);
    await page.locator('[data-action="rf-open-planner"]').click();
    const planner = page.locator('[data-rf-planner]');
    await expect(planner).toBeVisible();
    await page.selectOption('[data-action="rf-plan-filter"][data-field="discId"]', 'disc_1');
    await expect(page.locator('[data-rf-plan-count]')).toHaveText('2 selecionado(s)');
    await page.locator('[data-action="rf-plan-select-all"]').click();
    await expect(page.locator('[data-rf-plan-count]')).toHaveText('3 selecionado(s)');
  });
});
