import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Firestore integration contracts', () => {
  it('keeps Firebase config explicit and runtime-overridable', () => {
    const configSource = read('src/js/firebase/firebase-config.js');

    expect(configSource).toContain('FIREBASE_CONFIG');
    expect(configSource).toContain("projectId: 'app-de-estudos-14564'");
    expect(configSource).toContain("storageBucket: 'app-de-estudos-14564.firebasestorage.app'");
    expect(configSource).toContain("messagingSenderId: '824173301356'");
    expect(configSource).toContain('window.ESTUDO_FIREBASE_CONFIG');
  });

  it('caches all runtime Firestore modules in the service worker shell', () => {
    const swSource = read('src/sw.js');

    expect(swSource).toContain('./js/firebase/firebase-client.js');
    expect(swSource).toContain('./js/firebase/firebase-config.js');
    expect(swSource).toContain('./js/sync/firestore-sync-engine.js');
    expect(swSource).toContain('./vendor/firebase-client.bundle.js');
    expect(swSource).toContain("APP_VERSION = '8.18'");
  });

  it('allows the Firebase Auth and Firestore network surfaces in CSP', () => {
    const html = read('src/index.html');
    const csp = html.match(/Content-Security-Policy"\s+content="([^"]+)"/i)?.[1] || '';
    const scriptSrc = csp.match(/script-src\s+([^;]+)/i)?.[1] || '';
    const connectSrc = csp.match(/connect-src\s+([^;]+)/i)?.[1] || '';
    const frameSrc = csp.match(/frame-src\s+([^;]+)/i)?.[1] || '';

    expect(scriptSrc).toContain('https://www.google.com');
    expect(scriptSrc).toContain('https://www.gstatic.com');
    expect(connectSrc).toContain('https://identitytoolkit.googleapis.com');
    expect(connectSrc).toContain('https://securetoken.googleapis.com');
    expect(connectSrc).toContain('https://firestore.googleapis.com');
    expect(connectSrc).toContain('https://content-firebaseappcheck.googleapis.com');
    expect(frameSrc).toContain('https://accounts.google.com');
    expect(frameSrc).toContain('https://app-de-estudos-14564.firebaseapp.com');
  });

  it('keeps Firestore rules owner-scoped and denies physical deletes', () => {
    const rules = read('firestore.rules');

    expect(rules).toContain('request.auth.uid == uid');
    expect(rules).toContain("match /users/{uid}/snapshots/{snapshotId}");
    expect(rules).toContain('allow delete: if false;');
    expect(rules).toContain('request.resource.data.version == 1');
  });
});
