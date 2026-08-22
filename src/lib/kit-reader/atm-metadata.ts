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

/** True when metadata already contains a Devour segment (avoid "Devour Devour"). */
export function metadataAlreadyContainsDevour(
  sourceLabel: string,
  metadataSuffix?: string | null,
): boolean {
  const label = sourceLabel.trim();
  if (/\bDevour\b/i.test(label)) return true;
  const suffix = metadataSuffix?.trim();
  if (suffix && /\bDevour\b/i.test(suffix)) return true;
  return false;
}

export function buildAtmMetadata(input: {
  sourceLabel: string;
  tagName: string;
  requiredEnlightenment?: number | null;
  isDevour?: boolean;
}): string {
  const effect = effectLabelFromTagName(input.tagName);
  const suffix = enlightenMetadataSuffix(input.requiredEnlightenment);
  const label = input.sourceLabel.trim();
  const devourSegment =
    input.isDevour && !metadataAlreadyContainsDevour(label) ? "Devour " : "";
  const base = `${label} ${devourSegment}${effect}`.trim();
  return suffix ? `${base} ${suffix}` : base;
}

/**
 * Skip proposal metadataSuffix when it repeats sourceLabel already in canonical metadata
 * (e.g. sourceLabel "SF" + suffix "+ SF" → "SF Poison", not "SF Poison + SF").
 */
export function isRedundantMetadataSuffix(
  sourceLabel: string,
  metadataSuffix: string,
): boolean {
  const label = sourceLabel.trim();
  const suffix = metadataSuffix.trim();
  if (!label || !suffix) return false;
  if (suffix === label) return true;
  if (suffix === `+ ${label}`) return true;
  return false;
}

/** Insert CLI: canonical metadata from pack sourceLabel + tag; optional suffix/override. */
export function resolveInsertMetadata(input: {
  tagName: string;
  sourceLabel: string;
  requiredEnlightenment?: number | null;
  metadataOverride?: string | null;
  metadataSuffix?: string | null;
  isDevour?: boolean;
}): string {
  const override = input.metadataOverride?.trim();
  if (override) return override;

  const isDevour =
    input.isDevour === true &&
    !metadataAlreadyContainsDevour(input.sourceLabel, input.metadataSuffix);

  const canonical = buildAtmMetadata({
    sourceLabel: input.sourceLabel,
    tagName: input.tagName,
    requiredEnlightenment: input.requiredEnlightenment,
    isDevour,
  });

  const suffix = input.metadataSuffix?.trim();
  if (!suffix) return canonical;
  if (isRedundantMetadataSuffix(input.sourceLabel, suffix)) return canonical;
  return `${canonical} ${suffix}`.trim();
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
