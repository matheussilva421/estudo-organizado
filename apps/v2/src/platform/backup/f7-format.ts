import { digestPayload } from '../sync/firebase-remote';

export type F7BackupManifest = {
  formatVersion: 3;
  profileId: string;
  recordCount: number;
  checksum: string;
  epoch: number;
  deletionHistoryComplete: boolean;
};

export type F7BackupSnapshot = {
  manifest: F7BackupManifest;
  payload: Record<string, unknown[]>;
};

export type InspectResult =
  | { kind: 'VALID'; snapshot: F7BackupSnapshot }
  | { kind: 'INVALID'; reason: string }
  | { kind: 'REBASELINE_REQUIRED'; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function inspectF7Backup(input: unknown): Promise<InspectResult> {
  if (!isRecord(input) || !isRecord(input.manifest) || !isRecord(input.payload)) {
    return { kind: 'INVALID', reason: 'FORMAT' };
  }
  const manifest = input.manifest;
  if (manifest.formatVersion !== 3) return { kind: 'INVALID', reason: 'FORMAT_VERSION' };
  if (typeof manifest.profileId !== 'string' || !manifest.profileId.trim()) {
    return { kind: 'INVALID', reason: 'PROFILE_REQUIRED' };
  }
  if (!Number.isInteger(manifest.recordCount) || (manifest.recordCount as number) < 0) {
    return { kind: 'INVALID', reason: 'RECORD_COUNT' };
  }
  if (typeof manifest.checksum !== 'string' || !/^[a-fA-F0-9]{64}$/.test(manifest.checksum)) {
    return { kind: 'INVALID', reason: 'CHECKSUM_FORMAT' };
  }
  if (!Number.isInteger(manifest.epoch) || (manifest.epoch as number) < 0) {
    return { kind: 'INVALID', reason: 'EPOCH' };
  }
  if (typeof manifest.deletionHistoryComplete !== 'boolean') {
    return { kind: 'INVALID', reason: 'DELETION_HISTORY' };
  }

  const payload: Record<string, unknown[]> = {};
  let count = 0;
  for (const [store, records] of Object.entries(input.payload)) {
    if (!Array.isArray(records)) return { kind: 'INVALID', reason: 'STORE_RECORDS' };
    payload[store] = records;
    count += records.length;
  }
  if (count !== manifest.recordCount) return { kind: 'INVALID', reason: 'RECORD_COUNT_MISMATCH' };
  const checksum = await digestPayload(payload);
  if (checksum.toLowerCase() !== manifest.checksum.toLowerCase()) {
    return { kind: 'INVALID', reason: 'CHECKSUM_MISMATCH' };
  }
  if (manifest.deletionHistoryComplete !== true) {
    return { kind: 'REBASELINE_REQUIRED', reason: 'DELETION_HISTORY_INCOMPLETE' };
  }
  return {
    kind: 'VALID',
    snapshot: {
      manifest: {
        formatVersion: 3,
        profileId: manifest.profileId as string,
        recordCount: manifest.recordCount as number,
        checksum,
        epoch: manifest.epoch as number,
        deletionHistoryComplete: true,
      },
      payload,
    },
  };
}
