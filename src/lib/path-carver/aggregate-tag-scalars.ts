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
  sumTeamRealmMastery,
  type EffectiveScalarOptions,
} from "@/lib/path-carver/effective-value-scalar";
import {
  SPECIAL_INCREASE_POSSE_KEYFLARE_COST_TAG_ID,
  SUPPORT_KEYFLARE_TAG_ID,
  buildKeyflareToPosseManifestation,
  computeKeyflareToPosse,
} from "@/lib/path-carver/keyflare-to-posse";
import {
  SUPPORT_DAMAGE_AMP_TAG_ID,
  buildBaseTentacleDamageManifestation,
  computeBaseTentacleDamage,
  isSupersededBaseTentacleRtm,
  resolveBaseTentacleMode,
} from "@/lib/path-carver/base-tentacle-damage";
import {
  buildKeyflareHarmonyManifestation,
  computeKeyflareHarmonyScalar,
} from "@/lib/path-carver/keyflare-harmony";
import {
  createManifestationApplyContext,
  isManifestationApplied,
  type ManifestationApplyContext,
} from "@/lib/path-carver/manifestation-apply";
import {
  DEFAULT_ACCOUNT_LEVEL,
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
  scalarOpts?: EffectiveScalarOptions,
): Map<number, number> {
  const totals = new Map<number, number>();
  for (const m of manifestations) {
    const scalar = effectiveManifestationScalar(
      m,
      awakenersById,
      tagsById,
      scalarOpts,
    );
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
  scalarOpts?: EffectiveScalarOptions,
): number {
  let total = 0;
  for (const m of manifestations) {
    if (m.tagId !== DEFENDER_MAX_HP_UP_TAG_ID) continue;
    total += effectiveManifestationScalar(
      m,
      awakenersById,
      tagsById,
      scalarOpts,
    );
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
  const scalarOpts: EffectiveScalarOptions = {
    teamMaxHp,
    realmMasteryTotal: sumTeamRealmMastery(awakeners),
    teamRealms: applyContext.teamRealms,
  };
  const totals = new Map<number, number>();
  for (const m of manifestations) {
    if (!isManifestationApplied(m, applyContext)) continue;
    const mult = triggerApplyMultiplier(m, applyContext.triggerCounts);
    if (mult === 0) continue;
    const scalar =
      effectiveManifestationScalar(m, awakenersById, tagsById, scalarOpts) *
      mult;
    if (scalar === 0) continue;
    totals.set(m.tagId, (totals.get(m.tagId) ?? 0) + scalar);
  }
  return totals;
}

/**
 * Review Tags totals:
 * Layer A null-trigger → total base stats → Keyflare Harmony + transfers +
 * Death Resist Cause + Max HP Up from DR → Keyflare→Create.Posse →
 * Cause→When counts → Layer A triggered (×N) → team Max HP →
 * Base Tentacle Damage (aequor/benthos) → Layer B.
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
  const baseTransfers = buildBaseStatTransferManifestations(
    totalAwakeners,
    teamData.tagsById,
  );

  const harmonyBreakdown = computeKeyflareHarmonyScalar(totalAwakeners);
  const harmonySynth = buildKeyflareHarmonyManifestation(
    harmonyBreakdown.valueScalar,
    teamData.tagsById,
  );
  const transfers = [
    ...baseTransfers,
    ...(harmonySynth ? [harmonySynth] : []),
  ];

  const awakenersById = buildAwakenersById(totalAwakeners);
  const earlyScalarOpts: EffectiveScalarOptions = {
    realmMasteryTotal: sumTeamRealmMastery(totalAwakeners),
    teamRealms: applyContext.teamRealms,
  };
  // Full tag 12 Layer A total: ATM/other + base-stat transfers (not awakener column alone).
  let baseDeathResistTotal = 0;
  let directInMissionTotal = 0;
  for (const m of [...appliedNullTrigger, ...transfers]) {
    const scalar = effectiveManifestationScalar(
      m,
      awakenersById,
      teamData.tagsById,
      earlyScalarOpts,
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

  // Keyflare → Create.Posse (non-consuming; before Cause→When).
  // Includes Keyflare Harmony synthetic in transfers.
  let keyflareTotal = 0;
  let posseCostIncrease = 0;
  for (const m of [...appliedNullTrigger, ...transfers, ...derived]) {
    const scalar = effectiveManifestationScalar(
      m,
      awakenersById,
      teamData.tagsById,
      earlyScalarOpts,
    );
    if (scalar === 0) continue;
    if (m.tagId === SUPPORT_KEYFLARE_TAG_ID) keyflareTotal += scalar;
    else if (m.tagId === SPECIAL_INCREASE_POSSE_KEYFLARE_COST_TAG_ID) {
      posseCostIncrease += scalar;
    }
  }
  const keyflareToPosse = computeKeyflareToPosse({
    keyflareTotal,
    costIncrease: posseCostIncrease,
  });
  const keyflarePosseSynth = buildKeyflareToPosseManifestation(
    keyflareToPosse.posseCreated,
    teamData.tagsById,
  );
  const allTransfers = [
    ...transfers,
    ...derived,
    ...(keyflarePosseSynth ? [keyflarePosseSynth] : []),
  ];

  const harmonySteps: ScalarMathStep[] =
    harmonyBreakdown.valueScalar !== 0
      ? [
          {
            kind: "special",
            label: "Keyflare Harmony",
            detail:
              `sum=${harmonyBreakdown.sumKeyflare}` +
              ` avg=${harmonyBreakdown.teamAverage}` +
              ` scalar=${harmonyBreakdown.valueScalar}`,
          },
        ]
      : [];

  const keyflareSteps: ScalarMathStep[] =
    keyflareTotal > 0 ||
    posseCostIncrease > 0 ||
    keyflareToPosse.posseCreated > 0
      ? [
          {
            kind: "special",
            label: "Keyflare → Create.Posse",
            detail:
              `keyflare=${keyflareToPosse.keyflareTotal}` +
              ` costIncrease=${keyflareToPosse.costIncrease}` +
              ` costPerPosse=${keyflareToPosse.costPerPosse}` +
              ` created=${keyflareToPosse.posseCreated}` +
              ` (Keyflare unchanged)`,
          },
        ]
      : [];

  const causeTotals = sumCauseTotals(
    [...appliedNullTrigger, ...allTransfers],
    awakenersById,
    teamData.tagsById,
    earlyScalarOpts,
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

  const appliedBeforeTentacle = [
    ...appliedNullTrigger,
    ...allTransfers,
    ...appliedTriggered,
  ];

  // Pre-interaction Max HP Up (includes DR-reduction synthetic + record rows).
  const maxHpUpTotal = sumMaxHpUpTotal(
    appliedBeforeTentacle,
    awakenersById,
    teamData.tagsById,
    earlyScalarOpts,
  );
  const teamMaxHp = computeTeamMaxHp({
    awakeners: totalAwakeners,
    maxHpUpTotal,
  });

  // Base Tentacle Damage (aequor / benthos) after team Max HP.
  const tentacleMode = resolveBaseTentacleMode(
    applyContext.teamRealms.effectiveRealmIds,
  );
  let tentacleSynth: Manifestation | null = null;
  let tentacleSteps: ScalarMathStep[] = [];
  if (tentacleMode != null) {
    let damageAmpTotal = 0;
    for (const m of [...appliedNullTrigger, ...baseTransfers]) {
      if (m.tagId !== SUPPORT_DAMAGE_AMP_TAG_ID) continue;
      damageAmpTotal += effectiveManifestationScalar(
        m,
        awakenersById,
        teamData.tagsById,
        earlyScalarOpts,
      );
    }
    const tentacleBreakdown = computeBaseTentacleDamage({
      mode: tentacleMode,
      awakeners: totalAwakeners,
      accountLevel: DEFAULT_ACCOUNT_LEVEL,
      teamMaxHp: teamMaxHp.finalMaxHp,
      chaosComboStacks: applyContext.teamRealms.chaosComboStacks,
      damageAmpTotal,
    });
    tentacleSynth = buildBaseTentacleDamageManifestation(
      tentacleBreakdown,
      teamData.tagsById,
    );
    if (tentacleSynth != null) {
      tentacleSteps = [
        {
          kind: "special",
          label: "Base Tentacle Damage",
          detail:
            `mode=${tentacleBreakdown.mode}` +
            ` rawAtk=${tentacleBreakdown.rawAtk}` +
            ` hpShare=${tentacleBreakdown.hpShare}` +
            ` chaosShare=${tentacleBreakdown.chaosShare}` +
            ` hpTerm=${tentacleBreakdown.hpTerm}` +
            ` base=${tentacleBreakdown.baseAmount}` +
            ` amp=${tentacleBreakdown.damageAmpTotal}` +
            ` scalar=${tentacleBreakdown.valueScalar}`,
        },
      ];
    }
  }

  const applied = [
    ...(tentacleSynth != null
      ? appliedBeforeTentacle.filter((m) => !isSupersededBaseTentacleRtm(m))
      : appliedBeforeTentacle),
    ...(tentacleSynth ? [tentacleSynth] : []),
  ];

  const reviewTransfers = [
    ...allTransfers,
    ...(tentacleSynth ? [tentacleSynth] : []),
  ];
  const reviewTeamData: TeamData = {
    ...teamData,
    awakeners: totalAwakeners,
    manifestations: [
      ...teamData.manifestations.filter(
        (m) =>
          !m.isBaseStatTransfer &&
          !(tentacleSynth != null && isSupersededBaseTentacleRtm(m)),
      ),
      ...reviewTransfers,
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
    applyContext.teamRealms,
  );
  return {
    totalsByTagId: result.totalsByTagId,
    steps: [
      ...harmonySteps,
      ...keyflareSteps,
      ...tentacleSteps,
      ...result.steps,
    ],
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
