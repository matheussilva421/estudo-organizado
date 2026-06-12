import { describe, expect, it } from 'vitest';
import {
  HISTORY_CAP,
  canRedo,
  canUndo,
  createHistory,
  push,
  redo,
  undo,
} from '../../src/lab/visual-layout-lab-history.js';

describe('visual-layout-lab-history', () => {
  it('começa sem undo nem redo disponíveis', () => {
    const h = createHistory('a');
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it('push registra estado e habilita undo', () => {
    const h = push(createHistory('a'), 'b');
    expect(h.present).toBe('b');
    expect(canUndo(h)).toBe(true);
    expect(canRedo(h)).toBe(false);
  });

  it('undo volta ao estado anterior e habilita redo', () => {
    let h = push(createHistory('a'), 'b');
    h = undo(h);
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(true);
  });

  it('redo refaz o estado desfeito', () => {
    let h = push(createHistory('a'), 'b');
    h = redo(undo(h));
    expect(h.present).toBe('b');
    expect(canRedo(h)).toBe(false);
  });

  it('push após undo descarta o future', () => {
    let h = push(push(createHistory('a'), 'b'), 'c');
    h = undo(h); // present b, future [c]
    h = push(h, 'd');
    expect(h.present).toBe('d');
    expect(canRedo(h)).toBe(false);
    expect(undo(h).present).toBe('b');
  });

  it('undo/redo sem nada disponível retornam o histórico inalterado', () => {
    const h = createHistory('a');
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it('respeita o cap de 100 estados no past', () => {
    expect(HISTORY_CAP).toBe(100);
    let h = createHistory(0);
    for (let i = 1; i <= 150; i += 1) h = push(h, i);
    expect(h.past.length).toBe(HISTORY_CAP);
    // o estado mais antigo preservado é o 50 (0..49 descartados)
    let walked = h;
    while (canUndo(walked)) walked = undo(walked);
    expect(walked.present).toBe(50);
  });
});
