/** Special.Cause.Lemurian — one per Lemurian awakener on team (Layer A marker). */
export const SPECIAL_CAUSE_LEMURIAN_TAG_ID = 171;

/** Special.When.Lemurian Synergy 1 — exactly 1 other Lemurian on team. */
export const SPECIAL_WHEN_LEMURIAN_SYNERGY_1_TAG_ID = 172;

/** Special.When.Lemurian Synergy 2 — exactly 2 other Lemurians on team. */
export const SPECIAL_WHEN_LEMURIAN_SYNERGY_2_TAG_ID = 173;

/** Special.When.Lemurian Synergy 3 — 3+ other Lemurians on team (cap). */
export const SPECIAL_WHEN_LEMURIAN_SYNERGY_3_TAG_ID = 174;

export type LemurianSynergyTier = 0 | 1 | 2 | 3;

export type LemurianSynergyBreakdown = {
  lemurianCount: number;
  others: number;
  tier: LemurianSynergyTier;
};

/**
 * Tier from team Lemurian headcount (Cause marker sum).
 * `others = max(0, count - 1)`; tier = min(others, 3).
 */
export function computeLemurianSynergyBreakdown(
  lemurianCount: number,
): LemurianSynergyBreakdown {
  const count = Math.max(0, Math.floor(lemurianCount));
  const others = Math.max(0, count - 1);
  const tier = Math.min(others, 3) as LemurianSynergyTier;
  return { lemurianCount: count, others, tier };
}

export function computeLemurianSynergyTier(
  lemurianCount: number,
): LemurianSynergyTier {
  return computeLemurianSynergyBreakdown(lemurianCount).tier;
}

/**
 * Set exactly one tier When gate to 1 (not in CAUSE_TO_WHEN — tier lookup, not linear ×N).
 * Mutates `counts` in place.
 */
export function mergeLemurianSynergyTriggerCounts(
  counts: Map<number, number>,
  lemurianCount: number,
): LemurianSynergyBreakdown {
  const breakdown = computeLemurianSynergyBreakdown(lemurianCount);
  counts.delete(SPECIAL_WHEN_LEMURIAN_SYNERGY_1_TAG_ID);
  counts.delete(SPECIAL_WHEN_LEMURIAN_SYNERGY_2_TAG_ID);
  counts.delete(SPECIAL_WHEN_LEMURIAN_SYNERGY_3_TAG_ID);

  if (breakdown.tier === 1) {
    counts.set(SPECIAL_WHEN_LEMURIAN_SYNERGY_1_TAG_ID, 1);
  } else if (breakdown.tier === 2) {
    counts.set(SPECIAL_WHEN_LEMURIAN_SYNERGY_2_TAG_ID, 1);
  } else if (breakdown.tier === 3) {
    counts.set(SPECIAL_WHEN_LEMURIAN_SYNERGY_3_TAG_ID, 1);
  }

  return breakdown;
}
