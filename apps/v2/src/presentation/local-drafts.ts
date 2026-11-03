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

export function localDraftKey(
  profileId: string,
  formId: string,
  entityId: string | null = null,
): string {
  return PREFIX + profileId + ':' + formId + ':' + (entityId ?? 'new');
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

