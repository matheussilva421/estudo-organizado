type AssetsBinding = {
  fetch(request: Request): Promise<Response>;
};

export type SiteWorkerEnv = {
  ASSETS: AssetsBinding;
  FIREBASE_PROJECT_ID?: string;
};

const RESERVED_PREFIX = '/__/';
const APPROVED_PROJECT_IDS = new Set(['eo-v2-f7-test-20261117']);
const FORWARDED_HEADERS = new Set([
  'accept',
  'accept-language',
  'content-type',
  'origin',
  'referer',
  'user-agent',
  'x-requested-with',
]);

type WorkerRequestInit = RequestInit & { duplex?: 'half' };

function isolatedFirebaseHost(projectId: string | undefined): string | null {
  const normalized = projectId?.trim().toLowerCase() ?? '';
  if (!/^[a-z0-9][a-z0-9-]{2,61}$/.test(normalized)) return null;
  if (!APPROVED_PROJECT_IDS.has(normalized)) return null;
  return `${normalized}.firebaseapp.com`;
}

function forwardInit(request: Request): WorkerRequestInit {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (FORWARDED_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  const init: WorkerRequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
    init.body = request.body;
    init.duplex = 'half';
  }
  return init;
}

export default {
  async fetch(request: Request, env: SiteWorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(RESERVED_PREFIX)) {
      return env.ASSETS.fetch(request);
    }

    const firebaseHost = isolatedFirebaseHost(env.FIREBASE_PROJECT_ID);
    if (!firebaseHost) {
      return new Response('Firebase auth proxy is not configured', {
        status: 500,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }

    const upstream = new URL(url);
    upstream.protocol = 'https:';
    upstream.host = firebaseHost;
    upstream.port = '';

    // The Firebase handler may redirect to accounts.google.com; preserve that
    // response instead of following it inside the Worker.
    return fetch(upstream.toString(), forwardInit(request));
  },
};
