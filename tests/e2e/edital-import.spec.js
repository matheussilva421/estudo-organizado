import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { bootE2EApp, createE2EState, flushSaveAndReload } from '../helpers/e2e-state.js';

const offlineTest = test.extend({});
offlineTest.use({ serviceWorkers: 'allow' });

function editalPayload(overrides = {}) {
  return {
    tipo: 'edital',
    versao: 1,
    nome: 'Concurso TRF',
    sourceRef: 'central:trf-2026',
    sourceRevision: '2026.1',
    disciplinas: [
      {
        nome: 'Direito Constitucional',
        topicos: [{ nome: 'Controle de Constitucionalidade' }],
        aulas: [{ nome: 'Aula 01 — Constituição' }],
      },
    ],
    ...overrides,
  };
}

function withCompletedProgress() {
  const state = createE2EState();
  state.editais[0].nome = 'Concurso TRF';
  state.editais[0].importMetadata = {
    tipo: 'edital',
    sourceRef: 'central:trf-2026',
    sourceRevision: '2025.4',
    fingerprint: 'edital:v1|sourceRef:central:trf-2026',
  };
  state.editais[0].disciplinas[0].assuntos[0] = {
    id: 'ass_done',
    nome: 'Controle de Constitucionalidade',
    concluido: true,
    dataConclusao: '2026-09-10',
    revisoesFetas: ['2026-09-11', '2026-09-17'],
    adiamentos: 2,
    linkedAulaIds: ['aula_studied'],
    anotacoes: 'Resumo feito pelo usuário',
  };
  state.editais[0].disciplinas[0].aulas = [
    {
      id: 'aula_studied',
      nome: 'Aula 01 — Constituição',
      descricao: 'Anotações locais',
      estudada: true,
      dataEstudo: '2026-09-09',
      progress: 100,
      linkedAssuntoIds: ['ass_done'],
    },
  ];
  state.eventos = [{ id: 'ev_keep', titulo: 'Sessão local', data: '2026-10-04' }];
  state.arquivo = [{ id: 'hist_keep', titulo: 'Histórico preservado' }];
  state.habitos.questoes = [{ id: 'habit_keep', data: '2026-10-04', valor: 25 }];
  state.revisoes = [{ id: 'review_keep', assuntoId: 'ass_done', data: '2026-10-08' }];
  state.config.testPreference = 'preservar';
  return state;
}

async function startApp(page, state = createE2EState()) {
  await bootE2EApp(page, state);
  await expect(page.locator('#topbar-title')).toBeVisible();
  await page.evaluate(() => window.EstudoApp.navigate('editais'));
  await expect(page.locator('[data-action="open-edital-import"]').first()).toBeVisible();
}

async function uploadPayload(page, payload) {
  await page.locator('[data-action="open-edital-import"]').first().click();
  const fileInput = page.locator('input[type="file"][accept=".json"]').last();
  await expect(fileInput).toHaveCount(1);
  await fileInput.setInputFiles({
    name: 'edital.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload), 'utf8'),
  });
  await expect(page.locator('#modal-prompt')).toBeVisible();
}

async function chooseCreate(page, makePrincipal = false) {
  await page.locator('[data-import-mode="create"]').check();
  const principal = page.locator('[data-import-make-principal]');
  if (makePrincipal) await principal.check();
  await expect(page.locator('#modal-prompt-save')).toBeEnabled();
}

async function chooseMerge(page, editalId = 'ed_1') {
  await page.locator('[data-import-mode="merge"]').check();
  await page.locator('[data-import-target]').selectOption(editalId);
  await expect(page.locator('#modal-prompt-save')).toBeEnabled();
}

async function readState(page) {
  return page.evaluate(() => structuredClone(window.EstudoApp.state));
}

function protectedSnapshot(state) {
  const snapshot = structuredClone(state);
  delete snapshot.editais;
  if (snapshot.config) {
    delete snapshot.config.localBackupAt;
    delete snapshot.config.syncPerformance;
  }
  return snapshot;
}

async function confirmImport(page) {
  await page.locator('#modal-prompt-save').click();
  await expect(page.locator('#modal-prompt')).toBeHidden();
  await expect(page.locator('#toast-container')).toContainText(/sucesso/i);
}

test.describe('Importação especializada de edital JSON', () => {
  test('exige preview e escolha explícita sem mutar estado antes da confirmação', async ({ page }) => {
    const state = createE2EState();
    await startApp(page, state);
    const before = await readState(page);

    await uploadPayload(page, editalPayload());
    await expect(page.locator('#modal-prompt-save')).toBeDisabled();
    await chooseCreate(page);

    expect(protectedSnapshot(await readState(page))).toEqual(protectedSnapshot(before));
    expect((await readState(page)).editais).toEqual(before.editais);
    await expect(page.locator('#modal-prompt-body')).toContainText('Itens reutilizados mantêm');
  });

  test('cria arquivado por padrão e mantém o edital principal após reload', async ({ page }) => {
    await startApp(page);
    await uploadPayload(page, editalPayload({ nome: 'TRF Novo' }));
    await chooseCreate(page);
    await confirmImport(page);

    let current = await readState(page);
    expect(current.editais).toHaveLength(2);
    expect(current.editais[0]).toMatchObject({ id: 'ed_1', arquivado: false });
    expect(current.editais[1]).toMatchObject({ nome: 'TRF Novo', arquivado: true });
    await flushSaveAndReload(page);
    current = await readState(page);
    expect(current.editais.map(({ nome, arquivado }) => ({ nome, arquivado }))).toEqual([
      { nome: 'Concurso TRF', arquivado: false },
      { nome: 'TRF Novo', arquivado: true },
    ]);
  });

  test('promove o edital novo quando marcado e arquiva o principal anterior', async ({ page }) => {
    await startApp(page);
    await uploadPayload(page, editalPayload({ nome: 'TRF Principal Novo' }));
    await chooseCreate(page, true);
    await confirmImport(page);

    const current = await readState(page);
    expect(current.editais[0]).toMatchObject({ id: 'ed_1', arquivado: true });
    expect(current.editais[1]).toMatchObject({ nome: 'TRF Principal Novo', arquivado: false });
    expect(current.editais.filter(({ arquivado }) => arquivado !== true)).toHaveLength(1);
  });

  test('força o novo edital como principal quando não há edital ativo', async ({ page }) => {
    const state = createE2EState();
    state.editais[0].arquivado = true;
    state.editais[0].arquivadoEm = '2026-09-01T00:00:00.000Z';
    await startApp(page, state);
    await uploadPayload(page, editalPayload({ nome: 'TRF Único' }));
    await chooseCreate(page);

    const principal = page.locator('[data-import-make-principal]');
    await expect(principal).toBeChecked();
    await expect(principal).toBeDisabled();
    await confirmImport(page);

    const current = await readState(page);
    expect(current.editais.filter(({ arquivado }) => arquivado !== true)).toHaveLength(1);
    expect(current.editais[1]).toMatchObject({ nome: 'TRF Único', arquivado: false });
  });

  test('merge parcial mantém progresso concluído e altera somente editais', async ({ page }) => {
    const state = withCompletedProgress();
    await startApp(page, state);
    const before = await readState(page);
    const protectedBefore = protectedSnapshot(before);
    const payload = editalPayload({
      disciplinas: [
        {
          nome: 'Direito Constitucional',
          topicos: [
            { nome: 'Controle de Constitucionalidade' },
            { nome: 'Novo Controle' },
          ],
          aulas: [
            { nome: 'Aula 01 — Constituição' },
            { nome: 'Aula Nova' },
          ],
        },
      ],
    });

    await uploadPayload(page, payload);
    await chooseMerge(page);
    await expect(page.locator('#modal-prompt-body')).toContainText('1 reutilizada');
    await expect(page.locator('#modal-prompt-body')).toContainText('1 novo');
    await confirmImport(page);

    let current = await readState(page);
    const discipline = current.editais[0].disciplinas[0];
    expect(discipline.assuntos).toHaveLength(2);
    expect(discipline.aulas).toHaveLength(2);
    expect(discipline.assuntos[0]).toEqual(before.editais[0].disciplinas[0].assuntos[0]);
    expect(discipline.aulas[0]).toEqual(before.editais[0].disciplinas[0].aulas[0]);
    expect(protectedSnapshot(current)).toEqual(protectedBefore);

    await flushSaveAndReload(page);
    current = await readState(page);
    expect(protectedSnapshot(current)).toEqual(protectedBefore);
    expect(current.editais[0].disciplinas[0].assuntos[0]).toEqual(before.editais[0].disciplinas[0].assuntos[0]);
    expect(current.editais[0].disciplinas[0].aulas[0]).toEqual(before.editais[0].disciplinas[0].aulas[0]);
    expect(current.editais[0].disciplinas[0].assuntos.map(({ nome }) => nome)).toContain('Novo Controle');
    expect(current.editais[0].disciplinas[0].aulas.map(({ nome }) => nome)).toContain('Aula Nova');
  });

  test('duplicidade de disciplina sinaliza conflito e cria outra sem tocar nas existentes', async ({ page }) => {
    const state = createE2EState();
    state.editais[0].nome = 'Concurso TRF';
    state.editais[0].disciplinas.push({
      id: 'disc_duplicate',
      nome: 'Direito Constitucional',
      icone: '⚖️',
      cor: '#123456',
      assuntos: [{ id: 'ass_duplicate', nome: 'Anotação antiga', concluido: true }],
      aulas: [],
    });
    await startApp(page, state);
    const existing = (await readState(page)).editais[0].disciplinas;
    await uploadPayload(page, editalPayload());
    await chooseMerge(page);

    await expect(page.locator('.edital-import-badge--conflict')).toContainText('Conflito: criar novo');
    await confirmImport(page);

    const current = await readState(page);
    expect(current.editais[0].disciplinas).toHaveLength(3);
    expect(current.editais[0].disciplinas.slice(0, 2)).toEqual(existing);
    expect(current.editais[0].disciplinas[2].nome).toBe('Direito Constitucional');
    expect(current.editais[0].disciplinas[2].assuntos[0].concluido).toBe(false);
  });

  test('schema inválido mostra erro e não altera estado', async ({ page }) => {
    await startApp(page);
    const before = await readState(page);
    await page.locator('[data-action="open-edital-import"]').first().click();
    const fileInput = page.locator('input[type="file"][accept=".json"]').last();
    await fileInput.setInputFiles({
      name: 'invalid-edital.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ ...editalPayload(), versao: 2 }), 'utf8'),
    });

    await expect(page.locator('#toast-container')).toContainText('JSON de edital inválido');
    await expect(page.locator('#modal-prompt')).toBeHidden();
    const current = await readState(page);
    expect(current.editais).toEqual(before.editais);
    expect(protectedSnapshot(current)).toEqual(protectedSnapshot(before));
  });

  test('merge repetido é idempotente, mostra revisões e Criar novo permite duplicata', async ({ page }) => {
    const state = withCompletedProgress();
    const payloadV1 = editalPayload({
      disciplinas: [
        {
          nome: 'Direito Constitucional',
          topicos: [
            { nome: 'Controle de Constitucionalidade' },
            { nome: 'Novo Controle' },
          ],
          aulas: [
            { nome: 'Aula 01 — Constituição' },
            { nome: 'Aula Nova' },
          ],
        },
      ],
    });
    await startApp(page, state);
    await uploadPayload(page, payloadV1);
    await chooseMerge(page);
    await confirmImport(page);

    const afterFirstMerge = await readState(page);
    const firstDiscipline = afterFirstMerge.editais[0].disciplinas[0];
    const firstCounts = {
      editais: afterFirstMerge.editais.length,
      disciplinas: afterFirstMerge.editais[0].disciplinas.length,
      assuntos: firstDiscipline.assuntos.length,
      aulas: firstDiscipline.aulas.length,
    };

    const payloadV2 = { ...payloadV1, sourceRevision: '2026.2' };
    await uploadPayload(page, payloadV2);
    await expect(page.locator('[data-import-provenance]')).toContainText('Anterior: 2026.1');
    await expect(page.locator('[data-import-provenance]')).toContainText('Atual: 2026.2');
    await chooseMerge(page);
    await confirmImport(page);

    let current = await readState(page);
    expect({
      editais: current.editais.length,
      disciplinas: current.editais[0].disciplinas.length,
      assuntos: current.editais[0].disciplinas[0].assuntos.length,
      aulas: current.editais[0].disciplinas[0].aulas.length,
    }).toEqual(firstCounts);
    expect(current.editais[0].importMetadata.sourceRevision).toBe('2026.2');

    await uploadPayload(page, payloadV2);
    await chooseCreate(page);
    await confirmImport(page);
    current = await readState(page);
    expect(current.editais).toHaveLength(firstCounts.editais + 1);
    expect(current.editais.at(-1)).toMatchObject({ nome: 'Concurso TRF', arquivado: true });

    await flushSaveAndReload(page);
    current = await readState(page);
    expect(current.editais).toHaveLength(firstCounts.editais + 1);
    expect(current.editais[0].importMetadata.sourceRevision).toBe('2026.2');
  });
});

offlineTest('importa e salva localmente mesmo depois de ficar offline', async ({ page, context }) => {
  await startApp(page);
  const serviceWorkerReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    await navigator.serviceWorker.ready;
    return true;
  });
  expect(serviceWorkerReady).toBe(true);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);

  try {
    await page.evaluate(() => window.EstudoApp.navigate('editais'));
    await uploadPayload(page, editalPayload({ nome: 'TRF Offline Local' }));
    await chooseCreate(page);
    await confirmImport(page);
    const current = await readState(page);
    expect(current.editais.at(-1)).toMatchObject({ nome: 'TRF Offline Local', arquivado: true });
    await page.evaluate(async () => window.EstudoApp.saveStateToDB());
  } finally {
    await context.setOffline(false);
  }

  await page.reload();
  const persisted = await readState(page);
  expect(persisted.editais.at(-1)).toMatchObject({ nome: 'TRF Offline Local', arquivado: true });
});
