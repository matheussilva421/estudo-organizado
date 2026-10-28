import { expect, test } from '@playwright/test';

test('serves V2 on its own origin with its own storage names', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Estudo Organizado V2' })).toBeVisible();

  const origin = new URL(page.url()).origin;
  expect(origin).toBe('http://127.0.0.1:18431');

  const databases = await page.evaluate(async () => {
    if (!('databases' in indexedDB)) return [];
    return (await indexedDB.databases()).map((database) => database.name);
  });

  expect(databases).not.toContain('EstudoOrganizadoDB');
});

test('serves_a_restrictive_content_security_policy', async ({ page }) => {
  const response = await page.goto('/');
  const policy = response?.headers()['content-security-policy'] ?? '';

  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("object-src 'none'");
});
