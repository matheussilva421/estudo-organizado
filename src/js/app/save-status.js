// =============================================
// SAVE STATUS INDICATOR
// =============================================

let _saveStatusListenerAttached = false;
let _lastSaveStatus = {
  status: 'saved',
  message: 'Salvo localmente',
  detail: '',
  timestamp: null,
};

export function getLastSaveStatus() {
  return { ..._lastSaveStatus };
}

function getSaveStatusText(statusDetail) {
  if (statusDetail.status === 'saving') return 'Salvando...';
  if (statusDetail.status === 'error') return 'Erro ao salvar';
  return 'Salvo localmente';
}

function getConfigSaveStatusText(statusDetail) {
  if (statusDetail.status === 'saving') return 'Salvando alterações no dispositivo...';
  if (statusDetail.status === 'error') {
    return `Falha ao salvar: ${statusDetail.detail || 'erro desconhecido'}`;
  }
  return 'Último salvamento local concluído. Credenciais não entram em backup/exportação.';
}

export function renderSaveStatus(statusDetail = _lastSaveStatus) {
  const normalized = {
    status: statusDetail.status || 'saved',
    message: statusDetail.message || getSaveStatusText(statusDetail),
    detail: statusDetail.detail || '',
    timestamp: statusDetail.timestamp || new Date().toISOString(),
  };
  _lastSaveStatus = normalized;

  const topbarStatus = document.getElementById('save-status');
  if (topbarStatus) {
    topbarStatus.className = `save-status save-status--${normalized.status}`;
    topbarStatus.textContent = getSaveStatusText(normalized);
    topbarStatus.title =
      normalized.status === 'error'
        ? getConfigSaveStatusText(normalized)
        : 'Status do salvamento local';
    topbarStatus.setAttribute('aria-label', topbarStatus.title);
  }

  const configStatus = document.getElementById('config-save-status-detail');
  if (configStatus) {
    configStatus.className = `config-save-status config-save-status--${normalized.status}`;
    configStatus.textContent = getConfigSaveStatusText(normalized);
  }
}

const QUIET_SYNC_LABELS = {
  ok: 'Tudo salvo',
  pending: 'Sincronizando',
  offline: 'Offline',
  danger: 'Ação necessária',
  warning: 'Sincronizando',
  idle: 'Tudo salvo',
};

let _topbarSyncState = 'ok';
let _topbarSyncTimer = null;
const TOPBAR_SYNC_DEBOUNCE_MS = 700;

function renderSyncTopbarStatus(quietTone) {
  if (_topbarSyncTimer) clearTimeout(_topbarSyncTimer);
  _topbarSyncTimer = setTimeout(() => {
    _topbarSyncTimer = null;
    const topbarStatus = document.getElementById('save-status');
    if (!topbarStatus) return;
    const label = QUIET_SYNC_LABELS[quietTone] || 'Tudo salvo';
    _topbarSyncState = quietTone;
    topbarStatus.className = `save-status save-status--${quietTone}`;
    topbarStatus.textContent = label;
    topbarStatus.setAttribute('aria-label', label);
  }, TOPBAR_SYNC_DEBOUNCE_MS);
}

export function initSaveStatusIndicator() {
  if (!_saveStatusListenerAttached) {
    document.addEventListener('app:saveStatus', (event) => {
      renderSaveStatus(event.detail || {});
    });
    const toneMap = {
      synced: 'ok',
      syncing: 'pending',
      queued: 'pending',
      'conflict-paused': 'danger',
      degraded: 'warning',
      error: 'danger',
      offline: 'offline',
      idle: 'ok',
      recovery: 'pending',
      partial: 'warning',
      conflict: 'danger',
      'no-channels': 'idle',
    };
    document.addEventListener('app:primarySyncStatus', (event) => {
      const status = (event.detail || {}).status || 'idle';
      renderSyncTopbarStatus(toneMap[status] || 'ok');
    });
    document.addEventListener('app:manualSyncStatus', (event) => {
      const status = (event.detail || {}).status || 'idle';
      renderSyncTopbarStatus(toneMap[status] || 'ok');
    });
    _saveStatusListenerAttached = true;
  }
  renderSaveStatus(_lastSaveStatus);
}
