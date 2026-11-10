import { expect, test } from '@playwright/test';
import { resetF7Ux, seedAcademicData } from './f7-ux-helpers';

test('f7 ux mobile exposes five primary destinations and study chooses explicitly', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetF7Ux(page);
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav.locator('.nav-list-mobile > li')).toHaveCount(5);
  await expect(nav.locator('.nav-list-mobile > li > [data-nav] .nav-label, .nav-list-mobile > li > details > summary .nav-label')).toHaveText(['Início', 'Planejamento', 'Estudar', 'Revisões', 'Mais']);

  await nav.getByRole('button', { name: 'Estudar' }).click();
  await expect(nav.getByText('Como deseja começar?')).toBeVisible();
  await nav.getByRole('link', { name: 'Início' }).click();
  await expect(nav.getByText('Como deseja começar?')).toHaveCount(0);
  await nav.getByRole('button', { name: 'Estudar' }).click();
  await expect(page.getByTestId('session-timer')).not.toBeVisible();
  await expect(page).toHaveURL(/#\/home$/);
  await nav.getByRole('link', { name: 'Abrir sessões' }).click();
  await expect(page.getByTestId('session-timer')).toBeVisible();

  await nav.getByText('Mais', { exact: true }).click();
  await nav.getByRole('link', { name: 'Configurações', exact: true }).click();
  await expect(page.locator('[data-route="settings"]')).toBeVisible();
  await expect(nav.locator('.nav-more-panel')).toBeHidden();
});

test('f7 ux desktop keeps all routes and legacy overview works', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await resetF7Ux(page);
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav.locator('a[data-nav]')).toHaveCount(9);
  await page.goto('/#/overview');
  await expect(page.locator('[data-route="overview"]')).toBeVisible();
  await expect(page.locator('#content-section')).toBeVisible();
  await expect(page.locator('#planning-section')).toBeVisible();
});

test('f7 ux rejects a missing deep entity without substituting a similar name', async ({ page }) => {
  await resetF7Ux(page);
  await page.goto('/#/sessions/session-inexistente');
  await expect(page.getByTestId('f7-route-entity-missing')).toContainText('não existe neste perfil');
  await expect(page.getByTestId('session-timer')).not.toBeVisible();
});

test('f7 ux validates the focused child against the edital route', async ({ page }) => {
  await resetF7Ux(page);
  await seedAcademicData(page);
  await page.goto('/#/content/f7ux-edital?focus=focus-inexistente');
  await expect(page.getByTestId('f7-route-entity-missing')).toContainText('não existe neste perfil');
  await expect(page.getByRole('heading', { name: /Verticalização.*TRT 2026/ })).toBeVisible();
});
