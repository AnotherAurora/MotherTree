/**
 * Smoke — public Caro Realm calculator helper.
 * Run: npx tsx scripts/smoke-caro-realm-calculator.ts
 */
import {
  clampCurrentHp,
  computeBaseCrimsonFurnaceRegen,
  computeBaseDevourShield,
  computeBaseDevourStr,
  computeBaseEmbryoFusionRegen,
  computeBasePropagationFiesta,
  computeBasePropaguleFiesta,
  computeBattleEndCrimsonFurnaceGain,
  computeCaroRealmCalculator,
  computeDevourShieldFromRm,
  computeDevourStrFromRm,
  computePropagationCrimsonFurnaceRegen,
  computePropagationEmbryoFusionRegen,
  computePropagationFiestaFromRm,
  computePropaguleFiestaFromRm,
  missingHpFraction,
  resolveCaroRealmFlags,
} from "../src/lib/path-carver/caro-realm-calculator";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
}

console.log("\nmissingHpFraction");
assert(missingHpFraction(10_000, 10_000) === 0, "full HP → L=0");
assert(missingHpFraction(10_000, 5_000) === 0.5, "50% → L=0.5");
assert(missingHpFraction(10_000, 0) === 1, "0 HP → L=1");
assert(missingHpFraction(10_000, 1) === 0.9999, "1 HP → L=0.9999");
assert(missingHpFraction(0, 0) === 0, "MaxHP 0 → L=0");
assert(missingHpFraction(100, 150) === 0, "current>max clamps → L=0");

console.log("\nclampCurrentHp");
assert(clampCurrentHp(1000, 1500) === 1000, "current capped to max");
assert(clampCurrentHp(1000, -5) === 0, "current floored at 0");
assert(clampCurrentHp(1000, 400) === 400, "in-range unchanged");

console.log("\nFlags — Primordia Chaos");
{
  const f = resolveCaroRealmFlags({
    primordiaChaos: true,
    pureRealm: true,
  });
  assert(f.isPure === false, "primordia → not pure");
}

console.log("\nFlags — normal");
{
  const f = resolveCaroRealmFlags({
    primordiaChaos: false,
    pureRealm: true,
  });
  assert(f.isPure === true, "pure");
}

console.log("\nEmbryo Fusion L endpoints (RTM 11)");
assert(computeBaseEmbryoFusionRegen(0) === 30, "L=0 → 30");
assert(computeBaseEmbryoFusionRegen(0.25) === 38, "L=0.25 → ceil(37.5)=38");
assert(computeBaseEmbryoFusionRegen(0.5) === 45, "L=0.5 → 45");
assert(computeBaseEmbryoFusionRegen(1) === 60, "L=1 → 60");

console.log("\nPropagation Embryo Fusion L endpoints (RTM 20)");
assert(computePropagationEmbryoFusionRegen(0) === 50, "L=0 → 50");
assert(computePropagationEmbryoFusionRegen(0.5) === 75, "L=0.5 → 75");
assert(computePropagationEmbryoFusionRegen(1) === 100, "L=1 → 100");
assert(
  computePropagationEmbryoFusionRegen(0.25) === 63,
  "L=0.25 → ceil(62.5)=63",
);

console.log("\nFurnace (RTM 14 / 15)");
assert(computeBaseCrimsonFurnaceRegen(10_000, false) === 300, "14 not pure");
assert(computeBaseCrimsonFurnaceRegen(10_000, true) === 600, "14 pure doubles");
assert(computeBattleEndCrimsonFurnaceGain(10_000) === 500, "15 → 500");

console.log("\nPropagation Furnace (RTM 21) — 10% missing HP");
assert(
  computePropagationCrimsonFurnaceRegen(10_000, 10_000) === 0,
  "full HP → 0",
);
assert(
  computePropagationCrimsonFurnaceRegen(10_000, 5_000) === 500,
  "50% → 500",
);
assert(
  computePropagationCrimsonFurnaceRegen(10_000, 0) === 1000,
  "0 HP → 1000",
);
assert(
  computePropagationCrimsonFurnaceRegen(10_000, 6_000) === 400,
  "datamine example M10k H6k → 400",
);

console.log("\nDevour Shield L endpoints (RTM 12) — 1 decimal");
assert(computeBaseDevourShield(10_000, 0) === 400, "L=0 → 400");
assert(computeBaseDevourShield(10_000, 0.5) === 600, "L=0.5 → 600");
assert(computeBaseDevourShield(10_000, 1) === 800, "L=1 → 800");
assert(computeBaseDevourShield(1622, 0) === 64.9, "1622 → 64.9");

console.log("\nDevour STR L endpoints (RTM 13) — 1 decimal");
assert(computeBaseDevourStr(10_000, 0) === 200, "L=0 → 200");
assert(computeBaseDevourStr(10_000, 0.5) === 300, "L=0.5 → 300");
assert(computeBaseDevourStr(10_000, 1) === 400, "L=1 → 400");
assert(computeBaseDevourStr(1622, 0) === 32.4, "1622 → 32.4");

console.log("\nDevour RM (RTM 39 / 40) — 1 decimal");
assert(
  computeDevourShieldFromRm(10_000, 1000, 0, false) === 1000,
  "39 L=0 not pure",
);
assert(
  computeDevourShieldFromRm(10_000, 1000, 1, false) === 2000,
  "39 L=1 not pure",
);
assert(
  computeDevourShieldFromRm(10_000, 1000, 0, true) === 2000,
  "39 pure doubles",
);
assert(
  computeDevourStrFromRm(10_000, 1000, 0, false) === 500,
  "40 L=0 not pure",
);
assert(
  computeDevourStrFromRm(10_000, 1000, 1, false) === 1000,
  "40 L=1 not pure",
);
assert(
  computeDevourStrFromRm(10_000, 1000, 0, true) === 1000,
  "40 pure doubles",
);
assert(
  computeDevourShieldFromRm(10_000, 8.1, 0, false) === 9,
  "39 RM 8.1 ceils to 9",
);
assert(
  computeDevourShieldFromRm(1622, 108, 0, true) === 35,
  "39 1622 RM108 pure → 35.0",
);
assert(
  computeDevourStrFromRm(1622, 108, 0, true) === 17.5,
  "40 1622 RM108 pure → 17.5",
);

console.log("\nPropagation Fiesta (RTM 19 / 51 / 22 / 52)");
assert(computeBasePropagationFiesta() === 20, "base fiesta 20");
assert(computeBasePropaguleFiesta() === 40, "base propagule 40");
assert(
  computePropagationFiestaFromRm(434, true) === 9,
  "51 pure RM434 → ceil(8.68)=9",
);
assert(
  computePropaguleFiestaFromRm(434, true) === 18,
  "52 pure RM434 → ceil(17.36)=18",
);
assert(
  computePropagationFiestaFromRm(434, false) === 5,
  "51 not pure RM434 → ceil(4.34)=5",
);
assert(
  computePropaguleFiestaFromRm(8.1, false) === 1,
  "52 RM 8.1→9 not pure → ceil(0.18)=1",
);

console.log("\nIntegration — full HP");
{
  const r = computeCaroRealmCalculator({
    mode: "caro",
    teamMaxHp: 10_000,
    currentHp: 10_000,
    realmMastery: 0,
    primordiaChaos: false,
    pureRealm: false,
  });
  assert(r.missingHpFraction === 0, "L=0");
  assert(r.baseEmbryoFusionRegen === 30, "embryo 30");
  assert(r.baseCrimsonFurnaceRegen === 300, "furnace 300");
  assert(r.battleEndCrimsonFurnaceGain === 500, "battle end 500");
  assert(r.baseShield === 400, "shield 400");
  assert(r.shieldFromRm === 0, "shield RM 0");
  assert(r.totalShield === 400, "total shield");
  assert(r.baseStr === 200, "str 200");
  assert(r.totalStr === 200, "total str");
  assert(r.totalPropagationFiesta === 0, "caro fiesta 0");
  assert(r.totalPropaguleFiesta === 0, "caro propagule 0");
}

console.log("\nIntegration — 0 HP + pure + RM");
{
  const r = computeCaroRealmCalculator({
    mode: "caro",
    teamMaxHp: 10_000,
    currentHp: 0,
    realmMastery: 1000,
    primordiaChaos: false,
    pureRealm: true,
  });
  assert(r.missingHpFraction === 1, "L=1");
  assert(r.isPure === true, "pure");
  assert(r.baseEmbryoFusionRegen === 60, "embryo 60");
  assert(r.baseCrimsonFurnaceRegen === 600, "furnace pure 600");
  assert(r.baseShield === 800, "shield 800");
  assert(r.shieldFromRm === 4000, "shield RM pure L=1");
  assert(r.totalShield === 4800, "total shield");
  assert(r.baseStr === 400, "str 400");
  assert(r.strFromRm === 2000, "str RM pure L=1");
  assert(r.totalStr === 2400, "total str");
}

console.log("\nIntegration — Primordia clears pure");
{
  const r = computeCaroRealmCalculator({
    mode: "caro",
    teamMaxHp: 10_000,
    currentHp: 10_000,
    realmMastery: 1000,
    primordiaChaos: true,
    pureRealm: true,
  });
  assert(r.isPure === false, "primordia clears pure");
  assert(r.baseCrimsonFurnaceRegen === 300, "furnace not doubled");
  assert(r.shieldFromRm === 1000, "RM shield not doubled");
}

console.log("\nIntegration — 1622 HP / RM 108 pure (game totals)");
{
  const r = computeCaroRealmCalculator({
    mode: "caro",
    teamMaxHp: 1622,
    currentHp: 1622,
    realmMastery: 108,
    primordiaChaos: false,
    pureRealm: true,
  });
  assert(r.baseShield === 64.9, "base shield 64.9");
  assert(r.shieldFromRm === 35, "shield RM 35.0");
  assert(r.totalShield === 100, "total shield ceil → 100");
  assert(r.baseStr === 32.4, "base str 32.4");
  assert(r.strFromRm === 17.5, "str RM 17.5");
  assert(r.totalStr === 50, "total str ceil → 50");
}

console.log("\nIntegration — Propagation mode");
{
  const r = computeCaroRealmCalculator({
    mode: "propagation",
    teamMaxHp: 10_000,
    currentHp: 6_000,
    realmMastery: 434,
    primordiaChaos: false,
    pureRealm: true,
  });
  assert(r.mode === "propagation", "mode");
  assert(r.missingHpFraction === 0.4, "L=0.4");
  assert(r.baseEmbryoFusionRegen === 70, "embryo ceil(50*1.4)=70");
  assert(r.baseCrimsonFurnaceRegen === 400, "furnace 10% of 4000");
  assert(r.battleEndCrimsonFurnaceGain === 0, "no battle-end row");
  assert(r.totalShield === 0, "no devour");
  assert(r.totalStr === 0, "no devour str");
  assert(r.basePropagationFiesta === 20, "fiesta base 20");
  assert(r.propagationFiestaFromRm === 9, "fiesta RM pure 9");
  assert(r.totalPropagationFiesta === 29, "fiesta total 29");
  assert(r.basePropaguleFiesta === 40, "propagule base 40");
  assert(r.propaguleFiestaFromRm === 18, "propagule RM pure 18");
  assert(r.totalPropaguleFiesta === 58, "propagule total 58");
}

console.log("\nAll caro-realm-calculator smoke checks passed.\n");
