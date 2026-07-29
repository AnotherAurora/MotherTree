import { hpMultiplierForLevel } from "@/lib/path-carver/account-level-hp-multipliers";

/** Path Carver default account level. */
export const DEFAULT_ACCOUNT_LEVEL = 60;

/** Path Carver default per-awakener level. */
export const DEFAULT_AWAKENER_LEVEL = 60;

export type TeamMaxHpResult = {
  totalCon: number;
  accountLevel: number;
  awakenerAverageLevel: number;
  effectiveHpLevel: number;
  hpMultiplier: number;
  baselineMaxHp: number;
  maxHpUpTotal: number;
  bonusMaxHp: number;
  finalMaxHp: number;
};

/**
 * awakenerAverageLevel = ceil(sum(selected levels) / 4) — always ÷ 4 slots.
 */
export function computeAwakenerAverageLevel(
  selectedAwakenerLevels: readonly number[],
): number {
  const sum = selectedAwakenerLevels.reduce((a, b) => a + b, 0);
  return Math.ceil(sum / 4);
}

/**
 * If account > awakener average → account level; else blend and ceil.
 */
export function computeEffectiveHpLevel(
  accountLevel: number,
  selectedAwakenerLevels: readonly number[],
): number {
  const awakenerAverageLevel = computeAwakenerAverageLevel(
    selectedAwakenerLevels,
  );
  if (accountLevel > awakenerAverageLevel) return accountLevel;
  return Math.ceil((accountLevel + awakenerAverageLevel) / 2);
}

export function computeBaselineMaxHp(
  totalCon: number,
  effectiveHpLevel: number,
): number {
  return Math.ceil(totalCon * hpMultiplierForLevel(effectiveHpLevel));
}

/**
 * Defender.Max HP Up is a direct fraction of baseline (0.1 = +10%).
 * Death Resist is separate; its only link is emitting a Max HP Up synthetic from
 * Base→In Mission reduction — that scalar then uses this same direct apply.
 */
export function computeBonusMaxHpFromMaxHpUp(
  baselineMaxHp: number,
  maxHpUpTotal: number,
): number {
  if (baselineMaxHp <= 0 || maxHpUpTotal <= 0) return 0;
  return Math.ceil(baselineMaxHp * maxHpUpTotal);
}

export type ComputeTeamMaxHpInput = {
  /** Total base CON per selected awakener (gear included). */
  awakeners: readonly { con: number | null }[];
  /** Sum of Defender.Max HP Up (0.1 = +10%), including DR-reduction synthetic. */
  maxHpUpTotal: number;
  accountLevel?: number;
  /**
   * Levels for selected awakeners only. Defaults to 60 per selected awakener.
   * Average still divides by 4 team slots.
   */
  awakenerLevels?: readonly number[];
};

/**
 * Team Max HP: baseline from CON × HpMultiplier, plus Max HP Up as a direct % of baseline.
 */
export function computeTeamMaxHp(
  input: ComputeTeamMaxHpInput,
): TeamMaxHpResult {
  const accountLevel = input.accountLevel ?? DEFAULT_ACCOUNT_LEVEL;
  const awakenerLevels =
    input.awakenerLevels ??
    input.awakeners.map(() => DEFAULT_AWAKENER_LEVEL);

  const totalCon = input.awakeners.reduce((sum, a) => sum + (a.con ?? 0), 0);
  const awakenerAverageLevel = computeAwakenerAverageLevel(awakenerLevels);
  const effectiveHpLevel = computeEffectiveHpLevel(accountLevel, awakenerLevels);
  const hpMultiplier = hpMultiplierForLevel(effectiveHpLevel);
  const baselineMaxHp = Math.ceil(totalCon * hpMultiplier);
  const maxHpUpTotal = input.maxHpUpTotal;
  const bonusMaxHp = computeBonusMaxHpFromMaxHpUp(baselineMaxHp, maxHpUpTotal);

  return {
    totalCon,
    accountLevel,
    awakenerAverageLevel,
    effectiveHpLevel,
    hpMultiplier,
    baselineMaxHp,
    maxHpUpTotal,
    bonusMaxHp,
    finalMaxHp: baselineMaxHp + bonusMaxHp,
  };
}
