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

test.describe('Editais e Disciplinas', () => {
  test('creates a new Edital, adds a Discipline, and manages Subjects', async ({ page }) => {
    const state = createE2EState();
    await seedLegacyState(page, state);
    await page.goto('/');

    // Go to Editais view
    await page.click('[data-view="editais"]');
    await page.waitForSelector('[data-action="open-edital-modal"]');

    // Open new Edital modal
    await page.click('[data-action="open-edital-modal"]');
    const editalModal = page.locator('#modal-edital');
    await expect(editalModal).toBeVisible();

    // Fill and save Edital
    await page.fill('#edital-nome', 'Concurso E2E 2026');
    await page.click('#modal-edital [data-action="save-edital"]');
    
    // Give time to render the new edital card
    await expect(page.locator('#main-content')).toContainText('Concurso E2E 2026');

    // Expand the newly created edital (it should be the last one, or identifiable by title)
    // The "open-disc-modal" action might need the specific edital id, but let's click the button inside the card that contains 'Concurso E2E 2026'
    const newEditalCard = page.locator('.tree-edital').filter({ hasText: 'Concurso E2E 2026' });
    await expect(newEditalCard).toBeVisible();

    // Open add discipline modal
    await newEditalCard.locator('[data-action="open-disc-modal"]').click();
    const discModal = page.locator('#modal-disc');
    await expect(discModal).toBeVisible();

    // Fill and save Discipline
    await page.fill('#disc-nome', 'Direito Cibernético');
    // Save discipline
    await page.click('#modal-disc [data-action="save-disc"]');
    
    // Check if discipline is in the list
    await expect(newEditalCard).toContainText('Direito Cibernético');

    // Open Discipline Manager to add subjects
    await newEditalCard.locator('[data-action="open-disc-manager"]').first().click({ force: true });
    const managerModal = page.locator('#modal-disc-manager');
    await expect(managerModal).toBeVisible();

    // Ensure the topicos tab is active
    await page.locator('[data-action="switch-manager-tab"][data-tab="topicos"]').click({ force: true });

    // Add multiple subjects using evaluate to bypass CSS transition visibility issues in Playwright
    await page.evaluate(() => {
        const input = document.querySelector('#new-assunto-nome');
        if (input) input.value = '1. Introdução à IA\n2. Segurança da Informação';
        const btn = document.querySelector('[data-action="add-assunto"]');
        if (btn) btn.click();
    });

    // Close manager
    await page.click('#modal-disc-manager .modal-close');

    // Verify Vertical View reflects the changes
    await page.click('[data-view="vertical"]');
    await expect(page.locator('#main-content')).toContainText('Concurso E2E 2026', { ignoreCase: true });
    await expect(page.locator('#main-content')).toContainText('Direito Cibernético', { ignoreCase: true });
    await expect(page.locator('#main-content')).toContainText('Segurança da Informação', { ignoreCase: true });
  });
});
