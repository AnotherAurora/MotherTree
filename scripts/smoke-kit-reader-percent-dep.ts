/**
 * Smoke: Kit Reader percent vs linear dependency_stat value_scalar helpers.
 *
 *   npx tsx scripts/smoke-kit-reader-percent-dep.ts
 */
import {
  previewAtmEffectiveScalar,
  valueScalarPerPercentPointOfPercentDep,
  valueScalarPerUnitLinearDep,
  warnPercentDepValueScalarLooksLinear,
} from "../src/lib/kit-reader/proposal-heuristics";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function approx(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) <= eps;
}

console.log("Kit Reader percent-dep helpers");

assert(
  valueScalarPerPercentPointOfPercentDep(0.2) === 0.00002,
  "0.2%/1% DR → 0.00002",
);
assert(
  valueScalarPerPercentPointOfPercentDep(0.05) === 0.000005,
  "0.05%/1% DR → 0.000005",
);
assert(
  valueScalarPerUnitLinearDep(0.2) === 0.002,
  "0.2%/1 RM → 0.002",
);

const shieldAt336 = previewAtmEffectiveScalar(
  0.000005,
  "death_resist",
  0.336,
);
assert(
  approx(shieldAt336, 0.0168),
  `33.6% DR shield preview 0.0168 (got ${shieldAt336})`,
);

const baseDmgAt336 = previewAtmEffectiveScalar(
  0.00002,
  "death_resist",
  0.336,
);
assert(
  approx(baseDmgAt336, 0.0672),
  `33.6% DR base dmg preview 0.0672 (got ${baseDmgAt336})`,
);

const badWarning = warnPercentDepValueScalarLooksLinear(
  "talent-base-damage",
  "death_resist",
  0.002,
  "Every 1% {Death Resistance} … increase her Base DMG by 0.2%.",
);
assert(badWarning != null, "0.002 on death_resist should warn");

const okWarning = warnPercentDepValueScalarLooksLinear(
  "talent-base-damage",
  "death_resist",
  0.00002,
  "Every 1% {Death Resistance} … increase her Base DMG by 0.2%.",
);
assert(okWarning == null, "0.00002 on death_resist should not warn");

console.log("OK: all kit-reader percent-dep checks passed");
