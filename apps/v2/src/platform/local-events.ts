export type LocalChange = {
  profileId: string;
  subjectId: string;
};

type LocalChangeListener = (change: LocalChange) => void;

const listeners = new Map<string, Set<LocalChangeListener>>();

let channel: BroadcastChannel | null = null;

function ensureChannel(): BroadcastChannel | null {
  if (channel) return channel;
  if (typeof BroadcastChannel !== 'function') return null;
  channel = new BroadcastChannel('estudo-organizado-v2-local');
  channel.onmessage = (event: MessageEvent<LocalChange>) => {
    const change = event.data;
    if (change && typeof change.profileId === 'string' && typeof change.subjectId === 'string') {
      deliver(change, false);
    }
  };
  return channel;
}

function deliver(change: LocalChange, broadcast: boolean): void {
  for (const listener of listeners.get(change.profileId) ?? []) {
    listener(change);
  }
  if (broadcast) ensureChannel()?.postMessage(change);
}

export function subscribeLocalChanges(
  profileId: string,
  onChange: LocalChangeListener,
): () => void {
  ensureChannel();
  const profileListeners = listeners.get(profileId) ?? new Set<LocalChangeListener>();
  profileListeners.add(onChange);
  listeners.set(profileId, profileListeners);

  return () => {
    profileListeners.delete(onChange);
    if (profileListeners.size === 0) listeners.delete(profileId);
  };
}

export function notifyLocalChange(profileId: string, subjectId: string): void {
  deliver({ profileId, subjectId }, true);
}
