import { describe, expect, it } from 'vitest';
import { scoreRetaFinalBlock } from '../../src/js/logic/reta-final-priority.js';

describe('scoreRetaFinalBlock', () => {
  it('aplica a fórmula literal: prioridade 5, edital máximo e 10/20 questões resultam em 0.90', () => {
    const result = scoreRetaFinalBlock(
      { id: 'rf_1' },
      {
        manual: 5,
        editalWeight: 20,
        maxEditalWeight: 20,
        questions: { total: 20, acertos: 10 },
      },
    );

    expect(result.score).toBe(0.9);
    expect(result.sourcesUsed).toMatchObject({
      manual: { status: 'used', normalized: 1 },
      editalWeight: { status: 'used', normalized: 1 },
      questions: { status: 'used', difficulty: 0.5 },
    });
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('manual'),
        expect.stringContaining('edital'),
        expect.stringContaining('questões'),
      ]),
    );
  });

  it('trata menos de 20 questões como neutro, mesmo com baixo aproveitamento', () => {
    const result = scoreRetaFinalBlock(
      { id: 'rf_1' },
      {
        manual: 5,
        editalWeight: 20,
        maxEditalWeight: 20,
        questions: { total: 19, acertos: 0 },
      },
    );

    expect(result.score).toBe(0.9);
    expect(result.sourcesUsed.questions).toMatchObject({
      status: 'neutral',
      difficulty: 0.5,
    });
    expect(result.reasons.join(' ')).toMatch(/19|20|neutr/i);
  });

  it('usa valor neutro para fontes ausentes sem inventar evidências', () => {
    const result = scoreRetaFinalBlock({ id: 'rf_1' }, {});

    expect(result.score).toBe(0.5);
    expect(result.sourcesUsed).toMatchObject({
      manual: { status: 'neutral', normalized: 0.5 },
      editalWeight: { status: 'neutral', normalized: 0.5 },
      questions: { status: 'neutral', difficulty: 0.5 },
    });
    expect(result.reasons).toHaveLength(3);
  });

  it('preserva peso edital zero como fonte válida e usa neutro sem máximo válido', () => {
    const explicitZero = scoreRetaFinalBlock(
      {},
      {
        manual: 1,
        editalWeight: 0,
        maxEditalWeight: 10,
        questions: { total: 20, acertos: 20 },
      },
    );
    const missingMaximum = scoreRetaFinalBlock(
      {},
      { manual: 1, editalWeight: 0, questions: { total: 20, acertos: 20 } },
    );

    expect(explicitZero.score).toBe(0);
    expect(explicitZero.sourcesUsed.editalWeight).toMatchObject({
      status: 'used',
      normalized: 0,
    });
    expect(missingMaximum.score).toBe(0.15);
    expect(missingMaximum.sourcesUsed.editalWeight).toMatchObject({
      status: 'neutral',
      normalized: 0.5,
    });
  });

  it.each([
    [{ manual: 0 }, 'manual'],
    [{ manual: 6 }, 'manual'],
    [{ editalWeight: -1, maxEditalWeight: 10 }, 'editalWeight'],
    [{ editalWeight: 11, maxEditalWeight: 10 }, 'editalWeight'],
    [{ maxEditalWeight: 0 }, 'editalWeight'],
  ])('neutraliza fonte inválida %j', (evidence, source) => {
    const result = scoreRetaFinalBlock({}, evidence);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.sourcesUsed[source].status).toBe('neutral');
  });

  it('distingue amostra curta válida de contagens inconsistentes', () => {
    const shortValid = scoreRetaFinalBlock(
      {},
      { questions: { total: 19, acertos: 0 } },
    );
    const invalidCounts = scoreRetaFinalBlock(
      {},
      { questions: { total: 19, acertos: 20 } },
    );

    expect(shortValid.sourcesUsed.questions.reason).toBe(
      'minimum_sample_not_met',
    );
    expect(invalidCounts.sourcesUsed.questions.reason).toBe('invalid');
  });
  it.each([
    [{ total: 20, acertos: -1 }],
    [{ total: 20, acertos: 21 }],
    [{ total: 20.5, acertos: 10 }],
    [{ total: 0, acertos: 0 }],
    [null],
  ])('neutraliza amostra de questões inválida %j', (questions) => {
    const result = scoreRetaFinalBlock(
      {},
      { manual: 1, editalWeight: 0, maxEditalWeight: 1, questions },
    );

    expect(result.score).toBe(0.1);
    expect(result.sourcesUsed.questions).toMatchObject({
      status: 'neutral',
      difficulty: 0.5,
    });
  });
});
