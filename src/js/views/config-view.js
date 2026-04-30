/**
 * Config View
 * Settings page rendering and configuration helpers
 */

import {
  THEME_OPTIONS,
  applyTheme,
  normalizeTheme,
  showConfirm,
  showToast,
  openModal,
  getLastSaveStatus,
} from '../app.js?v=8.30';
import { cutoffDateStr, esc, todayStr, invalidateTodayCache } from '../utils.js?v=8.30';
import {
  scheduleSave,
  state,
  setState,
  runMigrations,
  createExportableState,
  clearData,
} from '../store.js?v=8.30';
import {
  syncCicloToEventos,
  invalidateDiscCache,
  invalidateDashCaches,
  invalidateRevCache,
} from '../logic.js?v=8.30';
import { renderCurrentView } from '../components.js?v=8.30';
import { buildSyncCenterModel } from '../sync/sync-center.js?v=8.30';
import { getFirestoreSyncStatus, pullFromFirestore } from '../sync/firestore-sync-engine.js?v=8.30';
import { setSyncCreds, forceCloudflareSync, pullFromCloudflare } from '../cloud-sync.js?v=8.30';
import { disconnectDrive, pullFromDrive } from '../drive-sync.js?v=8.30';
import { previewRestoreImpact, validateBackupPayload } from '../backup-restore.js?v=8.30';

function formatBackupDateTime(value) {
  if (!value) return 'Nunca';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return 'Nunca';
    return d.toLocaleString('pt-BR');
  } catch {
    return 'Nunca';
  }
}

function renderCloudflareConflict(conflict) {
  if (!conflict) return '';

  const remote = formatBackupDateTime(conflict.remoteUpdatedAt);
  const detected = formatBackupDateTime(conflict.detectedAt);
  const device = esc(conflict.remoteDeviceId || 'dispositivo remoto');

  return `
    <div class="sync-conflict-panel" data-testid="cf-sync-conflict" role="alert">
      <div class="sync-conflict-header">
        <i class="fa fa-triangle-exclamation"></i>
        <div>
          <div class="sync-conflict-title">Conflito de sincronização</div>
          <div class="sync-conflict-sub">O remoto mudou antes deste dispositivo enviar seus dados.</div>
        </div>
      </div>
      <div class="sync-conflict-meta">
        <span>Remoto: ${remote}</span>
        <span>Origem: ${device}</span>
        <span>Detectado: ${detected}</span>
      </div>
      <div class="sync-conflict-actions">
        <button type="button" class="btn btn-outline btn-sm" data-action="cloud-conflict-export-local">
          <i class="fa fa-download"></i> Exportar backup local
        </button>
        <button type="button" class="btn btn-primary btn-sm" data-action="cloud-conflict-pull-remote">
          <i class="fa fa-cloud-download-alt"></i> Baixar remoto
        </button>
        <button type="button" class="btn btn-danger btn-sm" data-action="cloud-conflict-force-push">
          <i class="fa fa-cloud-upload-alt"></i> Forçar envio local
        </button>
      </div>
    </div>
  `;
}

function renderFirestoreConflict(conflict) {
  if (!conflict) return '';
  const items = Array.isArray(conflict.items) ? conflict.items : [];
  const entityRows = items
    .slice(0, 8)
    .map(
      (item) => `
    <div class="sync-conflict-entity">
      <span>${esc(item.collection || 'entidade')}</span>
      <code>${esc(item.id || item.key || 'sem-id')}</code>
      <span>Local rev. ${esc(item.localRevision ?? '-')}</span>
      <span>Remoto rev. ${esc(item.remoteRevision ?? '-')}</span>
      <span>${formatBackupDateTime(item.localUpdatedAt || item.remoteUpdatedAt)}</span>
    </div>
  `
    )
    .join('');

  return `
    <div class="sync-conflict-panel" data-testid="firestore-sync-conflict" role="alert">
      <div class="sync-conflict-header">
        <i class="fa fa-triangle-exclamation"></i>
        <div>
          <div class="sync-conflict-title">Conflito Firestore</div>
          <div class="sync-conflict-sub">Existe um snapshot remoto diferente do snapshot local pendente.</div>
        </div>
      </div>
      <div class="sync-conflict-meta">
        <span>Remoto: ${formatBackupDateTime(conflict.remoteUpdatedAt)}</span>
        <span>Local: ${formatBackupDateTime(conflict.localUpdatedAt)}</span>
        <span>Detectado: ${formatBackupDateTime(conflict.detectedAt)}</span>
      </div>
      ${
        items.length > 0
          ? `
        <div class="sync-conflict-entities" data-testid="firestore-conflict-entities">
          <div class="sync-conflict-entities-title">Entidades afetadas (${conflict.total || items.length})</div>
          ${entityRows}
          ${items.length > 8 ? `<div class="sync-source-note">Mais ${items.length - 8} entidades omitidas nesta lista.</div>` : ''}
        </div>
      `
          : ''
      }
      <div class="sync-conflict-actions">
        <button type="button" class="btn btn-outline btn-sm" data-action="firestore-export-local">
          <i class="fa fa-download"></i> Exportar backup local
        </button>
        <button type="button" class="btn btn-primary btn-sm" data-action="firestore-pull-remote">
          <i class="fa fa-cloud-download-alt"></i> Baixar Firestore
        </button>
        <button type="button" class="btn btn-danger btn-sm" data-action="firestore-force-push">
          <i class="fa fa-cloud-upload-alt"></i> Forçar envio local
        </button>
      </div>
    </div>
  `;
}

function _renderFirestoreCard() {
  const status = getFirestoreSyncStatus() || {
    configured: false,
    signedIn: false,
    enabled: false,
    mode: 'shadow',
    hasPendingWrites: false,
    conflict: null,
  };
  const configuredText = status.configured
    ? `Projeto: ${esc(status.projectId || status.uid || 'configurado')}`
    : 'Configure o Firebase antes de ativar.';
  const statusText = !status.configured
    ? 'Não configurado'
    : status.signedIn
      ? status.conflict
        ? 'Conflito precisa de revisão'
        : status.hasPendingWrites
          ? 'Alterações pendentes'
          : 'Pronto'
      : 'Aguardando login Google';
  const statusDetail = status.lastError
    ? `Erro: ${esc(status.lastError)}`
    : status.signedIn
      ? `Modo ${status.mode}; último push ${formatBackupDateTime(status.lastPushAt)}`
      : configuredText;

  return `
    <div class="card config-card">
      <div class="card-header"><h3><i class="fa fa-database"></i> Firestore (Primário)</h3></div>
      <div class="card-body">
        <div class="config-desc">Sincronização local-first automática com login Google. IndexedDB salva primeiro; Firestore sincroniza entre dispositivos; Cloudflare e Drive ficam como backups manuais.</div>

        ${renderFirestoreConflict(status.conflict)}

        <div class="config-row">
          <div>
            <div class="config-label">${statusText}</div>
            <div class="config-sub">${statusDetail}</div>
          </div>
          <span class="badge ${status.enabled ? 'badge-success' : 'badge-muted'}">${status.enabled ? 'Ativo' : 'Inativo'}</span>
        </div>

        <div class="grid config-backup-grid">
          <div class="flex flex-between"><span>Firestore remoto:</span><strong>${formatBackupDateTime(status.remoteUpdatedAt)}</strong></div>
          <div class="flex flex-between"><span>Último pull:</span><strong>${formatBackupDateTime(status.lastPullAt)}</strong></div>
          <div class="flex flex-between"><span>Último push:</span><strong>${formatBackupDateTime(status.lastPushAt)}</strong></div>
        </div>

        <div class="config-actions-row">
          ${
            status.signedIn
              ? `
            <button class="btn btn-ghost btn-sm" data-action="firestore-sign-out"><i class="fa fa-right-from-bracket"></i> Sair</button>
          `
              : `
            <button class="btn btn-primary btn-sm" data-action="firestore-sign-in" ${status.configured ? '' : 'disabled'}><i class="fa fa-user"></i> Entrar com Google</button>
          `
          }
          ${
            status.enabled
              ? `
            <button class="btn btn-primary btn-sm" data-action="firestore-sync-now"><i class="fa fa-sync"></i> Sincronizar</button>
            <button class="btn btn-ghost btn-sm" data-action="firestore-disable-sync">Desativar</button>
          `
              : `
            <button class="btn btn-primary btn-sm" data-action="firestore-enable-primary" ${status.signedIn ? '' : 'disabled'}>Ativar primário</button>
            <button class="btn btn-outline btn-sm" data-action="firestore-enable-shadow" ${status.signedIn ? '' : 'disabled'}>Shadow</button>
          `
          }
        </div>
      </div>
    </div>
  `;
}

function renderEntitySyncToggle() {
  const entitySync = state.config?.entitySync || {};
  const fsStatus = getFirestoreSyncStatus() || {};
  if (!fsStatus.signedIn || !fsStatus.enabled) return '';
  const isPrimary = entitySync.mode === 'primary';
  const isShadow = entitySync.mode === 'shadow';
  return `
    <div class="entity-sync-toggle" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Modo de entidades:</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button type="button" class="btn btn-sm ${isPrimary ? 'btn-primary' : 'btn-ghost'}" data-action="entity-sync-set-primary" ${isPrimary ? 'disabled' : ''}>Primário</button>
        <button type="button" class="btn btn-sm ${isShadow ? 'btn-primary' : 'btn-ghost'}" data-action="entity-sync-set-shadow" ${isShadow ? 'disabled' : ''}>Shadow</button>
        <button type="button" class="btn btn-sm ${!isPrimary && !isShadow ? 'btn-primary' : 'btn-ghost'}" data-action="entity-sync-set-off" ${!isPrimary && !isShadow ? 'disabled' : ''}>Desativado</button>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
        ${isPrimary ? 'Entidades como fonte primária (experimental).' : isShadow ? 'Entidades em shadow com snapshot fallback.' : 'Entidades desativadas; apenas snapshot.'}
      </div>
    </div>
  `;
}

function getSyncHealthLabel(health) {
  const labels = {
    ok: 'OK',
    idle: 'Inativo',
    pending: 'Pendente',
    conflict: 'Conflito',
    error: 'Erro',
  };
  return labels[health] || 'Status';
}

function getSyncHealthIcon(health) {
  const icons = {
    ok: 'fa-circle-check',
    idle: 'fa-circle',
    pending: 'fa-clock',
    conflict: 'fa-triangle-exclamation',
    error: 'fa-circle-xmark',
  };
  return icons[health] || 'fa-circle-info';
}

function renderSyncSourceActions(source) {
  if (source.id === 'local') {
    return `
      <button type="button" class="btn btn-ghost btn-sm" data-action="sync-center-export-local"><i class="fa fa-download"></i> Exportar local</button>
      <button type="button" class="btn btn-outline btn-sm" data-action="sync-center-import-local"><i class="fa fa-file-import"></i> Importar JSON</button>
    `;
  }

  if (source.id === 'firebase') {
    const status = getFirestoreSyncStatus() || {};
    return `
      ${status.signedIn ? '<button type="button" class="btn btn-ghost btn-sm" data-action="firestore-sign-out"><i class="fa fa-right-from-bracket"></i> Sair</button>' : `<button type="button" class="btn btn-primary btn-sm" data-action="firestore-sign-in" ${status.configured ? '' : 'disabled'}><i class="fa fa-user"></i> Entrar</button>`}
      ${status.enabled ? '<button type="button" class="btn btn-primary btn-sm" data-action="firestore-sync-now"><i class="fa fa-sync"></i> Sincronizar</button>' : `<button type="button" class="btn btn-primary btn-sm" data-action="firestore-enable-primary" ${status.signedIn ? '' : 'disabled'}>Ativar primário</button><button type="button" class="btn btn-outline btn-sm" data-action="firestore-enable-shadow" ${status.signedIn ? '' : 'disabled'}>Shadow</button>`}
      <button type="button" class="btn btn-outline btn-sm" data-action="firestore-verify-entity-shadow" ${status.signedIn ? '' : 'disabled'}><i class="fa fa-list-check"></i> Verificar entidades</button>
      ${renderEntitySyncToggle()}
      <button type="button" class="btn btn-outline btn-sm" data-action="firestore-merge-remote" ${status.signedIn ? '' : 'disabled'}><i class="fa fa-code-merge"></i> Mesclar</button>
      <button type="button" class="btn btn-ghost btn-sm" data-action="firestore-pull-remote" ${status.signedIn ? '' : 'disabled'}><i class="fa fa-cloud-download-alt"></i> Baixar</button>
      <button type="button" class="btn btn-danger btn-sm" data-action="firestore-force-push" ${status.signedIn ? '' : 'disabled'}><i class="fa fa-cloud-upload-alt"></i> Enviar local</button>
      ${status.enabled ? '<button type="button" class="btn btn-ghost btn-sm" data-action="firestore-disable-sync">Pausar</button>' : ''}
    `;
  }

  if (source.id === 'cloudflare') {
    return `
      <button type="button" class="btn btn-primary btn-sm" data-action="force-cloudflare-sync" ${source.configured && source.enabled ? '' : 'disabled'}><i class="fa fa-sync"></i> Sincronizar</button>
      <button type="button" class="btn btn-outline btn-sm" data-action="cloud-merge-remote" ${source.configured && source.enabled ? '' : 'disabled'}><i class="fa fa-code-merge"></i> Mesclar</button>
      <button type="button" class="btn btn-ghost btn-sm" data-action="cloud-conflict-pull-remote" ${source.configured && source.enabled ? '' : 'disabled'}><i class="fa fa-cloud-download-alt"></i> Baixar</button>
      <button type="button" class="btn btn-danger btn-sm" data-action="cloud-conflict-force-push" ${source.configured && source.enabled ? '' : 'disabled'}><i class="fa fa-cloud-upload-alt"></i> Enviar local</button>
    `;
  }

  if (source.id === 'drive') {
    return source.configured
      ? `
      <button type="button" class="btn btn-primary btn-sm" data-action="drive-sync-now"><i class="fa fa-sync"></i> Sincronizar</button>
      <button type="button" class="btn btn-outline btn-sm" data-action="merge-from-drive"><i class="fa fa-code-merge"></i> Mesclar</button>
      <button type="button" class="btn btn-ghost btn-sm" data-action="pull-from-drive"><i class="fa fa-cloud-download-alt"></i> Baixar</button>
      <button type="button" class="btn btn-danger btn-sm" data-action="drive-disconnect">Desconectar</button>
    `
      : `
      <button type="button" class="btn btn-primary btn-sm" data-action="open-drive-modal"><i class="fa fa-cloud"></i> Conectar</button>
    `;
  }

  return '';
}

function renderSyncSourceConflictEntities(conflict) {
  const items = Array.isArray(conflict?.items) ? conflict.items : [];
  if (items.length === 0) return '';
  const entityKey = (item) => item.key || `${item.collection}/${item.id}`;
  return `
    <div class="sync-conflict-entities sync-conflict-entities--compact" data-testid="sync-source-conflict-entities">
      <div class="sync-conflict-entities-title">Entidades afetadas (${conflict.total || items.length})</div>
      ${items
        .slice(0, 6)
        .map(
          (item) => `
        <div class="sync-conflict-entity">
          <span>${esc(item.collection || 'entidade')}</span>
          <code>${esc(item.id || item.key || 'sem-id')}</code>
           <span>Local rev. ${esc(item.localRevision ?? '-')}</span>
           <span>Remoto rev. ${esc(item.remoteRevision ?? '-')}</span>
           <span>${formatBackupDateTime(item.localUpdatedAt || item.remoteUpdatedAt)}</span>
           <div class="sync-conflict-entity-actions">
             <button type="button" class="btn btn-ghost btn-sm" data-action="entity-conflict-keep-local" data-entity-key="${esc(entityKey(item))}">
               Manter local
             </button>
             <button type="button" class="btn btn-outline btn-sm" data-action="entity-conflict-keep-remote" data-entity-key="${esc(entityKey(item))}">
               Usar remoto
             </button>
           </div>
         </div>
       `
        )
        .join('')}
      <button type="button" class="btn btn-outline btn-sm" data-action="firestore-open-conflict-review" style="margin-top:8px;">
        <i class="fa fa-magnifying-glass"></i> Revisar entidades
      </button>
    </div>
  `;
}

function renderSyncCenterCard() {
  const model = buildSyncCenterModel({
    state,
    getFirestoreStatus: () => getFirestoreSyncStatus() || {},
    getCloudflareCreds: () => ({
      url: state.config?.cfUrl || '',
      enabled: state.config?.cfSyncEnabled || false,
      hasToken: !!(state.config?.cfToken || state.config?.cfTokenSaved),
    }),
    getDriveStatus: () => ({ configured: !!state.driveFileId }),
  });

  const health = model.health || { status: 'idle' };
  const statusLabel = getSyncHealthLabel(health.status);
  const statusIcon = getSyncHealthIcon(health.status);
  const metrics = health.metrics || {};

  return `
    <div class="card config-card">
      <div class="card-header"><h3><i class="fa fa-arrows-rotate"></i> Central de Sincronização</h3></div>
      <div class="card-body">
        <div class="config-desc">Gerencie todas as fontes de backup e sincronização em um só lugar.</div>

        <div class="sync-health-badge sync-health-badge--${health.status}">
          <i class="fa ${statusIcon}"></i>
          <span>${statusLabel}</span>
        </div>
        <div class="sync-source-meta">
          <span>Fila: ${esc(metrics.pendingAgeLabel || '0 min')}</span>
          <span>Retries: ${esc(metrics.retryAttempts ?? 0)}</span>
          ${metrics.nextRetryAt ? `<span>Proxima tentativa: ${formatBackupDateTime(metrics.nextRetryAt)}</span>` : ''}
          ${metrics.remoteAckAt ? `<span>Ack remoto: ${formatBackupDateTime(metrics.remoteAckAt)}</span>` : ''}
        </div>

        <div class="sync-sources-list">
          ${model.sources
            .map(
              (source) => `
            <div class="sync-source-card" data-sync-source="${source.id}">
              <div class="sync-source-header">
                <div class="sync-source-icon"><i class="fa ${source.icon || 'fa-database'}"></i></div>
                <div class="sync-source-info">
                  <div class="sync-source-name">${source.title}</div>
                  <div class="sync-source-sub">${source.detail || ''}</div>
                </div>
                <span class="badge ${source.enabled ? 'badge-success' : 'badge-muted'}">${source.enabled ? 'Ativo' : 'Inativo'}</span>
              </div>
              <div class="sync-source-meta">
                <span>Último sync: ${formatBackupDateTime(source.lastSyncAt)}</span>
                ${source.remoteAt ? `<span>Remoto: ${formatBackupDateTime(source.remoteAt)}</span>` : ''}
                ${source.metrics?.retryAttempts ? `<span>Retries: ${esc(source.metrics.retryAttempts)}</span>` : ''}
                ${source.entityShadowDiff ? `<span>Shadow diff: ${source.entityShadowDiff.ok ? 'OK' : 'Divergente'}</span>` : ''}
              </div>
              ${source.conflict ? renderSyncSourceConflictEntities(source.conflict) : ''}
              <div class="sync-source-actions">
                ${renderSyncSourceActions(source)}
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
}

export function renderConfig(el) {
  const cfg = state.config;
  const saveStatus = getLastSaveStatus();
  const saveStatusText =
    saveStatus.status === 'error'
      ? `Falha ao salvar: ${esc(saveStatus.detail || 'erro desconhecido')}`
      : saveStatus.status === 'saving'
        ? 'Salvando alterações no dispositivo...'
        : 'Último salvamento local concluído. Credenciais não entram em backup/exportação.';
  const activeTheme = normalizeTheme(cfg.tema, cfg.darkMode);
  const themeOptionsHtml = THEME_OPTIONS.map(
    (theme) =>
      `<option value="${theme.value}" ${activeTheme === theme.value ? 'selected' : ''}>${theme.label}</option>`
  ).join('');
  el.innerHTML = `
    <div class="config-grid">
      <div>
        <div class="card config-card">
          <div class="card-header"><h3>🎨 Aparência</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Tema Visual</div>
                <div class="config-sub">Personalize a aparência do seu sistema</div>
              </div>
              <select class="form-control config-select" data-action="set-theme">
                ${themeOptionsHtml}
              </select>
            </div>
          </div>
        </div>
        <div class="card config-card">
          <div class="card-header"><h3>⚖️ Calendário</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Visualização padrão</div>
                <div class="config-sub">Modo inicial do calendário</div>
              </div>
              <select class="form-control config-select--narrow" data-action="update-config" data-config-key="visualizacao">
                <option value="mes" ${cfg.visualizacao === 'mes' ? 'selected' : ''}>Mês</option>
                <option value="semana" ${cfg.visualizacao === 'semana' ? 'selected' : ''}>Semana</option>
              </select>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Primeiro dia da semana</div>
              </div>
              <select class="form-control config-select--medium" data-action="update-config" data-config-key="primeirodiaSemana" data-value-type="number">
                <option value="0" ${cfg.primeirodiaSemana === 0 ? 'selected' : ''}>Domingo</option>
                <option value="1" ${cfg.primeirodiaSemana === 1 ? 'selected' : ''}>Segunda-feira</option>
              </select>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Número da semana</div>
              </div>
              <button type="button" class="toggle ${cfg.mostrarNumeroSemana ? 'on' : ''}" aria-pressed="${cfg.mostrarNumeroSemana ? 'true' : 'false'}" aria-label="Mostrar número da semana" data-action="toggle-config" data-config-key="mostrarNumeroSemana"></button>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Agrupar eventos no dia</div>
                <div class="config-sub">Limita quantidade visível</div>
              </div>
              <button type="button" class="toggle ${cfg.agruparEventos ? 'on' : ''}" aria-pressed="${cfg.agruparEventos ? 'true' : 'false'}" aria-label="Agrupar eventos no dia" data-action="toggle-config" data-config-key="agruparEventos"></button>
            </div>
          </div>
        </div>

        <div class="card config-card">
          <div class="card-header"><h3>⏱️ Temporizador</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Foco do Pomodoro (min)</div>
                <div class="config-sub">Tempo ininterrupto de estudo</div>
              </div>
              <input type="number" class="form-control config-input-number" min="1" max="120" value="${cfg.pomodoroFoco || 25}" data-action="update-config" data-config-key="pomodoroFoco" data-value-type="number">
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Pausa do Pomodoro (min)</div>
                <div class="config-sub">Intervalo de descanso</div>
              </div>
              <input type="number" class="form-control config-input-number" min="1" max="60" value="${cfg.pomodoroPausa || 5}" data-action="update-config" data-config-key="pomodoroPausa" data-value-type="number">
            </div>
          </div>
        </div>

        <div class="card config-card">
          <div class="card-header"><h3>📚 Planejamento Diário</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Matérias por dia no Ciclo</div>
                <div class="config-sub">Quantidade de disciplinas distribuídas diariamente no calendário/MED.</div>
              </div>
              <input type="number" class="form-control config-input-number" min="1" max="15" value="${cfg.materiasPorDia || 3}" data-action="update-config" data-config-key="materiasPorDia" data-value-type="number">
            </div>
          </div>
        </div>

        <div class="card config-card">
          <div class="card-header"><h3>🔄 Frequência de Revisão</h3></div>
          <div class="card-body">
            <div class="config-desc">
              Defina em quantos dias após concluir um assunto o programa vai sugerir cada revisão.
            </div>
            <div class="form-group">
              <label class="form-label">Intervalos (em dias, separados por vírgula)</label>
              <input type="text" class="form-control" id="freq-input" value="${(cfg.frequenciaRevisao || [1, 7, 30, 90]).join(', ')}"
                data-action="update-frequencia">
            </div>
            <div class="config-hint">Ex: 1, 7, 30, 90 = 4 revisões no 1º, 7º, 30º e 90º dia</div>
          </div>
        </div>
      </div>

      <div>
        ${renderSyncCenterCard()}

        <div class="card config-card">
          <div class="card-header"><h3><i class="fa fa-cloud"></i> Sincronização Cloudflare (Secundária)</h3></div>
          <div class="card-body">
            <div class="config-desc">Sincronização em tempo real de baixíssima latência entre dispositivos via Cloudflare KV.</div>

            ${renderCloudflareConflict(cfg.cfConflict)}

            <div class="form-group config-input-group">
              <label class="form-label">URL do Cloudflare Worker (API)</label>
              <input type="url" id="config-cf-url" class="form-control" placeholder="Ex: https://estudo-sync-api.xxxx.workers.dev" value="${esc(cfg.cfUrl || '')}" data-action="update-config" data-config-key="cfUrl" data-value-transform="trim-url">
            </div>

            <div class="form-group config-input-group">
              <label class="form-label">Token de Acesso (Auth Token)</label>
              <div class="config-input-group">
                  <input type="password" id="config-cf-token" class="form-control" placeholder="${cfg.cfTokenSaved ? 'Token salvo em credenciais locais' : 'Sua senha secreta do Worker'}" value="" data-action="update-config" data-config-key="cfToken" data-value-transform="trim">
                  <button type="button" class="btn btn-outline" data-action="toggle-password-visibility" data-target-id="config-cf-token" title="Mostrar/Esconder Senha"><i class="fa fa-eye"></i></button>
              </div>
            </div>
            
            <div class="config-toggle-row">
                <label class="btn ${cfg.cfSyncEnabled ? 'btn-primary' : 'btn-outline'}">
                    <input type="checkbox" id="config-cf-enabled" data-action="toggle-cf-sync" ${cfg.cfSyncEnabled ? 'checked' : ''}>
                    <i class="fa fa-power-off"></i> <span id="cf-sync-toggle-text">${cfg.cfSyncEnabled ? 'Sincronização Ativada' : 'Ativar Sincronização'}</span>
                </label>
                <button type="button" class="btn btn-outline" data-action="force-cloudflare-sync" id="btn-force-cf-sync"><i class="fa fa-sync"></i> Forçar Sincronização Agora</button>
            </div>
            <p id="cf-sync-status" class="config-status"></p>
          </div>
        </div>

        <div class="card config-card">
          <div class="card-header"><h3>😁️ Google Drive</h3></div>
          <div class="card-body">
            <div class="flex cluster-md mb-4">
              <div class="config-emoji-icon">😁️</div>
              <div>
                <div class="config-title">${state.driveFileId ? 'Conectado ao Google Drive' : 'Não conectado'}</div>
                <div class="config-subtitle">${state.driveFileId ? 'Seus dados são sincronizados automaticamente' : 'Sincronize seus dados entre dispositivos'}</div>
              </div>
            </div>
            ${
              state.driveFileId
                ? `
              <div class="config-actions-row">
                <button class="btn btn-primary btn-sm" data-action="drive-sync-now">
                  <i class="fa fa-cloud-upload-alt"></i> Sincronizar agora
                </button>
                <button class="btn btn-ghost btn-sm" data-action="pull-from-drive">
                  <i class="fa fa-cloud-download-alt"></i> Carregar do Drive
                </button>
                <button class="btn btn-danger btn-sm" data-action="drive-disconnect">Desconectar</button>
              </div>
            `
                : `
              <button class="btn btn-primary" data-action="open-drive-modal">
                <i class="fa fa-cloud"></i> Conectar ao Google Drive
              </button>
            `
            }
          </div>
        </div>

        <div class="card config-card">
          <div class="card-header"><h3>🔖 Notificações</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Notificações do browser</div>
                <div class="config-sub">${'Notification' in window ? (Notification.permission === 'granted' ? '✅ Ativadas' : Notification.permission === 'denied' ? '🚫 Bloqueadas (altere nas config do browser)' : 'Permite receber lembretes de eventos e revisões') : '❌ Browser não suporta'}</div>
              </div>
              ${
                'Notification' in window &&
                Notification.permission !== 'denied' &&
                Notification.permission !== 'granted'
                  ? `
                <button class="btn btn-primary btn-sm" data-action="request-notification-permission">🔖 Ativar</button>
              `
                  : Notification.permission === 'granted'
                    ? `
                <button class="btn btn-ghost btn-sm" data-action="test-notification">🔖 Testar</button>
              `
                    : ''
              }
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Modo Silencioso (Início)</div>
                <div class="config-sub">A partir de qual horário silenciar:</div>
              </div>
              <input type="number" class="form-control config-input-number" min="0" max="23" value="${cfg.silentModeStart ?? 22}" data-action="update-config" data-config-key="silentModeStart" data-value-type="number">
            </div>
            
            <div class="config-row">
              <div>
                <div class="config-label">Modo Silencioso (Fim)</div>
                <div class="config-sub">Até qual horário silenciar:</div>
              </div>
              <input type="number" class="form-control config-input-number" min="0" max="23" value="${cfg.silentModeEnd ?? 8}" data-action="update-config" data-config-key="silentModeEnd" data-value-type="number">
            </div>
          </div>
        </div>

        <div class="card config-card">
          <div class="card-header"><h3>💾 Dados</h3></div>
          <div class="card-body">
            <div class="config-sub">
              ${state.eventos.length} evento(s) ativos
              ${(state.arquivo || []).length > 0 ? ` • ${state.arquivo.length} arquivado(s)` : ''}
            </div>

            <div id="config-save-status-detail" class="config-save-status config-save-status--${saveStatus.status || 'saved'}">
              ${saveStatusText}
            </div>
            <div class="config-desc">Importacoes JSON passam por validacao e previa de impacto antes de substituir os dados atuais.</div>

            <div class="grid config-backup-grid">
              <div class="flex flex-between"><span>Backup local:</span><strong>${formatBackupDateTime(state.config.localBackupAt)}</strong></div>
              <div class="flex flex-between"><span>Backup Firestore:</span><strong>${formatBackupDateTime(state.config.firestoreSync?.remoteUpdatedAt)}</strong></div>
              <div class="flex flex-between"><span>Backup Cloudflare:</span><strong>${formatBackupDateTime(state.config.cfLastSyncAt)}</strong></div>
              <div class="flex flex-between"><span>Backup Google Drive:</span><strong>${formatBackupDateTime(state.lastSync)}</strong></div>
            </div>

            <div class="form-group mb-3">
              <label class="form-label">Origem do backup para restauração</label>
              <select id="backup-restore-source" class="form-control">
                <option value="local">Backup local (importar arquivo JSON)</option>
                <option value="firestore">Firestore</option>
                <option value="cloudflare">Cloudflare</option>
                <option value="drive">Google Drive</option>
              </select>
            </div>

            <div class="flex flex-wrap gap-sm">
              <button class="btn btn-ghost" data-action="export-data">📱 Exportar JSON</button>
              <button class="btn btn-ghost" data-action="restore-backup">♻️ Restaurar backup selecionado</button>
              <button class="btn btn-ghost btn-sm" data-action="archive-old-events" data-days="90" title="Move eventos concluídos há mais de 90 dias para o arquivo">🙉 Arquivar antigos</button>
              <button class="btn btn-danger btn-sm" data-action="clear-all-data">🙆 Limpar tudo</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>🔄 Service Worker</h3></div>
          <div class="card-body">
            <div class="config-desc" style="margin-bottom:12px;">
              Limpe o cache do service worker e force o carregamento da versão mais recente. Útil quando há problemas de cache após atualizações.
            </div>
            <button class="btn btn-primary btn-sm" data-action="force-sw-cache-clear">
              🔄 Limpar cache e recarregar
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>ℹ️ Sobre</h3></div>
          <div class="card-body">
            <div class="config-desc">
              <strong>Estudo Organizado</strong> é um app para planejamento e organização de estudos para concursos públicos.<br><br>
              Baseado no Ciclo PDCA: planeje no Calendário, execute no Study Organizer, meça no Dashboard e corrija com as Revisões.<br><br>
              <span class="text-xs text-muted">Versão 1.0 • Dados salvos localmente + Google Drive</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function setTheme(themeName) {
  const theme = normalizeTheme(themeName, state.config.darkMode);
  state.config.tema = theme;
  state.config.darkMode = true;
  state.config.lastTheme = theme;
  applyTheme();
  scheduleSave();
  renderCurrentView();
}

export function updateConfig(key, value) {
  if (key === 'cfToken') {
    delete state.config.cfToken;
    state.config.cfTokenSaved = Boolean(value) || Boolean(state.config.cfTokenSaved);
    if (value) {
      setSyncCreds({
        url: state.config.cfUrl || '',
        token: value,
        enabled: state.config.cfSyncEnabled,
      }).catch((err) => console.error('Erro ao salvar credencial Cloudflare:', err));
    }
    scheduleSave();
    return;
  }

  state.config[key] = value;
  if (key === 'cfUrl') {
    const token = document.getElementById('config-cf-token')?.value?.trim();
    if (token || state.config.cfTokenSaved) {
      setSyncCreds({
        url: value,
        token: token || undefined,
        enabled: state.config.cfSyncEnabled,
      }).catch((err) => console.error('Erro ao salvar credencial Cloudflare:', err));
    }
    scheduleSave();
    return;
  }
  if (key === 'materiasPorDia') {
    syncCicloToEventos();
  }
  scheduleSave();
  renderCurrentView();
}

export function toggleConfig(key, el) {
  state.config[key] = !state.config[key];
  el.classList.toggle('on', state.config[key]);
  scheduleSave();
}

export async function toggleCfSync(enabled) {
  if (enabled) {
    const url = document.getElementById('config-cf-url').value.trim();
    const token = document.getElementById('config-cf-token').value.trim();
    if (!url || (!token && !state.config.cfTokenSaved)) {
      showToast('Preencha a URL do Worker e o Token antes de ativar.', 'error');
      const checkbox = document.getElementById('config-cf-enabled');
      if (checkbox) checkbox.checked = false;
      return;
    }
    if (token || state.config.cfTokenSaved) {
      await setSyncCreds({ url, token: token || undefined, enabled: true });
    }
  }

  state.config.cfSyncEnabled = enabled;

  if (enabled) {
    showToast('Conectando à nuvem para sincronizar...', 'info');
    forceCloudflareSync().finally(() => {
      scheduleSave();
      renderCurrentView();
    });
  } else {
    scheduleSave();
    renderCurrentView();
  }
}

export function updateFrequencia(value) {
  const nums = value
    .split(',')
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n) && n > 0);
  if (nums.length > 0) {
    state.config.frequenciaRevisao = nums;
    scheduleSave();
  }
}

export function openDriveModal() {
  openModal('modal-drive');
  const savedId = localStorage.getItem('estudo_drive_client_id');
  if (savedId) {
    const input = document.getElementById('drive-client-id');
    if (input) input.value = savedId;
  }
}

export function driveDisconnect() {
  disconnectDrive();
}

export function archiveOldEvents(days = 90) {
  const cutoffStr = cutoffDateStr(days);
  const toArchive = state.eventos.filter(
    (e) => e.status === 'estudei' && e.data && e.data < cutoffStr
  );
  if (toArchive.length === 0) {
    showToast('Nenhum evento para arquivar.', 'info');
    return;
  }
  showConfirm(
    `Arquivar ${toArchive.length} evento(s) concluído(s) com mais de ${days} dias?\n\nEles continuarão no export/backup, mas não aparecerão nos relatórios.`,
    () => {
      state.arquivo = [...(state.arquivo || []), ...toArchive];
      const archiveIds = new Set(toArchive.map((e) => e.id));
      state.eventos = state.eventos.filter((e) => !archiveIds.has(e.id));
      scheduleSave();
      renderCurrentView();
      showToast(`${toArchive.length} evento(s) arquivados.`, 'success');
    },
    { label: 'Arquivar', title: `Arquivar eventos (>${days} dias)` }
  );
}

export function exportData() {
  const blob = new Blob([JSON.stringify(createExportableState(), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `estudo-organizado-backup-${todayStr()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  showToast('Dados exportados!', 'success');
}

export function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.className = 'sr-only';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      input.remove();
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (typeof imported !== 'object' || imported === null || Array.isArray(imported)) {
          showToast('Arquivo inválido! O JSON não contém um objeto de dados válido.', 'error');
          return;
        }
        const hasValidStructure =
          (Array.isArray(imported.editais) || imported.editais === undefined) &&
          (Array.isArray(imported.eventos) || imported.eventos === undefined) &&
          (typeof imported.config === 'object' || imported.config === undefined);
        const validation = validateBackupPayload(imported);
        if (!hasValidStructure || !validation.ok) {
          showToast(
            'Arquivo inválido! Este JSON não parece ser um backup do Estudo Organizado.',
            'error'
          );
          return;
        }
        const impact = previewRestoreImpact(state, imported);
        showConfirm(
          `Importar dados de "${file.name}"?\n\nIsso substituirá todos os dados atuais. Faça um export antes para garantir o backup.`,
          () => {
            setState(imported);
            runMigrations();
            invalidateDiscCache();
            invalidateDashCaches();
            invalidateRevCache();
            invalidateTodayCache();
            scheduleSave();
            renderCurrentView();
            showToast('Dados importados com sucesso!', 'success');
          },
          {
            label: 'Importar',
            title: `Importar dados (${impact.totals.added}+/${impact.totals.removed}-)`,
          }
        );
      } catch {
        showToast(
          'Arquivo inválido! Verifique se é um JSON de backup do Estudo Organizado.',
          'error'
        );
      }
    };
    reader.onloadend = () => {
      input.remove();
    };
    reader.readAsText(file);
  };
  document.body.appendChild(input);
  input.click();
}

export function restoreBackupFromSelectedSource() {
  const source = document.getElementById('backup-restore-source')?.value || 'local';

  if (source === 'local') {
    importData();
    return;
  }

  if (source === 'firestore') {
    if (!state.config?.firestoreSync?.enabled) {
      showToast('Ative o Firestore e entre com Google antes de restaurar por ele.', 'error');
      return;
    }
    showConfirm(
      'Restaurar os dados do Firestore? Isso substituirá os dados locais atuais.',
      () => pullFromFirestore(true),
      { label: 'Restaurar Firestore', title: 'Restaurar backup' }
    );
    return;
  }

  if (source === 'cloudflare') {
    if (
      !state.config?.cfSyncEnabled ||
      !state.config?.cfUrl ||
      (!state.config?.cfToken && !state.config?.cfTokenSaved)
    ) {
      showToast('Configure a sincronização Cloudflare antes de restaurar por ela.', 'error');
      return;
    }
    showConfirm(
      'Restaurar os dados da Cloudflare? Isso substituirá os dados locais atuais.',
      () => pullFromCloudflare(true),
      { label: 'Restaurar Cloudflare', title: 'Restaurar backup' }
    );
    return;
  }

  if (source === 'drive') {
    if (!state.driveFileId) {
      showToast('Conecte o Google Drive antes de restaurar por ele.', 'error');
      return;
    }
    showConfirm(
      'Restaurar os dados do Google Drive? Isso substituirá os dados locais atuais.',
      () => pullFromDrive().catch((err) => console.error('Erro ao restaurar do Drive:', err)),
      { label: 'Restaurar Drive', title: 'Restaurar backup' }
    );
  }
}

export function clearAllData() {
  showConfirm(
    '⚠️ Apagar TODOS os dados permanentemente?\n\nEditais, eventos, hábitos e configurações serão removidos.\n\nEsta ação é irreversível.',
    () => {
      showConfirm('Última confirmação: isso não pode ser desfeito.', () => clearData(), {
        danger: true,
        label: 'Apagar tudo definitivamente',
        title: '⚠️ Confirmação final',
      });
    },
    { danger: true, label: 'Continuar com exclusão', title: '⚠️ Apagar todos os dados' }
  );
}
