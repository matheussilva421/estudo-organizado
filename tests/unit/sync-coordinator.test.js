import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('sync-coordinator.js contract', () => {
  it('listens to local save commits without coupling store.js to Firestore', () => {
    const storeSource = read('src/js/store.js');
    const coordinatorSource = read('src/js/sync/sync-coordinator.js');

    expect(storeSource).not.toContain('firestore-sync-engine');
    expect(storeSource).not.toContain('sync-coordinator');
    expect(coordinatorSource).toContain("document.addEventListener('stateSaved'");
    expect(coordinatorSource).toContain('event.detail?.skipFirestoreSync');
    expect(coordinatorSource).toContain("schedulePrimarySync('local-save'");
  });

  it('only enables automatic primary sync for configured signed-in Firestore primary mode', () => {
    const coordinatorSource = read('src/js/sync/sync-coordinator.js');

    expect(coordinatorSource).toContain('status.configured');
    expect(coordinatorSource).toContain('status.signedIn');
    expect(coordinatorSource).toContain('status.enabled');
    expect(coordinatorSource).toContain("status.mode === 'primary'");
    expect(coordinatorSource).toContain('!status.conflict');
  });

  it('queues snapshots before automatic flush and delegates manual sync to Firestore reconciliation', () => {
    const coordinatorSource = read('src/js/sync/sync-coordinator.js');

    expect(coordinatorSource).toContain('queueFirestoreSnapshotFromState(state, { manual: false })');
    expect(coordinatorSource).toContain('flushFirestoreOutbox({ manual: false');
    expect(coordinatorSource).toContain('await syncFirestoreNow()');
    expect(coordinatorSource).toContain('app:primarySyncQueued');
  });
});
