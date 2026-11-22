// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  createKvBackupPort,
  createR2BackupPort,
  R2_ENABLED,
  type KvFetch,
} from '../../src/platform/backup/kv-client';
import type { EncryptedBackup } from '../../src/platform/backup/crypto';

const encrypted: EncryptedBackup = {
  format: 'eo-v2-encrypted-v1',
  alg: 'AES-256-GCM',
  iv: 'iv',
  ciphertext: 'ciphertext',
  wrappedKey: 'wrapped',
  kdf: { name: 'PBKDF2', salt: 'salt', iterations: 210_000, hash: 'SHA-256' },
};

class MemoryServer {
  readonly docs = new Map<string, string>();
  failPost = 0;
  missNextRead = false;
  calls = 0;
  lastDeleteUrl = '';

  fetch: KvFetch = async (input, init = {}) => {
    this.calls += 1;
    const url = new URL(input);
    const method = init.method ?? 'GET';
    if (method === 'POST') {
      if (this.failPost) return new Response('{}', { status: this.failPost });
      const body = JSON.parse(String(init.body)) as { id: string; encrypted: EncryptedBackup };
      const serialized = JSON.stringify(body.encrypted);
      const existing = this.docs.get(body.id);
      if (existing && existing !== serialized) return new Response('{}', { status: 409 });
      this.docs.set(body.id, serialized);
      return new Response(JSON.stringify({ id: body.id }), { status: 201 });
    }
    if (method === 'GET' && url.pathname === '/backups') {
      return new Response(JSON.stringify({ items: [...this.docs.keys()].map((id) => ({ id, createdAt: 'now', size: this.docs.get(id)?.length ?? 0 })) }), { status: 200 });
    }
    if (method === 'GET') {
      if (this.missNextRead) {
        this.missNextRead = false;
        return new Response('{}', { status: 404 });
      }
      const id = decodeURIComponent(url.pathname.split('/').pop() ?? '');
      const stored = this.docs.get(id);
      return stored ? new Response(stored, { status: 200 }) : new Response('{}', { status: 404 });
    }
    if (method === 'DELETE') {
      this.lastDeleteUrl = url.toString();
      const id = decodeURIComponent(url.pathname.split('/').pop() ?? '');
      this.docs.delete(id);
      return new Response(null, { status: 204 });
    }
    return new Response('{}', { status: 405 });
  };
}

function port(server: MemoryServer, options: { expectedUid?: string; maxBytes?: number } = {}) {
  return createKvBackupPort('https://worker.example', async () => 'token', {
    fetch: server.fetch,
    ...options,
  });
}

describe('F7 KV storage', () => {
  it('f7_backup_id_immutable', async () => {
    const server = new MemoryServer();
    const kv = port(server);
    await expect(kv.put({ uid: 'uid-a', id: 'v1', encrypted })).resolves.toBe('VERIFIED');
    await expect(
      kv.put({ uid: 'uid-a', id: 'v1', encrypted: { ...encrypted, ciphertext: 'other' } }),
    ).resolves.toBe('FAILED');
  });

  it('f7_duplicate_upload_idempotent', async () => {
    const server = new MemoryServer();
    const kv = port(server);
    await expect(kv.put({ uid: 'uid-a', id: 'v1', encrypted })).resolves.toBe('VERIFIED');
    await expect(kv.put({ uid: 'uid-a', id: 'v1', encrypted })).resolves.toBe('VERIFIED');
  });

  it('f7_upload_refuses_a_switched_identity_before_writing', async () => {
    const server = new MemoryServer();
    const kv = createKvBackupPort('https://worker.example', async () => 'token-b', {
      fetch: server.fetch,
      expectedUid: 'uid-a',
      getCurrentUid: async () => 'uid-b',
    });
    await expect(kv.put({ uid: 'uid-a', id: 'v1', encrypted })).resolves.toBe('FAILED');
    expect(server.calls).toBe(0);
    expect(server.docs.size).toBe(0);
  });

  it('f7_reads_and_deletes_refuse_a_switched_identity', async () => {
    const server = new MemoryServer();
    server.docs.set('v1', JSON.stringify(encrypted));
    const kv = createKvBackupPort('https://worker.example', async () => 'token-b', {
      fetch: server.fetch,
      expectedUid: 'uid-a',
      getCurrentUid: async () => 'uid-b',
    });
    await expect(kv.get('v1')).resolves.toBeNull();
    await expect(kv.list()).resolves.toEqual([]);
    await expect(kv.deleteVerifiedOldVersion('v1', 'v2')).resolves.toBe(false);
    expect(server.calls).toBe(0);
    expect(server.docs.has('v1')).toBe(true);
  });

  it('f7_delete_requires_a_distinct_replacement_id', async () => {
    const server = new MemoryServer();
    server.docs.set('v1', JSON.stringify(encrypted));
    server.docs.set('v2', JSON.stringify(encrypted));
    const kv = port(server);
    await expect(kv.deleteVerifiedOldVersion('v1', 'v1')).resolves.toBe(false);
    await expect(kv.deleteVerifiedOldVersion('v1', 'bad.id')).resolves.toBe(false);
    await expect(kv.deleteVerifiedOldVersion('v1', 'v2')).resolves.toBe(true);
    expect(server.lastDeleteUrl).toContain('replacement=v2');
  });

  it('f7_remote_readback_required_before_success', async () => {
    const server = new MemoryServer();
    const kv = port(server);
    server.missNextRead = true;
    await expect(kv.put({ uid: 'uid-a', id: 'v1', encrypted })).resolves.toBe('PENDING');
    await expect(kv.put({ uid: 'uid-a', id: 'v1', encrypted })).resolves.toBe('VERIFIED');
  });

  it('f7_kv_eventual_consistency_not_false_success', async () => {
    const server = new MemoryServer();
    const kv = port(server);
    server.missNextRead = true;
    await expect(kv.put({ uid: 'uid-a', id: 'v1', encrypted })).resolves.toBe('PENDING');
  });

  it('f7_wrong_uid_denied', async () => {
    const server = new MemoryServer();
    const kv = port(server, { expectedUid: 'uid-a' });
    await expect(kv.put({ uid: 'uid-b', id: 'v1', encrypted })).resolves.toBe('FAILED');
    expect(server.calls).toBe(0);
  });

  it('f7_25mib_value_blocks_cloud_upload', async () => {
    const server = new MemoryServer();
    const kv = port(server, { maxBytes: 100 });
    await expect(
      kv.put({ uid: 'uid-a', id: 'v1', encrypted: { ...encrypted, ciphertext: 'x'.repeat(200) } }),
    ).resolves.toBe('QUOTA');
    expect(server.calls).toBe(0);
  });

  it('f7_cloudflare_quota_failure_keeps_local_export', async () => {
    const server = new MemoryServer();
    server.failPost = 429;
    const kv = port(server);
    await expect(kv.put({ uid: 'uid-a', id: 'v1', encrypted })).resolves.toBe('QUOTA');
  });

  it('f7_r2_disabled_without_billing_guarantee', () => {
    expect(R2_ENABLED).toBe(false);
    expect(() => createR2BackupPort()).toThrow(/billable/i);
  });
});
