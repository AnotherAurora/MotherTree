import { ceilRealmMastery } from "@/lib/path-carver/effective-value-scalar";

export type UltraRealmMode = "ultra" | "singularity";

/** RTM 38 — Support.Create.Insight × Realm Mastery. */
export const RTM_INSIGHT_CHANCE_ID = 38;
export const RTM_INSIGHT_CHANCE_RATE = 0.00125;

/** RTM 8 — Defender.STR Down × team Max HP (combo). */
export const RTM_ENEMY_STR_DOWN_ID = 8;
export const RTM_ENEMY_STR_DOWN_RATE = 0.005;

/** RTM 9 — Support.STR Up.Fixed × team Max HP (combo). */
export const RTM_TEAM_STR_UP_ID = 9;
export const RTM_TEAM_STR_UP_RATE = 0.01;

/** RTM 10 — Support.Crit Damage (flat percent, combo). */
export const RTM_ULTRA_AWAKENER_CRIT_DAMAGE_ID = 10;
export const RTM_ULTRA_AWAKENER_CRIT_DAMAGE_SCALAR = 0.1;

/** RTM 49 — Base Singularity Beacon (flat Enhance). */
export const RTM_BASE_SINGULARITY_BEACON_ID = 49;
export const RTM_BASE_SINGULARITY_BEACON_SCALAR = 25;

/** RTM 54 — Singularity Beacon from Realm Mastery. */
export const RTM_SINGULARITY_BEACON_FROM_RM_ID = 54;
export const RTM_SINGULARITY_BEACON_FROM_RM_RATE = 0.0125;

/** RTM 48 — Base Singularity Prism (flat Enhance). */
export const RTM_BASE_SINGULARITY_PRISM_ID = 48;
export const RTM_BASE_SINGULARITY_PRISM_SCALAR = 15;

/** RTM 53 — Singularity Prism from Realm Mastery. */
export const RTM_SINGULARITY_PRISM_FROM_RM_ID = 53;
export const RTM_SINGULARITY_PRISM_FROM_RM_RATE = 0.0075;

export type ComputeUltraRealmCalculatorInput = {
  mode: UltraRealmMode;
  teamMaxHp: number;
  realmMastery: number;
  primordiaChaos: boolean;
  pureRealm: boolean;
  chaosAwakeners: number;
};

export type UltraRealmCalculatorResult = {
  chaosComboStacks: number;
  isPure: boolean;
  insightChance: number;
  enemyStrDown: number;
  teamStrUp: number;
  ultraAwakenerCritDamage: number;
  baseSingularityBeacon: number;
  singularityBeaconFromRm: number;
  totalSingularityBeacon: number;
  baseSingularityPrism: number;
  singularityPrismFromRm: number;
  totalSingularityPrism: number;
};

/** Same flag rules as Aequor / resolveAequorRealmFlags. */
export function resolveUltraRealmFlags(input: {
  primordiaChaos: boolean;
  pureRealm: boolean;
  chaosAwakeners: number;
}): { chaosComboStacks: number; isPure: boolean } {
  if (input.primordiaChaos) {
    return { chaosComboStacks: 0, isPure: false };
  }
  const chaos = Math.min(3, Math.max(0, Math.floor(input.chaosAwakeners)));
  return { chaosComboStacks: chaos, isPure: input.pureRealm };
}

/**
 * RTM 38 — Insight Chance for the public calculator (percent points).
 * Ceil RM first, then `Math.ceil(0.00125 * pureMult * RM * 100)`.
 */
export function computeInsightChance(
  realmMastery: number,
  isPure: boolean,
): number {
  const rm = Math.max(0, ceilRealmMastery(realmMastery));
  const pureMult = isPure ? 2 : 1;
  return Math.ceil(RTM_INSIGHT_CHANCE_RATE * pureMult * rm * 100);
}

/** RTM 8 — Enemy STR Down (per stack before combo multiply). */
export function computeEnemyStrDownBase(teamMaxHp: number): number {
  return Math.ceil(RTM_ENEMY_STR_DOWN_RATE * Math.max(0, teamMaxHp));
}

/** RTM 9 — Team STR Up (per stack before combo multiply). */
export function computeTeamStrUpBase(teamMaxHp: number): number {
  return Math.ceil(RTM_TEAM_STR_UP_RATE * Math.max(0, teamMaxHp));
}

/**
 * RTM 54 — Singularity Beacon from RM.
 * Ceil RM first, then whole-number ceil of `0.0125 * pureMult * RM`.
 */
export function computeSingularityBeaconFromRm(
  realmMastery: number,
  isPure: boolean,
): number {
  const rm = Math.max(0, ceilRealmMastery(realmMastery));
  const pureMult = isPure ? 2 : 1;
  return Math.ceil(RTM_SINGULARITY_BEACON_FROM_RM_RATE * pureMult * rm);
}

/**
 * RTM 53 — Singularity Prism from RM.
 * Ceil RM first, then whole-number ceil of `0.0075 * pureMult * RM`.
 */
export function computeSingularityPrismFromRm(
  realmMastery: number,
  isPure: boolean,
): number {
  const rm = Math.max(0, ceilRealmMastery(realmMastery));
  const pureMult = isPure ? 2 : 1;
  return Math.ceil(RTM_SINGULARITY_PRISM_FROM_RM_RATE * pureMult * rm);
}

/** Public Ultra / Singularity Ultra Realm calculator. */
export function computeUltraRealmCalculator(
  input: ComputeUltraRealmCalculatorInput,
): UltraRealmCalculatorResult {
  const mode: UltraRealmMode =
    input.mode === "singularity" ? "singularity" : "ultra";
  const { chaosComboStacks, isPure } = resolveUltraRealmFlags(input);
  const enemyStrDownBase = computeEnemyStrDownBase(input.teamMaxHp);
  const teamStrUpBase = computeTeamStrUpBase(input.teamMaxHp);

  const combo = {
    chaosComboStacks,
    isPure,
    enemyStrDown: enemyStrDownBase * chaosComboStacks,
    teamStrUp: teamStrUpBase * chaosComboStacks,
    ultraAwakenerCritDamage:
      RTM_ULTRA_AWAKENER_CRIT_DAMAGE_SCALAR * chaosComboStacks,
  };

  if (mode === "singularity") {
    const singularityBeaconFromRm = computeSingularityBeaconFromRm(
      input.realmMastery,
      isPure,
    );
    const singularityPrismFromRm = computeSingularityPrismFromRm(
      input.realmMastery,
      isPure,
    );
    return {
      ...combo,
      insightChance: 0,
      baseSingularityBeacon: RTM_BASE_SINGULARITY_BEACON_SCALAR,
      singularityBeaconFromRm,
      totalSingularityBeacon:
        RTM_BASE_SINGULARITY_BEACON_SCALAR + singularityBeaconFromRm,
      baseSingularityPrism: RTM_BASE_SINGULARITY_PRISM_SCALAR,
      singularityPrismFromRm,
      totalSingularityPrism:
        RTM_BASE_SINGULARITY_PRISM_SCALAR + singularityPrismFromRm,
    };
  }

  return {
    ...combo,
    insightChance: computeInsightChance(input.realmMastery, isPure),
    baseSingularityBeacon: 0,
    singularityBeaconFromRm: 0,
    totalSingularityBeacon: 0,
    baseSingularityPrism: 0,
    singularityPrismFromRm: 0,
    totalSingularityPrism: 0,
  };
}
