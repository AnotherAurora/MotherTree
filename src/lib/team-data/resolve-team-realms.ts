import { CHAOS_REALM_ID } from "@/lib/team-data/realm";

/** Minimal realm row for replace / family resolution. */
export type RealmReplaceRow = {
  id: number;
  replace: number | null;
};

export type TeamRealmResolution = {
  rawRealmIds: Set<number>;
  effectiveRealmIds: Set<number>;
  familyIds: Set<number>;
  /** Bases removed from effective because a replacer is on the team. */
  replacedBases: ReadonlySet<number>;
  chaosComboStacks: number;
  /** Family id for max-2: `replace ?? id`. */
  familyIdOf: (realmId: number) => number;
  isPure: (realmId: number) => boolean;
  satisfiesRequiredRealm: (
    requiredId: number,
    mode: "present" | "exclusive",
  ) => boolean;
};

/** Family id for max-2: `replace ?? id`. */
export function realmFamilyId(
  realmId: number,
  replaceOf: ReadonlyMap<number, number | null>,
): number {
  return replaceOf.get(realmId) ?? realmId;
}

/**
 * Resolve a team's raw awakener realm ids into effective realms, families,
 * chaos combo stacks, purity, and required-realm checks.
 */
export function resolveTeamRealms(
  awakenerRealmIds: Iterable<number | null | undefined>,
  realms: Iterable<RealmReplaceRow>,
): TeamRealmResolution {
  const replaceOf = new Map<number, number | null>();
  for (const row of realms) {
    replaceOf.set(row.id, row.replace);
  }

  const rawList: number[] = [];
  for (const id of awakenerRealmIds) {
    if (id != null) rawList.push(id);
  }
  const rawRealmIds = new Set(rawList);

  const replacedBases = new Set<number>();
  for (const s of rawRealmIds) {
    const base = replaceOf.get(s);
    if (base != null) replacedBases.add(base);
  }

  const effectiveRealmIds = new Set<number>();
  for (const id of rawRealmIds) {
    if (!replacedBases.has(id)) effectiveRealmIds.add(id);
  }

  const familyIds = new Set<number>();
  for (const id of rawRealmIds) {
    familyIds.add(realmFamilyId(id, replaceOf));
  }

  const hasChaosReplacer = [...rawRealmIds].some(
    (id) => replaceOf.get(id) === CHAOS_REALM_ID,
  );
  let chaosComboStacks = 0;
  if (
    !hasChaosReplacer &&
    rawRealmIds.has(CHAOS_REALM_ID) &&
    familyIds.size > 1
  ) {
    chaosComboStacks = rawList.filter((id) => id === CHAOS_REALM_ID).length;
  }

  function isPure(realmId: number): boolean {
    if (effectiveRealmIds.size === 1 && effectiveRealmIds.has(realmId)) {
      return true;
    }
    if (
      realmId !== CHAOS_REALM_ID &&
      effectiveRealmIds.size === 2 &&
      effectiveRealmIds.has(realmId) &&
      effectiveRealmIds.has(CHAOS_REALM_ID)
    ) {
      return true;
    }
    return false;
  }

  function satisfiesRequiredRealm(
    requiredId: number,
    mode: "present" | "exclusive",
  ): boolean {
    if (mode === "present") {
      if (effectiveRealmIds.has(requiredId)) return true;
      for (const s of effectiveRealmIds) {
        if (replaceOf.get(s) === requiredId) return true;
      }
      return false;
    }

    if (requiredId === CHAOS_REALM_ID) {
      return familyIds.size === 1 && familyIds.has(CHAOS_REALM_ID);
    }

    return isPure(requiredId);
  }

  return {
    rawRealmIds,
    effectiveRealmIds,
    familyIds,
    replacedBases,
    chaosComboStacks,
    familyIdOf: (realmId: number) => realmFamilyId(realmId, replaceOf),
    isPure,
    satisfiesRequiredRealm,
  };
}
