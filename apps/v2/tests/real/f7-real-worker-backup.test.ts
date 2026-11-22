import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptBackup, encryptSnapshot } from '../../src/platform/backup/crypto';
import { snapshotChecksum, type F7BackupSnapshot } from '../../src/platform/backup/f7-format';

const tokensPath = process.env.EO_SYNTHETIC_TOKENS ?? '';
const workerUrl = 'https://estudo-organizado-v2-f7-backup.matheussilva421.workers.dev';
const stagingOrigin = 'https://estudo-organizado-v2-f7-test.matheussilva421.workers.dev';
const recoverySecret = randomBytes(18).toString('base64url');
const runId = Date.now().toString(36);

type StoredTokens = { users: Array<{ uid: string; idToken: string }> };

async function request(token: string, method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(workerUrl + path, {
    method,
    headers: {
      Origin: stagingOrigin,
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function listIds(token: string): Promise<string[]> {
  const response = await request(token, 'GET', '/backups');
  if (response.status !== 200) return [];
  const body = (await response.json()) as { items: Array<{ id: string }> };
  return body.items.map((item) => item.id);
}

async function waitForIds(token: string, expected: string[]): Promise<string[]> {
  let ids: string[] = [];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    ids = await listIds(token);
    if (expected.every((id) => ids.includes(id))) return ids;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return ids;
}

async function syntheticSnapshot(): Promise<F7BackupSnapshot> {
  const payload = {
    subjects: [{ id: 'synthetic-subject', profileId: 'local-default', title: 'Synthetic subject' }],
    meta: [{ key: 'epoch:local-default', epoch: 0 }],
  };
  const manifestFields = {
    formatVersion: 3 as const,
    profileId: 'local-default',
    recordCount: 2,
    epoch: 0,
    deletionHistoryComplete: true,
  };
  const checksum = await snapshotChecksum(manifestFields, payload);
  return { manifest: { ...manifestFields, checksum }, payload };
}

describe.skipIf(!tokensPath)('real backup Worker, AES-GCM and cross-UID isolation', () => {
  it('stores, lists, reads and decrypts a real synthetic backup', async () => {
    const tokens = JSON.parse(await readFile(tokensPath, 'utf8')) as StoredTokens;
    const a = tokens.users.find((user) => user.uid.includes('synthetic-a'))!;
    const b = tokens.users.find((user) => user.uid.includes('synthetic-b'))!;
    expect(a?.idToken).toBeTruthy();
    expect(b?.idToken).toBeTruthy();

    const snapshot = await syntheticSnapshot();
    const encrypted = await encryptSnapshot(snapshot, recoverySecret);
    const firstId = `backup-${runId}-${Date.now()}`;
    const secondId = `backup-${runId}-${Date.now() + 1}`;

    const created = await request(a.idToken, 'POST', '/backups', { id: firstId, encrypted });
    expect(created.status).toBe(201);
    const anchorResponse = await request(a.idToken, 'GET', '/backups/anchor');
    expect(anchorResponse.status).toBe(200);
    const anchorBody = (await anchorResponse.json()) as { id: string };
    expect(anchorBody.id).toMatch(/^anchor-/);

    const listedIds = await waitForIds(a.idToken, [firstId]);
    expect(listedIds).toContain(firstId);

    const fetched = await request(a.idToken, 'GET', `/backups/${firstId}`);
    expect(fetched.status).toBe(200);
    const fetchedEnvelope = await fetched.json();
    const restored = await decryptBackup(fetchedEnvelope, recoverySecret);
    expect(restored).toEqual(snapshot);

    const wrongKey = await decryptBackup(fetchedEnvelope, 'wrong-secret').then(
      () => 'UNEXPECTED',
      (error) => error?.code ?? 'ERROR',
    );
    expect(wrongKey).toBe('INVALID_KEY');

    const crossRead = await request(b.idToken, 'GET', `/backups/${firstId}`);
    expect(crossRead.status).toBe(404);
    const crossAnchor = await request(b.idToken, 'GET', '/backups/anchor');
    expect(crossAnchor.status).toBe(404);
    const crossList = await request(b.idToken, 'GET', '/backups');
    expect(crossList.status).toBe(200);
    const crossBody = (await crossList.json()) as { items: Array<{ id: string }> };
    expect(crossBody.items.map((item) => item.id)).not.toContain(firstId);

    const second = await request(a.idToken, 'POST', '/backups', { id: secondId, encrypted });
    expect(second.status).toBe(201);
    const bothIds = await waitForIds(a.idToken, [firstId, secondId]);
    expect(bothIds).toEqual(expect.arrayContaining([firstId, secondId]));
    const deleted = await request(a.idToken, 'DELETE', `/backups/${firstId}?replacement=${secondId}`);
    expect(deleted.status).toBe(204);
    const lastCopy = await request(a.idToken, 'DELETE', `/backups/${secondId}`);
    expect(lastCopy.status).toBe(409);
    const crossDelete = await request(b.idToken, 'DELETE', `/backups/${secondId}?replacement=${firstId}`);
    expect(crossDelete.status).toBe(409);
    const preserved = await request(a.idToken, 'GET', `/backups/${secondId}`);
    expect(preserved.status).toBe(200);
    const deleteAnchor = await request(a.idToken, 'DELETE', `/backups/${anchorBody.id}`);
    expect(deleteAnchor.status).toBe(409);
    const deleteLastRegular = await request(a.idToken, 'DELETE', `/backups/${secondId}?replacement=${anchorBody.id}`);
    expect(deleteLastRegular.status).toBe(204);
    const anchorStillThere = await request(a.idToken, 'GET', '/backups/anchor');
    expect(anchorStillThere.status).toBe(200);
  });
});
