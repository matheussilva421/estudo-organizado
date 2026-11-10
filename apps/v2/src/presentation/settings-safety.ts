export type MaintenanceAction =
  | 'CLEAR_REGENERABLE_CACHE'
  | 'REBUILD_PROJECTIONS'
  | 'DELETE_DATABASE'
  | 'UNLINK_ACCOUNT'
  | 'RESET_PREFERENCES';

export type MaintenanceContext = {
  upgradeBlocked: boolean;
  quota: boolean;
  pendingWrites?: boolean;
  activeDraft?: boolean;
};

export type MaintenanceDecision = { allowed: boolean; reason: string | null };

export function classifyMaintenanceAction(
  action: MaintenanceAction,
  context: MaintenanceContext,
): MaintenanceDecision {
  if (action === 'DELETE_DATABASE') {
    return { allowed: false, reason: 'Excluir o banco bruto não é oferecido como ação de manutenção.' };
  }
  if (context.upgradeBlocked) {
    return { allowed: false, reason: 'A atualização do IndexedDB está bloqueada por outra aba.' };
  }
  if (action === 'CLEAR_REGENERABLE_CACHE' || action === 'REBUILD_PROJECTIONS') {
    if ((context.pendingWrites ?? false) || (context.activeDraft ?? false)) {
      return {
        allowed: false,
        reason: 'Pendências ou rascunhos ativos impedem reconstruções nesta sessão.',
      };
    }
    return { allowed: true, reason: null };
  }
  if (action === 'UNLINK_ACCOUNT') {
    if ((context.pendingWrites ?? false) || (context.activeDraft ?? false)) {
      return { allowed: false, reason: 'Resolva pendências e preserve rascunhos antes de desvincular.' };
    }
    return { allowed: true, reason: null };
  }
  if (action === 'RESET_PREFERENCES') return { allowed: true, reason: null };
  if (context.quota) {
    return { allowed: false, reason: 'Quota exige revisão; nenhuma limpeza automática é executada.' };
  }
  return { allowed: false, reason: 'Ação não classificada.' };
}

const SENSITIVE_KEYS = new Set([
  'token',
  'idtoken',
  'accesstoken',
  'refreshtoken',
  'password',
  'secret',
  'authorization',
  'email',
  'googleemail',
  'uid',
]);

/** Diagnostics are exportable only after credential/account redaction. */
export function redactDiagnostics(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactDiagnostics);
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEYS.has(key.toLowerCase())
        ? '[REDACTED]'
        : redactDiagnostics(child);
    }
    return result;
  }
  return value;
}
