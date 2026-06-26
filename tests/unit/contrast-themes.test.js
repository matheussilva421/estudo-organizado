/**
 * Regressao de contraste WCAG nos 6 temas.
 *
 * Guardrail da remediacao da critique (docs/plans/2026-06-25-impeccable-...).
 * O texto de corpo (primary/secondary/muted) DEVE ficar >= 4.5:1 sobre o card
 * em todos os temas. As cores semanticas (danger/success/warning) tambem.
 */

import { describe, it, expect } from 'vitest';
import {
  auditContrast,
  THEMES,
  BODY_TEXT_PAIRS,
} from '../../scripts/contrast-audit.mjs';

const data = auditContrast();
const AA_BODY = 4.5;

describe('contraste WCAG por tema', () => {
  it('reconhece os 6 temas', () => {
    expect(Object.keys(data).sort()).toEqual([...THEMES].sort());
  });

  for (const theme of THEMES) {
    describe(theme, () => {
      for (const pair of BODY_TEXT_PAIRS) {
        it(`texto de corpo ${pair} >= ${AA_BODY}:1`, () => {
          expect(data[theme][pair]).toBeGreaterThanOrEqual(AA_BODY);
        });
      }

      it('success/card e warning/card >= 4.5:1', () => {
        expect(data[theme]['success/card']).toBeGreaterThanOrEqual(AA_BODY);
        expect(data[theme]['warning/card']).toBeGreaterThanOrEqual(AA_BODY);
      });
    });
  }

  describe('danger/card', () => {
    for (const theme of THEMES) {
      it(`${theme} >= ${AA_BODY}:1`, () => {
        expect(data[theme]['danger/card']).toBeGreaterThanOrEqual(AA_BODY);
      });
    }
  });
});
