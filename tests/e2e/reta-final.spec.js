import { expect, test } from '@playwright/test';
import { createE2EState } from '../helpers/e2e-state.js';

function serializeState(state) {
  return JSON.stringify(state);
}

async function seedLegacyState(page, state) {
  await page.addInitScript((serializedState) => {
    window.Chart = class {
      destroy() {}
    };

    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('estudo_state', serializedState);
  }, serializeState(state));
}

function localDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function retaFinalPayload() {
  return {
    versao: 1,
    nome: 'Reta Final E2E',
    dataFinal: localDateStr(30),
    minutosPadrao: 60,
    dias: [
      {
        data: localDateStr(0),
        blocos: [
          {
            disciplina: 'Direito Constitucional',
            topicos: ['Controle de Constitucionalidade'],
            minutos: 90,
          },
          { disciplina: 'Português', topicos: ['Crase'] },
        ],
      },
      {
        data: localDateStr(1),
        blocos: [{ disciplina: 'Direito Constitucional', topicos: ['Poder Constituinte'] }],
      },
    ],
  };
}

function retaFinalPlan({ blocos, dataFinal = localDateStr(30) }) {
  return {
    ativo: true,
    tipo: 'reta_final',
    disciplinas: ['disc_1'],
    relevancia: {},
    horarios: { dataFinal },
    materiasPorDia: 3,
    sequencia: [],
    slotOverrides: [],
    ciclosCompletos: 0,
    dataInicioCicloAtual: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    retaFinal: {
      nome: 'Reta Final E2E',
      dataFinal,
      minutosPadrao: 60,
      importadoEm: '2026-01-01T00:00:00.000Z',
      blocos,
    },
  };
}

test.describe('Reta Final', () => {
  test('importa JSON com preview e ativa o plano', async ({ page }) => {
    await seedLegacyState(page, createE2EState());
    await page.goto('/');
    await page.click('[data-view="ciclo"]');

    await page.locator('[data-action="open-reta-final-import"]').dispatchEvent('click');
    const fileInput = page.locator('input[type="file"][accept=".json"]').last();
    await fileInput.setInputFiles({
      name: 'reta-final.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(retaFinalPayload()), 'utf8'),
    });

    // Preview: casados × criados
    const modal = page.locator('#modal-prompt');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Reta Final E2E');
    await expect(modal).toContainText('Direito Constitucional');
    await expect(modal).toContainText('casado');
    await expect(modal).toContainText('será criado');

    await page.click('#modal-prompt-save');
    await expect(page.locator('#toast-container')).toContainText('Reta Final ativada');

    // View da reta final
    await expect(page.locator('#main-content')).toContainText('Cronograma dia a dia');
    await expect(page.locator('#main-content')).toContainText('Direito Constitucional');

    // Estado: plano trocado, disciplina criada, eventos materializados
    const snapshot = await page.evaluate(() => ({
      tipo: window.EstudoApp.state.planejamento.tipo,
      blocos: window.EstudoApp.state.planejamento.retaFinal.blocos.length,
      rfEventos: window.EstudoApp.state.eventos.filter((e) => e.rfBlocoId).length,
      portugues: window.EstudoApp.state.editais.some((ed) =>
        (ed.disciplinas || []).some((d) => d.nome === 'Português')
      ),
    }));
    expect(snapshot.tipo).toBe('reta_final');
    expect(snapshot.blocos).toBe(3);
    expect(snapshot.rfEventos).toBe(3);
    expect(snapshot.portugues).toBe(true);
  });

  test('bloco de ontem rola para hoje no boot (empilha no dia seguinte)', async ({ page }) => {
    const state = createE2EState();
    state.planejamento = retaFinalPlan({
      blocos: [
        {
          id: 'rf_ontem',
          data: localDateStr(-1),
          dataOriginal: localDateStr(-1),
          discId: 'disc_1',
          topicos: [{ assId: 'ass_1', aulaId: null }],
          minutos: 60,
          status: 'pendente',
          rolagens: 0,
        },
        {
          id: 'rf_hoje',
          data: localDateStr(0),
          dataOriginal: localDateStr(0),
          discId: 'disc_1',
          topicos: [{ assId: 'ass_1', aulaId: null }],
          minutos: 45,
          status: 'pendente',
          rolagens: 0,
        },
      ],
    });

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="ciclo"]');

    await expect(page.locator('#main-content')).toContainText('rolado de');

    const blocos = await page.evaluate(() =>
      window.EstudoApp.state.planejamento.retaFinal.blocos.map((b) => ({
        id: b.id,
        data: b.data,
        rolagens: b.rolagens,
      }))
    );
    const rolado = blocos.find((b) => b.id === 'rf_ontem');
    expect(rolado.data).toBe(localDateStr(0));
    expect(rolado.rolagens).toBe(1);
    // empilha DEPOIS do bloco que já era de hoje
    expect(blocos.map((b) => b.id)).toEqual(['rf_hoje', 'rf_ontem']);
  });

  test('quick-mark conclui o bloco e registra sessão de hoje com título com tópico', async ({
    page,
  }) => {
    const state = createE2EState();
    state.planejamento = retaFinalPlan({
      blocos: [
        {
          id: 'rf_hoje',
          data: localDateStr(0),
          dataOriginal: localDateStr(0),
          discId: 'disc_1',
          topicos: [{ assId: 'ass_1', aulaId: null }],
          minutos: 90,
          status: 'pendente',
          rolagens: 0,
        },
      ],
    });

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="ciclo"]');

    // O bloco pendente de hoje aparece no Foco de Hoje e no cronograma —
    // o escopo pelo Foco declara qual instância do botão o teste exercita.
    await page.locator('.rf-foco-card [data-action="rf-quick-mark"]').dispatchEvent('click');

    await expect(page.locator('#toast-container')).toContainText('marcado como estudado');
    await expect(page.locator('#main-content')).toContainText('concluído');

    const snapshot = await page.evaluate(() => {
      const ev = window.EstudoApp.state.eventos.find((e) => e.rfBlocoId === 'rf_hoje');
      return {
        bloco: window.EstudoApp.state.planejamento.retaFinal.blocos[0].status,
        status: ev?.status,
        dataEstudo: ev?.dataEstudo,
        titulo: ev?.titulo,
        topicos: ev?.sessao?.topicos?.length,
        eventosDoBloco: window.EstudoApp.state.eventos.filter((e) => e.rfBlocoId === 'rf_hoje')
          .length,
      };
    });
    expect(snapshot.bloco).toBe('concluido');
    expect(snapshot.status).toBe('estudei');
    expect(snapshot.dataEstudo).toBe(localDateStr(0));
    expect(snapshot.titulo).toBe('Direito Constitucional — Controle de Constitucionalidade');
    expect(snapshot.topicos).toBe(1);
    expect(snapshot.eventosDoBloco).toBe(1);

    // Resumo avança: 1/1 blocos da disciplina
    await expect(page.locator('#main-content')).toContainText('1/1 blocos');
  });

  test('associar sessão do histórico conclui bloco preservando a data real', async ({ page }) => {
    const state = createE2EState();
    state.planejamento = retaFinalPlan({
      blocos: [
        {
          id: 'rf_atrasado',
          data: localDateStr(0),
          dataOriginal: localDateStr(-2),
          discId: 'disc_1',
          topicos: [{ assId: 'ass_1', aulaId: null }],
          minutos: 60,
          status: 'pendente',
          rolagens: 1,
        },
      ],
    });
    state.eventos = [
      {
        id: 'ev_fora',
        titulo: 'Sessão por fora',
        data: localDateStr(-2),
        dataEstudo: localDateStr(-2),
        status: 'estudei',
        tempoAcumulado: 50 * 60,
        discId: 'disc_1',
        assId: 'ass_1',
        criadoEm: '2026-01-01T00:00:00.000Z',
      },
    ];

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="ciclo"]');

    await page
      .locator('.rf-foco-card [data-action="rf-associar-historico"]')
      .dispatchEvent('click');
    const modal = page.locator('#modal-prompt');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Sessão por fora');

    await modal.locator('[data-associar-evento-id="ev_fora"]').dispatchEvent('click');

    await expect(page.locator('#toast-container')).toContainText('Sessão associada');
    await expect(page.locator('#main-content')).toContainText('concluído');

    const snapshot = await page.evaluate(() => {
      const ev = window.EstudoApp.state.eventos.find((e) => e.id === 'ev_fora');
      return {
        bloco: window.EstudoApp.state.planejamento.retaFinal.blocos[0].status,
        rfBlocoId: ev?.rfBlocoId,
        dataEstudo: ev?.dataEstudo,
        agendadosDoBloco: window.EstudoApp.state.eventos.filter(
          (e) => e.rfBlocoId === 'rf_atrasado' && e.status === 'agendado'
        ).length,
      };
    });
    expect(snapshot.bloco).toBe('concluido');
    expect(snapshot.rfBlocoId).toBe('rf_atrasado');
    expect(snapshot.dataEstudo).toBe(localDateStr(-2));
    expect(snapshot.agendadosDoBloco).toBe(0);
  });

  test('hero da Página Inicial mostra o próximo bloco da Reta Final', async ({ page }) => {
    const state = createE2EState();
    state.planejamento = retaFinalPlan({
      blocos: [
        {
          id: 'rf_hoje',
          data: localDateStr(0),
          dataOriginal: localDateStr(0),
          discId: 'disc_1',
          topicos: [{ assId: 'ass_1', aulaId: null }],
          minutos: 90,
          status: 'pendente',
          rolagens: 0,
        },
      ],
    });

    await seedLegacyState(page, state);
    await page.goto('/');

    const hero = page.locator('.dash-hero-suggestion');
    await expect(hero).toContainText('PRÓXIMA AÇÃO');
    await expect(hero).toContainText('Direito Constitucional');
    await expect(hero).toContainText('Controle de Constitucionalidade');
    await expect(hero).toContainText('Reta Final');
  });

  test('pós-dataFinal restaura o planejamento arquivado', async ({ page }) => {
    const state = createE2EState();
    state.planejamento = retaFinalPlan({
      dataFinal: localDateStr(-1),
      blocos: [
        {
          id: 'rf_perdido',
          data: localDateStr(-2),
          dataOriginal: localDateStr(-2),
          discId: 'disc_1',
          topicos: [{ assId: 'ass_1', aulaId: null }],
          minutos: 60,
          status: 'pendente',
          rolagens: 0,
        },
      ],
    });
    state.planejamentoArquivado = {
      plan: {
        ativo: true,
        tipo: 'ciclo',
        disciplinas: ['disc_1'],
        relevancia: {},
        horarios: { horasSemanais: 10 },
        materiasPorDia: 3,
        sequencia: [
          {
            id: 'seq_1',
            discId: 'disc_1',
            minutosAlvo: 60,
            concluido: false,
            status: 'pendente',
          },
        ],
        slotOverrides: [],
        ciclosCompletos: 1,
        dataInicioCicloAtual: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      arquivadoEm: '2026-01-02T00:00:00.000Z',
    };

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="ciclo"]');

    // Banner pós-prova + bloco perdido vira "não coberto"
    await expect(page.locator('#main-content')).toContainText('Reta Final encerrada');
    await expect(page.locator('#main-content')).toContainText('Não cobertos');

    await page
      .locator('.rf-banner [data-action="restaurar-planejamento-arquivado"]')
      .dispatchEvent('click');
    await page.click('#confirm-ok-btn');

    await expect(page.locator('#toast-container')).toContainText('restaurado');
    await expect(page.locator('#main-content')).toContainText('Sequência dos Estudos');

    const snapshot = await page.evaluate(() => ({
      tipo: window.EstudoApp.state.planejamento.tipo,
      arquivado: window.EstudoApp.state.planejamentoArquivado,
    }));
    expect(snapshot.tipo).toBe('ciclo');
    expect(snapshot.arquivado).toBeNull();
  });
});
