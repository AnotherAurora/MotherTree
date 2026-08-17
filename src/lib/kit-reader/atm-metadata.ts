/**
 * Kit Reader ATM metadata + is_accumulating helpers.
 * Pack export fills sourceLabel; Agent builds metadata via buildAtmMetadata.
 */

const TAG_CATEGORY_PREFIX =
  /^(Attacker|Support|Defender|Special|When)\./;

/** Strip leading category from MotherTree tag_name. */
export function effectLabelFromTagName(tagName: string): string {
  const trimmed = tagName.trim();
  return trimmed.replace(TAG_CATEGORY_PREFIX, "");
}

/** E1/E2/E3 only — not OE (7) or AA (15). */
export function enlightenMetadataSuffix(
  requiredEnlightenment: number | null | undefined,
): "E1" | "E2" | "E3" | null {
  if (requiredEnlightenment === 1) return "E1";
  if (requiredEnlightenment === 2) return "E2";
  if (requiredEnlightenment === 3) return "E3";
  return null;
}

export function buildAtmMetadata(input: {
  sourceLabel: string;
  tagName: string;
  requiredEnlightenment?: number | null;
}): string {
  const effect = effectLabelFromTagName(input.tagName);
  const suffix = enlightenMetadataSuffix(input.requiredEnlightenment);
  const base = `${input.sourceLabel.trim()} ${effect}`.trim();
  return suffix ? `${base} ${suffix}` : base;
}

/** Every-turn effects: "at turn start" / "at turn end" (and close variants). */
export function detectIsAccumulating(kitText: string | null | undefined): boolean {
  if (!kitText) return false;
  return /\bat\s+turn\s+(start|end)\b/i.test(kitText);
}

/** True when SKeyDB cost can be used as "{N} Cost" label. */
export function isUsableSkillCost(cost: string | null | undefined): boolean {
  if (cost == null) return false;
  const trimmed = String(cost).trim();
  if (!trimmed || trimmed === "—" || trimmed === "-" || trimmed === "–") {
    return false;
  }
  return Number.isFinite(Number(trimmed));
}

export function formatCostSourceLabel(cost: string): string {
  return `${String(cost).trim()} Cost`;
}
