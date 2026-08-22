/**
 * Kit Reader proposal heuristics: enjoy → unique_scaling detection,
 * steal → STR Down + STR Up pairing, always-aoe tag prefixes,
 * percent vs linear dependency_stat scaling.
 * Used by pack export, insert CLI, and docs/skill.
 */

import type { AllStats } from "@/lib/team-data/types";
import { isPercentDependencyStat } from "@/lib/path-carver/effective-value-scalar";
import {
  argMetaRequiresReview,
  inferDependencyStatFromArgMeta,
  valueScalarFromKitPercent,
  type ResolvedArgMetaEntry,
} from "./description-args";

export { isPercentDependencyStat };
export {
  argMetaRequiresReview,
  inferDependencyStatFromArgMeta,
  valueScalarFromKitPercent,
  type ResolvedArgMetaEntry,
};

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

const STEAL_WORD = /\{Steal\}|\bSteal\b/i;

/** STR reference near a Steal clause ({STR}, STR▼, …). */
const STEAL_STR_REF = /\{STR(?:▼)?\}|STR▼/i;

/** Steal STR transfer: enemy STR Down + self STR Up.Fixed (dual ATM, not a flavor synonym). */
export const STEAL_STR_TAG_NAMES = [
  "Defender.STR Down",
  "Support.STR Up.Fixed",
] as const;

export type StealStrTagName = (typeof STEAL_STR_TAG_NAMES)[number];

/** Pack-serializable copy of Steal STR pair tag names. */
export function stealStrTagNamesForPack(): string[] {
  return [...STEAL_STR_TAG_NAMES];
}

/** True when kit text contains {Steal} / Steal in a clause that references STR. */
export function detectStealClause(
  kitText: string | null | undefined,
): boolean {
  if (!kitText) return false;
  if (!STEAL_WORD.test(kitText)) return false;
  return STEAL_STR_REF.test(kitText);
}

export type StealStrScalarParse = {
  valueScalar: number;
  dependencyStat: AllStats | null;
};

const STEAL_PERCENT_STAT =
  /(?:\{Steal\}|\bSteal\b)[^.]{0,160}?(\d+(?:\.\d+)?)\s*%\s*(?:of\s+)?(?:[\w']+'s\s+)?(ATK|DEF|CON)\b/i;

const STEAL_FLAT_STR =
  /(?:\{Steal\}|\bSteal\b)[^.]{0,100}?(\d+(?:\.\d+)?)\s*(?:\{STR(?:▼)?\}|STR▼|\{STR\})/i;

/**
 * Parse Steal + STR scalar from kit text (flat N → N/100; N% of ATK/DEF/CON → N/100 + stat).
 * Returns null when Steal+STR is present but amount is ambiguous.
 */
export function parseStealStrScalar(
  text: string | null | undefined,
): StealStrScalarParse | null {
  if (!text || !detectStealClause(text)) return null;

  const percentMatch = text.match(STEAL_PERCENT_STAT);
  if (percentMatch) {
    const n = Number(percentMatch[1]);
    const stat = percentMatch[2].toLowerCase() as AllStats;
    if (Number.isFinite(n)) {
      return { valueScalar: n / 100, dependencyStat: stat };
    }
  }

  const flatMatch = text.match(STEAL_FLAT_STR);
  if (flatMatch) {
    const n = Number(flatMatch[1]);
    if (Number.isFinite(n)) {
      return { valueScalar: n / 100, dependencyStat: null };
    }
  }

  return null;
}

export type StealMissingStrUpWarning = {
  clientKey: string;
  message: string;
};

/** Minimal proposal shape for Steal pair validation (insert CLI). */
export type StealPairProposalLike = {
  clientKey: string;
  status: string;
  tagName: string;
  sourceKitId: string;
  sourceQuote: string;
  valueScalar: number | null;
  dependencyStat: AllStats | null;
  requiredEnlightenment?: number;
  isPermanent?: boolean;
};

function stealPairMatches(
  down: StealPairProposalLike,
  up: StealPairProposalLike,
): boolean {
  return (
    up.tagName === "Support.STR Up.Fixed" &&
    up.sourceKitId === down.sourceKitId &&
    up.valueScalar === down.valueScalar &&
    up.dependencyStat === down.dependencyStat &&
    (up.requiredEnlightenment ?? 0) === (down.requiredEnlightenment ?? 0) &&
    (up.isPermanent ?? false) === (down.isPermanent ?? false)
  );
}

/**
 * Non-blocking check: Steal STR Down row without matching STR Up pair in the same batch.
 */
export function warnStealMissingStrUpPair(
  proposals: readonly StealPairProposalLike[],
): StealMissingStrUpWarning[] {
  const ok = proposals.filter((p) => p.status === "ok");
  const warnings: StealMissingStrUpWarning[] = [];

  for (const proposal of ok) {
    if (proposal.tagName !== "Defender.STR Down") continue;
    if (!detectStealClause(proposal.sourceQuote)) continue;

    const hasPair = ok.some(
      (other) =>
        other.clientKey !== proposal.clientKey && stealPairMatches(proposal, other),
    );

    if (!hasPair) {
      warnings.push({
        clientKey: proposal.clientKey,
        message: `${proposal.clientKey}: Steal STR clause has Defender.STR Down but no matching Support.STR Up.Fixed pair (same sourceKitId, valueScalar, dependencyStat, enlightenment, isPermanent)`,
      });
    }
  }

  return warnings;
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

export type LemurianSynergyTiers = {
  tier1: number;
  tier2: number;
  tier3: number;
};

/** Default tier scalars for +20% / +50% / +100% DMG AMP. */
export const DEFAULT_LEMURIAN_SYNERGY_TIERS: LemurianSynergyTiers = {
  tier1: 0.2,
  tier2: 0.5,
  tier3: 1.0,
};

/**
 * Kit: Lemurian team synergy — other Lemurians on team → tiered DMG AMP.
 * e.g. "When there are 1/2/3 other Lemurian Awakeners … DMG Amplification +20%/50%/100%"
 */
export function detectLemurianSynergyClause(
  kitText: string | null | undefined,
): boolean {
  if (!kitText) return false;
  const normalized = kitText.toLowerCase();
  if (!normalized.includes("lemurian")) return false;
  if (!/\bother\b/.test(normalized)) return false;
  return (
    /\bdmg\s*amplification\b/.test(normalized) ||
    /\bdamage\s*amp(?:lification)?\b/.test(normalized) ||
    /\bsupport\.damage\s*amp\b/.test(normalized)
  );
}

/**
 * Parse tier percents from Lemurian synergy kit text (20/50/100 style).
 * Returns null when clause detected but percents are ambiguous.
 */
export function parseLemurianSynergyTiers(
  kitText: string | null | undefined,
): LemurianSynergyTiers | null {
  if (!detectLemurianSynergyClause(kitText)) return null;
  if (!kitText) return null;

  const percents: number[] = [];
  for (const match of kitText.matchAll(/(\d+(?:\.\d+)?)\s*%/g)) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) percents.push(value);
  }

  if (percents.length >= 3) {
    return {
      tier1: percents[0] / 100,
      tier2: percents[1] / 100,
      tier3: percents[2] / 100,
    };
  }

  if (percents.length === 0) {
    return { ...DEFAULT_LEMURIAN_SYNERGY_TIERS };
  }

  return null;
}
