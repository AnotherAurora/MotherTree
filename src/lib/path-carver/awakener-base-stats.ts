import {
  buildAwakenersById,
  effectiveManifestationScalar,
  ceilRealmMastery,
} from "@/lib/path-carver/effective-value-scalar";
import { REQUIRED_BASE_TENTACLE_TAG_IDS } from "@/lib/path-carver/base-tentacle-damage";
import {
  DEFENDER_MAX_HP_UP_TAG_ID,
  IN_MISSION_DEATH_RESIST_TAG_ID,
  SPECIAL_CAUSE_DEATH_RESIST_TRIGGER_TAG_ID,
} from "@/lib/path-carver/death-resist-trigger";
import { REQUIRED_KEYFLARE_TO_POSSE_TAG_IDS } from "@/lib/path-carver/keyflare-to-posse";
import {
  DEFAULT_COPY_INSTANCE_FIELDS,
  NON_REALM_MANIFESTATION_FIELDS,
  type AllStats,
  type Awakener,
  type GearStatContribution,
  type Manifestation,
  type Tag,
  type TargetType,
  type TeamData,
} from "@/lib/team-data/types";

/** Special.Increase Base Keyflare — boosts keyflare_regen after DR. */
export const SPECIAL_INCREASE_BASE_KEYFLARE_TAG_ID = 131;
/** Special.Increase Base ATK — boosts atk after gear (+ DR for other stats). */
export const SPECIAL_INCREASE_BASE_ATK_TAG_ID = 153;
/** Special.Increase Base DEF — boosts def after gear (+ DR for other stats). */
export const SPECIAL_INCREASE_BASE_DEF_TAG_ID = 154;

/**
 * Base stats that become synthetic Support/Defender tags.
 * Tag ids (not names) are the source of truth.
 */
export const BASE_STAT_TRANSFER_SPECS = [
  {
    stat: "damage_amp" as const,
    tagId: 16,
    targetType: "aoe" as TargetType,
    read: (a: Awakener) => a.damageAmp,
  },
  {
    stat: "crit_rate" as const,
    tagId: 18,
    targetType: "self" as TargetType,
    read: (a: Awakener) => a.critRate,
  },
  {
    stat: "crit_dmg" as const,
    tagId: 17,
    targetType: "self" as TargetType,
    read: (a: Awakener) => a.critDmg,
  },
  {
    stat: "realm_mastery" as const,
    tagId: 63,
    targetType: "aoe" as TargetType,
    read: (a: Awakener) => a.realmMastery,
  },
  {
    stat: "aliemus_regen" as const,
    tagId: 28,
    targetType: "self" as TargetType,
    read: (a: Awakener) => a.aliemusRegen,
  },
  {
    /** Defender.Base Death Resist */
    stat: "death_resist" as const,
    tagId: 12,
    targetType: "aoe" as TargetType,
    read: (a: Awakener) => a.deathResist,
  },
] as const;

/** Tag ids that must be present in TeamData.tagsById for base-stat / derived math. */
export const REQUIRED_BASE_STAT_TAG_IDS: readonly number[] = [
  ...BASE_STAT_TRANSFER_SPECS.map((s) => s.tagId),
  SPECIAL_INCREASE_BASE_KEYFLARE_TAG_ID,
  SPECIAL_INCREASE_BASE_ATK_TAG_ID,
  SPECIAL_INCREASE_BASE_DEF_TAG_ID,
  IN_MISSION_DEATH_RESIST_TAG_ID,
  SPECIAL_CAUSE_DEATH_RESIST_TRIGGER_TAG_ID,
  DEFENDER_MAX_HP_UP_TAG_ID,
  ...REQUIRED_KEYFLARE_TO_POSSE_TAG_IDS,
  ...REQUIRED_BASE_TENTACLE_TAG_IDS,
];

/**
 * Round up(15 + 144 * (x − 15) / (x + 129)) where x is summed keyflare_regen.
 */
export function applyKeyflareDiminishingReturn(x: number): number {
  return Math.ceil(15 + (144 * (x - 15)) / (x + 129));
}

/**
 * Aliemus regen diminishing return:
 * ceil(x * (1 - (x / 0.2) / (x / 0.2 + 360)))
 */
export function applyAliemusDiminishingReturn(x: number): number {
  return Math.ceil(x * (1 - x / 0.2 / (x / 0.2 + 360)));
}

function cloneAwakener(a: Awakener): Awakener {
  return { ...a };
}

export function applyGearStatAmount(
  totals: Awakener,
  stat: AllStats,
  amount: number,
): void {
  switch (stat) {
    case "con":
      totals.con = (totals.con ?? 0) + amount;
      break;
    case "atk":
      totals.atk = (totals.atk ?? 0) + amount;
      break;
    case "def":
      totals.def = (totals.def ?? 0) + amount;
      break;
    case "keyflare_regen":
      totals.keyflareRegen = (totals.keyflareRegen ?? 0) + amount;
      break;
    case "damage_amp":
      totals.damageAmp = (totals.damageAmp ?? 0) + amount;
      break;
    case "crit_rate":
      totals.critRate = (totals.critRate ?? 0) + amount;
      break;
    case "crit_dmg":
      totals.critDmg = (totals.critDmg ?? 0) + amount;
      break;
    case "realm_mastery":
      totals.realmMastery = (totals.realmMastery ?? 0) + amount;
      break;
    case "base_aliemus":
      totals.baseAliemus = (totals.baseAliemus ?? 0) + amount;
      break;
    case "aliemus_regen":
      totals.aliemusRegen = (totals.aliemusRegen ?? 0) + amount;
      break;
    case "sigil_yield":
      totals.sigilYield = (totals.sigilYield ?? 0) + amount;
      break;
    case "death_resist":
      totals.deathResist = (totals.deathResist ?? 0) + amount;
      break;
    case "team_max_hp":
    case "enemy_max_hp":
      break;
    default: {
      const _exhaustive: never = stat;
      void _exhaustive;
    }
  }
}

function sumGearOntoAwakeners(
  awakeners: readonly Awakener[],
  contributions: readonly GearStatContribution[],
): Map<number, Awakener> {
  const byId = new Map<number, Awakener>();
  for (const a of awakeners) {
    byId.set(a.id, cloneAwakener(a));
  }

  for (const c of contributions) {
    const totals = byId.get(c.awakenerId);
    if (!totals) continue;
    if (c.stat == null || c.statAmount == null) continue;
    applyGearStatAmount(totals, c.stat, c.statAmount);
  }

  return byId;
}

function applyDiminishingReturns(byId: Map<number, Awakener>): void {
  for (const totals of byId.values()) {
    if (totals.keyflareRegen != null) {
      totals.keyflareRegen = applyKeyflareDiminishingReturn(
        totals.keyflareRegen,
      );
    }
    if (totals.aliemusRegen != null) {
      totals.aliemusRegen = applyAliemusDiminishingReturn(totals.aliemusRegen);
    }
    // Realm Mastery itself rounds up (gear + table can be fractional).
    if (totals.realmMastery != null) {
      totals.realmMastery = ceilRealmMastery(totals.realmMastery);
    }
  }
}

/**
 * Recipients for a Special.Increase Base * row.
 * Realm (team-once) → every team awakener; owned non-realm → owner only.
 */
function specialIncreaseRecipients(
  m: Manifestation,
  byId: Map<number, Awakener>,
): number[] {
  if (m.sourceKind === "realm") return [...byId.keys()];
  if (m.awakenerId != null) return [m.awakenerId];
  return [];
}

/**
 * finalStat = ceil(preBoost * (1 + Σ effective Special.Increase scalars)).
 * Multiple sources stack additively on the same pre-boost base (not chained).
 * Rows with dependency_stat scale against preBoostById.
 */
function applySpecialIncreaseBaseStat(
  byId: Map<number, Awakener>,
  appliedManifestations: readonly Manifestation[],
  tagsById: Readonly<Record<number, Tag>>,
  preBoostById: ReadonlyMap<number, Awakener>,
  tagId: number,
  read: (a: Awakener) => number | null,
  write: (a: Awakener, value: number) => void,
): void {
  const boostSumByAwakener = new Map<number, number>();

  for (const m of appliedManifestations) {
    if (m.tagId !== tagId) continue;
    if (m.isBaseStatTransfer) continue;

    const recipients = specialIncreaseRecipients(m, byId);
    if (recipients.length === 0) continue;

    const scalar = effectiveManifestationScalar(m, preBoostById, tagsById);
    for (const awakenerId of recipients) {
      boostSumByAwakener.set(
        awakenerId,
        (boostSumByAwakener.get(awakenerId) ?? 0) + scalar,
      );
    }
  }

  for (const [awakenerId, sum] of boostSumByAwakener) {
    const totals = byId.get(awakenerId);
    if (!totals) continue;
    const current = read(totals);
    if (current == null) continue;
    // Epsilon before ceil so e.g. 100 * 1.1 is not 110.00000000000001 → 111.
    write(totals, Math.ceil(current * (1 + sum) - 1e-10));
  }
}

/**
 * Per-awakener total base stats: table stats + equipped gear, then DR, then
 * Special.Increase Base Keyflare / ATK / DEF. Result feeds dependency_stat scaling.
 */
export function computeAwakenerTotalBaseStats(
  teamData: Pick<TeamData, "awakeners" | "gearStatContributions" | "tagsById">,
  appliedManifestations: readonly Manifestation[],
): Awakener[] {
  const byId = sumGearOntoAwakeners(
    teamData.awakeners,
    teamData.gearStatContributions,
  );
  applyDiminishingReturns(byId);

  // One pre-boost snapshot so Keyflare / ATK / DEF do not feed each other.
  const preBoostById = buildAwakenersById([...byId.values()]);
  const tagsById = teamData.tagsById;

  applySpecialIncreaseBaseStat(
    byId,
    appliedManifestations,
    tagsById,
    preBoostById,
    SPECIAL_INCREASE_BASE_KEYFLARE_TAG_ID,
    (a) => a.keyflareRegen,
    (a, v) => {
      a.keyflareRegen = v;
    },
  );
  applySpecialIncreaseBaseStat(
    byId,
    appliedManifestations,
    tagsById,
    preBoostById,
    SPECIAL_INCREASE_BASE_ATK_TAG_ID,
    (a) => a.atk,
    (a, v) => {
      a.atk = v;
    },
  );
  applySpecialIncreaseBaseStat(
    byId,
    appliedManifestations,
    tagsById,
    preBoostById,
    SPECIAL_INCREASE_BASE_DEF_TAG_ID,
    (a) => a.def,
    (a, v) => {
      a.def = v;
    },
  );

  return [...byId.values()];
}

/** Stable negative id so subject-centric identity does not collide with DB rows. */
export function baseStatTransferManifestationId(
  awakenerId: number,
  tagId: number,
): number {
  return -(awakenerId * 1000 + tagId);
}

/**
 * Synthetic manifestations from total base stats.
 * value_scalar is absolute (no dependency_stat). Immune as interaction subjects.
 */
export function buildBaseStatTransferManifestations(
  totalAwakeners: readonly Awakener[],
  tagsById: Record<number, Tag>,
): Manifestation[] {
  const out: Manifestation[] = [];

  for (const awakener of totalAwakeners) {
    for (const spec of BASE_STAT_TRANSFER_SPECS) {
      const value = spec.read(awakener);
      if (value == null || value === 0) continue;

      const tag = tagsById[spec.tagId];
      out.push({
        id: baseStatTransferManifestationId(awakener.id, spec.tagId),
        sourceKind: "awakener",
        awakenerId: awakener.id,
        slotIndex: null,
        sourceName: "Base stat",
        tagId: spec.tagId,
        tagName: tag?.tagName ?? `#${spec.tagId}`,
        triggerCondition: null,
        valueScalar: value,
        ...DEFAULT_COPY_INSTANCE_FIELDS,
        dependencyStat: null,
        sourceType: null,
        targetType: spec.targetType,
        buffTargetTypeRestriction: null,
        metadata: null,
        isAccumulating: false,
        requiredEnlightenment: null,
        requiredAwakenerId: null,
        requiredAwakenerName: null,
        requiredRealm: null,
        requiredRealm2: null,
        requiredRealmId: null,
        requiredRealmId2: null,
        replacesManifestationId: null,
        interactionOverrides: [],
        isBaseStatTransfer: true,
        isCreatedBase: false,
        ...NON_REALM_MANIFESTATION_FIELDS,
      });
    }
  }

  return out;
}
