import { describe, expect, it } from 'vitest';

import { yieldToUI, measureAsync } from '../../src/js/sync/sync-yield.js?v=8.32';

describe('sync/sync-yield.js', () => {
  it('yields to UI via setTimeout(0)', async () => {
    const start = Date.now();
    await yieldToUI();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('measureAsync wraps function and returns elapsed time', async () => {
    const fn = async (x) => x * 2;
    const measured = measureAsync(fn);
    const { result, elapsedMs } = await measured(5);
    expect(result).toBe(10);
    expect(elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('measureAsync captures elapsed time even for slow functions', async () => {
    const fn = async () => {
      await new Promise((r) => setTimeout(r, 50));
      return 'done';
    };
    const measured = measureAsync(fn);
    const { result, elapsedMs } = await measured();
    expect(result).toBe('done');
    expect(elapsedMs).toBeGreaterThan(0);
  });
});
