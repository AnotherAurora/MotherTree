import {
  applyInteractionsForTeamData,
  type ScalarMathStep,
} from "@/lib/path-carver/apply-interactions";
import {
  createManifestationApplyContext,
  isManifestationApplied,
  type ManifestationApplyContext,
} from "@/lib/path-carver/manifestation-apply";
import type { Awakener, Manifestation, TeamData } from "@/lib/team-data/types";

export type ReviewTagTotals = {
  totalsByTagId: Map<number, number>;
  steps: ScalarMathStep[];
};

/** Base Layer A sums only (no interactions). */
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

/**
 * Review Tags totals: Layer A filter → Layer B interactions / Special conversions.
 */
export function computeReviewTagTotals(
  teamData: TeamData,
  applyContext: ManifestationApplyContext,
): ReviewTagTotals {
  const applied = teamData.manifestations.filter((m) =>
    isManifestationApplied(m, applyContext),
  );
  const result = applyInteractionsForTeamData(teamData, applied);
  return {
    totalsByTagId: result.totalsByTagId,
    steps: result.steps,
  };
}

export function aggregateTagScalarsForAwakeners(
  manifestations: Manifestation[],
  awakeners: Awakener[],
  damageDealerAwakenerIds: Iterable<number> = [],
): Map<number, number> {
  return aggregateTagScalarsById(
    manifestations,
    createManifestationApplyContext(awakeners, damageDealerAwakenerIds),
  );
}

export function getScalarForTag(
  totals: Map<number, number>,
  tagId: number,
): number {
  return totals.get(tagId) ?? 0;
}
