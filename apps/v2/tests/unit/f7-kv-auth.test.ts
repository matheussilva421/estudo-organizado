// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  handleBackupRequest,
  MAX_BACKUP_BYTES,
  type BackupWorkerBindings,
  type KVNamespaceLike,
} from '../../cloudflare/backup-worker';
import { verifyFirebaseIdToken, type JwksPort } from '../../cloudflare/token-verifier';

const projectId = 'demo-estudo-v2';
const issuer = `https://securetoken.google.com/${projectId}`;
const origin = 'https://v2.example.test';

class MemoryKV implements KVNamespaceLike {
  readonly values = new Map<string, string>();
  async get(key: string) {
    return this.values.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.values.set(key, value);
  }
  async delete(key: string) {
    this.values.delete(key);
  }
  async list(prefix: string) {
    return { keys: [...this.values.keys()].filter((key) => key.startsWith(prefix)) };
  }
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function jwt(uid: string, overrides: Record<string, unknown> = {}, signWith?: CryptoKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', kid: 'kid-1', typ: 'JWT' })));
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    iss: issuer,
    aud: projectId,
    sub: uid,
    user_id: uid,
    iat: now,
    exp: now + 3600,
    ...overrides,
  })));
  const data = new TextEncoder().encode(`${header}.${payload}`);
  const signature = signWith
    ? await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signWith, data)
    : new ArrayBuffer(0);
  return `${header}.${payload}.${base64Url(new Uint8Array(signature))}`;
}

async function keyPair(): Promise<{ privateKey: CryptoKey; jwks: JwksPort }> {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return {
    privateKey: pair.privateKey,
    jwks: { async getKey(kid) { return kid === 'kid-1' ? jwk : null; } },
  };
}

function request(method: string, path: string, token?: string, body?: string, extra: Record<string, string> = {}) {
  const headers = new Headers({ Origin: origin, ...extra });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return new Request(`https://worker.example${path}`, { method, headers, ...(body ? { body } : {}) });
}

describe('F7 backup worker auth', () => {
  it('f7_worker_rejects_missing_token', async () => {
    const { jwks } = await keyPair();
    const bindings: BackupWorkerBindings = { BACKUPS: new MemoryKV(), FIREBASE_PROJECT_ID: projectId, ALLOWED_ORIGIN: origin, JWKS: jwks };
    const response = await handleBackupRequest(request('GET', '/backups'), bindings);
    expect(response.status).toBe(401);
  });

  it('f7_worker_rejects_wrong_issuer_audience_expiry_signature', async () => {
    const { privateKey, jwks } = await keyPair();
    const valid = await jwt('uid-a', {}, privateKey);
    await expect(verifyFirebaseIdToken(valid, { projectId, issuer }, jwks)).resolves.toEqual({ uid: 'uid-a' });
    await expect(verifyFirebaseIdToken(await jwt('uid-a', { iss: 'https://evil' }, privateKey), { projectId, issuer }, jwks)).resolves.toBeNull();
    await expect(verifyFirebaseIdToken(await jwt('uid-a', { aud: 'other' }, privateKey), { projectId, issuer }, jwks)).resolves.toBeNull();
    await expect(verifyFirebaseIdToken(await jwt('uid-a', { exp: 1 }, privateKey), { projectId, issuer }, jwks)).resolves.toBeNull();
    await expect(verifyFirebaseIdToken(await jwt('uid-a'), { projectId, issuer }, jwks)).resolves.toBeNull();
  });

  it('f7_worker_uid_cannot_read_other_uid', async () => {
    const { privateKey, jwks } = await keyPair();
    const kv = new MemoryKV();
    const bindings: BackupWorkerBindings = { BACKUPS: kv, FIREBASE_PROJECT_ID: projectId, ALLOWED_ORIGIN: origin, JWKS: jwks };
    const tokenA = await jwt('uid-a', {}, privateKey);
    const tokenB = await jwt('uid-b', {}, privateKey);
    const created = await handleBackupRequest(
      request('POST', '/backups', tokenA, JSON.stringify({
        id: 'v1',
        encrypted: { format: 'eo-v2-encrypted-v1', iv: 'a', ciphertext: 'b', wrappedKey: 'c', kdf: {} },
      }), { 'Content-Type': 'application/json' }),
      bindings,
    );
    expect(created.status).toBe(201);
    const own = await handleBackupRequest(request('GET', '/backups/v1', tokenA), bindings);
    expect(own.status).toBe(200);
    const other = await handleBackupRequest(request('GET', '/backups/v1', tokenB), bindings);
    expect(other.status).toBe(404);
  });

  it('f7_worker_rejects_unapproved_origin_and_method', async () => {
    const { privateKey, jwks } = await keyPair();
    const bindings: BackupWorkerBindings = { BACKUPS: new MemoryKV(), FIREBASE_PROJECT_ID: projectId, ALLOWED_ORIGIN: origin, JWKS: jwks };
    const token = await jwt('uid-a', {}, privateKey);
    const badOrigin = new Request('https://worker.example/backups', { method: 'GET', headers: new Headers({ Origin: 'https://evil.example', Authorization: `Bearer ${token}` }) });
    expect((await handleBackupRequest(badOrigin, bindings)).status).toBe(403);
    expect((await handleBackupRequest(request('PUT', '/backups', token), bindings)).status).toBe(405);
  });

  it('f7_no_secrets_or_plain_backup_logged', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { privateKey, jwks } = await keyPair();
    const bindings: BackupWorkerBindings = { BACKUPS: new MemoryKV(), FIREBASE_PROJECT_ID: projectId, ALLOWED_ORIGIN: origin, JWKS: jwks };
    const token = await jwt('uid-a', {}, privateKey);
    await handleBackupRequest(request('GET', '/backups', token), bindings);
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    log.mockRestore();
    error.mockRestore();
  });

  it('f7_worker_rejects_oversized_request', async () => {
    const { privateKey, jwks } = await keyPair();
    const bindings: BackupWorkerBindings = { BACKUPS: new MemoryKV(), FIREBASE_PROJECT_ID: projectId, ALLOWED_ORIGIN: origin, JWKS: jwks };
    const token = await jwt('uid-a', {}, privateKey);
    const response = await handleBackupRequest(
      request('POST', '/backups', token, '{}', { 'Content-Type': 'application/json', 'Content-Length': String(MAX_BACKUP_BYTES + 1) }),
      bindings,
    );
    expect(response.status).toBe(413);
  });

  it('f7_worker_does_not_overwrite_an_immutable_backup', async () => {
    const { privateKey, jwks } = await keyPair();
    const bindings: BackupWorkerBindings = {
      BACKUPS: new MemoryKV(),
      FIREBASE_PROJECT_ID: projectId,
      ALLOWED_ORIGIN: origin,
      JWKS: jwks,
    };
    const token = await jwt('uid-a', {}, privateKey);
    const encrypted = {
      format: 'eo-v2-encrypted-v1',
      iv: 'a',
      ciphertext: 'b',
      wrappedKey: 'c',
      kdf: { name: 'PBKDF2' },
    };
    const first = await handleBackupRequest(
      request('POST', '/backups', token, JSON.stringify({ id: 'v1', encrypted }), {
        'Content-Type': 'application/json',
      }),
      bindings,
    );
    expect(first.status).toBe(201);
    const changed = await handleBackupRequest(
      request(
        'POST',
        '/backups',
        token,
        JSON.stringify({ id: 'v1', encrypted: { ...encrypted, ciphertext: 'different' } }),
        { 'Content-Type': 'application/json' },
      ),
      bindings,
    );
    expect(changed.status).toBe(409);
  });

  it('f7_worker_does_not_delete_the_last_copy', async () => {
    const { privateKey, jwks } = await keyPair();
    const bindings: BackupWorkerBindings = {
      BACKUPS: new MemoryKV(),
      FIREBASE_PROJECT_ID: projectId,
      ALLOWED_ORIGIN: origin,
      JWKS: jwks,
    };
    const token = await jwt('uid-a', {}, privateKey);
    const encrypted = {
      format: 'eo-v2-encrypted-v1',
      iv: 'a',
      ciphertext: 'b',
      wrappedKey: 'c',
      kdf: { name: 'PBKDF2' },
    };
    const post = (id: string) =>
      handleBackupRequest(
        request('POST', '/backups', token, JSON.stringify({ id, encrypted }), {
          'Content-Type': 'application/json',
        }),
        bindings,
      );
    expect((await post('v1')).status).toBe(201);
    expect((await handleBackupRequest(request('DELETE', '/backups/v1', token), bindings)).status).toBe(
      409,
    );
    expect((await post('v2')).status).toBe(201);
    expect((await handleBackupRequest(request('DELETE', '/backups/v1', token), bindings)).status).toBe(
      204,
    );
  });
});
