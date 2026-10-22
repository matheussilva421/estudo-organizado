/**
 * Reta Final — Import
 * Fluxo de importação do cronograma dia-a-dia (JSON): file → parse →
 * validate → match → preview (casados × criados) → confirmar.
 * Padrão de modal/arquivo espelhado de config/data-management.js.
 */

import { closeModal, openModal, showToast } from '../app.js?v=8.37';
import { esc, todayStr, uid } from '../utils.js?v=8.37';
import { db, saveRetaFinalDraft, state } from '../store.js?v=8.37';
import { matchRetaFinalToEditais } from '../logic/reta-final-core.js';
import { compareRetaFinalImport } from '../logic/reta-final-import-compare.js';
import { validateRetaFinalPortable } from '../logic/reta-final-portable.js';
import {
  appendRetaFinalDraftOperation,
  createRetaFinalDraft,
} from '../logic/reta-final-drafts.js';
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
  const conflictsHtml = (match.conflicts || []).length
    ? `<div class="restore-preview-warning">Importação bloqueada por ambiguidade: ${(match.conflicts || [])
      .map((conflict) => esc(`${conflict.entity}: ${conflict.nome || conflict.code}`))
      .join(' · ')}</div>`
    : '';
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
      ${conflictsHtml}
      <div class="restore-preview-warning">
        Confirmar substitui o planejamento atual pela Reta Final. O plano anterior
        fica arquivado e pode ser restaurado após ${esc(formatBrDate(payload.dataFinal))}.
      </div>
    </div>
  `;
}

export function openRetaFinalPreview(payload) {
  const activeV2 = state.planejamento?.ativo && state.planejamento?.tipo === 'reta_final' &&
    state.planejamento?.schemaVersionRetaFinal === 2;
  if (payload?.versao === 2 && !activeV2) {
    showToast('JSON v2 só pode ser comparado com uma Reta Final v2 ativa.', 'error');
    return false;
  }
  if (activeV2) {
    return openRetaFinalComparison(payload);
  }
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
  saveBtn.disabled = (match.conflicts || []).length > 0;
  saveBtn.onclick = () => confirmRetaFinalImport(payload);
  openModal('modal-prompt');
  return true;
}

export function confirmRetaFinalImport(payload) {
  const activeV2 = state.planejamento?.ativo && state.planejamento?.tipo === 'reta_final' &&
    state.planejamento?.schemaVersionRetaFinal === 2;
  if (payload?.versao === 2 && !activeV2) {
    showToast('JSON v2 só pode ser comparado com uma Reta Final v2 ativa.', 'error');
    return false;
  }
  if (activeV2) {
    return openRetaFinalComparison(payload);
  }
  const match = matchRetaFinalToEditais(payload, state.editais);
  if ((match.conflicts || []).length) {
    showToast('Importação bloqueada: existem referências ambíguas no arquivo.', 'error');
    return;
  }
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

function renderComparisonHtml(payload, comparison) {
  const labels = {
    CREATE: 'Criar',
    UNCHANGED: 'Sem alteração',
    UPDATE: 'Atualizar',
    MOVE: 'Mover',
    ARCHIVE_CANDIDATE: 'Candidato a arquivamento',
    CONFLICT: 'Conflito',
  };
  const entries = comparison.entries.map((entry) => `
    <li>
      <strong>${esc(labels[entry.kind] || entry.kind)}</strong>
      ${entry.blockId ? `<code>${esc(entry.blockId)}</code>` : ''}
      <span>${esc(entry.reason)}</span>
    </li>
  `).join('');
  const { summary } = comparison;
  return `
    <div class="rf-import-preview">
      <div class="config-desc">
        <strong>${esc(payload.nome || 'Reta Final')}</strong> · versão ${payload.versao} ·
        revisão ${esc(payload.exportRevision ?? 'legada')}.
      </div>
      <div class="config-desc">
        ${summary.creates} criar · ${summary.updates} atualizar · ${summary.moves} mover ·
        ${summary.unchanged} sem alteração · ${summary.archiveCandidates} candidato(s) a arquivamento ·
        ${summary.conflicts} conflito(s).
      </div>
      <ul class="custom-scrollbar scroll-area-md">${entries}</ul>
      ${summary.archiveCandidates
        ? '<div class="restore-preview-warning">Sugestões de arquivamento serão guardadas no rascunho para decisão humana e não aplicadas automaticamente.</div>'
        : ''}
      ${summary.conflicts
        ? '<div class="restore-preview-warning">Conflitos bloqueiam a criação do rascunho. Resolva as referências e importe novamente.</div>'
        : '<div class="config-desc">A confirmação salva apenas um rascunho local para revisão; o plano oficial permanece intacto.</div>'}
    </div>
  `;
}

async function createComparisonDraft(plan, payload, comparison) {
  if (comparison.conflicts.length) {
    showToast('Resolva os conflitos antes de criar o rascunho.', 'error');
    return false;
  }
  const actionable = comparison.entries.filter((entry) =>
    entry.command && entry.kind !== 'ARCHIVE_CANDIDATE');
  const archiveCandidates = comparison.entries.filter((entry) =>
    entry.kind === 'ARCHIVE_CANDIDATE' && entry.command);
  if (!actionable.length) {
    showToast(
      archiveCandidates.length
        ? 'Sugestões de arquivamento exigem revisão individual e não foram aplicadas.'
        : 'A importação não contém alterações para rascunhar.',
      'info',
    );
    return false;
  }
  let draft;
  try {
    draft = createRetaFinalDraft(plan, {
      draftId: `reta-final-import-${uid()}`,
      now: new Date().toISOString(),
    });
    draft.importComparison = {
      version: payload.versao,
      sourceRevision: payload.exportRevision ?? null,
      entries: comparison.entries,
      pendingImportCommands: archiveCandidates.map((entry) => entry.command),
    };
    for (const entry of actionable) {
      const result = appendRetaFinalDraftOperation(draft, entry.command, {
        events: state.eventos,
        catalog: state.editais,
        today: todayStr(),
        makeId: () => entry.kind === 'CREATE' ? entry.blockId : uid(),
      });
      if (!result.valid) {
        throw new Error(result.errors[0]?.message || 'Comando não pôde ser incluído no rascunho.');
      }
      draft = result.draft;
    }
    await saveRetaFinalDraft(db, draft);
  } catch (error) {
    showToast(error.message || 'Não foi possível salvar o rascunho da importação.', 'error');
    return false;
  }
  closeModal('modal-prompt');
  showToast(
    `Rascunho salvo para revisão.${archiveCandidates.length ? ` ${archiveCandidates.length} candidato(s) a arquivamento aguardam decisão.` : ''}`,
    'success',
  );
  import('../ui/actions/reta-final-apply.js')
    .then(({ openRetaFinalApplyPreview }) => {
      if (!document.body) return;
      openRetaFinalApplyPreview({
        draft,
        plan,
        editais: state.editais,
        eventos: state.eventos,
        today: todayStr(),
        db,
      });
    })
    .catch(() => {
      // O rascunho já está salvo; a prévia pode ser reaberta no Planejamento.
    });
  return true;
}

export function openRetaFinalComparison(payload) {
  const plan = state.planejamento;
  if (!plan?.ativo || plan.tipo !== 'reta_final' || plan.schemaVersionRetaFinal !== 2) {
    showToast('A comparação exige uma Reta Final v2 ativa.', 'error');
    return false;
  }
  const modal = document.getElementById('modal-prompt');
  const title = document.getElementById('modal-prompt-title');
  const body = document.getElementById('modal-prompt-body');
  const saveBtn = document.getElementById('modal-prompt-save');
  if (!modal || !title || !body || !saveBtn) {
    showToast('Modal de importação indisponível.', 'error');
    return false;
  }
  const validation = validateRetaFinalPortable(payload);
  if (!validation.valid) {
    showToast('JSON de Reta Final inválido: ' + validation.errors[0], 'error');
    return false;
  }
  const comparison = compareRetaFinalImport(plan, payload, { catalog: state.editais });
  title.textContent = 'Comparar Reta Final';
  body.innerHTML = renderComparisonHtml(payload, comparison);
  saveBtn.textContent = 'Criar rascunho';
  saveBtn.className = 'btn btn-primary';
  const hasDraftableChange = comparison.entries.some((entry) =>
    entry.command && entry.kind !== 'ARCHIVE_CANDIDATE');
  saveBtn.disabled = comparison.conflicts.length > 0 || !hasDraftableChange;
  saveBtn.onclick = () => createComparisonDraft(plan, payload, comparison);
  openModal('modal-prompt');
  return true;
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
      const validation = validateRetaFinalPortable(payload);
      if (!validation.valid) {
        showToast('JSON de Reta Final inválido: ' + validation.errors[0], 'error');
        return;
      }
      if (payload.versao === 2 && !(state.planejamento?.ativo &&
        state.planejamento?.tipo === 'reta_final' &&
        state.planejamento?.schemaVersionRetaFinal === 2)) {
        showToast('JSON v2 só pode ser comparado com uma Reta Final v2 ativa.', 'error');
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
