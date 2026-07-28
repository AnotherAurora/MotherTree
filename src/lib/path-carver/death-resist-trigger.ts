import type { Manifestation, Tag } from "@/lib/team-data/types";

/** Defender.Base Death Resist — awakener transfer / base total. */
export const DEFENDER_BASE_DEATH_RESIST_TAG_ID = 12;

/** Defender.Base Death Resist.In Mission Death Resist — converted + direct. */
export const IN_MISSION_DEATH_RESIST_TAG_ID = 147;

/** Special.Cause.Death Resist Trigger — count from combined In Mission. */
export const SPECIAL_CAUSE_DEATH_RESIST_TRIGGER_TAG_ID = 88;

/** Max absolute Death Resist removed by the 75% In Mission reduction (300%). */
const MAX_REDUCTION = 3;

/** Offset so derived ids never collide with baseStatTransferManifestationId. */
const DERIVED_ID_OFFSET = 1_000_000;

/**
 * Stable negative id for Death Resist derived synthetics (147 / 88).
 */
export function deathResistDerivedManifestationId(tagId: number): number {
  return -(DERIVED_ID_OFFSET + tagId);
}

/**
 * Base Death Resist → In Mission: reduce by 75%, but reduction capped at 300%.
 * Scalars: 1.0 = 100%.
 */
export function baseDeathResistToInMission(base: number): number {
  if (base <= 0) return 0;
  const reduction = Math.min(base * 0.75, MAX_REDUCTION);
  return base - reduction;
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
  };
}

/**
 * Synthetic In Mission (147) + Cause Trigger (88) transfers from Base Death Resist.
 * Cause uses fromBase + direct In Mission (pre-interaction). Immune as subjects.
 */
export function buildDeathResistDerivedManifestations(
  baseDeathResistTotal: number,
  directInMissionTotal: number,
  tagsById: Record<number, Tag>,
): Manifestation[] {
  const fromBase = baseDeathResistToInMission(baseDeathResistTotal);
  const cause = inMissionToCauseTrigger(fromBase + directInMissionTotal);
  const out: Manifestation[] = [];

  if (fromBase !== 0) {
    out.push(
      makeDerivedTransfer(IN_MISSION_DEATH_RESIST_TAG_ID, tagsById, fromBase),
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
