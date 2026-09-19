/**
 * Relic Picker smoke — computed-arg formula + relic ranking behavior.
 * Run: npx tsx scripts/smoke-relic-formula.ts
 *
 * Formula cases are the SKeyDB resolved defaults documented in
 * `.reference/relic_astral_reign_research.md`
 * (accountLevel 50, ownedPosseCount 50, no HSR).
 */
import { computeReviewTagTotals } from "../src/lib/path-carver/aggregate-tag-scalars";
import { createManifestationApplyContext } from "../src/lib/path-carver/manifestation-apply";
import {
  computeRelicRanking,
  createRelicRankingContext,
} from "../src/lib/path-carver/relic-candidates";
import { computeTotalDamage } from "../src/lib/path-carver/total-damage";
import {
  buildRelicManifestations,
  groupRelicsByEffect,
  relicEffectSignature,
  type RelicCatalogEntry,
} from "../src/lib/path-carver/relic-manifestations";
import {
  resolveRelicValueScalar,
  type RelicBaseFormula,
} from "../src/lib/path-carver/relic-research-curve";
import {
  createEmptyTeamData,
  type Awakener,
  type DefaultInteraction,
  type Manifestation,
  type Tag,
  type TeamData,
} from "../src/lib/team-data/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
}

function formula(
  kind: "fixed" | "computed",
  baseFormula: RelicBaseFormula | null,
  valueScalar: number,
  opts: { accountLevel?: number; ownedPosseCount?: number; hsr?: boolean } = {},
): number {
  return resolveRelicValueScalar({
    kind,
    baseFormula,
    valueScalar,
    accountLevel: opts.accountLevel ?? 50,
    ownedPosseCount: opts.ownedPosseCount ?? 50,
    hsr: opts.hsr ?? false,
  });
}

console.log("Unit — resolved relic values (Account Lv 50, 50 posses)");
{
  const cases: Array<[string, number]> = [
    ["Arcana Archive (occult 0.12)", formula("computed", "occultResearchDepth", 0.12)],
    ["Arcana Relic (occult 0.24)", formula("computed", "occultResearchDepth", 0.24)],
    ["Blessed Blood (esoteric 0.1)", formula("computed", "esotericResearchDepth", 0.1)],
    ["Crimson Brooch (esoteric 0.1)", formula("computed", "esotericResearchDepth", 0.1)],
    ["Dearest Babe (esoteric 0.075)", formula("computed", "esotericResearchDepth", 0.075)],
    ["Deceased's Chrono (occult 0.35)", formula("computed", "occultResearchDepth", 0.35)],
    ["Filigree Agate (esoteric 0.015)", formula("computed", "esotericResearchDepth", 0.015)],
    ["Forgotten Prelude (occult 0.3)", formula("computed", "occultResearchDepth", 0.3)],
    ["Guardian Hand (esoteric 0.25)", formula("computed", "esotericResearchDepth", 0.25)],
    ["Highest Honor (esoteric 0.22)", formula("computed", "esotericResearchDepth", 0.22)],
    ["Hyperstring Pocketwatch (esoteric 0.4)", formula("computed", "esotericResearchDepth", 0.4)],
    ["Iron Lock (esoteric 0.0625)", formula("computed", "esotericResearchDepth", 0.0625)],
    ["Nameless Appendage (esoteric 0.16)", formula("computed", "esotericResearchDepth", 0.16)],
    ["Nettle Vest (occult 0.4)", formula("computed", "occultResearchDepth", 0.4)],
    ["Neurotoxin (occult 0.8)", formula("computed", "occultResearchDepth", 0.8)],
    ["Our Home (esoteric 0.05)", formula("computed", "esotericResearchDepth", 0.05)],
    ["Phantom Hand (esoteric 0.12)", formula("computed", "esotericResearchDepth", 0.12)],
    ["Preserved Butterfly (esoteric 0.3)", formula("computed", "esotericResearchDepth", 0.3)],
    ["Uncanny Salve (occult 0.6)", formula("computed", "occultResearchDepth", 0.6)],
    ["Voyager's Parasol (esoteric 0.2)", formula("computed", "esotericResearchDepth", 0.2)],
    ["Fixed 2", formula("fixed", null, 2)],
  ];
  const expected = [
    182, 364, 74, 74, 56, 530, 12, 455, 184, 162, 294, 46, 118, 606, 1212, 37,
    89, 221, 909, 147, 2,
  ];
  cases.forEach(([label, value], index) => {
    assert(value === expected[index], `${label} = ${expected[index]} (got ${value})`);
  });
}

console.log("\nUnit — accountStageGrowth ignores posse; HSR doubles computed rows");
{
  const noPosse = formula("computed", "accountStageGrowth", 0.005, {
    ownedPosseCount: 1,
  });
  const fullPosse = formula("computed", "accountStageGrowth", 0.005, {
    ownedPosseCount: 50,
  });
  assert(noPosse === fullPosse, `accountStageGrowth posse-independent (${noPosse})`);

  const esotericNormal = formula("computed", "esotericResearchDepth", 0.1);
  const esotericHsr = formula("computed", "esotericResearchDepth", 0.1, {
    hsr: true,
  });
  // Normal: ceil(490 × 1.5 × 0.1) = 74. HSR: 74 × 2 = 148 (doubling after ceil).
  assert(esotericNormal === 74, `esoteric normal 74 (got ${esotericNormal})`);
  assert(esotericHsr === 148, `esoteric HSR 148 (got ${esotericHsr})`);

  // Fixed rows ignore HSR.
  const fixedNormal = formula("fixed", null, 2);
  const fixedHsr = formula("fixed", null, 2, { hsr: true });
  assert(fixedNormal === fixedHsr, `fixed HSR-immune (${fixedNormal} vs ${fixedHsr})`);
}

console.log("\nUnit — Crimson Brooch esoteric 0.1 at Account Lv 81 / 50 posses");
{
  // Normal: ceil(1074 × 1.5 × 0.1) = ceil(161.1) = 162. HSR: 162 × 2 = 324.
  const crimsonNormal = formula("computed", "esotericResearchDepth", 0.1, {
    accountLevel: 81,
    ownedPosseCount: 50,
  });
  const crimsonHsr = formula("computed", "esotericResearchDepth", 0.1, {
    accountLevel: 81,
    ownedPosseCount: 50,
    hsr: true,
  });
  assert(crimsonNormal === 162, `Crimson Brooch normal 162 (got ${crimsonNormal})`);
  assert(crimsonHsr === 324, `Crimson Brooch HSR 324 (got ${crimsonHsr})`);
}

function makeTag(
  id: number,
  tagName: string,
  opts: { isPercent?: boolean; isAdditive?: boolean; layer?: Tag["layer"] } = {},
): Tag {
  return {
    id,
    tagName,
    layer: opts.layer ?? "add",
    isPercent: opts.isPercent ?? false,
    isAdditive: opts.isAdditive ?? true,
  };
}

function makeAwakener(id: number): Awakener {
  return {
    id,
    name: `A${id}`,
    realm: "chaos",
    realmId: 1,
    con: 100,
    atk: 100,
    def: 100,
    keyflareRegen: 0,
    damageAmp: 0,
    critRate: 0,
    critDmg: 0,
    realmMastery: 0,
    baseAliemus: 0,
    aliemusRegen: 0,
    sigilYield: 0,
    deathResist: 0,
    enlightenment: 3,
  };
}

function makeActiveDamageManifestation(tag: Tag, value: number): Manifestation {
  return {
    id: 500,
    sourceKind: "awakener",
    awakenerId: 1,
    slotIndex: 0,
    sourceName: "A1",
    tagId: tag.id,
    tagName: tag.tagName,
    triggerCondition: null,
    valueScalar: value,
    instanceCount: 1,
    baseCopies: 1,
    copyProviderGroupId: null,
    copyProviderGroupName: null,
    copyProviderTagIds: [],
    dependencyStat: null,
    sourceType: null,
    targetType: "aoe",
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
    isBaseStatTransfer: false,
    isCreatedBase: false,
    realmId: null,
    requiredRealmMode: null,
    dependencyRate: null,
    dependencyRateStat: null,
    pureBonusTarget: null,
  };
}

function ampInteraction(
  id: number,
  modifier: Tag,
  target: Tag,
): DefaultInteraction {
  return {
    id,
    modifierTagId: modifier.id,
    modifierTagName: modifier.tagName,
    targetTagId: target.id,
    targetTagName: target.tagName,
    exclusionTagId: null,
    exclusionTagName: null,
    mathOperation: "multiply_one_plus",
    defaultFactor: 1,
    buffTargetTypeRestriction: null,
    createsBase: false,
    amplifiesSubject: true,
  };
}

console.log("\nIntegration — relic amplifies an awakener damage tag (affects others)");
{
  const activeTag = makeTag(1, "Attacker.Active Damage", { layer: "pre_add" });
  const ampTag = makeTag(2, "Support.Damage AMP", { isPercent: true });
  const strTag = makeTag(3, "Support.STR Up");

  const tagsById: Record<number, Tag> = {
    [activeTag.id]: activeTag,
    [ampTag.id]: ampTag,
    [strTag.id]: strTag,
  };

  const awakeners = [makeAwakener(1)];
  const teamData: TeamData = {
    ...createEmptyTeamData(),
    awakeners,
    tagsById,
    manifestations: [makeActiveDamageManifestation(activeTag, 1000)],
    defaultInteractions: [ampInteraction(1, ampTag, activeTag)],
  };

  const ampRelic: RelicCatalogEntry = {
    relicId: 1,
    name: "Weeping Pipe",
    tier: "Gold",
    requiredRealmId: null,
    isDamage: true,
    manifestations: [
      {
        id: 9001,
        tagId: ampTag.id,
        tagName: ampTag.tagName,
        triggerCondition: null,
        valueScalar: 0.5,
        kind: "fixed",
        baseFormula: null,
        targetType: "aoe",
        dependencyStat: null,
        isAccumulating: false,
        isPercent: true,
      },
    ],
  };
  const strRelic: RelicCatalogEntry = {
    relicId: 2,
    name: "No-Interaction Relic",
    tier: "Gold",
    requiredRealmId: null,
    isDamage: true,
    manifestations: [
      {
        id: 9002,
        tagId: strTag.id,
        tagName: strTag.tagName,
        triggerCondition: null,
        valueScalar: 100,
        kind: "fixed",
        baseFormula: null,
        targetType: "aoe",
        dependencyStat: null,
        isAccumulating: false,
        isPercent: false,
      },
    ],
  };

  const result = computeRelicRanking({
    teamData,
    damageDealerAwakenerIds: [1],
    relicCatalog: [ampRelic, strRelic],
    selectedRelicIds: [],
    inputs: { accountLevel: 50, ownedPosseCount: 50, hsr: false },
  });

  assert(
    result.baselineTotal === 1000,
    `baseline Active Damage 1000 (got ${result.baselineTotal})`,
  );
  const ampRow = result.ranked.find((r) => r.entry.relicId === 1);
  assert(ampRow != null, "amp relic ranked");
  assert(ampRow?.total === 1500, `amp relic total 1500 (got ${ampRow?.total})`);
  assert(
    ampRow != null && Math.abs((ampRow.percentIncrease ?? 0) - 50) < 1e-9,
    `amp relic +50% (got ${ampRow?.percentIncrease})`,
  );
  assert(
    result.ranked[0]?.entry.relicId === 1,
    "amp relic sorted above no-op relic",
  );

  // buildRelicManifestations carries the relic source kind + realm gate.
  const injected = buildRelicManifestations(ampRelic, {
    accountLevel: 50,
    ownedPosseCount: 50,
    hsr: false,
  });
  assert(injected[0]?.sourceKind === "relic", "injected sourceKind=relic");

  // No damage dealer ⇒ zero baseline and blank (null) impacts, no engine sweep.
  const noDealer = computeRelicRanking({
    teamData,
    damageDealerAwakenerIds: [],
    relicCatalog: [ampRelic, strRelic],
    selectedRelicIds: [],
    inputs: { accountLevel: 50, ownedPosseCount: 50, hsr: false },
  });
  assert(
    noDealer.baselineTotal === 0,
    `no damage dealer baseline 0 (got ${noDealer.baselineTotal})`,
  );
  assert(
    noDealer.ranked.length === 2 &&
      noDealer.ranked.every((row) => row.percentIncrease === null),
    "no damage dealer ⇒ every relic impact blank",
  );
}

console.log(
  "\nIntegration — relic value is not amplified by awakener tags (realm-like immunity)",
);
{
  const activeTag = makeTag(1, "Attacker.Active Damage", { layer: "pre_add" });
  const ampTag = makeTag(2, "Support.Damage AMP", { isPercent: true });
  const boostTag = makeTag(4, "Support.Boost AMP", { isPercent: true });
  const tagsById: Record<number, Tag> = {
    [activeTag.id]: activeTag,
    [ampTag.id]: ampTag,
    [boostTag.id]: boostTag,
  };

  const relicEntry: RelicCatalogEntry = {
    relicId: 1,
    name: "Weeping Pipe",
    tier: "Gold",
    requiredRealmId: null,
    isDamage: true,
    manifestations: [
      {
        id: 9001,
        tagId: ampTag.id,
        tagName: ampTag.tagName,
        triggerCondition: null,
        valueScalar: 0.5,
        kind: "fixed",
        baseFormula: null,
        targetType: "aoe",
        dependencyStat: null,
        isAccumulating: false,
        isPercent: true,
      },
    ],
  };
  const relicAmp = buildRelicManifestations(relicEntry, {
    accountLevel: 50,
    ownedPosseCount: 50,
    hsr: false,
  })[0]!;

  const runAmpScalar = (ampManifestation: Manifestation): number => {
    const manifestations: Manifestation[] = [
      makeActiveDamageManifestation(activeTag, 1000),
      ampManifestation,
      {
        ...makeActiveDamageManifestation(boostTag, 1),
        id: 501,
      },
    ];
    const awakeners = [makeAwakener(1)];
    const teamData: TeamData = {
      ...createEmptyTeamData(),
      awakeners,
      tagsById,
      manifestations,
      defaultInteractions: [
        ampInteraction(1, ampTag, activeTag),
        // boostTag → ampTag: would inflate the amp if it were not immune.
        ampInteraction(2, boostTag, ampTag),
      ],
    };
    const { totalsByTagId } = computeReviewTagTotals(
      teamData,
      createManifestationApplyContext(awakeners, [1], new Map(), [], manifestations),
    );
    return totalsByTagId.get(ampTag.id) ?? 0;
  };

  const relicScalar = runAmpScalar(relicAmp);
  assert(
    relicScalar === 0.5,
    `relic Support.Damage AMP stays 0.5 (got ${relicScalar})`,
  );

  const posseScalar = runAmpScalar({
    ...relicAmp,
    sourceKind: "posse",
  });
  assert(
    posseScalar > 0.5,
    `posse control Support.Damage AMP is amplified > 0.5 (got ${posseScalar})`,
  );
}

console.log("\nIntegration — identical-effect relics group and share one total");
{
  const activeTag = makeTag(1, "Attacker.Active Damage", { layer: "pre_add" });
  const ampTag = makeTag(2, "Support.Damage AMP", { isPercent: true });
  const strTag = makeTag(3, "Support.STR Up");
  const tagsById: Record<number, Tag> = {
    [activeTag.id]: activeTag,
    [ampTag.id]: ampTag,
    [strTag.id]: strTag,
  };

  const awakeners = [makeAwakener(1)];
  const teamData: TeamData = {
    ...createEmptyTeamData(),
    awakeners,
    tagsById,
    manifestations: [makeActiveDamageManifestation(activeTag, 1000)],
    defaultInteractions: [ampInteraction(1, ampTag, activeTag)],
  };
  const inputs = { accountLevel: 50, ownedPosseCount: 50, hsr: false };

  const makeAmpRelic = (
    relicId: number,
    name: string,
    rowId: number,
  ): RelicCatalogEntry => ({
    relicId,
    name,
    tier: "Gold",
    requiredRealmId: null,
    isDamage: true,
    manifestations: [
      {
        id: rowId,
        tagId: ampTag.id,
        tagName: ampTag.tagName,
        triggerCondition: null,
        valueScalar: 0.5,
        kind: "fixed",
        baseFormula: null,
        targetType: "aoe",
        dependencyStat: null,
        isAccumulating: false,
        isPercent: true,
      },
    ],
  });
  const ampRelic = makeAmpRelic(1, "Weeping Pipe", 9001);
  const ampClone = makeAmpRelic(2, "Weeping Pipe (copy)", 9002);
  const strRelic: RelicCatalogEntry = {
    relicId: 3,
    name: "No-Interaction Relic",
    tier: "Gold",
    requiredRealmId: null,
    isDamage: true,
    manifestations: [
      {
        id: 9003,
        tagId: strTag.id,
        tagName: strTag.tagName,
        triggerCondition: null,
        valueScalar: 100,
        kind: "fixed",
        baseFormula: null,
        targetType: "aoe",
        dependencyStat: null,
        isAccumulating: false,
        isPercent: false,
      },
    ],
  };

  const groups = groupRelicsByEffect([ampRelic, ampClone, strRelic], inputs);
  assert(
    groups.representativeOf.get(ampClone.relicId) === ampRelic.relicId,
    "clone maps to the first catalog representative",
  );
  assert(
    groups.sizeOf.get(ampRelic.relicId) === 2,
    `amp group size 2 (got ${groups.sizeOf.get(ampRelic.relicId)})`,
  );
  assert(
    groups.sizeOf.get(strRelic.relicId) === 1,
    "distinct effect has its own group",
  );
  assert(
    relicEffectSignature(ampRelic, inputs) ===
      relicEffectSignature(ampClone, inputs),
    "identical effects share a signature",
  );
  assert(
    relicEffectSignature(ampRelic, inputs) !==
      relicEffectSignature(strRelic, inputs),
    "different effects have different signatures",
  );

  const result = computeRelicRanking({
    teamData,
    damageDealerAwakenerIds: [1],
    relicCatalog: [ampRelic, ampClone, strRelic],
    selectedRelicIds: [],
    inputs,
  });
  const rowA = result.ranked.find((r) => r.entry.relicId === ampRelic.relicId);
  const rowB = result.ranked.find((r) => r.entry.relicId === ampClone.relicId);
  assert(rowA != null && rowB != null, "both grouped relics are ranked");
  assert(
    rowA?.total === 1500 && rowB?.total === 1500,
    `grouped relics share total 1500 (got ${rowA?.total}, ${rowB?.total})`,
  );
  assert(
    rowA?.groupSize === 2 && rowB?.groupSize === 2,
    `grouped relics report groupSize 2 (got ${rowA?.groupSize}, ${rowB?.groupSize})`,
  );
  assert(
    rowA?.representativeId === ampRelic.relicId &&
      rowB?.representativeId === ampRelic.relicId,
    `grouped relics share representative ${ampRelic.relicId} (got ${rowA?.representativeId}, ${rowB?.representativeId})`,
  );
  const strRow = result.ranked.find((r) => r.entry.relicId === strRelic.relicId);
  assert(
    strRow?.total === 1000 && strRow?.groupSize === 1,
    `distinct relic unaffected by grouping (got ${strRow?.total}, size ${strRow?.groupSize})`,
  );
  assert(
    strRow?.representativeId === strRelic.relicId,
    `distinct relic is its own representative (got ${strRow?.representativeId})`,
  );

  // Selecting one member must not disturb the other member's ranking.
  const afterPick = computeRelicRanking({
    teamData,
    damageDealerAwakenerIds: [1],
    relicCatalog: [ampRelic, ampClone, strRelic],
    selectedRelicIds: [ampRelic.relicId],
    inputs,
  });
  const cloneAfter = afterPick.ranked.find(
    (r) => r.entry.relicId === ampClone.relicId,
  );
  // Ground truth: engine total for the selected relic + this member, unfiltered.
  const { applyContext } = createRelicRankingContext(teamData, [1]);
  const expectedCloneTotal = (() => {
    const merged: TeamData = {
      ...teamData,
      manifestations: [
        ...teamData.manifestations,
        ...buildRelicManifestations(ampRelic, inputs),
        ...buildRelicManifestations(ampClone, inputs),
      ],
    };
    const { totalsByTagId } = computeReviewTagTotals(merged, applyContext, {
      totalsOnly: true,
    });
    return computeTotalDamage(totalsByTagId, merged.tagsById).total;
  })();
  assert(
    cloneAfter != null && cloneAfter.total === expectedCloneTotal,
    `remaining group member matches unfiltered total (got ${cloneAfter?.total}, expected ${expectedCloneTotal})`,
  );
  assert(
    cloneAfter?.groupSize === 1,
    `selected member leaves the unselected clone with its own group (got ${cloneAfter?.groupSize})`,
  );
}

console.log("\nAll relic smoke checks passed.");
