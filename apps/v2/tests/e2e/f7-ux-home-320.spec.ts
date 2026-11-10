import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetF7Ux, seedAcademicData } from './f7-ux-helpers';

const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 720 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;

test('home remains usable from 320px to desktop', async ({ page }) => {
  const out = process.env.F7_UX_HOME_EVIDENCE ?? join(tmpdir(), 'f7-ux-home-audit');
  await mkdir(out, { recursive: true });
  await resetF7Ux(page);
  await seedAcademicData(page);

  const metrics: Record<string, unknown>[] = [];
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/#/home');
    await expect(page.getByTestId('f6-home')).toBeVisible();
    await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
    const measured = await page.evaluate(() => {
      const box = (selector: string) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) return null;
        const rect = element.getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          height: Math.round(rect.height),
        };
      };
      const interactive = [...document.querySelectorAll('button, a, input, select')]
        .filter((element) => {
          if (!(element instanceof HTMLElement)) return false;
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
      const tooSmall = interactive.filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.height < 24;
      });
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        header: box('.view-header'),
        controls: box('.home-controls'),
        grid: box('.dashboard-grid'),
        nextAction: box('[data-widget="next-action"]'),
        agenda: box('[data-widget="agenda"]'),
        domOrder: [...document.querySelectorAll('.home-view > *')].map((element) =>
          typeof element.className === 'string' && element.className
            ? element.className.split(' ')[0]
            : element.tagName.toLowerCase(),
        ),
        interactive: interactive.length,
        under24: tooSmall.length,
        smallTargets: tooSmall.slice(0, 8).map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName,
            cls:
              element.className && typeof element.className === 'string'
                ? element.className.slice(0, 40)
                : '',
            text: (element.textContent ?? '').trim().slice(0, 30),
            height: Math.round(rect.height),
            width: Math.round(rect.width),
          };
        }),
        offenders: [...document.querySelectorAll('*')]
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName,
              cls: element.className && typeof element.className === 'string' ? element.className.slice(0, 60) : '',
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            };
          })
          .filter((item) => item.right > document.documentElement.clientWidth + 1)
          .slice(0, 12),
      };
    });
    metrics.push({ viewport: viewport.name, ...measured });
    await writeFile(join(out, 'home-320-metrics.json'), JSON.stringify(metrics, null, 2));
    expect(measured.scrollWidth, `horizontal overflow at ${viewport.name}`).toBeLessThanOrEqual(
      measured.clientWidth + 1,
    );
    expect(measured.grid, `dashboard grid missing at ${viewport.name}`).not.toBeNull();
    const indexOf = (name: string) => measured.domOrder.indexOf(name);
    expect(indexOf('dashboard-grid'), 'widgets must precede controls in the DOM').toBeLessThan(
      indexOf('home-controls'),
    );
    expect(indexOf('dashboard-grid'), 'widgets must precede counts in the DOM').toBeLessThan(
      indexOf('home-counts'),
    );
    if (measured.controls && measured.grid) {
      expect(measured.grid.top, 'visual order must match DOM order').toBeLessThan(
        measured.controls.top,
      );
    }
    await page.screenshot({
      path: join(out, `home-${viewport.name}.png`),
      fullPage: false,
    });
  }

  // Text zoom at the narrowest viewport must not create horizontal scrolling.
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/#/home');
  await page.addStyleTag({ content: 'html { font-size: 200% }' });
  const zoomed = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    scrollOffenders: [...document.querySelectorAll('*')]
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => ({
        tag: element.tagName,
        cls:
          element.className && typeof element.className === 'string'
            ? element.className.slice(0, 60)
            : '',
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }))
      .sort((left, right) => right.scrollWidth - left.scrollWidth)
      .slice(0, 12),
    offenders: [...document.querySelectorAll('*')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          cls:
            element.className && typeof element.className === 'string'
              ? element.className.slice(0, 60)
              : '',
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.right > document.documentElement.clientWidth + 1)
      .slice(0, 15),
  }));
  metrics.push({ viewport: 'mobile-320-text-200', ...zoomed });
  await writeFile(join(out, 'home-320-metrics.json'), JSON.stringify(metrics, null, 2));
  expect(zoomed.scrollWidth, 'horizontal overflow at text 200%').toBeLessThanOrEqual(
    zoomed.clientWidth + 1,
  );
  await page.screenshot({ path: join(out, 'home-320-text-200.png') });

  // Keyboard entry keeps a visible focus ring.
  await page.reload();
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) return null;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      tag: element.tagName,
      width: rect.width,
      height: rect.height,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
  metrics.push({ viewport: 'keyboard', ...focus });
  expect(focus, 'no focusable element after Tab').not.toBeNull();
  expect(focus!.width).toBeGreaterThan(0);
  expect(focus!.outlineStyle).not.toBe('none');
  expect(focus!.outlineWidth).not.toBe('0px');

  // At least one dark and one high-contrast theme at the narrow viewport.
  for (const theme of ['grafite', 'terminal']) {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/#/home');
    await page.getByLabel('Tema').selectOption(theme);
    await page.locator('.dashboard-grid').scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(out, `home-320-${theme}.png`) });
  }

  await writeFile(join(out, 'home-320-metrics.json'), JSON.stringify(metrics, null, 2));
});

