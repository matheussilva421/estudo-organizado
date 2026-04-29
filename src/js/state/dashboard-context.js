/**
 * Dashboard Context State
 * Shared state for discipline dashboard navigation and tab selection
 * Replaces window.activeDashboardDiscCtx and window.activeDashboardTab
 */

let _activeDashboardDiscCtx = null;
let _activeDashboardTab = 'topicos';

export function getActiveDashboardDiscCtx() {
  return _activeDashboardDiscCtx;
}
export function setActiveDashboardDiscCtx(ctx) {
  _activeDashboardDiscCtx = ctx;
}
export function clearActiveDashboardDiscCtx() {
  _activeDashboardDiscCtx = null;
}

export function getActiveDashboardTab() {
  return _activeDashboardTab;
}
export function setActiveDashboardTab(tab) {
  _activeDashboardTab = tab;
}
export function resetActiveDashboardTab() {
  _activeDashboardTab = 'topicos';
}
