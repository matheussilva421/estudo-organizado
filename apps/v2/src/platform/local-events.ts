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

type PlanningChange = { profileId: string; scenarioId: string };

type PlanningListener = (change: PlanningChange) => void;

const planningListeners = new Map<string, Set<PlanningListener>>();
let planningChannel: BroadcastChannel | null = null;

function ensurePlanningChannel(): BroadcastChannel | null {
  if (planningChannel) return planningChannel;
  if (typeof BroadcastChannel !== 'function') return null;
  planningChannel = new BroadcastChannel('estudo-organizado-v2-planning');
  planningChannel.onmessage = (event: MessageEvent<PlanningChange>) => {
    const change = event.data;
    if (change && typeof change.profileId === 'string' && typeof change.scenarioId === 'string') {
      deliverPlanning(change, false);
    }
  };
  return planningChannel;
}

function deliverPlanning(change: PlanningChange, broadcast: boolean): void {
  for (const listener of planningListeners.get(change.profileId) ?? []) {
    listener(change);
  }
  if (broadcast) ensurePlanningChannel()?.postMessage(change);
}

export function subscribePlanningChanges(
  profileId: string,
  onChange: PlanningListener,
): () => void {
  ensurePlanningChannel();
  const listeners = planningListeners.get(profileId) ?? new Set<PlanningListener>();
  listeners.add(onChange);
  planningListeners.set(profileId, listeners);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) planningListeners.delete(profileId);
  };
}

export function notifyPlanningChange(profileId: string, scenarioId: string): void {
  deliverPlanning({ profileId, scenarioId }, true);
}
