import { esc } from '../../utils.js?v=8.37';

export function formatBackupDateTime(value) {
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

export function renderRestoreImpactSummary(impact) {
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
