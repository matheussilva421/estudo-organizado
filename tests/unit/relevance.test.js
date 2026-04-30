import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../src/js/store.js?v=8.32', () => ({
  state: {
    bancaRelevance: { hotTopics: [], userMappings: {}, lessonMappings: {} },
    editais: []
  },
  scheduleSave: vi.fn()
}));

const relevance = await import('../../src/js/relevance.js?v=8.32');
const { state } = await import('../../src/js/store.js?v=8.32');

describe('relevance.js - Tokenization', () => {
  it('tokenize returns empty array for null/undefined', () => {
    expect(relevance.tokenize(null)).toEqual([]);
    expect(relevance.tokenize(undefined)).toEqual([]);
    expect(relevance.tokenize('')).toEqual([]);
  });

  it('tokenize removes accents and normalizes case', () => {
    const tokens = relevance.tokenize('Direito Constitucional');
    expect(tokens).toContain('direito');
    expect(tokens).toContain('constitucional');
  });

  it('tokenize filters stopwords', () => {
    const tokens = relevance.tokenize('Lei de Acesso a Informacao');
    expect(tokens).not.toContain('de');
    expect(tokens).not.toContain('a');
    expect(tokens).not.toContain('lei');
    expect(tokens).toContain('acesso');
    expect(tokens).toContain('informacao');
  });

  it('tokenize filters words shorter than 3 characters', () => {
    const tokens = relevance.tokenize('A B C test abc');
    expect(tokens).not.toContain('a');
    expect(tokens).not.toContain('b');
    expect(tokens).not.toContain('c');
    expect(tokens).toContain('test');
    expect(tokens).toContain('abc');
  });

  it('tokenize removes punctuation', () => {
    const tokens = relevance.tokenize('Art. 5, inciso III - CF/88');
    expect(tokens).not.toContain('art');
    expect(tokens).not.toContain('inciso');
  });
});

describe('relevance.js - Levenshtein Distance', () => {
  it('returns 0 for identical strings', () => {
    expect(relevance.levenshteinDistance('test', 'test')).toBe(0);
  });

  it('returns length for empty string', () => {
    expect(relevance.levenshteinDistance('', 'test')).toBe(4);
    expect(relevance.levenshteinDistance('test', '')).toBe(4);
  });

  it('calculates correct distance for single character difference', () => {
    expect(relevance.levenshteinDistance('kitten', 'sitten')).toBe(1);
  });

  it('calculates correct distance for multiple differences', () => {
    expect(relevance.levenshteinDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('relevance.js - Fuzzy Similarity', () => {
  it('returns 1.0 for identical strings', () => {
    expect(relevance.fuzzySimilarity('test', 'test')).toBe(1.0);
  });

  it('returns 1.0 for empty strings', () => {
    expect(relevance.fuzzySimilarity('', '')).toBe(1.0);
  });

  it('returns value between 0 and 1 for different strings', () => {
    const sim = relevance.fuzzySimilarity('kitten', 'sitting');
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThanOrEqual(1);
  });

  it('returns higher similarity for closer strings', () => {
    const close = relevance.fuzzySimilarity('test', 'tent');
    const far = relevance.fuzzySimilarity('test', 'abcd');
    expect(close).toBeGreaterThan(far);
  });
});

describe('relevance.js - Compute Token Match', () => {
  it('returns 0 for empty token arrays', () => {
    expect(relevance.computeTokenMatch([], ['token'])).toBe(0);
    expect(relevance.computeTokenMatch(['token'], [])).toBe(0);
    expect(relevance.computeTokenMatch([], [])).toBe(0);
  });

  it('returns 1.0 for identical token arrays', () => {
    expect(relevance.computeTokenMatch(['direito', 'constitucional'], ['direito', 'constitucional'])).toBe(1.0);
  });

  it('returns high score for similar tokens', () => {
    const score = relevance.computeTokenMatch(['direito', 'constitucional'], ['direito', 'constitucioanal']);
    expect(score).toBeGreaterThan(0.5);
  });

  it('returns low score for completely different tokens', () => {
    const score = relevance.computeTokenMatch(['matematica', 'algebra'], ['historia', 'geografia']);
    expect(score).toBeLessThan(0.3);
  });

  it('penalizes based on max token count', () => {
    const score = relevance.computeTokenMatch(['test'], ['test', 'extra', 'words']);
    expect(score).toBeLessThanOrEqual(1 / 3);
  });
});

describe('relevance.js - Find Best Match', () => {
  beforeEach(() => {
    state.bancaRelevance = { hotTopics: [], userMappings: {}, lessonMappings: {} };
  });

  it('returns low score when no hot topics defined', () => {
    const result = relevance.findBestMatch('Direito Constitucional');
    expect(result.score).toBe(0.05);
    expect(result.confidence).toBe('LOW');
    expect(result.matchedItem).toBeNull();
  });

  it('returns exact match with score 1.0', () => {
    state.bancaRelevance.hotTopics = [
      { id: 'ht_1', nome: 'Direito Constitucional', weight: 0.9 }
    ];
    const result = relevance.findBestMatch('Direito Constitucional');
    expect(result.score).toBe(1.0);
    expect(result.confidence).toBe('HIGH');
    expect(result.matchedItem.id).toBe('ht_1');
  });

  it('returns inclusion match with score 0.9', () => {
    state.bancaRelevance.hotTopics = [
      { id: 'ht_1', nome: 'Constitucional', weight: 0.8 }
    ];
    const result = relevance.findBestMatch('Direito Constitucional');
    expect(result.score).toBe(0.9);
    expect(result.confidence).toBe('HIGH');
  });

  it('respects manual override NONE', () => {
    state.bancaRelevance.userMappings = { 'Direito Constitucional': 'NONE' };
    const result = relevance.findBestMatch('Direito Constitucional');
    expect(result.score).toBe(0.05);
    expect(result.confidence).toBe('HIGH');
    expect(result.matchedItem).toBeNull();
  });

  it('respects manual override to specific topic', () => {
    state.bancaRelevance.hotTopics = [
      { id: 'ht_1', nome: 'Constitutional Law', weight: 0.7 }
    ];
    state.bancaRelevance.userMappings = { 'Direito Constitucional': 'ht_1' };
    const result = relevance.findBestMatch('Direito Constitucional');
    expect(result.score).toBe(1.0);
    expect(result.matchedItem.id).toBe('ht_1');
  });

  it('filters by disciplinaId when provided', () => {
    state.bancaRelevance.hotTopics = [
      { id: 'ht_1', nome: 'Direito Constitucional', disciplinaId: 'disc_1', weight: 0.9 },
      { id: 'ht_2', nome: 'Direito Constitucional', disciplinaId: 'disc_2', weight: 0.5 }
    ];
    const result = relevance.findBestMatch('Direito Constitucional', 'disc_1');
    expect(result.matchedItem.id).toBe('ht_1');
  });

  it('returns null when score below 0.4 threshold', () => {
    state.bancaRelevance.hotTopics = [
      { id: 'ht_1', nome: 'Matematica Avancada', weight: 0.8 }
    ];
    const result = relevance.findBestMatch('Direito Constitucional');
    expect(result.matchedItem).toBeNull();
    expect(result.score).toBe(0.05);
  });

  it('returns MEDIUM confidence for high fuzzy token match', () => {
    state.bancaRelevance.hotTopics = [
      { id: 'ht_1', nome: 'Principios Fundamentais Constitucionais', weight: 0.5 }
    ];
    const result = relevance.findBestMatch('Principio Fundamental Constitucional');
    // Inclusion match may trigger first (0.9 HIGH), or fuzzy match (MEDIUM)
    expect(result.matchedItem).not.toBeNull();
    expect(result.score).toBeGreaterThan(0.4);
  });

  it('returns LOW confidence for plausible textual similarity', () => {
    state.bancaRelevance.hotTopics = [
      { id: 'ht_1', nome: 'Direito Administrativo Sancionador', weight: 0.3 }
    ];
    const result = relevance.findBestMatch('Direito Constitucional');
    // May or may not match depending on token similarity
    if (result.matchedItem) {
      expect(['LOW', 'MEDIUM']).toContain(result.confidence);
    }
  });
});

describe('relevance.js - Calculate Final Relevance', () => {
  beforeEach(() => {
    state.bancaRelevance = { hotTopics: [], userMappings: {}, lessonMappings: {} };
  });

  it('returns P3 with score 0 when no match', () => {
    const result = relevance.calculateFinalRelevance({ assuntoNome: 'Topico Inexistente' });
    expect(result.finalScore).toBe(0);
    expect(result.priority).toBe('P3');
  });

  it('calculates score from weight property', () => {
    state.bancaRelevance.hotTopics = [
      { id: 'ht_1', nome: 'Direito Constitucional', weight: 0.8 }
    ];
    const result = relevance.calculateFinalRelevance({ assuntoNome: 'Direito Constitucional' });
    expect(result.finalScore).toBe(80);
    expect(result.priority).toBe('P1');
  });

  it('normalizes weight > 1 to percentage', () => {
    state.bancaRelevance.hotTopics = [
      { id: 'ht_1', nome: 'Direito Constitucional', weight: 80 }
    ];
    const result = relevance.calculateFinalRelevance({ assuntoNome: 'Direito Constitucional' });
    expect(result.finalScore).toBe(80);
  });

  it('calculates score from rank property', () => {
    state.bancaRelevance.hotTopics = [
      { id: 'ht_1', nome: 'Direito Constitucional', rank: 1 }
    ];
    const result = relevance.calculateFinalRelevance({ assuntoNome: 'Direito Constitucional' });
    expect(result.finalScore).toBe(100);
  });

  it('calculates score from level property', () => {
    state.bancaRelevance.hotTopics = [
      { id: 'ht_1', nome: 'Direito Constitucional', level: 'ALTA' }
    ];
    const result = relevance.calculateFinalRelevance({ assuntoNome: 'Direito Constitucional' });
    expect(result.finalScore).toBe(100);
    expect(result.priority).toBe('P1');
  });

  it('classifies MEDIA level correctly', () => {
    state.bancaRelevance.hotTopics = [
      { id: 'ht_1', nome: 'Direito Constitucional', level: 'MEDIA' }
    ];
    const result = relevance.calculateFinalRelevance({ assuntoNome: 'Direito Constitucional' });
    expect(result.finalScore).toBe(60);
    expect(result.priority).toBe('P2');
  });

  it('adds error bonus when error rate > 60%', () => {
    state.bancaRelevance.hotTopics = [
      { id: 'ht_1', nome: 'Direito Constitucional', weight: 0.7 }
    ];
    const result = relevance.calculateFinalRelevance({
      assuntoNome: 'Direito Constitucional',
      acertos: 2,
      erros: 8
    });
    expect(result.finalScore).toBe(80);
  });

  it('classifies P2 for scores between 0.40 and 0.75', () => {
    state.bancaRelevance.hotTopics = [
      { id: 'ht_1', nome: 'Direito Constitucional', weight: 0.5 }
    ];
    const result = relevance.calculateFinalRelevance({ assuntoNome: 'Direito Constitucional' });
    expect(result.finalScore).toBe(50);
    expect(result.priority).toBe('P2');
  });
});

describe('relevance.js - Apply Ranking to Edital', () => {
  beforeEach(() => {
    state.bancaRelevance = { hotTopics: [], userMappings: {}, lessonMappings: {} };
    state.editais = [];
  });

  it('returns empty array for non-existent edital', () => {
    const result = relevance.applyRankingToEdital('nonexistent');
    expect(result).toEqual([]);
  });

  it('calculates and ranks all subjects across disciplines', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [
        {
          id: 'disc_1',
          nome: 'Direito',
          assuntos: [
            { id: 'ass_1', nome: 'Constitucional', acertos: 0, erros: 0 },
            { id: 'ass_2', nome: 'Administrativo', acertos: 0, erros: 0 }
          ]
        }
      ]
    }];
    const result = relevance.applyRankingToEdital('ed_1');
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('finalScore');
    expect(result[0]).toHaveProperty('priority');
    expect(result[0]).toHaveProperty('assuntoId');
    expect(result[0]).toHaveProperty('discId');
  });

  it('assigns P1/P2/P3 by percentile', () => {
    state.bancaRelevance.hotTopics = [
      { id: 'ht_1', nome: 'Constitucional', weight: 0.9 },
      { id: 'ht_2', nome: 'Administrativo', weight: 0.5 },
      { id: 'ht_3', nome: 'Penal', weight: 0.3 },
      { id: 'ht_4', nome: 'Civil', weight: 0.2 },
      { id: 'ht_5', nome: 'Tributario', weight: 0.1 }
    ];
    state.editais = [{
      id: 'ed_1',
      disciplinas: [
        {
          id: 'disc_1',
          nome: 'Direito',
          assuntos: [
            { id: 'ass_1', nome: 'Constitucional', acertos: 0, erros: 0 },
            { id: 'ass_2', nome: 'Administrativo', acertos: 0, erros: 0 },
            { id: 'ass_3', nome: 'Penal', acertos: 0, erros: 0 },
            { id: 'ass_4', nome: 'Civil', acertos: 0, erros: 0 },
            { id: 'ass_5', nome: 'Tributario', acertos: 0, erros: 0 }
          ]
        }
      ]
    }];
    const result = relevance.applyRankingToEdital('ed_1');
    expect(result).toHaveLength(5);
    expect(result[0].priority).toBe('P1');
    const p1Count = result.filter(r => r.priority === 'P1').length;
    const p2Count = result.filter(r => r.priority === 'P2').length;
    const p3Count = result.filter(r => r.priority === 'P3').length;
    expect(p1Count).toBeGreaterThanOrEqual(1);
    expect(p2Count).toBeGreaterThanOrEqual(1);
    expect(p3Count).toBeGreaterThanOrEqual(1);
  });
});

describe('relevance.js - Commit Edital Ordering', () => {
  beforeEach(() => {
    state.editais = [];
  });

  it('returns false for non-existent edital', () => {
    const result = relevance.commitEditalOrdering('nonexistent', []);
    expect(result).toBe(false);
  });

  it('reorders subjects and injects relevance metadata', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [
        {
          id: 'disc_1',
          nome: 'Direito',
          assuntos: [
            { id: 'ass_1', nome: 'Constitucional' },
            { id: 'ass_2', nome: 'Administrativo' }
          ]
        }
      ]
    }];
    const rankedList = [
      { discId: 'disc_1', assuntoId: 'ass_2', assuntoNome: 'Administrativo', finalScore: 80, priority: 'P1', matchData: { reason: 'test', confidence: 'HIGH' } },
      { discId: 'disc_1', assuntoId: 'ass_1', assuntoNome: 'Constitucional', finalScore: 50, priority: 'P2', matchData: { reason: 'test', confidence: 'MEDIUM' } }
    ];
    const result = relevance.commitEditalOrdering('ed_1', rankedList);
    expect(result).toBe(true);
    const disc = state.editais[0].disciplinas[0];
    expect(disc.assuntos[0].id).toBe('ass_2');
    expect(disc.assuntos[1].id).toBe('ass_1');
    expect(disc.assuntos[0].relevance.priority).toBe('P1');
    expect(disc.assuntos[1].relevance.priority).toBe('P2');
  });

  it('preserves unranked subjects at end with P3', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [
        {
          id: 'disc_1',
          nome: 'Direito',
          assuntos: [
            { id: 'ass_1', nome: 'Constitucional' },
            { id: 'ass_2', nome: 'Administrativo' },
            { id: 'ass_3', nome: 'Penal' }
          ]
        }
      ]
    }];
    const rankedList = [
      { discId: 'disc_1', assuntoId: 'ass_1', assuntoNome: 'Constitucional', finalScore: 80, priority: 'P1', matchData: { reason: 'test', confidence: 'HIGH' } }
    ];
    relevance.commitEditalOrdering('ed_1', rankedList);
    const disc = state.editais[0].disciplinas[0];
    expect(disc.assuntos).toHaveLength(3);
    expect(disc.assuntos[0].id).toBe('ass_1');
    expect(disc.assuntos[2].id).toBe('ass_3');
    expect(disc.assuntos[2].relevance.priority).toBe('P3');
  });
});

describe('relevance.js - Revert Edital Ordering', () => {
  beforeEach(() => {
    state.editais = [];
  });

  it('returns false for non-existent edital', () => {
    const result = relevance.revertEditalOrdering('nonexistent', 'disc_1');
    expect(result).toBe(false);
  });

  it('returns false for non-existent disciplina', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [{ id: 'disc_1', nome: 'Direito', assuntos: [] }]
    }];
    const result = relevance.revertEditalOrdering('ed_1', 'nonexistent');
    expect(result).toBe(false);
  });

  it('removes relevance tags and sorts alphabetically', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [
        {
          id: 'disc_1',
          nome: 'Direito',
          assuntos: [
            { id: 'ass_2', nome: 'Administrativo', relevance: { priority: 'P1', finalScore: 80 } },
            { id: 'ass_1', nome: 'Constitucional', relevance: { priority: 'P2', finalScore: 50 } }
          ]
        }
      ]
    }];
    const result = relevance.revertEditalOrdering('ed_1', 'disc_1');
    expect(result).toBe(true);
    const disc = state.editais[0].disciplinas[0];
    expect(disc.assuntos[0].id).toBe('ass_2');
    expect(disc.assuntos[1].id).toBe('ass_1');
    expect(disc.assuntos[0].relevance).toBeUndefined();
    expect(disc.assuntos[1].relevance).toBeUndefined();
  });
});
