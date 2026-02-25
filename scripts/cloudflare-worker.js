export default {
    async fetch(request, env, ctx) {
        // Tratamento de CORS para permitir que o navegador se comunique com o Worker
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                }
            });
        }

        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        };

        // Autenticação básica via Header Authorization
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || authHeader !== `Bearer ${env.AUTH_TOKEN}`) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Verifique seu Auth Token' }), {
                status: 401,
                headers
            });
        }

        // A chave usada para armazenar e resgatar o estado no KV
        const KV_KEY = 'estudo_estado_v1';

        try {
            // 1. Método GET: Baixar dados para o app
            if (request.method === 'GET') {
                const data = await env.ESTUDO_KV.get(KV_KEY);
                if (!data) {
                    return new Response(JSON.stringify({ success: true, data: null }), { headers });
                }
                // data aqui já é a string JSON salva do store.js
                return new Response(data, { headers, status: 200 });
            }

            // 2. Método POST: Subir dados do app para a Cloudflare
            if (request.method === 'POST') {
                const body = await request.text();

                // Colocando os dados no banco KV.
                // Opcional: configurar uma expiração se necessário, mas para sync deixamos permanente.
                await env.ESTUDO_KV.put(KV_KEY, body);

                return new Response(JSON.stringify({ success: true, message: 'Data synced to Cloudflare KV' }), {
                    headers,
                    status: 200
                });
            }

            return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
        }
    }
};
