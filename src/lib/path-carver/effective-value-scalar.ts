import type {
  AllStats,
  Awakener,
  AwakenerLocalManifestationInteraction,
  Manifestation,
  ManifestationSourceKind,
  PureBonusTarget,
  Tag,
} from "@/lib/team-data/types";
import type { TeamRealmResolution } from "@/lib/team-data/resolve-team-realms";

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
 * Options for effective scalar resolution.
 * Legacy call sites may pass `teamMaxHp` as a bare number (4th arg).
 */
export type EffectiveScalarOptions = {
  teamMaxHp?: number | null;
  /** Team sum of total-base realmMastery (realm rows). */
  realmMasteryTotal?: number;
  /** Team realm resolution for purity / combo stacks on realm rows. */
  teamRealms?: TeamRealmResolution;
};

export function normalizeEffectiveScalarOptions(
  teamMaxHpOrOptions?: number | null | EffectiveScalarOptions,
): EffectiveScalarOptions {
  if (teamMaxHpOrOptions == null) return {};
  if (typeof teamMaxHpOrOptions === "number") {
    return { teamMaxHp: teamMaxHpOrOptions };
  }
  return teamMaxHpOrOptions;
}

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

export function sumTeamRealmMastery(
  awakeners: Iterable<Awakener>,
): number {
  let sum = 0;
  for (const a of awakeners) {
    sum += a.realmMastery ?? 0;
  }
  return sum;
}

function teamStatTotal(
  awakeners: Iterable<Awakener>,
  stat: AllStats,
): number {
  if (stat === "team_max_hp" || stat === "enemy_max_hp") return 0;
  let sum = 0;
  for (const a of awakeners) {
    sum += awakenerStatForDependency(a, stat) ?? 0;
  }
  return sum;
}

function pureMult(
  target: PureBonusTarget | null | undefined,
  want: PureBonusTarget,
  isPure: boolean,
): number {
  return target === want && isPure ? 2 : 1;
}

/**
 * Realm-only effective scalar (flat / multiply / rate-scaled + pure + combo ×N).
 */
export function scaleRealmValueScalar(
  m: Manifestation,
  options: EffectiveScalarOptions,
  tagIsPercent: boolean,
  awakenersById: ReadonlyMap<number, Awakener>,
): number {
  const raw = m.valueScalar;
  if (raw == null) return 0;

  const realmId = m.realmId;
  const teamRealms = options.teamRealms;
  const isPure =
    realmId != null && teamRealms != null ? teamRealms.isPure(realmId) : false;

  const scalarMult = pureMult(m.pureBonusTarget, "value_scalar", isPure);
  const rateMult = pureMult(m.pureBonusTarget, "dependency_rate", isPure);

  const hasRatePair =
    m.dependencyRate != null && m.dependencyRateStat != null;

  let effective: number;

  if (m.dependencyStat == null && !hasRatePair) {
    // Flat (incl. pure double on value_scalar)
    effective = raw * scalarMult;
  } else if (
    m.dependencyStat != null &&
    m.dependencyRate != null &&
    m.dependencyRateStat != null
  ) {
    // Rate-scaled: base_stat * (base_rate + rate * rate_stat * rate_mult)
    const baseStat = resolveRealmBaseStat(
      m.dependencyStat,
      options,
      awakenersById,
    );
    const rateStat = resolveRealmRateStat(
      m.dependencyRateStat,
      options,
      awakenersById,
    );
    const baseRate = raw * scalarMult;
    const rawProduct =
      baseStat * (baseRate + m.dependencyRate * rateStat * rateMult);
    effective = ceilAfterDependencyScale(rawProduct, tagIsPercent);
  } else if (m.dependencyStat != null) {
    // Multiply-only
    if (ALWAYS_IGNORED_DEPENDENCY_STATS.has(m.dependencyStat)) {
      effective = raw * scalarMult;
    } else {
      const baseStat = resolveRealmBaseStat(
        m.dependencyStat,
        options,
        awakenersById,
      );
      if (m.dependencyStat === "team_max_hp" && options.teamMaxHp == null) {
        effective = raw * scalarMult;
      } else if (PERCENT_DEPENDENCY_STATS.has(m.dependencyStat)) {
        const product = raw * scalarMult * 100 * (baseStat * 100);
        effective = ceilAfterDependencyScale(product, tagIsPercent);
      } else {
        effective = ceilAfterDependencyScale(
          raw * scalarMult * baseStat,
          tagIsPercent,
        );
      }
    }
  } else {
    // dependency_rate set but dependency_rate_stat null → treat as flat
    effective = raw * scalarMult;
  }

  if (m.requiredRealmMode === "combo" && teamRealms != null) {
    effective *= teamRealms.chaosComboStacks;
  }

  return effective;
}

function resolveRealmBaseStat(
  stat: AllStats,
  options: EffectiveScalarOptions,
  awakenersById: ReadonlyMap<number, Awakener>,
): number {
  if (stat === "enemy_max_hp") return 0;
  if (stat === "team_max_hp") return options.teamMaxHp ?? 0;
  if (stat === "realm_mastery") {
    return options.realmMasteryTotal ?? teamStatTotal(awakenersById.values(), "realm_mastery");
  }
  return teamStatTotal(awakenersById.values(), stat);
}

function resolveRealmRateStat(
  stat: AllStats,
  options: EffectiveScalarOptions,
  awakenersById: ReadonlyMap<number, Awakener>,
): number {
  return resolveRealmBaseStat(stat, options, awakenersById);
}

/**
 * Phase 2b Part A — resolve effective value_scalar via dependency_stat.
 *
 * - posse: always raw (ignore dependency_stat)
 * - realm: flat / multiply / rate-scaled + pure + combo (see scaleRealmValueScalar)
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

/** Effective scalar for a manifestation row (ATM / covenant / wheel / posse / realm). */
export function effectiveManifestationScalar(
  m: Manifestation,
  awakenersById: ReadonlyMap<number, Awakener>,
  tagsById: Readonly<Record<number, Tag>>,
  teamMaxHpOrOptions?: number | null | EffectiveScalarOptions,
): number {
  const options = normalizeEffectiveScalarOptions(teamMaxHpOrOptions);
  const tagIsPercent = tagsById[m.tagId]?.isPercent === true;

  if (m.sourceKind === "realm") {
    return scaleRealmValueScalar(m, options, tagIsPercent, awakenersById);
  }

  return scaleValueScalar(
    m.valueScalar,
    m.dependencyStat,
    ownerAwakenerForManifestation(m, awakenersById),
    m.sourceKind,
    tagIsPercent,
    options.teamMaxHp,
  );
}

/**
 * Effective factor from an override value_scalar (scaled by override.dependency_stat).
 * Owner = parent ATM awakener. Falls back to interaction defaultFactor when override
 * has no value_scalar. Ceil precision follows the modifier tag's is_percent.
 */
export function effectiveOverrideFactor(
  override: AwakenerLocalManifestationInteraction | null,
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

/** True when the subject contributes absolute scalar only (no inbound ops). */
export function isInteractionImmuneSubject(m: Manifestation): boolean {
  if (m.isBaseStatTransfer || m.sourceKind === "realm") return true;
  // Support created bases: absolute merge only; Attacker/Defender created bases are subjects.
  if (
    m.isCreatedBase &&
    !m.tagName.startsWith("Attacker.") &&
    !m.tagName.startsWith("Defender.")
  ) {
    return true;
  }
  return false;
}
