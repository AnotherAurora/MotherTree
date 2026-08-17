/**
 * Kit Reader proposal heuristics: enjoy → unique_scaling detection,
 * always-aoe tag prefixes. Used by pack export, insert CLI, and docs/skill.
 */

/** ATM tag_name prefixes that always use target_type aoe (includes subtags). */
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

/** True when kit text contains enjoy / enjoys / enjoying. */
export function detectEnjoyClause(kitText: string | null | undefined): boolean {
  if (!kitText) return false;
  return ENJOY_WORD.test(kitText);
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
