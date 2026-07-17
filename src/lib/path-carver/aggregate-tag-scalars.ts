import {
  createManifestationApplyContext,
  isManifestationApplied,
  type ManifestationApplyContext,
} from "@/lib/path-carver/manifestation-apply";
import type { Awakener, Manifestation } from "@/lib/team-data/types";

export function aggregateTagScalarsById(
  manifestations: Manifestation[],
  applyContext: ManifestationApplyContext,
): Map<number, number> {
  const totals = new Map<number, number>();
  for (const m of manifestations) {
    if (!isManifestationApplied(m, applyContext)) continue;
    const scalar = m.valueScalar ?? 0;
    if (scalar === 0) continue;
    totals.set(m.tagId, (totals.get(m.tagId) ?? 0) + scalar);
  }
  return totals;
}

export function aggregateTagScalarsForAwakeners(
  manifestations: Manifestation[],
  awakeners: Awakener[],
): Map<number, number> {
  return aggregateTagScalarsById(
    manifestations,
    createManifestationApplyContext(awakeners),
  );
}

export function getScalarForTag(
  totals: Map<number, number>,
  tagId: number,
): number {
  return totals.get(tagId) ?? 0;
}
