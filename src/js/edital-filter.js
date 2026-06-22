import { state } from './store.js?v=8.37';
import { getUiSection, setUiSection } from './ui-state.js?v=8.37';

const UI_SECTION = 'editalFilter';

function getEditais() {
  return Array.isArray(state.editais) ? state.editais : [];
}

function getFilterState() {
  return getUiSection(UI_SECTION);
}

function isValidEditalId(id) {
  return !!id && getEditais().some((edital) => edital.id === id);
}

export function getEditalForDiscId(discId) {
  if (!discId) return null;
  for (const edital of getEditais()) {
    if ((edital.disciplinas || []).some((disc) => disc.id === discId)) return edital;
  }
  return null;
}

// Override de escopo (NÃO persistido): a página "Editais Anteriores" usa isto
// para renderizar o dashboard de um edital arquivado reaproveitando as views,
// sem reintroduzir um seletor global de edital.
let _scopeOverrideEditalId = null;

export function withEditalScope(editalId, fn) {
  const prev = _scopeOverrideEditalId;
  _scopeOverrideEditalId = editalId || null;
  try {
    return fn();
  } finally {
    _scopeOverrideEditalId = prev;
  }
}

function getPrincipalEditalId() {
  const list = getEditais();
  const principal = list.find((edital) => !edital.arquivado);
  // Fallback ao primeiro edital cobre o estado transitório/edge (todos
  // arquivados após um merge de sync) para as views nunca ficarem sem escopo.
  return principal?.id || list[0]?.id || null;
}

// Sem seletor de edital: o escopo é sempre o edital PRINCIPAL (único ativo),
// salvo um override temporário de escopo. O parâmetro `allowAll` é mantido por
// compatibilidade de assinatura nos chamadores, mas não altera mais o resultado.
export function getSelectedEditalId() {
  if (_scopeOverrideEditalId && isValidEditalId(_scopeOverrideEditalId)) {
    return _scopeOverrideEditalId;
  }
  return getPrincipalEditalId();
}

export function setSelectedEditalId(id) {
  const selectedEditalId = isValidEditalId(id) ? id : null;
  const patch = { selectedEditalId };
  if (selectedEditalId) patch.lastEditalId = selectedEditalId;
  return setUiSection(UI_SECTION, patch);
}

export function getFilteredEditais({ allowAll = true } = {}) {
  const editalId = getSelectedEditalId({ allowAll });
  if (!editalId) return getEditais();
  return getEditais().filter((edital) => edital.id === editalId);
}

export function getFilteredActiveDisciplinas(options = {}) {
  const result = [];
  for (const edital of getFilteredEditais(options)) {
    for (const disc of edital.disciplinas || []) {
      if (!disc.arquivada) result.push({ disc, edital });
    }
  }
  return result;
}

export function disciplineBelongsToSelectedEdital(discId, { allowAll = true } = {}) {
  const editalId = getSelectedEditalId({ allowAll });
  if (!editalId) return true;
  return getEditalForDiscId(discId)?.id === editalId;
}

export function eventBelongsToSelectedEdital(event, options = {}) {
  const { allowAll = true, includeUndisciplinedActive = false } = options;
  const editalId = getSelectedEditalId({ allowAll });
  if (!editalId) return true;
  if (!event?.discId) return includeUndisciplinedActive && !!event?._timerStart;
  return getEditalForDiscId(event.discId)?.id === editalId;
}

export function filterEventsBySelectedEdital(events, options = {}) {
  return (events || []).filter((event) => eventBelongsToSelectedEdital(event, options));
}

export function getEditalFilterLabel({ allowAll = true } = {}) {
  const editalId = getSelectedEditalId({ allowAll });
  if (!editalId) return 'Todos os editais';
  return getEditais().find((edital) => edital.id === editalId)?.nome || 'Edital';
}
