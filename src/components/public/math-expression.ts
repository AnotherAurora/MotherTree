/**
 * Safe arithmetic-expression parsing for calculator inputs.
 *
 * Calculator fields are controlled text inputs that previously accepted only a
 * single non-negative decimal number. They now also accept a small arithmetic
 * expression (e.g. "30+50") that is evaluated when the field is committed
 * (blur or Enter). Evaluation uses a hand-written recursive-descent parser —
 * never `eval`/`new Function` — so it stays safe under a strict CSP.
 */

/** Characters allowed while typing an expression (letters are rejected). */
const EXPRESSION_DRAFT = /^[0-9.+\-*/() ]*$/;

/** Non-negative number: digits with at most one decimal point. Empty allowed. */
const NON_NEGATIVE_NUMERIC = /^(?:\d+(?:\.\d*)?|\.\d*)?$/;

/** Whether a partially-typed draft is allowed to stay in the field. */
export function isValidExpressionDraft(value: string): boolean {
  return EXPRESSION_DRAFT.test(value);
}

/** Whether a committed (canonical) value is a plain non-negative number. */
export function isCanonicalNumericString(value: string): boolean {
  return NON_NEGATIVE_NUMERIC.test(value);
}

function skipSpaces(source: string, index: number): number {
  let i = index;
  while (i < source.length) {
    const c = source[i];
    if (c !== " " && c !== "\t") break;
    i++;
  }
  return i;
}

/**
 * Evaluate an arithmetic expression. Returns null when the input is not a
 * complete, valid expression (syntax error, division by zero, overflow, ...).
 * The empty string evaluates to 0.
 */
export function evaluateExpression(input: string): number | null {
  const source = input;
  if (source.trim() === "") return 0;

  let i = 0;
  const peek = () => source[i];

  function parseNumber(): number | null {
    i = skipSpaces(source, i);
    const start = i;
    while (
      i < source.length &&
      (source[i] === "." || (source[i] >= "0" && source[i] <= "9"))
    ) {
      i++;
    }
    if (i === start) return null;
    const text = source.slice(start, i);
    if ((text.match(/\./g) ?? []).length > 1) return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
  }

  function parseFactor(): number | null {
    i = skipSpaces(source, i);
    const c = peek();
    if (c === "+") {
      i++;
      return parseFactor();
    }
    if (c === "-") {
      i++;
      const v = parseFactor();
      return v === null ? null : -v;
    }
    if (c === "(") {
      i++;
      const v = parseExpr();
      if (v === null) return null;
      i = skipSpaces(source, i);
      if (peek() !== ")") return null;
      i++;
      return v;
    }
    return parseNumber();
  }

  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) return null;
    i = skipSpaces(source, i);
    while (peek() === "*" || peek() === "/") {
      const op = source[i];
      i++;
      const right = parseFactor();
      if (right === null) return null;
      if (op === "/" && right === 0) return null;
      left = op === "*" ? left * right : left / right;
      i = skipSpaces(source, i);
    }
    return left;
  }

  function parseExpr(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    i = skipSpaces(source, i);
    while (peek() === "+" || peek() === "-") {
      const op = source[i];
      i++;
      const right = parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
      i = skipSpaces(source, i);
    }
    return left;
  }

  const value = parseExpr();
  i = skipSpaces(source, i);
  if (value === null || i !== source.length) return null;
  return Number.isFinite(value) ? value : null;
}

/**
 * Canonical display string for a committed result: non-negative, rounded to two
 * decimal places, with trailing zeros trimmed.
 */
export function formatExpressionResult(value: number): string {
  const clamped = value > 0 ? value : 0;
  const rounded = Math.round(clamped * 100) / 100;
  return rounded.toFixed(2).replace(/\.?0+$/, "") || "0";
}
