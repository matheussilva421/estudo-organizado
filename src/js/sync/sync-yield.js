/**
 * yieldToUI — yields to the main thread to allow frame painting.
 *
 * Uses requestAnimationFrame + messageChannel for reliable frame yielding.
 * Falls back to setTimeout(0) in non-browser environments (tests, SSR).
 *
 * @returns {Promise<void>}
 */
/* global MessageChannel, process */
export async function yieldToUI() {
  // In browser: use rAF + MessageChannel for reliable frame yield
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve();
      window.requestAnimationFrame(() => {
        channel.port2.postMessage(null);
      });
    });
  }
  // Fallback for non-browser environments (tests, SSR)
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * yieldToUIWithBudget — yields to UI and checks if operation is within budget.
 *
 * @param {number} budgetMs - Maximum allowed time for the operation
 * @param {number} startTime - When the operation started (performance.now())
 * @returns {Promise<{ shouldYield: boolean, exceeded: boolean }>}
 */
export async function yieldToUIWithBudget(budgetMs = 50, startTime = performance.now()) {
  await yieldToUI();
  const elapsed = performance.now() - startTime;
  const exceeded = elapsed > budgetMs;

  if (
    exceeded &&
    typeof console !== 'undefined' &&
    typeof process !== 'undefined' &&
    process?.env?.NODE_ENV !== 'production'
  ) {
    console.warn(
      `[sync-yield] Operation exceeded ${budgetMs}ms budget (${Math.round(elapsed)}ms elapsed)`
    );
  }

  return { shouldYield: true, exceeded };
}

export function measureAsync(fn) {
  return async function (...args) {
    const start = performance.now();
    const result = await fn(...args);
    const elapsed = performance.now() - start;
    return { result, elapsedMs: Math.round(elapsed * 100) / 100 };
  };
}
