import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Firebase auth reserved paths', () => {
  it('bypasses the service worker before navigation caching', async () => {
    const source = await readFile(resolve(process.cwd(), 'public/sw.js'), 'utf8');
    const guard = source.indexOf("url.pathname.startsWith('/__/')");
    const navigation = source.indexOf("request.mode === 'navigate'");

    expect(guard).toBeGreaterThan(-1);
    expect(navigation).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(navigation);
  });

  it('allows the same-origin Firebase iframe in the CSP', async () => {
    const headers = await readFile(resolve(process.cwd(), 'public/_headers'), 'utf8');

    expect(headers).toContain("frame-ancestors 'self'");
    expect(headers).not.toContain("frame-ancestors 'none'");
    expect(headers).toContain("frame-src 'self'");
  });
});
