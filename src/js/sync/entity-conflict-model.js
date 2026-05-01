const HINT_TO_DECISION = {
  'same-checksum': 'same',
  'remote-newer': 'remote-newer',
  'local-newer': 'local-newer',
  'same-revision-different-checksum': 'manual',
  'both-changed': 'manual',
  'remote-delete': 'remote-newer',
  'local-delete': 'local-newer',
};

export function buildEntityConflictReviewModel(items = []) {
  const normalized = items.map((item) => {
    const hint = item.hint || null;
    let decisionHint = 'manual';
    if (hint && HINT_TO_DECISION[hint]) {
      decisionHint = HINT_TO_DECISION[hint];
    } else {
      if (Number(item.localRevision) > Number(item.remoteRevision)) decisionHint = 'local-newer';
      if (Number(item.remoteRevision) > Number(item.localRevision)) decisionHint = 'remote-newer';
    }
    return {
      ...item,
      decisionHint,
    };
  });

  return {
    total: normalized.length,
    requiresManualReview: normalized.some((item) => item.decisionHint === 'manual'),
    items: normalized,
  };
}
