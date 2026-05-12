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

export function getSelectedEditalId({ allowAll = true } = {}) {
  const filterState = getFilterState();
  const selected = filterState.selectedEditalId || null;
  if (isValidEditalId(selected)) return selected;
  if (allowAll) return null;

  const last = filterState.lastEditalId || null;
  if (isValidEditalId(last)) return last;
  return getEditais()[0]?.id || null;
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
