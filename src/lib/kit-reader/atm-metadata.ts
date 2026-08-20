/**
 * Kit Reader ATM metadata + is_accumulating helpers.
 * Pack export fills sourceLabel; Agent builds metadata via buildAtmMetadata.
 */

const TAG_CATEGORY_PREFIX =
  /^(Attacker|Support|Defender|Special|When)\./;

/**
 * Strip leading category from MotherTree tag_name for metadata display.
 * Trailing `.Fixed` is omitted from the effect label; proposal `tagName` still
 * uses the full tag (including `.Fixed` when preferred by synonym rules).
 */
export function effectLabelFromTagName(tagName: string): string {
  const trimmed = tagName.trim();
  const withoutCategory = trimmed.replace(TAG_CATEGORY_PREFIX, "");
  return withoutCategory.replace(/\.Fixed$/, "");
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

/** Insert CLI: canonical metadata from pack sourceLabel + tag; optional suffix/override. */
export function resolveInsertMetadata(input: {
  tagName: string;
  sourceLabel: string;
  requiredEnlightenment?: number | null;
  metadataOverride?: string | null;
  metadataSuffix?: string | null;
}): string {
  const override = input.metadataOverride?.trim();
  if (override) return override;

  const canonical = buildAtmMetadata({
    sourceLabel: input.sourceLabel,
    tagName: input.tagName,
    requiredEnlightenment: input.requiredEnlightenment,
  });

  const suffix = input.metadataSuffix?.trim();
  return suffix ? `${canonical} ${suffix}`.trim() : canonical;
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
