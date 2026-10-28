const ID_PATTERN = /^S-V1-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const MIN_CONFLICT_EXPLANATION = 20;
const PATH_FIELDS = ['source_paths', 'export_paths', 'import_paths', 'sync_paths'];
const TEXT_LIST_FIELDS = ['relations', 'migration_risks', 'evidence_gaps'];
const ABSENCE_MARKERS = {
  export_paths: /^EXPORT_ABSENT\s*:/i,
  import_paths: /^IMPORT_ABSENT\s*:/i,
};

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSafeRelativePath(value) {
  if (!isNonEmptyString(value) || value !== value.trim()) return false;
  if (value.startsWith('/') || value.startsWith('\\')) return false;
  if (value.includes('\\') || value.includes('\0')) return false;
  if (/^[A-Za-z]:[\\/]/.test(value) || /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value)) {
    return false;
  }
  return value
    .split('/')
    .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

function pathErrorCode(field) {
  return `INVALID_${field.replace(/_paths$/, '').toUpperCase()}_PATHS`;
}

function hasAbsenceGap(gaps, field) {
  return gaps.some((gap) => ABSENCE_MARKERS[field].test(gap.trim()));
}

function normalizedVersionSet(values) {
  return [...new Set(values.map((value) => value.trim()))].sort();
}

export function validateSchemaMatrix(rows) {
  if (!Array.isArray(rows)) {
    return { ok: false, errors: ['INPUT_NOT_ARRAY'] };
  }

  const errors = [];
  const reported = new Set();
  const add = (code) => {
    if (reported.has(code)) return;
    reported.add(code);
    errors.push(code);
  };
  const seenIds = new Set();

  for (const row of rows) {
    if (!isRecord(row)) {
      add('ROW_NOT_OBJECT');
      continue;
    }

    if (!isNonEmptyString(row.id)) {
      add('EMPTY_REQUIRED_FIELD');
    } else {
      if (!row.id.startsWith('S-V1-')) add('INVALID_ID_PREFIX');
      else if (!ID_PATTERN.test(row.id)) add('INVALID_ID_FORMAT');
      if (seenIds.has(row.id)) add('DUPLICATE_ID');
      else seenIds.add(row.id);
    }

    if (!isNonEmptyString(row.entity) || !isNonEmptyString(row.storage)) {
      add('EMPTY_REQUIRED_FIELD');
    }

    for (const field of PATH_FIELDS) {
      const value = row[field];
      if (!Array.isArray(value)) {
        add(pathErrorCode(field));
        continue;
      }
      if (value.length === 0) {
        if (field === 'source_paths') add('MISSING_SOURCE_EVIDENCE');
      } else if (!value.every(isSafeRelativePath)) {
        add(pathErrorCode(field));
      }
      if (value.some((entry) => typeof entry === 'string') && new Set(value).size !== value.length) {
        add('DUPLICATE_PATH');
      }
    }

    for (const field of TEXT_LIST_FIELDS) {
      const value = row[field];
      if (!Array.isArray(value) || !value.every(isNonEmptyString)) {
        add('INVALID_TEXT_LIST');
      }
    }

    const versions = row.versions;
    if (!isRecord(versions)) {
      add('INVALID_VERSIONS');
    } else {
      const axes = {};
      for (const axis of ['declared', 'observed']) {
        const values = versions[axis];
        if (!Array.isArray(values)) {
          add('INVALID_VERSIONS');
          axes[axis] = null;
        } else if (!values.every(isNonEmptyString)) {
          add('INVALID_VERSION_VALUE');
          axes[axis] = null;
        } else {
          const normalized = values.map((value) => value.trim());
          if (new Set(normalized).size !== normalized.length) {
            add('DUPLICATE_VERSION_VALUE');
          }
          axes[axis] = normalizedVersionSet(normalized);
        }
      }

      const conflicts = versions.conflicts;
      let hasConflictExplanation = false;
      if (!Array.isArray(conflicts)) {
        add('INVALID_SCHEMA_CONFLICTS');
      } else if (!conflicts.every(isNonEmptyString)) {
        add('INVALID_SCHEMA_CONFLICTS');
      } else {
        if (
          !conflicts.every(
            (conflict) => conflict.trim().length >= MIN_CONFLICT_EXPLANATION,
          )
        ) {
          add('CONFLICT_EXPLANATION_TOO_SHORT');
        }
        hasConflictExplanation = conflicts.length > 0;
      }

      if (
        axes.declared &&
        axes.observed &&
        JSON.stringify(axes.declared) !== JSON.stringify(axes.observed) &&
        !hasConflictExplanation
      ) {
        add('SCHEMA_CONFLICT_UNEXPLAINED');
      }
    }

    const exportPaths = row.export_paths;
    const importPaths = row.import_paths;
    const gaps = Array.isArray(row.evidence_gaps)
      ? row.evidence_gaps.filter(isNonEmptyString)
      : [];
    if (Array.isArray(exportPaths) && exportPaths.length === 0 && !hasAbsenceGap(gaps, 'export_paths')) {
      add('EXPORT_GAP_UNEXPLAINED');
    }
    if (Array.isArray(importPaths) && importPaths.length === 0 && !hasAbsenceGap(gaps, 'import_paths')) {
      add('IMPORT_GAP_UNEXPLAINED');
    }
  }

  return { ok: errors.length === 0, errors };
}
