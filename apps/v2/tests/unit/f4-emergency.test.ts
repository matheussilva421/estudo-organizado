import { beforeEach, describe, expect, it } from 'vitest';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';
import {
  LocalSessionRepository,
  type SessionCommitInput,
} from '../../src/platform/local-session-repository';
import {
  applyEmergencyImport,
  downloadEmergencyFile,
  exportUnsavedSessionIntent,
  previewEmergencyImport,
} from '../../src/application/session-emergency';
import type { StudySession } from '../../src/domain/session';

const profileId = 'profile-f4';

function baseSession(): StudySession {
  return {
    id: 'session-1',
    profileId,
    state: 'DRAFT',
    origin: 'TIMER',
    localRevision: 1,
    schemaVersion: 1,
    referenceZone: 'America/Fortaleza',
    planBlockIds: [],
    editalIds: [],
    intervals: [],
  };
}

function createCommand(operationId = 'op-create'): SessionCommitInput {
  return {
    kind: 'CREATE',
    scope: { profileId, operationId, baseRevision: null },
    sessionId: 'session-1',
    session: baseSession(),
  };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F4 emergency session export', () => {
  it('emergency_file_contains_unsaved_intent_not_fake_backup', () => {
    const exported = exportUnsavedSessionIntent({
      formatVersion: 1,
      command: createCommand(),
    });
    expect(exported.content).toContain('"formatVersion":1');
    expect(exported.content).toContain('"command"');
    expect(exported.content).not.toContain('"backup":true');
    expect(exported.digest).toMatch(/^[0-9a-f]+$/);
  });

  it('download_failure_does_not_claim_export_success', async () => {
    const result = await downloadEmergencyFile({ content: '{}' }, async () => {
      throw new Error('disk full');
    });
    expect(result).toEqual({ ok: false, reason: 'DOWNLOAD_FAILED' });
  });

  it('reimport_twice_creates_one_session', async () => {
    const exported = exportUnsavedSessionIntent({
      formatVersion: 1,
      command: createCommand(),
    });
    const repository = new LocalSessionRepository();
    const first = await applyEmergencyImport(repository, exported.content, {
      profileId,
      operationId: 'op-import',
      baseRevision: null,
    });
    const second = await applyEmergencyImport(repository, exported.content, {
      profileId,
      operationId: 'op-import',
      baseRevision: null,
    });
    expect(first.kind).toBe('LOCAL_COMMITTED');
    expect(second).toEqual(first);
    expect(await repository.load(profileId, 'session-1')).not.toBeNull();
  });

  it('quota_abort_has_no_local_committed_badge', async () => {
    const exported = exportUnsavedSessionIntent({
      formatVersion: 1,
      command: createCommand(),
    });
    const repository = new LocalSessionRepository({ fault: 'quota' });
    const result = await applyEmergencyImport(repository, exported.content, {
      profileId,
      operationId: 'op-import',
      baseRevision: null,
    });
    expect(result.kind).toBe('FAILED');
    expect(await repository.load(profileId, 'session-1')).toBeNull();
  });

  it('import_stale_revision_does_not_overwrite_later_commit', async () => {
    const repository = new LocalSessionRepository();
    await repository.commit(createCommand('op-create'));
    const transition: SessionCommitInput = {
      kind: 'TRANSITION',
      scope: { profileId, operationId: 'op-transition', baseRevision: 1 },
      sessionId: 'session-1',
      nextState: 'RUNNING',
    };
    const exported = exportUnsavedSessionIntent({
      formatVersion: 1,
      command: transition,
    });
    await repository.commit({
      kind: 'TRANSITION',
      scope: { profileId, operationId: 'op-later', baseRevision: 1 },
      sessionId: 'session-1',
      nextState: 'RUNNING',
    });
    const result = await applyEmergencyImport(repository, exported.content, {
      profileId,
      operationId: 'op-import',
      baseRevision: null,
    });
    expect(result).toEqual({ kind: 'CONFLICT', code: 'STALE_REVISION' });
    expect((await repository.load(profileId, 'session-1'))?.localRevision).toBe(2);
  });

  it('untrusted_profile_schema_digest_and_url_rejected', () => {
    const exported = exportUnsavedSessionIntent({
      formatVersion: 1,
      command: createCommand(),
    });
    expect(
      previewEmergencyImport(exported.content, 'other-profile').kind,
    ).toBe('INVALID');
    const tampered = exported.content.replace(exported.digest, 'deadbeef');
    expect(previewEmergencyImport(tampered, profileId).kind).toBe('INVALID');
    const wrongSchema = exported.content.replace('"formatVersion":1', '"formatVersion":99');
    expect(previewEmergencyImport(wrongSchema, profileId).kind).toBe('INVALID');
    const unsafe = exported.content.replace(
      '"editalIds":[]',
      '"editalIds":[],"materials":[{"id":"m","kind":"SITE","title":"x","url":"javascript:alert(1)"}]',
    );
    expect(previewEmergencyImport(unsafe, profileId).kind).toBe('INVALID');
  });
});
