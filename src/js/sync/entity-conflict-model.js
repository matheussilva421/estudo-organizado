export function buildEntityConflictReviewModel(items = []) {
  const normalized = items.map((item) => {
    let decisionHint = 'manual';
    if (Number(item.localRevision) > Number(item.remoteRevision)) decisionHint = 'local-newer';
    if (Number(item.remoteRevision) > Number(item.localRevision)) decisionHint = 'remote-newer';
    return {
      ...item,
      decisionHint
    };
  });

  return {
    total: normalized.length,
    requiresManualReview: normalized.some((item) => item.decisionHint === 'manual'),
    items: normalized
  };
}
