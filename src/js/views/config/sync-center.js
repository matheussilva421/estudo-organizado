/**
 * Sync Center View
 * Sync-related rendering functions extracted from config-view.js
 */

import { state } from '../../store.js?v=8.37';
import { esc } from '../../utils.js?v=8.37';
import { buildSyncCenterModel } from '../../sync/sync-center.js?v=8.37';
import { getFirestoreSyncStatus } from '../../sync/firestore-sync-engine.js?v=8.37';
import { formatBackupDateTime } from './backup-settings.js?v=8.37';

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
    paused: 'Pausado',
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
    paused: 'fa-pause-circle',
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

function getChannelManualResult(sourceId) {
  const results = state.config?.lastManualSyncResults;
  if (!results) return null;
  // Map UI source id to result key (firebase → firestore in results)
  const key = sourceId === 'firebase' ? 'firestore' : sourceId;
  const status = results[key];
  if (!status) return null;
  return { status, at: results.at };
}

function renderChannelSummaryRow(source) {
  const enabled = source.enabled === true;
  const manual = getChannelManualResult(source.id);
  const hasConflict = !!source.conflict || manual?.status === 'conflict';
  const lastFailed = manual?.status === 'error';

  let dotClass;
  let label;

  if (hasConflict) {
    dotClass = 'sync-summary-dot--conflict';
    label = 'Conflito — abra Avançado';
  } else if (lastFailed) {
    dotClass = 'sync-summary-dot--error';
    label = `falhou em ${formatBackupDateTime(manual.at)}`;
  } else if (manual?.status === 'ok') {
    dotClass = 'sync-summary-dot--ok';
    label = `sincronizado em ${formatBackupDateTime(manual.at)}`;
  } else if (enabled) {
    // Configured but never manually synced in this session — fall back to engine timestamp
    dotClass = 'sync-summary-dot--ok';
    label = source.lastSyncAt
      ? `último sync ${formatBackupDateTime(source.lastSyncAt)}`
      : 'aguardando primeiro sync';
  } else {
    dotClass = 'sync-summary-dot--idle';
    label = 'não configurado';
  }

  return `
    <div class="sync-summary-row" data-summary-source="${source.id}">
      <span class="sync-summary-dot ${dotClass}" aria-hidden="true"></span>
      <span class="sync-summary-name"><i class="fa ${source.icon || 'fa-database'}"></i> ${esc(source.title)}</span>
      <span class="sync-summary-status">${esc(label)}</span>
    </div>
  `;
}

function renderSourceAdvancedBlock(source) {
  const hasConflict = !!source.conflict;
  const manual = getChannelManualResult(source.id);
  const lastFailed = manual?.status === 'error' || manual?.status === 'conflict';
  const open = hasConflict || lastFailed ? ' open' : '';
  const manualLine = manual
    ? `<span>Última manual: ${formatBackupDateTime(manual.at)} — ${esc(manual.status)}</span>`
    : '';
  return `
    <div class="sync-source-card" data-sync-source="${source.id}">
      <div class="sync-source-header">
        <div class="sync-source-icon"><i class="fa ${source.icon || 'fa-database'}"></i></div>
        <div class="sync-source-info">
          <div class="sync-source-name">${esc(source.title)}</div>
          <div class="sync-source-sub">${source.detail || ''}</div>
        </div>
        <span class="badge ${source.enabled ? 'badge-success' : 'badge-muted'}">${source.enabled ? 'Ativo' : 'Inativo'}</span>
      </div>
      <div class="sync-source-meta">
        <span>Último sync: ${formatBackupDateTime(source.lastSyncAt)}</span>
        ${source.remoteAt ? `<span>Remoto: ${formatBackupDateTime(source.remoteAt)}</span>` : ''}
        ${manualLine}
      </div>
      ${source.id === 'cloudflare' ? renderCloudflareConfigFields(source) : ''}
      ${source.id === 'drive' && !source.configured ? '' : ''}
      <details class="sync-source-advanced"${open}>
        <summary>Avançado${hasConflict ? ' — resolver conflito' : ''}</summary>
        <div class="sync-source-actions">
          ${renderSyncSourceActions(source)}
        </div>
        ${source.id === 'cloudflare' ? '<div id="cf-sync-status" class="config-save-status"></div>' : ''}
        ${renderSyncSourceExtras(source)}
      </details>
    </div>
  `;
}

function renderQuietSyncCenterCard() {
  const model = buildCurrentSyncCenterModel();
  const sources = (model.sources || []).filter((source) => source && source.id !== 'local');
  const lastManualSyncAt = state.config?.lastManualSyncAt || null;
  const lastSummaryLine = lastManualSyncAt
    ? `Último envio manual: ${formatBackupDateTime(lastManualSyncAt)}`
    : 'Nenhuma sincronização manual ainda neste dispositivo.';
  const anyConflict = sources.some((source) => !!source.conflict);

  return `
    <div class="card config-card" data-testid="sync-center">
      <div class="card-header"><h3><i class="fa fa-arrows-rotate"></i> Central de Sincronização</h3></div>
      <div class="card-body">
        <div class="config-desc">Edite normalmente — suas alterações ficam salvas neste dispositivo. Use o botão abaixo para enviar para a nuvem quando quiser.</div>

        <div class="sync-manual-primary">
          <button type="button" class="btn btn-primary btn-lg" data-action="manual-sync-all">
            <i class="fa fa-arrows-rotate"></i> Sincronizar agora
          </button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="download-sync-log" title="Baixa um JSON com o estado de todos os canais de sync para diagnóstico">
            <i class="fa fa-file-lines"></i> Baixar log
          </button>
          <div class="sync-manual-primary-meta">${esc(lastSummaryLine)}</div>
        </div>

        ${
          anyConflict
            ? `
        <div class="sync-conflict-callout" role="alert">
          <i class="fa fa-triangle-exclamation"></i>
          <span>Conflito detectado em pelo menos um canal. Expanda o bloco correspondente abaixo e use Mesclar (recomendado), Baixar ou Forçar envio para resolver.</span>
        </div>`
            : ''
        }

        <div class="sync-summary-list">
          ${sources.map(renderChannelSummaryRow).join('')}
        </div>

        <div class="sync-source-advanced-list">
          ${sources.map(renderSourceAdvancedBlock).join('')}
        </div>
      </div>
    </div>
  `;
}

export {
  renderBackupCenterCard,
  renderFirestoreConflict,
  _renderFirestoreCard,
  getSyncHealthLabel,
  getSyncHealthIcon,
  renderCloudflareConflict,
  renderEntityConflictPanel,
  renderSyncSourceExtras,
  renderSyncSourceActions,
  renderCloudflareConfigFields,
  buildCurrentSyncCenterModel,
  _renderSyncCenterCard,
  renderQuietSyncCenterCard,
};
