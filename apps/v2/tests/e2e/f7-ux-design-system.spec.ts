import { expect, test } from '@playwright/test';
import { resetF7Ux } from './f7-ux-helpers';

const THEMES = ['grafite', 'ardosia', 'platina', 'terminal', 'neon', 'arrakis', 'codex', 'plasma'];

test('f7 ux eight themes fit mobile, tablet and desktop without horizontal overflow', async ({ page }) => {
  await resetF7Ux(page);
  for (const theme of THEMES) {
    await page.getByLabel('Tema').selectOption(theme);
    for (const viewport of [
      { width: 320, height: 720 },
      { width: 390, height: 844 },
      { width: 834, height: 1112 },
      { width: 1280, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${theme} ${viewport.width}`).toBeLessThanOrEqual(1);
    }
  }
});

test('f7 ux focus is visible, reduced motion is honored and 200 percent text keeps integrity', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resetF7Ux(page, '/#/attention');
  const target = page.getByRole('link', { name: 'Pular para o conteúdo' });
  await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
  const transition = await page.locator('[data-nav="home"]').evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  );
  expect(Number.parseFloat(transition)).toBeLessThanOrEqual(0.001);
  const outline = await target.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe('none');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByText('Commit local')).toBeVisible();
});
