import {
  computeBaseTentacleDamage,
  type BaseTentacleDamageBreakdown,
} from "@/lib/path-carver/base-tentacle-damage";
import { ceilRealmMastery } from "@/lib/path-carver/effective-value-scalar";
import { TEAM_SLOT_COUNT } from "@/lib/path-carver/keyflare-harmony";
import { DEFAULT_ACCOUNT_LEVEL } from "@/lib/path-carver/team-max-hp";

/** RTM 28 — Support.Multiply Tentacle Damage (flat). */
export const RTM_BASE_RED_TENTACLE_DAMAGE_ID = 28;
export const RTM_BASE_RED_TENTACLE_DAMAGE_SCALAR = 1.25;

/** RTM 26 — Defender.Shield × team Max HP. */
export const RTM_BASE_WHITE_TENTACLE_SHIELD_ID = 26;
export const RTM_BASE_WHITE_TENTACLE_SHIELD_RATE = 0.08;

/** RTM 42 — Defender.Shield from Realm Mastery. */
export const RTM_WHITE_TENTACLE_SHIELD_FROM_RM_ID = 42;
export const RTM_WHITE_TENTACLE_SHIELD_FROM_RM_RATE = 0.0001;

/** RTM 29 — Special.Hit = Tentacle Attack (flat). */
export const RTM_BASE_RED_TENTACLE_ATTACK_ID = 29;
export const RTM_BASE_RED_TENTACLE_ATTACK_SCALAR = 0.5;

/** RTM 43 — Special.Hit from Realm Mastery. */
export const RTM_RED_TENTACLE_ATTACK_FROM_RM_ID = 43;
export const RTM_RED_TENTACLE_ATTACK_FROM_RM_RATE = 0.0002;

/** Soulforge points per ATK slot (UI dropdown 0–10). */
export const SOULFORGE_MIN = 0;
export const SOULFORGE_MAX = 10;

/** Each Soulforge point adds this fraction to paired ATK. */
export const SOULFORGE_ATK_PER_POINT = 0.03;

export type AequorAtkSlot = {
  atk: number;
  soulforge: number;
};

export type ComputeAequorRealmCalculatorInput = {
  teamMaxHp: number;
  atkSlots: readonly AequorAtkSlot[];
  damageAmpTotal: number;
  realmMastery: number;
  accountLevel: number;
  primordiaChaos: boolean;
  pureRealm: boolean;
  chaosAwakeners: number;
};

export type AequorRealmCalculatorResult = {
  chaosComboStacks: number;
  isPure: boolean;
  effectiveAtks: number[];
  tentacle: BaseTentacleDamageBreakdown;
  baseRedTentacleDamage: number;
  baseWhiteTentacleShield: number;
  whiteTentacleShieldFromRm: number;
  totalWhiteTentacleShield: number;
  baseRedTentacleAttack: number;
  redTentacleAttackFromRm: number;
  totalRedTentacleAttack: number;
};

/**
 * Per-slot ATK after Soulforge: ceil(atk × (1 + soulforge × 0.03)).
 */
export function applySoulforgeAtk(atk: number, soulforge: number): number {
  const sf = Math.min(
    SOULFORGE_MAX,
    Math.max(SOULFORGE_MIN, Math.floor(soulforge)),
  );
  const base = Number.isFinite(atk) && atk > 0 ? atk : 0;
  return Math.ceil(base * (1 + sf * SOULFORGE_ATK_PER_POINT));
}

export function resolveAequorRealmFlags(input: {
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

/** RTM 26 */
export function computeBaseWhiteTentacleShield(teamMaxHp: number): number {
  return Math.ceil(RTM_BASE_WHITE_TENTACLE_SHIELD_RATE * Math.max(0, teamMaxHp));
}

/** RTM 42 — RM input is ceiled first (e.g. 8.1 → 9). */
export function computeWhiteTentacleShieldFromRm(
  teamMaxHp: number,
  realmMastery: number,
  isPure: boolean,
): number {
  const rateMult = isPure ? 2 : 1;
  const hp = Math.max(0, teamMaxHp);
  const rm = Math.max(0, ceilRealmMastery(realmMastery));
  return Math.ceil(hp * (RTM_WHITE_TENTACLE_SHIELD_FROM_RM_RATE * rm * rateMult));
}

/**
 * RTM 43 — tag Special.Hit = Tentacle Attack is percent:
 * ceil(product × 100) / 100 (same as scaleRealmValueScalar).
 * RM input is ceiled first (e.g. 8.1 → 9).
 */
export function computeRedTentacleAttackFromRm(
  realmMastery: number,
  isPure: boolean,
): number {
  const scalarMult = isPure ? 2 : 1;
  const rm = Math.max(0, ceilRealmMastery(realmMastery));
  const product = RTM_RED_TENTACLE_ATTACK_FROM_RM_RATE * scalarMult * rm;
  return Math.ceil(product * 100) / 100;
}

/** RTM 28 applied: ceil(1.25 × Base Tentacle Damage). */
export function computeBaseRedTentacleDamage(
  baseTentacleDamage: number,
): number {
  return Math.ceil(
    RTM_BASE_RED_TENTACLE_DAMAGE_SCALAR * Math.max(0, baseTentacleDamage),
  );
}

/**
 * Public Aequor Realm calculator: Base Tentacle + RTM 28/26/42/29/43.
 */
export function computeAequorRealmCalculator(
  input: ComputeAequorRealmCalculatorInput,
): AequorRealmCalculatorResult {
  const { chaosComboStacks, isPure } = resolveAequorRealmFlags(input);

  const slots = input.atkSlots.slice(0, TEAM_SLOT_COUNT);
  while (slots.length < TEAM_SLOT_COUNT) {
    slots.push({ atk: 0, soulforge: 0 });
  }

  const effectiveAtks = slots.map((s) =>
    applySoulforgeAtk(s.atk, s.soulforge),
  );

  const accountLevel =
    Number.isFinite(input.accountLevel) && input.accountLevel >= 1
      ? input.accountLevel
      : DEFAULT_ACCOUNT_LEVEL;

  const tentacle = computeBaseTentacleDamage({
    mode: "aequor",
    awakeners: effectiveAtks.map((atk) => ({ atk })),
    teamMaxHp: Math.max(0, input.teamMaxHp),
    chaosComboStacks,
    damageAmpTotal: Math.max(0, input.damageAmpTotal),
    accountLevel,
    atkPer: 0,
  });

  const baseWhiteTentacleShield = computeBaseWhiteTentacleShield(
    input.teamMaxHp,
  );
  const whiteTentacleShieldFromRm = computeWhiteTentacleShieldFromRm(
    input.teamMaxHp,
    input.realmMastery,
    isPure,
  );
  const baseRedTentacleAttack = RTM_BASE_RED_TENTACLE_ATTACK_SCALAR;
  const redTentacleAttackFromRm = computeRedTentacleAttackFromRm(
    input.realmMastery,
    isPure,
  );

  return {
    chaosComboStacks,
    isPure,
    effectiveAtks,
    tentacle,
    baseRedTentacleDamage: computeBaseRedTentacleDamage(tentacle.valueScalar),
    baseWhiteTentacleShield,
    whiteTentacleShieldFromRm,
    totalWhiteTentacleShield:
      baseWhiteTentacleShield + whiteTentacleShieldFromRm,
    baseRedTentacleAttack,
    redTentacleAttackFromRm,
    totalRedTentacleAttack: baseRedTentacleAttack + redTentacleAttackFromRm,
  };
}
