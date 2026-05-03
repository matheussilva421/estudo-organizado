import { describe, expect, it, vi } from 'vitest';

import { yieldToUI, yieldToUIWithBudget, measureAsync } from '../../src/js/sync/sync-yield.js?v=8.36';

describe('sync/sync-yield.js', () => {
  it('yields to UI via rAF+MessageChannel (or setTimeout fallback)', async () => {
    const start = Date.now();
    await yieldToUI();
    const elapsed = Date.now() - start;
    // Should yield but not block excessively
    expect(elapsed).toBeLessThan(1000);
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

  it('yieldToUIWithBudget returns timing info', async () => {
    const start = performance.now();
    const result = await yieldToUIWithBudget(100, start);
    expect(result).toHaveProperty('shouldYield', true);
    expect(result).toHaveProperty('exceeded');
    expect(typeof result.exceeded).toBe('boolean');
  });

  it('yieldToUIWithBudget detects budget exceeded', async () => {
    // Start with a time that's already past the budget
    const pastStart = performance.now() - 200; // 200ms ago
    const result = await yieldToUIWithBudget(50, pastStart);
    expect(result.exceeded).toBe(true);
  });

  it('yieldToUIWithBudget detects budget not exceeded', async () => {
    const start = performance.now();
    const result = await yieldToUIWithBudget(5000, start); // 5s budget
    expect(result.exceeded).toBe(false);
  });
});
