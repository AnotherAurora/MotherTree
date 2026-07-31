import { TEAM_SLOT_COUNT } from "@/lib/path-carver/keyflare-harmony";
import { oceanDamageMultiplierForLevel } from "@/lib/path-carver/ocean-damage-multipliers";
import { DEFAULT_ACCOUNT_LEVEL } from "@/lib/path-carver/team-max-hp";
import {
  AEQUOR_REALM_ID,
  BENTHOS_AEQUOR_REALM_ID,
} from "@/lib/team-data/realm";
import type {
  Awakener,
  Manifestation,
  Tag,
} from "@/lib/team-data/types";

/** Support.Tentacle Damage Up */
export const SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID = 29;

/** Support.Damage AMP */
export const SUPPORT_DAMAGE_AMP_TAG_ID = 16;

/** Aequor RTM: Fixed HP×chaos — absorbed into synthetic. */
export const REALM_TAG_MANIFESTATION_AEQUOR_FIXED_HP_ID = 5;

/** Benthos RTM: placeholder 5% HP on tag 29 — absorbed into synthetic. */
export const REALM_TAG_MANIFESTATION_BENTHOS_BASE_TDU_ID = 30;

/** RTM rows suppressed while base-tentacle synthetic is active. */
export const BASE_TENTACLE_SUPERSEDED_RTM_IDS: ReadonlySet<number> = new Set([
  REALM_TAG_MANIFESTATION_AEQUOR_FIXED_HP_ID,
  REALM_TAG_MANIFESTATION_BENTHOS_BASE_TDU_ID,
]);

export const REQUIRED_BASE_TENTACLE_TAG_IDS: readonly number[] = [
  SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID,
  SUPPORT_DAMAGE_AMP_TAG_ID,
];

/** Fraction of team Max HP for Benthos first share (RTM 30). */
export const BENTHOS_HP_SHARE_RATE = 0.05;

/** Fraction of team Max HP per chaos awakener (RTM 5 rate). */
export const CHAOS_HP_SHARE_RATE = 0.01;

/** Normal Aequor: avgAtk × Ocean × this factor. */
export const OCEAN_ATK_FACTOR = 0.2;

/** Offset distinct from Keyflare Harmony (3e6). */
const DERIVED_ID_OFFSET = 4_000_000;

export type BaseTentacleMode = "aequor" | "benthos";

export type BaseTentacleDamageBreakdown = {
  mode: BaseTentacleMode;
  realmId: number;
  sumAtk: number;
  avgAtk: number;
  ocean: number;
  rawAtk: number;
  hpShare: number;
  chaosShare: number;
  hpTerm: number;
  baseAmount: number;
  damageAmpTotal: number;
  valueScalar: number;
};

/**
 * Stable negative id for Base Tentacle Damage Support.Tentacle Damage Up synthetic.
 */
export function baseTentacleDamageManifestationId(): number {
  return -(DERIVED_ID_OFFSET + SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID);
}

/** Prefer benthos when both could appear; else aequor; else null. */
export function resolveBaseTentacleMode(
  effectiveRealmIds: ReadonlySet<number>,
): BaseTentacleMode | null {
  if (effectiveRealmIds.has(BENTHOS_AEQUOR_REALM_ID)) return "benthos";
  if (effectiveRealmIds.has(AEQUOR_REALM_ID)) return "aequor";
  return null;
}

export function realmIdForBaseTentacleMode(mode: BaseTentacleMode): number {
  return mode === "benthos" ? BENTHOS_AEQUOR_REALM_ID : AEQUOR_REALM_ID;
}

/**
 * Per-awakener ceil(atk × (1 + atk_per/100)), then average over 4 slots.
 */
export function computeTeamAverageAtk(
  awakeners: readonly Pick<Awakener, "atk">[],
  atkPer = 0,
): { sumAtk: number; avgAtk: number } {
  let sumAtk = 0;
  for (const a of awakeners) {
    const atk = a.atk ?? 0;
    sumAtk += Math.ceil(atk * (1 + atkPer / 100));
  }
  return { sumAtk, avgAtk: sumAtk / TEAM_SLOT_COUNT };
}

export type ComputeBaseTentacleDamageInput = {
  mode: BaseTentacleMode;
  awakeners: readonly Pick<Awakener, "atk">[];
  teamMaxHp: number;
  chaosComboStacks: number;
  damageAmpTotal: number;
  accountLevel?: number;
  atkPer?: number;
};

/**
 * Normal Aequor: rawAtk + ceil(HP×0.01)×chaos, then AMP.
 * Benthos: ceil(HP×(0.05+0.01×chaos)), then AMP.
 */
export function computeBaseTentacleDamage(
  input: ComputeBaseTentacleDamageInput,
): BaseTentacleDamageBreakdown {
  const accountLevel = input.accountLevel ?? DEFAULT_ACCOUNT_LEVEL;
  const atkPer = input.atkPer ?? 0;
  const chaos = Math.max(0, input.chaosComboStacks);
  const hp = input.teamMaxHp;
  const amp = input.damageAmpTotal;
  const realmId = realmIdForBaseTentacleMode(input.mode);

  let sumAtk = 0;
  let avgAtk = 0;
  let ocean = 0;
  let rawAtk = 0;
  let hpShare = 0;
  let chaosShare = 0;
  let hpTerm = 0;
  let baseAmount = 0;

  if (input.mode === "aequor") {
    const atk = computeTeamAverageAtk(input.awakeners, atkPer);
    sumAtk = atk.sumAtk;
    avgAtk = atk.avgAtk;
    ocean = oceanDamageMultiplierForLevel(accountLevel);
    rawAtk = Math.ceil(avgAtk * ocean * OCEAN_ATK_FACTOR);
    hpTerm = Math.ceil(hp * CHAOS_HP_SHARE_RATE) * chaos;
    chaosShare = hpTerm;
    baseAmount = rawAtk + hpTerm;
  } else {
    hpShare = hp * BENTHOS_HP_SHARE_RATE;
    chaosShare = hp * CHAOS_HP_SHARE_RATE * chaos;
    baseAmount = Math.ceil(hpShare + chaosShare);
  }

  const valueScalar = Math.ceil(baseAmount * (1 + amp));

  return {
    mode: input.mode,
    realmId,
    sumAtk,
    avgAtk,
    ocean,
    rawAtk,
    hpShare,
    chaosShare,
    hpTerm,
    baseAmount,
    damageAmpTotal: amp,
    valueScalar,
  };
}

/**
 * Realm synthetic Support.Tentacle Damage Up (interaction-immune as subject).
 */
export function buildBaseTentacleDamageManifestation(
  breakdown: BaseTentacleDamageBreakdown,
  tagsById: Readonly<Record<number, Tag>>,
): Manifestation | null {
  if (breakdown.valueScalar === 0) return null;
  const tag = tagsById[SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID];
  return {
    id: baseTentacleDamageManifestationId(),
    sourceKind: "realm",
    awakenerId: null,
    slotIndex: null,
    sourceName: "Base Tentacle Damage",
    tagId: SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID,
    tagName: tag?.tagName ?? "Support.Tentacle Damage Up",
    triggerCondition: null,
    valueScalar: breakdown.valueScalar,
    baseHits: null,
    dependencyStat: null,
    sourceType: null,
    targetType: null,
    buffTargetTypeRestriction: null,
    metadata: null,
    isAccumulating: false,
    requiredEnlightenment: null,
    requiredAwakenerId: null,
    requiredAwakenerName: null,
    requiredRealm: null,
    requiredRealm2: null,
    requiredRealmId: null,
    requiredRealmId2: null,
    replacesManifestationId: null,
    interactionOverrides: [],
    isBaseStatTransfer: false,
    isCreatedBase: false,
    realmId: breakdown.realmId,
    requiredRealmMode: "present",
    dependencyRate: null,
    dependencyRateStat: null,
    pureBonusTarget: "none",
  };
}

export function isSupersededBaseTentacleRtm(m: Manifestation): boolean {
  return (
    m.sourceKind === "realm" && BASE_TENTACLE_SUPERSEDED_RTM_IDS.has(m.id)
  );
}
