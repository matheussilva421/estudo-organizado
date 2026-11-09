import { afterEach, describe, expect, it, vi } from 'vitest';
import { countOtherTabs, holdTabPresence, TAB_PRESENCE_LOCK } from '../../src/platform/tab-presence';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('F7 tab presence', () => {
  it('f7_presence_without_a_held_lock_counts_all_shared_tabs', async () => {
    vi.stubGlobal('navigator', {
      locks: {
        query: async () => ({
          held: [
            { name: TAB_PRESENCE_LOCK, mode: 'shared' },
            { name: TAB_PRESENCE_LOCK, mode: 'shared' },
            { name: 'another-lock', mode: 'exclusive' },
          ],
        }),
      },
    });
    await expect(countOtherTabs()).resolves.toBe(2);
  });

  it('f7_presence_counts_only_other_shared_tabs', async () => {
    vi.stubGlobal('navigator', {
      locks: {
        request: (_name: string, _options: unknown, task: () => Promise<void>) => task(),
        query: async () => ({
          held: [
            { name: TAB_PRESENCE_LOCK, mode: 'shared' },
            { name: TAB_PRESENCE_LOCK, mode: 'shared' },
            { name: 'another-lock', mode: 'exclusive' },
          ],
        }),
      },
    });
    const cleanup = holdTabPresence();
    await expect(countOtherTabs()).resolves.toBe(1);
    cleanup();
  });

  it('f7_presence_without_query_fails_closed', async () => {
    vi.stubGlobal('navigator', {});
    await expect(countOtherTabs()).resolves.toBeNull();
  });

  it('f7_presence_lock_releases_on_cleanup', async () => {
    let release: (() => void) | null = null;
    const request = vi.fn((_name: string, _options: unknown, task: () => Promise<void>) => {
      release = () => undefined;
      return task();
    });
    vi.stubGlobal('navigator', { locks: { request } });
    const cleanup = holdTabPresence();
    expect(request).toHaveBeenCalledWith(
      TAB_PRESENCE_LOCK,
      { mode: 'shared' },
      expect.any(Function),
    );
    cleanup();
    expect(release).not.toBeNull();
  });
});
