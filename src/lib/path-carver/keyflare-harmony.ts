import { SUPPORT_KEYFLARE_TAG_ID } from "@/lib/path-carver/keyflare-to-posse";
import {
  DEFAULT_COPY_INSTANCE_FIELDS,
  NON_REALM_MANIFESTATION_FIELDS,
  type Awakener,
  type Manifestation,
  type Tag,
} from "@/lib/team-data/types";

export { SUPPORT_KEYFLARE_TAG_ID };

/** Path Carver always averages across 4 team slots. */
export const TEAM_SLOT_COUNT = 4;

/**
 * 200% of team-average keyflare per non-exalted awakener.
 * Total with no exalt ≈ ceil(avg × 2) × 4 (not raw avg × 8 when avg is fractional).
 */
export const KEYFLARE_HARMONY_AVG_FACTOR = 2;

/** Offset distinct from Death Resist (1e6) and Keyflare→Posse (2e6). */
const DERIVED_ID_OFFSET = 3_000_000;

/**
 * Stable negative id for Keyflare Harmony Support.Keyflare synthetic.
 */
export function keyflareHarmonyManifestationId(): number {
  return -(DERIVED_ID_OFFSET + SUPPORT_KEYFLARE_TAG_ID);
}

export type KeyflareHarmonyBreakdown = {
  sumKeyflare: number;
  teamAverage: number;
  /** ceil(teamAverage × 2) — Keyflare from Harmony per non-exalted awakener. */
  perNonExalted: number;
  /** −perNonExalted (penalty if that awakener exalts). */
  minusPerExalt: number;
  /** perNonExalted × TEAM_SLOT_COUNT when nobody exalted. */
  valueScalar: number;
};

/**
 * ceil(200% of team-average post–Special.Increase keyflare_regen) per non-exalted
 * awakener. Empty slots count as 0 (always ÷ 4). Assumes no exalt → × 4.
 */
export function computeKeyflareHarmonyScalar(
  totalAwakeners: readonly Pick<Awakener, "keyflareRegen">[],
): KeyflareHarmonyBreakdown {
  let sumKeyflare = 0;
  for (const a of totalAwakeners) {
    sumKeyflare += a.keyflareRegen ?? 0;
  }
  const teamAverage = sumKeyflare / TEAM_SLOT_COUNT;
  const perNonExalted = Math.ceil(teamAverage * KEYFLARE_HARMONY_AVG_FACTOR);
  const valueScalar = perNonExalted * TEAM_SLOT_COUNT;
  const minusPerExalt = -perNonExalted;
  return {
    sumKeyflare,
    teamAverage,
    perNonExalted,
    minusPerExalt,
    valueScalar,
  };
}

/**
 * Always-on synthetic Support.Keyflare from Keyflare Harmony.
 * Immune as interaction subject (isBaseStatTransfer).
 */
export function buildKeyflareHarmonyManifestation(
  valueScalar: number,
  tagsById: Readonly<Record<number, Tag>>,
): Manifestation | null {
  if (valueScalar === 0) return null;
  const tag = tagsById[SUPPORT_KEYFLARE_TAG_ID];
  return {
    id: keyflareHarmonyManifestationId(),
    sourceKind: "awakener",
    awakenerId: null,
    slotIndex: null,
    sourceName: "Keyflare Harmony",
    tagId: SUPPORT_KEYFLARE_TAG_ID,
    tagName: tag?.tagName ?? "Support.Keyflare",
    triggerCondition: null,
    valueScalar,
    ...DEFAULT_COPY_INSTANCE_FIELDS,
    dependencyStat: null,
    sourceType: null,
    targetType: "aoe",
    buffTargetTypeRestriction: null,
    metadata: null,
    isAccumulating: true,
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
  };
}
