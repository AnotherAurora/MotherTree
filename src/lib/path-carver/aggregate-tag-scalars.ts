import {
  applyInteractionsForTeamData,
  type ScalarMathStep,
} from "@/lib/path-carver/apply-interactions";
import {
  buildAwakenersById,
  effectiveManifestationScalar,
} from "@/lib/path-carver/effective-value-scalar";
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

/** Base Layer A sums only (no interactions). Uses dependency-scaled effective scalars. */
export function aggregateTagScalarsById(
  manifestations: Manifestation[],
  applyContext: ManifestationApplyContext,
  awakeners: readonly Awakener[] = [],
): Map<number, number> {
  const awakenersById = buildAwakenersById(awakeners);
  const totals = new Map<number, number>();
  for (const m of manifestations) {
    if (!isManifestationApplied(m, applyContext)) continue;
    const scalar = effectiveManifestationScalar(m, awakenersById);
    if (scalar === 0) continue;
    totals.set(m.tagId, (totals.get(m.tagId) ?? 0) + scalar);
  }
  return totals;
}

/**
 * Review Tags totals: Layer A filter → Layer B interactions / Special conversions
 * (with Phase 2b dependency_stat scaling + leaf-gated buff restriction).
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
    awakeners,
  );
}

export function getScalarForTag(
  totals: Map<number, number>,
  tagId: number,
): number {
  return totals.get(tagId) ?? 0;
}
