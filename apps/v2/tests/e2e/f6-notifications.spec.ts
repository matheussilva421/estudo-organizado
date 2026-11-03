import { expect, test } from '@playwright/test';

const BASE = 'http://127.0.0.1:18431';

test('f6 attention reflects notification permission and opt-in state', async ({ browser }) => {
  const real = await browser.newContext();
  const page = await real.newPage();
  await page.goto(BASE + '/#/attention');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.getByTestId('f6-notification-permission')).toContainText(
    /não suportada|negada|ainda não solicitada/,
  );
  await real.close();

  const mocked = await browser.newContext();
  const granted = await mocked.newPage();
  await granted.addInitScript(() => {
    class MockNotification {
      static permission = 'granted';
      static requestPermission = async () => 'granted';
    }
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: MockNotification,
    });
  });
  await granted.goto(BASE + '/#/attention');
  await expect(granted.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(granted.getByTestId('f6-notification-permission')).toContainText('concedida');
  await expect(
    granted.getByRole('button', { name: 'Autorizar avisos externos' }),
  ).toBeDisabled();
  await mocked.close();
});

