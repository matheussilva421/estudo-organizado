import { describe, expect, it } from 'vitest';
import {
  DEFAULTS_VERSION,
  HEIGHTS,
  SPAN_MAX,
  SPAN_MIN,
  addCard,
  createLayout,
  duplicateItem,
  hideItem,
  moveItem,
  parseImport,
  resizeHeight,
  resizeSpan,
  restoreAll,
  restoreItem,
  serializeExport,
  loadSavedLayouts,
  serializeSavedLayouts,
  toggleCollapse,
} from '../../src/lab/visual-layout-lab-core.js';

const registry = [
  { id: 'resumo-hoje', title: 'Resumo de Hoje', span: 2, height: 'md' },
  { id: 'proximas-revisoes', title: 'Próximas Revisões', span: 2, height: 'md' },
  { id: 'grafico-horas', title: 'Horas por Dia', span: 4, height: 'lg' },
];

describe('visual-layout-lab-core — createLayout', () => {
  it('cria um item por card do registry, na ordem, com defaults', () => {
    const layout = createLayout(registry);
    expect(layout.items).toHaveLength(3);
    expect(layout.items.map((i) => i.cardId)).toEqual([
      'resumo-hoje',
      'proximas-revisoes',
      'grafico-horas',
    ]);
    expect(layout.items[0]).toMatchObject({ span: 2, height: 'md', collapsed: false });
    expect(layout.hidden).toEqual([]);
  });

  it('gera instanceIds únicos', () => {
    const layout = createLayout(registry);
    const ids = layout.items.map((i) => i.instanceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('não muta o registry', () => {
    const snapshot = JSON.parse(JSON.stringify(registry));
    createLayout(registry);
    expect(registry).toEqual(snapshot);
  });
});

describe('visual-layout-lab-core — moveItem', () => {
  it('move um item para o índice destino', () => {
    const layout = createLayout(registry);
    const id = layout.items[2].instanceId;
    const next = moveItem(layout, id, 0);
    expect(next.items.map((i) => i.cardId)).toEqual([
      'grafico-horas',
      'resumo-hoje',
      'proximas-revisoes',
    ]);
  });

  it('é puro: não muta o layout original', () => {
    const layout = createLayout(registry);
    const before = JSON.parse(JSON.stringify(layout));
    moveItem(layout, layout.items[0].instanceId, 2);
    expect(layout).toEqual(before);
  });

  it('clampa índice destino fora dos limites', () => {
    const layout = createLayout(registry);
    const id = layout.items[0].instanceId;
    const next = moveItem(layout, id, 99);
    expect(next.items[next.items.length - 1].instanceId).toBe(id);
    const prev = moveItem(layout, id, -5);
    expect(prev.items[0].instanceId).toBe(id);
  });

  it('instanceId desconhecido retorna layout inalterado', () => {
    const layout = createLayout(registry);
    expect(moveItem(layout, 'nope', 1)).toEqual(layout);
  });
});

describe('visual-layout-lab-core — resize por steps', () => {
  it('resizeSpan aumenta e diminui dentro de 1..4', () => {
    const layout = createLayout(registry);
    const id = layout.items[0].instanceId; // span 2
    expect(resizeSpan(layout, id, +1).items[0].span).toBe(3);
    expect(resizeSpan(layout, id, -1).items[0].span).toBe(1);
  });

  it('resizeSpan clampa em SPAN_MIN/SPAN_MAX', () => {
    const layout = createLayout(registry);
    const wide = layout.items[2].instanceId; // span 4
    expect(resizeSpan(layout, wide, +1).items[2].span).toBe(SPAN_MAX);
    let narrow = resizeSpan(layout, layout.items[0].instanceId, -1);
    narrow = resizeSpan(narrow, narrow.items[0].instanceId, -1);
    expect(narrow.items[0].span).toBe(SPAN_MIN);
  });

  it('resizeHeight percorre os steps sm/md/lg/xl com clamp', () => {
    expect(HEIGHTS).toEqual(['sm', 'md', 'lg', 'xl']);
    const layout = createLayout(registry);
    const id = layout.items[0].instanceId; // md
    expect(resizeHeight(layout, id, +1).items[0].height).toBe('lg');
    expect(resizeHeight(layout, id, -1).items[0].height).toBe('sm');
    const down = resizeHeight(resizeHeight(layout, id, -1), id, -1);
    expect(down.items[0].height).toBe('sm');
    const big = layout.items[2].instanceId; // lg
    const up = resizeHeight(resizeHeight(layout, big, +1), big, +1);
    expect(up.items[2].height).toBe('xl');
  });
});

describe('visual-layout-lab-core — collapse, duplicate, hide/restore', () => {
  it('toggleCollapse alterna o estado', () => {
    const layout = createLayout(registry);
    const id = layout.items[0].instanceId;
    const collapsed = toggleCollapse(layout, id);
    expect(collapsed.items[0].collapsed).toBe(true);
    expect(toggleCollapse(collapsed, id).items[0].collapsed).toBe(false);
  });

  it('duplicateItem insere cópia logo após o original, com instanceId novo e mesmo estado', () => {
    const layout = createLayout(registry);
    const original = resizeSpan(layout, layout.items[0].instanceId, +1).items[0];
    const base = resizeSpan(layout, layout.items[0].instanceId, +1);
    const next = duplicateItem(base, original.instanceId);
    expect(next.items).toHaveLength(4);
    expect(next.items[1].cardId).toBe('resumo-hoje');
    expect(next.items[1].instanceId).not.toBe(original.instanceId);
    expect(next.items[1].span).toBe(original.span);
  });

  it('hideItem remove dos visíveis e guarda em hidden; restoreItem devolve ao fim', () => {
    const layout = createLayout(registry);
    const id = layout.items[0].instanceId;
    const hidden = hideItem(layout, id);
    expect(hidden.items).toHaveLength(2);
    expect(hidden.hidden).toHaveLength(1);
    expect(hidden.hidden[0].cardId).toBe('resumo-hoje');
    const restored = restoreItem(hidden, id);
    expect(restored.items).toHaveLength(3);
    expect(restored.items[2].cardId).toBe('resumo-hoje');
    expect(restored.hidden).toEqual([]);
  });

  it('restoreAll devolve todos os ocultos', () => {
    const layout = createLayout(registry);
    let next = hideItem(layout, layout.items[0].instanceId);
    next = hideItem(next, next.items[0].instanceId);
    expect(next.items).toHaveLength(1);
    const all = restoreAll(next);
    expect(all.items).toHaveLength(3);
    expect(all.hidden).toEqual([]);
  });

  it('addCard anexa instância nova de um card do registry (inclusive repetido)', () => {
    const layout = createLayout(registry);
    const next = addCard(layout, registry[0]);
    expect(next.items).toHaveLength(4);
    expect(next.items[3].cardId).toBe('resumo-hoje');
    expect(next.items[3].instanceId).not.toBe(layout.items[0].instanceId);
  });
});

describe('visual-layout-lab-core — export/import JSON', () => {
  const layouts = { home: createLayout(registry) };
  const registries = { home: registry };

  it('serializeExport produz o envelope esperado', () => {
    const out = serializeExport({ currentScreen: 'home', layouts });
    expect(out.app).toBe('estudo-organizado');
    expect(out.tool).toBe('Visual Layout Lab');
    expect(out.version).toBe(DEFAULTS_VERSION);
    expect(out.currentScreen).toBe('home');
    expect(typeof out.exportedAt).toBe('string');
    expect(out.layouts.home.items).toHaveLength(3);
  });

  it('parseImport aceita export válido (round-trip)', () => {
    const json = JSON.stringify(serializeExport({ currentScreen: 'home', layouts }));
    const result = parseImport(json, registries);
    expect(result.ok).toBe(true);
    expect(result.currentScreen).toBe('home');
    expect(result.layouts.home.items.map((i) => i.cardId)).toEqual(
      layouts.home.items.map((i) => i.cardId)
    );
  });

  it('rejeita JSON inválido', () => {
    const result = parseImport('{nope', registries);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejeita envelope de outra ferramenta/app', () => {
    const wrongTool = JSON.stringify({ app: 'estudo-organizado', tool: 'Outra', layouts: {} });
    expect(parseImport(wrongTool, registries).ok).toBe(false);
    const wrongApp = JSON.stringify({ app: 'outro-app', tool: 'Visual Layout Lab', layouts: {} });
    expect(parseImport(wrongApp, registries).ok).toBe(false);
  });

  it('ignora cardIds desconhecidos com warning e completa faltantes com defaults', () => {
    const exported = serializeExport({ currentScreen: 'home', layouts });
    exported.layouts.home.items = [
      { instanceId: 'x1', cardId: 'card-fantasma', span: 2, height: 'md', collapsed: false },
      { instanceId: 'x2', cardId: 'grafico-horas', span: 1, height: 'sm', collapsed: true },
    ];
    const result = parseImport(JSON.stringify(exported), registries);
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    const cardIds = result.layouts.home.items.map((i) => i.cardId);
    expect(cardIds).not.toContain('card-fantasma');
    expect(cardIds[0]).toBe('grafico-horas'); // importado preservado
    // faltantes do registry entram com defaults
    expect(cardIds).toContain('resumo-hoje');
    expect(cardIds).toContain('proximas-revisoes');
    const grafico = result.layouts.home.items.find((i) => i.cardId === 'grafico-horas');
    expect(grafico).toMatchObject({ span: 1, height: 'sm', collapsed: true });
  });

  it('telas desconhecidas no import são ignoradas com warning', () => {
    const exported = serializeExport({ currentScreen: 'home', layouts });
    exported.layouts['tela-fantasma'] = createLayout(registry);
    const result = parseImport(JSON.stringify(exported), registries);
    expect(result.ok).toBe(true);
    expect(result.layouts['tela-fantasma']).toBeUndefined();
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('visual-layout-lab-core — persistência (save/load com DEFAULTS_VERSION)', () => {
  it('round-trip de serializeSavedLayouts/loadSavedLayouts', () => {
    const layouts = { home: createLayout(registry) };
    const raw = serializeSavedLayouts(layouts);
    const loaded = loadSavedLayouts(raw, { home: registry });
    expect(loaded).not.toBeNull();
    expect(loaded.home.items).toHaveLength(3);
  });

  it('descarta save de versão antiga (retorna null)', () => {
    const layouts = { home: createLayout(registry) };
    const raw = serializeSavedLayouts(layouts);
    const parsed = JSON.parse(raw);
    parsed.version = DEFAULTS_VERSION - 1;
    expect(loadSavedLayouts(JSON.stringify(parsed), { home: registry })).toBeNull();
  });

  it('descarta save corrompido (retorna null)', () => {
    expect(loadSavedLayouts('{broken', { home: registry })).toBeNull();
    expect(loadSavedLayouts(null, { home: registry })).toBeNull();
  });
});
