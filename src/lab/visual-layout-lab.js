// Visual Layout Lab — cola DOM: monta cards, chrome de edição, drag, resize,
// toolbar, persistência (somente chaves prefixadas) e print mode.
// NÃO importa nenhum módulo de src/js/ e não faz nenhuma chamada de rede.

import {
  HEIGHTS,
  addCard,
  createLayout,
  duplicateItem,
  hideItem,
  loadSavedLayouts,
  moveItem,
  parseImport,
  resizeHeight,
  resizeSpan,
  restoreAll,
  restoreItem,
  serializeExport,
  serializeSavedLayouts,
  toggleCollapse,
} from './visual-layout-lab-core.js';
import {
  DRAG_THRESHOLD,
  autoScrollDelta,
  computeDropIndex,
  computeFlipDeltas,
  exceedsThreshold,
} from './visual-layout-lab-dnd.js';
import {
  canRedo,
  canUndo,
  createHistory,
  push as historyPush,
  redo as historyRedo,
  undo as historyUndo,
} from './visual-layout-lab-history.js';
import { REGISTRY, SCREENS, findCard } from './visual-layout-lab-registry.js';
import { getChartConfigs, renderCard } from './visual-layout-lab-render.js';

const STORAGE_PREFIX = 'estudo-organizado-visual-layout-lab:';

function labKey(name) {
  return STORAGE_PREFIX + name;
}

const storage = {
  get(name) {
    try {
      return localStorage.getItem(labKey(name));
    } catch {
      return null;
    }
  },
  set(name, value) {
    try {
      localStorage.setItem(labKey(name), value);
    } catch {
      /* quota/modo privado: lab segue sem persistir */
    }
  },
  remove(name) {
    try {
      localStorage.removeItem(labKey(name));
    } catch {
      /* noop */
    }
  },
};

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

const registries = REGISTRY;

function defaultLayouts() {
  const layouts = {};
  for (const screen of SCREENS) layouts[screen.id] = createLayout(registries[screen.id]);
  return layouts;
}

let layouts;
let currentScreen = 'home';
let history;
let charts = [];

const $ = (id) => document.getElementById(id);
const grid = $('lab-grid');
const stage = $('lab-stage');

// ---------------------------------------------------------------------------
// Persistência (autosave com debounce)
// ---------------------------------------------------------------------------

let saveTimer = null;

function scheduleAutosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    storage.set('layouts', serializeSavedLayouts(layouts));
  }, 600);
}

function savePrefs() {
  storage.set(
    'prefs',
    JSON.stringify({
      screen: currentScreen,
      viewport: stage.dataset.viewport,
      theme: document.documentElement.dataset.theme || '',
    })
  );
}

function loadPrefs() {
  try {
    return JSON.parse(storage.get('prefs')) || {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Toast + aria-live
// ---------------------------------------------------------------------------

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `lab-toast${type !== 'info' ? ` lab-toast--${type}` : ''}`;
  el.textContent = msg;
  $('lab-toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function announce(msg) {
  $('lab-live').textContent = msg;
}

// ---------------------------------------------------------------------------
// Mutação + histórico
// ---------------------------------------------------------------------------

function snapshot() {
  return JSON.parse(JSON.stringify(layouts));
}

function commit(nextLayout, announceMsg) {
  layouts = { ...layouts, [currentScreen]: nextLayout };
  history = historyPush(history, snapshot());
  scheduleAutosave();
  if (announceMsg) announce(announceMsg);
  render();
}

function applyHistory(next) {
  if (next === history) return;
  history = next;
  layouts = JSON.parse(JSON.stringify(history.present));
  scheduleAutosave();
  render();
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function currentLayout() {
  return layouts[currentScreen];
}

function destroyCharts() {
  for (const chart of charts) chart.destroy();
  charts = [];
}

function initCharts() {
  if (typeof window.Chart !== 'function') return;
  const configs = getChartConfigs();
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue('--accent').trim() || '#8aa4bf';
  const accentLight = styles.getPropertyValue('--accent-light').trim() || 'rgba(138,164,191,0.16)';
  const border = styles.getPropertyValue('--border').trim() || 'rgba(148,163,184,0.14)';
  const textSecondary = styles.getPropertyValue('--text-secondary').trim() || '#b8c0cc';

  for (const canvas of grid.querySelectorAll('canvas[data-lab-chart]')) {
    const config = configs[canvas.dataset.labChart];
    if (!config) continue;
    const cfg = JSON.parse(JSON.stringify(config));
    if (canvas.dataset.labChart === 'dash-daily') {
      cfg.data.datasets[0].backgroundColor = accentLight;
      cfg.data.datasets[0].borderColor = accent;
      cfg.options.scales.y.grid = { color: border };
      cfg.options.scales.y.ticks.color = textSecondary;
      cfg.options.scales.x.ticks.color = textSecondary;
    }
    if (canvas.dataset.labChart === 'dash-disc') {
      cfg.options.plugins.legend.labels.color = textSecondary;
    }
    charts.push(new window.Chart(canvas, cfg));
  }
}

function buildItem(item) {
  const card = findCard(item.cardId);
  const wrap = document.createElement('div');
  wrap.className = `lab-item${item.collapsed ? ' lab-item--collapsed' : ''}`;
  wrap.dataset.instanceId = item.instanceId;
  wrap.dataset.span = String(item.span);
  wrap.dataset.height = item.height;

  const title = card ? card.title : item.cardId;
  wrap.innerHTML = `
    <div class="lab-tools" role="toolbar" aria-label="Editar card ${title}">
      <button class="lab-tool-btn lab-tool-handle" data-tool="drag" title="Arrastar (setas movem)" aria-label="Arrastar card ${title}">⠿</button>
      <button class="lab-tool-btn" data-tool="span-" title="Diminuir largura" aria-label="Diminuir largura">−W</button>
      <button class="lab-tool-btn" data-tool="span+" title="Aumentar largura" aria-label="Aumentar largura">+W</button>
      <button class="lab-tool-btn" data-tool="height-" title="Diminuir altura" aria-label="Diminuir altura">−H</button>
      <button class="lab-tool-btn" data-tool="height+" title="Aumentar altura" aria-label="Aumentar altura">+H</button>
      <button class="lab-tool-btn" data-tool="collapse" title="${item.collapsed ? 'Expandir' : 'Colapsar'}" aria-label="${item.collapsed ? 'Expandir' : 'Colapsar'}">${item.collapsed ? '▸' : '▾'}</button>
      <button class="lab-tool-btn" data-tool="duplicate" title="Duplicar" aria-label="Duplicar">⧉</button>
      <button class="lab-tool-btn" data-tool="hide" title="Ocultar" aria-label="Ocultar">✕</button>
    </div>
    <div class="lab-collapsed-bar">▸ ${title}</div>
    <div class="lab-card-content">${renderCard(item.cardId)}</div>
    <div class="lab-resize-e" data-resize="e" aria-hidden="true"></div>
    <div class="lab-resize-s" data-resize="s" aria-hidden="true"></div>
  `;
  return wrap;
}

function render() {
  destroyCharts();
  grid.innerHTML = '';
  for (const item of currentLayout().items) grid.appendChild(buildItem(item));
  initCharts();
  updateToolbarState();
  if (!$('lab-panel').hidden) refreshPanel();
}

function updateToolbarState() {
  $('lab-undo').disabled = !canUndo(history);
  $('lab-redo').disabled = !canRedo(history);
  const hiddenCount = currentLayout().hidden.length;
  const badge = $('lab-hidden-count');
  badge.textContent = String(hiddenCount);
  badge.classList.toggle('hidden', hiddenCount === 0);
}

// ---------------------------------------------------------------------------
// Tools por card (cliques)
// ---------------------------------------------------------------------------

grid.addEventListener('click', (evt) => {
  const btn = evt.target.closest('.lab-tool-btn');
  if (!btn || btn.dataset.tool === 'drag') return;
  const instanceId = btn.closest('.lab-item').dataset.instanceId;
  const layout = currentLayout();
  switch (btn.dataset.tool) {
    case 'span-':
      commit(resizeSpan(layout, instanceId, -1), 'Largura diminuída');
      break;
    case 'span+':
      commit(resizeSpan(layout, instanceId, +1), 'Largura aumentada');
      break;
    case 'height-':
      commit(resizeHeight(layout, instanceId, -1), 'Altura diminuída');
      break;
    case 'height+':
      commit(resizeHeight(layout, instanceId, +1), 'Altura aumentada');
      break;
    case 'collapse':
      commit(toggleCollapse(layout, instanceId), 'Card colapsado/expandido');
      break;
    case 'duplicate':
      commit(duplicateItem(layout, instanceId), 'Card duplicado');
      break;
    case 'hide':
      commit(hideItem(layout, instanceId), 'Card ocultado');
      break;
  }
});

// Teclado: setas com o handle focado movem o card.
grid.addEventListener('keydown', (evt) => {
  if (!evt.target.matches('.lab-tool-handle')) return;
  const keys = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };
  const delta = keys[evt.key];
  if (!delta) return;
  evt.preventDefault();
  const instanceId = evt.target.closest('.lab-item').dataset.instanceId;
  const layout = currentLayout();
  const index = layout.items.findIndex((i) => i.instanceId === instanceId);
  const to = index + delta;
  if (to < 0 || to >= layout.items.length) return;
  commit(moveItem(layout, instanceId, to), `Card movido para a posição ${to + 1}`);
  grid.querySelector(`[data-instance-id="${instanceId}"] .lab-tool-handle`)?.focus();
});

// ---------------------------------------------------------------------------
// Drag and drop (ponteiro)
// ---------------------------------------------------------------------------

let drag = null;

function itemRects(excludeId) {
  return [...grid.querySelectorAll('.lab-item')]
    .filter((el) => el.dataset.instanceId !== excludeId)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        instanceId: el.dataset.instanceId,
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
      };
    });
}

function rectMap() {
  const map = new Map();
  for (const el of grid.querySelectorAll('.lab-item')) {
    const r = el.getBoundingClientRect();
    map.set(el.dataset.instanceId, { left: r.left, top: r.top });
  }
  return map;
}

function playFlip(before) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const after = rectMap();
  const deltas = computeFlipDeltas(before, after);
  for (const [id, { dx, dy }] of deltas) {
    const el = grid.querySelector(`[data-instance-id="${id}"]`);
    if (!el) continue;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.classList.remove('lab-flip');
    requestAnimationFrame(() => {
      el.classList.add('lab-flip');
      el.style.transform = '';
    });
  }
}

grid.addEventListener('pointerdown', (evt) => {
  if (evt.button !== 0) return;
  const fromHandle = evt.target.closest('.lab-tool-handle');
  const fromHeader = evt.target.closest('.card-header, .section-header, .lab-collapsed-bar');
  if (!fromHandle && !fromHeader) return;
  const itemEl = evt.target.closest('.lab-item');
  if (!itemEl) return;
  evt.preventDefault();
  drag = {
    instanceId: itemEl.dataset.instanceId,
    itemEl,
    start: { x: evt.clientX, y: evt.clientY },
    started: false,
    ghost: null,
    dropIndex: null,
    offsetX: evt.clientX - itemEl.getBoundingClientRect().left,
    offsetY: evt.clientY - itemEl.getBoundingClientRect().top,
  };
});

function startDrag(evt) {
  const rect = drag.itemEl.getBoundingClientRect();
  const ghost = drag.itemEl.cloneNode(true);
  ghost.classList.add('lab-ghost');
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.querySelector('.lab-tools')?.remove();
  document.body.appendChild(ghost);
  drag.ghost = ghost;
  drag.itemEl.classList.add('lab-item--dragging');
  drag.started = true;
  document.body.style.userSelect = 'none';
  announce('Arrastando card. Solte para reposicionar, Esc cancela.');
  moveGhost(evt);
}

function moveGhost(evt) {
  drag.ghost.style.left = `${evt.clientX - drag.offsetX}px`;
  drag.ghost.style.top = `${evt.clientY - drag.offsetY}px`;

  const wrap = $('lab-stage-wrap');
  const bounds = wrap.getBoundingClientRect();
  const delta = autoScrollDelta(evt.clientY, {
    top: Math.max(bounds.top, 0),
    bottom: Math.min(bounds.bottom, window.innerHeight),
    edge: 60,
    maxStep: 18,
  });
  if (delta !== 0) window.scrollBy(0, delta);

  drag.dropIndex = computeDropIndex(itemRects(drag.instanceId), { x: evt.clientX, y: evt.clientY });
}

document.addEventListener('pointermove', (evt) => {
  if (!drag) return;
  if (!drag.started) {
    if (!exceedsThreshold(drag.start, { x: evt.clientX, y: evt.clientY }, DRAG_THRESHOLD)) return;
    startDrag(evt);
  }
  moveGhost(evt);
});

function endDrag(cancelled) {
  if (!drag) return;
  const { started, ghost, itemEl, instanceId, dropIndex } = drag;
  drag = null;
  if (!started) return;
  ghost.remove();
  itemEl.classList.remove('lab-item--dragging');
  document.body.style.userSelect = '';
  if (cancelled || dropIndex === null) {
    announce('Arraste cancelado.');
    return;
  }
  const layout = currentLayout();
  const fromIndex = layout.items.findIndex((i) => i.instanceId === instanceId);
  let to = dropIndex;
  if (fromIndex < to) to -= 1;
  if (to === fromIndex) return;
  const before = rectMap();
  commit(moveItem(layout, instanceId, to), `Card movido para a posição ${to + 1}`);
  playFlip(before);
}

document.addEventListener('pointerup', () => endDrag(false));
document.addEventListener('pointercancel', () => endDrag(true));

// ---------------------------------------------------------------------------
// Resize por arraste das bordas (preview ao vivo, commit único)
// ---------------------------------------------------------------------------

let resize = null;

grid.addEventListener('pointerdown', (evt) => {
  const handle = evt.target.closest('[data-resize]');
  if (!handle) return;
  evt.preventDefault();
  evt.stopPropagation();
  const itemEl = handle.closest('.lab-item');
  const layout = currentLayout();
  const item = layout.items.find((i) => i.instanceId === itemEl.dataset.instanceId);
  resize = {
    axis: handle.dataset.resize,
    itemEl,
    instanceId: item.instanceId,
    originalSpan: item.span,
    originalHeight: item.height,
    rect: itemEl.getBoundingClientRect(),
    gridRect: grid.getBoundingClientRect(),
  };
});

document.addEventListener('pointermove', (evt) => {
  if (!resize) return;
  if (resize.axis === 'e') {
    const colUnit = resize.gridRect.width / 4;
    const span = Math.max(1, Math.min(4, Math.round((evt.clientX - resize.rect.left) / colUnit)));
    resize.itemEl.dataset.span = String(span);
  } else {
    const px = evt.clientY - resize.rect.top;
    const steps = [
      { h: 'sm', px: 200 },
      { h: 'md', px: 340 },
      { h: 'lg', px: 500 },
      { h: 'xl', px: 660 },
    ];
    let best = steps[0];
    for (const s of steps) if (Math.abs(s.px - px) < Math.abs(best.px - px)) best = s;
    resize.itemEl.dataset.height = best.h;
  }
});

document.addEventListener('pointerup', () => {
  if (!resize) return;
  const { itemEl, instanceId, originalSpan, originalHeight } = resize;
  resize = null;
  const newSpan = Number(itemEl.dataset.span);
  const newHeight = itemEl.dataset.height;
  if (newSpan === originalSpan && newHeight === originalHeight) return;
  let layout = currentLayout();
  if (newSpan !== originalSpan) layout = resizeSpan(layout, instanceId, newSpan - originalSpan);
  if (newHeight !== originalHeight) {
    layout = resizeHeight(
      layout,
      instanceId,
      HEIGHTS.indexOf(newHeight) - HEIGHTS.indexOf(originalHeight)
    );
  }
  commit(layout, 'Card redimensionado');
});

document.addEventListener('keydown', (evt) => {
  if (evt.key !== 'Escape') return;
  if (drag?.started) {
    endDrag(true);
    return;
  }
  if (resize) {
    resize.itemEl.dataset.span = String(resize.originalSpan);
    resize.itemEl.dataset.height = resize.originalHeight;
    resize = null;
    return;
  }
  if (document.body.classList.contains('lab-print')) {
    document.body.classList.remove('lab-print');
    return;
  }
  if (!$('lab-panel').hidden) closePanel();
});

// ---------------------------------------------------------------------------
// Painéis (Adicionar card / Ocultos)
// ---------------------------------------------------------------------------

let panelMode = null;

function closePanel() {
  $('lab-panel').hidden = true;
  panelMode = null;
}

function openPanel(mode) {
  panelMode = mode;
  $('lab-panel').hidden = false;
  refreshPanel();
}

function refreshPanel() {
  const body = $('lab-panel-body');
  if (panelMode === 'add') {
    $('lab-panel-title').textContent = 'Adicionar card';
    body.innerHTML = SCREENS.map((screen) => {
      const items = registries[screen.id]
        .map(
          (card) => `
        <div class="lab-panel-item">
          <span class="lab-panel-item-title">${card.title}
            ${screen.id !== currentScreen ? `<span class="lab-panel-item-origin">de: ${screen.label}</span>` : ''}
          </span>
          <button class="btn btn-ghost btn-sm" data-add-card="${card.id}">Adicionar</button>
        </div>`
        )
        .join('');
      return `<div class="lab-panel-section">${screen.label}</div>${items}`;
    }).join('');
  } else if (panelMode === 'hidden') {
    $('lab-panel-title').textContent = 'Cards ocultos';
    const hidden = currentLayout().hidden;
    body.innerHTML =
      hidden.length === 0
        ? '<div class="lab-panel-item"><span class="lab-panel-item-title">Nenhum card oculto nesta tela.</span></div>'
        : `${hidden
            .map((item) => {
              const card = findCard(item.cardId);
              return `
            <div class="lab-panel-item">
              <span class="lab-panel-item-title">${card ? card.title : item.cardId}</span>
              <button class="btn btn-ghost btn-sm" data-restore="${item.instanceId}">Restaurar</button>
            </div>`;
            })
            .join('')}
          <button class="btn btn-primary btn-sm" id="lab-restore-all" style="margin-top:8px;">Restaurar todos</button>`;
  }
}

$('lab-panel-body').addEventListener('click', (evt) => {
  const addBtn = evt.target.closest('[data-add-card]');
  if (addBtn) {
    const card = findCard(addBtn.dataset.addCard);
    const titled = card.screenId !== currentScreen ? { ...card, title: card.title } : card;
    commit(addCard(currentLayout(), titled), `Card "${card.title}" adicionado`);
    toast(`Card "${card.title}" adicionado`);
    return;
  }
  const restoreBtn = evt.target.closest('[data-restore]');
  if (restoreBtn) {
    commit(restoreItem(currentLayout(), restoreBtn.dataset.restore), 'Card restaurado');
    return;
  }
  if (evt.target.closest('#lab-restore-all')) {
    commit(restoreAll(currentLayout()), 'Todos os cards restaurados');
  }
});

$('lab-panel-close').addEventListener('click', closePanel);
$('lab-add-card').addEventListener('click', () => openPanel('add'));
$('lab-show-hidden').addEventListener('click', () => openPanel('hidden'));

// ---------------------------------------------------------------------------
// Toolbar: tela, viewport, tema, undo/redo, export/import, reset, print
// ---------------------------------------------------------------------------

const screenSelect = $('lab-screen-select');
screenSelect.innerHTML = SCREENS.map((s) => `<option value="${s.id}">${s.label}</option>`).join('');

screenSelect.addEventListener('change', () => {
  currentScreen = screenSelect.value;
  savePrefs();
  render();
});

$('lab-viewport-select').addEventListener('change', (evt) => {
  stage.dataset.viewport = evt.target.value;
  savePrefs();
});

$('lab-theme-select').addEventListener('change', (evt) => {
  if (evt.target.value) document.documentElement.dataset.theme = evt.target.value;
  else delete document.documentElement.dataset.theme;
  savePrefs();
  render(); // gráficos releem as CSS vars do tema
});

$('lab-undo').addEventListener('click', () => applyHistory(historyUndo(history)));
$('lab-redo').addEventListener('click', () => applyHistory(historyRedo(history)));

document.addEventListener('keydown', (evt) => {
  if (evt.target.matches('input, select, textarea')) return;
  const ctrl = evt.ctrlKey || evt.metaKey;
  if (ctrl && !evt.shiftKey && evt.key.toLowerCase() === 'z') {
    evt.preventDefault();
    applyHistory(historyUndo(history));
  } else if (
    (ctrl && evt.shiftKey && evt.key.toLowerCase() === 'z') ||
    (ctrl && evt.key.toLowerCase() === 'y')
  ) {
    evt.preventDefault();
    applyHistory(historyRedo(history));
  } else if (!ctrl && evt.key.toLowerCase() === 'p') {
    document.body.classList.toggle('lab-print');
  }
});

$('lab-print-mode').addEventListener('click', () => document.body.classList.toggle('lab-print'));

$('lab-export').addEventListener('click', () => {
  const envelope = serializeExport({ currentScreen, layouts });
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `visual-layout-lab-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Layout exportado');
});

$('lab-import').addEventListener('click', () => $('lab-import-file').click());

$('lab-import-file').addEventListener('change', async (evt) => {
  const file = evt.target.files[0];
  evt.target.value = '';
  if (!file) return;
  const text = await file.text();
  const result = parseImport(text, registries);
  if (!result.ok) {
    toast(result.error, 'error');
    return;
  }
  layouts = { ...layouts, ...result.layouts };
  if (result.currentScreen) {
    currentScreen = result.currentScreen;
    screenSelect.value = currentScreen;
  }
  history = historyPush(history, snapshot());
  scheduleAutosave();
  render();
  for (const warning of result.warnings.slice(0, 3)) toast(warning, 'warning');
  toast('Layout importado');
});

$('lab-reset-screen').addEventListener('click', () => {
  commit(createLayout(registries[currentScreen]), 'Layout da tela resetado');
  toast('Layout da tela resetado');
});

$('lab-reset-all').addEventListener('click', () => {
  layouts = defaultLayouts();
  history = historyPush(history, snapshot());
  storage.remove('layouts');
  render();
  toast('Todos os layouts resetados');
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot() {
  const rawSaved = storage.get('layouts');
  const saved = loadSavedLayouts(rawSaved, registries);
  if (rawSaved && !saved) {
    toast('Layout salvo era de uma versão antiga e foi descartado', 'warning');
    storage.remove('layouts');
  }
  layouts = { ...defaultLayouts(), ...(saved || {}) };

  const prefs = loadPrefs();
  if (prefs.screen && registries[prefs.screen]) currentScreen = prefs.screen;
  if (prefs.viewport) {
    stage.dataset.viewport = prefs.viewport;
    $('lab-viewport-select').value = prefs.viewport;
  }
  if (prefs.theme) {
    document.documentElement.dataset.theme = prefs.theme;
    $('lab-theme-select').value = prefs.theme;
  }
  screenSelect.value = currentScreen;

  history = createHistory(snapshot());
  render();
}

boot();
