import type { SyncHealth } from '../application/sync-types';

export type ThemePreview = {
  background: string;
  surface: string;
  accent: string;
  text: string;
};

export type ThemeOption = { id: string; label: string; preview: ThemePreview };

export const THEMES: ThemeOption[] = [
  { id: 'grafite', label: 'Grafite', preview: { background: '#08090d', surface: '#121821', accent: '#8aa4bf', text: '#f3f6fb' } },
  { id: 'ardosia', label: 'Ardósia', preview: { background: '#0c1015', surface: '#161c24', accent: '#7fa6c9', text: '#eef2f7' } },
  { id: 'platina', label: 'Platina', preview: { background: '#101215', surface: '#1a1e24', accent: '#b9c7d8', text: '#f4f6f9' } },
  { id: 'terminal', label: 'Terminal', preview: { background: '#050807', surface: '#0d1512', accent: '#5fd3a0', text: '#edf8f2' } },
  { id: 'neon', label: 'Neon', preview: { background: '#080a12', surface: '#121628', accent: '#b388ff', text: '#f0edfb' } },
  { id: 'arrakis', label: 'Arrakis', preview: { background: '#100d09', surface: '#1c1712', accent: '#d8a657', text: '#f6efe5' } },
  { id: 'codex', label: 'Codex', preview: { background: '#0a0d12', surface: '#141a24', accent: '#8aa4bf', text: '#f1f5fb' } },
  { id: 'plasma', label: 'Plasma', preview: { background: '#070d0c', surface: '#101c1a', accent: '#4fd1c5', text: '#eefaf7' } },
  { id: 'neon-teal', label: 'Neon Teal', preview: { background: '#04100f', surface: '#0b211e', accent: '#2dd4bf', text: '#e9fffb' } },
  { id: 'esmeralda-dourado', label: 'Esmeralda e Dourado', preview: { background: '#07130e', surface: '#102418', accent: '#d4af37', text: '#f4fbf5' } },
  { id: 'azul-ambar', label: 'Azul e Âmbar', preview: { background: '#071120', surface: '#10203b', accent: '#fbbf24', text: '#f1f7ff' } },
  { id: 'azul-glacial', label: 'Azul Glacial e Prata', preview: { background: '#0a1018', surface: '#14202f', accent: '#bae6fd', text: '#f4f9ff' } },
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
  if (health.mode === 'CONFLICT') return 'Conflito exige decisão';
  if (health.mode === 'RECOVERY_REQUIRED') return 'Recuperação necessária';
  if (health.mode === 'PAUSED_QUOTA') return 'Sincronização pausada por quota';
  if (health.mode === 'PAUSED_AUTH') return 'Sessão Google expirada';
  if (health.mode === 'PENDING_OFFLINE') return 'Offline · alterações pendentes';
  if (health.mode === 'SYNCING') return 'Sincronizando';
  if (health.converged && health.lastVerifiedCursor) {
    return 'Sincronizado neste dispositivo até o cursor verificado';
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
