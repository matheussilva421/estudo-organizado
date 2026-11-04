/**
 * Recoverable, non-authoritative form drafts. They live in localStorage,
 * scoped by profile and form identity, and are never read as academic facts.
 * A confirmed command must clear the draft explicitly.
 */
export type LocalDraft = {
  key: string;
  profileId: string;
  entityId: string | null;
  baseRevision: number | null;
  value: string;
  savedAt: string;
};

const PREFIX = 'estudo-organizado:v2:draft:';

/**
 * A document-scoped identity. Duplicated tabs copy sessionStorage, so a value
 * stored there would let two tabs share the same key and overwrite each
 * other's draft. This id is created once per page execution.
 */
const WRITER_ID = (() => {
  try {
    return crypto.randomUUID();
  } catch {
    return 'w-' + Math.random().toString(36).slice(2, 12);
  }
})();

export function localDraftKey(
  profileId: string,
  formId: string,
  entityId: string | null = null,
): string {
  return PREFIX + profileId + ':' + formId + ':' + (entityId ?? 'new');
}

function writerId(): string {
  return WRITER_ID;
}

/**
 * Entity drafts are scoped to the editing tab so two tabs on the same record
 * cannot overwrite each other's text. The base key stays stable for lookup.
 */
export function localEntityDraftKey(
  profileId: string,
  formId: string,
  entityId: string,
): string {
  return localDraftKey(profileId, formId, entityId) + ':w:' + writerId();
}

/**
 * Finds the newest recoverable draft for an entity, regardless of the tab that
 * wrote it. A committed command clears only its own draft.
 */
export function findLocalDraft(
  profileId: string,
  formId: string,
  entityId: string,
): LocalDraft | null {
  const base = localDraftKey(profileId, formId, entityId) + ':w:';
  let best: LocalDraft | null = null;
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith(base)) continue;
      const draft = loadLocalDraft(key);
      if (!draft) continue;
      if (!best || draft.savedAt > best.savedAt) best = draft;
    }
  } catch {
    return best;
  }
  if (best) return best;
  return loadLocalDraft(localDraftKey(profileId, formId, entityId));
}

export function saveLocalDraft(
  input: Omit<LocalDraft, 'savedAt'>,
): boolean {
  try {
    const record: LocalDraft = { ...input, savedAt: new Date().toISOString() };
    window.localStorage.setItem(record.key, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function loadLocalDraft(key: string): LocalDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalDraft>;
    if (
      parsed.key !== key ||
      typeof parsed.profileId !== 'string' ||
      typeof parsed.value !== 'string' ||
      typeof parsed.savedAt !== 'string'
    ) {
      return null;
    }
    return {
      key,
      profileId: parsed.profileId,
      entityId: typeof parsed.entityId === 'string' ? parsed.entityId : null,
      baseRevision:
        typeof parsed.baseRevision === 'number' ? parsed.baseRevision : null,
      value: parsed.value,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function clearLocalDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // A failed cleanup must not turn a confirmed command into a failure.
  }
}

/** Clears both the per-tab entity draft and the legacy shared key. */
export function clearEntityDraft(
  profileId: string,
  formId: string,
  entityId: string,
  sourceKey: string | null = null,
): void {
  clearLocalDraft(localDraftKey(profileId, formId, entityId));
  clearLocalDraft(localEntityDraftKey(profileId, formId, entityId));
  if (sourceKey) clearLocalDraft(sourceKey);
}

/**
 * A draft is stale when the entity revision it was written against no longer
 * matches the canonical record. The caller must ask for an explicit decision
 * before reusing the text; loading a draft never proves it is current.
 */
export function draftIsStale(
  draft: Pick<LocalDraft, 'baseRevision'> | null,
  currentRevision: number | null,
): boolean {
  if (!draft) return false;
  if (draft.baseRevision === null || currentRevision === null) return false;
  return draft.baseRevision !== currentRevision;
}

