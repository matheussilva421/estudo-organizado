import type { SyncState } from './sync-types';
import type { CommitResult, Id } from './content-commands';
import type { Edital } from '../domain/edital';
import type { LinkPreview } from './sync-policy';

/**
 * One row per local device profile. `profileId` is local: it is neither a
 * Google `uid` nor a global library key. `localRevision` guards concurrent
 * preference changes between tabs.
 */
export type ProfileRecord = {
  profileId: Id;
  uid: string | null;
  remoteLibraryId: string | null;
  syncEnabled: boolean;
  state: SyncState;
  primaryEditalId: Id | null;
  localRevision: number;
};

export function createDefaultProfile(profileId: Id): ProfileRecord {
  return {
    profileId,
    uid: null,
    remoteLibraryId: null,
    syncEnabled: false,
    state: 'LOCAL_ONLY',
    primaryEditalId: null,
    localRevision: 0,
  };
}

export type SetPrimaryInput = {
  profileId: Id;
  editalId: Id | null;
  operationId: Id;
  baseRevision?: number | null;
};

export type ArchiveEditalInput = {
  profileId: Id;
  editalId: Id;
  operationId: Id;
  /**
   * Required only when the archived edital is the primary one. `null` means
   * "keep no primary"; `undefined` means the decision was never made.
   */
  replacementPrimaryId?: Id | null;
  baseRevision?: number | null;
};

export type ArchiveEditalResult = {
  edital: Edital;
  profile: ProfileRecord;
};

export type DeliveryConsentProof = {
  profileId: Id;
  uid: string;
  remoteLibraryId: string;
  consent: true;
  preview: LinkPreview;
};

export type AdoptionDeliveryReport = { adopted: number };

export interface ProfileRepository {
  getProfile(profileId: Id): Promise<ProfileRecord>;
  setPrimaryEdital(input: SetPrimaryInput): Promise<CommitResult<ProfileRecord>>;
  archiveEdital(input: ArchiveEditalInput): Promise<CommitResult<ArchiveEditalResult>>;
  adoptLocalOperations(
    profileId: Id,
    uid: string,
    remoteLibraryId: string,
    proof: DeliveryConsentProof,
  ): Promise<CommitResult<AdoptionDeliveryReport>>;
  logoutRemote(profileId: Id, operationId: Id): Promise<CommitResult<ProfileRecord>>;
}
