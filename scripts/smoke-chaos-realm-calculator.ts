/**
 * Smoke — public Chaos Realm calculator helper.
 * Run: npx tsx scripts/smoke-chaos-realm-calculator.ts
 */
import {
  computeAliemusPerPosseFromRm,
  computeBaseAliemusPerPosse,
  computeChaosRealmCalculator,
  computeRmNeededForNextAliemusPerPosse,
  RTM_BASE_ALIEMUS_PER_POSSE_SCALAR,
} from "../src/lib/path-carver/chaos-realm-calculator";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
}

console.log("\nRTM 3 — Base Aliemus Per Posse");
assert(computeBaseAliemusPerPosse() === 5, "flat scalar 5");
assert(
  RTM_BASE_ALIEMUS_PER_POSSE_SCALAR === 5,
  "exported constant matches RTM 3",
);

console.log("\nRTM 37 — Aliemus Per Posse from RM");
assert(computeAliemusPerPosseFromRm(0) === 0, "RM 0 → 0");
assert(computeAliemusPerPosseFromRm(8.1) === 1, "RM 8.1 → ceil 9 → ceil(0.45)=1");
assert(computeAliemusPerPosseFromRm(100) === 5, "RM 100 → 5");
assert(computeAliemusPerPosseFromRm(-3) === 0, "negative RM clamped → 0");

console.log("\nRM needed for +1");
assert(computeRmNeededForNextAliemusPerPosse(0) === 1, "RM 0 → need 1 for first");
assert(
  computeRmNeededForNextAliemusPerPosse(8.1) === 21 - 8.1,
  "RM 8.1 (fromRm 1) → need 12.9 to reach ceil RM 21",
);
assert(
  computeRmNeededForNextAliemusPerPosse(20) === 1,
  "RM 20 (fromRm 1) → need 1 to reach 21",
);
assert(
  computeRmNeededForNextAliemusPerPosse(100) === 1,
  "RM 100 (fromRm 5) → need 1 to reach ceil RM 101",
);

console.log("\nFull calculator");
{
  const r = computeChaosRealmCalculator({ realmMastery: 0 });
  assert(r.baseAliemusPerPosse === 5, "RM 0 base 5");
  assert(r.aliemusPerPosseFromRm === 0, "RM 0 fromRm 0");
  assert(r.rmNeededForNextAliemusPerPosse === 1, "RM 0 needed 1");
  assert(r.totalAliemusPerPosse === 5, "RM 0 total 5");
}
{
  const r = computeChaosRealmCalculator({ realmMastery: 8.1 });
  assert(r.baseAliemusPerPosse === 5, "RM 8.1 base 5");
  assert(r.aliemusPerPosseFromRm === 1, "RM 8.1 fromRm 1");
  assert(r.rmNeededForNextAliemusPerPosse === 12.9, "RM 8.1 needed 12.9");
  assert(r.totalAliemusPerPosse === 6, "RM 8.1 total 6");
}
{
  const r = computeChaosRealmCalculator({ realmMastery: 100 });
  assert(r.baseAliemusPerPosse === 5, "RM 100 base 5");
  assert(r.aliemusPerPosseFromRm === 5, "RM 100 fromRm 5");
  assert(r.rmNeededForNextAliemusPerPosse === 1, "RM 100 needed 1");
  assert(r.totalAliemusPerPosse === 10, "RM 100 total 10");
}

console.log("\nAll Chaos Realm calculator smokes passed.\n");
