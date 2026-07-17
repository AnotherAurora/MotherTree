import type { Awakener, Manifestation, Realm } from "@/lib/team-data/types";

export type ManifestationApplyContext = {
  teamRealms: Set<Realm>;
  teamIsChaosOnly: boolean;
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
): ManifestationApplyContext {
  return {
    teamRealms: getTeamRealms(awakeners),
    teamIsChaosOnly: isChaosOnlyTeam(awakeners),
  };
}

function realmRequirementMet(
  required: Realm,
  ctx: ManifestationApplyContext,
): boolean {
  if (required === "chaos") return ctx.teamIsChaosOnly;
  return ctx.teamRealms.has(required);
}

export function isManifestationApplied(
  m: Manifestation,
  ctx: ManifestationApplyContext,
): boolean {
  const requiredRealms = [m.requiredRealm, m.requiredRealm2].filter(
    (realm): realm is Realm => realm != null,
  );

  if (requiredRealms.length === 0) return true;

  // Covenant required_realm1/required_realm2 use AND: every non-null realm must match.
  // Note: chaos + another realm (e.g. chaos + ultra) can never both be satisfied —
  // chaos-only means no other realms on the team, so such rows always stay unapplied.
  return requiredRealms.every((required) =>
    realmRequirementMet(required, ctx),
  );
}
