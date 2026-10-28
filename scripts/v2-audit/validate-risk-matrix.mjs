const ID_PATTERN = /^R-V1-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const EVIDENCE_LEVELS = new Set([
  'CODE_AND_TEST',
  'CODE_ONLY',
  'DOC_ONLY',
  'UNCERTAIN',
  'ISSUE_REPORT',
]);
const STATUSES = new Set(['OPEN', 'MITIGATED', 'UNVERIFIED']);
const BASE_TEXT_FIELDS = ['area', 'trigger', 'consequence', 'v2_invariant'];
const OWNERSHIP_FIELDS = ['proposed_test', 'suggested_phase', 'mitigation'];

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

function hasOwnership(row) {
  return OWNERSHIP_FIELDS.every((field) => isNonEmptyString(row[field]));
}

export function validateRiskMatrix(rows) {
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

    let hasValidId = false;
    if (!isNonEmptyString(row.id)) {
      add('EMPTY_REQUIRED_FIELD');
    } else if (!row.id.startsWith('R-V1-')) {
      add('INVALID_ID_PREFIX');
    } else if (!ID_PATTERN.test(row.id)) {
      add('INVALID_ID_FORMAT');
    } else {
      hasValidId = true;
    }

    if (hasValidId) {
      if (seenIds.has(row.id)) add('DUPLICATE_ID');
      else seenIds.add(row.id);
    }

    for (const field of BASE_TEXT_FIELDS) {
      if (!isNonEmptyString(row[field])) add('EMPTY_REQUIRED_FIELD');
    }

    const hasValidSeverity = SEVERITIES.has(row.severity);
    if (!hasValidSeverity) add('INVALID_SEVERITY');

    const evidencePathsValid =
      Array.isArray(row.evidence_paths) &&
      row.evidence_paths.length > 0 &&
      row.evidence_paths.every(isNonEmptyString);

    if (hasValidSeverity && (row.severity === 'HIGH' || row.severity === 'CRITICAL')) {
      if (!evidencePathsValid || !hasOwnership(row)) {
        add(row.severity === 'CRITICAL' ? 'CRITICAL_RISK_UNOWNED' : 'HIGH_RISK_UNOWNED');
      }
    } else {
      for (const field of OWNERSHIP_FIELDS) {
        if (!isNonEmptyString(row[field])) add('EMPTY_REQUIRED_FIELD');
      }
    }

    if (!Array.isArray(row.evidence_paths)) {
      add('INVALID_EVIDENCE_PATHS');
    } else {
      if (row.evidence_paths.length === 0) add('MISSING_EVIDENCE');
      if (!row.evidence_paths.every(isSafeRelativePath)) add('INVALID_EVIDENCE_PATHS');
      if (new Set(row.evidence_paths).size !== row.evidence_paths.length) {
        add('DUPLICATE_EVIDENCE_PATH');
      }
    }

    if (!EVIDENCE_LEVELS.has(row.evidence_level)) add('INVALID_EVIDENCE_LEVEL');

    if (!STATUSES.has(row.status)) {
      add('INVALID_STATUS');
    } else if (row.status === 'MITIGATED' && !isNonEmptyString(row.evidence_note)) {
      add('MITIGATION_UNPROVEN');
    }
  }

  return { ok: errors.length === 0, errors };
}
