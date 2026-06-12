import { describe, expect, it } from 'vitest';
import {
  autoScrollDelta,
  computeDropIndex,
  computeFlipDeltas,
  exceedsThreshold,
  groupIntoRows,
} from '../../src/lab/visual-layout-lab-dnd.js';

// Grade 2x2 de cards 100x50 com gap 10:
// [ a ][ b ]
// [ c ][ d ]
const rects = [
  { instanceId: 'a', left: 0, top: 0, right: 100, bottom: 50 },
  { instanceId: 'b', left: 110, top: 0, right: 210, bottom: 50 },
  { instanceId: 'c', left: 0, top: 60, right: 100, bottom: 110 },
  { instanceId: 'd', left: 110, top: 60, right: 210, bottom: 110 },
];

describe('visual-layout-lab-dnd — exceedsThreshold', () => {
  it('só dispara após mover mais que o threshold (4px)', () => {
    expect(exceedsThreshold({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(false);
    expect(exceedsThreshold({ x: 0, y: 0 }, { x: 0, y: 4 })).toBe(false);
    expect(exceedsThreshold({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe(true);
    expect(exceedsThreshold({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(true);
  });
});

describe('visual-layout-lab-dnd — groupIntoRows', () => {
  it('agrupa rects por linha visual', () => {
    const rows = groupIntoRows(rects);
    expect(rows).toHaveLength(2);
    expect(rows[0].map((r) => r.instanceId)).toEqual(['a', 'b']);
    expect(rows[1].map((r) => r.instanceId)).toEqual(['c', 'd']);
  });

  it('tolera pequenas variações de top na mesma linha', () => {
    const wobbly = [
      { instanceId: 'a', left: 0, top: 0, right: 100, bottom: 50 },
      { instanceId: 'b', left: 110, top: 3, right: 210, bottom: 53 },
    ];
    expect(groupIntoRows(wobbly)).toHaveLength(1);
  });

  it('lista vazia retorna zero linhas', () => {
    expect(groupIntoRows([])).toEqual([]);
  });
});

describe('visual-layout-lab-dnd — computeDropIndex', () => {
  it('antes do midpoint do primeiro card insere no índice 0', () => {
    expect(computeDropIndex(rects, { x: 10, y: 25 })).toBe(0);
  });

  it('depois do midpoint de um card insere após ele', () => {
    expect(computeDropIndex(rects, { x: 90, y: 25 })).toBe(1);
  });

  it('na segunda linha calcula índice global', () => {
    expect(computeDropIndex(rects, { x: 10, y: 85 })).toBe(2);
    expect(computeDropIndex(rects, { x: 200, y: 85 })).toBe(4);
  });

  it('ponteiro acima de tudo cai no início; abaixo de tudo, no fim', () => {
    expect(computeDropIndex(rects, { x: 50, y: -30 })).toBe(0);
    expect(computeDropIndex(rects, { x: 50, y: 500 })).toBe(4);
  });

  it('lista vazia retorna 0', () => {
    expect(computeDropIndex([], { x: 10, y: 10 })).toBe(0);
  });
});

describe('visual-layout-lab-dnd — autoScrollDelta', () => {
  const viewport = { top: 0, bottom: 600, edge: 60, maxStep: 20 };

  it('fora das bordas não rola', () => {
    expect(autoScrollDelta(300, viewport)).toBe(0);
  });

  it('perto da borda superior rola para cima, proporcional à proximidade', () => {
    expect(autoScrollDelta(30, viewport)).toBeLessThan(0);
    expect(Math.abs(autoScrollDelta(0, viewport))).toBe(20);
    expect(Math.abs(autoScrollDelta(50, viewport))).toBeLessThan(
      Math.abs(autoScrollDelta(10, viewport))
    );
  });

  it('perto da borda inferior rola para baixo', () => {
    expect(autoScrollDelta(570, viewport)).toBeGreaterThan(0);
    expect(autoScrollDelta(600, viewport)).toBe(20);
  });
});

describe('visual-layout-lab-dnd — computeFlipDeltas', () => {
  it('calcula delta de posição antiga para nova por instanceId', () => {
    const before = new Map([
      ['a', { left: 0, top: 0 }],
      ['b', { left: 110, top: 0 }],
    ]);
    const after = new Map([
      ['a', { left: 110, top: 0 }],
      ['b', { left: 0, top: 60 }],
    ]);
    const deltas = computeFlipDeltas(before, after);
    expect(deltas.get('a')).toEqual({ dx: -110, dy: 0 });
    expect(deltas.get('b')).toEqual({ dx: 110, dy: -60 });
  });

  it('ignora ids sem par e deltas zero', () => {
    const before = new Map([
      ['a', { left: 0, top: 0 }],
      ['sumiu', { left: 5, top: 5 }],
    ]);
    const after = new Map([
      ['a', { left: 0, top: 0 }],
      ['novo', { left: 9, top: 9 }],
    ]);
    const deltas = computeFlipDeltas(before, after);
    expect(deltas.size).toBe(0);
  });
});
