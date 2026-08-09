/**
 * Smoke — public Aequor / Benthos Aequor Realm calculator helper.
 * Run: npx tsx scripts/smoke-aequor-realm-calculator.ts
 */
import {
  applySoulforgeAtk,
  computeAequorRealmCalculator,
  computeBaseWhiteTentacleShield,
  computeBenthosBaseWhiteTentacleShield,
  computeBenthosRedTentacleDamageFromRm,
  computeBenthosRedTentacleDamageFromRmMultiplier,
  computeBenthosWhiteTentacleShieldFromRm,
  computeRedTentacleAttackFromRm,
  computeWhiteTentacleShieldFromRm,
  resolveAequorRealmFlags,
} from "../src/lib/path-carver/aequor-realm-calculator";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
}

console.log("\nSoulforge ATK");
assert(applySoulforgeAtk(100, 1) === 103, "100 SF1 → 103");
assert(applySoulforgeAtk(101, 1) === 105, "101 SF1 → 105");
assert(applySoulforgeAtk(100, 0) === 100, "100 SF0 → 100");
assert(applySoulforgeAtk(100, 10) === 130, "100 SF10 → 130");

console.log("\nFlags — Primordia Chaos");
{
  const f = resolveAequorRealmFlags({
    primordiaChaos: true,
    pureRealm: true,
    chaosAwakeners: 3,
  });
  assert(f.chaosComboStacks === 0, "primordia → chaos 0");
  assert(f.isPure === false, "primordia → not pure");
}

console.log("\nFlags — normal");
{
  const f = resolveAequorRealmFlags({
    primordiaChaos: false,
    pureRealm: true,
    chaosAwakeners: 2,
  });
  assert(f.chaosComboStacks === 2, "chaos 2");
  assert(f.isPure === true, "pure");
}

console.log("\nRTM shields / hits");
assert(computeBaseWhiteTentacleShield(1724) === 138, "RTM26 HP1724 → 138");
assert(
  computeWhiteTentacleShieldFromRm(1724, 1000, false) === 173,
  "RTM42 not pure",
);
assert(
  computeWhiteTentacleShieldFromRm(1724, 1000, true) === 345,
  "RTM42 pure doubles rate",
);
assert(
  computeRedTentacleAttackFromRm(1000, false) === 0.2,
  "RTM43 not pure 1000→0.2",
);
assert(
  computeRedTentacleAttackFromRm(1000, true) === 0.4,
  "RTM43 pure 1000→0.4",
);
assert(
  computeRedTentacleAttackFromRm(5000, true) === 2,
  "RTM43 pure 5000→2",
);
assert(
  computeRedTentacleAttackFromRm(81.5, true) === 0.04,
  "RTM43 pure ceil(81.5)=82 → 0.04 (4%)",
);
assert(
  computeWhiteTentacleShieldFromRm(20_000, 8.1, false) === 18,
  "RTM42 RM 8.1 ceils to 9 → shield 18 (raw 8.1 would be 17)",
);
assert(
  computeRedTentacleAttackFromRm(8.1, false) === 0.01,
  "RTM43 RM 8.1 ceils to 9 → 0.01",
);

console.log("\nIntegration — tentacle matches smoke-base-tentacle (SF0)");
{
  const r = computeAequorRealmCalculator({
    teamMaxHp: 1724,
    atkSlots: [
      { atk: 135, soulforge: 0 },
      { atk: 182, soulforge: 0 },
      { atk: 190, soulforge: 0 },
      { atk: 145, soulforge: 0 },
    ],
    damageAmpTotal: 0,
    realmMastery: 0,
    accountLevel: 80,
    primordiaChaos: false,
    pureRealm: false,
    chaosAwakeners: 3,
  });
  assert(r.tentacle.rawAtk === 62, `rawAtk 62 (got ${r.tentacle.rawAtk})`);
  assert(r.tentacle.hpTerm === 54, `hpTerm 54 (got ${r.tentacle.hpTerm})`);
  assert(
    r.tentacle.valueScalar === 116,
    `tentacle 116 (got ${r.tentacle.valueScalar})`,
  );
  assert(
    r.baseRedTentacleDamage === 145,
    `RTM28 × tentacle ceil → 145 (got ${r.baseRedTentacleDamage})`,
  );
  assert(r.baseWhiteTentacleShield === 138, "white base");
  assert(r.whiteTentacleShieldFromRm === 0, "white RM 0");
  assert(r.totalWhiteTentacleShield === 138, "white total");
  assert(r.baseRedTentacleAttack === 0.5, "red base 0.5");
  assert(r.totalRedTentacleAttack === 0.5, "red total with RM0");
}

console.log("\nIntegration — amp 0.5 + pure RM");
{
  const r = computeAequorRealmCalculator({
    teamMaxHp: 1724,
    atkSlots: [
      { atk: 135, soulforge: 0 },
      { atk: 182, soulforge: 0 },
      { atk: 190, soulforge: 0 },
      { atk: 145, soulforge: 0 },
    ],
    damageAmpTotal: 0.5,
    realmMastery: 1000,
    accountLevel: 80,
    primordiaChaos: false,
    pureRealm: true,
    chaosAwakeners: 3,
  });
  assert(
    r.tentacle.valueScalar === 174,
    `amp tentacle 174 (got ${r.tentacle.valueScalar})`,
  );
  assert(r.totalWhiteTentacleShield === 138 + 345, "white total with pure RM");
  assert(r.totalRedTentacleAttack === 0.5 + 0.4, "red total with pure RM");
  assert(r.mode === "aequor", "default mode aequor");
  assert(r.redTentacleDamageFromRm === 0, "aequor has no red damage from RM");
}

console.log("\nBenthos RTM shields / damage from RM");
assert(
  computeBenthosBaseWhiteTentacleShield(1560) === 390,
  "RTM32 HP1560 → 390",
);
assert(
  computeBenthosWhiteTentacleShieldFromRm(1560, 1000, false) === 390,
  "RTM45 not pure",
);
assert(
  computeBenthosWhiteTentacleShieldFromRm(1560, 1000, true) === 780,
  "RTM45 pure doubles rate",
);
assert(
  computeBenthosWhiteTentacleShieldFromRm(20_000, 8.1, false) === 46,
  "RTM45 RM 8.1 ceils to 9 → shield 46 (fp 45.000…01)",
);
assert(
  computeBenthosRedTentacleDamageFromRmMultiplier(1000, false) === 0.25,
  "RTM44 mult not pure 1000→0.25",
);
assert(
  computeBenthosRedTentacleDamageFromRmMultiplier(1000, true) === 0.5,
  "RTM44 mult pure 1000→0.5",
);
assert(
  computeBenthosRedTentacleDamageFromRmMultiplier(8.1, false) === 0.01,
  "RTM44 mult RM 8.1 ceils to 9 → 0.01",
);
assert(
  computeBenthosRedTentacleDamageFromRm(125, 1000, false) === 32,
  "RTM44 × base 125 → 32",
);
assert(
  computeBenthosRedTentacleDamageFromRm(125, 1000, true) === 63,
  "RTM44 pure × base 125 → 63",
);

console.log("\nIntegration — benthos tentacle matches smoke-base-tentacle");
{
  const r = computeAequorRealmCalculator({
    mode: "benthos",
    teamMaxHp: 1560,
    atkSlots: [
      { atk: 0, soulforge: 0 },
      { atk: 0, soulforge: 0 },
      { atk: 0, soulforge: 0 },
      { atk: 0, soulforge: 0 },
    ],
    damageAmpTotal: 0,
    realmMastery: 0,
    accountLevel: 80,
    primordiaChaos: false,
    pureRealm: false,
    chaosAwakeners: 3,
  });
  assert(r.mode === "benthos", "mode benthos");
  assert(
    r.tentacle.valueScalar === 125,
    `tentacle 125 (got ${r.tentacle.valueScalar})`,
  );
  assert(
    r.baseRedTentacleDamage === 157,
    `RTM34 × tentacle ceil → 157 (got ${r.baseRedTentacleDamage})`,
  );
  assert(r.redTentacleDamageFromRm === 0, "red from RM 0");
  assert(r.totalRedTentacleDamage === 157, "total red damage");
  assert(r.baseWhiteTentacleShield === 390, "white base RTM32");
  assert(r.whiteTentacleShieldFromRm === 0, "white RM 0");
  assert(r.totalWhiteTentacleShield === 390, "white total");
  assert(r.baseRedTentacleAttack === 1, "RTM36 base 1");
  assert(r.redTentacleAttackFromRm === 0, "benthos no attack from RM");
  assert(r.totalRedTentacleAttack === 1, "benthos attack total = base");
}

console.log("\nIntegration — benthos amp 1.0 + pure RM");
{
  const r = computeAequorRealmCalculator({
    mode: "benthos",
    teamMaxHp: 1560,
    atkSlots: [
      { atk: 0, soulforge: 0 },
      { atk: 0, soulforge: 0 },
      { atk: 0, soulforge: 0 },
      { atk: 0, soulforge: 0 },
    ],
    damageAmpTotal: 1.0,
    realmMastery: 1000,
    accountLevel: 80,
    primordiaChaos: false,
    pureRealm: true,
    chaosAwakeners: 3,
  });
  assert(
    r.tentacle.valueScalar === 250,
    `amp tentacle 250 (got ${r.tentacle.valueScalar})`,
  );
  assert(
    r.baseRedTentacleDamage === 313,
    `RTM34 × 250 → 313 (got ${r.baseRedTentacleDamage})`,
  );
  assert(
    r.redTentacleDamageFromRm === 125,
    `RTM44 pure × 250 → 125 (got ${r.redTentacleDamageFromRm})`,
  );
  assert(
    r.redTentacleDamageFromRmMultiplier === 0.5,
    `RTM44 pure mult 0.5 (got ${r.redTentacleDamageFromRmMultiplier})`,
  );
  assert(
    r.totalRedTentacleDamage === 313 + 125,
    "total red = base + from RM",
  );
  assert(
    r.totalWhiteTentacleShield === 390 + 780,
    "white total with pure RM",
  );
  assert(r.baseRedTentacleAttack === 1, "attack stays RTM36");
}

console.log("\nAll aequor-realm-calculator smoke checks passed.\n");
