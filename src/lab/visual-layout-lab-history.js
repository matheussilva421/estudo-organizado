// Visual Layout Lab — undo/redo imutável, apenas para estados de layout.

export const HISTORY_CAP = 100;

export function createHistory(initial) {
  return { past: [], present: initial, future: [] };
}

export function canUndo(history) {
  return history.past.length > 0;
}

export function canRedo(history) {
  return history.future.length > 0;
}

export function push(history, state) {
  const past = [...history.past, history.present].slice(-HISTORY_CAP);
  return { past, present: state, future: [] };
}

export function undo(history) {
  if (!canUndo(history)) return history;
  const past = history.past.slice(0, -1);
  const present = history.past[history.past.length - 1];
  return { past, present, future: [history.present, ...history.future] };
}

export function redo(history) {
  if (!canRedo(history)) return history;
  const [present, ...future] = history.future;
  return { past: [...history.past, history.present], present, future };
}
