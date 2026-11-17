export type JwksPort = {
  getKey(kid: string): Promise<JsonWebKey | null>;
};

export function createGoogleJwksPort(
  fetchImpl: (input: string) => Promise<Response> = (input) => fetch(input),
  now = () => Date.now(),
): JwksPort {
  let cache: { keys: Map<string, JsonWebKey>; expiresAt: number; refreshedAt: number } | null = null;
  const refresh = async (): Promise<void> => {
    const response = await fetchImpl(
      'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
    );
    if (!response.ok) throw new Error('JWKS_UNAVAILABLE');
    const body = (await response.json()) as { keys?: unknown };
    const keys = new Map<string, JsonWebKey>();
    if (Array.isArray(body.keys)) {
      for (const value of body.keys) {
        if (!isRecord(value)) continue;
        if (typeof value.kid !== 'string' || value.kty !== 'RSA') continue;
        if (typeof value.n !== 'string' || typeof value.e !== 'string') continue;
        keys.set(value.kid, value as JsonWebKey);
      }
    }
    cache = { keys, expiresAt: now() + 60 * 60_000, refreshedAt: now() };
  };
  return {
    async getKey(kid: string): Promise<JsonWebKey | null> {
      if (!cache || now() >= cache.expiresAt) await refresh();
      const cached = cache!.keys.get(kid);
      if (cached) return cached;
      // An unknown kid may indicate Google key rotation. Refresh at most once
      // per minute, so arbitrary kid values cannot create an unbounded fetch.
      if (now() - cache!.refreshedAt < 60_000) return null;
      await refresh();
      return cache!.keys.get(kid) ?? null;
    },
  };
}

export type VerifiedIdentity = { uid: string };

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Verifies a Firebase ID token (RS256) against public JWKS. The caller must
 * still enforce the expected project/issuer; this function never trusts a uid
 * from a path or header.
 */
export async function verifyFirebaseIdToken(
  token: string,
  expected: { projectId: string; issuer: string },
  jwks: JwksPort,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<VerifiedIdentity | null> {
  if (typeof token !== 'string' || !token.trim()) return null;
  if (!expected.projectId.trim() || !expected.issuer.trim()) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  if (!headerPart || !payloadPart || !signaturePart) return null;

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerPart))) as Record<string, unknown>;
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadPart))) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!isRecord(header) || !isRecord(payload)) return null;
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) return null;

  const jwk = await jwks.getKey(header.kid).catch(() => null);
  if (!jwk) return null;
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
  } catch {
    return null;
  }

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      asBufferSource(base64UrlToBytes(signaturePart)),
      asBufferSource(new TextEncoder().encode(`${headerPart}.${payloadPart}`)),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  if (payload.iss !== expected.issuer) return null;
  if (payload.aud !== expected.projectId) return null;
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) return null;
  if (typeof payload.iat !== 'number' || payload.iat > nowSeconds + 300) return null;
  if (
    typeof payload.sub === 'string' &&
    typeof payload.user_id === 'string' &&
    payload.sub !== payload.user_id
  ) {
    return null;
  }
  const uid = typeof payload.user_id === 'string' ? payload.user_id : payload.sub;
  if (typeof uid !== 'string' || !uid.trim()) return null;
  return { uid };
}
