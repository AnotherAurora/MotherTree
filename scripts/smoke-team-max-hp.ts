/**
 * Phase 2b.2 smoke — team Max HP formula + Max HP Up from DR + team_max_hp scaling.
 * Run: npx tsx scripts/smoke-team-max-hp.ts
 */
import { hpMultiplierForLevel } from "../src/lib/path-carver/account-level-hp-multipliers";
import {
  DEFENDER_BASE_DEATH_RESIST_TAG_ID,
  DEFENDER_MAX_HP_UP_TAG_ID,
  IN_MISSION_DEATH_RESIST_TAG_ID,
  SPECIAL_CAUSE_DEATH_RESIST_TRIGGER_TAG_ID,
  baseDeathResistReduction,
  baseDeathResistReductionToMaxHpUp,
  buildDeathResistDerivedManifestations,
} from "../src/lib/path-carver/death-resist-trigger";
import { scaleValueScalar } from "../src/lib/path-carver/effective-value-scalar";
import {
  computeBonusMaxHpFromMaxHpUp,
  computeEffectiveHpLevel,
  computeTeamMaxHp,
  DEFAULT_ACCOUNT_LEVEL,
  DEFAULT_AWAKENER_LEVEL,
} from "../src/lib/path-carver/team-max-hp";
import { computeReviewTagTotals } from "../src/lib/path-carver/aggregate-tag-scalars";
import { createManifestationApplyContext } from "../src/lib/path-carver/manifestation-apply";
import { REQUIRED_BASE_STAT_TAG_IDS } from "../src/lib/path-carver/awakener-base-stats";
import type {
  Awakener,
  Manifestation,
  Tag,
  TeamData,
} from "../src/lib/team-data/types";
import { createEmptyTeamData } from "../src/lib/team-data/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
}

function makeTag(
  id: number,
  tagName: string,
  isPercent = false,
): Tag {
  return { id, tagName, layer: null, isPercent, isAdditive: true };
}

function makeAwakener(partial: Partial<Awakener> & { id: number }): Awakener {
  return {
    id: partial.id,
    name: partial.name ?? `A${partial.id}`,
    realm: null,
    realmId: null,
    con: partial.con ?? null,
    atk: partial.atk ?? null,
    def: partial.def ?? null,
    keyflareRegen: partial.keyflareRegen ?? null,
    damageAmp: partial.damageAmp ?? null,
    critRate: partial.critRate ?? null,
    critDmg: partial.critDmg ?? null,
    realmMastery: partial.realmMastery ?? null,
    baseAliemus: partial.baseAliemus ?? null,
    aliemusRegen: partial.aliemusRegen ?? null,
    sigilYield: partial.sigilYield ?? null,
    deathResist: partial.deathResist ?? null,
    enlightenment: partial.enlightenment ?? null,
  };
}

function makeManifestation(
  partial: Partial<Manifestation> & {
    id: number;
    tagId: number;
    tagName: string;
  },
): Manifestation {
  return {
    sourceKind: partial.sourceKind ?? "awakener",
    awakenerId: partial.awakenerId ?? 1,
    slotIndex: partial.slotIndex ?? 0,
    sourceName: partial.sourceName ?? null,
    valueScalar: partial.valueScalar ?? 0,
    baseHits: null,
    dependencyStat: partial.dependencyStat ?? null,
    sourceType: partial.sourceType ?? null,
    targetType: partial.targetType ?? null,
    buffTargetTypeRestriction: null,
    metadata: null,
    isAccumulating: false,
    requiredEnlightenment: null,
    requiredAwakenerId: null,
    requiredAwakenerName: null,
    requiredRealm: null,
    requiredRealm2: null,
    requiredRealmId: null,
    requiredRealmId2: null,
    replacesManifestationId: null,
    interactionOverrides: [],
    isBaseStatTransfer: partial.isBaseStatTransfer ?? false,
    triggerCondition: partial.triggerCondition ?? null,
    id: partial.id,
    tagId: partial.tagId,
    tagName: partial.tagName,
  };
}

console.log("HpMultiplier table");
{
  assert(hpMultiplierForLevel(60) === 2.26, "level 60 → 2.26");
  assert(hpMultiplierForLevel(70) === 2.6, "level 70 → 2.6");
  assert(hpMultiplierForLevel(73) === 2.64, "level 73 → 2.64");
  assert(hpMultiplierForLevel(80) === 2.74, "level 80 → 2.74");
  assert(hpMultiplierForLevel(100) === 3.03, "level 100 → 3.03");
}

console.log("\nDatamine baseline examples");
{
  // Example A: acct 70, levels 60×4, CON 614 → 1597
  const a = computeTeamMaxHp({
    awakeners: [
      { con: 120 },
      { con: 162 },
      { con: 152 },
      { con: 180 },
    ],
    maxHpUpTotal: 0,
    accountLevel: 70,
    awakenerLevels: [60, 60, 60, 60],
  });
  assert(a.effectiveHpLevel === 70, "example A effective level 70");
  assert(a.baselineMaxHp === 1597, `example A baseline 1597 (got ${a.baselineMaxHp})`);
  assert(a.finalMaxHp === 1597, "example A final = baseline");

  // Example B: acct 70, levels 80/70/70/80, CON 583 → 1540
  const b = computeTeamMaxHp({
    awakeners: [
      { con: 154 },
      { con: 153 },
      { con: 121 },
      { con: 155 },
    ],
    maxHpUpTotal: 0,
    accountLevel: 70,
    awakenerLevels: [80, 70, 70, 80],
  });
  assert(b.awakenerAverageLevel === 75, "example B avg 75");
  assert(b.effectiveHpLevel === 73, "example B effective 73");
  assert(b.baselineMaxHp === 1540, `example B baseline 1540 (got ${b.baselineMaxHp})`);
}

console.log("\nPath Carver defaults (60/60)");
{
  assert(DEFAULT_ACCOUNT_LEVEL === 60, "default account 60");
  assert(DEFAULT_AWAKENER_LEVEL === 60, "default awakener 60");
  const r = computeTeamMaxHp({
    awakeners: [
      { con: 135 },
      { con: 108 },
      { con: 170 },
      { con: 145 },
    ],
    maxHpUpTotal: 0,
  });
  assert(r.effectiveHpLevel === 60, "defaults → effective 60");
  assert(r.hpMultiplier === 2.26, "defaults use HpMultiplier 2.26");
  assert(r.totalCon === 558, "CON sum 558");
  assert(r.baselineMaxHp === 1262, `baseline ceil(558*2.26)=1262 (got ${r.baselineMaxHp})`);
}

console.log("\nEffective HP level blend");
{
  assert(
    computeEffectiveHpLevel(80, [60, 60, 60, 60]) === 80,
    "account > avg → account",
  );
  assert(
    computeEffectiveHpLevel(70, [80, 70, 70, 80]) === 73,
    "awakeners outlevel → blend 73",
  );
  assert(
    computeEffectiveHpLevel(60, [60, 60, 60, 60]) === 60,
    "equal → blend 60",
  );
}

console.log("\nMax HP Up direct fraction (0.1 = +10%)");
{
  const baseline = 1529;
  // Birth of a Soul-style Max HP Up
  assert(
    computeBonusMaxHpFromMaxHpUp(baseline, 0.1) === 153,
    `+10% of 1529 → ceil(152.9)=153 (got ${computeBonusMaxHpFromMaxHpUp(baseline, 0.1)})`,
  );
  // DR reduction maps to capped Max HP Up fraction (+2.5% at 100% DR)
  const reduction = baseDeathResistReduction(1);
  assert(Math.abs(reduction - 0.75) < 1e-9, "100% DR → reduction 0.75");
  assert(
    Math.abs(baseDeathResistReductionToMaxHpUp(1) - 0.025) < 1e-9,
    "100% DR reduction maps to +2.5% Max HP Up",
  );
}

console.log("\nDR-derived Max HP Up cap + wheel stacking");
{
  const baseline = 1000;
  // 100% DR → +2.5%; plus Birth of a Soul 0.1
  const maxHpUp = baseDeathResistReductionToMaxHpUp(1) + 0.1;
  const bonus = computeBonusMaxHpFromMaxHpUp(baseline, maxHpUp);
  assert(bonus === 125, `0.025+0.1 → ceil(1000*0.125)=125 (got ${bonus})`);
  assert(
    Math.abs(baseDeathResistReductionToMaxHpUp(4) - 0.1) < 1e-9,
    "400% DR cap → +10% Max HP Up",
  );
  assert(
    Math.abs(baseDeathResistReductionToMaxHpUp(10) - 0.1) < 1e-9,
    "over-cap DR still limited to +10% Max HP Up",
  );
}

console.log("\nteam_max_hp dependency scaling");
{
  const awakener = makeAwakener({ id: 1, atk: 100 });
  assert(
    scaleValueScalar(0.01, "team_max_hp", awakener, "awakener") === 0.01,
    "team_max_hp ignored without context",
  );
  assert(
    scaleValueScalar(0.01, "team_max_hp", awakener, "awakener", false, 1529) ===
      16,
    "team_max_hp × 1529 → ceil(15.29)=16",
  );
  assert(
    scaleValueScalar(0.01, "team_max_hp", awakener, "awakener", true, 1529) ===
      15.29,
    "team_max_hp percent tag → ceil 2dp",
  );
  assert(
    scaleValueScalar(10, "enemy_max_hp", awakener, "awakener", false, 1529) ===
      10,
    "enemy_max_hp still ignored",
  );
}

console.log("\nDR synthetic Max HP Up + computeReviewTagTotals");
{
  assert(
    REQUIRED_BASE_STAT_TAG_IDS.includes(DEFENDER_MAX_HP_UP_TAG_ID),
    "tag 130 required",
  );

  const tagsById: Record<number, Tag> = {
    [DEFENDER_BASE_DEATH_RESIST_TAG_ID]: makeTag(
      DEFENDER_BASE_DEATH_RESIST_TAG_ID,
      "Defender.Base Death Resist",
      true,
    ),
    [IN_MISSION_DEATH_RESIST_TAG_ID]: makeTag(
      IN_MISSION_DEATH_RESIST_TAG_ID,
      "Defender.Base Death Resist.In Mission Death Resist",
      true,
    ),
    [SPECIAL_CAUSE_DEATH_RESIST_TRIGGER_TAG_ID]: makeTag(
      SPECIAL_CAUSE_DEATH_RESIST_TRIGGER_TAG_ID,
      "Special.Cause.Death Resist Trigger",
    ),
    [DEFENDER_MAX_HP_UP_TAG_ID]: makeTag(
      DEFENDER_MAX_HP_UP_TAG_ID,
      "Defender.Max HP Up",
      true,
    ),
  };

  const derived = buildDeathResistDerivedManifestations(2.764, 0, tagsById);
  const maxHpUp = derived.find((m) => m.tagId === DEFENDER_MAX_HP_UP_TAG_ID);
  assert(maxHpUp != null, "synthetic Max HP Up present");
  assert(
    Math.abs((maxHpUp!.valueScalar ?? 0) - 0.0691) < 1e-9,
    `reduction maps to 0.0691 Max HP Up (got ${maxHpUp!.valueScalar})`,
  );

  const awakeners = [
    makeAwakener({ id: 1, con: 135, deathResist: 2.764 }),
    makeAwakener({ id: 2, con: 108 }),
    makeAwakener({ id: 3, con: 170 }),
    makeAwakener({ id: 4, con: 145 }),
  ];
  const teamData: TeamData = {
    ...createEmptyTeamData(),
    awakeners,
    manifestations: [],
    tagsById,
  };
  const { teamMaxHp, totalsByTagId } = computeReviewTagTotals(
    teamData,
    createManifestationApplyContext(awakeners, []),
  );

  // Defaults 60/60: baseline 1262; Max HP Up from DR only = 0.0691
  // bonus = ceil(1262 * 0.0691) = 88; final = 1350
  assert(teamMaxHp.totalCon === 558, "review total CON 558");
  assert(teamMaxHp.baselineMaxHp === 1262, "review baseline 1262");
  assert(
    Math.abs(teamMaxHp.maxHpUpTotal - 0.0691) < 1e-9,
    `review Max HP Up 0.0691 (got ${teamMaxHp.maxHpUpTotal})`,
  );
  assert(
    teamMaxHp.bonusMaxHp === 88,
    `review bonus 88 (got ${teamMaxHp.bonusMaxHp})`,
  );
  assert(
    teamMaxHp.finalMaxHp === 1350,
    `review final 1350 (got ${teamMaxHp.finalMaxHp})`,
  );
  assert(
    Math.abs((totalsByTagId.get(DEFENDER_MAX_HP_UP_TAG_ID) ?? 0) - 0.0691) <
      1e-9,
    "tag 130 in totals",
  );
}

console.log("\nAll smoke-team-max-hp checks passed.");
