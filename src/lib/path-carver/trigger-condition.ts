import type { Manifestation } from "@/lib/team-data/types";
import { SPECIAL_CAUSE_DEATH_RESIST_TRIGGER_TAG_ID } from "@/lib/path-carver/death-resist-trigger";

export { SPECIAL_CAUSE_DEATH_RESIST_TRIGGER_TAG_ID };

/** Special.When.Death Resist Trigger */
export const SPECIAL_WHEN_DEATH_RESIST_TRIGGER_TAG_ID = 89;

/** Special.Cause.Devour */
export const SPECIAL_CAUSE_DEVOUR_TAG_ID = 126;
/** Special.When.Devour */
export const SPECIAL_WHEN_DEVOUR_TAG_ID = 128;

/** Special.Cause.Resonance */
export const SPECIAL_CAUSE_RESONANCE_TAG_ID = 142;
/** Special.When.Resonance */
export const SPECIAL_WHEN_RESONANCE_TAG_ID = 143;

/** Support.Create.Posse */
export const SUPPORT_CREATE_POSSE_TAG_ID = 52;
/** Special.When.Posse */
export const SPECIAL_WHEN_POSSE_TAG_ID = 129;

/** Special.Posse.Drowned Innocence — presence marker from the posse of the same name. */
export const SPECIAL_POSSE_DROWNED_INNOCENCE_TAG_ID = 178;

/**
 * Presence-trigger tags: rows whose `trigger_condition` equals the tag id apply
 * when that same tag has a non-zero Layer A total. Unlike `CAUSE_TO_WHEN`, the
 * cause id equals the When id; apply-times = `floor(Layer A total)`, so
 * Support.Double Posse (which doubles posse value_scalar) doubles the count.
 */
export const PRESENCE_TRIGGER_TAG_IDS: ReadonlySet<number> = new Set([
  SPECIAL_POSSE_DROWNED_INNOCENCE_TAG_ID,
]);

/**
 * Cause tag id → When tag id.
 * Cause Layer A totals become how many times the When condition is met.
 * Pursuit (109→108) intentionally omitted — those rows stay unmet.
 */
export const CAUSE_TO_WHEN: ReadonlyMap<number, number> = new Map([
  [SPECIAL_CAUSE_DEATH_RESIST_TRIGGER_TAG_ID, SPECIAL_WHEN_DEATH_RESIST_TRIGGER_TAG_ID],
  [SPECIAL_CAUSE_DEVOUR_TAG_ID, SPECIAL_WHEN_DEVOUR_TAG_ID],
  [SPECIAL_CAUSE_RESONANCE_TAG_ID, SPECIAL_WHEN_RESONANCE_TAG_ID],
  [SUPPORT_CREATE_POSSE_TAG_ID, SPECIAL_WHEN_POSSE_TAG_ID],
]);

/**
 * Build When-tag → apply-times from Cause tag Layer A totals, plus
 * `PRESENCE_TRIGGER_TAG_IDS` whose own total is the gate.
 * `triggerCount = max(0, floor(sum))`.
 */
export function buildTriggerCounts(
  causeTotalsByTagId: ReadonlyMap<number, number>,
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const [causeId, whenId] of CAUSE_TO_WHEN) {
    const sum = causeTotalsByTagId.get(causeId) ?? 0;
    counts.set(whenId, Math.max(0, Math.floor(sum)));
  }
  for (const whenId of PRESENCE_TRIGGER_TAG_IDS) {
    const sum = causeTotalsByTagId.get(whenId) ?? 0;
    counts.set(whenId, Math.max(0, Math.floor(sum)));
  }
  return counts;
}

/**
 * `null` = no trigger gate (column null).
 * `0` = unmet / unknown When.
 * `>0` = apply times.
 */
export function getTriggerCount(
  m: Pick<Manifestation, "triggerCondition">,
  counts: ReadonlyMap<number, number>,
): number | null {
  if (m.triggerCondition == null) return null;
  return counts.get(m.triggerCondition) ?? 0;
}

/** Scale a Layer A contribution by trigger apply-times (1 when ungated). */
export function triggerApplyMultiplier(
  m: Pick<Manifestation, "triggerCondition">,
  counts: ReadonlyMap<number, number>,
): number {
  const count = getTriggerCount(m, counts);
  if (count == null) return 1;
  return count;
}
