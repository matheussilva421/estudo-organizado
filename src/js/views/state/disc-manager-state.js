/**
 * Disc Manager State
 * Shared state for disc manager tab, sequence editing, and editing mode
 * Replaces window globals for disc manager panel
 */

export function getActiveDiscManagerTab() {
  return _activeDiscManagerTab;
}
export function setActiveDiscManagerTab(tab) {
  _activeDiscManagerTab = tab;
}
export function getTempSequencia() {
  return _tempSequencia;
}
export function setTempSequencia(val) {
  _tempSequencia = val;
}
export function getIsEditingSequence() {
  return _isEditingSequence;
}
export function setIsEditingSequence(val) {
  _isEditingSequence = val;
}
