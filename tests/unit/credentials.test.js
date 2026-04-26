import { describe, expect, it, vi } from 'vitest';

describe('credentials.js', () => {
  it('does not open IndexedDB eagerly during module import', async () => {
    vi.resetModules();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await import('../../src/js/credentials.js?v=8.18');

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
