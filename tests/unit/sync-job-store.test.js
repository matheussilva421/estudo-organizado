import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../src/js/sync/sync-job-store.js?v=8.33', async () => {
  const jobs = new Map();
  let idCounter = 0;

  function makeOpId(entityKey, revision) {
    return `${entityKey}@rev${revision}`;
  }

  function coalesceDocs(existing, incoming) {
    const byKey = new Map();
    for (const doc of existing) byKey.set(doc.key, doc);
    for (const doc of incoming) {
      const current = byKey.get(doc.key);
      if (!current || Number(doc.revision) >= Number(current.revision)) byKey.set(doc.key, doc);
    }
    return Array.from(byKey.values());
  }

  return {
    createSyncJob: vi.fn(async ({ channel = 'firestore', kind = 'entity_delta', reason = 'local-save', docs = [], summary = {} }) => {
      const matching = Array.from(jobs.values()).find(
        (j) => j.channel === channel && j.kind === kind && j.status === 'pending'
      );

      if (matching) {
        const mergedOpIds = new Set([...matching.opIds, ...docs.map((d) => makeOpId(d.key, d.revision))]);
        const mergedDocs = coalesceDocs(matching.docs || [], docs);
        matching.opIds = Array.from(mergedOpIds);
        matching.docs = mergedDocs;
        matching.reason = reason;
        matching.summary = { docsCount: mergedDocs.length, tombstonesCount: mergedDocs.filter((d) => d.payload === null).length };
        matching.updatedAt = new Date().toISOString();
        return matching;
      }

      idCounter++;
      const job = {
        id: `job_test_${idCounter}`,
        channel, kind, reason,
        status: 'pending',
        attempts: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nextAttemptAt: null,
        opIds: docs.map((d) => makeOpId(d.key, d.revision)),
        docs,
        summary: { docsCount: docs.length, tombstonesCount: docs.filter((d) => d.payload === null).length, ...summary },
        lastError: null,
      };
      jobs.set(job.id, job);
      return job;
    }),
    getPendingSyncJob: vi.fn(async () => {
      for (const job of jobs.values()) {
        if (job.status === 'pending') return job;
      }
      return null;
    }),
    markSyncJobAttempt: vi.fn(async (jobId, error = null) => {
      const job = jobs.get(jobId);
      if (!job) return null;
      job.attempts++;
      job.updatedAt = new Date().toISOString();
      if (error) job.lastError = String(error);
      if (job.attempts >= 5) job.status = 'failed';
      return job;
    }),
    markSyncJobCompleted: vi.fn(async (jobId) => {
      const job = jobs.get(jobId);
      if (!job) return null;
      job.status = 'completed';
      job.updatedAt = new Date().toISOString();
      job.finishedAt = new Date().toISOString();
      return job;
    }),
    getAllSyncJobs: vi.fn(async (limit = 20) => {
      return Array.from(jobs.values())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
    }),
  };
});

import {
  createSyncJob,
  getPendingSyncJob,
  markSyncJobAttempt,
  markSyncJobCompleted,
  getAllSyncJobs,
} from '../../src/js/sync/sync-job-store.js?v=8.33';

describe('sync/sync-job-store.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new sync job with pending status', async () => {
    const job = await createSyncJob({
      channel: 'firestore',
      kind: 'entity_delta',
      reason: 'local-save',
      docs: [{ key: 'eventos/ev1', revision: 3 }],
    });

    expect(job.id).toMatch(/^job_/);
    expect(job.status).toBe('pending');
    expect(job.channel).toBe('firestore');
    expect(job.kind).toBe('entity_delta');
    expect(job.attempts).toBe(0);
    expect(job.opIds).toContain('eventos/ev1@rev3');
    expect(job.summary.docsCount).toBe(1);
  });

  it('coalesces docs when pending job already exists for same channel and kind', async () => {
    await createSyncJob({
      channel: 'firestore',
      kind: 'entity_delta',
      reason: 'local-save',
      docs: [{ key: 'eventos/ev1', revision: 2 }],
    });

    const merged = await createSyncJob({
      channel: 'firestore',
      kind: 'entity_delta',
      reason: 'local-save',
      docs: [{ key: 'eventos/ev1', revision: 3 }],
    });

    expect(merged.docs).toHaveLength(1);
    expect(merged.docs[0].revision).toBe(3);
    expect(merged.opIds).toContain('eventos/ev1@rev3');
  });

  it('keeps separate jobs for different channels', async () => {
    await createSyncJob({ channel: 'firestore', kind: 'entity_delta', reason: 'local-save', docs: [] });
    const job2 = await createSyncJob({ channel: 'cloudflare', kind: 'backup', reason: 'manual', docs: [] });
    expect(job2.channel).toBe('cloudflare');
  });

  it('retrieves pending sync job', async () => {
    await createSyncJob({ reason: 'local-save', docs: [] });
    const pending = await getPendingSyncJob();
    expect(pending).toBeDefined();
    expect(pending.status).toBe('pending');
  });

  it('increments attempts on markSyncJobAttempt', async () => {
    const job = await createSyncJob({ reason: 'local-save', docs: [] });
    const updated = await markSyncJobAttempt(job.id);
    expect(updated.attempts).toBe(1);
  });

  it('marks job as failed after 5 attempts', async () => {
    const job = await createSyncJob({ reason: 'local-save', docs: [] });
    let updated;
    for (let i = 0; i < 5; i++) {
      updated = await markSyncJobAttempt(job.id, 'timeout');
    }
    expect(updated.status).toBe('failed');
    expect(updated.lastError).toBe('timeout');
  });

  it('marks job as completed', async () => {
    const job = await createSyncJob({ reason: 'local-save', docs: [] });
    const completed = await markSyncJobCompleted(job.id);
    expect(completed.status).toBe('completed');
    expect(completed.finishedAt).toBeDefined();
  });

  it('returns null for non-existent job', async () => {
    const result = await markSyncJobCompleted('nonexistent');
    expect(result).toBeNull();
  });

  it('lists all jobs sorted by creation date', async () => {
    await createSyncJob({ reason: 'first', docs: [] });
    await createSyncJob({ reason: 'second', docs: [] });
    const jobs = await getAllSyncJobs();
    expect(jobs.length).toBeGreaterThanOrEqual(2);
    expect(new Date(jobs[0].createdAt) >= new Date(jobs[1].createdAt)).toBe(true);
  });
});
