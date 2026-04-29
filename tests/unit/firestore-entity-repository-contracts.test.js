import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Firestore entity repository contracts', () => {
  it('exports entity read and write helpers', () => {
    const source = read('src/js/sync/firestore-repository.js');

    expect(source).toContain('export async function writeFirestoreEntityDocuments');
    expect(source).toContain('export async function readFirestoreEntityDocuments');
    expect(source).toContain('collection(db,');
    expect(source).toContain("'entities'");
  });

  it('uses encoded entity keys as document ids', () => {
    const source = read('src/js/sync/firestore-repository.js');

    expect(source).toContain('encodeEntityDocId');
    expect(source).toContain('doc(entityCollection, encodeEntityDocId(entityDoc.key))');
  });
});
