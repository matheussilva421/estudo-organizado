import { state } from './store.js?v=8.37';
import { generatePlanejamento, getActiveDisciplinas } from './logic.js?v=8.37';
import { openModal, closeModal } from './app.js?v=8.37';
import { cutoffDateStr } from './utils.js?v=8.37';
import { MIN_QUESTOES_CONFIAVEL, suggestConhecimento } from './logic/weak-points.js';
import { computeWeakPointsMemo } from './logic/weak-points-memo.js';
import { validateStep as _validateStep } from './planejamento/validation.js';
import {
  htmlStep1,
  htmlStep2,
  htmlStep3,
  htmlStep4,
  pwRenderWeightPreview as _pwRenderWeightPreview,
  getDisciplinasByEditalId,
} from './planejamento/step-renderers.js';

let currentStep = 1;
let draft = {
  tipo: null, // 'ciclo' ou 'semanal'
  disciplinas: [], // ids
  relevancia: {}, // { id: { importancia, conhecimento } }
  materiasPorDia: state.config?.materiasPorDia || 3,
  horarios: {
    horasSemanais: '',
    sessaoMin: 30,
    sessaoMax: 120,
    dataInicial: '',
    dataFinal: '',
    diasAtivos: [],
    horasPorDia: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
  },
};

function createDefaultDraft() {
  return {
    tipo: null,
    disciplinas: [],
    relevancia: {},
    materiasPorDia: state.config?.materiasPorDia || 3,
    horarios: {
      horasSemanais: '',
      sessaoMin: 30,
      sessaoMax: 120,
      dataInicial: '',
      dataFinal: '',
      diasAtivos: [],
      horasPorDia: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
    },
  };
}

function normalizeDraft(value = {}) {
  const base = createDefaultDraft();
  return {
    ...base,
    ...value,
    disciplinas: Array.isArray(value.disciplinas) ? value.disciplinas : [],
    relevancia: value.relevancia && typeof value.relevancia === 'object' ? value.relevancia : {},
    materiasPorDia: parseInt(value.materiasPorDia, 10) || state.config?.materiasPorDia || 3,
    horarios: {
      ...base.horarios,
      ...(value.horarios && typeof value.horarios === 'object' ? value.horarios : {}),
      diasAtivos: Array.isArray(value.horarios?.diasAtivos) ? value.horarios.diasAtivos : [],
      horasPorDia: {
        ...base.horarios.horasPorDia,
        ...(value.horarios?.horasPorDia && typeof value.horarios.horasPorDia === 'object'
          ? value.horarios.horasPorDia
          : {}),
      },
    },
  };
}

function validateStep(step) {
  draft = normalizeDraft(draft);
  return _validateStep(step, draft);
}

export function openPlanejamentoWizard() {
  // Carregar estado existente se houver
  if (state.planejamento && state.planejamento.tipo) {
    draft = normalizeDraft(
      JSON.parse(
        JSON.stringify({
          tipo: state.planejamento.tipo || null,
          disciplinas: state.planejamento.disciplinas || [],
          relevancia: state.planejamento.relevancia || {},
          materiasPorDia: state.planejamento.materiasPorDia || state.config?.materiasPorDia || 3,
          horarios: state.planejamento.horarios || {
            horasSemanais: '',
            sessaoMin: 30,
            sessaoMax: 120,
            diasAtivos: [],
            dataInicial: '',
            dataFinal: '',
            horasPorDia: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
          },
        })
      )
    );
  } else {
    draft = createDefaultDraft();
  }

  currentStep = 1;
  openModal('modal-planejamento');
  attachWizardListeners();
  renderStep();
}

function attachWizardListeners() {
  const btnNext = document.getElementById('pw-btn-proximo');
  const btnBack = document.getElementById('pw-btn-voltar');
  const btnDone = document.getElementById('pw-btn-concluir');

  if (!btnNext || !btnBack || !btnDone) {
    console.error('attachWizardListeners: elementos do wizard não encontrados');
    return;
  }

  // Remove old listeners by cloning
  btnNext.replaceWith(btnNext.cloneNode(true));
  btnBack.replaceWith(btnBack.cloneNode(true));
  btnDone.replaceWith(btnDone.cloneNode(true));

  document.getElementById('pw-btn-proximo').addEventListener('click', () => {
    if (validateStep(currentStep)) {
      currentStep++;
      renderStep();
    }
  });

  document.getElementById('pw-btn-voltar').addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      renderStep();
    }
  });

  document.getElementById('pw-btn-concluir').addEventListener('click', () => {
    if (validateStep(4)) {
      try {
        generatePlanejamento(draft);
        document.dispatchEvent(
          new CustomEvent('app:showToast', {
            detail: { msg: 'Planejamento gerado com sucesso!', type: 'success' },
          })
        );
        closeModal('modal-planejamento');
        document.dispatchEvent(new Event('app:renderCurrentView'));
      } catch (err) {
        document.dispatchEvent(
          new CustomEvent('app:showToast', {
            detail: { msg: 'Erro ao gerar Planejamento: ' + err.message, type: 'error' },
          })
        );
        console.error(err);
      }
    } else {
      document.dispatchEvent(
        new CustomEvent('app:showToast', {
          detail: { msg: 'Erro de validação no passo 4. Verifique os campos.', type: 'error' },
        })
      );
    }
  });
}

export function pwSelectTipo(tipo) {
  draft.tipo = tipo;
  renderStep();
}

export function pwToggleDisc(id) {
  draft = normalizeDraft(draft);
  if (draft.disciplinas.includes(id)) {
    draft.disciplinas = draft.disciplinas.filter((d) => d !== id);
  } else {
    draft.disciplinas.push(id);
  }

  // Auto populate relevance if not exists
  if (!draft.relevancia[id]) {
    draft.relevancia[id] = { importancia: 3, conhecimento: 3 };
  }

  // Update counter
  const c = document.getElementById('pw-disc-count');
  if (c) c.textContent = `${draft.disciplinas.length} disciplinas selecionadas`;

  renderStep(); // Recalculate button states
}

export function pwSearchDisc(q) {
  const query = q.toLowerCase();
  document.querySelectorAll('.pw-disc-card').forEach((el) => {
    const text = el.textContent.toLowerCase();
    el.style.display = text.includes(query) ? 'flex' : 'none';
  });

  document.querySelectorAll('.pw-edital-group').forEach((group) => {
    const visibleCards = group.querySelectorAll('.pw-disc-card:not([style*="display: none"])');
    group.style.display = visibleCards.length > 0 ? 'block' : 'none';
  });
}

export function pwSelectAllDisc() {
  draft = normalizeDraft(draft);
  const all = getActiveDisciplinas() || [];
  draft.disciplinas = all.map((d) => d.disc.id);
  draft.disciplinas.forEach((id) => {
    if (!draft.relevancia[id]) draft.relevancia[id] = { importancia: 3, conhecimento: 3 };
  });
  renderStep();
}

export function pwClearDisc() {
  draft = normalizeDraft(draft);
  draft.disciplinas = [];
  renderStep();
}

export function pwSelectEditalDisc(editalId) {
  draft = normalizeDraft(draft);
  getDisciplinasByEditalId(editalId).forEach((d) => {
    if (!draft.disciplinas.includes(d.disc.id)) draft.disciplinas.push(d.disc.id);
    if (!draft.relevancia[d.disc.id]) {
      draft.relevancia[d.disc.id] = { importancia: 3, conhecimento: 3 };
    }
  });
  renderStep();
}

export function pwClearEditalDisc(editalId) {
  draft = normalizeDraft(draft);
  const ids = new Set(getDisciplinasByEditalId(editalId).map((d) => d.disc.id));
  draft.disciplinas = draft.disciplinas.filter((id) => !ids.has(id));
  renderStep();
}

/**
 * Sugestões de "conhecimento" por disciplina a partir da taxa de acerto real
 * (últimos 90 dias). Só sugere com >= MIN_QUESTOES_CONFIAVEL respondidas.
 */
export function getConhecimentoSugestoes() {
  const result = computeWeakPointsMemo({
    eventos: state.eventos || [],
    arquivo: state.arquivo || [],
    editais: state.editais || [],
    cutoffStr: cutoffDateStr(90),
  });
  const sugestoes = {};
  (result.disciplinas || []).forEach((d) => {
    const respondidas = d.acertos + d.erros;
    if (respondidas >= MIN_QUESTOES_CONFIAVEL && d.taxa !== null) {
      sugestoes[d.discId] = {
        valor: suggestConhecimento(d.taxa),
        taxa: d.taxa,
        questoes: respondidas,
      };
    }
  });
  return sugestoes;
}

/** Aplica um valor sugerido de conhecimento: draft + label (via pwUpdateRel) + slider */
export function pwApplyConhecimento(discId, valor) {
  const v = parseInt(valor, 10);
  if (!Number.isFinite(v)) return;
  pwUpdateRel(discId, 'conhecimento', String(v));
  const slider = document.querySelector(
    `input[data-action="pw-update-relevancia"][data-disc-id="${discId}"][data-type="conhecimento"]`
  );
  if (slider) slider.value = String(v);
}

export function pwApplyConhecimentoTodos() {
  const sugestoes = getConhecimentoSugestoes();
  draft.disciplinas.forEach((id) => {
    if (sugestoes[id]) pwApplyConhecimento(id, sugestoes[id].valor);
  });
}

let _relDebounce = null;
export function pwUpdateRel(id, field, val) {
  if (!draft.relevancia[id]) draft.relevancia[id] = { importancia: 3, conhecimento: 3 };
  draft.relevancia[id][field] = parseInt(val, 10);

  // Update label visual
  const lbl = document.getElementById(`pw-lbl-${field}-${id}`);
  if (lbl) lbl.textContent = val;

  if (_relDebounce) clearTimeout(_relDebounce);
  _relDebounce = setTimeout(() => {
    _pwRenderWeightPreview(draft);
  }, 100);
}

export function pwToggleDay(dayIndex) {
  const idx = parseInt(dayIndex, 10);
  if (draft.horarios.diasAtivos.includes(idx)) {
    draft.horarios.diasAtivos = draft.horarios.diasAtivos.filter((d) => d !== idx);
  } else {
    draft.horarios.diasAtivos.push(idx);
  }
  renderStep(); // Checkboxes can re-render safely
}

export function pwUpdateHours(field, val) {
  if (field === 'materiasPorDia') {
    // O min/max do input não impede digitação direta; clamp ao intervalo 1-15.
    draft.materiasPorDia = Math.min(Math.max(parseInt(val, 10) || 1, 1), 15);
    pwUpdateButtons();
    return;
  }
  draft.horarios[field] = val;
  pwUpdateButtons();
}

let _hoursDebounce = null;
export function pwUpdateDayHour(dayIdx, val) {
  draft.horarios.horasPorDia[dayIdx] = val;
  if (_hoursDebounce) clearTimeout(_hoursDebounce);
  _hoursDebounce = setTimeout(() => {
    pwUpdateButtons();
  }, 100);
}

function pwUpdateButtons() {
  const btnNext = document.getElementById('pw-btn-proximo');
  const btnDone = document.getElementById('pw-btn-concluir');
  if (currentStep === 4) {
    if (btnDone) btnDone.disabled = !validateStep(4);
  } else {
    if (btnNext) btnNext.disabled = !validateStep(currentStep);
  }
}

function renderStep() {
  // Update Stepper UI
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`pw-step-${i}`);
    if (el) {
      if (i === currentStep) {
        el.style.color = 'var(--accent)';
        el.style.fontWeight = '600';
      } else if (i < currentStep) {
        el.style.color = 'var(--green)';
        el.style.fontWeight = '500';
      } else {
        el.style.color = 'var(--text-muted)';
        el.style.fontWeight = '500';
      }
    }
  }

  // Buttons
  document.getElementById('pw-btn-voltar').style.visibility =
    currentStep === 1 ? 'hidden' : 'visible';
  const btnNext = document.getElementById('pw-btn-proximo');
  const btnDone = document.getElementById('pw-btn-concluir');

  if (currentStep === 4) {
    btnNext.style.display = 'none';
    btnDone.style.display = 'block';
    btnDone.disabled = !validateStep(4);
  } else {
    btnNext.style.display = 'block';
    btnDone.style.display = 'none';
    btnNext.disabled = !validateStep(currentStep);
  }

  const body = document.getElementById('modal-planejamento-body');
  if (currentStep === 1) body.innerHTML = htmlStep1(draft);
  if (currentStep === 2) body.innerHTML = htmlStep2(draft);
  if (currentStep === 3) {
    body.innerHTML = htmlStep3(draft, getConhecimentoSugestoes());
    _pwRenderWeightPreview(draft);
  }
  if (currentStep === 4) body.innerHTML = htmlStep4(draft);
}

// Re-export: public API — reads module-level draft for backward compatibility
export function pwRenderWeightPreview() {
  return _pwRenderWeightPreview(draft);
}
