import type { SyncHealth } from '../application/sync-types';

export type ThemeOption = { id: string; label: string };

export const THEMES: ThemeOption[] = [
  { id: 'grafite', label: 'Grafite' },
  { id: 'ardosia', label: 'Ardósia' },
  { id: 'platina', label: 'Platina' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'neon', label: 'Neon' },
  { id: 'arrakis', label: 'Arrakis' },
  { id: 'codex', label: 'Codex' },
  { id: 'plasma', label: 'Plasma' },
];

export type FormState = {
  title: string;
  error: string | null;
  submitting: boolean;
};

export const initialFormState: FormState = {
  title: '',
  error: null,
  submitting: false,
};

export function canSubmitTitle(title: string): boolean {
  const normalized = title.trim();
  return normalized.length > 0 && normalized.length <= 120;
}

export function markSubmitFailure(state: FormState, message: string): FormState {
  return { ...state, error: message, submitting: false };
}

export function syncStatusLabel(health: SyncHealth): string {
  if (health.converged && health.lastVerifiedCursor) {
    return 'Sincronizado · outros dispositivos atualizados até o cursor verificado';
  }
  if (health.remoteCommitted) {
    return 'Enviado para a nuvem · aguardando confirmação de convergência';
  }
  if (health.localCommitted) {
    const pending = health.pendingCount > 0
      ? ` · ${health.pendingCount} pendente${health.pendingCount === 1 ? '' : 's'}`
      : '';
    return `Salvo neste dispositivo${pending}`;
  }
  return 'Pronto para criar a primeira disciplina';
}

export type SemanticState =
  | 'LOADING'
  | 'EMPTY'
  | 'PENDING'
  | 'LOCAL_COMMITTED'
  | 'FAILED'
  | 'CONFLICT'
  | 'STALE'
  | 'UNAVAILABLE'
  | 'READY';

export const SEMANTIC_STATE_LABELS: Record<SemanticState, string> = {
  LOADING: 'Carregando dados locais',
  EMPTY: 'Sem dados neste perfil',
  PENDING: 'Alteração pendente de confirmação',
  LOCAL_COMMITTED: 'Salvo localmente',
  FAILED: 'Falha ao gravar ou ler',
  CONFLICT: 'Conflito exige decisão',
  STALE: 'Dados desatualizados',
  UNAVAILABLE: 'Serviço indisponível',
  READY: 'Pronto',
};

/** Labels are presentation only; service codes remain authoritative. */
export function semanticStateLabel(state: SemanticState): string {
  return SEMANTIC_STATE_LABELS[state];
}
