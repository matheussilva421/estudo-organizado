// =============================================
// EXPORT STATE UTILITIES
// =============================================
import { deepClone } from './normalize-state.js';
import { DEFAULT_FIRESTORE_SYNC_CONFIG } from './indexeddb.js';

export function createExportableState(sourceState) {
  const exportable = deepClone(sourceState);
  if (!exportable.config) exportable.config = {};

  delete exportable.config.localBackupAt;
  delete exportable.config.cfUrl;
  delete exportable.config.cfToken;
  delete exportable.config.cfTokenSaved;
  delete exportable.config.cfConflict;
  delete exportable.config.cfRemoteUpdatedAt;
  delete exportable.config.cfLastSyncAt;
  delete exportable.config._lastUpdated;
  delete exportable.config.syncMergeConflicts;
  delete exportable.driveFileId;
  delete exportable.lastSync;
  exportable.config.cfSyncEnabled = false;
  exportable.config.firestoreSync = { ...DEFAULT_FIRESTORE_SYNC_CONFIG };

  return exportable;
}
