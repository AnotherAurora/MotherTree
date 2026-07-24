import {
  applyInteractionsForTeamData,
  type ScalarMathStep,
} from "@/lib/path-carver/apply-interactions";
import {
  buildBaseStatTransferManifestations,
  computeAwakenerTotalBaseStats,
} from "@/lib/path-carver/awakener-base-stats";
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
  /**
   * Team data with total base stats on awakeners and synthetic base-stat
   * transfer manifestations appended (for Review Tags debug / display).
   */
  reviewTeamData: TeamData;
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
 * Review Tags totals:
 * Layer A filter → total base stats (gear + DR + Special.Increase) →
 * inject base-stat transfer tags → Layer B interactions (transfers immune as subjects).
 */
export function computeReviewTagTotals(
  teamData: TeamData,
  applyContext: ManifestationApplyContext,
): ReviewTagTotals {
  const appliedReal = teamData.manifestations.filter(
    (m) =>
      !m.isBaseStatTransfer && isManifestationApplied(m, applyContext),
  );

  const totalAwakeners = computeAwakenerTotalBaseStats(
    teamData,
    appliedReal,
  );
  const transfers = buildBaseStatTransferManifestations(
    totalAwakeners,
    teamData.tagsById,
  );

  const reviewTeamData: TeamData = {
    ...teamData,
    awakeners: totalAwakeners,
    manifestations: [
      ...teamData.manifestations.filter((m) => !m.isBaseStatTransfer),
      ...transfers,
    ],
  };
  reviewTeamData.summary = {
    ...teamData.summary,
    awakenerCount: totalAwakeners.length,
    manifestationCount: reviewTeamData.manifestations.length,
  };

  const applied = [...appliedReal, ...transfers];
  const result = applyInteractionsForTeamData(reviewTeamData, applied);
  return {
    totalsByTagId: result.totalsByTagId,
    steps: result.steps,
    reviewTeamData,
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
