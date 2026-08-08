import { ceilRealmMastery } from "@/lib/path-carver/effective-value-scalar";

/** RTM 3 — Support.Aliemus (flat base per posse). */
export const RTM_BASE_ALIEMUS_PER_POSSE_ID = 3;
export const RTM_BASE_ALIEMUS_PER_POSSE_SCALAR = 5;

/** RTM 37 — Support.Aliemus × Realm Mastery. */
export const RTM_ALIEMUS_PER_POSSE_FROM_RM_ID = 37;
export const RTM_ALIEMUS_PER_POSSE_FROM_RM_RATE = 0.05;

export type ComputeChaosRealmCalculatorInput = {
  realmMastery: number;
};

export type ChaosRealmCalculatorResult = {
  baseAliemusPerPosse: number;
  aliemusPerPosseFromRm: number;
  /** Extra Realm Mastery needed so Aliemus Per Posse from RM rises by 1. */
  rmNeededForNextAliemusPerPosse: number;
  totalAliemusPerPosse: number;
};

/** RTM 3 — flat base Aliemus per posse. */
export function computeBaseAliemusPerPosse(): number {
  return RTM_BASE_ALIEMUS_PER_POSSE_SCALAR;
}

/**
 * RTM 37 — Aliemus per posse from Realm Mastery.
 * `Math.ceil(0.05 * Math.ceil(RM))` (non-percent tag).
 */
export function computeAliemusPerPosseFromRm(realmMastery: number): number {
  const rm = Math.max(0, ceilRealmMastery(realmMastery));
  return Math.ceil(RTM_ALIEMUS_PER_POSSE_FROM_RM_RATE * rm);
}

/**
 * Extra Realm Mastery needed for Aliemus Per Posse from RM to increase by 1.
 * Next threshold ceil(RM) is `floor(currentFromRm / rate) + 1`.
 */
export function computeRmNeededForNextAliemusPerPosse(
  realmMastery: number,
): number {
  const current = Number.isFinite(realmMastery)
    ? Math.max(0, realmMastery)
    : 0;
  const fromRm = computeAliemusPerPosseFromRm(current);
  const targetRmCeil =
    Math.floor(fromRm / RTM_ALIEMUS_PER_POSSE_FROM_RM_RATE) + 1;
  return Math.max(0, targetRmCeil - current);
}

/** Public Chaos Realm calculator — RTM 3 + 37. */
export function computeChaosRealmCalculator(
  input: ComputeChaosRealmCalculatorInput,
): ChaosRealmCalculatorResult {
  const baseAliemusPerPosse = computeBaseAliemusPerPosse();
  const aliemusPerPosseFromRm = computeAliemusPerPosseFromRm(
    input.realmMastery,
  );
  const rmNeededForNextAliemusPerPosse =
    computeRmNeededForNextAliemusPerPosse(input.realmMastery);
  return {
    baseAliemusPerPosse,
    aliemusPerPosseFromRm,
    rmNeededForNextAliemusPerPosse,
    totalAliemusPerPosse: baseAliemusPerPosse + aliemusPerPosseFromRm,
  };
}
