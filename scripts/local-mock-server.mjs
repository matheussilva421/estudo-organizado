/**
 * Local Mock Server — Estudo Organizado
 *
 * Standalone Node.js HTTP server that serves the src/ directory with
 * HTML injection for SW blocking, Firebase stubbing, and mock data seeding.
 *
 * Usage:
 *   node scripts/local-mock-server.mjs
 *   MOCK_MODE=preserve node scripts/local-mock-server.mjs
 *   MOCK_MODE=clean node scripts/local-mock-server.mjs
 */

import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateMockState } from './generate-mock-data.mjs';
import { injectMockScripts } from './mock-inject.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// 1. Configuration
// ---------------------------------------------------------------------------

const MOCK_MODE = process.env.MOCK_MODE || 'reset';
const MOCK_PORT = parseInt(process.env.MOCK_PORT || '18765', 10);
const MOCK_SEED = process.env.MOCK_SEED || 'estudo-mock-2026';

const VALID_MODES = ['preserve', 'reset', 'clean'];
if (!VALID_MODES.includes(MOCK_MODE)) {
  console.error(`[MOCK] ERROR: Invalid MOCK_MODE '${MOCK_MODE}'. Valid: ${VALID_MODES.join(', ')}`);
  process.exit(1);
}

const SRC_DIR = join(__dirname, '..', 'src');
const SCRIPTS_DIR = __dirname;

// ---------------------------------------------------------------------------
// 2. MIME Types
// ---------------------------------------------------------------------------

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
};

function getMimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// 3. Security Headers
// ---------------------------------------------------------------------------

const CSP_HEADER = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://cdnjs.cloudflare.com; style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; connect-src 'self'; img-src 'self' data: https: blob:; media-src 'self';";

// ---------------------------------------------------------------------------
// 4. Helpers
// ---------------------------------------------------------------------------

function sendError(res, statusCode, message) {
  const body = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${statusCode} ${message}</title></head><body><h1>${statusCode} ${message}</h1></body></html>`;
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': CSP_HEADER,
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendFile(res, filePath, mimeType, headOnly = false) {
  try {
    const content = readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Security-Policy': CSP_HEADER,
      'Content-Length': content.byteLength,
    });
    res.end(headOnly ? null : content);
    return content.byteLength;
  } catch (_err) {
    sendError(res, 404, 'Not Found');
    return 0;
  }
}

function logRequest(method, url, statusCode, bytes) {
  console.log(`[MOCK] ${method} ${url} \u2192 ${statusCode} (${bytes} bytes)`);
}

// ---------------------------------------------------------------------------
// 5. Request Handler
// ---------------------------------------------------------------------------

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${MOCK_PORT}`);
  const pathname = url.pathname;
  const method = req.method;

  if (method !== 'GET' && method !== 'HEAD') {
    sendError(res, 405, 'Method Not Allowed');
    logRequest(method, pathname, 405, 0);
    return;
  }

  const isHead = method === 'HEAD';

  try {
    // Route: GET / or GET /index.html
    if (pathname === '/' || pathname === '/index.html') {
      const htmlPath = join(SRC_DIR, 'index.html');
      const html = readFileSync(htmlPath, 'utf-8');

      let mockData = null;
      if (MOCK_MODE === 'reset' || MOCK_MODE === 'clean') {
        mockData = generateMockState(MOCK_SEED);
      }

      const modifiedHtml = injectMockScripts(html, MOCK_MODE, mockData);
      const body = Buffer.from(modifiedHtml, 'utf-8');

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': CSP_HEADER,
        'Content-Length': body.byteLength,
      });
      res.end(isHead ? null : body);
      logRequest(method, pathname, 200, body.byteLength);
      return;
    }

    // Route: GET/HEAD /js/firebase/firebase-runtime-config.js → serve mock stub
    if (pathname === '/js/firebase/firebase-runtime-config.js') {
      const stubPath = join(SCRIPTS_DIR, 'mock-firebase-stub.js');
      const bytes = sendFile(res, stubPath, 'application/javascript; charset=utf-8', isHead);
      logRequest(method, pathname, 200, bytes);
      return;
    }

    // Route: GET/HEAD /mock-firebase-stub.js
    if (pathname === '/mock-firebase-stub.js') {
      const stubPath = join(SCRIPTS_DIR, 'mock-firebase-stub.js');
      const bytes = sendFile(res, stubPath, 'application/javascript; charset=utf-8', isHead);
      logRequest(method, pathname, 200, bytes);
      return;
    }

    // Default: serve from src/ directory
    // Strip leading slash and resolve relative to SRC_DIR
    const relativePath = pathname.startsWith('/') ? pathname.slice(1) : pathname;

    // Security: prevent directory traversal
    const resolvedPath = join(SRC_DIR, relativePath);
    if (!resolvedPath.startsWith(SRC_DIR)) {
      sendError(res, 403, 'Forbidden');
      logRequest('GET', pathname, 403, 0);
      return;
    }

    // Check if file exists
    try {
      statSync(resolvedPath);
    } catch {
      sendError(res, 404, 'Not Found');
      logRequest('GET', pathname, 404, 0);
      return;
    }

    const mimeType = getMimeType(resolvedPath);
    const bytes = sendFile(res, resolvedPath, mimeType, isHead);
    logRequest(method, pathname, 200, bytes);
  } catch (err) {
    console.error(`[MOCK] ERROR: ${err.message}`);
    sendError(res, 500, 'Internal Server Error');
    logRequest(method, pathname, 500, 0);
  }
});

// ---------------------------------------------------------------------------
// 6. Server Startup
// ---------------------------------------------------------------------------

server.listen(MOCK_PORT, '127.0.0.1', () => {
  console.log(`[MOCK] Server running at http://127.0.0.1:${MOCK_PORT} (mode: ${MOCK_MODE})`);
});

// ---------------------------------------------------------------------------
// 7. Graceful Shutdown
// ---------------------------------------------------------------------------

function shutdown() {
  console.log('[MOCK] Server shutting down.');
  server.close(() => {
    process.exit(0);
  });
  // Force exit after 5 seconds if connections are still open
  setTimeout(() => {
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
