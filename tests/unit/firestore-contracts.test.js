import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Firestore integration contracts', () => {
  it('keeps Firebase config explicit and unconfigured by default', () => {
    const configSource = read('src/js/firebase/firebase-config.js');

    expect(configSource).toContain('FIREBASE_CONFIG');
    expect(configSource).toContain("apiKey: ''");
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

  it('keeps Firestore rules owner-scoped and denies physical deletes', () => {
    const rules = read('firestore.rules');

    expect(rules).toContain('request.auth.uid == uid');
    expect(rules).toContain("match /users/{uid}/snapshots/{snapshotId}");
    expect(rules).toContain('allow delete: if false;');
    expect(rules).toContain('request.resource.data.version == 1');
  });
});
