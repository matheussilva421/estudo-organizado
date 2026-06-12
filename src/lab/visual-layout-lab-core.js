// Visual Layout Lab — lógica pura de layout (sem DOM).
// Todas as operações são imutáveis: recebem um layout e retornam um novo.

export const DEFAULTS_VERSION = 1;
export const SPAN_MIN = 1;
export const SPAN_MAX = 4;
export const HEIGHTS = ['sm', 'md', 'lg', 'xl'];

const APP_NAME = 'estudo-organizado';
const TOOL_NAME = 'Visual Layout Lab';

let instanceCounter = 0;

function newInstanceId(cardId) {
  instanceCounter += 1;
  return `${cardId}__${instanceCounter}`;
}

function cloneLayout(layout) {
  return {
    items: layout.items.map((i) => ({ ...i })),
    hidden: layout.hidden.map((i) => ({ ...i })),
  };
}

function itemFromCard(card) {
  return {
    instanceId: newInstanceId(card.id),
    cardId: card.id,
    span: card.span,
    height: card.height,
    collapsed: false,
  };
}

export function createLayout(registryCards) {
  return {
    items: registryCards.map((card) => itemFromCard(card)),
    hidden: [],
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function moveItem(layout, instanceId, toIndex) {
  const fromIndex = layout.items.findIndex((i) => i.instanceId === instanceId);
  if (fromIndex === -1) return layout;
  const next = cloneLayout(layout);
  const [item] = next.items.splice(fromIndex, 1);
  next.items.splice(clamp(toIndex, 0, next.items.length), 0, item);
  return next;
}

function updateItem(layout, instanceId, updater) {
  const index = layout.items.findIndex((i) => i.instanceId === instanceId);
  if (index === -1) return layout;
  const next = cloneLayout(layout);
  next.items[index] = { ...next.items[index], ...updater(next.items[index]) };
  return next;
}

export function resizeSpan(layout, instanceId, delta) {
  return updateItem(layout, instanceId, (item) => ({
    span: clamp(item.span + delta, SPAN_MIN, SPAN_MAX),
  }));
}

export function resizeHeight(layout, instanceId, delta) {
  return updateItem(layout, instanceId, (item) => {
    const index = clamp(HEIGHTS.indexOf(item.height) + delta, 0, HEIGHTS.length - 1);
    return { height: HEIGHTS[index] };
  });
}

export function toggleCollapse(layout, instanceId) {
  return updateItem(layout, instanceId, (item) => ({ collapsed: !item.collapsed }));
}

export function duplicateItem(layout, instanceId) {
  const index = layout.items.findIndex((i) => i.instanceId === instanceId);
  if (index === -1) return layout;
  const next = cloneLayout(layout);
  const copy = { ...next.items[index], instanceId: newInstanceId(next.items[index].cardId) };
  next.items.splice(index + 1, 0, copy);
  return next;
}

export function hideItem(layout, instanceId) {
  const index = layout.items.findIndex((i) => i.instanceId === instanceId);
  if (index === -1) return layout;
  const next = cloneLayout(layout);
  const [item] = next.items.splice(index, 1);
  next.hidden.push(item);
  return next;
}

export function restoreItem(layout, instanceId) {
  const index = layout.hidden.findIndex((i) => i.instanceId === instanceId);
  if (index === -1) return layout;
  const next = cloneLayout(layout);
  const [item] = next.hidden.splice(index, 1);
  next.items.push(item);
  return next;
}

export function restoreAll(layout) {
  const next = cloneLayout(layout);
  next.items.push(...next.hidden);
  next.hidden = [];
  return next;
}

export function addCard(layout, registryCard) {
  const next = cloneLayout(layout);
  next.items.push(itemFromCard(registryCard));
  return next;
}

// --- Export / Import -------------------------------------------------------

export function serializeExport({ currentScreen, layouts }) {
  return {
    app: APP_NAME,
    tool: TOOL_NAME,
    exportedAt: new Date().toISOString(),
    version: DEFAULTS_VERSION,
    currentScreen,
    layouts,
  };
}

function isValidItem(raw) {
  return (
    raw &&
    typeof raw.cardId === 'string' &&
    Number.isFinite(raw.span) &&
    HEIGHTS.includes(raw.height)
  );
}

function sanitizeImportedLayout(rawLayout, registryCards, warnings, screen) {
  const known = new Map(registryCards.map((card) => [card.id, card]));
  const items = [];
  const seenCardIds = new Set();
  const rawItems = Array.isArray(rawLayout?.items) ? rawLayout.items : [];

  for (const raw of rawItems) {
    if (!isValidItem(raw) || !known.has(raw.cardId)) {
      warnings.push(`Tela "${screen}": card desconhecido ou inválido ignorado (${raw?.cardId}).`);
      continue;
    }
    items.push({
      instanceId: typeof raw.instanceId === 'string' ? raw.instanceId : newInstanceId(raw.cardId),
      cardId: raw.cardId,
      span: clamp(raw.span, SPAN_MIN, SPAN_MAX),
      height: raw.height,
      collapsed: raw.collapsed === true,
    });
    seenCardIds.add(raw.cardId);
  }

  const hidden = [];
  const rawHidden = Array.isArray(rawLayout?.hidden) ? rawLayout.hidden : [];
  for (const raw of rawHidden) {
    if (!isValidItem(raw) || !known.has(raw.cardId)) {
      warnings.push(`Tela "${screen}": card oculto desconhecido ignorado (${raw?.cardId}).`);
      continue;
    }
    hidden.push({
      instanceId: typeof raw.instanceId === 'string' ? raw.instanceId : newInstanceId(raw.cardId),
      cardId: raw.cardId,
      span: clamp(raw.span, SPAN_MIN, SPAN_MAX),
      height: raw.height,
      collapsed: raw.collapsed === true,
    });
    seenCardIds.add(raw.cardId);
  }

  for (const card of registryCards) {
    if (!seenCardIds.has(card.id)) items.push(itemFromCard(card));
  }

  return { items, hidden };
}

export function parseImport(json, registries) {
  let raw;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    return { ok: false, error: `JSON inválido: ${err.message}` };
  }
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'JSON inválido: conteúdo não é um objeto.' };
  }
  if (raw.app !== APP_NAME || raw.tool !== TOOL_NAME) {
    return {
      ok: false,
      error: 'Arquivo não é um export do Visual Layout Lab do estudo-organizado.',
    };
  }

  const warnings = [];
  const layouts = {};
  const rawLayouts = raw.layouts && typeof raw.layouts === 'object' ? raw.layouts : {};
  for (const [screen, rawLayout] of Object.entries(rawLayouts)) {
    if (!registries[screen]) {
      warnings.push(`Tela desconhecida ignorada: "${screen}".`);
      continue;
    }
    layouts[screen] = sanitizeImportedLayout(rawLayout, registries[screen], warnings, screen);
  }

  const currentScreen = registries[raw.currentScreen] ? raw.currentScreen : null;
  return { ok: true, warnings, currentScreen, layouts };
}

// --- Persistência local (autosave) ----------------------------------------

export function serializeSavedLayouts(layouts) {
  return JSON.stringify({ version: DEFAULTS_VERSION, layouts });
}

export function loadSavedLayouts(raw, registries) {
  if (typeof raw !== 'string' || !raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || parsed.version !== DEFAULTS_VERSION || typeof parsed.layouts !== 'object') {
    return null;
  }
  const layouts = {};
  const warnings = [];
  for (const [screen, rawLayout] of Object.entries(parsed.layouts)) {
    if (!registries[screen]) continue;
    layouts[screen] = sanitizeImportedLayout(rawLayout, registries[screen], warnings, screen);
  }
  return layouts;
}
