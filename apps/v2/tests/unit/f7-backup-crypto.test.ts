import { describe, expect, it } from 'vitest';
import {
  BackupCryptoError,
  createBackupKey,
  decryptBackup,
  encryptSnapshot,
  encryptBackup,
  wrapBackupKey,
} from '../../src/platform/backup/crypto';
import type { F7BackupSnapshot } from '../../src/platform/backup/f7-format';
import { digestPayload } from '../../src/platform/sync/firebase-remote';

async function snapshot(): Promise<F7BackupSnapshot> {
  const payload = {
    editais: [{ id: 'edital-1', profileId: 'profile-crypto', title: 'Segredo Acadêmico' }],
  };
  return {
    manifest: {
      formatVersion: 3,
      profileId: 'profile-crypto',
      recordCount: 1,
      checksum: await digestPayload(payload),
      epoch: 1,
      deletionHistoryComplete: true,
    },
    payload,
  };
}

describe('F7 backup crypto', () => {
  it('f7_encrypt_decrypt_roundtrip', async () => {
    const original = await snapshot();
    const envelope = await encryptSnapshot(original, 'senha-de-recuperacao');
    await expect(decryptBackup(envelope, 'senha-de-recuperacao')).resolves.toEqual(original);
  });

  it('f7_ciphertext_contains_no_plain_academic_data', async () => {
    const envelope = await encryptSnapshot(await snapshot(), 'senha');
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(envelope.ciphertext), (char) => char.charCodeAt(0)),
    );
    expect(decoded).not.toContain('Segredo Acadêmico');
    expect(envelope.ciphertext).not.toContain('Segredo');
  });

  it('f7_wrong_password_fails_closed', async () => {
    const envelope = await encryptSnapshot(await snapshot(), 'senha');
    await expect(decryptBackup(envelope, 'senha-errada')).rejects.toBeInstanceOf(BackupCryptoError);
  });

  it('f7_modified_ciphertext_fails_authentication', async () => {
    const envelope = await encryptSnapshot(await snapshot(), 'senha');
    const bytes = Uint8Array.from(atob(envelope.ciphertext), (char) => char.charCodeAt(0));
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    const modified = {
      ...envelope,
      ciphertext: btoa(String.fromCharCode(...bytes)),
    };
    await expect(decryptBackup(modified, 'senha')).rejects.toMatchObject({
      code: 'AUTHENTICATION_FAILED',
    });
  });

  it('f7_new_iv_per_encryption', async () => {
    const original = await snapshot();
    const first = await encryptSnapshot(original, 'senha');
    const second = await encryptSnapshot(original, 'senha');
    expect(first.iv).not.toBe(second.iv);
  });

  it('f7_recovery_key_works_on_new_device', async () => {
    const original = await snapshot();
    const key = await createBackupKey();
    const encrypted = await encryptBackup(original, key);
    const wrapped = await wrapBackupKey(key, 'chave-de-recuperacao');
    const envelope = {
      format: 'eo-v2-encrypted-v1' as const,
      alg: 'AES-256-GCM' as const,
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext,
      wrappedKey: wrapped.wrappedKey,
      kdf: wrapped.kdf,
    };
    await expect(decryptBackup(envelope, 'chave-de-recuperacao')).resolves.toEqual(original);
  });

  it('f7_no_exportable_plain_key_in_backup', async () => {
    const key = await createBackupKey();
    const raw = await crypto.subtle.exportKey('raw', key);
    const rawBase64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
    const envelope = await encryptSnapshot(await snapshot(), 'senha');
    expect(JSON.stringify(envelope)).not.toContain(rawBase64);
    expect(envelope).not.toHaveProperty('key');
  });
});
