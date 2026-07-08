import type { Manifestation } from "@/lib/team-data/types";

export function aggregateTagTotals(
  manifestations: Manifestation[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const m of manifestations) {
    const scalar = m.valueScalar ?? 0;
    if (scalar === 0) continue;
    totals.set(m.tagName, (totals.get(m.tagName) ?? 0) + scalar);
  }
  return totals;
}
