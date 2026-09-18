import {
  isManifestationApplied,
  type ManifestationApplyContext,
} from "@/lib/path-carver/manifestation-apply";
import type { Manifestation } from "@/lib/team-data/types";

/** Support.Double Posse — doubles the equipped posse's effects. */
export const SUPPORT_DOUBLE_POSSE_TAG_ID = 53;

/** Equipped-posse effective-scalar multiplier when tag 53 is applied. */
export const POSSE_EFFECT_MULTIPLIER = 2;

/**
 * True when any applied Support.Double Posse row is present.
 * Presence-only: multiple sources still yield a single ×2 (not stacked).
 */
export function isDoublePosseActive(
  manifestations: readonly Manifestation[],
  applyContext: ManifestationApplyContext,
): boolean {
  for (const m of manifestations) {
    if (m.tagId !== SUPPORT_DOUBLE_POSSE_TAG_ID) continue;
    if (m.isBaseStatTransfer) continue;
    if ((m.valueScalar ?? 0) === 0) continue;
    if (!isManifestationApplied(m, applyContext)) continue;
    return true;
  }
  return false;
}

/**
 * Clone equipped-posse rows (`sourceKind === "posse"`) with their value_scalar
 * scaled. Non-posse rows and the multiplier === 1 case pass through unchanged.
 */
export function scalePosseManifestations(
  manifestations: readonly Manifestation[],
  multiplier: number,
): Manifestation[] {
  if (multiplier === 1) return [...manifestations];
  return manifestations.map((m) =>
    m.sourceKind === "posse" && m.valueScalar != null
      ? { ...m, valueScalar: m.valueScalar * multiplier }
      : m,
  );
}
