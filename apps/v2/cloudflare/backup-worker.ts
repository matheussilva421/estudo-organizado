import { verifyFirebaseIdToken, type JwksPort } from './token-verifier';

export type KVNamespaceLike = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string, cursor?: string): Promise<{ keys: string[]; cursor?: string }>;
};

export type BackupWorkerBindings = {
  BACKUPS: KVNamespaceLike;
  FIREBASE_PROJECT_ID: string;
  ALLOWED_ORIGIN: string;
  JWKS?: JwksPort;
};

export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

function json(status: number, body: unknown, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
    },
  });
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    Vary: 'Origin',
  };
}

function validEncrypted(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    record.format === 'eo-v2-encrypted-v1' &&
    typeof record.iv === 'string' &&
    record.iv.length > 0 &&
    typeof record.ciphertext === 'string' &&
    record.ciphertext.length > 0 &&
    typeof record.wrappedKey === 'string' &&
    record.wrappedKey.length > 0 &&
    record.kdf !== null &&
    typeof record.kdf === 'object'
  );
}

async function identity(request: Request, bindings: BackupWorkerBindings): Promise<string | null> {
  const authorization = request.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return null;
  if (!bindings.JWKS) return null;
  const issuer = `https://securetoken.google.com/${bindings.FIREBASE_PROJECT_ID}`;
  const verified = await verifyFirebaseIdToken(authorization.slice('Bearer '.length), {
    projectId: bindings.FIREBASE_PROJECT_ID,
    issuer,
  }, bindings.JWKS);
  return verified?.uid ?? null;
}

export async function handleBackupRequest(
  request: Request,
  bindings: BackupWorkerBindings,
): Promise<Response> {
  const origin = request.headers.get('Origin') ?? '';
  if (request.method === 'OPTIONS') {
    if (origin !== bindings.ALLOWED_ORIGIN) return json(403, { error: 'ORIGIN' }, bindings.ALLOWED_ORIGIN);
    return new Response(null, { status: 204, headers: corsHeaders(bindings.ALLOWED_ORIGIN) });
  }
  if (!bindings.ALLOWED_ORIGIN || origin !== bindings.ALLOWED_ORIGIN) {
    return json(403, { error: 'ORIGIN' }, bindings.ALLOWED_ORIGIN || 'null');
  }
  if (request.method !== 'GET' && request.method !== 'POST' && request.method !== 'DELETE') {
    return json(405, { error: 'METHOD' }, bindings.ALLOWED_ORIGIN);
  }
  const uid = await identity(request, bindings);
  if (!uid) return json(401, { error: 'AUTH' }, bindings.ALLOWED_ORIGIN);

  const url = new URL(request.url);
  const prefix = `backups/${uid}/`;
  const parts = url.pathname.split('/').filter(Boolean);

  if (request.method === 'POST' && parts.length === 1 && parts[0] === 'backups') {
    const length = Number(request.headers.get('Content-Length') ?? '0');
    if (Number.isFinite(length) && length > MAX_BACKUP_BYTES) {
      return json(413, { error: 'OVERSIZED' }, bindings.ALLOWED_ORIGIN);
    }
    const body = await request.text();
    if (new TextEncoder().encode(body).length > MAX_BACKUP_BYTES) {
      return json(413, { error: 'OVERSIZED' }, bindings.ALLOWED_ORIGIN);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return json(400, { error: 'JSON' }, bindings.ALLOWED_ORIGIN);
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json(400, { error: 'BODY' }, bindings.ALLOWED_ORIGIN);
    }
    const record = parsed as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || !validEncrypted(record.encrypted)) {
      return json(400, { error: 'INVALID_BACKUP' }, bindings.ALLOWED_ORIGIN);
    }
    await bindings.BACKUPS.put(`${prefix}${id}`, JSON.stringify(record.encrypted));
    return json(201, { id }, bindings.ALLOWED_ORIGIN);
  }

  if (request.method === 'GET' && parts.length === 1 && parts[0] === 'backups') {
    const listed = await bindings.BACKUPS.list(prefix);
    return json(
      200,
      { items: listed.keys.map((key) => ({ id: key.slice(prefix.length) })) },
      bindings.ALLOWED_ORIGIN,
    );
  }

  if (parts.length === 2 && parts[0] === 'backups') {
    const id = parts[1] ?? '';
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
      return json(400, { error: 'ID' }, bindings.ALLOWED_ORIGIN);
    }
    const key = `${prefix}${id}`;
    if (request.method === 'GET') {
      const stored = await bindings.BACKUPS.get(key);
      if (!stored) return json(404, { error: 'NOT_FOUND' }, bindings.ALLOWED_ORIGIN);
      return json(200, JSON.parse(stored), bindings.ALLOWED_ORIGIN);
    }
    if (request.method === 'DELETE') {
      await bindings.BACKUPS.delete(key);
      return new Response(null, { status: 204, headers: corsHeaders(bindings.ALLOWED_ORIGIN) });
    }
  }

  return json(404, { error: 'ROUTE' }, bindings.ALLOWED_ORIGIN);
}
