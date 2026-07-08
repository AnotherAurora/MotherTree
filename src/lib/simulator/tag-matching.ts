/** True when manifestationTag equals demandTag or is a descendant (prefix.child). */
export function matchesDemandTag(
  manifestationTag: string,
  demandTag: string,
): boolean {
  if (manifestationTag === demandTag) return true;
  return manifestationTag.startsWith(`${demandTag}.`);
}

/**
 * Sum team tag totals that match a demand tag via exact or prefix inheritance.
 */
export function rollupTagValue(
  teamTagTotals: Map<string, number>,
  demandTag: string,
): number {
  let total = 0;
  for (const [tagName, value] of teamTagTotals) {
    if (matchesDemandTag(tagName, demandTag)) {
      total += value;
    }
  }
  return total;
}
