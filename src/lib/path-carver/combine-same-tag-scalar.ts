/**
 * Combine same-tag scalars per tag.is_additive.
 * Used for Layer A seed, in-pass modifier collapse, and post-pass subject merge.
 * Additive: sum. Multiplicative: product; percent uses (1+v) fold-back then −1.
 */
export function combineSameTagScalar(
  current: number | undefined,
  incoming: number,
  isAdditive: boolean,
  isPercent: boolean,
): number {
  if (current === undefined) return incoming;
  if (isAdditive) return current + incoming;

  let raw: number;
  if (isPercent) {
    raw = (1 + current) * (1 + incoming) - 1;
    return Math.ceil(raw * 100) / 100;
  }
  raw = current * incoming;
  return Math.ceil(raw);
}

function formatPart(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const fixed = value.toFixed(4).replace(/\.?0+$/, "");
  return fixed === "-0" ? "0" : fixed;
}

/**
 * Debug formula for folding 2+ same-tag contributions.
 * Returns null when there is nothing to merge (< 2 parts).
 */
export function formatSameTagScalarMerge(
  parts: readonly number[],
  isAdditive: boolean,
  isPercent: boolean,
): { total: number; detail: string } | null {
  if (parts.length < 2) return null;

  let total = parts[0]!;
  for (let i = 1; i < parts.length; i++) {
    total = combineSameTagScalar(total, parts[i]!, isAdditive, isPercent);
  }

  let expression: string;
  if (isAdditive) {
    expression = parts.map(formatPart).join(" + ");
  } else if (isPercent) {
    expression = parts.map((p) => `(1+${formatPart(p)})`).join("×") + "−1";
  } else {
    expression = parts.map(formatPart).join(" × ");
  }

  return {
    total,
    detail: `${expression} = ${formatPart(total)}`,
  };
}
