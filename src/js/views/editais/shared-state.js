/**
 * Editais Shared Constants & Mutable Context
 * Extracted from editais-crud.js
 */

// ── Constants ──
export const COLORS = [
  '#8aa4bf',
  '#7dd3a8',
  '#d8a657',
  '#ef7777',
  '#a7a4d6',
  '#b6a28a',
  '#7fb7c7',
  '#9fbf8a',
  '#c58f6b',
  '#8e9fd0',
  '#79b8ad',
  '#d58c9d',
  '#83a9cb',
  '#b7a1cf',
  '#93c9a8',
  '#c6b176',
  '#c59ac1',
  '#7f8a99',
];

export const DISC_ICONS = [
  '📚', '📖', '📝', '📋', '📊', '📈', '🔬', '🧪', '🧮', '💻',
  '🌍', '🏛️', '⚖️', '🧠', '💡', '📐', '🔢', '🗂️', '📜', '🎯',
  '🩺', '🔧', '🎨', '🎵', '🏃', '🌱', '💰', '📡', '🔐', '📦',
];

// ── Mutable Editing Contexts (getter/setter to survive barrel re-exports in test environments) ──
let _editingSubjectCtx = null;
let _editingDiscCtx = null;

export function getEditingSubjectCtx() { return _editingSubjectCtx; }
export function setEditingSubjectCtx(v) { _editingSubjectCtx = v; }
export function getEditingDiscCtx() { return _editingDiscCtx; }
export function setEditingDiscCtx(v) { _editingDiscCtx = v; }
