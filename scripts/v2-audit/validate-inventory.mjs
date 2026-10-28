const EVIDENCE_LEVELS = new Set([
  'CODE_AND_TEST',
  'CODE_ONLY',
  'DOC_ONLY',
  'UNCERTAIN',
]);
const DISPOSITIONS = new Set([
  'PRESERVE',
  'REFORMULATE',
  'UNIFY',
  'ADD',
  'DEPRECATE',
  'UNDECIDED',
]);
const RISKS = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const DECISION_STATUSES = new Set(['PROPOSED', 'APPROVED']);
const REQUIRED_TEXT_FIELDS = ['name', 'domain', 'observed_behavior'];
const APPROVAL_REFERENCE_PATTERN = /(?:\/|#|:\/\/|\bG\d+\b|\b(?:19|20)\d{2}-\d{2}-\d{2}\b)/;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRowObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateInventory(rows) {
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
  let hasDuplicateId = false;

  for (const row of rows) {
    if (!isRowObject(row)) {
      add('ROW_NOT_OBJECT');
      continue;
    }

    const idIsNonEmpty = isNonEmptyString(row.id);
    const normalizedId = idIsNonEmpty ? row.id.trim() : '';
    if (!idIsNonEmpty) {
      add('EMPTY_REQUIRED_FIELD');
    } else if (!row.id.startsWith('F-V1-')) {
      add('INVALID_ID_PREFIX');
    } else if (row.id !== normalizedId || row.id.slice('F-V1-'.length).trim().length === 0) {
      add('INVALID_ID_FORMAT');
    }

    if (idIsNonEmpty) {
      if (seenIds.has(normalizedId)) {
        hasDuplicateId = true;
      } else {
        seenIds.add(normalizedId);
      }
    }

    for (const field of REQUIRED_TEXT_FIELDS) {
      if (!isNonEmptyString(row[field])) add('EMPTY_REQUIRED_FIELD');
    }

    const hasValidSourcePaths =
      Array.isArray(row.source_paths) &&
      row.source_paths.every(isNonEmptyString);
    if (!hasValidSourcePaths) add('INVALID_SOURCE_PATHS');

    const hasValidTests =
      Array.isArray(row.tests) && row.tests.every(isNonEmptyString);
    if (!hasValidTests) add('INVALID_TESTS');

    const hasTestGap = isNonEmptyString(row.test_gap);
    if (row.test_gap !== null && !hasTestGap) add('INVALID_TEST_GAP');
    if (hasValidTests && row.tests.length === 0 && !hasTestGap)
      add('MISSING_TEST_GAP');
    if (hasValidTests && row.tests.length === 0 && row.evidence_level === 'CODE_AND_TEST')
      add('TEST_LEVEL_MISMATCH');

    const hasValidEvidenceLevel = EVIDENCE_LEVELS.has(row.evidence_level);
    if (!hasValidEvidenceLevel) add('INVALID_EVIDENCE_LEVEL');
    if (
      hasValidSourcePaths &&
      row.source_paths.length === 0 &&
      hasValidEvidenceLevel &&
      row.evidence_level !== 'DOC_ONLY'
    ) {
      add('NO_PROVENANCE');
    }

    if (!DISPOSITIONS.has(row.proposed_disposition))
      add('INVALID_PROPOSED_DISPOSITION');
    if (!RISKS.has(row.risk)) add('INVALID_RISK');

    const hasValidDecisionStatus = DECISION_STATUSES.has(row.decision_status);
    if (!hasValidDecisionStatus) add('INVALID_DECISION_STATUS');

    const hasValidApprovalReference =
      row.approval_reference === null ||
      isNonEmptyString(row.approval_reference);
    if (!hasValidApprovalReference) add('INVALID_APPROVAL_REFERENCE');
    if (
      hasValidDecisionStatus &&
      row.decision_status === 'APPROVED' &&
      !isNonEmptyString(row.approval_reference)
    ) {
      add('APPROVAL_WITHOUT_REFERENCE');
    } else if (
      hasValidDecisionStatus &&
      row.decision_status === 'APPROVED' &&
      isNonEmptyString(row.approval_reference) &&
      !APPROVAL_REFERENCE_PATTERN.test(row.approval_reference.trim())
    ) {
      add('INVALID_APPROVAL_REFERENCE');
    }
  }

  if (hasDuplicateId) add('DUPLICATE_ID');

  return { ok: errors.length === 0, errors };
}
