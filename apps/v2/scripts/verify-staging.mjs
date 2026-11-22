#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const V1_MARKERS = [
  'app-de-estudos-14564',
  'estudo-organizado.matheussilva421.workers.dev',
];

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasArgument(name) {
  return process.argv.includes(name);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isV1(value) {
  const lower = String(value ?? '').trim().toLowerCase();
  return V1_MARKERS.some((marker) => lower.includes(marker));
}

function isLoopback(hostname) {
  return ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(hostname.toLowerCase());
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: 'follow', cache: 'no-store' });
  const body = await response.text();
  return { response, body };
}

const rawUrl = argument('--url') ?? process.env.F7_REAL_STAGING_URL;
const projectId = argument('--project-id') ?? process.env.F7_REAL_PROJECT_ID;
const authDomain = argument('--auth-domain') ?? process.env.F7_REAL_AUTH_DOMAIN;
const workerEndpoint = argument('--worker-endpoint') ?? process.env.F7_REAL_BACKUP_ENDPOINT;
const buildSha = argument('--build-sha') ?? process.env.F7_BUILD_SHA ?? '';
const output = argument('--out');
const allowHttp = hasArgument('--allow-http');
const selfTest = hasArgument('--self-test');

if (!rawUrl || (!selfTest && (!projectId || !authDomain || !workerEndpoint))) {
  console.error('Usage: node scripts/verify-staging.mjs --url <https-url> --project-id <id> --auth-domain <host> --worker-endpoint <url> [--build-sha <sha>] [--out <json>]');
  process.exit(2);
}

const failures = [];
let base;
try {
  base = new URL(rawUrl);
} catch {
  console.error('Invalid staging URL');
  process.exit(2);
}

const secure = base.protocol === 'https:' || (allowHttp && isLoopback(base.hostname));
if (!secure) failures.push('URL is not HTTPS');
if (isV1(base.href)) failures.push('URL belongs to V1');
if (projectId && isV1(projectId)) failures.push('Firebase project belongs to V1');
if (workerEndpoint && isV1(workerEndpoint)) failures.push('Worker endpoint belongs to V1');
if (!selfTest && authDomain && authDomain !== base.host) {
  failures.push('Configured auth domain must equal the staging host');
}

const root = await fetchText(base);
if (!root.response.ok) failures.push(`Root HTTP ${root.response.status}`);
if (!/<html[\s>]/i.test(root.body)) failures.push('Root is not HTML');
const contentSecurityPolicy = root.response.headers.get('content-security-policy') ?? '';
if (!contentSecurityPolicy.includes("default-src 'self'")) failures.push('Root CSP is missing or incomplete');
if (!contentSecurityPolicy.includes("frame-src 'self'")) {
  failures.push('Root CSP does not allow the same-origin Firebase auth iframe');
}
if (!contentSecurityPolicy.includes("frame-ancestors 'self'")) {
  failures.push('Root CSP does not allow the same-origin Firebase auth iframe to be framed');
}
if ((root.response.headers.get('x-content-type-options') ?? '').toLowerCase() !== 'nosniff') {
  failures.push('Root nosniff header is missing');
}
const crossOriginOpenerPolicy = root.response.headers.get('cross-origin-opener-policy') ?? '';
if (crossOriginOpenerPolicy !== 'same-origin-allow-popups') {
  failures.push('Root COOP header is missing or does not allow Firebase popups');
}

const manifestUrl = new URL('/manifest.webmanifest', base);
const manifestResult = await fetchText(manifestUrl);
let manifest = null;
try {
  manifest = JSON.parse(manifestResult.body);
} catch {
  failures.push('Manifest is not JSON');
}
if (!manifestResult.response.ok) failures.push(`Manifest HTTP ${manifestResult.response.status}`);
if (manifest && manifest.scope !== '/') failures.push('Manifest scope is not root');

const swUrl = new URL('/sw.js', base);
const swResult = await fetchText(swUrl);
if (!swResult.response.ok) failures.push(`SW HTTP ${swResult.response.status}`);
if (!swResult.body.includes('estudo-organizado-v2')) failures.push('SW cache prefix is missing');
if (isV1(swResult.body)) failures.push('SW contains a V1 marker');

const authHandlerUrl = new URL('/__/auth/handler', base);
const authHandlerResult = await fetchText(authHandlerUrl);
if (!authHandlerResult.response.ok) failures.push(`Auth handler HTTP ${authHandlerResult.response.status}`);
if (new URL(authHandlerResult.response.url).origin !== base.origin) {
  failures.push('Auth handler redirected away from the staging origin');
}
if (!authHandlerResult.body.includes('fireauth.oauthhelper.widget.initialize')) {
  failures.push('Firebase auth handler is not proxied on the staging origin');
}

const authIframeUrl = new URL('/__/auth/iframe', base);
const authIframeResult = await fetchText(authIframeUrl);
if (!authIframeResult.response.ok) failures.push(`Auth iframe HTTP ${authIframeResult.response.status}`);
if (new URL(authIframeResult.response.url).origin !== base.origin) {
  failures.push('Auth iframe redirected away from the staging origin');
}
const iframeXfo = (authIframeResult.response.headers.get('x-frame-options') ?? '').toLowerCase();
if (iframeXfo && iframeXfo !== 'sameorigin') {
  failures.push('Auth iframe X-Frame-Options blocks same-origin framing');
}
const iframeCsp = authIframeResult.response.headers.get('content-security-policy') ?? '';
if (/frame-ancestors\s+'none'/i.test(iframeCsp)) {
  failures.push('Auth iframe CSP frame-ancestors blocks same-origin framing');
}
if (!authIframeResult.body.includes('fireauth.iframe.AuthRelay.initialize')) {
  failures.push('Firebase auth iframe is not proxied on the staging origin');
}

const assetPaths = [...root.body.matchAll(/<script[^>]+src=["']([^"']+)["']/g)]
  .map((match) => match[1])
  .filter((value) => typeof value === 'string' && value.length > 0);
const assets = [];
let projectIdFound = false;
let authDomainFound = false;
let workerEndpointFound = false;
let remoteEnabledFound = false;
for (const assetPath of assetPaths) {
  const assetUrl = new URL(assetPath, base);
  const result = await fetchText(assetUrl);
  if (!result.response.ok) failures.push(`Asset HTTP ${result.response.status}: ${assetPath}`);
  if (projectId && result.body.includes(projectId)) projectIdFound = true;
  if (authDomain && result.body.includes(authDomain)) authDomainFound = true;
  if (workerEndpoint && result.body.includes(workerEndpoint)) workerEndpointFound = true;
  if (/VITE_V2_REMOTE_ENABLED[`"']?\s*:\s*[`"']?true/.test(result.body)) remoteEnabledFound = true;
  assets.push({ path: assetPath, status: result.response.status, bytes: result.body.length, sha256: sha256(result.body) });
}
if (assets.length === 0) failures.push('No module script assets found');
if (!selfTest && !remoteEnabledFound) failures.push('Remote Firebase is not enabled in served assets');
if (projectId && !projectIdFound) failures.push('Configured Firebase project ID was not found in served assets');
if (authDomain && !authDomainFound) failures.push('Configured same-origin auth domain was not found in served assets');
if (workerEndpoint && !workerEndpointFound) failures.push('Configured Worker endpoint was not found in served assets');

let workerCors = 'NOT_CHECKED';
let workerUnauthorized = 'NOT_CHECKED';
if (workerEndpoint) {
  try {
    const preflight = await fetch(new URL('/backups', workerEndpoint), {
      method: 'OPTIONS',
      headers: { Origin: base.origin },
    });
    workerCors = preflight.status === 204 && preflight.headers.get('access-control-allow-origin') === base.origin
      ? 'PASS'
      : `FAIL:${preflight.status}:${preflight.headers.get('access-control-allow-origin') ?? 'none'}`;
    if (workerCors !== 'PASS') failures.push('Worker CORS preflight failed');

    const unauthenticated = await fetch(new URL('/backups', workerEndpoint), {
      headers: { Origin: base.origin },
    });
    workerUnauthorized = unauthenticated.status === 401
      && unauthenticated.headers.get('access-control-allow-origin') === base.origin
      ? 'PASS'
      : `FAIL:${unauthenticated.status}:${unauthenticated.headers.get('access-control-allow-origin') ?? 'none'}`;
    if (workerUnauthorized !== 'PASS') failures.push('Worker did not deny an unauthenticated request');
  } catch (error) {
    workerCors = `FAIL:${error instanceof Error ? error.message : String(error)}`;
    workerUnauthorized = workerCors;
    failures.push('Worker checks failed');
  }
}

const evidence = {
  checkedAt: new Date().toISOString(),
  buildSha,
  url: base.href,
  origin: base.origin,
  https: base.protocol === 'https:',
  v1MarkerPresent: isV1(base.href),
  root: { status: root.response.status, bytes: root.body.length, sha256: sha256(root.body) },
  headers: {
    contentSecurityPolicy: contentSecurityPolicy || null,
    xContentTypeOptions: root.response.headers.get('x-content-type-options'),
    crossOriginOpenerPolicy: crossOriginOpenerPolicy || null,
    referrerPolicy: root.response.headers.get('referrer-policy'),
    permissionsPolicy: root.response.headers.get('permissions-policy'),
  },
  manifest: { status: manifestResult.response.status, bytes: manifestResult.body.length, sha256: sha256(manifestResult.body) },
  serviceWorker: { status: swResult.response.status, bytes: swResult.body.length, sha256: sha256(swResult.body), cachePrefix: 'estudo-organizado-v2' },
  authProxy: {
    handler: { status: authHandlerResult.response.status, bytes: authHandlerResult.body.length, sha256: sha256(authHandlerResult.body) },
    iframe: {
      status: authIframeResult.response.status,
      bytes: authIframeResult.body.length,
      sha256: sha256(authIframeResult.body),
      xFrameOptions: iframeXfo || null,
      contentSecurityPolicy: iframeCsp || null,
    },
  },
  projectId: projectId ?? null,
  projectIdFound,
  authDomain: authDomain ?? null,
  authDomainFound: authDomain ? authDomainFound : null,
  remoteEnabledFound,
  workerEndpoint: workerEndpoint ?? null,
  workerEndpointFound,
  workerCors,
  workerUnauthorized,
  assets,
  failures,
  mode: selfTest ? 'SELF_TEST' : 'LIVE_READBACK',
  status: failures.length === 0
    ? selfTest ? 'SELF_TEST_PASS' : 'HTTP_CHECKS_PASS'
    : 'FAIL',
};

const json = JSON.stringify(evidence, null, 2);
if (output) {
  const target = resolve(output);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, json + '\n', 'utf8');
}
console.log(json);
process.exit(failures.length === 0 ? 0 : 1);
