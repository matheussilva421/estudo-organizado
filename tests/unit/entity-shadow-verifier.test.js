import { describe, expect, it } from 'vitest';

const verifier = await import('../../src/js/sync/entity-shadow-verifier.js?v=8.28');

describe('entity-shadow-verifier.js', () => {
  it('returns ok when snapshot manifest and entity docs agree', () => {
    const snapshot = {
      entityManifest: [
        { key: 'eventos/ev_1', collection: 'eventos', id: 'ev_1', revision: 1, checksum: 'abc', deletedAt: null }
      ]
    };
    const docs = [
      { key: 'eventos/ev_1', collection: 'eventos', id: 'ev_1', revision: 1, checksum: 'abc', deletedAt: null }
    ];

    expect(verifier.compareSnapshotManifestToEntityDocs(snapshot, docs)).toEqual({
      ok: true,
      missing: [],
      divergent: [],
      extra: []
    });
  });

  it('reports missing, divergent and extra entity docs', () => {
    const snapshot = {
      entityManifest: [
        { key: 'eventos/ev_1', collection: 'eventos', id: 'ev_1', revision: 1, checksum: 'abc', deletedAt: null },
        { key: 'editais/ed_1', collection: 'editais', id: 'ed_1', revision: 2, checksum: 'def', deletedAt: null }
      ]
    };
    const docs = [
      { key: 'eventos/ev_1', collection: 'eventos', id: 'ev_1', revision: 2, checksum: 'xyz', deletedAt: null },
      { key: 'revisoes/rev_1', collection: 'revisoes', id: 'rev_1', revision: 1, checksum: 'zzz', deletedAt: null }
    ];

    const diff = verifier.compareSnapshotManifestToEntityDocs(snapshot, docs);

    expect(diff.ok).toBe(false);
    expect(diff.missing).toEqual([expect.objectContaining({ key: 'editais/ed_1' })]);
    expect(diff.divergent).toEqual([expect.objectContaining({ key: 'eventos/ev_1' })]);
    expect(diff.extra).toEqual([expect.objectContaining({ key: 'revisoes/rev_1' })]);
  });

  it('returns ok for empty inputs', () => {
    const result = verifier.compareSnapshotManifestToEntityDocs({}, []);
    expect(result.ok).toBe(true);
  });

  it('handles null entityManifest', () => {
    const result = verifier.compareSnapshotManifestToEntityDocs({ entityManifest: null }, []);
    expect(result.ok).toBe(true);
  });

  it('handles null entityDocs', () => {
    const result = verifier.compareSnapshotManifestToEntityDocs({ entityManifest: [] }, null);
    expect(result.ok).toBe(true);
  });

  it('detects divergent when checksum differs', () => {
    const snapshot = {
      entityManifest: [
        { key: 'eventos/ev_1', revision: 1, checksum: 'abc', deletedAt: null }
      ]
    };
    const docs = [
      { key: 'eventos/ev_1', revision: 1, checksum: 'xyz', deletedAt: null }
    ];
    const result = verifier.compareSnapshotManifestToEntityDocs(snapshot, docs);
    expect(result.ok).toBe(false);
    expect(result.divergent).toHaveLength(1);
  });

  it('detects divergent when revision differs', () => {
    const snapshot = {
      entityManifest: [
        { key: 'eventos/ev_1', revision: 1, checksum: 'abc', deletedAt: null }
      ]
    };
    const docs = [
      { key: 'eventos/ev_1', revision: 2, checksum: 'abc', deletedAt: null }
    ];
    const result = verifier.compareSnapshotManifestToEntityDocs(snapshot, docs);
    expect(result.ok).toBe(false);
    expect(result.divergent).toHaveLength(1);
  });

  it('detects divergent when deletedAt differs', () => {
    const snapshot = {
      entityManifest: [
        { key: 'eventos/ev_1', revision: 1, checksum: 'abc', deletedAt: null }
      ]
    };
    const docs = [
      { key: 'eventos/ev_1', revision: 1, checksum: 'abc', deletedAt: '2024-01-01' }
    ];
    const result = verifier.compareSnapshotManifestToEntityDocs(snapshot, docs);
    expect(result.ok).toBe(false);
    expect(result.divergent).toHaveLength(1);
  });

  it('filters items without key', () => {
    const snapshot = {
      entityManifest: [
        { collection: 'eventos', id: 'ev_1' },
        { key: 'eventos/ev_2', collection: 'eventos', id: 'ev_2', revision: 1, checksum: 'abc', deletedAt: null }
      ]
    };
    const docs = [
      { key: 'eventos/ev_2', collection: 'eventos', id: 'ev_2', revision: 1, checksum: 'abc', deletedAt: null }
    ];
    const result = verifier.compareSnapshotManifestToEntityDocs(snapshot, docs);
    expect(result.ok).toBe(true);
  });
});
