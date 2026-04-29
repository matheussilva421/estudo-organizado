import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('entity dual-write contracts', () => {
  it('queues entity shadow batches without replacing snapshot queueing', () => {
    const engine = read('src/js/sync/firestore-sync-engine.js');

    expect(engine).toContain('queueFirestoreEntityBatchFromState');
    expect(engine).toContain('queueFirestoreSnapshotFromState');
    expect(engine).toContain('flushFirestoreEntityOutbox');
  });

  it('keeps entity dual-write gated by explicit shadow setting', () => {
    const engine = read('src/js/sync/firestore-sync-engine.js');

    expect(engine).toContain('entitySync');
    expect(engine).toContain("mode === 'shadow'");
  });
});
