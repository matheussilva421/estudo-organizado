import type { EncryptedBackup } from './crypto';

export type BackupRemotePort = {
  put(input: { uid: string; id: string; encrypted: EncryptedBackup }): Promise<
    'VERIFIED' | 'PENDING' | 'QUOTA' | 'FAILED'
  >;
  get(id: string): Promise<EncryptedBackup | null>;
  list(): Promise<Array<{ id: string; createdAt: string; size: number }>>;
  deleteVerifiedOldVersion(id: string): Promise<boolean>;
};

export type KvFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type KvBackupPortOptions = {
  fetch?: KvFetch;
  maxBytes?: number;
  expectedUid?: string;
  /** Re-read the live auth UID immediately before and after obtaining a token. */
  getCurrentUid?: () => Promise<string | null>;
  now?: () => string;
};

export const KV_MAX_VALUE_BYTES = 25 * 1024 * 1024;
export const R2_ENABLED = false as const;

export function createR2BackupPort(): never {
  throw new Error('R2 is disabled: it requires a billable subscription');
}

function bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

function validId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(id);
}

export function createKvBackupPort(
  endpoint: string,
  getIdToken: () => Promise<string | null>,
  options: KvBackupPortOptions = {},
): BackupRemotePort {
  const base = endpoint.replace(/\/$/, '');
  const fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
  const maxBytes = options.maxBytes ?? KV_MAX_VALUE_BYTES;

  async function request(
    path: string,
    init: RequestInit = {},
    expectedUid?: string,
  ): Promise<Response | null> {
    if (expectedUid && options.getCurrentUid) {
      const before = await options.getCurrentUid().catch(() => null);
      if (before !== expectedUid) return null;
    }
    const token = await getIdToken().catch(() => null);
    if (!token) return null;
    if (expectedUid && options.getCurrentUid) {
      const after = await options.getCurrentUid().catch(() => null);
      if (after !== expectedUid) return null;
    }
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body) headers.set('Content-Type', 'application/json');
    try {
      return await fetchImpl(`${base}${path}`, { ...init, headers });
    } catch {
      return null;
    }
  }

  return {
    async put(input) {
      if (!input.uid.trim() || !validId(input.id)) return 'FAILED';
      if (options.expectedUid && input.uid !== options.expectedUid) return 'FAILED';
      const serialized = JSON.stringify(input.encrypted);
      if (bytes(serialized) > maxBytes) return 'QUOTA';

      const created = await request('/backups', {
        method: 'POST',
        body: JSON.stringify({ id: input.id, encrypted: input.encrypted }),
      }, input.uid);
      if (!created) return 'FAILED';
      if (created.status === 413 || created.status === 429) return 'QUOTA';
      if (!created.ok && created.status !== 409) return 'FAILED';

      const readback = await request(
        `/backups/${encodeURIComponent(input.id)}`,
        {},
        input.uid,
      );
      if (!readback) return 'FAILED';
      if (readback.status === 404) return 'PENDING';
      if (!readback.ok) return 'FAILED';
      const body = await readback.text();
      if (body !== serialized) return 'FAILED';
      return 'VERIFIED';
    },

    async get(id) {
      if (!validId(id)) return null;
      const response = await request(
        `/backups/${encodeURIComponent(id)}`,
        {},
        options.expectedUid,
      );
      if (!response || !response.ok) return null;
      try {
        return (await response.json()) as EncryptedBackup;
      } catch {
        return null;
      }
    },

    async list() {
      const response = await request('/backups', {}, options.expectedUid);
      if (!response || !response.ok) return [];
      try {
        const parsed = (await response.json()) as { items?: unknown };
        if (!Array.isArray(parsed.items)) return [];
        return parsed.items
          .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
          .map((item) => ({
            id: typeof item.id === 'string' ? item.id : '',
            createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
            size: typeof item.size === 'number' ? item.size : 0,
          }))
          .filter((item) => validId(item.id));
      } catch {
        return [];
      }
    },

    async deleteVerifiedOldVersion(id) {
      if (!validId(id)) return false;
      const response = await request(
        `/backups/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
        options.expectedUid,
      );
      return response?.status === 204;
    },
  };
}
