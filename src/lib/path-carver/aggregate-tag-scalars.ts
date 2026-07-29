import {
  applyInteractionsForTeamData,
  type ScalarMathStep,
} from "@/lib/path-carver/apply-interactions";
import {
  buildBaseStatTransferManifestations,
  computeAwakenerTotalBaseStats,
} from "@/lib/path-carver/awakener-base-stats";
import {
  DEFENDER_BASE_DEATH_RESIST_TAG_ID,
  DEFENDER_MAX_HP_UP_TAG_ID,
  IN_MISSION_DEATH_RESIST_TAG_ID,
  buildDeathResistDerivedManifestations,
} from "@/lib/path-carver/death-resist-trigger";
import {
  buildAwakenersById,
  effectiveManifestationScalar,
} from "@/lib/path-carver/effective-value-scalar";
import {
  createManifestationApplyContext,
  isManifestationApplied,
  type ManifestationApplyContext,
} from "@/lib/path-carver/manifestation-apply";
import {
  computeTeamMaxHp,
  type TeamMaxHpResult,
} from "@/lib/path-carver/team-max-hp";
import {
  buildTriggerCounts,
  triggerApplyMultiplier,
} from "@/lib/path-carver/trigger-condition";
import type {
  Awakener,
  Manifestation,
  RealmLookupRow,
  Tag,
  TeamData,
} from "@/lib/team-data/types";

export type ReviewTagTotals = {
  totalsByTagId: Map<number, number>;
  steps: ScalarMathStep[];
  /**
   * Team data with total base stats on awakeners and synthetic base-stat
   * transfer manifestations appended (for Review Tags debug / display).
   */
  reviewTeamData: TeamData;
  /** When tag id → apply-times (from Cause totals). */
  triggerCounts: Map<number, number>;
  /** Team Max HP breakdown (baseline + Max HP Up bonus). */
  teamMaxHp: TeamMaxHpResult;
};

/** Clone with value_scalar × multiplier (for N trigger applications). */
export function scaleManifestationByTrigger(
  m: Manifestation,
  multiplier: number,
): Manifestation {
  if (multiplier === 1 || m.valueScalar == null) return m;
  return { ...m, valueScalar: m.valueScalar * multiplier };
}

function sumCauseTotals(
  manifestations: readonly Manifestation[],
  awakenersById: ReadonlyMap<number, Awakener>,
  tagsById: Readonly<Record<number, Tag>>,
): Map<number, number> {
  const totals = new Map<number, number>();
  for (const m of manifestations) {
    const scalar = effectiveManifestationScalar(m, awakenersById, tagsById);
    if (scalar === 0) continue;
    totals.set(m.tagId, (totals.get(m.tagId) ?? 0) + scalar);
  }
  return totals;
}

/** Sum Layer A Max HP Up (tag 130) before interactions — no teamMaxHp context yet. */
function sumMaxHpUpTotal(
  manifestations: readonly Manifestation[],
  awakenersById: ReadonlyMap<number, Awakener>,
  tagsById: Readonly<Record<number, Tag>>,
): number {
  let total = 0;
  for (const m of manifestations) {
    if (m.tagId !== DEFENDER_MAX_HP_UP_TAG_ID) continue;
    total += effectiveManifestationScalar(m, awakenersById, tagsById);
  }
  return total;
}

/** Base Layer A sums only (no interactions). Uses dependency-scaled effective scalars. */
export function aggregateTagScalarsById(
  manifestations: Manifestation[],
  applyContext: ManifestationApplyContext,
  awakeners: readonly Awakener[] = [],
  tagsById: Readonly<Record<number, Tag>> = {},
  teamMaxHp?: number | null,
): Map<number, number> {
  const awakenersById = buildAwakenersById(awakeners);
  const totals = new Map<number, number>();
  for (const m of manifestations) {
    if (!isManifestationApplied(m, applyContext)) continue;
    const mult = triggerApplyMultiplier(m, applyContext.triggerCounts);
    if (mult === 0) continue;
    const scalar =
      effectiveManifestationScalar(m, awakenersById, tagsById, teamMaxHp) *
      mult;
    if (scalar === 0) continue;
    totals.set(m.tagId, (totals.get(m.tagId) ?? 0) + scalar);
  }
  return totals;
}

/**
 * Review Tags totals:
 * Layer A null-trigger → total base stats → transfers + Death Resist Cause +
 * Max HP Up from DR → Cause→When counts → Layer A triggered (×N) →
 * team Max HP → Layer B interactions (with team_max_hp resolved).
 */
export function computeReviewTagTotals(
  teamData: TeamData,
  applyContext: ManifestationApplyContext,
): ReviewTagTotals {
  // Pass 1: null-trigger only (ignore trigger gate — column is null).
  const appliedNullTrigger = teamData.manifestations.filter(
    (m) =>
      !m.isBaseStatTransfer &&
      m.triggerCondition == null &&
      isManifestationApplied(m, applyContext),
  );

  const totalAwakeners = computeAwakenerTotalBaseStats(
    teamData,
    appliedNullTrigger,
  );
  const transfers = buildBaseStatTransferManifestations(
    totalAwakeners,
    teamData.tagsById,
  );

  const awakenersById = buildAwakenersById(totalAwakeners);
  // Full tag 12 Layer A total: ATM/other + base-stat transfers (not awakener column alone).
  let baseDeathResistTotal = 0;
  let directInMissionTotal = 0;
  for (const m of [...appliedNullTrigger, ...transfers]) {
    const scalar = effectiveManifestationScalar(
      m,
      awakenersById,
      teamData.tagsById,
    );
    if (scalar === 0) continue;
    if (m.tagId === DEFENDER_BASE_DEATH_RESIST_TAG_ID) {
      baseDeathResistTotal += scalar;
    } else if (m.tagId === IN_MISSION_DEATH_RESIST_TAG_ID) {
      directInMissionTotal += scalar;
    }
  }
  const derived = buildDeathResistDerivedManifestations(
    baseDeathResistTotal,
    directInMissionTotal,
    teamData.tagsById,
  );
  const allTransfers = [...transfers, ...derived];

  const causeTotals = sumCauseTotals(
    [...appliedNullTrigger, ...allTransfers],
    awakenersById,
    teamData.tagsById,
  );
  const triggerCounts = buildTriggerCounts(causeTotals);
  const applyWithTriggers: ManifestationApplyContext = {
    ...applyContext,
    triggerCounts,
  };

  // Pass 2: triggered rows — same Layer A gates + count > 0, scaled ×N.
  const appliedTriggered: Manifestation[] = [];
  for (const m of teamData.manifestations) {
    if (m.isBaseStatTransfer) continue;
    if (m.triggerCondition == null) continue;
    if (!isManifestationApplied(m, applyWithTriggers)) continue;
    const mult = triggerApplyMultiplier(m, triggerCounts);
    appliedTriggered.push(scaleManifestationByTrigger(m, mult));
  }

  const applied = [
    ...appliedNullTrigger,
    ...allTransfers,
    ...appliedTriggered,
  ];

  // Pre-interaction Max HP Up (includes DR-reduction synthetic + record rows).
  const maxHpUpTotal = sumMaxHpUpTotal(
    applied,
    awakenersById,
    teamData.tagsById,
  );
  const teamMaxHp = computeTeamMaxHp({
    awakeners: totalAwakeners,
    maxHpUpTotal,
  });

  const reviewTeamData: TeamData = {
    ...teamData,
    awakeners: totalAwakeners,
    manifestations: [
      ...teamData.manifestations.filter((m) => !m.isBaseStatTransfer),
      ...allTransfers,
    ],
  };
  reviewTeamData.summary = {
    ...teamData.summary,
    awakenerCount: totalAwakeners.length,
    manifestationCount: reviewTeamData.manifestations.length,
  };

  const result = applyInteractionsForTeamData(
    reviewTeamData,
    applied,
    teamMaxHp.finalMaxHp,
  );
  return {
    totalsByTagId: result.totalsByTagId,
    steps: result.steps,
    reviewTeamData,
    triggerCounts,
    teamMaxHp,
  };
}

export function aggregateTagScalarsForAwakeners(
  manifestations: Manifestation[],
  awakeners: Awakener[],
  damageDealerAwakenerIds: Iterable<number> = [],
  realms: Iterable<RealmLookupRow> = [],
  tagsById: Readonly<Record<number, Tag>> = {},
  teamMaxHp?: number | null,
): Map<number, number> {
  return aggregateTagScalarsById(
    manifestations,
    createManifestationApplyContext(
      awakeners,
      damageDealerAwakenerIds,
      new Map(),
      realms,
    ),
    awakeners,
    tagsById,
    teamMaxHp,
  );
}

export function getScalarForTag(
  totals: Map<number, number>,
  tagId: number,
): number {
  return totals.get(tagId) ?? 0;
}
