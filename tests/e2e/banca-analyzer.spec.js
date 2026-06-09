import { expect, test } from '@playwright/test';
import { createE2EState, seedE2EState } from '../helpers/e2e-state.js';

// Regressão dos fluxos de select do Analisador de Banca que ficaram quebrados
// até o PR #76 (handlers recebiam o elemento em vez do valor): trocar edital,
// filtrar por disciplina e abrir uma análise salva.

function buildBancaState() {
  const state = createE2EState();
  state.editais[0].disciplinas[0].assuntos.push({
    id: 'ass_df',
    nome: 'Direitos Fundamentais',
    concluido: false,
    dataConclusao: null,
    revisoesFetas: [],
    adiamentos: 0,
    linkedAulaIds: [],
  });
  state.editais.push({
    id: 'ed_2',
    nome: 'Concurso PF',
    cor: '#b45309',
    disciplinas: [
      {
        id: 'disc_pf',
        nome: 'Informática',
        icone: '💻',
        cor: '#b45309',
        assuntos: [
          {
            id: 'ass_redes',
            nome: 'Redes de Computadores',
            concluido: false,
            dataConclusao: null,
            revisoesFetas: [],
            adiamentos: 0,
            linkedAulaIds: [],
          },
        ],
        aulas: [],
      },
    ],
  });
  state.bancaRelevance = {
    hotTopics: [
      { disciplinaId: 'disc_1', nome: 'Controle de Constitucionalidade', rank: 1, weight: 30 },
      { disciplinaId: 'disc_1', nome: 'Direitos Fundamentais', rank: 2, weight: 20 },
    ],
  };
  return state;
}

test.describe('Analisador de Banca — fluxos de select', () => {
  test.beforeEach(async ({ page }) => {
    await seedE2EState(page, buildBancaState());
    await page.goto('/');
    await page.click('[data-view="banca-analyzer"]');
    await expect(page.locator('#banca-edital-select')).toBeVisible();
  });

  test('trocar o edital no select recarrega o analisador para o edital escolhido', async ({ page }) => {
    await page.selectOption('#banca-edital-select', 'ed_2');

    // O conteúdo re-renderiza com o edital novo selecionado e as disciplinas dele.
    await expect(page.locator('#banca-edital-select')).toHaveValue('ed_2');
    await expect(page.locator('#banca-disc-select option[value="disc_pf"]')).toHaveCount(1);
    await expect(page.locator('#banca-disc-select option[value="disc_1"]')).toHaveCount(0);
  });

  test('filtrar por disciplina com análise salva mostra os hot topics dela', async ({ page }) => {
    await page.selectOption('#banca-disc-select', 'disc_1');

    await expect(page.locator('#main-content')).toContainText('Controle de Constitucionalidade');
    await expect(page.locator('#main-content')).toContainText('Direitos Fundamentais');
  });

  test('abrir uma análise salva preenche o textarea e aplica o filtro', async ({ page }) => {
    const saved = page.locator('[data-action="carregar-analise-banca"]').first();
    await expect(saved).toBeVisible();
    await saved.click();

    await expect(page.locator('#banca-input-text')).toHaveValue(/Controle de Constitucionalidade/);
    await expect(page.locator('#banca-disc-select')).toHaveValue('disc_1');
  });
});
