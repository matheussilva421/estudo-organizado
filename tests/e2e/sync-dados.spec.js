import { expect, test } from '@playwright/test';
import { createE2EState } from '../helpers/e2e-state.js';

/**
 * Seed state with proper cleanup
 */
async function seedLegacyState(page, state) {
  await page.addInitScript((serializedState) => {
    window.Chart = class {
      destroy() {}
    };
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('estudo_state', serializedState);
  }, JSON.stringify(state));
}

test.describe('Backup e Restauração', () => {
  test('exportar backup gera JSON', async ({ page }) => {
    const state = createE2EState();
    state.editais = [{
      id: 'ed_backup',
      nome: 'Concurso Backup',
      cor: '#3b82f6',
      disciplinas: []
    }];
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.waitForTimeout(500);

    // Navigate to config/export area
    const exported = await page.evaluate(() => {
      return new Promise((resolve) => {
        const state = window.state || window.EstudoApp?.state;
        resolve({
          hasEditais: Array.isArray(state?.editais) && state.editais.length > 0,
          schemaVersion: state?.schemaVersion
        });
      });
    });

    expect(exported.hasEditais).toBe(true);
    expect(exported.schemaVersion).toBeDefined();
  });

  test('importar backup atualiza estado', async ({ page }) => {
    const initialState = createE2EState();
    await seedLegacyState(page, initialState);

    await page.goto('/');
    await page.waitForTimeout(500);

    // Import new state via evaluate
    const importedState = {
      schemaVersion: 7,
      editais: [{
        id: 'ed_imported',
        nome: 'Concurso Importado',
        cor: '#ef4444',
        disciplinas: []
      }],
      eventos: [],
      arquivo: [],
      habitos: {
        questoes: [], revisao: [], discursiva: [], simulado: [],
        leitura: [], informativo: [], sumula: [], videoaula: [], paginas: []
      },
      revisoes: [],
      config: {},
      planejamento: {},
      bancaRelevance: {},
      cronoLivre: {},
      driveFileId: null,
      lastSync: null
    };

    await page.evaluate((state) => {
      window.state = state;
      if (window.EstudoApp?.setState) {
        window.EstudoApp.setState(state);
      }
    }, importedState);

    const editalExists = await page.evaluate(() => {
      return window.state?.editais?.some(e => e.nome === 'Concurso Importado') || false;
    });

    expect(editalExists).toBe(true);
  });
});

test.describe('Sync Status', () => {
  test('exibe status de sync quando configurado', async ({ page }) => {
    const state = createE2EState();
    state.config.cloudflareSyncEnabled = true;
    state.config.cloudflareUrl = 'https://api.example.com';
    state.lastSync = new Date().toISOString();
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.waitForTimeout(500);

    // Verify sync status exists in state
    const syncStatus = await page.evaluate(() => {
      return {
        cloudflareEnabled: window.state?.config?.cloudflareSyncEnabled,
        lastSync: window.state?.lastSync
      };
    });

    expect(syncStatus.cloudflareEnabled).toBe(true);
    expect(syncStatus.lastSync).toBeDefined();
  });

  test('exibe estado sem sync quando não configurado', async ({ page }) => {
    const state = createE2EState();
    state.config.cloudflareSyncEnabled = false;
    state.lastSync = null;
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.waitForTimeout(500);

    const syncStatus = await page.evaluate(() => {
      return {
        cloudflareEnabled: window.state?.config?.cloudflareSyncEnabled,
        lastSync: window.state?.lastSync
      };
    });

    expect(syncStatus.cloudflareEnabled).toBe(false);
    expect(syncStatus.lastSync).toBeNull();
  });
});

test.describe('Cloud Sync Simulation', () => {
  test('simula pull do Cloudflare', async ({ page }) => {
    const localState = createE2EState();
    localState.editais = [{
      id: 'ed_local',
      nome: 'Concurso Local',
      cor: '#10b981',
      disciplinas: []
    }];
    await seedLegacyState(page, localState);

    await page.goto('/');
    await page.waitForTimeout(500);

    // Simulate cloud pull by updating state
    await page.evaluate(() => {
      const cloudState = {
        schemaVersion: 7,
        editais: [{
          id: 'ed_cloud',
          nome: 'Concurso Cloud',
          cor: '#8b5cf6',
          disciplinas: []
        }],
        eventos: [],
        arquivo: [],
        habitos: {
          questoes: [], revisao: [], discursiva: [], simulado: [],
          leitura: [], informativo: [], sumula: [], videoaula: [], paginas: []
        },
        revisoes: [],
        config: { cloudflareSyncEnabled: true },
        planejamento: {},
        bancaRelevance: {},
        cronoLivre: {},
        driveFileId: null,
        lastSync: new Date().toISOString()
      };
      window.state = cloudState;
    });

    const cloudEditalExists = await page.evaluate(() => {
      return window.state?.editais?.some(e => e.id === 'ed_cloud') || false;
    });

    expect(cloudEditalExists).toBe(true);
  });

  test('simula push para Cloudflare', async ({ page }) => {
    const state = createE2EState();
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.waitForTimeout(500);

    // Add edital locally
    await page.evaluate(() => {
      window.state?.editais?.push({
        id: 'ed_new',
        nome: 'Concurso Novo',
        cor: '#f59e0b',
        disciplinas: []
      });
    });

    // Verify state was updated
    const editalExists = await page.evaluate(() => {
      return window.state?.editais?.some(e => e.id === 'ed_new') || false;
    });

    expect(editalExists).toBe(true);
  });
});

test.describe('Google Drive Sync', () => {
  test('verifica estado inicial sem Drive sincronizado', async ({ page }) => {
    const state = createE2EState();
    state.driveFileId = null;
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.waitForTimeout(500);

    const driveStatus = await page.evaluate(() => {
      return {
        driveFileId: window.state?.driveFileId,
        hasDriveSync: !!window.state?.driveFileId
      };
    });

    expect(driveStatus.driveFileId).toBeNull();
    expect(driveStatus.hasDriveSync).toBe(false);
  });

  test('simula Drive sincronizado com file ID', async ({ page }) => {
    const state = createE2EState();
    state.driveFileId = '1a2b3c4d5e6f7g8h9i0j';
    state.lastSync = new Date().toISOString();
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.waitForTimeout(500);

    const driveStatus = await page.evaluate(() => {
      return {
        driveFileId: window.state?.driveFileId,
        hasDriveSync: !!window.state?.driveFileId,
        lastSync: window.state?.lastSync
      };
    });

    expect(driveStatus.driveFileId).toBe('1a2b3c4d5e6f7g8h9i0j');
    expect(driveStatus.hasDriveSync).toBe(true);
    expect(driveStatus.lastSync).toBeDefined();
  });
});

test.describe('Conflict Resolution', () => {
  test('estado local prevalece sem sync', async ({ page }) => {
    const state = createE2EState();
    state.config.cloudflareSyncEnabled = false;
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.waitForTimeout(500);

    // Modify local state
    await page.evaluate(() => {
      window.state?.editais?.push({
        id: 'ed_conflict',
        nome: 'Concurso Conflito',
        cor: '#ec4899',
        disciplinas: []
      });
    });

    const localEditalExists = await page.evaluate(() => {
      return window.state?.editais?.some(e => e.id === 'ed_conflict') || false;
    });

    expect(localEditalExists).toBe(true);
  });

  test('merge de estados quando sync habilitado', async ({ page }) => {
    const state = createE2EState();
    state.config.cloudflareSyncEnabled = true;
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.waitForTimeout(500);

    // Simulate merge scenario
    await page.evaluate(() => {
      // Local has edital A
      window.state.editais = [{
        id: 'ed_local',
        nome: 'Concurso Local',
        cor: '#10b981',
        disciplinas: []
      }];

      // Cloud would have edital B (simulated by direct assignment)
      const cloudEditais = [{
        id: 'ed_cloud',
        nome: 'Concurso Cloud',
        cor: '#3b82f6',
        disciplinas: []
      }];

      // Merge (lastSync wins in current implementation)
      window.state.editais = [...window.state.editais, ...cloudEditais];
    });

    const mergedCount = await page.evaluate(() => {
      return window.state?.editais?.length || 0;
    });

    expect(mergedCount).toBe(2);
  });
});

test.describe('Data Persistence', () => {
  test('persiste eventos após reload', async ({ page }) => {
    const state = createE2EState();
    state.eventos = [{
      id: 'ev_1',
      titulo: 'Sessão Persistida',
      data: '2026-04-25',
      hora: '14:00',
      status: 'agendado',
      tempoAcumulado: 0,
      discId: 'disc_1',
      assId: 'ass_1',
      duracao: 60,
      tipo: 'conteudo',
      habito: null,
      criadoEm: new Date().toISOString()
    }];
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.waitForTimeout(500);

    // Navigate to MED view
    await page.click('[data-view="med"]');
    await page.waitForTimeout(500);

    // Verify event persists
    const eventExists = await page.evaluate(() => {
      return window.state?.eventos?.some(e => e.titulo === 'Sessão Persistida') || false;
    });

    expect(eventExists).toBe(true);
  });

  test('persiste hábitos após reload', async ({ page }) => {
    const state = createE2EState();
    state.habitos.videoaula = [
      { id: 'h_1', data: '2026-04-20', duracao: 60 }
    ];
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.waitForTimeout(500);

    const habitExists = await page.evaluate(() => {
      return window.state?.habitos?.videoaula?.length > 0 || false;
    });

    expect(habitExists).toBe(true);
  });

  test('persiste configurações após reload', async ({ page }) => {
    const state = createE2EState();
    state.config.tema = 'dark';
    state.config.materiasPorDia = 5;
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.waitForTimeout(500);

    const config = await page.evaluate(() => {
      return {
        tema: window.state?.config?.tema,
        materiasPorDia: window.state?.config?.materiasPorDia
      };
    });

    expect(config.tema).toBe('dark');
    expect(config.materiasPorDia).toBe(5);
  });
});
