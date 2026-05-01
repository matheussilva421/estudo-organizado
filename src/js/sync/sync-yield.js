export async function yieldToUI() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

export function measureAsync(fn) {
  return async function (...args) {
    const start = performance.now();
    const result = await fn(...args);
    const elapsed = performance.now() - start;
    return { result, elapsedMs: Math.round(elapsed * 100) / 100 };
  };
}
