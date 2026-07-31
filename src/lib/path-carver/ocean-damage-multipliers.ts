/**
 * Account level → OceanDamageMultiplier (Aequor tentacle ATK term).
 * Sparse dataminer breakpoints as a step function (not HpMultiplier).
 */
export function oceanDamageMultiplierForLevel(level: number): number {
  if (!Number.isFinite(level) || level < 1) {
    throw new Error(`No OceanDamageMultiplier for account level ${level}`);
  }
  if (level <= 25) return 1.0;
  if (level <= 29) return 1.04;
  if (level <= 49) return 1.2;
  if (level <= 59) return 1.6;
  if (level <= 69) return 1.8;
  return 1.9;
}
