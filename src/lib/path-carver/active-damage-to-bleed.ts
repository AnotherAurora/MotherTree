import {
  sumOwnerActiveDamagePool,
  sumTagAcrossOwners,
} from "@/lib/path-carver/birth-ritual-sacrifice";
import type { Tag } from "@/lib/team-data/types";

/** Special.Active Damage to Bleed */
export const SPECIAL_ACTIVE_DAMAGE_TO_BLEED_TAG_ID = 181;

/** Attacker.Non-Active Damage.Bleed Damage */
export const ATTACKER_NON_ACTIVE_DAMAGE_BLEED_DAMAGE_TAG_ID = 158;

/** Tag ids that must be present in TeamData.tagsById for this conversion. */
export const REQUIRED_ACTIVE_DAMAGE_TO_BLEED_TAG_IDS: readonly number[] = [
  SPECIAL_ACTIVE_DAMAGE_TO_BLEED_TAG_ID,
  ATTACKER_NON_ACTIVE_DAMAGE_BLEED_DAMAGE_TAG_ID,
];

const ACTIVE_DAMAGE_TO_BLEED_LABEL =
  "Special.Active Damage to Bleed → Bleed Damage";

export type ActiveDamageToBleedStep = {
  kind: "special";
  label: string;
  detail: string;
};

type OwnerKey = string;
type OwnerTotals = Map<OwnerKey, Map<number, number>>;

export type ActiveDamageToBleedScope = {
  /** Effective tag-181 rate (fraction; 0.3 = 30%). */
  rate: number;
  /** Finalized Active Damage pool (prefix + descendants; no Tentacle). */
  pool: number;
  /** ceil(pool × rate). */
  conversion: number;
};

export type ActiveDamageToBleedResult = {
  /** aoe / single / null tag-181 rows → all-owner Active Damage pool. */
  team: ActiveDamageToBleedScope;
  /** owner key → that owner's target_type=self conversion scope. */
  selfByOwner: Map<OwnerKey, ActiveDamageToBleedScope>;
};

/**
 * Team-wide finalized Active Damage family total across all owners.
 * Active Damage prefix + descendants only — Attacker.Tentacle excluded.
 */
export function sumActiveDamagePool(
  ownerValues: OwnerTotals,
  tagsById: Readonly<Record<number, Tag>>,
): number {
  let pool = 0;
  for (const owner of ownerValues.keys()) {
    pool += sumOwnerActiveDamagePool(ownerValues, owner, tagsById);
  }
  return pool;
}

/** Fraction of the Active Damage pool converted to Bleed Damage (round up). */
export function computeBleedDamageAmount(rate: number, pool: number): number {
  if (rate <= 0 || pool <= 0) return 0;
  return Math.ceil(pool * rate - 1e-9);
}

/**
 * Strip float noise from reconciled tag-181 rates (e.g. 0.3 − 0.2) so the
 * ceil in {@link computeBleedDamageAmount} does not round up spuriously.
 */
function normalizeRate(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

export type ApplyActiveDamageToBleedInput = {
  ownerValues: OwnerTotals;
  /**
   * target_type=self tag-181 contributions keyed by owner (awakener:N),
   * accumulated at the Layer B subject merge. Rows not in this map
   * (aoe / single / null / posse / realm) are treated as team scope.
   */
  selfByOwner: ReadonlyMap<OwnerKey, number>;
  tagsById: Readonly<Record<number, Tag>>;
};

/**
 * Special.Active Damage to Bleed conversion (compute-only).
 *
 * Scope follows target_type:
 * - team: aoe / single / null rows (and posse / realm, which have no single
 *   owning awakener) → all owners' Active Damage → returned as `team`.
 * - self: each awakener's target_type=self rows → that owner's OWN Active
 *   Damage only → returned in `selfByOwner`.
 *
 * Scopes are additive (stacking): an awakener carrying self conversion keeps
 * their damage in the team pool too. The damage pools are never partitioned by
 * target_type — only the tag-181 totals are.
 *
 * Does not mutate ownerValues; the caller writes Bleed Damage synthetics and
 * applies the trigger amplify.
 */
export function applyActiveDamageToBleedConversion(
  input: ApplyActiveDamageToBleedInput,
): { result: ActiveDamageToBleedResult; steps: ActiveDamageToBleedStep[] } {
  const { ownerValues, selfByOwner, tagsById } = input;
  const steps: ActiveDamageToBleedStep[] = [];

  // Reconcile team total: merged tag-181 across all owners minus recorded self
  // rows. Anything not a recorded self row (aoe/single/null/posse/realm) lands
  // in team scope — this also keeps the split in sync with the merged total.
  const mergedTotal = sumTagAcrossOwners(
    ownerValues,
    SPECIAL_ACTIVE_DAMAGE_TO_BLEED_TAG_ID,
  );
  const recordedSelf = new Map<OwnerKey, number>();
  let selfTotal = 0;
  for (const [owner, value] of selfByOwner) {
    if (value <= 0) continue;
    recordedSelf.set(owner, value);
    selfTotal += value;
  }
  const teamRate = Math.max(0, normalizeRate(mergedTotal - selfTotal));

  const teamPool = sumActiveDamagePool(ownerValues, tagsById);
  const teamConversion = computeBleedDamageAmount(teamRate, teamPool);
  if (teamRate > 0) {
    steps.push({
      kind: "special",
      label: ACTIVE_DAMAGE_TO_BLEED_LABEL,
      detail:
        `scope=team rate=${teamRate} damagePool=${teamPool}` +
        ` bleedDamage=${teamConversion}`,
    });
  }

  const selfResult = new Map<OwnerKey, ActiveDamageToBleedScope>();
  for (const [owner, rate] of recordedSelf) {
    const pool = sumOwnerActiveDamagePool(ownerValues, owner, tagsById);
    const conversion = computeBleedDamageAmount(rate, pool);
    selfResult.set(owner, { rate, pool, conversion });
    if (conversion > 0) {
      steps.push({
        kind: "special",
        label: ACTIVE_DAMAGE_TO_BLEED_LABEL,
        detail:
          `scope=self owner=${owner} rate=${rate} damagePool=${pool}` +
          ` bleedDamage=${conversion}`,
      });
    }
  }

  return {
    result: {
      team: { rate: teamRate, pool: teamPool, conversion: teamConversion },
      selfByOwner: selfResult,
    },
    steps,
  };
}
