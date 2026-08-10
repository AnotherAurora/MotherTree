import { ceilRealmMastery } from "@/lib/path-carver/effective-value-scalar";

/** RTM 11 — Support.Base Embryo Fusion Regen (full-HP base; ×(1+L)). */
export const RTM_BASE_EMBRYO_FUSION_REGEN_ID = 11;
export const RTM_BASE_EMBRYO_FUSION_REGEN_SCALAR = 30;

/** RTM 14 — Support.Crimson Furnace × team Max HP (turn start). */
export const RTM_BASE_CRIMSON_FURNACE_REGEN_ID = 14;
export const RTM_BASE_CRIMSON_FURNACE_REGEN_RATE = 0.03;

/** RTM 15 — Support.Crimson Furnace × team Max HP (battle end / embryo card). */
export const RTM_BATTLE_END_CRIMSON_FURNACE_GAIN_ID = 15;
export const RTM_BATTLE_END_CRIMSON_FURNACE_GAIN_RATE = 0.05;

/** RTM 12 — Defender.Shield × team Max HP (first Devour; ×(1+L)). */
export const RTM_BASE_DEVOUR_SHIELD_ID = 12;
export const RTM_BASE_DEVOUR_SHIELD_RATE = 0.04;

/** RTM 39 — Defender.Shield from Realm Mastery (first Devour; ×(1+L)). */
export const RTM_DEVOUR_SHIELD_FROM_RM_ID = 39;
export const RTM_DEVOUR_SHIELD_FROM_RM_RATE = 0.0001;

/** RTM 13 — Support.STR Up × team Max HP (first Devour; ×(1+L)). */
export const RTM_BASE_DEVOUR_STR_ID = 13;
export const RTM_BASE_DEVOUR_STR_RATE = 0.02;

/** RTM 40 — Support.STR Up from Realm Mastery (first Devour; ×(1+L)). */
export const RTM_DEVOUR_STR_FROM_RM_ID = 40;
export const RTM_DEVOUR_STR_FROM_RM_RATE = 0.00005;

/** RTM 20 — Propagation Base Embryo Fusion Regen (full-HP base; ×(1+L)). */
export const RTM_PROP_BASE_EMBRYO_FUSION_REGEN_ID = 20;
export const RTM_PROP_BASE_EMBRYO_FUSION_REGEN_SCALAR = 50;

/** RTM 21 — Propagation Crimson Furnace = 10% of missing HP. */
export const RTM_PROP_BASE_CRIMSON_FURNACE_REGEN_ID = 21;
export const RTM_PROP_BASE_CRIMSON_FURNACE_REGEN_RATE = 0.1;

/** RTM 19 — Base Propagation Fiesta (flat). */
export const RTM_BASE_PROPAGATION_FIESTA_ID = 19;
export const RTM_BASE_PROPAGATION_FIESTA_SCALAR = 20;

/** RTM 51 — Propagation Fiesta × Realm Mastery (Pure doubles value_scalar). */
export const RTM_PROPAGATION_FIESTA_FROM_RM_ID = 51;
export const RTM_PROPAGATION_FIESTA_FROM_RM_RATE = 0.01;

/** RTM 22 — Base Propagule Embryo's Propagation Fiesta (flat). */
export const RTM_BASE_PROPAGULE_FIESTA_ID = 22;
export const RTM_BASE_PROPAGULE_FIESTA_SCALAR = 40;

/** RTM 52 — Propagule Fiesta × Realm Mastery (Pure doubles value_scalar). */
export const RTM_PROPAGULE_FIESTA_FROM_RM_ID = 52;
export const RTM_PROPAGULE_FIESTA_FROM_RM_RATE = 0.02;

export type CaroRealmMode = "caro" | "propagation";

export type ComputeCaroRealmCalculatorInput = {
  mode?: CaroRealmMode;
  teamMaxHp: number;
  currentHp: number;
  realmMastery: number;
  primordiaChaos: boolean;
  pureRealm: boolean;
};

export type CaroRealmCalculatorResult = {
  mode: CaroRealmMode;
  isPure: boolean;
  missingHpFraction: number;
  baseEmbryoFusionRegen: number;
  baseCrimsonFurnaceRegen: number;
  battleEndCrimsonFurnaceGain: number;
  baseShield: number;
  shieldFromRm: number;
  totalShield: number;
  baseStr: number;
  strFromRm: number;
  totalStr: number;
  basePropagationFiesta: number;
  propagationFiestaFromRm: number;
  totalPropagationFiesta: number;
  basePropaguleFiesta: number;
  propaguleFiestaFromRm: number;
  totalPropaguleFiesta: number;
};

/**
 * L = (MaxHP − HP) / MaxHP, clamped to [0, 1]. MaxHP ≤ 0 → 0.
 */
export function missingHpFraction(
  teamMaxHp: number,
  currentHp: number,
): number {
  const maxHp = Number.isFinite(teamMaxHp) ? teamMaxHp : 0;
  if (maxHp <= 0) return 0;
  const hp = Number.isFinite(currentHp) ? currentHp : 0;
  const clampedHp = Math.min(Math.max(0, hp), maxHp);
  return Math.min(1, Math.max(0, (maxHp - clampedHp) / maxHp));
}

export function resolveCaroRealmFlags(input: {
  primordiaChaos: boolean;
  pureRealm: boolean;
}): { isPure: boolean } {
  if (input.primordiaChaos) {
    return { isPure: false };
  }
  return { isPure: input.pureRealm };
}

/** Clamp current HP so it cannot exceed Team Max HP (or go below 0). */
export function clampCurrentHp(teamMaxHp: number, currentHp: number): number {
  const maxHp = Math.max(0, Number.isFinite(teamMaxHp) ? teamMaxHp : 0);
  const hp = Number.isFinite(currentHp) ? currentHp : 0;
  return Math.min(Math.max(0, hp), maxHp);
}

/** RTM 11 — ceil after missing-HP multiplier. */
export function computeBaseEmbryoFusionRegen(missingFraction: number): number {
  const L = Math.min(1, Math.max(0, missingFraction));
  return Math.ceil(RTM_BASE_EMBRYO_FUSION_REGEN_SCALAR * (1 + L));
}

/** RTM 20 — ceil after missing-HP multiplier. */
export function computePropagationEmbryoFusionRegen(
  missingFraction: number,
): number {
  const L = Math.min(1, Math.max(0, missingFraction));
  return Math.ceil(RTM_PROP_BASE_EMBRYO_FUSION_REGEN_SCALAR * (1 + L));
}

/** RTM 14 — Pure doubles value_scalar. */
export function computeBaseCrimsonFurnaceRegen(
  teamMaxHp: number,
  isPure: boolean,
): number {
  const rateMult = isPure ? 2 : 1;
  return Math.ceil(
    RTM_BASE_CRIMSON_FURNACE_REGEN_RATE * Math.max(0, teamMaxHp) * rateMult,
  );
}

/**
 * RTM 21 — 10% of missing HP (not ×(1+L)); Pure does not apply.
 */
export function computePropagationCrimsonFurnaceRegen(
  teamMaxHp: number,
  currentHp: number,
): number {
  const maxHp = Math.max(0, teamMaxHp);
  const hp = clampCurrentHp(maxHp, currentHp);
  return Math.ceil(RTM_PROP_BASE_CRIMSON_FURNACE_REGEN_RATE * (maxHp - hp));
}

/** RTM 15 */
export function computeBattleEndCrimsonFurnaceGain(teamMaxHp: number): number {
  return Math.ceil(
    RTM_BATTLE_END_CRIMSON_FURNACE_GAIN_RATE * Math.max(0, teamMaxHp),
  );
}

/** Round to 1 decimal for First Devour base / RM display rows. */
export function roundTo1Decimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/** RTM 12 — 1 decimal; Total ceils the sum. */
export function computeBaseDevourShield(
  teamMaxHp: number,
  missingFraction: number,
): number {
  const L = Math.min(1, Math.max(0, missingFraction));
  return roundTo1Decimal(
    RTM_BASE_DEVOUR_SHIELD_RATE * Math.max(0, teamMaxHp) * (1 + L),
  );
}

/** RTM 39 — Pure doubles dependency_rate; RM is ceiled first. */
export function computeDevourShieldFromRm(
  teamMaxHp: number,
  realmMastery: number,
  missingFraction: number,
  isPure: boolean,
): number {
  const rateMult = isPure ? 2 : 1;
  const L = Math.min(1, Math.max(0, missingFraction));
  const hp = Math.max(0, teamMaxHp);
  const rm = Math.max(0, ceilRealmMastery(realmMastery));
  return roundTo1Decimal(
    RTM_DEVOUR_SHIELD_FROM_RM_RATE * rm * hp * (1 + L) * rateMult,
  );
}

/** RTM 13 — 1 decimal; Total ceils the sum. */
export function computeBaseDevourStr(
  teamMaxHp: number,
  missingFraction: number,
): number {
  const L = Math.min(1, Math.max(0, missingFraction));
  return roundTo1Decimal(
    RTM_BASE_DEVOUR_STR_RATE * Math.max(0, teamMaxHp) * (1 + L),
  );
}

/** RTM 40 — Pure doubles dependency_rate; RM is ceiled first. */
export function computeDevourStrFromRm(
  teamMaxHp: number,
  realmMastery: number,
  missingFraction: number,
  isPure: boolean,
): number {
  const rateMult = isPure ? 2 : 1;
  const L = Math.min(1, Math.max(0, missingFraction));
  const hp = Math.max(0, teamMaxHp);
  const rm = Math.max(0, ceilRealmMastery(realmMastery));
  return roundTo1Decimal(
    RTM_DEVOUR_STR_FROM_RM_RATE * rm * hp * (1 + L) * rateMult,
  );
}

/** RTM 19 */
export function computeBasePropagationFiesta(): number {
  return RTM_BASE_PROPAGATION_FIESTA_SCALAR;
}

/** RTM 51 — Pure doubles value_scalar; RM ceiled first. */
export function computePropagationFiestaFromRm(
  realmMastery: number,
  isPure: boolean,
): number {
  const rateMult = isPure ? 2 : 1;
  const rm = Math.max(0, ceilRealmMastery(realmMastery));
  return Math.ceil(RTM_PROPAGATION_FIESTA_FROM_RM_RATE * rm * rateMult);
}

/** RTM 22 */
export function computeBasePropaguleFiesta(): number {
  return RTM_BASE_PROPAGULE_FIESTA_SCALAR;
}

/** RTM 52 — Pure doubles value_scalar; RM ceiled first. */
export function computePropaguleFiestaFromRm(
  realmMastery: number,
  isPure: boolean,
): number {
  const rateMult = isPure ? 2 : 1;
  const rm = Math.max(0, ceilRealmMastery(realmMastery));
  return Math.ceil(RTM_PROPAGULE_FIESTA_FROM_RM_RATE * rm * rateMult);
}

const ZERO_FIESTA = {
  basePropagationFiesta: 0,
  propagationFiestaFromRm: 0,
  totalPropagationFiesta: 0,
  basePropaguleFiesta: 0,
  propaguleFiestaFromRm: 0,
  totalPropaguleFiesta: 0,
} as const;

const ZERO_DEVOUR = {
  baseShield: 0,
  shieldFromRm: 0,
  totalShield: 0,
  baseStr: 0,
  strFromRm: 0,
  totalStr: 0,
} as const;

export function computeCaroRealmCalculator(
  input: ComputeCaroRealmCalculatorInput,
): CaroRealmCalculatorResult {
  const mode = input.mode ?? "caro";
  const { isPure } = resolveCaroRealmFlags({
    primordiaChaos: input.primordiaChaos,
    pureRealm: input.pureRealm,
  });

  const teamMaxHp = Math.max(
    0,
    Number.isFinite(input.teamMaxHp) ? input.teamMaxHp : 0,
  );
  const currentHp = clampCurrentHp(teamMaxHp, input.currentHp);
  const L = missingHpFraction(teamMaxHp, currentHp);

  if (mode === "propagation") {
    const baseEmbryoFusionRegen = computePropagationEmbryoFusionRegen(L);
    const baseCrimsonFurnaceRegen = computePropagationCrimsonFurnaceRegen(
      teamMaxHp,
      currentHp,
    );
    const basePropagationFiesta = computeBasePropagationFiesta();
    const propagationFiestaFromRm = computePropagationFiestaFromRm(
      input.realmMastery,
      isPure,
    );
    const basePropaguleFiesta = computeBasePropaguleFiesta();
    const propaguleFiestaFromRm = computePropaguleFiestaFromRm(
      input.realmMastery,
      isPure,
    );

    return {
      mode,
      isPure,
      missingHpFraction: L,
      baseEmbryoFusionRegen,
      baseCrimsonFurnaceRegen,
      battleEndCrimsonFurnaceGain: 0,
      ...ZERO_DEVOUR,
      basePropagationFiesta,
      propagationFiestaFromRm,
      totalPropagationFiesta: basePropagationFiesta + propagationFiestaFromRm,
      basePropaguleFiesta,
      propaguleFiestaFromRm,
      totalPropaguleFiesta: basePropaguleFiesta + propaguleFiestaFromRm,
    };
  }

  const baseEmbryoFusionRegen = computeBaseEmbryoFusionRegen(L);
  const baseCrimsonFurnaceRegen = computeBaseCrimsonFurnaceRegen(
    teamMaxHp,
    isPure,
  );
  const battleEndCrimsonFurnaceGain =
    computeBattleEndCrimsonFurnaceGain(teamMaxHp);
  const baseShield = computeBaseDevourShield(teamMaxHp, L);
  const shieldFromRm = computeDevourShieldFromRm(
    teamMaxHp,
    input.realmMastery,
    L,
    isPure,
  );
  const baseStr = computeBaseDevourStr(teamMaxHp, L);
  const strFromRm = computeDevourStrFromRm(
    teamMaxHp,
    input.realmMastery,
    L,
    isPure,
  );

  return {
    mode,
    isPure,
    missingHpFraction: L,
    baseEmbryoFusionRegen,
    baseCrimsonFurnaceRegen,
    battleEndCrimsonFurnaceGain,
    baseShield,
    shieldFromRm,
    totalShield: Math.ceil(baseShield + shieldFromRm),
    baseStr,
    strFromRm,
    totalStr: Math.ceil(baseStr + strFromRm),
    ...ZERO_FIESTA,
  };
}
