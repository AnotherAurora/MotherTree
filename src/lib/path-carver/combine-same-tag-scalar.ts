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
