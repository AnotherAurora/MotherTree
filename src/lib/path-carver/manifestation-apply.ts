import type { Awakener, Manifestation, RealmLookupRow } from "@/lib/team-data/types";
import { CHAOS_REALM_ID } from "@/lib/team-data/realm";
import {
  resolveTeamRealms,
  type TeamRealmResolution,
} from "@/lib/team-data/resolve-team-realms";
import { getTriggerCount } from "@/lib/path-carver/trigger-condition";

export type ManifestationApplyReason =
  | "realm"
  | "required_awakener"
  | "attacker.not_damage_dealer"
  | "trigger_condition";

export type ManifestationApplyResult = {
  applied: boolean;
  reason: ManifestationApplyReason | null;
  /** Apply-times from Cause→When; null when ungated. */
  triggerTimes: number | null;
};

export type ManifestationApplyContext = {
  /** Resolved team realms (replace / family / combo / purity). */
  teamRealms: TeamRealmResolution;
  /** Effective realm ids after replacement (debug / legacy). */
  teamRealmIds: Set<number>;
  /** Chaos-lineage exclusive team (chaos and/or primordia only). */
  teamIsChaosOnly: boolean;
  teamAwakenerIds: Set<number>;
  /** Build-step anchors with isDamageDealer === true. */
  damageDealerAwakenerIds: Set<number>;
  /** When tag id → apply-times. Missing / unknown When → 0. */
  triggerCounts: ReadonlyMap<number, number>;
};

export function getTeamRealmIds(awakeners: Awakener[]): Set<number> {
  const realmIds = new Set<number>();
  for (const awakener of awakeners) {
    if (awakener.realmId != null) realmIds.add(awakener.realmId);
  }
  return realmIds;
}

export function createManifestationApplyContext(
  awakeners: Awakener[],
  damageDealerAwakenerIds: Iterable<number> = [],
  triggerCounts: ReadonlyMap<number, number> = new Map(),
  realms: Iterable<RealmLookupRow> = [],
): ManifestationApplyContext {
  const teamRealms = resolveTeamRealms(
    awakeners.map((a) => a.realmId),
    realms,
  );
  return {
    teamRealms,
    teamRealmIds: teamRealms.effectiveRealmIds,
    teamIsChaosOnly: teamRealms.satisfiesRequiredRealm(
      CHAOS_REALM_ID,
      "exclusive",
    ),
    teamAwakenerIds: new Set(awakeners.map((a) => a.id)),
    damageDealerAwakenerIds: new Set(damageDealerAwakenerIds),
    triggerCounts,
  };
}

function realmRequirementMet(
  requiredId: number,
  ctx: ManifestationApplyContext,
): boolean {
  if (requiredId === CHAOS_REALM_ID) {
    return ctx.teamRealms.satisfiesRequiredRealm(requiredId, "exclusive");
  }
  return ctx.teamRealms.satisfiesRequiredRealm(requiredId, "present");
}

function realmAndRequiredAwakenerPass(
  m: Manifestation,
  ctx: ManifestationApplyContext,
): ManifestationApplyResult {
  if (
    m.requiredAwakenerId != null &&
    !ctx.teamAwakenerIds.has(m.requiredAwakenerId)
  ) {
    return { applied: false, reason: "required_awakener", triggerTimes: null };
  }

  const requiredRealmIds = [m.requiredRealmId, m.requiredRealmId2].filter(
    (realmId): realmId is number => realmId != null,
  );

  if (requiredRealmIds.length === 0) {
    return { applied: true, reason: null, triggerTimes: null };
  }

  // Covenant required_realm1/required_realm2 use AND: every non-null realm must match.
  // Note: chaos + another realm (e.g. chaos + ultra) can never both be satisfied —
  // chaos exclusive means no other families on the team, so such rows always stay unapplied.
  const realmsOk = requiredRealmIds.every((requiredId) =>
    realmRequirementMet(requiredId, ctx),
  );
  if (!realmsOk) {
    return { applied: false, reason: "realm", triggerTimes: null };
  }

  return { applied: true, reason: null, triggerTimes: null };
}

function isAttackerTag(tagName: string): boolean {
  return tagName.startsWith("Attacker.");
}

/**
 * Layer A — which manifestations enter team tag totals.
 * Posse skips target_type and damage-dealer gates (realm / required_awakener only).
 * Attacker.* (any target_type) requires the owner awakener to be a damage dealer.
 * Base-stat transfer synthetics always apply.
 * Non-null trigger_condition also requires Cause→When count > 0.
 */
export function evaluateManifestationApply(
  m: Manifestation,
  ctx: ManifestationApplyContext,
): ManifestationApplyResult {
  if (m.isBaseStatTransfer) {
    return { applied: true, reason: null, triggerTimes: null };
  }

  const base = realmAndRequiredAwakenerPass(m, ctx);
  if (!base.applied) return base;

  // Posse: skip target_type and damage-dealer gates.
  if (m.sourceKind !== "posse" && isAttackerTag(m.tagName)) {
    const ownerId = m.awakenerId;
    if (
      ownerId == null ||
      !ctx.damageDealerAwakenerIds.has(ownerId)
    ) {
      return {
        applied: false,
        reason: "attacker.not_damage_dealer",
        triggerTimes: null,
      };
    }
  }

  const triggerTimes = getTriggerCount(m, ctx.triggerCounts);
  if (triggerTimes != null && triggerTimes <= 0) {
    return { applied: false, reason: "trigger_condition", triggerTimes: 0 };
  }

  return {
    applied: true,
    reason: null,
    triggerTimes,
  };
}

export function isManifestationApplied(
  m: Manifestation,
  ctx: ManifestationApplyContext,
): boolean {
  return evaluateManifestationApply(m, ctx).applied;
}
