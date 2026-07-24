import type { Awakener, Manifestation, Realm } from "@/lib/team-data/types";

export type ManifestationApplyReason =
  | "realm"
  | "required_awakener"
  | "attacker.not_damage_dealer";

export type ManifestationApplyResult = {
  applied: boolean;
  reason: ManifestationApplyReason | null;
};

export type ManifestationApplyContext = {
  teamRealms: Set<Realm>;
  teamIsChaosOnly: boolean;
  teamAwakenerIds: Set<number>;
  /** Build-step anchors with isDamageDealer === true. */
  damageDealerAwakenerIds: Set<number>;
};

export function getTeamRealms(awakeners: Awakener[]): Set<Realm> {
  const realms = new Set<Realm>();
  for (const awakener of awakeners) {
    if (awakener.realm != null) realms.add(awakener.realm);
  }
  return realms;
}

export function isChaosOnlyTeam(awakeners: Awakener[]): boolean {
  if (awakeners.length === 0) return false;
  return awakeners.every((a) => a.realm === "chaos");
}

export function createManifestationApplyContext(
  awakeners: Awakener[],
  damageDealerAwakenerIds: Iterable<number> = [],
): ManifestationApplyContext {
  return {
    teamRealms: getTeamRealms(awakeners),
    teamIsChaosOnly: isChaosOnlyTeam(awakeners),
    teamAwakenerIds: new Set(awakeners.map((a) => a.id)),
    damageDealerAwakenerIds: new Set(damageDealerAwakenerIds),
  };
}

function realmRequirementMet(
  required: Realm,
  ctx: ManifestationApplyContext,
): boolean {
  if (required === "chaos") return ctx.teamIsChaosOnly;
  return ctx.teamRealms.has(required);
}

function realmAndRequiredAwakenerPass(
  m: Manifestation,
  ctx: ManifestationApplyContext,
): ManifestationApplyResult {
  if (
    m.requiredAwakenerId != null &&
    !ctx.teamAwakenerIds.has(m.requiredAwakenerId)
  ) {
    return { applied: false, reason: "required_awakener" };
  }

  const requiredRealms = [m.requiredRealm, m.requiredRealm2].filter(
    (realm): realm is Realm => realm != null,
  );

  if (requiredRealms.length === 0) {
    return { applied: true, reason: null };
  }

  // Covenant required_realm1/required_realm2 use AND: every non-null realm must match.
  // Note: chaos + another realm (e.g. chaos + ultra) can never both be satisfied —
  // chaos-only means no other realms on the team, so such rows always stay unapplied.
  const realmsOk = requiredRealms.every((required) =>
    realmRequirementMet(required, ctx),
  );
  if (!realmsOk) {
    return { applied: false, reason: "realm" };
  }

  return { applied: true, reason: null };
}

function isAttackerTag(tagName: string): boolean {
  return tagName.startsWith("Attacker.");
}

/**
 * Layer A — which manifestations enter team tag totals.
 * Posse skips target_type and damage-dealer gates (realm / required_awakener only).
 * Attacker.* (any target_type) requires the owner awakener to be a damage dealer.
 * Base-stat transfer synthetics always apply.
 */
export function evaluateManifestationApply(
  m: Manifestation,
  ctx: ManifestationApplyContext,
): ManifestationApplyResult {
  if (m.isBaseStatTransfer) {
    return { applied: true, reason: null };
  }

  const base = realmAndRequiredAwakenerPass(m, ctx);
  if (!base.applied) return base;

  // Posse: skip target_type and damage-dealer gates.
  if (m.sourceKind === "posse") {
    return { applied: true, reason: null };
  }

  if (isAttackerTag(m.tagName)) {
    const ownerId = m.awakenerId;
    if (
      ownerId == null ||
      !ctx.damageDealerAwakenerIds.has(ownerId)
    ) {
      return { applied: false, reason: "attacker.not_damage_dealer" };
    }
  }

  // Non-Attacker self / single / aoe / null: base scalar counts when realm OK.
  return { applied: true, reason: null };
}

export function isManifestationApplied(
  m: Manifestation,
  ctx: ManifestationApplyContext,
): boolean {
  return evaluateManifestationApply(m, ctx).applied;
}
