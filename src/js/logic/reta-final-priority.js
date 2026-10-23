function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function neutralSource(reason) {
  return { status: 'neutral', normalized: 0.5, reason };
}

/**
 * Produces a bounded, deterministic priority score from explicitly supplied evidence.
 * Missing or invalid sources contribute their neutral value; no weights or samples
 * are inferred from the block or surrounding catalog.
 */
export function scoreRetaFinalBlock(block, evidence = {}) {
  void block;
  const source = isRecord(evidence) ? evidence : {};

  let manualNormalized = 0.5;
  let manualSource;
  let manualReason;
  if (
    Number.isInteger(source.manual) &&
    source.manual >= 1 &&
    source.manual <= 5
  ) {
    manualNormalized = (source.manual - 1) / 4;
    manualSource = {
      status: 'used',
      value: source.manual,
      normalized: manualNormalized,
    };
    manualReason =
      'Prioridade manual usada: ' +
      source.manual +
      '/5 (normalizada em ' +
      manualNormalized +
      ').';
  } else {
    const reason = source.manual == null ? 'missing' : 'invalid';
    manualSource = neutralSource(reason);
    manualReason =
      'Fonte manual ' +
      (reason === 'missing' ? 'ausente' : 'inválida') +
      '; fator neutro 0.5.';
  }

  let editalNormalized = 0.5;
  let editalSource;
  let editalReason;
  const hasValidMaximum =
    Number.isFinite(source.maxEditalWeight) && source.maxEditalWeight > 0;
  if (
    hasValidMaximum &&
    Number.isFinite(source.editalWeight) &&
    source.editalWeight >= 0 &&
    source.editalWeight <= source.maxEditalWeight
  ) {
    editalNormalized = source.editalWeight / source.maxEditalWeight;
    editalSource = {
      status: 'used',
      value: source.editalWeight,
      max: source.maxEditalWeight,
      normalized: editalNormalized,
    };
    editalReason =
      'Peso do edital usado: ' +
      source.editalWeight +
      '/' +
      source.maxEditalWeight +
      ' (normalizado em ' +
      editalNormalized +
      ').';
  } else {
    let reason = 'missing';
    if (source.editalWeight != null || source.maxEditalWeight != null) {
      reason = 'invalid';
    }
    editalSource = neutralSource(reason);
    editalReason =
      'Peso do edital ' +
      (reason === 'missing' ? 'ausente' : 'inválido') +
      '; fator neutro 0.5.';
  }

  let difficulty = 0.5;
  let questionsSource;
  let questionsReason;
  const questions = source.questions;
  const validQuestionCounts =
    isRecord(questions) &&
    Number.isInteger(questions.total) &&
    Number.isInteger(questions.acertos) &&
    questions.total > 0 &&
    questions.acertos >= 0 &&
    questions.acertos <= questions.total;

  if (validQuestionCounts && questions.total >= 20) {
    difficulty = 1 - questions.acertos / questions.total;
    questionsSource = {
      status: 'used',
      total: questions.total,
      acertos: questions.acertos,
      difficulty,
    };
    questionsReason =
      'Amostra de ' +
      questions.total +
      ' questões usada; dificuldade ' +
      difficulty +
      '.';
  } else {
    let reason = 'missing';
    if (questions != null) {
      reason =
        validQuestionCounts && questions.total < 20
          ? 'minimum_sample_not_met'
          : 'invalid';
    }
    questionsSource = {
      ...neutralSource(reason),
      difficulty: 0.5,
    };
    questionsReason =
      reason === 'missing'
        ? 'Amostra de questões ausente; fator neutro 0.5.'
        : reason === 'minimum_sample_not_met'
          ? 'Amostra com menos de 20 questões; fator neutro 0.5.'
          : 'Amostra de questões inválida; fator neutro 0.5.';
  }

  const score =
    0.5 * manualNormalized + 0.3 * editalNormalized + 0.2 * difficulty;

  return {
    score,
    reasons: [manualReason, editalReason, questionsReason],
    sourcesUsed: {
      manual: manualSource,
      editalWeight: editalSource,
      questions: questionsSource,
    },
  };
}
