import { combineSameTagScalar } from "@/lib/path-carver/combine-same-tag-scalar";
import { manifestationHitCountKey } from "@/lib/path-carver/copy-instances";
import {
  effectiveManifestationScalar,
  type EffectiveScalarOptions,
} from "@/lib/path-carver/effective-value-scalar";
import { matchesDemandTag } from "@/lib/simulator/tag-matching";
import {
  DEFAULT_COPY_INSTANCE_FIELDS,
  NON_REALM_MANIFESTATION_FIELDS,
  type Awakener,
  type Manifestation,
  type ManifestationSourceKind,
  type Tag,
} from "@/lib/team-data/types";

/** Attacker.Tentacle */
export const ATTACKER_TENTACLE_TAG_ID = 5;

/** Attacker.Active Damage (prefix + descendants). */
export const ATTACKER_ACTIVE_DAMAGE_TAG_ID = 42;

/** Support.Tentacle Damage Up */
export const SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID = 29;

/** Support.Tentacle Damage Up.Fixed */
export const SUPPORT_TENTACLE_DAMAGE_UP_FIXED_TAG_ID = 75;

/** Support.Unique Tentacle Damage Up */
export const SUPPORT_UNIQUE_TENTACLE_DAMAGE_UP_TAG_ID = 122;

/** Special.Hit = Tentacle Attack */
export const SPECIAL_HIT_TENTACLE_ATTACK_TAG_ID = 151;

/** Exact TDU-family ids summed into the Tentacle product pool. */
export const HIT_TENTACLE_TDU_FAMILY_TAG_IDS: readonly number[] = [
  SUPPORT_UNIQUE_TENTACLE_DAMAGE_UP_TAG_ID,
  SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID,
  SUPPORT_TENTACLE_DAMAGE_UP_FIXED_TAG_ID,
];

/**
 * TDU-family modifiers skipped on every Attacker.Tentacle subject.
 * Pool hop applies Unique + TDU + TDU.Fixed once (Phase 3e). TDI 3 / 75 / 77
 * are soft-deleted; this skip remains belt-and-suspenders.
 */
export const HIT_TENTACLE_SKIP_MODIFIER_TAG_IDS: ReadonlySet<number> = new Set(
  HIT_TENTACLE_TDU_FAMILY_TAG_IDS,
);

export const REQUIRED_HIT_TENTACLE_TAG_IDS: readonly number[] = [
  SPECIAL_HIT_TENTACLE_ATTACK_TAG_ID,
  ATTACKER_TENTACLE_TAG_ID,
  ATTACKER_ACTIVE_DAMAGE_TAG_ID,
  ...HIT_TENTACLE_TDU_FAMILY_TAG_IDS,
];

/** Offset distinct from Base Tentacle Damage (4e6) and created-base (900k). */
const DERIVED_ID_OFFSET = 5_000_000;

/** Room for 100 Hit channels per awakener before the 6e6 TDU-pool id band. */
const HIT_CHANNEL_OWNER_STRIDE = 100;

const TEAM_POOL_OWNER = "*team*";

export type OwnerTagTotals = ReadonlyMap<
  string,
  ReadonlyMap<number, number>
>;

export type HitTentacleChannel =
  | { kind: "realm" }
  | {
      kind: "row";
      sourceKind: ManifestationSourceKind;
      manifestationId: number;
    };

export type HitTentacleChannelPlan = {
  owner: string;
  awakenerId: number;
  hits: number;
  factor: number;
  /** Integer tentacle attacks for this channel (equals hits; not hits×factor). */
  attacks: number;
  slotIndex: number | null;
  channel: HitTentacleChannel;
  channelSeq: number;
  channelLabel: string;
};

export type HitTentacleSynthetic = {
  manifestation: Manifestation;
  owner: string;
  hits: number;
  factor: number;
  attacks: number;
  channelLabel: string;
};

/**
 * Stable negative id per (awakener, channel).
 * channelSeq 0 = summed realm Hit; 1+ = each non-realm Hit row.
 */
export function hitTentacleAttackManifestationId(
  awakenerId: number,
  channelSeq = 0,
): number {
  return -(
    DERIVED_ID_OFFSET +
    50_000 +
    awakenerId * HIT_CHANNEL_OWNER_STRIDE +
    channelSeq
  );
}

export function isHitTentacleAttackManifestation(
  m: Pick<Manifestation, "id" | "awakenerId" | "sourceKind">,
): boolean {
  if (m.sourceKind !== "awakener" || m.awakenerId == null) return false;
  if (!Number.isInteger(m.id) || m.id >= 0) return false;
  const mag = -m.id;
  return mag >= DERIVED_ID_OFFSET && mag < DERIVED_ID_OFFSET + 1_000_000;
}

export function isHitTentacleSkipModifier(modifierTagId: number | null): boolean {
  return modifierTagId != null && HIT_TENTACLE_SKIP_MODIFIER_TAG_IDS.has(modifierTagId);
}

export function isActiveDamageTagName(tagName: string): boolean {
  return matchesDemandTag(tagName, "Attacker.Active Damage");
}

export function isHitTentacleAttackTagName(tagName: string): boolean {
  return tagName === "Special.Hit = Tentacle Attack";
}

/** Matches apply-interactions ownerKeyFor for awakener / realm / posse. */
export function hitConversionOwnerKey(m: Manifestation): string {
  if (m.sourceKind === "posse") return "posse";
  if (m.sourceKind === "realm") return "realm";
  if (m.awakenerId != null) return `awakener:${m.awakenerId}`;
  return `orphan:${m.sourceKind}:${m.id}`;
}

function awakenerIdFromOwnerKey(owner: string): number | null {
  const match = /^awakener:(\d+)$/.exec(owner);
  if (!match) return null;
  return Number(match[1]);
}

function getOwnerTagValue(
  ownerValues: OwnerTagTotals,
  owner: string,
  tagId: number,
): number {
  return ownerValues.get(owner)?.get(tagId) ?? 0;
}

/**
 * hits × factor × pool, then ceil (same as non-percent `multiply`).
 */
export function computeHitTentacleProduct(
  hits: number,
  factor: number,
  pool: number,
): number {
  if (hits === 0 || factor === 0 || pool === 0) return 0;
  return Math.ceil(hits * factor * pool);
}

function isHitSelf(m: Manifestation): boolean {
  return m.targetType === "self";
}

function hitAppliesToOwner(m: Manifestation, owner: string): boolean {
  if (!isHitTentacleAttackTagName(m.tagName)) return false;
  if (isHitSelf(m) && hitConversionOwnerKey(m) !== owner) return false;
  return true;
}

function hitRowScalar(
  m: Manifestation,
  awakenersById: ReadonlyMap<number, Awakener>,
  tagsById: Readonly<Record<number, Tag>>,
  scalarOpts?: EffectiveScalarOptions,
): number {
  return effectiveManifestationScalar(m, awakenersById, tagsById, scalarOpts);
}

/**
 * Sum applied realm Special.Hit rows that apply to this owner.
 * Self Hit only for that owner; aoe / single / null apply to all.
 */
export function combineRealmHitFactorForOwner(
  applied: readonly Manifestation[],
  owner: string,
  awakenersById: ReadonlyMap<number, Awakener>,
  tagsById: Readonly<Record<number, Tag>>,
  scalarOpts?: EffectiveScalarOptions,
): number {
  const hitTag = tagsById[SPECIAL_HIT_TENTACLE_ATTACK_TAG_ID];
  let combined: number | undefined;
  for (const m of applied) {
    if (m.sourceKind !== "realm") continue;
    if (!hitAppliesToOwner(m, owner)) continue;
    const scalar = hitRowScalar(m, awakenersById, tagsById, scalarOpts);
    if (scalar === 0) continue;
    combined = combineSameTagScalar(
      combined,
      scalar,
      hitTag?.isAdditive !== false,
      hitTag?.isPercent === true,
    );
  }
  return combined ?? 0;
}

function channelLabelFor(channel: HitTentacleChannel): string {
  if (channel.kind === "realm") return "realm";
  return `${channel.sourceKind}:${channel.manifestationId}`;
}

function hitCountOf(
  m: Manifestation,
  hitCountByManifestationKey: ReadonlyMap<string, number> | undefined,
): number {
  return hitCountByManifestationKey?.get(manifestationHitCountKey(m)) ?? 1;
}

/**
 * Sum Layer A hitCounts of applied Active Damage (+ descendants) for one owner.
 */
export function sumActiveDamageHitsForOwner(
  applied: readonly Manifestation[],
  owner: string,
  hitCountByManifestationKey?: ReadonlyMap<string, number>,
): { hits: number; slotIndex: number | null } {
  let hits = 0;
  let slotIndex: number | null = null;
  for (const m of applied) {
    if (!isActiveDamageTagName(m.tagName)) continue;
    if (hitConversionOwnerKey(m) !== owner) continue;
    hits += hitCountOf(m, hitCountByManifestationKey);
    if (m.slotIndex != null) {
      slotIndex =
        slotIndex == null ? m.slotIndex : Math.min(slotIndex, m.slotIndex);
    }
  }
  return { hits, slotIndex };
}

/**
 * One plan per (Active Damage owner × Hit channel).
 * Realm Hit rows are summed into a single channel; every non-realm row is its own.
 */
export function collectHitTentacleChannelPlans(
  applied: readonly Manifestation[],
  awakenersById: ReadonlyMap<number, Awakener>,
  tagsById: Readonly<Record<number, Tag>>,
  hitCountByManifestationKey?: ReadonlyMap<string, number>,
  scalarOpts?: EffectiveScalarOptions,
): HitTentacleChannelPlan[] {
  const hasHit = applied.some((m) => isHitTentacleAttackTagName(m.tagName));
  if (!hasHit) return [];

  const owners = new Set<string>();
  for (const m of applied) {
    if (!isActiveDamageTagName(m.tagName)) continue;
    const owner = hitConversionOwnerKey(m);
    if (awakenerIdFromOwnerKey(owner) == null) continue;
    owners.add(owner);
  }

  const plans: HitTentacleChannelPlan[] = [];
  for (const owner of [...owners].sort()) {
    const awakenerId = awakenerIdFromOwnerKey(owner);
    if (awakenerId == null) continue;
    const { hits, slotIndex } = sumActiveDamageHitsForOwner(
      applied,
      owner,
      hitCountByManifestationKey,
    );
    if (hits === 0) continue;

    let channelSeq = 0;
    const realmFactor = combineRealmHitFactorForOwner(
      applied,
      owner,
      awakenersById,
      tagsById,
      scalarOpts,
    );
    if (realmFactor !== 0) {
      const channel: HitTentacleChannel = { kind: "realm" };
      plans.push({
        owner,
        awakenerId,
        hits,
        factor: realmFactor,
        attacks: hits,
        slotIndex,
        channel,
        channelSeq,
        channelLabel: channelLabelFor(channel),
      });
      channelSeq += 1;
    }

    const rowHits = applied
      .filter(
        (m) =>
          m.sourceKind !== "realm" &&
          hitAppliesToOwner(m, owner) &&
          hitRowScalar(m, awakenersById, tagsById, scalarOpts) !== 0,
      )
      .sort((a, b) => a.id - b.id || a.sourceKind.localeCompare(b.sourceKind));

    for (const m of rowHits) {
      const factor = hitRowScalar(m, awakenersById, tagsById, scalarOpts);
      if (factor === 0) continue;
      const channel: HitTentacleChannel = {
        kind: "row",
        sourceKind: m.sourceKind,
        manifestationId: m.id,
      };
      plans.push({
        owner,
        awakenerId,
        hits,
        factor,
        attacks: hits,
        slotIndex,
        channel,
        channelSeq,
        channelLabel: channelLabelFor(channel),
      });
      channelSeq += 1;
    }
  }
  return plans.sort(
    (a, b) =>
      a.awakenerId - b.awakenerId || a.channelSeq - b.channelSeq,
  );
}

function combineTagAcrossOwners(
  ownerValues: OwnerTagTotals,
  tagId: number,
  tag: Tag | undefined,
  owners: Iterable<string>,
): number {
  let combined: number | undefined;
  for (const owner of owners) {
    const v = getOwnerTagValue(ownerValues, owner, tagId);
    if (v === 0) continue;
    combined = combineSameTagScalar(
      combined,
      v,
      tag?.isAdditive !== false,
      tag?.isPercent === true,
    );
  }
  return combined ?? 0;
}

/** Debug / hop-4d label for the combined per-strike TDU family pool. */
export const TENTACLE_TDU_FAMILY_POOL_LABEL =
  "TDU family pool (Unique+TDU+Fixed)";

export type TduFamilyPoolBreakdown = {
  unique: number;
  tdu: number;
  fixed: number;
  total: number;
};

/**
 * One TDU-family tag's scoped contribution for a Tentacle owner.
 * Self modifiers only count for that owner; aoe/null/realm count for everyone.
 */
function partialTduFamilyTagForOwner(
  ownerValues: OwnerTagTotals,
  applied: readonly Manifestation[],
  tentacleOwner: string,
  tagId: number,
  tag: Tag | undefined,
): number {
  const modifierManifests = applied.filter((m) => m.tagId === tagId);
  const selfOwners = new Set<string>();
  let hasNonSelfModifier = false;
  for (const modM of modifierManifests) {
    if (modM.targetType === "self") {
      selfOwners.add(hitConversionOwnerKey(modM));
    } else {
      hasNonSelfModifier = true;
    }
  }
  const synthesized =
    getOwnerTagValue(ownerValues, TEAM_POOL_OWNER, tagId) !== 0;
  if (modifierManifests.length === 0 && synthesized) {
    hasNonSelfModifier = true;
  }

  if (selfOwners.has(tentacleOwner)) {
    return combineTagAcrossOwners(ownerValues, tagId, tag, [
      tentacleOwner,
      TEAM_POOL_OWNER,
    ]);
  }
  if (!hasNonSelfModifier) return 0;

  const nonSelfOwners = new Set<string>();
  for (const modM of modifierManifests) {
    if (modM.targetType === "self") continue;
    nonSelfOwners.add(hitConversionOwnerKey(modM));
  }
  return combineTagAcrossOwners(ownerValues, tagId, tag, [
    ...nonSelfOwners,
    TEAM_POOL_OWNER,
  ]);
}

/**
 * Exact-id TDU family pool for one Tentacle owner.
 * Self modifiers only count for that owner; aoe/null/realm count for everyone.
 */
export function combineTduFamilyPool(
  ownerValues: OwnerTagTotals,
  applied: readonly Manifestation[],
  tentacleOwner: string,
  tagsById: Readonly<Record<number, Tag>>,
): number {
  return combineTduFamilyPoolBreakdown(
    ownerValues,
    applied,
    tentacleOwner,
    tagsById,
  ).total;
}

/** Per-tag TDU family parts for hop 4d debug provenance. */
export function combineTduFamilyPoolBreakdown(
  ownerValues: OwnerTagTotals,
  applied: readonly Manifestation[],
  tentacleOwner: string,
  tagsById: Readonly<Record<number, Tag>>,
): TduFamilyPoolBreakdown {
  const unique = partialTduFamilyTagForOwner(
    ownerValues,
    applied,
    tentacleOwner,
    SUPPORT_UNIQUE_TENTACLE_DAMAGE_UP_TAG_ID,
    tagsById[SUPPORT_UNIQUE_TENTACLE_DAMAGE_UP_TAG_ID],
  );
  const tdu = partialTduFamilyTagForOwner(
    ownerValues,
    applied,
    tentacleOwner,
    SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID,
    tagsById[SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID],
  );
  const fixed = partialTduFamilyTagForOwner(
    ownerValues,
    applied,
    tentacleOwner,
    SUPPORT_TENTACLE_DAMAGE_UP_FIXED_TAG_ID,
    tagsById[SUPPORT_TENTACLE_DAMAGE_UP_FIXED_TAG_ID],
  );
  return { unique, tdu, fixed, total: unique + tdu + fixed };
}

export function buildHitTentacleAttackManifestation(
  plan: HitTentacleChannelPlan,
  tagsById: Readonly<Record<number, Tag>>,
): Manifestation {
  const tag = tagsById[ATTACKER_TENTACLE_TAG_ID];
  return {
    id: hitTentacleAttackManifestationId(plan.awakenerId, plan.channelSeq),
    sourceKind: "awakener",
    awakenerId: plan.awakenerId,
    slotIndex: plan.slotIndex,
    sourceName: "Hit = Tentacle Attack",
    tagId: ATTACKER_TENTACLE_TAG_ID,
    tagName: tag?.tagName ?? "Attacker.Tentacle",
    triggerCondition: null,
    valueScalar: plan.hits,
    ...DEFAULT_COPY_INSTANCE_FIELDS,
    dependencyStat: null,
    sourceType: "tentacle",
    targetType: "aoe",
    buffTargetTypeRestriction: null,
    metadata:
      `Special.Hit = Tentacle Attack | attacks=${plan.attacks}` +
      ` factor=${plan.factor} source=${plan.channelLabel}`,
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
    isBaseStatTransfer: false,
    isCreatedBase: true,
    ...NON_REALM_MANIFESTATION_FIELDS,
  };
}

export function buildHitTentacleSynthetics(
  applied: readonly Manifestation[],
  awakenersById: ReadonlyMap<number, Awakener>,
  tagsById: Readonly<Record<number, Tag>>,
  hitCountByManifestationKey?: ReadonlyMap<string, number>,
  scalarOpts?: EffectiveScalarOptions,
): HitTentacleSynthetic[] {
  const tentacleTag = tagsById[ATTACKER_TENTACLE_TAG_ID];
  if (!tentacleTag) return [];
  const plans = collectHitTentacleChannelPlans(
    applied,
    awakenersById,
    tagsById,
    hitCountByManifestationKey,
    scalarOpts,
  );
  return plans.map((plan) => ({
    manifestation: buildHitTentacleAttackManifestation(plan, tagsById),
    owner: plan.owner,
    hits: plan.hits,
    factor: plan.factor,
    attacks: plan.attacks,
    channelLabel: plan.channelLabel,
  }));
}
