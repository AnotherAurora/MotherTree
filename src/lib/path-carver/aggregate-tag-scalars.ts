import type { Manifestation } from "@/lib/team-data/types";

export function aggregateTagScalarsById(
  manifestations: Manifestation[],
): Map<number, number> {
  const totals = new Map<number, number>();
  for (const m of manifestations) {
    const scalar = m.valueScalar ?? 0;
    if (scalar === 0) continue;
    totals.set(m.tagId, (totals.get(m.tagId) ?? 0) + scalar);
  }
  return totals;
}

export function getScalarForTag(
  totals: Map<number, number>,
  tagId: number,
): number {
  return totals.get(tagId) ?? 0;
}
