/**
 * Kit Reader proposal heuristics: enjoy → unique_scaling detection,
 * always-aoe tag prefixes, percent vs linear dependency_stat scaling.
 * Used by pack export, insert CLI, and docs/skill.
 */

import type { AllStats } from "@/lib/team-data/types";
import { isPercentDependencyStat } from "@/lib/path-carver/effective-value-scalar";

export { isPercentDependencyStat };

/** ATM tag_name prefixes that always use target_type aoe (includes subtags). Not used for unique_scaling locals. */
export const AOE_TAG_PREFIXES = [
  "Support.Keyflare",
  "Support.STR Up",
  "Attacker.Counter",
  "Defender.Heal",
  "Defender.Shield",
  "Defender.Base Death Resist",
  "Support.Double Posse",
  "Support.Create.Posse",
  "Support.Generate Temporary Tentacle",
  "Support.Generate Permanent Tentacle",
  "Support.Embryo Fusion",
  "Support.Crimson Furnace",
  "Support.Realm Mastery",
  "Support.Tentacle Damage Up",
  "Support.Discard",
] as const;

export type AoeTagPrefix = (typeof AOE_TAG_PREFIXES)[number];

/** Prefix match with dotted boundary (Support.STR Up matches Support.STR Up.Fixed). */
export function isAoeTagPrefix(tagName: string): boolean {
  const trimmed = tagName.trim();
  return AOE_TAG_PREFIXES.some(
    (prefix) => trimmed === prefix || trimmed.startsWith(`${prefix}.`),
  );
}

export function defaultTargetTypeForTag(
  tagName: string,
): "aoe" | null {
  return isAoeTagPrefix(tagName) ? "aoe" : null;
}

const ENJOY_WORD = /\benjoy(s|ing)?\b/i;

/**
 * unique_scaling modifier roots when enjoy is followed by Tentacle DMG /
 * Tentacle Damage. Unique TDU is a sibling of TDU, not a prefix child.
 */
export const ENJOY_TENTACLE_DMG_MODIFIER_TAG_NAMES = [
  "Support.Tentacle Damage Up",
  "Support.Unique Tentacle Damage Up",
] as const;

export type EnjoyTentacleDmgModifierTagName =
  (typeof ENJOY_TENTACLE_DMG_MODIFIER_TAG_NAMES)[number];

/** True when kit text contains enjoy / enjoys / enjoying. */
export function detectEnjoyClause(kitText: string | null | undefined): boolean {
  if (!kitText) return false;
  return ENJOY_WORD.test(kitText);
}

/**
 * True when enjoy / enjoys / enjoying is followed in the same clause by
 * Tentacle DMG or Tentacle Damage (braces ignored). Counter / STR enjoy
 * clauses return false.
 */
export function detectEnjoyTentacleDmgClause(
  kitText: string | null | undefined,
): boolean {
  if (!kitText) return false;
  const stripped = kitText.replace(/[{}]/g, "");
  return /\benjoy(?:s|ing)?\b[^.\n]*\bTentacle\s+(?:DMG|Damage)\b/i.test(
    stripped,
  );
}

/**
 * Extract percent factor near an enjoy clause (50% → 0.5).
 * Returns null when no % is found near enjoy — Agent should use needs_review.
 */
export function parseEnjoyPercentFactor(
  text: string | null | undefined,
): number | null {
  if (!text) return null;
  const match = text.match(
    /\benjoy(?:s|ing)?\b[^.%]{0,80}?(\d+(?:\.\d+)?)\s*%/i,
  );
  if (!match) {
    const reverse = text.match(
      /(\d+(?:\.\d+)?)\s*%\s*[^.]{0,80}?\benjoy(?:s|ing)?\b/i,
    );
    if (!reverse) return null;
    const n = Number(reverse[1]);
    return Number.isFinite(n) ? n / 100 : null;
  }
  const n = Number(match[1]);
  return Number.isFinite(n) ? n / 100 : null;
}

/** Pack-serializable copy of aoe prefixes. */
export function aoeTagPrefixesForPack(): string[] {
  return [...AOE_TAG_PREFIXES];
}

/** Pack-serializable copy of enjoy Tentacle DMG unique_scaling modifier roots. */
export function enjoyTentacleDmgModifierTagNamesForPack(): string[] {
  return [...ENJOY_TENTACLE_DMG_MODIFIER_TAG_NAMES];
}

/** Percent-style dependency_stat values (ATM scaleValueScalar uses ×100×100). */
export const PERCENT_DEPENDENCY_STATS = [
  "damage_amp",
  "crit_rate",
  "crit_dmg",
  "sigil_yield",
  "death_resist",
] as const satisfies readonly AllStats[];

export type PercentDependencyStat = (typeof PERCENT_DEPENDENCY_STATS)[number];

/** Pack-serializable copy of percent dependency stats. */
export function percentDependencyStatsForPack(): string[] {
  return [...PERCENT_DEPENDENCY_STATS];
}

/**
 * Kit: "every 1 {unit} of linear dep → +R% effect" (RM, con, atk, …).
 * effective = value_scalar × stat → value_scalar = R / 100.
 */
export function valueScalarPerUnitLinearDep(ratePercentPerUnit: number): number {
  return ratePercentPerUnit / 100;
}

/**
 * Kit: "every 1% of percent dep → +R% effect" (DR, damage_amp, …).
 * effective = value_scalar × 100 × (stat × 100) → value_scalar = R / 10000.
 */
export function valueScalarPerPercentPointOfPercentDep(
  ratePercentPerDepPoint: number,
): number {
  return ratePercentPerDepPoint / 10_000;
}

/** Preview ATM effective scalar at a dependency fraction (e.g. 0.336 = 33.6% DR). Pre-ceil, for kit authoring sanity checks. */
export function previewAtmEffectiveScalar(
  valueScalar: number,
  dependencyStat: AllStats,
  depFraction: number,
): number {
  if (isPercentDependencyStat(dependencyStat)) {
    return valueScalar * 100 * (depFraction * 100);
  }
  return valueScalar * depFraction;
}

export type EveryOnePercentRateParse = {
  depIsPercent: true;
  ratePercent: number;
};

/**
 * Match "Every 1% … increase … by 0.2%" style kit lines.
 * Returns null when pattern not found.
 */
export function parseEveryOnePercentRate(
  text: string | null | undefined,
): EveryOnePercentRateParse | null {
  if (!text) return null;
  const match = text.match(
    /\bevery\s+1\s*%\s*[^.]{0,120}?\b(?:increase|gain|grant|add|by)\s*[^.]{0,40}?(\d+(?:\.\d+)?)\s*%/i,
  );
  if (!match) return null;
  const ratePercent = Number(match[1]);
  if (!Number.isFinite(ratePercent)) return null;
  return { depIsPercent: true, ratePercent };
}

/** True when kit quote / rationale describes scaling per 1% of a dependency. */
export function kitTextScalesPerOnePercentDep(
  sourceQuote: string | null | undefined,
  rationale?: string | null,
): boolean {
  const haystack = `${sourceQuote ?? ""} ${rationale ?? ""}`;
  return /\bevery\s+1\s*%/i.test(haystack) || /\bper\s+1\s*%\b/i.test(haystack);
}

export type PercentDepValueScalarWarning = {
  clientKey: string;
  dependencyStat: AllStats;
  valueScalar: number;
  message: string;
};

/**
 * Non-blocking check: value_scalar looks like linear RM rate (rate/100) on a
 * percent dependency when kit text scales per 1%.
 */
export function warnPercentDepValueScalarLooksLinear(
  clientKey: string,
  dependencyStat: AllStats | null,
  valueScalar: number | null,
  sourceQuote: string,
  rationale?: string | null,
): PercentDepValueScalarWarning | null {
  if (dependencyStat == null || valueScalar == null) return null;
  if (!isPercentDependencyStat(dependencyStat)) return null;
  if (!kitTextScalesPerOnePercentDep(sourceQuote, rationale)) return null;

  const parsed = parseEveryOnePercentRate(sourceQuote);
  const ratePercent = parsed?.ratePercent;
  if (ratePercent == null || !Number.isFinite(ratePercent)) return null;

  const expected = valueScalarPerPercentPointOfPercentDep(ratePercent);
  const linearMistake = valueScalarPerUnitLinearDep(ratePercent);
  if (valueScalar < linearMistake) return null;

  return {
    clientKey,
    dependencyStat,
    valueScalar,
    message: `${clientKey}: value_scalar ${valueScalar} looks like linear rate/${100} on percent dep ${dependencyStat}; expected ~${expected} (rate/${10_000})`,
  };
}
