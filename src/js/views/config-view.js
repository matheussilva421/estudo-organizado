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
} from '../app.js?v=8.36';
import { cutoffDateStr, esc, todayStr, invalidateTodayCache } from '../utils.js?v=8.36';
import {
  scheduleSave,
  state,
  setState,
  runMigrations,
  createExportableState,
  clearData,
} from '../store.js?v=8.36';
import {
  syncCicloToEventos,
  invalidateDiscCache,
  invalidateDashCaches,
  invalidateRevCache,
} from '../logic.js?v=8.36';
import { renderCurrentView } from '../components.js?v=8.36';
import { buildSyncCenterModel } from '../sync/sync-center.js?v=8.36';
import {
  getFirestoreSyncStatus,
  previewFirestoreRestore,
  pullFromFirestore,
} from '../sync/firestore-sync-engine.js?v=8.36';
import {
  forceCloudflareSync,
  previewCloudflareRestore,
  pullFromCloudflare,
} from '../cloud-sync.js?v=8.36';
import { disconnectDrive, previewDriveRestore, pullFromDrive } from '../drive-sync.js?v=8.36';
import { previewRestoreImpact, validateBackupPayload } from '../backup-restore.js?v=8.36';

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

function formatRestoreCount(value, singular, plural) {
  const count = Number(value) || 0;
  return `${count} ${count === 1 ? singular : plural}`;
}

function renderRestoreImpactSummary(impact) {
  const totals = impact?.totals || {};
  const byCollection = impact?.byCollection || {};
  const rows = Object.entries(byCollection)
    .map(
      ([collection, stats]) => `
        <div class="restore-preview-row">
          <span>${esc(collection)}</span>
          <strong>${formatRestoreCount(stats.added, 'adicionado', 'adicionados')}</strong>
          <strong>${formatRestoreCount(stats.changed, 'alterado', 'alterados')}</strong>
          <strong>${formatRestoreCount(stats.removed, 'removido', 'removidos')}</strong>
        </div>
      `
    )
    .join('');

  return `
    <div class="restore-preview-summary" data-testid="restore-preview-summary">
      <div class="restore-preview-totals">
        <span>${formatRestoreCount(totals.added, 'adicionado', 'adicionados')}</span>
        <span>${formatRestoreCount(totals.changed, 'alterado', 'alterados')}</span>
        <span>${formatRestoreCount(totals.removed, 'removido', 'removidos')}</span>
        <span>${formatRestoreCount(totals.preserved, 'preservado', 'preservados')}</span>
      </div>
      ${rows ? `<div class="restore-preview-table">${rows}</div>` : ''}
    </div>
  `;
}

function renderBackupCenterCard() {
  const fs = state.config?.firestoreSync || {};
  const sources = [
    {
      id: 'local',
      title: 'Backup local',
      status: 'Pronto para exportar',
      at: state.config?.localBackupAt,
      detail: 'JSON validado com dry-run antes de substituir dados.',
    },
    {
      id: 'firestore',
      title: 'Firestore primary',
      status: fs.enabled ? 'Canal remoto ativo' : 'Aguardando login/ativação',
      at: fs.remoteUpdatedAt || fs.lastPushAt || fs.lastPullAt,
      detail: 'Fonte remota principal; snapshot permanece fallback.',
    },
    {
      id: 'cloudflare',
      title: 'Cloudflare secundário',
      status: state.config?.cfSyncEnabled ? 'Backup manual configurado' : 'Não configurado',
      at: state.config?.cfLastSyncAt,
      detail: 'Canal manual/secundário fora do sync primary.',
    },
    {
      id: 'drive',
      title: 'Google Drive',
      status: state.driveFileId ? 'Backup manual conectado' : 'Não conectado',
      at: state.lastSync,
      detail: 'Importação e exportação manual para recuperação.',
    },
  ];

  return `
    <div class="card config-card" data-testid="backup-center">
      <div class="card-header"><h3><i class="fa fa-shield-heart"></i> Backup Center</h3></div>
      <div class="card-body">
        <div class="config-desc">Exporte seus dados como JSON para backup seguro. A importação valida o arquivo e mostra prévia de impacto antes de substituir.</div>

        <div class="backup-center-primary-actions">
          <button class="btn btn-primary" data-action="export-data"><i class="fa fa-download"></i> Exportar JSON</button>
          <button class="btn btn-outline" data-action="import-data"><i class="fa fa-file-import"></i> Importar JSON</button>
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
        <div class="config-actions-row">
          <button class="btn btn-ghost" data-action="open-restore-preview"><i class="fa fa-rotate-left"></i> Restaurar com prévia</button>
          <button class="btn btn-ghost btn-sm" data-action="export-data">Exportar antes de restaurar</button>
        </div>

        <div class="backup-center-sources">
          ${sources
            .map(
              (source) => `
            <div class="backup-source-card" data-backup-source="${source.id}">
              <div class="backup-source-title">${source.title}</div>
              <div class="backup-source-status">${source.status}</div>
              <div class="backup-source-date">${formatBackupDateTime(source.at)}</div>
              <div class="backup-source-detail">${source.detail}</div>
            </div>
          `
            )
            .join('')}
        </div>

      </div>
    </div>
  `;
}

function renderFirestoreConflict(conflict) {
  if (!conflict) return '';

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

function getSyncHealthLabel(health) {
  const labels = {
    ok: 'OK',
    idle: 'Inativo',
    pending: 'Pendente',
    conflict: 'Conflito',
    error: 'Erro',
    offline: 'Offline',
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
    offline: 'fa-wifi',
  };
  return icons[health] || 'fa-circle-info';
}

function renderCloudflareConflict(source) {
  if (!source?.conflict) return '';
  return `
    <div class="sync-conflict-panel" data-testid="cf-sync-conflict" role="alert">
      <div class="sync-conflict-header">
        <i class="fa fa-triangle-exclamation"></i>
        <div>
          <div class="sync-conflict-title">Conflito Cloudflare</div>
          <div class="sync-conflict-sub">O backup remoto mudou antes do envio local.</div>
        </div>
      </div>
      <div class="sync-conflict-meta">
        <span>Remoto: ${formatBackupDateTime(source.conflict.remoteUpdatedAt)}</span>
        <span>Detectado: ${formatBackupDateTime(source.conflict.detectedAt)}</span>
      </div>
      <div class="sync-conflict-actions">
        <button type="button" class="btn btn-outline btn-sm" data-action="cloud-conflict-export-local">
          <i class="fa fa-download"></i> Exportar backup local
        </button>
        <button type="button" class="btn btn-primary btn-sm" data-action="cloud-conflict-pull-remote">
          <i class="fa fa-cloud-download-alt"></i> Baixar remoto
        </button>
        <button type="button" class="btn btn-danger btn-sm" data-action="cloud-conflict-force-push">
          <i class="fa fa-cloud-upload-alt"></i> Enviar local
        </button>
      </div>
    </div>
  `;
}

function renderEntityConflictPanel(source) {
  const conflict = source?.conflict;
  const items = Array.isArray(conflict?.items) ? conflict.items : [];
  if (conflict?.type !== 'entity-conflict' || items.length === 0) return '';

  return `
    <div class="sync-conflict-panel" data-testid="sync-source-conflict-entities" role="alert">
      <div class="sync-conflict-header">
        <i class="fa fa-code-branch"></i>
        <div>
          <div class="sync-conflict-title">Entidades afetadas</div>
          <div class="sync-conflict-sub">${esc(items.length)} item(ns) precisam de decisão.</div>
        </div>
      </div>
      <div class="entity-conflict-review-list">
        ${items
          .slice(0, 4)
          .map(
            (item) => `
          <div class="entity-conflict-review-row">
            <div class="entity-conflict-review-info">
              <strong>${esc(item.collection || 'item')}</strong>
              <code>${esc(item.id || item.key || '')}</code>
              <span class="entity-conflict-review-hint">${esc(item.hint || 'revisar')}</span>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
      <div class="sync-conflict-actions">
        <button type="button" class="btn btn-outline btn-sm" data-action="firestore-open-conflict-review">
          Revisar conflito
        </button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="entity-conflict-keep-local">
          Manter este dispositivo
        </button>
        <button type="button" class="btn btn-primary btn-sm" data-action="entity-conflict-keep-remote">
          Usar nuvem
        </button>
      </div>
    </div>
  `;
}

function renderSyncSourceExtras(source) {
  return `${renderCloudflareConflict(source)}${renderEntityConflictPanel(source)}`;
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
    const needsForceSync = status.hasPendingWrites || status.conflict || status.lastError;
    return `
      ${status.signedIn ? '<button type="button" class="btn btn-ghost btn-sm" data-action="firestore-sign-out"><i class="fa fa-right-from-bracket"></i> Sair</button>' : `<button type="button" class="btn btn-primary btn-sm" data-action="firestore-sign-in" ${status.configured ? '' : 'disabled'}><i class="fa fa-user"></i> Entrar</button>`}
      ${status.enabled ? '<button type="button" class="btn btn-primary btn-sm" data-action="firestore-sync-now"><i class="fa fa-sync"></i> Sincronizar</button>' : `<button type="button" class="btn btn-primary btn-sm" data-action="firestore-enable-primary" ${status.signedIn ? '' : 'disabled'}>Ativar primário</button><button type="button" class="btn btn-outline btn-sm" data-action="firestore-enable-shadow" ${status.signedIn ? '' : 'disabled'}>Shadow</button>`}
      ${needsForceSync ? '<button type="button" class="btn btn-outline btn-sm" data-action="firestore-force-sync"><i class="fa fa-bolt"></i> Forçar sincronização</button>' : ''}
      <button type="button" class="btn btn-outline btn-sm" data-action="firestore-merge-remote" ${status.signedIn ? '' : 'disabled'}><i class="fa fa-code-merge"></i> Mesclar</button>
      <button type="button" class="btn btn-ghost btn-sm" data-action="firestore-pull-remote" ${status.signedIn ? '' : 'disabled'}><i class="fa fa-cloud-download-alt"></i> Baixar</button>
      <button type="button" class="btn btn-danger btn-sm" data-action="firestore-force-push" ${status.signedIn ? '' : 'disabled'}><i class="fa fa-cloud-upload-alt"></i> Enviar local</button>
      <button type="button" class="btn btn-ghost btn-sm" data-action="firestore-download-log"><i class="fa fa-file-lines"></i> Baixar log</button>
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

function renderCloudflareConfigFields(source) {
  const cfg = state.config || {};
  const hasToken = !!cfg.cfToken;
  return `
    <div class="sync-source-config" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-color,#2a2a3e);">
      <div class="form-group config-input-group" style="margin-bottom:8px;">
        <label class="form-label" style="font-size:0.85em;">URL do Cloudflare Worker (API)</label>
        <input type="url" id="config-cf-url" class="form-control form-control-sm" placeholder="https://seu-worker.workers.dev" value="${esc(cfg.cfUrl || '')}" data-action="update-config" data-config-key="cfUrl" data-value-transform="trim-url">
      </div>
      <div class="form-group config-input-group" style="margin-bottom:8px;">
        <label class="form-label" style="font-size:0.85em;">Token de Acesso (Auth Token)</label>
        <div style="display:flex;gap:8px;">
          <input type="password" id="config-cf-token" class="form-control form-control-sm" placeholder="${hasToken ? 'Token salvo' : 'Sua senha secreta do Worker'}" value="${esc(cfg.cfToken || '')}" data-action="update-config" data-config-key="cfToken" data-value-transform="trim">
          <button type="button" class="btn btn-ghost btn-sm" data-action="toggle-password-visibility" data-target-id="config-cf-token" title="Mostrar/ocultar token"><i class="fa fa-eye"></i></button>
        </div>
      </div>
      <div class="form-group config-toggle-row" style="margin-bottom:0;">
        <label style="display:flex;align-items:center;gap:8px;font-size:0.85em;cursor:pointer;">
          <input type="checkbox" id="config-cf-enabled" ${cfg.cfSyncEnabled ? 'checked' : ''} data-action="toggle-cf-sync">
          Ativar Sincronização
        </label>
      </div>
    </div>
  `;
}

function buildCurrentSyncCenterModel() {
  return buildSyncCenterModel({
    state,
    getFirestoreStatus: () => getFirestoreSyncStatus() || {},
    getCloudflareCreds: () => ({
      url: state.config?.cfUrl || '',
      enabled: state.config?.cfSyncEnabled || false,
      hasToken: !!state.config?.cfToken,
    }),
    getDriveStatus: () => ({ configured: !!state.driveFileId }),
  });
}

function _renderSyncCenterCard() {
  const model = buildSyncCenterModel({
    state,
    getFirestoreStatus: () => getFirestoreSyncStatus() || {},
    getCloudflareCreds: () => ({
      url: state.config?.cfUrl || '',
      enabled: state.config?.cfSyncEnabled || false,
      hasToken: !!state.config?.cfToken,
    }),
    getDriveStatus: () => ({ configured: !!state.driveFileId }),
  });

  const health = model.health || { status: 'idle' };
  const statusLabel = getSyncHealthLabel(health.status);
  const statusIcon = getSyncHealthIcon(health.status);
  const metrics = health.metrics || {};

  return `
    <div class="card config-card" data-testid="sync-center">
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
          ${metrics.nextRetryAt ? `<span>Próxima tentativa: ${formatBackupDateTime(metrics.nextRetryAt)}</span>` : ''}
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
              </div>
              <div class="sync-source-actions">
                ${renderSyncSourceActions(source)}
              </div>
              ${source.id === 'cloudflare' ? '<div id="cf-sync-status" class="config-save-status"></div>' : ''}
              ${renderSyncSourceExtras(source)}
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function renderQuietSyncCenterCard() {
  const model = buildCurrentSyncCenterModel();
  const health = model.health || { status: 'idle' };
  const statusLabel = getSyncHealthLabel(health.status);
  const statusIcon = getSyncHealthIcon(health.status);
  const metrics = health.metrics || {};
  const performanceMetrics = model.performanceMetrics || [];
  const quiet = model.quiet || {
    title: statusLabel,
    detail: 'O app salva localmente e sincroniza quando possível.',
    tone: health.status || 'idle',
    primaryAction: null,
  };
  const quietAction =
    quiet.primaryAction === 'sign-in'
      ? '<button type="button" class="btn btn-primary btn-sm" data-action="firestore-sign-in"><i class="fa fa-user"></i> Entrar com Google</button>'
      : '';
  const advancedOpen = quiet.primaryAction === 'advanced' ? ' open' : '';

  return `
    <div class="card config-card" data-testid="sync-center">
      <div class="card-header"><h3><i class="fa fa-arrows-rotate"></i> Central de Sincronização</h3></div>
      <div class="card-body">
        <div class="config-desc">Edite normalmente. O app salva localmente e sincroniza em segundo plano.</div>

        <div class="sync-quiet-panel sync-quiet-panel--${esc(quiet.tone)}" data-testid="sync-quiet-panel">
          <div class="sync-quiet-main">
            <div class="sync-quiet-icon"><i class="fa ${statusIcon}"></i></div>
            <div>
              <div class="sync-quiet-kicker">Sincronização automática</div>
              <div class="sync-quiet-title">${esc(quiet.title)}</div>
              <div class="sync-quiet-detail">${esc(quiet.detail)}</div>
            </div>
          </div>
          ${
            quietAction
              ? `
          <div class="sync-quiet-actions">
            ${quietAction}
          </div>`
              : ''
          }
        </div>

        <details class="sync-advanced-panel" data-testid="backup-advanced-panel"${advancedOpen}>
          <summary>Opções avançadas de sync</summary>
          <div class="sync-advanced-content" data-testid="sync-advanced-panel">
            <div class="sync-health-badge sync-health-badge--${health.status}">
              <i class="fa ${statusIcon}"></i>
              <span>${statusLabel}</span>
            </div>
            <div class="sync-source-meta">
              <span>Fila: ${esc(metrics.pendingAgeLabel || '0 min')}</span>
              <span>Retries: ${esc(metrics.retryAttempts ?? 0)}</span>
              ${metrics.nextRetryAt ? `<span>Próxima tentativa: ${formatBackupDateTime(metrics.nextRetryAt)}</span>` : ''}
              ${metrics.remoteAckAt ? `<span>Ack remoto: ${formatBackupDateTime(metrics.remoteAckAt)}</span>` : ''}
            </div>
            ${
              performanceMetrics.length
                ? `
            <div class="sync-source-meta" data-testid="sync-performance-metrics">
              ${performanceMetrics
                .slice(-6)
                .map((metric) => `<span>${esc(metric.name)}: ${esc(metric.durationMs)}ms</span>`)
                .join('')}
            </div>`
                : ''
            }

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
                  </div>
                  <div class="sync-source-actions">
                    ${renderSyncSourceActions(source)}
                  </div>
                  ${source.id === 'cloudflare' ? '<div id="cf-sync-status" class="config-save-status"></div>' : ''}
                  ${renderSyncSourceExtras(source)}
                  ${source.id === 'cloudflare' ? renderCloudflareConfigFields(source) : ''}
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        </details>
      </div>
    </div>
  `;
}

function renderPreferenceNotificationsCard(cfg) {
  return `
    <div class="card config-card">
      <div class="card-header"><h3><i class="fa fa-bell"></i> Notifica&ccedil;&otilde;es</h3></div>
      <div class="card-body">
        <div class="config-row">
          <div>
            <div class="config-label">Notifica&ccedil;&otilde;es do browser</div>
            <div class="config-sub">${'Notification' in window ? (Notification.permission === 'granted' ? 'Ativadas' : Notification.permission === 'denied' ? 'Bloqueadas (altere nas config do browser)' : 'Permite receber lembretes de eventos e revis&otilde;es') : 'Browser n&atilde;o suporta'}</div>
          </div>
          ${
            'Notification' in window &&
            Notification.permission !== 'denied' &&
            Notification.permission !== 'granted'
              ? `
            <button class="btn btn-primary btn-sm" data-action="request-notification-permission"><i class="fa fa-bell"></i> Ativar</button>
          `
              : Notification.permission === 'granted'
                ? `
            <button class="btn btn-ghost btn-sm" data-action="test-notification"><i class="fa fa-bell"></i> Testar</button>
          `
                : ''
          }
        </div>
        <div class="config-row">
          <div>
            <div class="config-label">Modo Silencioso (In&iacute;cio)</div>
            <div class="config-sub">A partir de qual hor&aacute;rio silenciar:</div>
          </div>
          <input type="number" class="form-control config-input-number" min="0" max="23" value="${cfg.silentModeStart ?? 22}" data-action="update-config" data-config-key="silentModeStart" data-value-type="number">
        </div>
        <div class="config-row">
          <div>
            <div class="config-label">Modo Silencioso (Fim)</div>
            <div class="config-sub">At&eacute; qual hor&aacute;rio silenciar:</div>
          </div>
          <input type="number" class="form-control config-input-number" min="0" max="23" value="${cfg.silentModeEnd ?? 8}" data-action="update-config" data-config-key="silentModeEnd" data-value-type="number">
        </div>
      </div>
    </div>
  `;
}

function renderPreferenceDataCard(saveStatus, saveStatusText) {
  return `
    <div class="card config-card">
      <div class="card-header"><h3><i class="fa fa-database"></i> Dados</h3></div>
      <div class="card-body">
        <div class="config-sub">
          ${state.eventos.length} evento(s) ativos
          ${(state.arquivo || []).length > 0 ? ` &bull; ${state.arquivo.length} arquivado(s)` : ''}
        </div>

        <div id="config-save-status-detail" class="config-save-status config-save-status--${saveStatus.status || 'saved'}">
          ${saveStatusText}
        </div>
        <div class="config-desc">Importa&ccedil;&otilde;es JSON passam por valida&ccedil;&atilde;o e pr&eacute;via de impacto antes de substituir os dados atuais.</div>

        <div class="grid config-backup-grid">
          <div class="flex flex-between"><span>Backup local:</span><strong>${formatBackupDateTime(state.config.localBackupAt)}</strong></div>
          <div class="flex flex-between"><span>Backup Firestore:</span><strong>${formatBackupDateTime(state.config.firestoreSync?.remoteUpdatedAt)}</strong></div>
          <div class="flex flex-between"><span>Backup Cloudflare:</span><strong>${formatBackupDateTime(state.config.cfLastSyncAt)}</strong></div>
          <div class="flex flex-between"><span>Backup Google Drive:</span><strong>${formatBackupDateTime(state.lastSync)}</strong></div>
        </div>

        <div class="form-group mb-3">
          <label class="form-label">Origem do backup para restaura&ccedil;&atilde;o</label>
          <select id="backup-restore-source" class="form-control">
            <option value="local">Backup local (importar arquivo JSON)</option>
            <option value="firestore">Firestore</option>
            <option value="cloudflare">Cloudflare</option>
            <option value="drive">Google Drive</option>
          </select>
        </div>

        <div class="flex flex-wrap gap-sm">
          <button class="btn btn-ghost" data-action="export-data"><i class="fa fa-file-export"></i> Exportar JSON</button>
          <button class="btn btn-ghost" data-action="restore-backup"><i class="fa fa-rotate-left"></i> Restaurar backup selecionado</button>
          <button class="btn btn-ghost btn-sm" data-action="archive-old-events" data-days="90" title="Move eventos concluidos ha mais de 90 dias para o arquivo"><i class="fa fa-box-archive"></i> Arquivar antigos</button>
          <button class="btn btn-danger btn-sm" data-action="clear-all-data"><i class="fa fa-trash"></i> Limpar tudo</button>
        </div>
      </div>
    </div>
  `;
}

function renderPreferenceServiceWorkerCard() {
  return `
    <div class="card config-card">
      <div class="card-header"><h3><i class="fa fa-rotate"></i> Service Worker</h3></div>
      <div class="card-body">
        <div class="config-desc" style="margin-bottom:12px;">
          Limpe o cache do service worker e force o carregamento da vers&atilde;o mais recente. &Uacute;til quando h&aacute; problemas de cache ap&oacute;s atualiza&ccedil;&otilde;es.
        </div>
        <button class="btn btn-primary btn-sm" data-action="force-sw-cache-clear">
          <i class="fa fa-rotate"></i> Limpar cache e recarregar
        </button>
      </div>
    </div>
  `;
}

function renderPreferenceAboutCard() {
  return `
    <div class="card config-card">
      <div class="card-header"><h3><i class="fa fa-circle-info"></i> Sobre</h3></div>
      <div class="card-body">
        <div class="config-desc">
          <strong>Estudo Organizado</strong> &eacute; um app para planejamento e organiza&ccedil;&atilde;o de estudos para concursos p&uacute;blicos.<br><br>
          Baseado no Ciclo PDCA: planeje no Calend&aacute;rio, execute no Study Organizer, me&ccedil;a no Dashboard e corrija com as Revis&otilde;es.<br><br>
          <span class="text-xs text-muted">Vers&atilde;o 1.0 &bull; Dados salvos localmente + Google Drive</span>
        </div>
      </div>
    </div>
  `;
}

export function renderConfig(el) {
  const cfg = state.config;
  const saveStatus = getLastSaveStatus() || { status: 'saved' };
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

        ${renderPreferenceNotificationsCard(cfg)}
        ${renderPreferenceDataCard(saveStatus, saveStatusText)}
        ${renderPreferenceServiceWorkerCard()}
        ${renderPreferenceAboutCard()}
      </div>

      <div>
        ${renderQuietSyncCenterCard()}

        ${renderBackupCenterCard()}

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
  state.config[key] = value;
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
    if (!url || !token) {
      showToast('Preencha a URL do Worker e o Token antes de ativar.', 'error');
      const checkbox = document.getElementById('config-cf-enabled');
      if (checkbox) checkbox.checked = false;
      return;
    }
    state.config.cfUrl = url;
    state.config.cfToken = token;
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

export function openRestorePreviewModal(payload = state, options = {}) {
  const modal = document.getElementById('modal-prompt');
  const title = document.getElementById('modal-prompt-title');
  const body = document.getElementById('modal-prompt-body');
  const saveBtn = document.getElementById('modal-prompt-save');
  if (!modal || !title || !body || !saveBtn) {
    showToast('Modal de restauração indisponível.', 'error');
    return false;
  }

  const sourceLabel = options.sourceLabel || 'backup selecionado';
  const impact = previewRestoreImpact(state, payload || {});
  title.textContent = 'Prévia de restauração';
  body.innerHTML = `
    <div class="restore-preview-modal">
      <div class="config-desc">Origem: <strong>${esc(sourceLabel)}</strong>. Revise o impacto antes de substituir os dados locais.</div>
      ${renderRestoreImpactSummary(impact)}
      <div class="restore-preview-warning">
        A restauração pode substituir eventos, editais, hábitos, revisões e configurações locais.
      </div>
      <div class="config-actions-row">
        <button type="button" class="btn btn-ghost btn-sm" data-action="export-data">
          <i class="fa fa-download"></i> Exportar antes de restaurar
        </button>
      </div>
    </div>
  `;
  saveBtn.textContent = options.label || 'Restaurar';
  saveBtn.className = 'btn btn-danger';
  saveBtn.onclick = () => {
    if (typeof options.onConfirm === 'function') {
      options.onConfirm();
    }
  };
  openModal('modal-prompt');
  return true;
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
        openRestorePreviewModal(imported, {
          sourceLabel: file.name,
          label: 'Importar',
          onConfirm: () => {
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
        });
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

function openRemoteRestorePreview(sourceLabel, previewPromise, onConfirm, label) {
  showToast(`Lendo backup ${sourceLabel} para prévia...`, 'info');
  return previewPromise
    .then((payload) => {
      if (!payload || typeof payload !== 'object') {
        showToast(`Nenhum backup valido encontrado em ${sourceLabel}.`, 'error');
        return false;
      }
      return openRestorePreviewModal(payload, {
        sourceLabel,
        label,
        onConfirm,
      });
    })
    .catch((err) => {
      console.error(`Erro ao preparar restore ${sourceLabel}:`, err);
      showToast(`Não foi possível ler o backup ${sourceLabel}.`, 'error');
      return false;
    });
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
    return openRemoteRestorePreview(
      'Firestore',
      previewFirestoreRestore(),
      () => pullFromFirestore(true),
      'Restaurar Firestore'
    );
  }

  if (source === 'cloudflare') {
    if (
      !state.config?.cfSyncEnabled ||
      !state.config?.cfUrl ||
      !state.config?.cfToken
    ) {
      showToast('Configure a sincronização Cloudflare antes de restaurar por ela.', 'error');
      return;
    }
    return openRemoteRestorePreview(
      'Cloudflare',
      previewCloudflareRestore(),
      () => pullFromCloudflare(true),
      'Restaurar Cloudflare'
    );
  }

  if (source === 'drive') {
    if (!state.driveFileId) {
      showToast('Conecte o Google Drive antes de restaurar por ele.', 'error');
      return;
    }
    return openRemoteRestorePreview(
      'Google Drive',
      previewDriveRestore(),
      () => pullFromDrive().catch((err) => console.error('Erro ao restaurar do Drive:', err)),
      'Restaurar Drive'
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
