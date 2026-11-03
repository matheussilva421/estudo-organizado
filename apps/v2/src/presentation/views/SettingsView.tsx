import type { ThemeOption } from '../ui-state';
import type { DatabaseUpgradeState } from '../../platform/indexeddb';
import type { SyncHealth } from '../../application/sync-types';

export type Density = 'comfortable' | 'compact';

type Props = {
  themes: ThemeOption[];
  theme: string;
  onThemeChange: (theme: string) => void;
  density: Density;
  onDensityChange: (density: Density) => void;
  onReset: () => void;
  health: SyncHealth;
  pendingOutbox: number;
  upgrade: DatabaseUpgradeState;
};

export function SettingsView({
  themes,
  theme,
  onThemeChange,
  density,
  onDensityChange,
  onReset,
  health,
  pendingOutbox,
  upgrade,
}: Props) {
  return (
    <section className="view settings-view" aria-labelledby="settings-title" data-testid="f6-settings">
      <header className="view-header">
        <div>
          <p className="eyebrow">Configurações</p>
          <h2 id="settings-title">Preferências deste dispositivo</h2>
          <p className="view-subtitle">
            Aparência é local e não altera fatos acadêmicos. Perfil, sync e backup são dimensões
            separadas.
          </p>
        </div>
      </header>

      <section className="panel" aria-labelledby="settings-appearance-title">
        <header className="section-header">
          <h3 id="settings-appearance-title">Aparência</h3>
          <button type="button" className="button-ghost" onClick={onReset}>
            Restaurar aparência
          </button>
        </header>
        <div className="settings-row">
          <label htmlFor="settings-theme">Tema da interface</label>
          <select
            id="settings-theme"
            value={theme}
            onChange={(event) => onThemeChange(event.target.value)}
          >
            {themes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="settings-row">
          <label htmlFor="settings-density">Densidade</label>
          <select
            id="settings-density"
            value={density}
            onChange={(event) => onDensityChange(event.target.value as Density)}
          >
            <option value="comfortable">Confortável</option>
            <option value="compact">Compacta</option>
          </select>
        </div>
        <p className="muted">
          Os oito temas preservam contraste e a identidade steel-blue. Alterar tema, densidade ou
          viewport não interrompe uma sessão F4 em andamento.
        </p>
      </section>

      <section className="panel" aria-labelledby="settings-integrity-title">
        <header className="section-header">
          <h3 id="settings-integrity-title">Status de integridade</h3>
        </header>
        <dl className="integrity-grid">
          <div data-integrity="local">
            <dt>Local</dt>
            <dd>{health.localCommitted ? 'Commit local confirmado' : 'Sem dados locais'}</dd>
          </div>
          <div data-integrity="remote">
            <dt>Remoto</dt>
            <dd>{health.remoteCommitted ? 'Enviado (não convergido)' : 'Indisponível/não enviado'}</dd>
          </div>
          <div data-integrity="backup">
            <dt>Backup</dt>
            <dd>Não verificado</dd>
          </div>
        </dl>
        <ul className="integrity-notes">
          <li>Outbox: {pendingOutbox} operação(ões) pendente(s).</li>
          <li>Atualização do banco: {upgrade.kind}{upgrade.blocked ? ' (bloqueada)' : ''}.</li>
          <li>
            Nenhuma ação destrutiva é automática. Limpeza, reconstrução e restore exigem decisão
            humana.
          </li>
        </ul>
      </section>

      <section className="panel" aria-labelledby="settings-a11y-title">
        <header className="section-header">
          <h3 id="settings-a11y-title">Acessibilidade</h3>
        </header>
        <p className="muted">
          Navegação por teclado, foco visível, landmarks, skip link, alvos de toque ampliados em
          ponteiro coarse e respeito a prefers-reduced-motion fazem parte do shell. A verificação
          automatizada não substitui ensaio manual com leitor de tela.
        </p>
      </section>
    </section>
  );
}

