import { describe, expect, it } from 'vitest';
import { THEMES } from '../../src/presentation/ui-state';

describe('F7-UX Premium theme catalog', () => {
  it('exposes twelve unique themes including the four premium additions', () => {
    expect(THEMES).toHaveLength(12);
    const ids = THEMES.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(12);
    for (const id of ['neon-teal', 'esmeralda-dourado', 'azul-ambar', 'azul-glacial']) {
      expect(ids).toContain(id);
    }
  });

  it('keeps a representative preview for every theme', () => {
    for (const theme of THEMES) {
      expect(theme.preview.background).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.preview.surface).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.preview.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.preview.text).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

