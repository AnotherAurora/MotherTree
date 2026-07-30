import {
  NON_REALM_MANIFESTATION_FIELDS,
  type Manifestation,
  type Tag,
} from "@/lib/team-data/types";

/** Defender.Base Death Resist — awakener transfer / base total. */
export const DEFENDER_BASE_DEATH_RESIST_TAG_ID = 12;

/** Defender.Base Death Resist.In Mission Death Resist — converted + direct. */
export const IN_MISSION_DEATH_RESIST_TAG_ID = 147;

/** Special.Cause.Death Resist Trigger — count from combined In Mission. */
export const SPECIAL_CAUSE_DEATH_RESIST_TRIGGER_TAG_ID = 88;

/** Defender.Max HP Up — from DR reduction (+ any record/gear Max HP Up rows). */
export const DEFENDER_MAX_HP_UP_TAG_ID = 130;

/** Max absolute Death Resist removed by the 75% In Mission reduction (300%). */
const MAX_REDUCTION = 3;
/** 300% reduced DR maps to at most +10% Max HP. */
const MAX_HP_UP_FROM_REDUCTION_DIVISOR = 30;

/** Offset so derived ids never collide with baseStatTransferManifestationId. */
const DERIVED_ID_OFFSET = 1_000_000;

/**
 * Stable negative id for Death Resist derived synthetics (147 / 88 / 130).
 */
export function deathResistDerivedManifestationId(tagId: number): number {
  return -(DERIVED_ID_OFFSET + tagId);
}

/**
 * Absolute Death Resist removed when converting Base → In Mission.
 * Scalars: 1.0 = 100%; reduction capped at 300%.
 */
export function baseDeathResistReduction(base: number): number {
  if (base <= 0) return 0;
  return Math.min(base * 0.75, MAX_REDUCTION);
}

/**
 * Base DR reduction → Defender.Max HP Up fraction.
 * 300% reduced DR = +10% Max HP cap, so divide the reduced scalar by 30.
 */
export function baseDeathResistReductionToMaxHpUp(base: number): number {
  return baseDeathResistReduction(base) / MAX_HP_UP_FROM_REDUCTION_DIVISOR;
}

/**
 * Base Death Resist → In Mission: reduce by 75%, but reduction capped at 300%.
 * Scalars: 1.0 = 100%.
 */
export function baseDeathResistToInMission(base: number): number {
  if (base <= 0) return 0;
  return base - baseDeathResistReduction(base);
}

/**
 * In Mission Death Resist → Cause Trigger count.
 * While >= 100%: +1 cause, then halve remaining (ceil to 2 dp).
 */
export function inMissionToCauseTrigger(inMission: number): number {
  let remaining = inMission;
  let cause = 0;
  while (remaining >= 1) {
    cause += 1;
    remaining = Math.ceil((remaining / 2) * 100) / 100;
  }
  return cause;
}

function makeDerivedTransfer(
  tagId: number,
  tagsById: Record<number, Tag>,
  valueScalar: number,
): Manifestation {
  const tag = tagsById[tagId];
  return {
    id: deathResistDerivedManifestationId(tagId),
    sourceKind: "awakener",
    awakenerId: null,
    slotIndex: null,
    sourceName: "Death Resist convert",
    tagId,
    tagName: tag?.tagName ?? `#${tagId}`,
    triggerCondition: null,
    valueScalar,
    baseHits: null,
    dependencyStat: null,
    sourceType: null,
    targetType: "aoe",
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
    ...NON_REALM_MANIFESTATION_FIELDS,
  };
}

/**
 * Synthetic In Mission (147) + Cause Trigger (88) + Max HP Up (130) from Base DR.
 * Max HP Up uses direct HP-fraction units (0.1 = +10%), so DR reduction is
 * converted via reduction/30. Cause uses fromBase + direct In Mission.
 * Immune as interaction subjects.
 */
export function buildDeathResistDerivedManifestations(
  baseDeathResistTotal: number,
  directInMissionTotal: number,
  tagsById: Record<number, Tag>,
): Manifestation[] {
  const reduction = baseDeathResistReduction(baseDeathResistTotal);
  const maxHpUp = baseDeathResistReductionToMaxHpUp(baseDeathResistTotal);
  const fromBase = baseDeathResistTotal > 0 ? baseDeathResistTotal - reduction : 0;
  const cause = inMissionToCauseTrigger(fromBase + directInMissionTotal);
  const out: Manifestation[] = [];

  if (fromBase !== 0) {
    out.push(
      makeDerivedTransfer(IN_MISSION_DEATH_RESIST_TAG_ID, tagsById, fromBase),
    );
  }
  if (maxHpUp !== 0) {
    out.push(
      makeDerivedTransfer(DEFENDER_MAX_HP_UP_TAG_ID, tagsById, maxHpUp),
    );
  }
  if (cause > 0) {
    out.push(
      makeDerivedTransfer(
        SPECIAL_CAUSE_DEATH_RESIST_TRIGGER_TAG_ID,
        tagsById,
        cause,
      ),
    );
  }

  return out;
}
