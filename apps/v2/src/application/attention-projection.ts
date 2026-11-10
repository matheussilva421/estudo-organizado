export type AttentionSeverity = 'info' | 'warning' | 'critical';

export type AttentionOccurrence = {
  id: string;
  causalKey: string;
  source: string;
  title: string;
  detail: string;
  severity: AttentionSeverity;
  academicEntityId: string | null;
  dismissible: boolean;
};

export type ProjectedAttentionItem = Omit<AttentionOccurrence, 'id' | 'causalKey'> & {
  id: string;
  severity: AttentionSeverity;
  evidence: string[];
};

const SEVERITY: Record<AttentionSeverity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

export function projectAttentionItems(
  occurrences: readonly AttentionOccurrence[],
  options: { dismissedKeys?: ReadonlySet<string> } = {},
): { items: ProjectedAttentionItem[]; badgeCount: number } {
  const dismissed = options.dismissedKeys ?? new Set<string>();
  const byCausalKey = new Map<string, ProjectedAttentionItem>();

  for (const occurrence of occurrences) {
    if (!occurrence.causalKey || dismissed.has(occurrence.causalKey)) continue;
    const existing = byCausalKey.get(occurrence.causalKey);
    const candidate: ProjectedAttentionItem = {
      id: occurrence.causalKey,
      source: occurrence.source,
      title: occurrence.title,
      detail: occurrence.detail,
      severity: occurrence.severity,
      academicEntityId: occurrence.academicEntityId,
      dismissible: occurrence.dismissible,
      evidence: [occurrence.source],
    };
    if (!existing) {
      byCausalKey.set(occurrence.causalKey, candidate);
      continue;
    }
    if (SEVERITY[candidate.severity] > SEVERITY[existing.severity]) existing.severity = candidate.severity;
    if (candidate.detail.length > existing.detail.length) existing.detail = candidate.detail;
    if (!existing.evidence.includes(occurrence.source)) existing.evidence.push(occurrence.source);
    existing.dismissible = existing.dismissible && occurrence.dismissible;
  }

  const items = [...byCausalKey.values()].sort((left, right) => {
    const severity = SEVERITY[right.severity] - SEVERITY[left.severity];
    if (severity !== 0) return severity;
    return left.id.localeCompare(right.id);
  });
  return { items, badgeCount: items.length };
}
