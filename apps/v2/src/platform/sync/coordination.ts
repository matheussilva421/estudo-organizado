export type LockPort = {
  request<T>(name: string, task: () => Promise<T>): Promise<T>;
};

export type SafeLockResult<T> =
  | { kind: 'EXECUTED'; value: T }
  | { kind: 'BLOCKED' };

export async function withSafeFlushLock<T>(
  lockName: string,
  task: () => Promise<T>,
  locks: LockPort | null,
): Promise<SafeLockResult<T>> {
  if (!locks || typeof locks.request !== 'function') return { kind: 'BLOCKED' };

  try {
    const value = await locks.request(lockName, task);
    return { kind: 'EXECUTED', value };
  } catch {
    return { kind: 'BLOCKED' };
  }
}

export function browserLockPort(): LockPort | null {
  if (typeof navigator === 'undefined' || !navigator.locks) return null;
  return {
    request: <T>(name: string, task: () => Promise<T>) => navigator.locks.request(name, task),
  };
}
