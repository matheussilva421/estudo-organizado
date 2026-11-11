import type { ThemeOption } from '../ui-state';
import type { DatabaseUpgradeState } from '../../platform/indexeddb';
import type { SyncHealth } from '../../application/sync-types';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { BackupHealth } from '../components/BackupControls';
import {
  classifyMaintenanceAction,
  redactDiagnostics,
} from '../settings-safety';
import {
  getStorageHealth,
  requestBestEffortPersistence,
  type StorageHealth,
} from '../../platform/storage-health';

export type Density = 'compact' | 'comfortable' | 'spacious';
export type GlowLevel = 'off' | 'subtle' | 'moderate' | 'high';
export type MotionLevel = 'off' | 'subtle' | 'full';
export type CardStyle = 'solid' | 'elevated' | 'glass';

type Props = {
  profileId: string;
  googleEmail?: string | null;
  themes: ThemeOption[];
  theme: string;
  onThemeChange: (theme: string) => void;
  density: Density;
  onDensityChange: (density: Density) => void;
  glow: GlowLevel;
  onGlowChange: (glow: GlowLevel) => void;
  motion: MotionLevel;
  onMotionChange: (motion: MotionLevel) => void;
  cardStyle: CardStyle;
  onCardStyleChange: (style: CardStyle) => void;
  onReset: () => void;
  health: SyncHealth;
  backupHealth?: BackupHealth;
  pendingOutbox: number;
  upgrade: DatabaseUpgradeState;
  googleLink?: ReactNode;
  syncConflicts?: ReactNode;
  recovery?: ReactNode;
  backupControls?: ReactNode;
  cloudBackups?: ReactNode;
  localBackup?: ReactNode;
};

const CATEGORIES = [
  ['overview', 'Visão geral'],
  ['appearance', 'Aparência'],
  ['profile', 'Perfil e conexão'],
  ['backup', 'Backup e recuperação'],
  ['storage', 'Armazenamento'],
  ['privacy', 'Privacidade'],
] as const;

function downloadDiagnostics(value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'estudo-organizado-diagnostico-redigido.json';
  link.click();
  URL.revokeObjectURL(url);
}

function formatBytes(value: number | null): string {
  if (value === null) return 'indisponível';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} kB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function SettingsView({
  profileId,
  googleEmail,
  themes,
  theme,
  onThemeChange,
  density,
  onDensityChange,
  glow,
  onGlowChange,
  motion,
  onMotionChange,
  cardStyle,
  onCardStyleChange,
  onReset,
  health,
  backupHealth,
  pendingOutbox,
  upgrade,
  googleLink,
  syncConflicts,
  recovery,
  backupControls,
  cloudBackups,
  localBackup,
}: Props) {
  const [storage, setStorage] = useState<StorageHealth | null>(null);
  const [persistenceMessage, setPersistenceMessage] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getStorageHealth().then((next) => {
      if (active) setStorage(next);
    });
    return () => {
      active = false;
    };
  }, []);
  const maintenance = classifyMaintenanceAction('CLEAR_REGENERABLE_CACHE', {
    upgradeBlocked: upgrade.blocked,
    quota: storage?.warning === 'LOW_SPACE',
    pendingWrites: pendingOutbox > 0,
  });
  const diagnostics = redactDiagnostics({
    schema: 'f7-ux-diagnostics-v1',
    profileId,
    googleEmail,
    health,
    backupHealth: backupHealth ?? null,
    pendingOutbox,
    upgrade,
  });

  return (
    <section className="view settings-view" data-studio="settings" aria-labelledby="settings-title" data-testid="f6-settings">
      <header className="view-header">
        <div>
          <p className="eyebrow">Preferências e integridade</p>
          <h2 id="settings-title">Configurações</h2>
          <p className="view-subtitle">
            Aparência, perfil, sincronização, cofre local e manutenção em superfícies separadas.
          </p>
        </div>
      </header>

      <nav className="settings-categories" aria-label="Categorias de configurações">
        {CATEGORIES.map(([id, label]) => (
          <a key={id} href={`#settings-${id}`}>{label}</a>
        ))}
      </nav>

      <section className="panel" id="settings-overview" aria-labelledby="settings-overview-title">
        <header className="section-header">
          <h3 id="settings-overview-title">Visão geral</h3>
          <span className="badge">{health.mode}</span>
        </header>
        <dl className="integrity-grid">
          <div data-integrity="local"><dt>Local</dt><dd>{health.localCommitted ? 'Commit do dispositivo' : 'Sem dados locais'}</dd></div>
          <div data-integrity="remote"><dt>ACK remoto</dt><dd>{health.remoteCommitted ? 'Confirmado' : 'Sem prova'}</dd></div>
          <div data-integrity="convergence"><dt>Convergência</dt><dd>{health.converged ? 'Escopo verificado' : 'Não verificada'}</dd></div>
          <div data-integrity="backup"><dt>Backup</dt><dd>{backupHealth?.status === 'VERIFIED' ? 'Destino verificado' : 'Não comprovado'}</dd></div>
        </dl>
        <p className="hint">Estados independentes: salvo não significa enviado, confirmado ou recuperável.</p>
      </section>

      <section className="panel" id="settings-appearance" aria-labelledby="settings-appearance-title">
        <header className="section-header">
          <h3 id="settings-appearance-title">Aparência deste dispositivo</h3>
          <button type="button" className="button-ghost" onClick={onReset}>Restaurar aparência</button>
        </header>
        <div className="theme-gallery" role="group" aria-label="Galeria de temas">
          {themes.map((option) => (
            <button
              key={option.id}
              type="button"
              className="theme-card"
              aria-pressed={theme === option.id}
              onClick={() => onThemeChange(option.id)}
              data-theme-option={option.id}
            >
              <span
                className="theme-swatch"
                aria-hidden="true"
                style={{
                  background: `linear-gradient(135deg, ${option.preview.background} 0%, ${option.preview.surface} 100%)`,
                  borderColor: option.preview.accent,
                }}
              >
                <span style={{ background: option.preview.accent }} />
                <span style={{ background: option.preview.text }} />
              </span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
        <div className="settings-row">
          <label htmlFor="settings-theme">Tema da interface</label>
          <select id="settings-theme" value={theme} onChange={(event) => onThemeChange(event.target.value)}>
            {themes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </div>
        <div className="settings-row">
          <label htmlFor="settings-density">Densidade</label>
          <select id="settings-density" value={density} onChange={(event) => onDensityChange(event.target.value as Density)}>
            <option value="compact">Compacta</option>
            <option value="comfortable">Confortável</option>
            <option value="spacious">Espaçosa</option>
          </select>
        </div>
        <div className="settings-row">
          <label htmlFor="settings-glow">Brilho/glow</label>
          <select id="settings-glow" value={glow} onChange={(event) => onGlowChange(event.target.value as GlowLevel)}>
            <option value="off">Desligado</option>
            <option value="subtle">Sutil</option>
            <option value="moderate">Moderado</option>
            <option value="high">Alto</option>
          </select>
        </div>
        <div className="settings-row">
          <label htmlFor="settings-motion">Movimento</label>
          <select id="settings-motion" value={motion} onChange={(event) => onMotionChange(event.target.value as MotionLevel)}>
            <option value="off">Desligado</option>
            <option value="subtle">Sutil</option>
            <option value="full">Completo</option>
          </select>
        </div>
        <div className="settings-row">
          <label htmlFor="settings-cards">Aparência dos cards</label>
          <select id="settings-cards" value={cardStyle} onChange={(event) => onCardStyleChange(event.target.value as CardStyle)}>
            <option value="solid">Sólido</option>
            <option value="elevated">Elevado</option>
            <option value="glass">Vidro discreto</option>
          </select>
        </div>
        <p className="muted">Os 12 temas preservam contraste, foco e alvos de toque. Preferência local não é dado acadêmico.</p>
      </section>

      <section className="panel" id="settings-profile" aria-labelledby="settings-profile-title">
        <header className="section-header"><h3 id="settings-profile-title">Perfil e conexão</h3></header>
        <dl className="scope-grid">
          <div><dt>Perfil local</dt><dd>{profileId}</dd></div>
          <div><dt>Conta Google</dt><dd>{googleEmail ?? 'Não vinculada'}</dd></div>
          <div><dt>Fila</dt><dd>{pendingOutbox} operação(ões) pendente(s)</dd></div>
        </dl>
        <p className="muted">O vínculo é opcional e consentido. Trocar de conta não transfere nem apaga a fila antiga.</p>
        {googleLink}
        {syncConflicts}
      </section>

      <section className="panel" id="settings-backup" aria-labelledby="settings-backup-title">
        <header className="section-header">
          <h3 id="settings-backup-title">Cofre local e recuperação</h3>
          <span className="muted">Cobertura integral não presumida</span>
        </header>
        <p className="muted">Prévia SAFE não é restauração. REBASELINE_REQUIRED bloqueia escrita direta; outbox e tombstones são preservados.</p>
        <p className="hint">Preferências de layout e relatórios arquivados neste navegador não fazem parte do backup F7; exporte-os separadamente e não os trate como recuperação acadêmica.</p>
        {recovery}
        {backupControls}
        {cloudBackups}
        {localBackup}
      </section>

      <section className="panel" id="settings-storage" aria-labelledby="settings-storage-title">
        <header className="section-header"><h3 id="settings-storage-title">Armazenamento e manutenção</h3></header>
        <dl className="scope-grid">
          <div><dt>IndexedDB</dt><dd>{upgrade.kind}{upgrade.blocked ? ' · bloqueado' : ''}</dd></div>
          <div><dt>Limpeza seletiva</dt><dd>{maintenance.allowed ? 'Disponível para caches regeneráveis' : 'Bloqueada'}</dd></div>
          <div><dt>Banco bruto</dt><dd>Exclusão direta não oferecida</dd></div>
          <div><dt>Persistência do navegador</dt><dd>{storage?.persistent === true ? 'Concedida' : storage?.persistent === false ? 'Não concedida' : 'Não verificada'}</dd></div>
          <div><dt>Uso estimado</dt><dd>{formatBytes(storage?.estimatedUsage ?? null)} de {formatBytes(storage?.estimatedQuota ?? null)}</dd></div>
          <div><dt>Pressão de espaço</dt><dd>{storage?.warning === 'LOW_SPACE' ? 'Baixo espaço estimado' : storage?.warning === 'UNAVAILABLE' ? 'Estimativa indisponível' : 'Sem alerta'}</dd></div>
        </dl>
        {upgrade.blocked ? (
          <p className="inline-notice" role="alert">Atualização bloqueada por outra aba. Feche ou recarregue; nenhum banco será apagado.</p>
        ) : null}
        {!maintenance.allowed && maintenance.reason ? <p className="hint">{maintenance.reason}</p> : null}
        <button
          type="button"
          className="button-ghost"
          onClick={() => {
            void requestBestEffortPersistence().then((result) => {
              setPersistenceMessage(
                result === 'GRANTED'
                  ? 'Persistência concedida; isso reduz despejo automático, mas não cria backup.'
                  : result === 'DENIED'
                    ? 'Persistência não concedida; dados locais continuam no IndexedDB, sem garantia contra limpeza externa.'
                    : 'Persistência não suportada neste navegador.',
              );
              void getStorageHealth().then(setStorage);
            });
          }}
        >
          Solicitar persistência do navegador
        </button>
        {persistenceMessage ? <p className="hint" role="status">{persistenceMessage}</p> : null}
        <p className="muted">Sessões, rascunhos, outbox, checkpoints e auditoria não são cache regenerável.</p>
      </section>

      <section className="panel" id="settings-privacy" aria-labelledby="settings-privacy-title">
        <header className="section-header">
          <h3 id="settings-privacy-title">Privacidade e diagnóstico</h3>
          <button type="button" className="button-ghost" onClick={() => downloadDiagnostics(diagnostics)}>
            Exportar diagnóstico redigido
          </button>
        </header>
        <p className="muted">Credenciais, tokens, e-mail e uid são removidos antes da exportação. Nada é enviado automaticamente.</p>
        <p className="source-note">Navegação por teclado, foco visível, landmarks e skip link integram o shell. Ensaio manual com NVDA/Narrator permanece NOT_RUN.</p>
      </section>
    </section>
  );
}
