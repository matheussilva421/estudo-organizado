import { expect, test } from '@playwright/test';

test('f7 settings exposes discrete cloud states without implicit actions', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Perfil e conexão' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar com Google' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Criar backup agora' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Restaurar com prévia' })).toBeDisabled();
  await expect(page.getByText('Estudo local')).toBeVisible();
});
