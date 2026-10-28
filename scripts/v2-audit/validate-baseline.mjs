const ID_PATTERN = /^B-V1-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const STATUSES = new Set([
  'PASS',
  'FAIL',
  'BLOCKED',
  'INCONCLUSIVE',
  'NOT_RUN',
]);
const REQUIRED_TEXT_FIELDS = [
  'area',
  'command_or_check',
  'environment',
  'notes',
];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateBaseline(rows) {
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
  let impeccableRows = 0;

  for (const row of rows) {
    if (!isRecord(row)) {
      add('ROW_NOT_OBJECT');
      continue;
    }

    if (!isNonEmptyString(row.id)) {
      add('EMPTY_REQUIRED_FIELD');
    } else if (!row.id.startsWith('B-V1-')) {
      add('INVALID_ID_PREFIX');
    } else if (!ID_PATTERN.test(row.id)) {
      add('INVALID_ID_FORMAT');
    } else {
      if (seenIds.has(row.id)) add('DUPLICATE_ID');
      else seenIds.add(row.id);
    }

    for (const field of REQUIRED_TEXT_FIELDS) {
      if (!isNonEmptyString(row[field])) add('EMPTY_REQUIRED_FIELD');
    }

    const hasValidStatus = STATUSES.has(row.status);
    if (!hasValidStatus) add('INVALID_STATUS');

    const hasValidEvidenceRef =
      row.evidence_ref === null || isNonEmptyString(row.evidence_ref);
    if (!hasValidEvidenceRef) add('INVALID_EVIDENCE_REF');

    const hasValidExecutedAt =
      row.executed_at === null || isNonEmptyString(row.executed_at);
    if (!hasValidExecutedAt) add('INVALID_EXECUTED_AT');

    if (hasValidStatus && row.status === 'PASS') {
      if (!isNonEmptyString(row.evidence_ref)) add('PASS_WITHOUT_EVIDENCE');
      if (!isNonEmptyString(row.executed_at)) add('PASS_WITHOUT_TIMESTAMP');
    }

    if (row.area === 'IMPECCABLE') impeccableRows += 1;
  }

  if (impeccableRows === 0) add('MISSING_IMPECCABLE');

  return { ok: errors.length === 0, errors };
}

export function computeBaselineGate(rows) {
  if (!validateBaseline(rows).ok) return 'BLOCKED';

  const impeccableRows = rows.filter(
    (row) => isRecord(row) && row.area === 'IMPECCABLE',
  );

  return impeccableRows.length === 1 && impeccableRows[0].status === 'PASS'
    ? 'PASS'
    : 'BLOCKED';
}
