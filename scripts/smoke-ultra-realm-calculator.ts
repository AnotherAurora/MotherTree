/**
 * Smoke — public Ultra Realm calculator helper.
 * Run: npx tsx scripts/smoke-ultra-realm-calculator.ts
 */
import {
  computeEnemyStrDownBase,
  computeInsightChance,
  computeSingularityBeaconFromRm,
  computeSingularityPrismFromRm,
  computeTeamStrUpBase,
  computeUltraRealmCalculator,
  resolveUltraRealmFlags,
  RTM_BASE_SINGULARITY_BEACON_SCALAR,
  RTM_BASE_SINGULARITY_PRISM_SCALAR,
  RTM_INSIGHT_CHANCE_RATE,
  RTM_SINGULARITY_BEACON_FROM_RM_RATE,
  RTM_SINGULARITY_PRISM_FROM_RM_RATE,
  RTM_ULTRA_AWAKENER_CRIT_DAMAGE_SCALAR,
} from "../src/lib/path-carver/ultra-realm-calculator";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
}

console.log("\nFlags — Primordia / Pure / Chaos");
{
  const f = resolveUltraRealmFlags({
    primordiaChaos: true,
    pureRealm: true,
    chaosAwakeners: 3,
  });
  assert(f.chaosComboStacks === 0, "Primordia → stacks 0");
  assert(f.isPure === false, "Primordia → forces non-pure");
}
{
  const f = resolveUltraRealmFlags({
    primordiaChaos: false,
    pureRealm: true,
    chaosAwakeners: 2,
  });
  assert(f.chaosComboStacks === 2, "chaos 2 → stacks 2");
  assert(f.isPure === true, "Pure on when not Primordia");
}

console.log("\nRTM 38 — Insight Chance (calculator % points)");
assert(computeInsightChance(0, false) === 0, "RM 0 → 0%");
assert(
  computeInsightChance(8.1, false) === 2,
  "RM 8.1 → ceil 9 → ceil(1.125%)=2%",
);
assert(
  computeInsightChance(800, false) === 100,
  "RM 800 → 100%",
);
assert(
  computeInsightChance(800, true) === 200,
  "RM 800 pure → 200%",
);
assert(
  RTM_INSIGHT_CHANCE_RATE === 0.00125,
  "exported Insight rate matches RTM 38",
);

console.log("\nRTM 8 / 9 — STR bases");
assert(computeEnemyStrDownBase(0) === 0, "HP 0 → STR Down 0");
assert(computeEnemyStrDownBase(200) === 1, "HP 200 → ceil(1)=1");
assert(computeEnemyStrDownBase(199) === 1, "HP 199 → ceil(0.995)=1");
assert(computeTeamStrUpBase(100) === 1, "HP 100 → Team STR Up 1");
assert(computeTeamStrUpBase(99) === 1, "HP 99 → ceil(0.99)=1");

console.log("\nRTM 54 / 53 — Singularity Beacon / Prism from RM");
assert(
  RTM_SINGULARITY_BEACON_FROM_RM_RATE === 0.0125,
  "Beacon from RM rate matches RTM 54",
);
assert(
  RTM_SINGULARITY_PRISM_FROM_RM_RATE === 0.0075,
  "Prism from RM rate matches RTM 53",
);
assert(computeSingularityBeaconFromRm(0, false) === 0, "Beacon RM 0 → 0");
assert(computeSingularityPrismFromRm(0, false) === 0, "Prism RM 0 → 0");
assert(
  computeSingularityBeaconFromRm(8.1, false) === 1,
  "Beacon RM 8.1 → ceil 9 → ceil(0.1125)=1",
);
assert(
  computeSingularityPrismFromRm(8.1, false) === 1,
  "Prism RM 8.1 → ceil 9 → ceil(0.0675)=1",
);
assert(
  computeSingularityBeaconFromRm(434, false) === 6,
  "Beacon RM 434 → ceil(5.425)=6",
);
assert(
  computeSingularityPrismFromRm(434, false) === 4,
  "Prism RM 434 → ceil(3.255)=4",
);
assert(
  computeSingularityBeaconFromRm(434, true) === 11,
  "Beacon RM 434 pure → ceil(10.85)=11",
);
assert(
  computeSingularityPrismFromRm(434, true) === 7,
  "Prism RM 434 pure → ceil(6.51)=7",
);

console.log("\nFull calculator — ultra combo ×N");
{
  const r = computeUltraRealmCalculator({
    mode: "ultra",
    teamMaxHp: 200,
    realmMastery: 800,
    primordiaChaos: false,
    pureRealm: false,
    chaosAwakeners: 0,
  });
  assert(r.chaosComboStacks === 0, "chaos 0 → stacks 0");
  assert(r.insightChance === 100, "chaos 0 Insight still applies (100%)");
  assert(r.enemyStrDown === 0, "chaos 0 → Enemy STR Down 0");
  assert(r.teamStrUp === 0, "chaos 0 → Team STR Up 0");
  assert(r.ultraAwakenerCritDamage === 0, "chaos 0 → Crit 0");
  assert(r.totalSingularityBeacon === 0, "ultra zeros Beacon total");
  assert(r.totalSingularityPrism === 0, "ultra zeros Prism total");
}
{
  const r = computeUltraRealmCalculator({
    mode: "ultra",
    teamMaxHp: 200,
    realmMastery: 800,
    primordiaChaos: false,
    pureRealm: true,
    chaosAwakeners: 3,
  });
  assert(r.isPure === true, "pure flag");
  assert(r.insightChance === 200, "pure Insight 200%");
  assert(r.enemyStrDown === 3, "STR Down 1×3");
  assert(r.teamStrUp === 6, "STR Up ceil(2)×3=6");
  assert(
    r.ultraAwakenerCritDamage ===
      RTM_ULTRA_AWAKENER_CRIT_DAMAGE_SCALAR * 3,
    "Crit 0.1×3",
  );
}
{
  const r = computeUltraRealmCalculator({
    mode: "ultra",
    teamMaxHp: 200,
    realmMastery: 800,
    primordiaChaos: true,
    pureRealm: true,
    chaosAwakeners: 3,
  });
  assert(r.chaosComboStacks === 0, "Primordia zeros stacks");
  assert(r.isPure === false, "Primordia forces non-pure");
  assert(r.insightChance === 100, "Primordia Insight without pure (100%)");
  assert(r.enemyStrDown === 0, "Primordia → Enemy STR Down 0");
  assert(r.teamStrUp === 0, "Primordia → Team STR Up 0");
  assert(r.ultraAwakenerCritDamage === 0, "Primordia → Crit 0");
}

console.log("\nFull calculator — singularity mode");
{
  const r = computeUltraRealmCalculator({
    mode: "singularity",
    teamMaxHp: 200,
    realmMastery: 434,
    primordiaChaos: false,
    pureRealm: true,
    chaosAwakeners: 2,
  });
  assert(r.insightChance === 0, "singularity Insight 0");
  assert(
    r.baseSingularityBeacon === RTM_BASE_SINGULARITY_BEACON_SCALAR,
    "Beacon base 25",
  );
  assert(r.singularityBeaconFromRm === 11, "Beacon from RM pure 11");
  assert(
    r.totalSingularityBeacon ===
      RTM_BASE_SINGULARITY_BEACON_SCALAR + r.singularityBeaconFromRm,
    "Beacon total = base + from RM",
  );
  assert(
    r.baseSingularityPrism === RTM_BASE_SINGULARITY_PRISM_SCALAR,
    "Prism base 15",
  );
  assert(r.singularityPrismFromRm === 7, "Prism from RM pure 7");
  assert(
    r.totalSingularityPrism ===
      RTM_BASE_SINGULARITY_PRISM_SCALAR + r.singularityPrismFromRm,
    "Prism total = base + from RM",
  );
  assert(r.enemyStrDown === 2, "singularity combo STR Down 1×2");
  assert(r.teamStrUp === 4, "singularity combo STR Up 2×2");
  assert(
    r.ultraAwakenerCritDamage ===
      RTM_ULTRA_AWAKENER_CRIT_DAMAGE_SCALAR * 2,
    "singularity combo Crit 0.1×2",
  );
}

console.log("\nAll Ultra Realm calculator smokes passed.\n");
