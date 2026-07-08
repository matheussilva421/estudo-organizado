/**
 * Reta Final — Import
 * Fluxo de importação do cronograma dia-a-dia (JSON): file → parse →
 * validate → match → preview (casados × criados) → confirmar.
 * Padrão de modal/arquivo espelhado de config/data-management.js.
 */

import { closeModal, openModal, showToast } from '../app.js?v=8.37';
import { esc } from '../utils.js?v=8.37';
import { state } from '../store.js?v=8.37';
import {
  matchRetaFinalToEditais,
  validateRetaFinalPayload,
} from '../logic/reta-final-core.js';
import { activateRetaFinal } from '../logic/reta-final.js';
import { invalidateDiscCache, invalidateDashCaches } from '../logic.js?v=8.37';
import { renderCurrentView } from '../components.js?v=8.37';

function formatBrDate(dateStr) {
  const [year, month, day] = String(dateStr || '').split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

function renderMatchBadge(matched) {
  return matched
    ? '<span class="rf-match-badge rf-match-badge--ok">casado</span>'
    : '<span class="rf-match-badge rf-match-badge--new">será criado</span>';
}

function renderPreviewHtml(payload, match) {
  const totalBlocos = (payload.dias || []).reduce(
    (acc, dia) => acc + (dia.blocos || []).length,
    0
  );
  const { summary } = match;

  const disciplinasHtml = match.disciplinas
    .map((disc) => {
      const topicosHtml = disc.topicos
        .map(
          (t) =>
            `<li>${esc(t.nome)} ${renderMatchBadge(Boolean(t.assId))}</li>`
        )
        .join('');
      const aulasHtml = disc.aulas
        .map(
          (a) =>
            `<li><i class="fa fa-video"></i> ${esc(a.nome)} ${renderMatchBadge(Boolean(a.aulaId))}</li>`
        )
        .join('');
      return `
        <div class="rf-preview-disc">
          <div class="rf-preview-disc-header">
            <strong>${esc(disc.nome)}</strong> ${renderMatchBadge(Boolean(disc.discId))}
          </div>
          <ul class="rf-preview-topicos">${topicosHtml}${aulasHtml}</ul>
        </div>
      `;
    })
    .join('');

  return `
    <div class="rf-import-preview">
      <div class="config-desc">
        <strong>${esc(payload.nome || 'Reta Final')}</strong> — ${payload.dias.length} dia(s),
        ${totalBlocos} bloco(s), até <strong>${esc(formatBrDate(payload.dataFinal))}</strong>.
      </div>
      <div class="config-desc">
        Disciplinas: ${summary.disciplinasCasadas} casada(s), ${summary.disciplinasCriadas} a criar ·
        Tópicos: ${summary.topicosCasados} casado(s), ${summary.topicosCriados} a criar ·
        Aulas: ${summary.aulasCasadas} casada(s), ${summary.aulasCriadas} a criar.
      </div>
      <div class="custom-scrollbar scroll-area-md">${disciplinasHtml}</div>
      <div class="restore-preview-warning">
        Confirmar substitui o planejamento atual pela Reta Final. O plano anterior
        fica arquivado e pode ser restaurado após ${esc(formatBrDate(payload.dataFinal))}.
      </div>
    </div>
  `;
}

export function openRetaFinalPreview(payload) {
  const modal = document.getElementById('modal-prompt');
  const title = document.getElementById('modal-prompt-title');
  const body = document.getElementById('modal-prompt-body');
  const saveBtn = document.getElementById('modal-prompt-save');
  if (!modal || !title || !body || !saveBtn) {
    showToast('Modal de importação indisponível.', 'error');
    return false;
  }

  const match = matchRetaFinalToEditais(payload, state.editais);
  title.textContent = 'Importar Reta Final';
  body.innerHTML = renderPreviewHtml(payload, match);
  saveBtn.textContent = 'Ativar Reta Final';
  saveBtn.className = 'btn btn-primary';
  saveBtn.onclick = () => confirmRetaFinalImport(payload);
  openModal('modal-prompt');
  return true;
}

export function confirmRetaFinalImport(payload) {
  try {
    activateRetaFinal({ payload });
  } catch (err) {
    showToast(err.message || 'Erro ao ativar a Reta Final.', 'error');
    return;
  }
  invalidateDiscCache();
  invalidateDashCaches();
  closeModal('modal-prompt');
  renderCurrentView();
  showToast('Reta Final ativada! O plano anterior foi arquivado.', 'success');
}

export function openRetaFinalImport() {
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
      let payload;
      try {
        payload = JSON.parse(ev.target.result);
      } catch {
        showToast('Arquivo inválido! Verifique se é um JSON de Reta Final.', 'error');
        return;
      }
      const validation = validateRetaFinalPayload(payload);
      if (!validation.valid) {
        showToast('JSON de Reta Final inválido: ' + validation.errors[0], 'error');
        return;
      }
      openRetaFinalPreview(payload);
    };
    reader.onloadend = () => {
      input.remove();
    };
    reader.readAsText(file);
  };
  document.body.appendChild(input);
  input.click();
}
