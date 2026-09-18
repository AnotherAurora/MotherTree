/**
 * Account-level research curve + relic computed-arg resolution.
 *
 * Source: SKeyDB `dansa/SKeyDB` pinned commit
 * `b7a70c00a33a031811fa88d9fd8dd7564ca286c1`
 * `src/data/public-v3/metadata/gameplay-math.json` (accountLevelCurve, min 1 / max 100).
 * Formula semantics: `src/domain/public-description-args.ts`.
 *
 * `relic_tag_manifestation` stores `kind` + `base_formula` + `value_scalar`
 * (the SKeyDB per-effect multiplier). This module resolves a computed row into
 * the concrete scalar the Path Carver engine consumes:
 *
 *   accountStageGrowth     -> ceil(stageGrow * posseMult * valueScalar)
 *   esotericResearchDepth  -> ceil(stageGrow * posseMult * valueScalar)
 *   occultResearchDepth    -> ceil(stageGrow * (accountDamagePower/100) * posseMult * valueScalar)
 *
 * `posseMult = 1 + min(ownedPosseCount, 50) * 0.01`.
 * `accountStageGrowth` intentionally receives no owned-posse bonus (SKeyDB).
 * HSR doubles the already-resolved value of a `computed` row (applied after the
 * ceil). `fixed` rows are never affected by HSR.
 */

export const RELIC_RESEARCH_CURVE_SOURCE = {
  repo: "dansa/SKeyDB",
  commit: "b7a70c00a33a031811fa88d9fd8dd7564ca286c1",
  path: "src/data/public-v3/metadata/gameplay-math.json",
} as const;

export type RelicBaseFormula =
  | "accountStageGrowth"
  | "esotericResearchDepth"
  | "occultResearchDepth";

export type RelicArgKind = "fixed" | "computed";

export const MIN_ACCOUNT_LEVEL = 1;
export const MAX_ACCOUNT_LEVEL = 100;
export const MIN_OWNED_POSSE_COUNT = 0;
export const MAX_OWNED_POSSE_COUNT = 50;

export const DEFAULT_ACCOUNT_LEVEL = 50;
export const DEFAULT_OWNED_POSSE_COUNT = 50;

/** Index = accountLevel - 1. */
const STAGE_GROW: readonly number[] = [
  62, 65, 69, 72, 75, 78, 81, 85, 88, 91, 95, 98, 101, 105, 108, 113, 118, 123,
  129, 134, 139, 143, 148, 152, 157, 168, 179, 191, 203, 215, 224, 233, 243, 252,
  262, 274, 287, 301, 314, 329, 344, 360, 376, 393, 411, 426, 443, 458, 474, 490,
  512, 534, 557, 581, 605, 638, 669, 701, 743, 768, 787, 805, 824, 838, 858, 877,
  897, 917, 938, 959, 969, 980, 990, 1001, 1011, 1022, 1032, 1043, 1053, 1064,
  1074, 1085, 1095, 1106, 1116, 1127, 1137, 1148, 1158, 1169, 1179, 1190, 1200,
  1211, 1221, 1232, 1242, 1253, 1263, 1274,
];

/** Index = accountLevel - 1. */
const ACCOUNT_DAMAGE_POWER: readonly number[] = [
  113, 113, 114, 115, 115, 115, 116, 116, 116, 117, 118, 119, 120, 121, 122, 125,
  126, 129, 131, 132, 135, 139, 141, 144, 146, 148, 149, 150, 151, 153, 154, 154,
  155, 157, 158, 162, 165, 169, 174, 178, 182, 184, 188, 192, 196, 197, 199, 202,
  203, 206, 209, 213, 217, 221, 238, 247, 257, 265, 272, 281, 286, 292, 298, 306,
  312, 318, 324, 332, 338, 344, 346, 348, 350, 352, 354, 356, 358, 360, 362, 364,
  366, 368, 370, 372, 374, 376, 378, 380, 382, 384, 386, 388, 390, 392, 394, 396,
  398, 400, 402, 404,
];

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return max;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function clampAccountLevel(accountLevel: number): number {
  return clampInt(accountLevel, MIN_ACCOUNT_LEVEL, MAX_ACCOUNT_LEVEL);
}

export function clampOwnedPosseCount(ownedPosseCount: number): number {
  return clampInt(ownedPosseCount, MIN_OWNED_POSSE_COUNT, MAX_OWNED_POSSE_COUNT);
}

export function stageGrowForLevel(accountLevel: number): number {
  return STAGE_GROW[clampAccountLevel(accountLevel) - 1];
}

export function accountDamagePowerForLevel(accountLevel: number): number {
  return ACCOUNT_DAMAGE_POWER[clampAccountLevel(accountLevel) - 1];
}

export type ResolveRelicValueScalarInput = {
  kind: RelicArgKind;
  baseFormula: RelicBaseFormula | null;
  valueScalar: number | null;
  accountLevel: number;
  ownedPosseCount: number;
  hsr: boolean;
};

/**
 * Resolve one relic manifest row into an absolute scalar. `fixed` rows return
 * `value_scalar` unchanged; `computed` rows apply the account-level curve and
 * owned-posse research bonus, then ceil to a whole number. HSR doubles the
 * resolved `computed` value after the ceil; `fixed` rows are unaffected.
 */
export function resolveRelicValueScalar(
  input: ResolveRelicValueScalarInput,
): number {
  const valueScalar = input.valueScalar;
  if (valueScalar == null || !Number.isFinite(valueScalar)) return 0;
  if (input.kind !== "computed" || input.baseFormula == null) {
    return valueScalar;
  }

  const level = clampAccountLevel(input.accountLevel);
  const stageGrow = STAGE_GROW[level - 1];
  const posseMult =
    1 + clampOwnedPosseCount(input.ownedPosseCount) * 0.01;

  let base: number;
  switch (input.baseFormula) {
    case "accountStageGrowth":
      // No owned-posse bonus for account growth.
      base = stageGrow;
      break;
    case "esotericResearchDepth":
      base = stageGrow * posseMult;
      break;
    case "occultResearchDepth":
      base = stageGrow * (ACCOUNT_DAMAGE_POWER[level - 1] / 100) * posseMult;
      break;
    default:
      return valueScalar;
  }

  const resolved = Math.ceil(base * valueScalar - 1e-9);
  return input.hsr ? resolved * 2 : resolved;
}
