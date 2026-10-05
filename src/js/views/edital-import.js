import { closeModal, openModal, showToast } from '../app.js?v=8.37';
import { renderCurrentView } from '../components.js?v=8.37';
import { invalidateDashCaches, invalidateDiscCache } from '../logic.js?v=8.37';
import { scheduleSave, state } from '../store.js?v=8.37';
import { esc, uid } from '../utils.js?v=8.37';
import {
  applyEditalImport,
  buildEditalImportPlan,
  findEditalImportCandidates,
  validateEditalImportPayload,
} from '../logic/edital-import-core.js';

let draft = null;
let previewBody = null;
let previewModal = null;

function getPromptElements() {
  return {
    modal: document.getElementById('modal-prompt'),
    title: document.getElementById('modal-prompt-title'),
    body: document.getElementById('modal-prompt-body'),
    saveButton: document.getElementById('modal-prompt-save'),
  };
}

function getActiveEditais() {
  return (Array.isArray(state.editais) ? state.editais : []).filter(
    (edital) => edital && edital.arquivado !== true
  );
}

function getSuggestedDestination(candidates) {
  if (candidates.active.length === 1) {
    return { mode: 'merge', editalId: candidates.active[0].editalId, makePrincipal: false };
  }
  if (candidates.active.length === 0) {
    return { mode: 'create', editalId: null, makePrincipal: false };
  }
  return null;
}

function buildPlanFor(payload, destination) {
  return buildEditalImportPlan({
    payload,
    editais: state.editais,
    destination,
  });
}

function getActionLabel(action, alreadyImported = false) {
  if (action === 'reuse') return 'Reutilizar';
  if (action === 'create_conflict') {
    return alreadyImported ? 'Conflito já importado' : 'Conflito: criar novo';
  }
  return 'Criar';
}

function renderActionBadge(action, alreadyImported = false) {
  const modifier = action === 'reuse' ? 'reuse' : action === 'create_conflict' ? 'conflict' : 'create';
  return `<span class="edital-import-badge edital-import-badge--${modifier}">${getActionLabel(action, alreadyImported)}</span>`;
}

function renderNestedItems(items, label) {
  if (!items.length) return '';
  const rows = items
    .map(
      (item) => `
        <li class="edital-import-item edital-import-item--${item.action}">
          <span>${esc(item.nome)}</span>${renderActionBadge(item.action, Boolean(item.alreadyImportedId))}
        </li>
      `
    )
    .join('');
  return `<div class="edital-import-nested"><span class="edital-import-list-label">${label}</span><ul>${rows}</ul></div>`;
}

function renderDisciplineTree(plan) {
  if (!plan) return '';
  return `
    <ul class="edital-import-tree">
      ${plan.disciplinas
        .map(
          (discipline) => `
            <li class="edital-import-discipline">
              <div class="edital-import-item edital-import-item--${discipline.action}">
                <strong>${esc(discipline.nome)}</strong>${renderActionBadge(discipline.action, Boolean(discipline.alreadyImportedId))}
              </div>
              ${renderNestedItems(discipline.topicos, 'Tópicos')}
              ${renderNestedItems(discipline.aulas, 'Aulas')}
            </li>
          `
        )
        .join('')}
    </ul>
  `;
}

function countLabel(value, singular, plural) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function renderSummary(plan) {
  if (!plan) {
    return '<p class="edital-import-empty-plan">Escolha Mesclar e um edital ativo, ou Criar novo, para visualizar as ações.</p>';
  }
  const { summary } = plan;
  return `
    <div class="edital-import-summary" data-import-summary>
      <p><strong>Disciplinas:</strong> ${countLabel(summary.disciplinasReutilizadas, 'reutilizada', 'reutilizadas')} · ${countLabel(summary.disciplinasNovas, 'nova', 'novas')} · ${countLabel(summary.disciplinasConflitantes, 'conflito', 'conflitos')}</p>
      <p><strong>Tópicos:</strong> ${countLabel(summary.topicosReutilizados, 'reutilizado', 'reutilizados')} · ${countLabel(summary.topicosNovos, 'novo', 'novos')} · ${countLabel(summary.topicosConflitantes, 'conflito', 'conflitos')}</p>
      <p><strong>Aulas:</strong> ${countLabel(summary.aulasReutilizadas, 'reutilizada', 'reutilizadas')} · ${countLabel(summary.aulasNovas, 'nova', 'novas')} · ${countLabel(summary.aulasConflitantes, 'conflito', 'conflitos')}</p>
    </div>
  `;
}

function renderProvenanceHistory() {
  const provenanceMatches = [...draft.candidates.active, ...draft.candidates.archived].filter(
    (candidate) => candidate.reasons.includes('provenance')
  );
  if (provenanceMatches.length === 0) return '';

  const currentRevision = draft.payload.sourceRevision || 'não informada';
  const entries = provenanceMatches
    .map(
      (candidate) => `
        <li>
          ${esc(candidate.nome)} — Anterior: ${esc(candidate.previousRevision || 'não informada')} ·
          Atual: ${esc(currentRevision)}
        </li>
      `
    )
    .join('');
  return `
    <div class="edital-import-provenance" data-import-provenance>
      <p>Este arquivo parece ser uma nova versão de um edital já importado.</p>
      <ul>${entries}</ul>
    </div>
  `;
}

function getPrincipalWarning() {
  if (!draft?.destination || draft.destination.mode !== 'create') return '';
  if (draft.destination.makePrincipal) {
    if (getActiveEditais().length === 0) {
      return 'Não há edital ativo; o novo edital será o edital principal.';
    }
    return 'O novo edital será o principal e os editais ativos atuais serão arquivados.';
  }
  return 'O novo edital será criado arquivado; o edital principal atual será mantido.';
}

function renderCandidates() {
  const active = draft.activeEditais;
  const suggestedById = new Map(
    draft.candidates.active.map((candidate) => [candidate.editalId, candidate])
  );
  const suggestedId = draft.suggestedDestination?.mode === 'merge'
    ? draft.suggestedDestination.editalId
    : '';
  const selectedId = draft.destination?.mode === 'merge' ? draft.destination.editalId : suggestedId;
  const activeOptions = active
    .map((candidate) => {
      const suggestion = suggestedById.get(candidate.id);
      const reason = suggestion
        ? ` · sugestão por ${suggestion.reasons.includes('provenance') ? 'proveniência' : 'nome'}`
        : '';
      const selected = candidate.id === selectedId ? ' selected' : '';
      return `<option value="${esc(candidate.id)}"${selected}>${esc(candidate.nome)}${reason}</option>`;
    })
    .join('');
  const archived = draft.candidates.archived.length
    ? `
        <div class="edital-import-archived" aria-label="Editais arquivados informativos">
          <strong>Referências arquivadas (informativas)</strong>
          <ul>
            ${draft.candidates.archived
              .map(
                (candidate) => `
                  <li data-import-archived-candidate>
                    ${esc(candidate.nome)} — arquivado; não pode ser destino de merge
                    ${candidate.reasons.includes('provenance') ? '(proveniência correspondente)' : '(nome correspondente)'}
                  </li>
                `
              )
              .join('')}
          </ul>
        </div>
      `
    : '';

  return `
    <div class="edital-import-destination">
      <fieldset class="edital-import-mode">
        <legend>Escolha explicitamente o destino</legend>
        <label>
          <input type="radio" name="edital-import-mode" value="merge" data-import-mode="merge"${draft.destination?.mode === 'merge' || draft.pendingMode === 'merge' ? ' checked' : ''}${active.length === 0 ? ' disabled' : ''}>
          Mesclar em edital ativo
        </label>
        <label>
          <input type="radio" name="edital-import-mode" value="create" data-import-mode="create"${draft.destination?.mode === 'create' || draft.pendingMode === 'create' ? ' checked' : ''}>
          Criar novo edital
        </label>
        <label class="edital-import-target-label">
          Edital de destino
          <select data-import-target aria-label="Edital ativo de destino"${active.length === 0 ? ' disabled' : ''}>
            <option value="">Selecione um edital ativo</option>
            ${activeOptions}
          </select>
        </label>
        ${renderPrincipalControl()}
      </fieldset>
      ${archived}
    </div>
  `;
}

function renderPrincipalControl() {
  const show =
    draft.destination?.mode === 'create' ||
    draft.pendingMode === 'create';
  if (!show) return '';
  const forced = getActiveEditais().length === 0;
  const checked = forced || draft.destination?.makePrincipal === true;
  return `
    <label class="edital-import-principal-option">
      <input type="checkbox" data-import-make-principal${checked ? ' checked' : ''}${forced ? ' disabled' : ''}>
      Tornar este o edital principal
    </label>
  `;
}

function renderPreviewHtml() {
  const { payload: source, importPlan } = draft;
  const revision = source.sourceRevision
    ? `<p class="edital-import-revision">Revisão da fonte: <strong>${esc(source.sourceRevision)}</strong></p>`
    : '';
  const planHint =
    !draft.destinationConfirmed && draft.importPlan
      ? '<p class="edital-import-suggestion">Resumo de prévia sugerido; confirme uma opção para habilitar a importação.</p>'
      : '';
  const warning = getPrincipalWarning();
  return `
    <div class="edital-import-preview">
      <header class="edital-import-source">
        <strong>${esc(source.nome)}</strong>
        ${revision}
      </header>
      ${renderCandidates()}
      ${renderProvenanceHistory()}
      ${planHint}
      ${renderSummary(importPlan)}
      ${renderDisciplineTree(importPlan)}
      ${warning ? `<div class="edital-import-warning" data-import-principal-warning>${esc(warning)}</div>` : ''}
      <div class="edital-import-warning edital-import-warning--preserve">
        Itens reutilizados mantêm nomes, anotações e todo o progresso local. O preview não altera dados.
      </div>
    </div>
  `;
}

function updateConfirmButton() {
  const { saveButton } = getPromptElements();
  if (!saveButton) return;
  saveButton.textContent = 'Confirmar importação';
  saveButton.disabled = !draft?.destinationConfirmed || !draft?.importPlan;
  saveButton.onclick = confirmEditalImport;
}

function renderDraft() {
  const { body } = getPromptElements();
  if (!body || !draft) return;
  body.innerHTML = renderPreviewHtml();
  updateConfirmButton();
}

function queueMergeSelection() {
  const targetSelect = document.querySelector('#modal-prompt-body [data-import-target]');
  const selectedId = targetSelect?.value || '';
  if (selectedId) {
    setEditalImportDestination({ mode: 'merge', editalId: selectedId });
    return;
  }
  draft.destination = null;
  draft.importPlan = null;
  draft.destinationConfirmed = false;
  draft.pendingMode = 'merge';
  renderDraft();
}

function handlePreviewChange(event) {
  if (!draft) return;
  const target = event.target;
  if (target.matches('[data-import-mode="merge"]')) {
    queueMergeSelection();
    return;
  }
  if (target.matches('[data-import-mode="create"]')) {
    const makePrincipal = draft.destination?.mode === 'create' && draft.destination.makePrincipal;
    setEditalImportDestination({ mode: 'create', makePrincipal });
    return;
  }
  if (target.matches('[data-import-target]')) {
    if (draft.destination?.mode === 'merge' || draft.pendingMode === 'merge') queueMergeSelection();
    return;
  }
  if (target.matches('[data-import-make-principal]')) {
    setEditalImportDestination({ mode: 'create', makePrincipal: target.checked });
  }
}

function bindPreviewEvents(body) {
  if (previewBody === body) return;
  previewBody?.removeEventListener('change', handlePreviewChange);
  previewBody = body;
  previewBody.addEventListener('change', handlePreviewChange);
}

function resetPromptSaveButton() {
  const { saveButton } = getPromptElements();
  if (!saveButton) return;
  saveButton.textContent = 'Salvar';
  saveButton.className = 'btn btn-primary';
  saveButton.disabled = false;
  saveButton.onclick = null;
}

function discardEditalImportDraft() {
  draft = null;
  resetPromptSaveButton();
}

function handlePreviewModalClosing() {
  if (draft) discardEditalImportDraft();
}

function bindPreviewDismissEvents(modal) {
  if (previewModal === modal) return;
  previewModal?.removeEventListener('modal:beforeclose', handlePreviewModalClosing);
  previewModal = modal;
  previewModal.addEventListener('modal:beforeclose', handlePreviewModalClosing);
}

export function openEditalImportPreview(payload) {
  draft = null;
  const validation = validateEditalImportPayload(payload);
  if (!validation.valid) {
    showToast(`JSON de edital inválido: ${validation.errors[0]}`, 'error');
    return false;
  }

  const { modal, title, body, saveButton } = getPromptElements();
  if (!modal || !title || !body || !saveButton) {
    showToast('Modal de importação indisponível.', 'error');
    return false;
  }

  const candidates = findEditalImportCandidates(payload, state.editais);
  const activeEditais = getActiveEditais().map(({ id, nome }) => ({ id, nome }));
  const suggestedDestination = getSuggestedDestination(candidates);
  let suggestedPlan = null;
  if (suggestedDestination) {
    try {
      suggestedPlan = buildPlanFor(payload, suggestedDestination);
    } catch (error) {
      showToast(error?.message || 'Não foi possível preparar o preview do edital.', 'error');
    }
  }

  draft = {
    payload,
    candidates,
    activeEditais,
    suggestedDestination,
    destination: null,
    pendingMode: null,
    destinationConfirmed: false,
    importPlan: suggestedPlan,
  };
  title.textContent = 'Importar Edital via JSON';
  bindPreviewEvents(body);
  bindPreviewDismissEvents(modal);
  renderDraft();
  openModal('modal-prompt');
  return true;
}

export function setEditalImportDestination(destination) {
  if (!draft) return false;
  let resolvedDestination;

  if (destination?.mode === 'merge') {
    const target = getActiveEditais().find((edital) => edital.id === destination.editalId);
    if (!target) {
      showToast('Escolha um edital ativo disponível para merge.', 'error');
      return false;
    }
    resolvedDestination = { mode: 'merge', editalId: target.id, makePrincipal: false };
  } else if (destination?.mode === 'create') {
    const hasActiveEdital = getActiveEditais().length > 0;
    resolvedDestination = {
      mode: 'create',
      editalId: null,
      makePrincipal: !hasActiveEdital || destination.makePrincipal === true,
    };
  } else {
    showToast('Escolha Mesclar ou Criar novo edital.', 'error');
    return false;
  }

  try {
    const importPlan = buildPlanFor(draft.payload, resolvedDestination);
    draft.destination = resolvedDestination;
    draft.pendingMode = null;
    draft.destinationConfirmed = true;
    draft.importPlan = importPlan;
    renderDraft();
    return true;
  } catch (error) {
    showToast(error?.message || 'Não foi possível atualizar o preview.', 'error');
    return false;
  }
}

export function confirmEditalImport() {
  if (!draft?.destinationConfirmed || !draft.importPlan) {
    showToast('Escolha explicitamente o destino antes de confirmar.', 'error');
    return false;
  }

  let applied;
  try {
    applied = applyEditalImport(state.editais, draft.importPlan, {
      uid,
      now: new Date().toISOString(),
    });
  } catch (error) {
    showToast(error?.message || 'Não foi possível aplicar a importação.', 'error');
    return false;
  }

  const mode = draft.destination.mode;
  state.editais = applied.editais;
  invalidateDiscCache();
  invalidateDashCaches();
  scheduleSave();
  closeModal('modal-prompt');
  renderCurrentView();
  showToast(
    mode === 'merge'
      ? 'Edital mesclado com sucesso; o progresso existente foi preservado.'
      : 'Novo edital criado com sucesso.',
    'success'
  );
  return true;
}

export function getEditalImportDraft() {
  return draft;
}

export function openEditalImport() {
  draft = null;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.className = 'sr-only';
  input.setAttribute('aria-label', 'Selecionar arquivo JSON de edital');
  input.addEventListener('change', (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      input.remove();
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      let imported;
      try {
        imported = JSON.parse(loadEvent.target.result);
      } catch {
        showToast('Arquivo inválido! Verifique se o JSON do edital está bem formado.', 'error');
        return;
      }
      openEditalImportPreview(imported);
    };
    reader.onerror = () => showToast('Não foi possível ler o arquivo JSON do edital.', 'error');
    reader.onloadend = () => input.remove();
    try {
      reader.readAsText(file);
    } catch {
      input.remove();
      showToast('Não foi possível ler o arquivo JSON do edital.', 'error');
    }
  });
  document.body.appendChild(input);
  input.click();
}
