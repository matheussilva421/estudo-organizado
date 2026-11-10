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
  target?: import('./experience-queries').PriorityTarget;
  entityId?: string | null;
};

export type ProjectedAttentionItem = Omit<AttentionOccurrence, 'id' | 'causalKey'> & {
  id: string;
  severity: AttentionSeverity;
  evidence: string[];
};

export type AttentionBuildInput = {
  summary: import('./experience-queries').HomeSummary;
  health: import('./sync-types').SyncHealth;
  pendingOutbox: number;
  upgradeBlocked: boolean;
  backupStatus: 'NONE' | 'PENDING' | 'VERIFIED' | 'FAILED';
};

export const ATTENTION_DISMISSIBLE_CATEGORIES: import('./experience-queries').PriorityCategory[] = ['DIAGNOSTICO', 'ORIENTACAO'];

export function buildAttentionOccurrences(input: AttentionBuildInput): AttentionOccurrence[] {
  const items: AttentionOccurrence[] = input.summary.priorities.map((item) => ({
    id: item.id,
    causalKey: `priority:${item.id}`,
    source: 'home',
    title: item.title,
    detail: item.detail,
    severity:
      item.category === 'INTEGRIDADE'
        ? 'critical'
        : item.category === 'DIAGNOSTICO' || item.category === 'ATRASO_REAL'
          ? 'warning'
          : 'info',
    academicEntityId: item.entityId ?? null,
    dismissible: ATTENTION_DISMISSIBLE_CATEGORIES.includes(item.category),
    target: item.target,
    entityId: item.entityId ?? null,
  }));
  if (
    input.health.mode === 'CONFLICT' ||
    input.health.mode === 'RECOVERY_REQUIRED' ||
    input.health.mode === 'PAUSED_AUTH' ||
    input.health.mode === 'PAUSED_QUOTA'
  ) {
    items.push({
      id: `health-${input.health.mode}`,
      causalKey: `sync:${input.health.mode}`,
      source: 'sync',
      title: input.health.mode === 'CONFLICT' ? 'Conflito remoto exige decisão' : 'Sincronização pausada',
      detail:
        input.health.mode === 'RECOVERY_REQUIRED'
          ? 'Recuperação é necessária antes de enviar. Os dados locais continuam disponíveis.'
          : 'A falha está limitada ao transporte remoto; nenhum fato local foi apagado.',
      severity: input.health.mode === 'CONFLICT' || input.health.mode === 'RECOVERY_REQUIRED' ? 'critical' : 'warning',
      academicEntityId: null,
      dismissible: false,
      target: 'settings',
      entityId: null,
    });
  }
  if (input.upgradeBlocked) {
    items.push({
      id: 'upgrade-blocked',
      causalKey: 'local:upgrade-blocked',
      source: 'indexeddb',
      title: 'Atualização do IndexedDB bloqueada',
      detail: 'Feche ou recarregue a outra aba. Nenhuma exclusão automática será feita.',
      severity: 'critical',
      academicEntityId: null,
      dismissible: false,
      target: 'settings',
      entityId: null,
    });
  }
  if (input.backupStatus === 'FAILED') {
    items.push({
      id: 'backup-failed',
      causalKey: 'backup:failed',
      source: 'backup',
      title: 'Falha no backup',
      detail: 'A última cópia preservada não deve ser tratada como atual nem como recuperação comprovada.',
      severity: 'warning',
      academicEntityId: null,
      dismissible: false,
      target: 'settings',
      entityId: null,
    });
  }
  if (input.pendingOutbox > 0 && !items.some((item) => item.causalKey === 'priority:integrity-outbox')) {
    items.push({
      id: 'outbox-summary',
      causalKey: 'outbox:pending',
      source: 'outbox',
      title: `${input.pendingOutbox} operação(ões) pendente(s)`,
      detail: 'Commit local não é ACK; a entrega continua sem confirmação.',
      severity: 'info',
      academicEntityId: null,
      dismissible: true,
      target: 'settings',
      entityId: null,
    });
  }
  return items;
}

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
      ...(occurrence.target ? { target: occurrence.target } : {}),
      entityId: occurrence.entityId ?? null,
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
