import type {
  AllStats,
  Awakener,
  InteractionOverride,
  Manifestation,
  ManifestationSourceKind,
  Tag,
} from "@/lib/team-data/types";

/** Percent dependency_stat: both operands ×100 before multiply. */
const PERCENT_DEPENDENCY_STATS = new Set<AllStats>([
  "damage_amp",
  "crit_rate",
  "crit_dmg",
  "sigil_yield",
  "death_resist",
]);

/** Keep raw value_scalar; do not scale (even when teamMaxHp context exists). */
const ALWAYS_IGNORED_DEPENDENCY_STATS = new Set<AllStats>(["enemy_max_hp"]);

/**
 * Map dependency_stat enum → awakener field.
 * keyflare_regen → keyflareRegen (never skey); crit_dmg → critDmg (never crit_damage).
 */
export function awakenerStatForDependency(
  awakener: Awakener,
  stat: AllStats,
): number | null {
  switch (stat) {
    case "con":
      return awakener.con;
    case "atk":
      return awakener.atk;
    case "def":
      return awakener.def;
    case "damage_amp":
      return awakener.damageAmp;
    case "crit_rate":
      return awakener.critRate;
    case "crit_dmg":
      return awakener.critDmg;
    case "realm_mastery":
      return awakener.realmMastery;
    case "keyflare_regen":
      return awakener.keyflareRegen;
    case "base_aliemus":
      return awakener.baseAliemus;
    case "aliemus_regen":
      return awakener.aliemusRegen;
    case "sigil_yield":
      return awakener.sigilYield;
    case "death_resist":
      return awakener.deathResist;
    case "team_max_hp":
    case "enemy_max_hp":
      return null;
    default: {
      const _exhaustive: never = stat;
      return _exhaustive;
    }
  }
}

export function isPercentDependencyStat(stat: AllStats): boolean {
  return PERCENT_DEPENDENCY_STATS.has(stat);
}

/**
 * Ceil after dependency_stat scaling — same precision as multiply ops:
 * tag.is_percent → 2 decimal places; otherwise whole number.
 */
function ceilAfterDependencyScale(
  product: number,
  tagIsPercent: boolean,
): number {
  if (tagIsPercent) return Math.ceil(product * 100) / 100;
  return Math.ceil(product);
}

/**
 * Phase 2b Part A — resolve effective value_scalar via dependency_stat.
 *
 * - posse: always raw (ignore dependency_stat)
 * - enemy_max_hp: raw
 * - team_max_hp: raw when teamMaxHp context missing; else raw × teamMaxHp
 * - null dependency_stat: raw
 * - null awakener stat: treat as 0
 * - percent dependency_stat: (raw * 100) * (stat * 100)
 * - else: raw * stat
 * - Ceil follows tag.is_percent (2 dp) vs whole number — not dependency_stat %
 * - Unscaled rows are not ceiled
 */
export function scaleValueScalar(
  raw: number | null,
  dependencyStat: AllStats | null,
  awakener: Awakener | null,
  sourceKind?: ManifestationSourceKind,
  tagIsPercent = false,
  teamMaxHp?: number | null,
): number {
  if (raw == null) return 0;
  if (sourceKind === "posse") return raw;
  if (dependencyStat == null) return raw;
  if (ALWAYS_IGNORED_DEPENDENCY_STATS.has(dependencyStat)) return raw;

  if (dependencyStat === "team_max_hp") {
    if (teamMaxHp == null) return raw;
    return ceilAfterDependencyScale(raw * teamMaxHp, tagIsPercent);
  }

  const statValue =
    awakener != null
      ? (awakenerStatForDependency(awakener, dependencyStat) ?? 0)
      : 0;

  const isPercentDep = PERCENT_DEPENDENCY_STATS.has(dependencyStat);
  const product = isPercentDep
    ? raw * 100 * (statValue * 100)
    : raw * statValue;
  return ceilAfterDependencyScale(product, tagIsPercent);
}

export function ownerAwakenerForManifestation(
  m: Manifestation,
  awakenersById: ReadonlyMap<number, Awakener>,
): Awakener | null {
  if (m.awakenerId == null) return null;
  return awakenersById.get(m.awakenerId) ?? null;
}

/** Effective scalar for a manifestation row (ATM / covenant / wheel / posse). */
export function effectiveManifestationScalar(
  m: Manifestation,
  awakenersById: ReadonlyMap<number, Awakener>,
  tagsById: Readonly<Record<number, Tag>>,
  teamMaxHp?: number | null,
): number {
  return scaleValueScalar(
    m.valueScalar,
    m.dependencyStat,
    ownerAwakenerForManifestation(m, awakenersById),
    m.sourceKind,
    tagsById[m.tagId]?.isPercent === true,
    teamMaxHp,
  );
}

/**
 * Effective factor from an override value_scalar (scaled by override.dependency_stat).
 * Owner = parent ATM awakener. Falls back to interaction defaultFactor when override
 * has no value_scalar. Ceil precision follows the modifier tag's is_percent.
 */
export function effectiveOverrideFactor(
  override: InteractionOverride | null,
  defaultFactor: number | null,
  ownerAwakener: Awakener | null,
  tagIsPercent = false,
  teamMaxHp?: number | null,
): number {
  if (override?.valueScalar != null) {
    return scaleValueScalar(
      override.valueScalar,
      override.dependencyStat,
      ownerAwakener,
      "awakener",
      tagIsPercent,
      teamMaxHp,
    );
  }
  return defaultFactor ?? 0;
}

export function buildAwakenersById(
  awakeners: readonly Awakener[],
): Map<number, Awakener> {
  const map = new Map<number, Awakener>();
  for (const a of awakeners) map.set(a.id, a);
  return map;
}
