const ALLOWED_ORIGINS = [
    // Add your app origins here, e.g.:
    // 'https://estudo.yourdomain.com',
    // 'http://localhost:8080',
];

const KV_KEY = 'estudo_estado_v1';
const META_KEY = 'estudo_meta_v1';
const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5MB limit

function getAllowedOrigins(env) {
    const configured = env?.ALLOWED_ORIGINS || '';
    const origins = configured
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);

    return origins.length > 0 ? origins : ALLOWED_ORIGINS;
}

function resolveOriginPolicy(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = getAllowedOrigins(env);
    if (allowedOrigins.length === 0) {
        return { allowed: true, allowOrigin: origin || '*' };
    }

    if (!origin) {
        return { allowed: true, allowOrigin: allowedOrigins[0] };
    }

    const allowed = allowedOrigins.includes(origin);
    return { allowed, allowOrigin: allowed ? origin : allowedOrigins[0] };
}

function corsHeaders(request, env) {
    const { allowOrigin } = resolveOriginPolicy(request, env);

    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };
}

function json(data, status, headers) {
    return new Response(JSON.stringify(data), { status, headers });
}

function toIsoTimestamp(value) {
    if (!value) return new Date().toISOString();
    if (typeof value === 'number') return new Date(value).toISOString();
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? new Date().toISOString() : new Date(time).toISOString();
}

function getPayloadUpdatedAt(parsed) {
    if (parsed.payloadUpdatedAt) return toIsoTimestamp(parsed.payloadUpdatedAt);
    if (parsed.updatedAt) return toIsoTimestamp(parsed.updatedAt);
    if (parsed.payload?.config?._lastUpdated) return toIsoTimestamp(parsed.payload.config._lastUpdated);
    return new Date().toISOString();
}

function normalizeIncomingMeta(parsed) {
    const payloadUpdatedAt = getPayloadUpdatedAt(parsed);
    return {
        updatedAt: payloadUpdatedAt,
        payloadUpdatedAt,
        sentAt: toIsoTimestamp(parsed.sentAt),
        baseRemoteUpdatedAt: parsed.baseRemoteUpdatedAt || null,
        deviceId: parsed.deviceId || 'unknown',
        version: parsed.version || 0
    };
}

export default {
    async fetch(request, env, ctx) {
        const headers = corsHeaders(request, env);
        const originPolicy = resolveOriginPolicy(request, env);

        if (request.method === 'OPTIONS') {
            if (!originPolicy.allowed) {
                return json({ error: 'Origin not allowed' }, 403, headers);
            }
            return new Response(null, { status: 204, headers });
        }

        if (request.method !== 'GET' && request.method !== 'POST') {
            return json({ error: 'Method not allowed' }, 405, headers);
        }

        if (!originPolicy.allowed) {
            return json({ error: 'Origin not allowed' }, 403, headers);
        }

        const authHeader = request.headers.get('Authorization');
        if (!authHeader || authHeader !== `Bearer ${env.AUTH_TOKEN}`) {
            return json({ error: 'Unauthorized: Verifique seu Auth Token' }, 401, headers);
        }

        try {
            // GET: return current data + metadata
            if (request.method === 'GET') {
                const [data, meta] = await Promise.all([
                    env.ESTUDO_KV.get(KV_KEY),
                    env.ESTUDO_KV.get(META_KEY)
                ]);

                if (!data) {
                    return json({ success: true, data: null }, 200, headers);
                }

                const response = { success: true };
                // If meta exists, include it so client can compare timestamps
                if (meta) {
                    try {
                        response.meta = JSON.parse(meta);
                    } catch (e) { /* ignore malformed meta */ }
                }
                // Return raw data for backward compat — client unwraps
                return new Response(data, { headers: { ...headers, 'Content-Type': 'application/json' }, status: 200 });
            }

            // POST: validate, check overwrite, store
            if (request.method === 'POST') {
                const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
                if (contentLength > MAX_BODY_SIZE) {
                    return json({ error: 'Payload too large (max 5MB)' }, 413, headers);
                }

                const body = await request.text();

                let parsed;
                try {
                    parsed = JSON.parse(body);
                } catch (e) {
                    return json({ error: 'Invalid JSON payload' }, 400, headers);
                }

                // Extract metadata from envelope if present
                const incomingMeta = normalizeIncomingMeta(parsed);

                // Check existing metadata for overwrite protection
                const existingMeta = await env.ESTUDO_KV.get(META_KEY);
                if (existingMeta && !parsed.forceOverwrite) {
                    try {
                        const meta = JSON.parse(existingMeta);
                        const remoteUpdatedAt = meta.updatedAt || meta.payloadUpdatedAt || null;
                        const hasBaseRemote = Object.prototype.hasOwnProperty.call(parsed, 'baseRemoteUpdatedAt');

                        // Modern clients must prove they are based on the latest remote snapshot.
                        if (hasBaseRemote && (parsed.baseRemoteUpdatedAt || null) !== remoteUpdatedAt) {
                            return json({
                                error: 'stale sync base: remote changed before this push',
                                remoteUpdatedAt,
                                remoteDeviceId: meta.deviceId
                            }, 409, headers);
                        }

                        if (!hasBaseRemote) {
                            const existingTime = new Date(remoteUpdatedAt).getTime();
                            const incomingTime = new Date(incomingMeta.updatedAt).getTime();
                            // Legacy fallback: reject if incoming data is older than what's stored.
                            if (incomingTime < existingTime) {
                                return json({
                                    error: 'stale data: remote is newer than incoming payload',
                                    remoteUpdatedAt,
                                    remoteDeviceId: meta.deviceId
                                }, 409, headers);
                            }
                        }
                    } catch (e) { /* ignore malformed meta, proceed with write */ }
                }

                // Store data and metadata
                await Promise.all([
                    env.ESTUDO_KV.put(KV_KEY, body),
                    env.ESTUDO_KV.put(META_KEY, JSON.stringify(incomingMeta))
                ]);

                return json({ success: true, message: 'Data synced to Cloudflare KV', meta: incomingMeta }, 200, headers);
            }

        } catch (err) {
            return json({ error: err.message }, 500, headers);
        }
    }
};
