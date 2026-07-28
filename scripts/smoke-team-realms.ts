/**
 * Team realm resolution (replace / family / pure / combo).
 * Run: npx tsx scripts/smoke-team-realms.ts
 */
import { CHAOS_REALM_ID } from "../src/lib/team-data/realm";
import {
  resolveTeamRealms,
  type RealmReplaceRow,
} from "../src/lib/team-data/resolve-team-realms";

const CARO = 2;
const PROPAGATION_CARO = 3;
const AEQUOR = 4;
const BENTHOS_AEQUOR = 5;
const ULTRA = 6;
const SINGULARITY_ULTRA = 7;
const PRIMORDIA = 8;

const REALMS: RealmReplaceRow[] = [
  { id: CHAOS_REALM_ID, replace: null },
  { id: CARO, replace: null },
  { id: PROPAGATION_CARO, replace: CARO },
  { id: AEQUOR, replace: null },
  { id: BENTHOS_AEQUOR, replace: AEQUOR },
  { id: ULTRA, replace: null },
  { id: SINGULARITY_ULTRA, replace: ULTRA },
  { id: PRIMORDIA, replace: CHAOS_REALM_ID },
];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
}

function setEq(a: Set<number>, b: number[]): boolean {
  if (a.size !== b.length) return false;
  return b.every((id) => a.has(id));
}

function main(): void {
  console.log("smoke-team-realms");

  {
    const r = resolveTeamRealms(
      [CARO, PROPAGATION_CARO, ULTRA, SINGULARITY_ULTRA],
      REALMS,
    );
    assert(
      setEq(r.effectiveRealmIds, [PROPAGATION_CARO, SINGULARITY_ULTRA]),
      "replacement collapse → {propagation caro, singularity ultra}",
    );
    assert(
      setEq(r.familyIds, [CARO, ULTRA]),
      "family max-2: four realms → 2 families",
    );
    assert(r.familyIds.size === 2, "family count is 2 (within max)");
  }

  {
    const r = resolveTeamRealms([CARO, CARO, CARO], REALMS);
    assert(r.isPure(CARO), "pure caro");
    assert(r.chaosComboStacks === 0, "pure caro: no chaos combo");
    assert(
      r.satisfiesRequiredRealm(CARO, "present"),
      "pure caro satisfies required caro (present)",
    );
  }

  {
    const r = resolveTeamRealms([CARO, CHAOS_REALM_ID], REALMS);
    assert(r.isPure(CARO), "caro + chaos is pure caro");
    assert(
      setEq(r.effectiveRealmIds, [CARO, CHAOS_REALM_ID]),
      "caro + chaos effective keeps both",
    );
    assert(
      r.chaosComboStacks === 1,
      "caro + chaos: combo stacks = 1 chaos awakener",
    );
    assert(
      !r.satisfiesRequiredRealm(CHAOS_REALM_ID, "exclusive"),
      "caro + chaos is not exclusive chaos",
    );
  }

  {
    const r = resolveTeamRealms([CARO, PRIMORDIA], REALMS);
    assert(!r.isPure(CARO), "caro + primordia is not pure caro");
    assert(r.chaosComboStacks === 0, "primordia kills chaos combo");
    assert(
      r.satisfiesRequiredRealm(CHAOS_REALM_ID, "present"),
      "primordia satisfies required chaos (present)",
    );
    assert(
      !r.satisfiesRequiredRealm(CHAOS_REALM_ID, "exclusive"),
      "caro + primordia is not exclusive chaos",
    );
  }

  {
    const r = resolveTeamRealms([PRIMORDIA, PRIMORDIA], REALMS);
    assert(
      r.satisfiesRequiredRealm(CHAOS_REALM_ID, "exclusive"),
      "pure primordia satisfies chaos exclusive",
    );
    assert(r.isPure(PRIMORDIA), "pure primordia is pure for primordia");
    assert(!r.isPure(CHAOS_REALM_ID), "pure primordia is not pure chaos");
    assert(r.chaosComboStacks === 0, "pure primordia: combo stacks 0");
  }

  {
    const r = resolveTeamRealms(
      [CHAOS_REALM_ID, CHAOS_REALM_ID, ULTRA],
      REALMS,
    );
    assert(r.chaosComboStacks === 2, "two chaos + ultra → combo stacks 2");
  }

  {
    const r = resolveTeamRealms(
      [SINGULARITY_ULTRA, PROPAGATION_CARO],
      REALMS,
    );
    assert(
      r.satisfiesRequiredRealm(ULTRA, "present"),
      "singularity ultra satisfies required ultra (present)",
    );
    assert(
      r.satisfiesRequiredRealm(CARO, "present"),
      "propagation caro satisfies required caro (present)",
    );
  }

  console.log("All smoke-team-realms checks passed.");
}

main();
