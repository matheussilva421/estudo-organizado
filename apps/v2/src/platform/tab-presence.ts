export const TAB_PRESENCE_LOCK = 'estudo-organizado-v2:tab-presence';
let presenceHeld = false;

/** Holds one shared lock for the lifetime of this tab. */
export function holdTabPresence(): () => void {
  if (typeof navigator === 'undefined' || !navigator.locks) return () => undefined;
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  void navigator.locks
    .request(TAB_PRESENCE_LOCK, { mode: 'shared' }, () => {
      presenceHeld = true;
      return held;
    })
    .catch(() => undefined);
  return () => {
    presenceHeld = false;
    release();
  };
}

/** Returns the number of other tabs, or null when Web Locks query is unavailable. */
export async function countOtherTabs(): Promise<number | null> {
  if (typeof navigator === 'undefined' || !navigator.locks?.query) return null;
  try {
    const snapshot = await navigator.locks.query();
    const held = snapshot.held?.filter(
      (lock) => lock.name === TAB_PRESENCE_LOCK && lock.mode === 'shared',
    ) ?? [];
    return Math.max(0, held.length - (presenceHeld ? 1 : 0));
  } catch {
    return null;
  }
}
