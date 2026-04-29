/**
 * Chart Instance State
 * Shared state for Chart.js instances
 * Replaces window._discChartInstance and window._planjChartInstance
 */

let _discChartInstance = null;
let _planjChartInstance = null;

export function getDiscChartInstance() { return _discChartInstance; }
export function setDiscChartInstance(val) { _discChartInstance = val; }
export function getPlanjChartInstance() { return _planjChartInstance; }
export function setPlanjChartInstance(val) { _planjChartInstance = val; }
