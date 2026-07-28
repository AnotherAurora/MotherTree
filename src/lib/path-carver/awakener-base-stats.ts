import {
  buildAwakenersById,
  effectiveManifestationScalar,
} from "@/lib/path-carver/effective-value-scalar";
import {
  IN_MISSION_DEATH_RESIST_TAG_ID,
  SPECIAL_CAUSE_DEATH_RESIST_TRIGGER_TAG_ID,
} from "@/lib/path-carver/death-resist-trigger";
import type {
  AllStats,
  Awakener,
  GearStatContribution,
  Manifestation,
  Tag,
  TargetType,
  TeamData,
} from "@/lib/team-data/types";

/** Special.Increase Base Keyflare — boosts keyflare_regen after DR. */
export const SPECIAL_INCREASE_BASE_KEYFLARE_TAG_ID = 131;

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
  IN_MISSION_DEATH_RESIST_TAG_ID,
  SPECIAL_CAUSE_DEATH_RESIST_TRIGGER_TAG_ID,
];

/**
 * Round up(15 + 144 * (x − 15) / (x + 129)) where x is summed keyflare_regen.
 */
export function applyKeyflareDiminishingReturn(x: number): number {
  return Math.ceil(15 + (144 * (x - 15)) / (x + 129));
}

/**
 * Aliemus regen diminishing return — formula TBD.
 * TODO: replace passthrough when formula is defined.
 */
export function applyAliemusDiminishingReturn(x: number): number {
  return x;
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
  }
}

/**
 * After DR: finalKeyflare = ceil(originalDr * (1 + Σ effective Special.Increase scalars)).
 * Each source uses the same original (additive scalars, not chained).
 * Special.Increase rows scale with pre-boost totals if they have dependency_stat.
 */
function applySpecialIncreaseBaseKeyflare(
  byId: Map<number, Awakener>,
  appliedManifestations: readonly Manifestation[],
): void {
  const preBoostById = buildAwakenersById([...byId.values()]);
  const boostSumByAwakener = new Map<number, number>();

  for (const m of appliedManifestations) {
    if (m.tagId !== SPECIAL_INCREASE_BASE_KEYFLARE_TAG_ID) continue;
    if (m.isBaseStatTransfer) continue;
    if (m.awakenerId == null) continue;

    const scalar = effectiveManifestationScalar(m, preBoostById);
    boostSumByAwakener.set(
      m.awakenerId,
      (boostSumByAwakener.get(m.awakenerId) ?? 0) + scalar,
    );
  }

  for (const [awakenerId, sum] of boostSumByAwakener) {
    const totals = byId.get(awakenerId);
    if (!totals || totals.keyflareRegen == null) continue;
    // Post-boost keyflare is what dependency_stat=keyflare_regen uses.
    totals.keyflareRegen = Math.ceil(totals.keyflareRegen * (1 + sum));
  }
}

/**
 * Per-awakener total base stats: table stats + equipped gear, then DR, then
 * Special.Increase Base Keyflare. Result feeds dependency_stat scaling.
 */
export function computeAwakenerTotalBaseStats(
  teamData: Pick<TeamData, "awakeners" | "gearStatContributions">,
  appliedManifestations: readonly Manifestation[],
): Awakener[] {
  const byId = sumGearOntoAwakeners(
    teamData.awakeners,
    teamData.gearStatContributions,
  );
  applyDiminishingReturns(byId);
  applySpecialIncreaseBaseKeyflare(byId, appliedManifestations);
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
        baseHits: null,
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
      });
    }
  }

  return out;
}
