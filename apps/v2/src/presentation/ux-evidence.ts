export type UxEvidenceSeverity = 'info' | 'warning' | 'critical';

export type UxEvidenceKind = 'LOCAL_COMMIT' | 'OUTBOX' | 'SYNC' | 'BACKUP' | 'READ';

export type UxEvidence = {
  id: string;
  kind: UxEvidenceKind;
  scope: string;
  title: string;
  detail: string;
  proof: string;
  severity: UxEvidenceSeverity;
  action?: { label: string; module: 'attention' | 'settings' | 'sessions' | 'analytics' };
};

export type UxEvidenceInput = {
  localCommitted: boolean;
  outbox: { pending: number; failed: number; conflicts: number };
  sync: {
    mode: string;
    remoteCommitted: boolean;
    converged: boolean;
    verifiedCursor: string | null;
    conflictCount: number;
  };
  backup: {
    status: 'NONE' | 'VERIFIED' | 'FAILED';
    coverage: 'NONE' | 'F2_PARTIAL' | 'FULL';
    preview: 'NONE' | 'SAFE' | 'INVALID' | 'REBASELINE_REQUIRED';
  };
  read: { stale: boolean; partial: boolean; error: boolean };
};

/**
 * Translates technical facts into presentation evidence. The input is never
 * changed and an absent proof never becomes a successful one.
 */
export function describeUxEvidence(input: UxEvidenceInput): UxEvidence[] {
  const items: UxEvidence[] = [];

  if (input.localCommitted) {
    items.push({
      id: 'local-commit',
      kind: 'LOCAL_COMMIT',
      scope: 'este dispositivo',
      title: 'Salvo neste dispositivo',
      detail:
        'Commit local confirmado. Isso não confirma envio remoto, ACK ou convergência entre dispositivos.',
      proof: 'LOCAL_COMMITTED',
      severity: 'info',
    });
  }

  if (input.outbox.pending > 0) {
    items.push({
      id: 'outbox-pending',
      kind: 'OUTBOX',
      scope: 'fila local',
      title: `${input.outbox.pending} operação(ões) na outbox`,
      detail: 'Aguardando entrega; pendência não é falha nem prova de ACK.',
      proof: 'PENDING',
      severity: 'info',
      action: { label: 'Abrir atenção', module: 'attention' },
    });
  }

  if (input.outbox.failed > 0) {
    items.push({
      id: 'outbox-failed',
      kind: 'OUTBOX',
      scope: 'fila local',
      title: `${input.outbox.failed} tentativa(s) exigiram revisão`,
      detail: 'A falha não altera o fato acadêmico já confirmado localmente.',
      proof: 'RETRY_REQUIRED',
      severity: 'warning',
      action: { label: 'Diagnosticar', module: 'settings' },
    });
  }

  if (input.outbox.conflicts > 0 || input.sync.conflictCount > 0) {
    items.push({
      id: 'outbox-conflict',
      kind: 'OUTBOX',
      scope: 'escopo em conflito',
      title: 'Versões divergentes preservadas',
      detail: 'É necessária uma decisão explícita; nenhuma versão foi sobrescrita.',
      proof: 'CONFLICT',
      severity: 'critical',
      action: { label: 'Resolver conflito', module: 'settings' },
    });
  }

  if (input.sync.remoteCommitted) {
    items.push({
      id: 'remote-ack',
      kind: 'SYNC',
      scope: input.sync.verifiedCursor ? `cursor ${input.sync.verifiedCursor}` : 'operação confirmada',
      title: input.sync.converged
        ? 'Convergência verificada no escopo comprovado'
        : 'ACK remoto confirmado',
      detail: input.sync.converged
        ? 'O cursor verificado sustenta convergência apenas no escopo efetivamente provado.'
        : 'Operação confirmada; convergência não verificada para toda a biblioteca.',
      proof: input.sync.converged ? 'CONVERGED' : 'REMOTE_ACK',
      severity: 'info',
    });
  } else if (/CONFLICT|RECOVERY_REQUIRED|PAUSED_|PENDING_OFFLINE/.test(input.sync.mode)) {
    items.push({
      id: `sync-${input.sync.mode.toLowerCase()}`,
      kind: 'SYNC',
      scope: 'sincronização',
      title: syncModeTitle(input.sync.mode),
      detail: 'Os dados locais permanecem disponíveis; nenhum envio bem-sucedido é presumido.',
      proof: input.sync.mode,
      severity: input.sync.mode === 'CONFLICT' || input.sync.mode === 'RECOVERY_REQUIRED'
        ? 'critical'
        : 'warning',
      action: { label: 'Ver detalhes', module: 'settings' },
    });
  }

  if (input.backup.preview === 'SAFE' || input.backup.preview === 'REBASELINE_REQUIRED') {
    items.push({
      id: 'backup-preview',
      kind: 'BACKUP',
      scope: 'arquivo inspecionado',
      title: input.backup.preview === 'SAFE' ? 'Prévia de restauração segura' : 'Restauração direta bloqueada',
      detail:
        input.backup.preview === 'SAFE'
          ? 'Prévia não é restauração; o banco atual ainda precisa ser protegido e confirmado.'
          : 'Prévia REBASELINE_REQUIRED não apaga dados; recuperação exige revisão protegida.',
      proof: input.backup.preview,
      severity: 'warning',
      action: { label: 'Abrir backup', module: 'settings' },
    });
  }

  if (input.backup.coverage === 'F2_PARTIAL') {
    items.push({
      id: 'backup-partial',
      kind: 'BACKUP',
      scope: 'cobertura do arquivo',
      title: 'Backup parcial',
      detail: 'Cobertura F2 parcial não comprova recuperabilidade integral de F2–F7.',
      proof: 'F2_PARTIAL',
      severity: 'warning',
    });
  } else if (input.backup.status === 'VERIFIED') {
    items.push({
      id: 'backup-verified',
      kind: 'BACKUP',
      scope: input.backup.coverage === 'FULL' ? 'cobertura integral declarada' : 'cobertura não detalhada',
      title: 'Backup verificado no destino',
      detail: 'Checksum e read-back do destino foram confirmados; isso não prova restauração integral.',
      proof: 'BACKUP_VERIFIED',
      severity: 'info',
    });
  }

  if (input.read.stale) {
    items.push({
      id: 'read-stale',
      kind: 'READ',
      scope: 'última leitura',
      title: 'Leitura desatualizada',
      detail: 'Dado stale não significa ausência de dados nem uma fotografia atual.',
      proof: 'STALE',
      severity: 'warning',
    });
  }
  if (input.read.partial || input.read.error) {
    items.push({
      id: input.read.error ? 'read-error' : 'read-partial',
      kind: 'READ',
      scope: 'leitura local',
      title: input.read.error ? 'Falha de leitura local' : 'Leitura parcial',
      detail: input.read.error
        ? 'Erro não é banco vazio; nenhum valor zero foi inferido.'
        : 'Somente parte das fontes respondeu; os totais são diagnósticos.',
      proof: input.read.error ? 'ERROR' : 'PARTIAL',
      severity: input.read.error ? 'critical' : 'warning',
    });
  }

  return items;
}

function syncModeTitle(mode: string): string {
  if (mode === 'CONFLICT') return 'Conflito remoto exige decisão';
  if (mode === 'RECOVERY_REQUIRED') return 'Recuperação necessária antes de enviar';
  if (mode === 'PAUSED_QUOTA') return 'Sincronização pausada por quota';
  if (mode === 'PAUSED_AUTH') return 'Sessão Google expirada';
  if (mode === 'PENDING_OFFLINE') return 'Offline com alterações pendentes';
  return 'Sincronização não confirmada';
}
