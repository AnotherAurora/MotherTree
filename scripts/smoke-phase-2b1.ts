/**
 * Phase 2b.1 smoke — awakener total base stats (gear + DR + Special.Increase)
 * + synthetic base-stat transfers.
 * + Death Resist → In Mission → Cause Trigger.
 * Run: npx tsx scripts/smoke-phase-2b1.ts
 */
import { applyInteractions } from "../src/lib/path-carver/apply-interactions";
import {
  applyAliemusDiminishingReturn,
  applyKeyflareDiminishingReturn,
  buildBaseStatTransferManifestations,
  computeAwakenerTotalBaseStats,
  REQUIRED_BASE_STAT_TAG_IDS,
  SPECIAL_INCREASE_BASE_ATK_TAG_ID,
  SPECIAL_INCREASE_BASE_DEF_TAG_ID,
  SPECIAL_INCREASE_BASE_KEYFLARE_TAG_ID,
} from "../src/lib/path-carver/awakener-base-stats";
import {
  DEFENDER_BASE_DEATH_RESIST_TAG_ID,
  DEFENDER_MAX_HP_UP_TAG_ID,
  IN_MISSION_DEATH_RESIST_TAG_ID,
  SPECIAL_CAUSE_DEATH_RESIST_TRIGGER_TAG_ID,
  baseDeathResistToInMission,
  buildDeathResistDerivedManifestations,
  inMissionToCauseTrigger,
} from "../src/lib/path-carver/death-resist-trigger";
import { computeReviewTagTotals } from "../src/lib/path-carver/aggregate-tag-scalars";
import {
  createManifestationApplyContext,
  evaluateManifestationApply,
} from "../src/lib/path-carver/manifestation-apply";
import {
  SPECIAL_WHEN_DEATH_RESIST_TRIGGER_TAG_ID,
  SPECIAL_WHEN_POSSE_TAG_ID,
  SUPPORT_CREATE_POSSE_TAG_ID,
  buildTriggerCounts,
} from "../src/lib/path-carver/trigger-condition";
import {
  buildAwakenersById,
  scaleValueScalar,
} from "../src/lib/path-carver/effective-value-scalar";
import type {
  Awakener,
  DefaultInteraction,
  GearStatContribution,
  Manifestation,
  Tag,
  TeamData,
} from "../src/lib/team-data/types";
import { createEmptyTeamData } from "../src/lib/team-data/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
}

function makeAwakener(partial: Partial<Awakener> & { id: number }): Awakener {
  return {
    name: partial.name ?? `A${partial.id}`,
    realm: partial.realm ?? "chaos",
    realmId: partial.realmId ?? 1,
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
    enlightenment: partial.enlightenment ?? 3,
    ...partial,
  };
}

function makeTag(
  id: number,
  tagName: string,
  isPercent = false,
  isAdditive = true,
): Tag {
  return { id, tagName, layer: null, isPercent, isAdditive };
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
    instanceCount: 1,
    baseCopies: 1,
    copyProviderGroupId: null,
    copyProviderGroupName: null,
    copyProviderTagIds: [],
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
    interactionOverrides: partial.interactionOverrides ?? [],
    isBaseStatTransfer: partial.isBaseStatTransfer ?? false,
    isCreatedBase: partial.isCreatedBase ?? false,
    triggerCondition: null,
    realmId: null,
    requiredRealmMode: null,
    dependencyRate: null,
    dependencyRateStat: null,
    pureBonusTarget: null,
    ...partial,
  };
}

function makeInteraction(
  partial: Partial<DefaultInteraction> & {
    id: number;
    modifierTagId: number;
    modifierTagName: string;
    targetTagId: number;
    targetTagName: string;
  },
): DefaultInteraction {
  return {
    exclusionTagId: null,
    exclusionTagName: null,
    mathOperation: partial.mathOperation ?? "add_scaled",
    defaultFactor: partial.defaultFactor ?? 1,
    buffTargetTypeRestriction: null,
    createsBase: partial.createsBase ?? false,
    amplifiesSubject: partial.amplifiesSubject ?? true,
    ...partial,
  };
}

console.log("Keyflare diminishing return");
{
  assert(applyKeyflareDiminishingReturn(15) === 15, "x=15 → 15");
  const x = 144;
  const expected = Math.ceil(15 + (144 * (x - 15)) / (x + 129));
  assert(
    applyKeyflareDiminishingReturn(x) === expected,
    `x=144 → ${expected}`,
  );
}

console.log("\nGear sum into total base stats");
{
  const awakener = makeAwakener({ id: 1, atk: 100, keyflareRegen: 15 });
  const contributions: GearStatContribution[] = [
    {
      awakenerId: 1,
      sourceKind: "wheel",
      entityId: 10,
      stat: "atk",
      statAmount: 10,
    },
    {
      awakenerId: 1,
      sourceKind: "wheel",
      entityId: 11,
      stat: "atk",
      statAmount: 20,
    },
    {
      awakenerId: 1,
      sourceKind: "covenant",
      entityId: 20,
      stat: "atk",
      statAmount: 5,
    },
  ];
  const teamSlice: Pick<
    TeamData,
    "awakeners" | "gearStatContributions" | "tagsById"
  > = {
    awakeners: [awakener],
    gearStatContributions: contributions,
    tagsById: {},
  };
  const [total] = computeAwakenerTotalBaseStats(teamSlice, []);
  assert(total.atk === 135, `atk 100+10+20+5 = 135 (got ${total.atk})`);
  assert(
    total.keyflareRegen === 15,
    `keyflare DR at floor stays 15 (got ${total.keyflareRegen})`,
  );
}

console.log("\nSpecial.Increase Base Keyflare stacking (additive on original)");
{
  const awakener = makeAwakener({ id: 1, keyflareRegen: 15 });
  const specialTag = makeTag(
    SPECIAL_INCREASE_BASE_KEYFLARE_TAG_ID,
    "Special.Increase Base Keyflare",
    true,
  );
  const applied = [
    makeManifestation({
      id: 1,
      tagId: specialTag.id,
      tagName: specialTag.tagName,
      valueScalar: 0.1,
    }),
    makeManifestation({
      id: 2,
      tagId: specialTag.id,
      tagName: specialTag.tagName,
      valueScalar: 0.2,
    }),
  ];
  const [total] = computeAwakenerTotalBaseStats(
    {
      awakeners: [awakener],
      gearStatContributions: [],
      tagsById: { [specialTag.id]: specialTag },
    },
    applied,
  );
  assert(
    total.keyflareRegen === 20,
    `ceil(15 * 1.3) = 20 (got ${total.keyflareRegen})`,
  );
}

console.log("\ndependency_stat uses post–Special.Increase keyflare");
{
  const awakener = makeAwakener({ id: 1, keyflareRegen: 15 });
  const specialTag = makeTag(
    SPECIAL_INCREASE_BASE_KEYFLARE_TAG_ID,
    "Special.Increase Base Keyflare",
    true,
  );
  const applied = [
    makeManifestation({
      id: 1,
      tagId: specialTag.id,
      tagName: specialTag.tagName,
      valueScalar: 0.1,
    }),
  ];
  const [total] = computeAwakenerTotalBaseStats(
    {
      awakeners: [awakener],
      gearStatContributions: [],
      tagsById: { [specialTag.id]: specialTag },
    },
    applied,
  );
  // ceil(15 * 1.1) = 17; raw 2 * 17 → 34
  assert(
    scaleValueScalar(2, "keyflare_regen", total, "awakener") === 34,
    `keyflare dep after boost: 2 * 17 → 34 (got ${scaleValueScalar(2, "keyflare_regen", total, "awakener")})`,
  );
}

console.log("\nSpecial.Increase Base ATK stacking (additive on original)");
{
  const awakener = makeAwakener({ id: 1, atk: 100 });
  const specialTag = makeTag(
    SPECIAL_INCREASE_BASE_ATK_TAG_ID,
    "Special.Increase Base ATK",
  );
  const applied = [
    makeManifestation({
      id: 1,
      tagId: specialTag.id,
      tagName: specialTag.tagName,
      valueScalar: 0.1,
    }),
    makeManifestation({
      id: 2,
      tagId: specialTag.id,
      tagName: specialTag.tagName,
      valueScalar: 0.2,
    }),
  ];
  const [total] = computeAwakenerTotalBaseStats(
    {
      awakeners: [awakener],
      gearStatContributions: [],
      tagsById: { [specialTag.id]: specialTag },
    },
    applied,
  );
  assert(total.atk === 130, `ceil(100 * 1.3) = 130 (got ${total.atk})`);
}

console.log("\nSpecial.Increase Base DEF stacking (additive on original)");
{
  const awakener = makeAwakener({ id: 1, def: 100 });
  const specialTag = makeTag(
    SPECIAL_INCREASE_BASE_DEF_TAG_ID,
    "Special.Increase Base DEF",
  );
  const applied = [
    makeManifestation({
      id: 1,
      tagId: specialTag.id,
      tagName: specialTag.tagName,
      valueScalar: 0.1,
    }),
    makeManifestation({
      id: 2,
      tagId: specialTag.id,
      tagName: specialTag.tagName,
      valueScalar: 0.2,
    }),
  ];
  const [total] = computeAwakenerTotalBaseStats(
    {
      awakeners: [awakener],
      gearStatContributions: [],
      tagsById: { [specialTag.id]: specialTag },
    },
    applied,
  );
  assert(total.def === 130, `ceil(100 * 1.3) = 130 (got ${total.def})`);
}

console.log("\nSpecial.Increase Base ATK realm fans out to all awakeners");
{
  const a1 = makeAwakener({ id: 1, atk: 100 });
  const a2 = makeAwakener({ id: 2, atk: 200 });
  const specialTag = makeTag(
    SPECIAL_INCREASE_BASE_ATK_TAG_ID,
    "Special.Increase Base ATK",
  );
  const applied = [
    makeManifestation({
      id: 1,
      tagId: specialTag.id,
      tagName: specialTag.tagName,
      valueScalar: 0.1,
      sourceKind: "realm",
      awakenerId: null,
      realmId: 8,
      requiredRealmMode: "present",
      pureBonusTarget: "none",
    }),
  ];
  const totals = computeAwakenerTotalBaseStats(
    {
      awakeners: [a1, a2],
      gearStatContributions: [],
      tagsById: { [specialTag.id]: specialTag },
    },
    applied,
  );
  const byId = Object.fromEntries(totals.map((a) => [a.id, a]));
  assert(byId[1].atk === 110, `realm ATK A1: ceil(100 * 1.1) = 110 (got ${byId[1].atk})`);
  assert(byId[2].atk === 220, `realm ATK A2: ceil(200 * 1.1) = 220 (got ${byId[2].atk})`);
}

console.log("\nSpecial.Increase Base ATK owned row only boosts owner");
{
  const a1 = makeAwakener({ id: 1, atk: 100 });
  const a2 = makeAwakener({ id: 2, atk: 200 });
  const specialTag = makeTag(
    SPECIAL_INCREASE_BASE_ATK_TAG_ID,
    "Special.Increase Base ATK",
  );
  const applied = [
    makeManifestation({
      id: 1,
      tagId: specialTag.id,
      tagName: specialTag.tagName,
      valueScalar: 0.1,
      awakenerId: 1,
    }),
  ];
  const totals = computeAwakenerTotalBaseStats(
    {
      awakeners: [a1, a2],
      gearStatContributions: [],
      tagsById: { [specialTag.id]: specialTag },
    },
    applied,
  );
  const byId = Object.fromEntries(totals.map((a) => [a.id, a]));
  assert(byId[1].atk === 110, `owned ATK A1: ceil(100 * 1.1) = 110 (got ${byId[1].atk})`);
  assert(byId[2].atk === 200, `owned ATK A2 unchanged 200 (got ${byId[2].atk})`);
}

console.log("\ndependency_stat uses post–Special.Increase atk");
{
  const awakener = makeAwakener({ id: 1, atk: 100 });
  const specialTag = makeTag(
    SPECIAL_INCREASE_BASE_ATK_TAG_ID,
    "Special.Increase Base ATK",
  );
  const applied = [
    makeManifestation({
      id: 1,
      tagId: specialTag.id,
      tagName: specialTag.tagName,
      valueScalar: 0.1,
    }),
  ];
  const [total] = computeAwakenerTotalBaseStats(
    {
      awakeners: [awakener],
      gearStatContributions: [],
      tagsById: { [specialTag.id]: specialTag },
    },
    applied,
  );
  // ceil(100 * 1.1) = 110; raw 2 * 110 → 220
  assert(
    scaleValueScalar(2, "atk", total, "awakener") === 220,
    `atk dep after boost: 2 * 110 → 220 (got ${scaleValueScalar(2, "atk", total, "awakener")})`,
  );
}

console.log("\nSynthetic transfers + interaction immunity / modifier role");
{
  const critDmgTag = makeTag(17, "Support.Crit Damage", true);
  const aliemusTag = makeTag(28, "Support.Aliemus", true);
  const increaseAliemus = makeTag(99, "Support.Increase Gain.Aliemus", true);
  const activeTag = makeTag(42, "Attacker.Active Damage");

  const tagsById: Record<number, Tag> = {
    [critDmgTag.id]: critDmgTag,
    [aliemusTag.id]: aliemusTag,
    [increaseAliemus.id]: increaseAliemus,
    [activeTag.id]: activeTag,
  };

  const aliemusSum = 2.4;
  const expectedAliemus = applyAliemusDiminishingReturn(aliemusSum);
  assert(expectedAliemus === 3, `DR(2.4) → 3 (got ${expectedAliemus})`);

  const awakener = makeAwakener({
    id: 1,
    critDmg: 0.5,
    aliemusRegen: aliemusSum,
  });
  const [total] = computeAwakenerTotalBaseStats(
    { awakeners: [awakener], gearStatContributions: [], tagsById },
    [],
  );
  assert(
    total.aliemusRegen === expectedAliemus,
    `total aliemusRegen after DR = ${expectedAliemus} (got ${total.aliemusRegen})`,
  );
  const transfers = buildBaseStatTransferManifestations([total], tagsById);
  const syntheticCrit = transfers.find((m) => m.tagId === 17);
  const syntheticAliemus = transfers.find((m) => m.tagId === 28);
  assert(syntheticCrit != null, "synthetic Support.Crit Damage present");
  assert(syntheticAliemus != null, "synthetic Support.Aliemus present");
  assert(
    syntheticCrit!.targetType === "self",
    "crit_dmg transfer target_type=self",
  );
  assert(
    syntheticAliemus!.valueScalar === expectedAliemus,
    `aliemus transfer value matches DR (${syntheticAliemus!.valueScalar})`,
  );

  const active = makeManifestation({
    id: 100,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 100,
    sourceType: "command card",
  });
  const increase = makeManifestation({
    id: 101,
    tagId: increaseAliemus.id,
    tagName: increaseAliemus.tagName,
    valueScalar: 0.5,
    targetType: "self",
  });

  const applied = [active, increase, syntheticCrit!, syntheticAliemus!];
  const awakenersById = buildAwakenersById([total]);

  const result = applyInteractions({
    manifestations: applied,
    appliedManifestations: applied,
    defaultInteractions: [
      makeInteraction({
        id: 1,
        modifierTagId: critDmgTag.id,
        modifierTagName: critDmgTag.tagName,
        targetTagId: activeTag.id,
        targetTagName: activeTag.tagName,
        mathOperation: "multiply_one_plus",
        defaultFactor: 1,
      }),
      makeInteraction({
        id: 2,
        modifierTagId: increaseAliemus.id,
        modifierTagName: increaseAliemus.tagName,
        targetTagId: aliemusTag.id,
        targetTagName: aliemusTag.tagName,
        mathOperation: "add_scaled",
        defaultFactor: 1,
      }),
    ],
    tagsById,
    awakenersById,
  });

  // Active Damage boosted by synthetic Crit Damage 0.5 → 100 * (1+0.5) = 150
  assert(
    (result.totalsByTagId.get(activeTag.id) ?? 0) === 150,
    `synthetic Crit Damage modifies Active (${result.totalsByTagId.get(activeTag.id)})`,
  );
  // Synthetic Aliemus stays at DR result — Increase Gain must not change transfer subject
  assert(
    (result.totalsByTagId.get(aliemusTag.id) ?? 0) === expectedAliemus,
    `synthetic Aliemus immune to Increase Gain (${result.totalsByTagId.get(aliemusTag.id)})`,
  );
}

console.log("\nAliemus regen: gear sum then DR");
{
  assert(applyAliemusDiminishingReturn(4.8) === 5, "DR(4.8) → 5");
  assert(applyAliemusDiminishingReturn(7.2) === 7, "DR(7.2) → 7");

  const awakener = makeAwakener({ id: 1, aliemusRegen: 4.8 });
  const contributions: GearStatContribution[] = [
    {
      awakenerId: 1,
      sourceKind: "wheel",
      entityId: 10,
      stat: "aliemus_regen",
      statAmount: 2.4,
    },
  ];
  const [total] = computeAwakenerTotalBaseStats(
    { awakeners: [awakener], gearStatContributions: contributions, tagsById: {} },
    [],
  );
  assert(
    total.aliemusRegen === 7,
    `aliemus 4.8+2.4 → DR → 7 (got ${total.aliemusRegen})`,
  );

  const aliemusTag = makeTag(28, "Support.Aliemus", false);
  const transfers = buildBaseStatTransferManifestations([total], {
    [aliemusTag.id]: aliemusTag,
  });
  const synthetic = transfers.find((m) => m.tagId === 28);
  assert(synthetic != null, "synthetic Support.Aliemus after gear+DR");
  assert(
    synthetic!.valueScalar === 7,
    `transfer value_scalar = 7 (got ${synthetic!.valueScalar})`,
  );
  assert(synthetic!.targetType === "self", "aliemus transfer target_type=self");
}

console.log("\nDeath Resist → In Mission → Cause Trigger (pure)");
{
  assert(baseDeathResistToInMission(4) === 1, "400% base → 100% In Mission");
  assert(inMissionToCauseTrigger(1) === 1, "100% In Mission → 1 Cause");
  assert(baseDeathResistToInMission(5) === 2, "500% base → 200% In Mission");
  assert(inMissionToCauseTrigger(2) === 2, "200% In Mission → 2 Cause");
  // 1.01 → +1, ceil(0.505→0.51); 0.51 < 1 → stop
  assert(
    inMissionToCauseTrigger(1.01) === 1,
    "101% In Mission → 1 Cause (halve ceils to 0.51)",
  );
  assert(
    baseDeathResistToInMission(1) === 0.25,
    "100% base → 25% In Mission (below cap)",
  );
  assert(inMissionToCauseTrigger(0.25) === 0, "25% In Mission → 0 Cause");
  assert(baseDeathResistToInMission(0) === 0, "0 base → 0 In Mission");
  // User bug: ATM + Base stat (4.024), not Base stat alone (3.024 → 0.756)
  assert(
    baseDeathResistToInMission(4.024) === 1.024,
    "4.024 full tag 12 → 1.024 In Mission",
  );
}

console.log("\nDeath Resist derived transfers (builder + Layer B)");
{
  const baseTag = makeTag(
    DEFENDER_BASE_DEATH_RESIST_TAG_ID,
    "Defender.Base Death Resist",
    true,
  );
  const inMissionTag = makeTag(
    IN_MISSION_DEATH_RESIST_TAG_ID,
    "Defender.Base Death Resist.In Mission Death Resist",
    true,
  );
  const causeTag = makeTag(
    SPECIAL_CAUSE_DEATH_RESIST_TRIGGER_TAG_ID,
    "Special.Cause.Death Resist Trigger",
  );
  const maxHpUpTag = makeTag(
    DEFENDER_MAX_HP_UP_TAG_ID,
    "Defender.Max HP Up",
    true,
  );

  const tagsById: Record<number, Tag> = {
    [baseTag.id]: baseTag,
    [inMissionTag.id]: inMissionTag,
    [causeTag.id]: causeTag,
    [maxHpUpTag.id]: maxHpUpTag,
  };

  // 500% base → synth In Mission 2, Cause 2, Max HP Up 0.1 (+10% from 300% reduction / 30)
  {
    const derived = buildDeathResistDerivedManifestations(5, 0, tagsById);
    const synth147 = derived.find((m) => m.tagId === inMissionTag.id);
    const synth88 = derived.find((m) => m.tagId === causeTag.id);
    const synth130 = derived.find((m) => m.tagId === DEFENDER_MAX_HP_UP_TAG_ID);
    assert(synth147 != null, "synth In Mission present");
    assert(synth88 != null, "synth Cause present");
    assert(synth130 != null, "synth Max HP Up present");
    assert(synth147!.valueScalar === 2, "synth In Mission value 2");
    assert(synth88!.valueScalar === 2, "synth Cause value 2");
    assert(synth130!.valueScalar === 0.1, "synth Max HP Up 0.1 (+10%)");
    assert(synth147!.isBaseStatTransfer === true, "In Mission is transfer");
    assert(synth147!.targetType === "aoe", "In Mission target_type aoe");
    assert(synth88!.isBaseStatTransfer === true, "Cause is transfer");
    assert(synth88!.targetType === "aoe", "Cause target_type aoe");
    assert(synth130!.isBaseStatTransfer === true, "Max HP Up is transfer");

    const baseM = makeManifestation({
      id: 1,
      tagId: baseTag.id,
      tagName: baseTag.tagName,
      valueScalar: 5,
      isBaseStatTransfer: true,
      targetType: "aoe",
    });
    const applied = [baseM, ...derived];
    const result = applyInteractions({
      manifestations: applied,
      appliedManifestations: applied,
      defaultInteractions: [],
      tagsById,
      awakenersById: buildAwakenersById([]),
    });
    assert(
      (result.totalsByTagId.get(baseTag.id) ?? 0) === 5,
      `base kept at 5 (got ${result.totalsByTagId.get(baseTag.id)})`,
    );
    assert(
      (result.totalsByTagId.get(inMissionTag.id) ?? 0) === 2,
      `In Mission 2 (got ${result.totalsByTagId.get(inMissionTag.id)})`,
    );
    assert(
      (result.totalsByTagId.get(causeTag.id) ?? 0) === 2,
      `Cause 2 (got ${result.totalsByTagId.get(causeTag.id)})`,
    );
  }

  // 400% base + 100% direct In Mission → synth 147=1, cause=2; combined In Mission 2
  {
    const derived = buildDeathResistDerivedManifestations(4, 1, tagsById);
    const synth147 = derived.find((m) => m.tagId === inMissionTag.id);
    const synth88 = derived.find((m) => m.tagId === causeTag.id);
    assert(synth147!.valueScalar === 1, "synth In Mission fromBase 1");
    assert(synth88!.valueScalar === 2, "synth Cause from combined 2");

    const baseM = makeManifestation({
      id: 1,
      tagId: baseTag.id,
      tagName: baseTag.tagName,
      valueScalar: 4,
      isBaseStatTransfer: true,
      targetType: "aoe",
    });
    const directInMission = makeManifestation({
      id: 2,
      tagId: inMissionTag.id,
      tagName: inMissionTag.tagName,
      valueScalar: 1,
    });
    const applied = [baseM, directInMission, ...derived];
    const result = applyInteractions({
      manifestations: applied,
      appliedManifestations: applied,
      defaultInteractions: [],
      tagsById,
      awakenersById: buildAwakenersById([]),
    });
    assert(
      (result.totalsByTagId.get(inMissionTag.id) ?? 0) === 2,
      `combined In Mission 2 (got ${result.totalsByTagId.get(inMissionTag.id)})`,
    );
    assert(
      (result.totalsByTagId.get(causeTag.id) ?? 0) === 2,
      `Cause from combined 2 (got ${result.totalsByTagId.get(causeTag.id)})`,
    );
  }

  // Derived Cause as modifier (aoe) can boost a subject via default interaction
  {
    const activeTag = makeTag(42, "Attacker.Active Damage");
    tagsById[activeTag.id] = activeTag;
    const derived = buildDeathResistDerivedManifestations(5, 0, tagsById);
    const active = makeManifestation({
      id: 10,
      tagId: activeTag.id,
      tagName: activeTag.tagName,
      valueScalar: 100,
      sourceType: "command card",
    });
    const applied = [active, ...derived];
    const result = applyInteractions({
      manifestations: applied,
      appliedManifestations: applied,
      defaultInteractions: [
        makeInteraction({
          id: 1,
          modifierTagId: causeTag.id,
          modifierTagName: causeTag.tagName,
          targetTagId: activeTag.id,
          targetTagName: activeTag.tagName,
          mathOperation: "add_scaled",
          defaultFactor: 10,
        }),
      ],
      tagsById,
      awakenersById: buildAwakenersById([]),
    });
    // Cause count 2 * factor 10 → +20 Active
    assert(
      (result.totalsByTagId.get(activeTag.id) ?? 0) === 120,
      `Cause modifier add_scaled → Active 120 (got ${result.totalsByTagId.get(activeTag.id)})`,
    );
    assert(
      (result.totalsByTagId.get(causeTag.id) ?? 0) === 2,
      "Cause transfer value unchanged as subject",
    );
  }
}

console.log("\nDeath Resist full tag 12 (ATM + Base stat) via computeReviewTagTotals");
{
  assert(
    REQUIRED_BASE_STAT_TAG_IDS.includes(IN_MISSION_DEATH_RESIST_TAG_ID),
    "required tags include In Mission 147",
  );
  assert(
    REQUIRED_BASE_STAT_TAG_IDS.includes(SPECIAL_CAUSE_DEATH_RESIST_TRIGGER_TAG_ID),
    "required tags include Cause 88",
  );
  assert(
    REQUIRED_BASE_STAT_TAG_IDS.includes(DEFENDER_MAX_HP_UP_TAG_ID),
    "required tags include Max HP Up 130",
  );

  const baseTag = makeTag(
    DEFENDER_BASE_DEATH_RESIST_TAG_ID,
    "Defender.Base Death Resist",
    true,
  );
  const inMissionTag = makeTag(
    IN_MISSION_DEATH_RESIST_TAG_ID,
    "Defender.Base Death Resist.In Mission Death Resist",
    true,
  );
  const causeTag = makeTag(
    SPECIAL_CAUSE_DEATH_RESIST_TRIGGER_TAG_ID,
    "Special.Cause.Death Resist Trigger",
  );
  const maxHpUpTag = makeTag(
    DEFENDER_MAX_HP_UP_TAG_ID,
    "Defender.Max HP Up",
    true,
  );
  const tagsById: Record<number, Tag> = {
    [baseTag.id]: baseTag,
    [inMissionTag.id]: inMissionTag,
    [causeTag.id]: causeTag,
    [maxHpUpTag.id]: maxHpUpTag,
  };

  // Base stat 3.024 + ATM 1.0 = 4.024 → In Mission 1.024 → Cause 1; Max HP Up 3
  const awakener = makeAwakener({ id: 1, deathResist: 3.024 });
  const atm = makeManifestation({
    id: 10,
    tagId: baseTag.id,
    tagName: baseTag.tagName,
    valueScalar: 1,
    awakenerId: 1,
  });
  const teamData: TeamData = {
    ...createEmptyTeamData(),
    awakeners: [awakener],
    manifestations: [atm],
    tagsById,
  };
  const applyContext = createManifestationApplyContext([awakener], []);
  const { totalsByTagId, reviewTeamData } = computeReviewTagTotals(
    teamData,
    applyContext,
  );

  assert(
    Math.abs((totalsByTagId.get(baseTag.id) ?? 0) - 4.024) < 1e-9,
    `tag 12 total 4.024 (got ${totalsByTagId.get(baseTag.id)})`,
  );
  assert(
    Math.abs((totalsByTagId.get(inMissionTag.id) ?? 0) - 1.024) < 1e-9,
    `In Mission 1.024 not 0.756 (got ${totalsByTagId.get(inMissionTag.id)})`,
  );
  assert(
    (totalsByTagId.get(causeTag.id) ?? 0) === 1,
    `Cause 1 (got ${totalsByTagId.get(causeTag.id)})`,
  );
  assert(
    Math.abs((totalsByTagId.get(maxHpUpTag.id) ?? 0) - 0.1) < 1e-9,
    `Max HP Up from capped reduction → 0.1 (got ${totalsByTagId.get(maxHpUpTag.id)})`,
  );
  const synth147 = reviewTeamData.manifestations.find(
    (m) => m.tagId === inMissionTag.id && m.isBaseStatTransfer,
  );
  assert(
    synth147?.tagName === inMissionTag.tagName,
    `In Mission name resolved (got ${synth147?.tagName})`,
  );
}

console.log("\nTrigger condition gating");
{
  const whenDr = makeTag(
    SPECIAL_WHEN_DEATH_RESIST_TRIGGER_TAG_ID,
    "Special.When.Death Resist Trigger",
  );
  const whenPosse = makeTag(SPECIAL_WHEN_POSSE_TAG_ID, "Special.When.Posse");
  const createPosse = makeTag(SUPPORT_CREATE_POSSE_TAG_ID, "Support.Create.Posse");
  const critTag = makeTag(17, "Support.Crit Damage", true);
  const ampTag = makeTag(16, "Support.Damage AMP", true);
  const unknownWhenId = 108; // Special.When.Pursuit — not in Cause→When map

  // Null trigger unchanged
  {
    const counts = buildTriggerCounts(new Map([[88, 3]]));
    assert(counts.get(89) === 3, "Cause 88 → When 89 count 3");
    const m = makeManifestation({
      id: 1,
      tagId: critTag.id,
      tagName: critTag.tagName,
      valueScalar: 0.15,
      triggerCondition: null,
    });
    const ctx = createManifestationApplyContext([], [], counts);
    const result = evaluateManifestationApply(m, ctx);
    assert(result.applied === true, "null trigger still applied");
    assert(result.triggerTimes == null, "null trigger has no times");
  }

  // Cause 88 scalar 3 → When 89-gated row contributes 3 × scalar via computeReviewTagTotals
  {
    const baseTag = makeTag(
      DEFENDER_BASE_DEATH_RESIST_TAG_ID,
      "Defender.Base Death Resist",
      true,
    );
    const inMissionTag = makeTag(
      IN_MISSION_DEATH_RESIST_TAG_ID,
      "Defender.Base Death Resist.In Mission Death Resist",
      true,
    );
    const causeTag = makeTag(
      SPECIAL_CAUSE_DEATH_RESIST_TRIGGER_TAG_ID,
      "Special.Cause.Death Resist Trigger",
    );
    const maxHpUpTag = makeTag(
      DEFENDER_MAX_HP_UP_TAG_ID,
      "Defender.Max HP Up",
      true,
    );
    const tagsById: Record<number, Tag> = {
      [baseTag.id]: baseTag,
      [inMissionTag.id]: inMissionTag,
      [causeTag.id]: causeTag,
      [maxHpUpTag.id]: maxHpUpTag,
      [whenDr.id]: whenDr,
      [critTag.id]: critTag,
    };
    // Base 5 → In Mission 2 → Cause 2; gated Crit 0.15 → 0.30
    const awakener = makeAwakener({ id: 1, deathResist: 5 });
    const gated = makeManifestation({
      id: 20,
      tagId: critTag.id,
      tagName: critTag.tagName,
      valueScalar: 0.15,
      triggerCondition: SPECIAL_WHEN_DEATH_RESIST_TRIGGER_TAG_ID,
      sourceKind: "wheel",
      awakenerId: 1,
    });
    const teamData: TeamData = {
      ...createEmptyTeamData(),
      awakeners: [awakener],
      manifestations: [gated],
      tagsById,
    };
    const { totalsByTagId, triggerCounts } = computeReviewTagTotals(
      teamData,
      createManifestationApplyContext([awakener], []),
    );
    assert(
      triggerCounts.get(SPECIAL_WHEN_DEATH_RESIST_TRIGGER_TAG_ID) === 2,
      `When DR count 2 (got ${triggerCounts.get(SPECIAL_WHEN_DEATH_RESIST_TRIGGER_TAG_ID)})`,
    );
    assert(
      Math.abs((totalsByTagId.get(critTag.id) ?? 0) - 0.3) < 1e-9,
      `gated Crit 0.15×2 = 0.3 (got ${totalsByTagId.get(critTag.id)})`,
    );
  }

  // Cause 0 / unknown When 108 → gated row Applied=no
  {
    const tagsById: Record<number, Tag> = {
      [ampTag.id]: ampTag,
    };
    const awakener = makeAwakener({ id: 1 });
    const gated = makeManifestation({
      id: 21,
      tagId: ampTag.id,
      tagName: ampTag.tagName,
      valueScalar: 0.4,
      triggerCondition: unknownWhenId,
      sourceKind: "wheel",
    });
    const teamData: TeamData = {
      ...createEmptyTeamData(),
      awakeners: [awakener],
      manifestations: [gated],
      tagsById,
    };
    const { totalsByTagId, triggerCounts } = computeReviewTagTotals(
      teamData,
      createManifestationApplyContext([awakener], []),
    );
    assert(
      (triggerCounts.get(unknownWhenId) ?? 0) === 0,
      "unknown When not in counts",
    );
    assert(
      (totalsByTagId.get(ampTag.id) ?? 0) === 0,
      "Pursuit-gated AMP unapplied",
    );
    const ctx = createManifestationApplyContext(
      [awakener],
      [],
      triggerCounts,
    );
    const evalResult = evaluateManifestationApply(gated, ctx);
    assert(evalResult.applied === false, "unknown When → not applied");
    assert(
      evalResult.reason === "trigger_condition",
      "reason is trigger_condition",
    );
  }

  // Posse: sum of tag 52 → When 129 count
  {
    const tagsById: Record<number, Tag> = {
      [createPosse.id]: createPosse,
      [whenPosse.id]: whenPosse,
      [critTag.id]: critTag,
    };
    const awakener = makeAwakener({ id: 1 });
    const create1 = makeManifestation({
      id: 30,
      tagId: createPosse.id,
      tagName: createPosse.tagName,
      valueScalar: 1,
      sourceKind: "wheel",
    });
    const create2 = makeManifestation({
      id: 31,
      tagId: createPosse.id,
      tagName: createPosse.tagName,
      valueScalar: 1,
      sourceKind: "wheel",
    });
    const gated = makeManifestation({
      id: 32,
      tagId: critTag.id,
      tagName: critTag.tagName,
      valueScalar: 0.05,
      triggerCondition: SPECIAL_WHEN_POSSE_TAG_ID,
      sourceKind: "wheel",
    });
    const teamData: TeamData = {
      ...createEmptyTeamData(),
      awakeners: [awakener],
      manifestations: [create1, create2, gated],
      tagsById,
    };
    const { totalsByTagId, triggerCounts } = computeReviewTagTotals(
      teamData,
      createManifestationApplyContext([awakener], []),
    );
    assert(
      triggerCounts.get(SPECIAL_WHEN_POSSE_TAG_ID) === 2,
      `When Posse count 2 (got ${triggerCounts.get(SPECIAL_WHEN_POSSE_TAG_ID)})`,
    );
    assert(
      Math.abs((totalsByTagId.get(critTag.id) ?? 0) - 0.1) < 1e-9,
      `Posse-gated Crit 0.05×2 = 0.1 (got ${totalsByTagId.get(critTag.id)})`,
    );
    assert(
      (totalsByTagId.get(createPosse.id) ?? 0) === 2,
      "Create.Posse totals still counted",
    );
  }
}

console.log("\nAll Phase 2b.1 smoke checks passed.");
