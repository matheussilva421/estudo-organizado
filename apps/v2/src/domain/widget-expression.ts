export type WidgetMetricValue = {
  value: number | null;
  unit: string;
  sampleSize: number;
  denominator: number | null;
};

export type WidgetExpressionAst =
  | { kind: 'number'; value: number }
  | { kind: 'metric'; name: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'binary'; operator: '+' | '-' | '*' | '/' | '>' | '>=' | '<' | '<=' | '==' | '!=' | 'and' | 'or'; left: WidgetExpressionAst; right: WidgetExpressionAst }
  | { kind: 'if'; condition: WidgetExpressionAst; then: WidgetExpressionAst; otherwise: WidgetExpressionAst };

export type WidgetExpressionParseResult =
  | { ok: true; ast: WidgetExpressionAst; source: string }
  | { ok: false; code: string; message: string };

export type WidgetExpressionResult =
  | { ok: true; value: number | boolean; unit: string }
  | { ok: false; code: string; message: string };

type TokenKind = 'number' | 'identifier' | 'operator' | 'punctuation' | 'eof';
type Token = { kind: TokenKind; text: string; offset: number };

class ParseFailure extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

const MAX_EXPRESSION_LENGTH = 512;
const MAX_DEPTH = 24;
const OPERATORS = ['>=', '<=', '==', '!=', '>', '<', '+', '-', '*', '/'] as const;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let offset = 0;
  while (offset < source.length) {
    const char = source[offset]!;
    if (/\s/.test(char)) {
      offset += 1;
      continue;
    }
    if (/\d/.test(char)) {
      const start = offset;
      while (offset < source.length && /\d/.test(source[offset]!)) offset += 1;
      if (source[offset] === '.') {
        offset += 1;
        if (!/\d/.test(source[offset] ?? '')) throw new ParseFailure('INVALID_NUMBER', 'Decimal incompleto.');
        while (offset < source.length && /\d/.test(source[offset]!)) offset += 1;
      }
      tokens.push({ kind: 'number', text: source.slice(start, offset), offset: start });
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const start = offset;
      offset += 1;
      while (offset < source.length && /[A-Za-z0-9_]/.test(source[offset]!)) offset += 1;
      const text = source.slice(start, offset);
      tokens.push({ kind: text === 'and' || text === 'or' ? 'operator' : 'identifier', text, offset: start });
      continue;
    }
    const operator = OPERATORS.find((candidate) => source.startsWith(candidate, offset));
    if (operator) {
      tokens.push({ kind: 'operator', text: operator, offset });
      offset += operator.length;
      continue;
    }
    if (char === '(' || char === ')' || char === ',') {
      tokens.push({ kind: 'punctuation', text: char, offset });
      offset += 1;
      continue;
    }
    throw new ParseFailure('UNSUPPORTED_TOKEN', `Token não permitido na posição ${offset}.`);
  }
  tokens.push({ kind: 'eof', text: '', offset: source.length });
  return tokens;
}

class Parser {
  private index = 0;
  private depth = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): WidgetExpressionAst {
    const expression = this.parseOr();
    if (this.peek().kind !== 'eof') this.fail('UNEXPECTED_TOKEN', `Token inesperado: ${this.peek().text}.`);
    return expression;
  }

  private parseOr(): WidgetExpressionAst {
    let left = this.parseAnd();
    while (this.match('operator', 'or')) left = { kind: 'binary', operator: 'or', left, right: this.parseAnd() };
    return left;
  }

  private parseAnd(): WidgetExpressionAst {
    let left = this.parseEquality();
    while (this.match('operator', 'and')) left = { kind: 'binary', operator: 'and', left, right: this.parseEquality() };
    return left;
  }

  private parseEquality(): WidgetExpressionAst {
    let left = this.parseComparison();
    while (this.peek().kind === 'operator' && (this.peek().text === '==' || this.peek().text === '!=')) {
      const operator = this.consume().text as '==' | '!=';
      left = { kind: 'binary', operator, left, right: this.parseComparison() };
    }
    return left;
  }

  private parseComparison(): WidgetExpressionAst {
    let left = this.parseAdditive();
    while (this.peek().kind === 'operator' && ['>', '>=', '<', '<='].includes(this.peek().text)) {
      const operator = this.consume().text as '>' | '>=' | '<' | '<=';
      left = { kind: 'binary', operator, left, right: this.parseAdditive() };
    }
    return left;
  }

  private parseAdditive(): WidgetExpressionAst {
    let left = this.parseMultiplicative();
    while (this.peek().kind === 'operator' && (this.peek().text === '+' || this.peek().text === '-')) {
      const operator = this.consume().text as '+' | '-';
      left = { kind: 'binary', operator, left, right: this.parseMultiplicative() };
    }
    return left;
  }

  private parseMultiplicative(): WidgetExpressionAst {
    let left = this.parseUnary();
    while (this.peek().kind === 'operator' && (this.peek().text === '*' || this.peek().text === '/')) {
      const operator = this.consume().text as '*' | '/';
      left = { kind: 'binary', operator, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): WidgetExpressionAst {
    if (this.match('operator', '-')) {
      return { kind: 'binary', operator: '-', left: { kind: 'number', value: 0 }, right: this.parseUnary() };
    }
    if (this.match('operator', '+')) return this.parseUnary();
    return this.parsePrimary();
  }

  private parsePrimary(): WidgetExpressionAst {
    const token = this.peek();
    if (token.kind === 'number') {
      this.consume();
      return { kind: 'number', value: Number(token.text) };
    }
    if (token.kind === 'identifier') {
      this.consume();
      if (token.text === 'true' || token.text === 'false') {
        return { kind: 'boolean', value: token.text === 'true' };
      }
      if (token.text === 'if') {
        this.depth += 1;
        if (this.depth > MAX_DEPTH) this.fail('DEPTH_LIMIT', 'Expressão excede o limite de aninhamento.');
        this.expect('punctuation', '(');
        const condition = this.parseOr();
        this.expect('punctuation', ',');
        const then = this.parseOr();
        this.expect('punctuation', ',');
        const otherwise = this.parseOr();
        this.expect('punctuation', ')');
        this.depth -= 1;
        return { kind: 'if', condition, then, otherwise };
      }
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(token.text)) this.fail('INVALID_METRIC', 'Identificador inválido.');
      return { kind: 'metric', name: token.text };
    }
    if (this.match('punctuation', '(')) {
      const expression = this.parseOr();
      this.expect('punctuation', ')');
      return expression;
    }
    this.fail('EXPECTED_EXPRESSION', 'Esperava número, métrica, condição ou parêntese.');
  }

  private peek(): Token {
    return this.tokens[this.index] ?? { kind: 'eof', text: '', offset: 0 };
  }

  private consume(): Token {
    return this.tokens[this.index++] ?? { kind: 'eof', text: '', offset: 0 };
  }

  private match(kind: TokenKind, text: string): boolean {
    if (this.peek().kind !== kind || this.peek().text !== text) return false;
    this.consume();
    return true;
  }

  private expect(kind: TokenKind, text: string): Token {
    if (!this.match(kind, text)) this.fail('EXPECTED_TOKEN', `Esperava ${text}.`);
    return this.tokens[this.index - 1]!;
  }

  private fail(code: string, message: string): never {
    throw new ParseFailure(code, message);
  }
}

export function parseWidgetExpression(source: string): WidgetExpressionParseResult {
  if (source.length === 0 || source.length > MAX_EXPRESSION_LENGTH) {
    return { ok: false, code: 'INVALID_LENGTH', message: 'Expressão vazia ou acima do limite.' };
  }
  try {
    const ast = new Parser(tokenize(source)).parse();
    return { ok: true, ast, source };
  } catch (error) {
    const failure = error instanceof ParseFailure ? error : new ParseFailure('INVALID_EXPRESSION', 'Expressão inválida.');
    return { ok: false, code: failure.code, message: failure.message };
  }
}

type Evaluated = { value: number | boolean | null; unit: string };

class EvaluationFailure extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

function ensureNumber(value: Evaluated): number {
  if (typeof value.value !== 'number') throw new EvaluationFailure('TYPE_MISMATCH', 'A operação exige números.');
  return value.value;
}

function arithmeticUnit(
  operator: '+' | '-' | '*' | '/',
  left: Evaluated,
  right: Evaluated,
): string {
  if (left.unit === 'scalar') return right.unit;
  if (right.unit === 'scalar') return left.unit;
  if ((operator === '+' || operator === '-') && left.unit === right.unit) return left.unit;
  if (operator === '/' && left.unit === right.unit) return 'ratio';
  if (operator === '*' && left.unit === right.unit) {
    throw new EvaluationFailure('UNIT_MISMATCH', 'Multiplicação entre unidades não é permitida.');
  }
  throw new EvaluationFailure('UNIT_MISMATCH', `Unidades incompatíveis: ${left.unit} e ${right.unit}.`);
}

function evaluateNode(node: WidgetExpressionAst, metrics: Record<string, WidgetMetricValue>): Evaluated {
  if (node.kind === 'number') return { value: node.value, unit: 'scalar' };
  if (node.kind === 'boolean') return { value: node.value, unit: 'boolean' };
  if (node.kind === 'metric') {
    if (!Object.prototype.hasOwnProperty.call(metrics, node.name)) {
      throw new EvaluationFailure('UNKNOWN_METRIC', `Métrica desconhecida: ${node.name}.`);
    }
    const metric = metrics[node.name]!;
    if (metric.value === null) throw new EvaluationFailure('NULL_VALUE', `A métrica ${node.name} não possui valor.`);
    if (metric.denominator === 0) throw new EvaluationFailure('ZERO_DENOMINATOR', 'Denominador zero.');
    return { value: metric.value, unit: metric.unit };
  }
  if (node.kind === 'if') {
    const condition = evaluateNode(node.condition, metrics);
    if (typeof condition.value !== 'boolean') throw new EvaluationFailure('TYPE_MISMATCH', 'A condição deve ser booleana.');
    return evaluateNode(condition.value ? node.then : node.otherwise, metrics);
  }

  if (node.operator === 'and' || node.operator === 'or') {
    const left = evaluateNode(node.left, metrics);
    if (typeof left.value !== 'boolean') throw new EvaluationFailure('TYPE_MISMATCH', 'Operador lógico exige booleanos.');
    if (node.operator === 'and' && !left.value) return { value: false, unit: 'boolean' };
    if (node.operator === 'or' && left.value) return { value: true, unit: 'boolean' };
    const right = evaluateNode(node.right, metrics);
    if (typeof right.value !== 'boolean') throw new EvaluationFailure('TYPE_MISMATCH', 'Operador lógico exige booleanos.');
    return { value: right.value, unit: 'boolean' };
  }

  const left = evaluateNode(node.left, metrics);
  const right = evaluateNode(node.right, metrics);
  if (node.operator === '>' || node.operator === '>=' || node.operator === '<' || node.operator === '<=') {
    const a = ensureNumber(left);
    const b = ensureNumber(right);
    if (left.unit !== right.unit && left.unit !== 'scalar' && right.unit !== 'scalar') {
      throw new EvaluationFailure('UNIT_MISMATCH', 'Comparação entre unidades incompatíveis.');
    }
    const value = node.operator === '>' ? a > b : node.operator === '>=' ? a >= b : node.operator === '<' ? a < b : a <= b;
    return { value, unit: 'boolean' };
  }
  if (node.operator === '==' || node.operator === '!=') {
    const equal = left.unit === right.unit && left.value === right.value;
    return { value: node.operator === '==' ? equal : !equal, unit: 'boolean' };
  }
  const a = ensureNumber(left);
  const b = ensureNumber(right);
  if (node.operator === '/' && b === 0) throw new EvaluationFailure('DIVISION_BY_ZERO', 'Divisão por zero.');
  const value =
    node.operator === '+' ? a + b
      : node.operator === '-' ? a - b
        : node.operator === '*' ? a * b
          : a / b;
  return { value, unit: arithmeticUnit(node.operator, left, right) };
}

export function evaluateWidgetExpression(
  ast: unknown,
  metrics: Record<string, WidgetMetricValue>,
): WidgetExpressionResult {
  if (!ast || typeof ast !== 'object' || !('kind' in ast)) {
    return { ok: false, code: 'INVALID_AST', message: 'Expressão não analisada.' };
  }
  try {
    const result = evaluateNode(ast as WidgetExpressionAst, metrics);
    if (result.value === null || typeof result.value === 'boolean') {
      if (typeof result.value === 'boolean') return { ok: true, value: result.value, unit: result.unit };
      return { ok: false, code: 'UNAVAILABLE', message: 'Sem valor disponível.' };
    }
    return { ok: true, value: result.value, unit: result.unit };
  } catch (error) {
    const failure = error instanceof EvaluationFailure ? error : new EvaluationFailure('EVALUATION_FAILED', 'Falha ao avaliar.');
    return { ok: false, code: failure.code, message: failure.message };
  }
}
