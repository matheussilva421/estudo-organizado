/**
 * Regressão de contraste WCAG nos 6 temas.
 *
 * Guardrail da remediação da critique (docs/plans/2026-06-25-impeccable-...).
 * O texto de corpo (primary/secondary/muted) DEVE ficar >= 4.5:1 sobre o card
 * em todos os temas. As cores semânticas (danger/success/warning) também — com
 * UMA exceção conhecida hoje: arrakis danger = 4.42 (corrigida na Fase 4).
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

  // danger/card: AA em 5 temas; arrakis é a exceção conhecida (4.42).
  // FASE 4: ao clarear o --danger do arrakis, trocar este bloco por um assert
  // simples de >= 4.5 para TODOS os temas e remover a exceção.
  describe('danger/card', () => {
    for (const theme of THEMES.filter((t) => t !== 'arrakis')) {
      it(`${theme} >= ${AA_BODY}:1`, () => {
        expect(data[theme]['danger/card']).toBeGreaterThanOrEqual(AA_BODY);
      });
    }

    it('arrakis é a única exceção sub-AA conhecida (a corrigir na Fase 4)', () => {
      expect(data.arrakis['danger/card']).toBeLessThan(AA_BODY);
      // baseline factual no momento da Fase 0:
      expect(data.arrakis['danger/card']).toBeCloseTo(4.42, 1);
    });
  });
});
