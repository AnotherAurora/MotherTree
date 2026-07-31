import { SUPPORT_CREATE_POSSE_TAG_ID } from "@/lib/path-carver/trigger-condition";
import {
  NON_REALM_MANIFESTATION_FIELDS,
  type Manifestation,
  type Tag,
} from "@/lib/team-data/types";

export { SUPPORT_CREATE_POSSE_TAG_ID };

/** Support.Keyflare — conversion input. */
export const SUPPORT_KEYFLARE_TAG_ID = 37;

/** Special.Increase Posse Keyflare Cost — absolute add to cost. */
export const SPECIAL_INCREASE_POSSE_KEYFLARE_COST_TAG_ID = 155;

/** Base Keyflare per Create.Posse before cost increases. */
export const BASE_POSSE_KEYFLARE_COST = 1000;

/** Cap on Posse created from Keyflare (other Create.Posse sources uncapped). */
export const MAX_POSSE_FROM_KEYFLARE = 2;

/** Tag ids that must be in TeamData.tagsById for Keyflare→Posse conversion. */
export const REQUIRED_KEYFLARE_TO_POSSE_TAG_IDS: readonly number[] = [
  SUPPORT_KEYFLARE_TAG_ID,
  SUPPORT_CREATE_POSSE_TAG_ID,
  SPECIAL_INCREASE_POSSE_KEYFLARE_COST_TAG_ID,
];

/** Offset so ids never collide with Death Resist (1e6) or base-stat transfer ids. */
const DERIVED_ID_OFFSET = 2_000_000;

/**
 * Stable negative id for Keyflare→Create.Posse synthetic.
 */
export function keyflareToPosseManifestationId(): number {
  return -(DERIVED_ID_OFFSET + SUPPORT_CREATE_POSSE_TAG_ID);
}

export type KeyflareToPosseInput = {
  keyflareTotal: number;
  costIncrease: number;
};

export type KeyflareToPosseResult = {
  costPerPosse: number;
  posseCreated: number;
  keyflareTotal: number;
  costIncrease: number;
};

/**
 * Non-consuming Keyflare → Create.Posse.
 * costPerPosse = max(1, 1000 + costIncrease)
 * posseCreated = min(2, floor(keyflare / costPerPosse))
 */
export function computeKeyflareToPosse(
  input: KeyflareToPosseInput,
): KeyflareToPosseResult {
  const keyflareTotal = input.keyflareTotal;
  const costIncrease = input.costIncrease;
  const costPerPosse = Math.max(
    1,
    BASE_POSSE_KEYFLARE_COST + costIncrease,
  );
  const raw = Math.floor(keyflareTotal / costPerPosse);
  const posseCreated = Math.min(MAX_POSSE_FROM_KEYFLARE, Math.max(0, raw));
  return { costPerPosse, posseCreated, keyflareTotal, costIncrease };
}

/**
 * Synthetic Support.Create.Posse from Keyflare conversion.
 * Immune as interaction subject (isBaseStatTransfer).
 */
export function buildKeyflareToPosseManifestation(
  posseCreated: number,
  tagsById: Readonly<Record<number, Tag>>,
): Manifestation | null {
  if (posseCreated <= 0) return null;
  const tag = tagsById[SUPPORT_CREATE_POSSE_TAG_ID];
  return {
    id: keyflareToPosseManifestationId(),
    sourceKind: "awakener",
    awakenerId: null,
    slotIndex: null,
    sourceName: "Keyflare → Create.Posse",
    tagId: SUPPORT_CREATE_POSSE_TAG_ID,
    tagName: tag?.tagName ?? "Support.Create.Posse",
    triggerCondition: null,
    valueScalar: posseCreated,
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
    isCreatedBase: false,
    ...NON_REALM_MANIFESTATION_FIELDS,
  };
}
