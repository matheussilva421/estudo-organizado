const ALLOWED_ORIGINS = [
    // Add your app origins here, e.g.:
    // 'https://estudo.yourdomain.com',
    // 'http://localhost:8080',
];

const KV_KEY = 'estudo_estado_v1';
const META_KEY = 'estudo_meta_v1';
const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5MB limit

function corsHeaders(request) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.length > 0
        ? ALLOWED_ORIGINS.includes(origin)
        : true; // If no origins configured, allow all (backward compat)

    return {
        'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0] || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };
}

function json(data, status, headers) {
    return new Response(JSON.stringify(data), { status, headers });
}

export default {
    async fetch(request, env, ctx) {
        const headers = corsHeaders(request);

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers });
        }

        if (request.method !== 'GET' && request.method !== 'POST') {
            return json({ error: 'Method not allowed' }, 405, headers);
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
                const incomingMeta = {
                    updatedAt: parsed.updatedAt || new Date().toISOString(),
                    deviceId: parsed.deviceId || 'unknown',
                    version: parsed.version || 0
                };

                // Check existing metadata for overwrite protection
                const existingMeta = await env.ESTUDO_KV.get(META_KEY);
                if (existingMeta && !parsed.forceOverwrite) {
                    try {
                        const meta = JSON.parse(existingMeta);
                        const existingTime = new Date(meta.updatedAt).getTime();
                        const incomingTime = new Date(incomingMeta.updatedAt).getTime();
                        // Reject if incoming data is older than what's stored
                        if (incomingTime < existingTime) {
                            return json({
                                error: 'Stale data: remote is newer than incoming payload',
                                remoteUpdatedAt: meta.updatedAt,
                                remoteDeviceId: meta.deviceId
                            }, 409, headers);
                        }
                    } catch (e) { /* ignore malformed meta, proceed with write */ }
                }

                // Store data and metadata
                await Promise.all([
                    env.ESTUDO_KV.put(KV_KEY, body),
                    env.ESTUDO_KV.put(META_KEY, JSON.stringify(incomingMeta))
                ]);

                return json({ success: true, message: 'Data synced to Cloudflare KV' }, 200, headers);
            }

        } catch (err) {
            return json({ error: err.message }, 500, headers);
        }
    }
};
