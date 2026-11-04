import { inspectF7Backup, type F7BackupSnapshot } from './f7-format';

export type EncryptedBackup = {
  format: 'eo-v2-encrypted-v1';
  alg: 'AES-256-GCM';
  iv: string;
  ciphertext: string;
  wrappedKey: string;
  kdf: {
    name: 'PBKDF2';
    salt: string;
    iterations: number;
    hash: 'SHA-256';
  };
};

export type BackupCryptoErrorCode =
  | 'UNAVAILABLE'
  | 'INVALID_KEY'
  | 'AUTHENTICATION_FAILED'
  | 'INVALID_SNAPSHOT';

export class BackupCryptoError extends Error {
  readonly code: BackupCryptoErrorCode;

  constructor(code: BackupCryptoErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'BackupCryptoError';
    this.code = code;
  }
}

export const DEFAULT_PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function subtle(): SubtleCrypto {
  const value = globalThis.crypto?.subtle;
  if (!value) throw new BackupCryptoError('UNAVAILABLE', 'Web Crypto is unavailable');
  return value;
}

function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function createBackupKey(): Promise<CryptoKey> {
  return subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function encryptBackup(
  snapshot: F7BackupSnapshot,
  key: CryptoKey,
): Promise<{ iv: string; ciphertext: string }> {
  const iv = randomBytes(IV_BYTES);
  const plaintext = new TextEncoder().encode(JSON.stringify(snapshot));
  const ciphertext = await subtle().encrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv) },
    key,
    asBufferSource(plaintext),
  );
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
}

async function deriveWrappingKey(
  recoverySecret: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const base = await subtle().importKey(
    'raw',
    asBufferSource(new TextEncoder().encode(recoverySecret)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle().deriveKey(
    { name: 'PBKDF2', salt: asBufferSource(salt), iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

export async function wrapBackupKey(
  key: CryptoKey,
  recoverySecret: string,
): Promise<{ wrappedKey: string; kdf: EncryptedBackup['kdf'] }> {
  if (!recoverySecret.trim()) throw new BackupCryptoError('INVALID_KEY', 'recovery secret is required');
  const salt = randomBytes(SALT_BYTES);
  const wrappingKey = await deriveWrappingKey(recoverySecret, salt, DEFAULT_PBKDF2_ITERATIONS);
  const wrapped = await subtle().wrapKey('raw', key, wrappingKey, 'AES-KW');
  return {
    wrappedKey: bytesToBase64(new Uint8Array(wrapped)),
    kdf: {
      name: 'PBKDF2',
      salt: bytesToBase64(salt),
      iterations: DEFAULT_PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
  };
}

export async function encryptSnapshot(
  snapshot: F7BackupSnapshot,
  recoverySecret: string,
): Promise<EncryptedBackup> {
  const key = await createBackupKey();
  const encrypted = await encryptBackup(snapshot, key);
  const wrapped = await wrapBackupKey(key, recoverySecret);
  return {
    format: 'eo-v2-encrypted-v1',
    alg: 'AES-256-GCM',
    iv: encrypted.iv,
    ciphertext: encrypted.ciphertext,
    wrappedKey: wrapped.wrappedKey,
    kdf: wrapped.kdf,
  };
}

export async function decryptBackup(
  envelope: EncryptedBackup,
  recoverySecret: string,
): Promise<F7BackupSnapshot> {
  if (
    !envelope ||
    envelope.format !== 'eo-v2-encrypted-v1' ||
    envelope.alg !== 'AES-256-GCM' ||
    typeof envelope.iv !== 'string' ||
    typeof envelope.ciphertext !== 'string' ||
    typeof envelope.wrappedKey !== 'string' ||
    envelope.kdf?.name !== 'PBKDF2' ||
    envelope.kdf.hash !== 'SHA-256'
  ) {
    throw new BackupCryptoError('AUTHENTICATION_FAILED', 'invalid encrypted envelope');
  }
  if (!recoverySecret.trim()) throw new BackupCryptoError('INVALID_KEY', 'recovery secret is required');
  if (
    !Number.isInteger(envelope.kdf.iterations) ||
    envelope.kdf.iterations < 100_000 ||
    envelope.kdf.iterations > 1_000_000
  ) {
    throw new BackupCryptoError('AUTHENTICATION_FAILED', 'invalid PBKDF2 iteration count');
  }

  let key: CryptoKey;
  try {
    const salt = base64ToBytes(envelope.kdf.salt);
    if (salt.length < 16) {
      throw new BackupCryptoError('AUTHENTICATION_FAILED', 'invalid PBKDF2 salt');
    }
    const wrappingKey = await deriveWrappingKey(recoverySecret, salt, envelope.kdf.iterations);
    key = await subtle().unwrapKey(
      'raw',
      asBufferSource(base64ToBytes(envelope.wrappedKey)),
      wrappingKey,
      'AES-KW',
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
  } catch (error) {
    throw new BackupCryptoError('INVALID_KEY', 'recovery secret cannot unwrap the backup key', {
      cause: error,
    });
  }

  let plaintext: ArrayBuffer;
  try {
    plaintext = await subtle().decrypt(
      { name: 'AES-GCM', iv: asBufferSource(base64ToBytes(envelope.iv)) },
      key,
      asBufferSource(base64ToBytes(envelope.ciphertext)),
    );
  } catch (error) {
    throw new BackupCryptoError('AUTHENTICATION_FAILED', 'backup authentication failed', {
      cause: error,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(plaintext));
  } catch (error) {
    throw new BackupCryptoError('INVALID_SNAPSHOT', 'backup payload is not JSON', { cause: error });
  }
  const inspected = await inspectF7Backup(parsed);
  if (inspected.kind !== 'VALID') {
    throw new BackupCryptoError('INVALID_SNAPSHOT', `backup is ${inspected.kind}`);
  }
  return inspected.snapshot;
}
