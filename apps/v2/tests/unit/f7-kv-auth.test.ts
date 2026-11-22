// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  handleBackupRequest,
  MAX_BACKUP_BYTES,
  type BackupWorkerBindings,
  type KVNamespaceLike,
} from '../../cloudflare/backup-worker';
import {
  createGoogleJwksPort,
  verifyFirebaseIdToken,
  type JwksPort,
} from '../../cloudflare/token-verifier';

const projectId = 'demo-estudo-v2';
const issuer = `https://securetoken.google.com/${projectId}`;
const origin = 'https://v2.example.test';

class MemoryKV implements KVNamespaceLike {
  readonly values = new Map<string, string>();
  readonly listCalls: Array<{ prefix?: string; cursor?: string }> = [];
  pageSize = Number.MAX_SAFE_INTEGER;

  async get(key: string) {
    return this.values.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.values.set(key, value);
  }
  async delete(key: string) {
    this.values.delete(key);
  }
  async list(options: { prefix?: string; cursor?: string } = {}) {
    this.listCalls.push({ ...options });
    const prefix = options.prefix ?? '';
    const names = [...this.values.keys()].filter((key) => key.startsWith(prefix)).sort();
    const start = options.cursor === undefined ? 0 : Number(options.cursor);
    const page = names.slice(start, start + this.pageSize);
    const next = start + page.length;
    const listComplete = next >= names.length;
    return {
      keys: page.map((name) => ({ name })),
      list_complete: listComplete,
      ...(listComplete ? {} : { cursor: String(next) }),
    };
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
    const bindings: BackupWorkerBindings = { BACKUPS: new MemoryKV(), FIREBASE_PROJECT_ID: projectId, ALLOWED_ORIGIN: origin,
      ALLOWED_UIDS: 'uid-a', JWKS: jwks };
    const response = await handleBackupRequest(request('GET', '/backups'), bindings);
    expect(response.status).toBe(401);
  });

  it('f7_worker_denies_all_when_allowlist_is_missing', async () => {
    const { privateKey, jwks } = await keyPair();
    const kv = new MemoryKV();
    const bindings: BackupWorkerBindings = {
      BACKUPS: kv,
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
    expect((await handleBackupRequest(request('GET', '/backups', token), bindings)).status).toBe(401);
    expect(
      (
        await handleBackupRequest(
          request('POST', '/backups', token, JSON.stringify({ id: 'v1', encrypted }), {
            'Content-Type': 'application/json',
          }),
          bindings,
        )
      ).status,
    ).toBe(401);
    expect((await handleBackupRequest(request('DELETE', '/backups/v1', token), bindings)).status).toBe(401);
    expect(kv.values.size).toBe(0);
  });

  it('f7_worker_denies_all_for_empty_or_separator_allowlist', async () => {
    const { privateKey, jwks } = await keyPair();
    const token = await jwt('uid-a', {}, privateKey);
    for (const value of ['', '   ', ' , , ', ',']) {
      const bindings: BackupWorkerBindings = {
        BACKUPS: new MemoryKV(),
        FIREBASE_PROJECT_ID: projectId,
        ALLOWED_ORIGIN: origin,
        ALLOWED_UIDS: value,
        JWKS: jwks,
      };
      expect((await handleBackupRequest(request('GET', '/backups', token), bindings)).status).toBe(401);
    }
  });

  it('f7_worker_allowlist_is_exact_and_tolerates_duplicates', async () => {
    const { privateKey, jwks } = await keyPair();
    const bindings: BackupWorkerBindings = {
      BACKUPS: new MemoryKV(),
      FIREBASE_PROJECT_ID: projectId,
      ALLOWED_ORIGIN: origin,
      ALLOWED_UIDS: ' uid-a, uid-a, , ',
      JWKS: jwks,
    };
    const tokenA = await jwt('uid-a', {}, privateKey);
    const tokenB = await jwt('uid-b', {}, privateKey);
    expect((await handleBackupRequest(request('GET', '/backups', tokenA), bindings)).status).toBe(200);
    expect((await handleBackupRequest(request('GET', '/backups', tokenB), bindings)).status).toBe(401);
  });

  it('f7_worker_allowlist_isolates_a_and_b_both_ways', async () => {
    const { privateKey, jwks } = await keyPair();
    const kv = new MemoryKV();
    const bindings: BackupWorkerBindings = {
      BACKUPS: kv,
      FIREBASE_PROJECT_ID: projectId,
      ALLOWED_ORIGIN: origin,
      ALLOWED_UIDS: 'uid-a,uid-b',
      JWKS: jwks,
    };
    const tokenA = await jwt('uid-a', {}, privateKey);
    const tokenB = await jwt('uid-b', {}, privateKey);
    const encrypted = {
      format: 'eo-v2-encrypted-v1',
      iv: 'a',
      ciphertext: 'b',
      wrappedKey: 'c',
      kdf: { name: 'PBKDF2' },
    };
    const post = (token: string, id: string) =>
      handleBackupRequest(
        request('POST', '/backups', token, JSON.stringify({ id, encrypted }), {
          'Content-Type': 'application/json',
        }),
        bindings,
      );
    expect((await post(tokenA, 'a-1')).status).toBe(201);
    expect((await post(tokenB, 'b-1')).status).toBe(201);
    expect((await handleBackupRequest(request('GET', '/backups/a-1', tokenB), bindings)).status).toBe(404);
    expect((await handleBackupRequest(request('GET', '/backups/b-1', tokenA), bindings)).status).toBe(404);
    const listA = (await (await handleBackupRequest(request('GET', '/backups', tokenA), bindings)).json()) as {
      items: Array<{ id: string }>;
    };
    const listB = (await (await handleBackupRequest(request('GET', '/backups', tokenB), bindings)).json()) as {
      items: Array<{ id: string }>;
    };
    expect(listA.items.map((item) => item.id)).toEqual(['a-1']);
    expect(listB.items.map((item) => item.id)).toEqual(['b-1']);
    expect((await handleBackupRequest(request('DELETE', '/backups/a-1?replacement=b-1', tokenB), bindings)).status).toBe(204);
    expect((await handleBackupRequest(request('DELETE', '/backups/b-1', tokenA), bindings)).status).toBe(409);
    expect(await kv.get('backups/uid-a/a-1')).not.toBeNull();
    expect(await kv.get('backups/uid-b/b-1')).not.toBeNull();
  });

  it('f7_worker_rejects_wrong_issuer_audience_expiry_signature', async () => {
    const { privateKey, jwks } = await keyPair();
    const valid = await jwt('uid-a', {}, privateKey);
    await expect(verifyFirebaseIdToken(valid, { projectId, issuer }, jwks)).resolves.toEqual({ uid: 'uid-a' });
    await expect(verifyFirebaseIdToken(await jwt('uid-a', { iss: 'https://evil' }, privateKey), { projectId, issuer }, jwks)).resolves.toBeNull();
    await expect(verifyFirebaseIdToken(await jwt('uid-a', { aud: 'other' }, privateKey), { projectId, issuer }, jwks)).resolves.toBeNull();
    await expect(verifyFirebaseIdToken(await jwt('uid-a', { exp: 1 }, privateKey), { projectId, issuer }, jwks)).resolves.toBeNull();
    await expect(verifyFirebaseIdToken(await jwt('uid-a'), { projectId, issuer }, jwks)).resolves.toBeNull();
    await expect(
      verifyFirebaseIdToken(
        await jwt('uid-a', { user_id: 'uid-b' }, privateKey),
        { projectId, issuer },
        jwks,
      ),
    ).resolves.toBeNull();
  });

  it('f7_jwks_refreshes_once_for_a_rotated_kid', async () => {
    let clock = 0;
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return new Response(JSON.stringify({
        keys: [{ kid: calls === 1 ? 'kid-1' : 'kid-2', kty: 'RSA', n: 'n', e: 'AQAB' }],
      }));
    });
    const port = createGoogleJwksPort(fetchImpl, () => clock);
    await expect(port.getKey('kid-1')).resolves.toMatchObject({ kid: 'kid-1' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await expect(port.getKey('kid-2')).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    clock = 61_000;
    await expect(port.getKey('kid-2')).resolves.toMatchObject({ kid: 'kid-2' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('f7_worker_uid_cannot_read_other_uid', async () => {
    const { privateKey, jwks } = await keyPair();
    const kv = new MemoryKV();
    const bindings: BackupWorkerBindings = { BACKUPS: kv, FIREBASE_PROJECT_ID: projectId, ALLOWED_ORIGIN: origin,
      ALLOWED_UIDS: 'uid-a,uid-b', JWKS: jwks };
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

  it('f7_worker_rejects_authenticated_uid_outside_pilot_allowlist', async () => {
    const { privateKey, jwks } = await keyPair();
    const bindings: BackupWorkerBindings = {
      BACKUPS: new MemoryKV(),
      FIREBASE_PROJECT_ID: projectId,
      ALLOWED_ORIGIN: origin,
      ALLOWED_UIDS: 'uid-a',
      JWKS: jwks,
    };
    const tokenA = await jwt('uid-a', {}, privateKey);
    const tokenB = await jwt('uid-b', {}, privateKey);
    expect((await handleBackupRequest(request('GET', '/backups', tokenA), bindings)).status).toBe(200);
    expect((await handleBackupRequest(request('GET', '/backups', tokenB), bindings)).status).toBe(401);
  });

  it('f7_worker_rejects_unapproved_origin_and_method', async () => {
    const { privateKey, jwks } = await keyPair();
    const bindings: BackupWorkerBindings = { BACKUPS: new MemoryKV(), FIREBASE_PROJECT_ID: projectId, ALLOWED_ORIGIN: origin,
      ALLOWED_UIDS: 'uid-a', JWKS: jwks };
    const token = await jwt('uid-a', {}, privateKey);
    const badOrigin = new Request('https://worker.example/backups', { method: 'GET', headers: new Headers({ Origin: 'https://evil.example', Authorization: `Bearer ${token}` }) });
    expect((await handleBackupRequest(badOrigin, bindings)).status).toBe(403);
    expect((await handleBackupRequest(request('PUT', '/backups', token), bindings)).status).toBe(405);
  });

  it('f7_no_secrets_or_plain_backup_logged', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { privateKey, jwks } = await keyPair();
    const bindings: BackupWorkerBindings = { BACKUPS: new MemoryKV(), FIREBASE_PROJECT_ID: projectId, ALLOWED_ORIGIN: origin,
      ALLOWED_UIDS: 'uid-a', JWKS: jwks };
    const token = await jwt('uid-a', {}, privateKey);
    await handleBackupRequest(request('GET', '/backups', token), bindings);
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    log.mockRestore();
    error.mockRestore();
  });

  it('f7_worker_rejects_oversized_request', async () => {
    const { privateKey, jwks } = await keyPair();
    const bindings: BackupWorkerBindings = { BACKUPS: new MemoryKV(), FIREBASE_PROJECT_ID: projectId, ALLOWED_ORIGIN: origin,
      ALLOWED_UIDS: 'uid-a', JWKS: jwks };
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
      ALLOWED_UIDS: 'uid-a',
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
      ALLOWED_UIDS: 'uid-a',
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
    expect((await handleBackupRequest(request('DELETE', '/backups/v1', token), bindings)).status).toBe(409);
    expect((await post('v2')).status).toBe(201);
    expect((await handleBackupRequest(request('DELETE', '/backups/v1?replacement=v2', token), bindings)).status).toBe(204);
    expect((await handleBackupRequest(request('DELETE', '/backups/v2?replacement=v1', token), bindings)).status).toBe(409);
  });

  it('f7_worker_lists_backup_timestamps', async () => {
    const { privateKey, jwks } = await keyPair();
    const bindings: BackupWorkerBindings = {
      BACKUPS: new MemoryKV(),
      FIREBASE_PROJECT_ID: projectId,
      ALLOWED_ORIGIN: origin,
      ALLOWED_UIDS: 'uid-a',
      JWKS: jwks,
    };
    const token = await jwt('uid-a', {}, privateKey);
    const createdAt = 1_700_000_000_000;
    const id = `backup-aaaaaaaaaaaaaaaa-${createdAt}`;
    const post = await handleBackupRequest(
      request(
        'POST',
        '/backups',
        token,
        JSON.stringify({
          id,
          encrypted: {
            format: 'eo-v2-encrypted-v1',
            iv: 'a',
            ciphertext: 'b',
            wrappedKey: 'c',
            kdf: { name: 'PBKDF2' },
          },
        }),
        { 'Content-Type': 'application/json' },
      ),
      bindings,
    );
    expect(post.status).toBe(201);
    const listed = await handleBackupRequest(request('GET', '/backups', token), bindings);
    const body = (await listed.json()) as { items: Array<{ id: string; createdAt: string }> };
    expect(body.items[0]).toMatchObject({
      id,
      createdAt: new Date(createdAt).toISOString(),
    });
  });

  it('f7_worker_lists_every_page_of_backups', async () => {
    const { privateKey, jwks } = await keyPair();
    const kv = new MemoryKV();
    kv.pageSize = 2;
    const bindings: BackupWorkerBindings = {
      BACKUPS: kv,
      FIREBASE_PROJECT_ID: projectId,
      ALLOWED_ORIGIN: origin,
      ALLOWED_UIDS: 'uid-a',
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
    const ids = ['v1', 'v2', 'v3'];
    const post = (id: string) =>
      handleBackupRequest(
        request('POST', '/backups', token, JSON.stringify({ id, encrypted }), {
          'Content-Type': 'application/json',
        }),
        bindings,
      );
    for (const id of ids) {
      expect((await post(id)).status).toBe(201);
    }
    const listed = await handleBackupRequest(request('GET', '/backups', token), bindings);
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as { items: Array<{ id: string }> };
    expect(body.items.map((item) => item.id).sort()).toEqual(ids);
    expect(kv.listCalls.map((call) => call.cursor)).toEqual([undefined, '2']);
    expect(kv.listCalls.every((call) => call.prefix === 'backups/uid-a/')).toBe(true);
  });

  it('f7_worker_delete_requires_a_live_replacement', async () => {
    const { privateKey, jwks } = await keyPair();
    const kv = new MemoryKV();
    kv.pageSize = 1;
    const bindings: BackupWorkerBindings = {
      BACKUPS: kv,
      FIREBASE_PROJECT_ID: projectId,
      ALLOWED_ORIGIN: origin,
      ALLOWED_UIDS: 'uid-a',
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
    expect((await post('v2')).status).toBe(201);
    expect((await handleBackupRequest(request('DELETE', '/backups/v1', token), bindings)).status).toBe(409);
    const deleted = await handleBackupRequest(request('DELETE', '/backups/v1?replacement=v2', token), bindings);
    expect(deleted.status).toBe(204);
    expect((await handleBackupRequest(request('DELETE', '/backups/v2?replacement=v1', token), bindings)).status).toBe(409);
    expect(await kv.get('backups/uid-a/v1')).toBeNull();
    expect(await kv.get('backups/uid-a/v2')).not.toBeNull();
  });

  it('f7_worker_preflight_and_auth_errors_do_not_leak_the_allowlist', async () => {
    const { privateKey, jwks } = await keyPair();
    const bindings: BackupWorkerBindings = {
      BACKUPS: new MemoryKV(),
      FIREBASE_PROJECT_ID: projectId,
      ALLOWED_ORIGIN: origin,
      ALLOWED_UIDS: 'uid-a',
      JWKS: jwks,
    };
    const preflight = await handleBackupRequest(request('OPTIONS', '/backups'), bindings);
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(preflight.headers.get('Access-Control-Allow-Methods')).toContain('GET');

    const tokenB = await jwt('uid-b', {}, privateKey);
    const denied = await handleBackupRequest(request('GET', '/backups', tokenB), bindings);
    expect(denied.status).toBe(401);
    const deniedBody = await denied.text();
    expect(JSON.parse(deniedBody)).toEqual({ error: 'AUTH' });
    expect(deniedBody).not.toContain('uid-a');
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBe(origin);

    const badOrigin = await handleBackupRequest(
      new Request('https://worker.example/backups', {
        method: 'GET',
        headers: new Headers({ Origin: 'https://evil.example', Authorization: 'Bearer ' + tokenB }),
      }),
      bindings,
    );
    expect(badOrigin.status).toBe(403);
    expect(badOrigin.headers.get('Access-Control-Allow-Origin')).toBe(origin);
  });

  it('f7_worker_rejects_an_invalid_backup_path_id', async () => {
    const { privateKey, jwks } = await keyPair();
    const bindings: BackupWorkerBindings = {
      BACKUPS: new MemoryKV(),
      FIREBASE_PROJECT_ID: projectId,
      ALLOWED_ORIGIN: origin,
      ALLOWED_UIDS: 'uid-a',
      JWKS: jwks,
    };
    const token = await jwt('uid-a', {}, privateKey);
    const response = await handleBackupRequest(request('GET', '/backups/bad.id', token), bindings);
    expect(response.status).toBe(400);
  });

  it('f7_worker_cross_uid_delete_never_removes_the_other_namespace', async () => {
    const { privateKey, jwks } = await keyPair();
    const kv = new MemoryKV();
    const bindings: BackupWorkerBindings = {
      BACKUPS: kv,
      FIREBASE_PROJECT_ID: projectId,
      ALLOWED_ORIGIN: origin,
      ALLOWED_UIDS: 'uid-a,uid-b',
      JWKS: jwks,
    };
    const tokenA = await jwt('uid-a', {}, privateKey);
    const tokenB = await jwt('uid-b', {}, privateKey);
    const encrypted = {
      format: 'eo-v2-encrypted-v1',
      iv: 'a',
      ciphertext: 'b',
      wrappedKey: 'c',
      kdf: { name: 'PBKDF2' },
    };
    const post = (token: string, id: string) =>
      handleBackupRequest(
        request('POST', '/backups', token, JSON.stringify({ id, encrypted }), {
          'Content-Type': 'application/json',
        }),
        bindings,
      );
    expect((await post(tokenA, 'a-1')).status).toBe(201);
    expect((await post(tokenB, 'b-1')).status).toBe(201);
    expect((await post(tokenB, 'b-2')).status).toBe(201);

    expect((await handleBackupRequest(request('DELETE', '/backups/a-1?replacement=b-1', tokenB), bindings)).status).toBe(204);
    expect(await kv.get('backups/uid-a/a-1')).not.toBeNull();
    expect(await kv.get('backups/uid-b/b-1')).not.toBeNull();
    expect(await kv.get('backups/uid-b/b-2')).not.toBeNull();

    // A has only one own copy, so LAST_COPY blocks before any deletion attempt.
    expect((await handleBackupRequest(request('DELETE', '/backups/b-1', tokenA), bindings)).status).toBe(409);
    expect((await handleBackupRequest(request('DELETE', '/backups/b-1?replacement=a-1', tokenA), bindings)).status).toBe(204);
    expect(await kv.get('backups/uid-b/b-1')).not.toBeNull();
    expect(await kv.get('backups/uid-a/a-1')).not.toBeNull();
  });
});
