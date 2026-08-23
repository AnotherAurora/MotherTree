/**
 * Lemurian team synergy — tiered When gates for Support.Damage AMP.
 * Run: npx tsx scripts/smoke-lemurian-synergy.ts
 */
import { computeReviewTagTotals } from "../src/lib/path-carver/aggregate-tag-scalars";
import {
  SPECIAL_CAUSE_LEMURIAN_TAG_ID,
  SPECIAL_WHEN_LEMURIAN_SYNERGY_1_TAG_ID,
  SPECIAL_WHEN_LEMURIAN_SYNERGY_2_TAG_ID,
  SPECIAL_WHEN_LEMURIAN_SYNERGY_3_TAG_ID,
  computeLemurianSynergyBreakdown,
  mergeLemurianSynergyTriggerCounts,
} from "../src/lib/path-carver/lemurian-synergy";
import { createManifestationApplyContext } from "../src/lib/path-carver/manifestation-apply";
import { SUPPORT_DAMAGE_AMP_TAG_ID } from "../src/lib/path-carver/base-tentacle-damage";
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

function makeAwakener(partial: Partial<Awakener> & { id: number }): Awakener {
  return {
    id: partial.id,
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
    dependencyStat: null,
    sourceType: partial.sourceType ?? "talent",
    targetType: partial.targetType ?? "aoe",
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
    triggerCondition: partial.triggerCondition ?? null,
    realmId: null,
    requiredRealmMode: null,
    dependencyRate: null,
    dependencyRateStat: null,
    pureBonusTarget: null,
    id: partial.id,
    tagId: partial.tagId,
    tagName: partial.tagName,
  };
}

const causeTag = makeTag(
  SPECIAL_CAUSE_LEMURIAN_TAG_ID,
  "Special.Cause.Lemurian",
);
const when1 = makeTag(
  SPECIAL_WHEN_LEMURIAN_SYNERGY_1_TAG_ID,
  "Special.When.Lemurian Synergy 1",
);
const when2 = makeTag(
  SPECIAL_WHEN_LEMURIAN_SYNERGY_2_TAG_ID,
  "Special.When.Lemurian Synergy 2",
);
const when3 = makeTag(
  SPECIAL_WHEN_LEMURIAN_SYNERGY_3_TAG_ID,
  "Special.When.Lemurian Synergy 3",
);
const ampTag = makeTag(SUPPORT_DAMAGE_AMP_TAG_ID, "Support.Damage AMP", true);

const tagsById: Record<number, Tag> = {
  [causeTag.id]: causeTag,
  [when1.id]: when1,
  [when2.id]: when2,
  [when3.id]: when3,
  [ampTag.id]: ampTag,
};

function lemurianManifestationsForAwakener(
  awakenerId: number,
  slotIndex: number,
  idBase: number,
): Manifestation[] {
  return [
    makeManifestation({
      id: idBase,
      awakenerId,
      slotIndex,
      tagId: causeTag.id,
      tagName: causeTag.tagName,
      valueScalar: 1,
      triggerCondition: null,
    }),
    makeManifestation({
      id: idBase + 1,
      awakenerId,
      slotIndex,
      tagId: ampTag.id,
      tagName: ampTag.tagName,
      valueScalar: 0.2,
      triggerCondition: SPECIAL_WHEN_LEMURIAN_SYNERGY_1_TAG_ID,
    }),
    makeManifestation({
      id: idBase + 2,
      awakenerId,
      slotIndex,
      tagId: ampTag.id,
      tagName: ampTag.tagName,
      valueScalar: 0.5,
      triggerCondition: SPECIAL_WHEN_LEMURIAN_SYNERGY_2_TAG_ID,
    }),
    makeManifestation({
      id: idBase + 3,
      awakenerId,
      slotIndex,
      tagId: ampTag.id,
      tagName: ampTag.tagName,
      valueScalar: 1.0,
      triggerCondition: SPECIAL_WHEN_LEMURIAN_SYNERGY_3_TAG_ID,
    }),
  ];
}

function teamWithLemurianCount(count: number): TeamData {
  const awakeners: Awakener[] = [];
  const manifestations: Manifestation[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = i + 1;
    awakeners.push(makeAwakener({ id }));
    manifestations.push(...lemurianManifestationsForAwakener(id, i, id * 10));
  }
  return {
    ...createEmptyTeamData(),
    awakeners,
    manifestations,
    tagsById,
  };
}

function ampTotal(teamData: TeamData): number {
  const { totalsByTagId } = computeReviewTagTotals(
    teamData,
    createManifestationApplyContext(teamData.awakeners, []),
  );
  return totalsByTagId.get(SUPPORT_DAMAGE_AMP_TAG_ID) ?? 0;
}

console.log("Unit — tier breakdown");
{
  assert(
    computeLemurianSynergyBreakdown(1).tier === 0,
    "1 Lemurian → tier 0",
  );
  assert(
    computeLemurianSynergyBreakdown(2).tier === 1,
    "2 Lemurians → tier 1",
  );
  assert(
    computeLemurianSynergyBreakdown(3).tier === 2,
    "3 Lemurians → tier 2",
  );
  assert(
    computeLemurianSynergyBreakdown(4).tier === 3,
    "4 Lemurians → tier 3",
  );
  assert(
    computeLemurianSynergyBreakdown(5).tier === 3,
    "5 Lemurians → tier 3 cap",
  );
}

console.log("\nUnit — mutually exclusive When counts");
{
  const counts = new Map<number, number>();
  mergeLemurianSynergyTriggerCounts(counts, 3);
  assert(
    counts.get(SPECIAL_WHEN_LEMURIAN_SYNERGY_1_TAG_ID) === undefined,
    "tier 2: When 1 unset",
  );
  assert(
    counts.get(SPECIAL_WHEN_LEMURIAN_SYNERGY_2_TAG_ID) === 1,
    "tier 2: When 2 = 1",
  );
  assert(
    counts.get(SPECIAL_WHEN_LEMURIAN_SYNERGY_3_TAG_ID) === undefined,
    "tier 2: When 3 unset",
  );
}

console.log("\nIntegration — team AMP from synergy rows");
{
  assert(
    Math.abs(ampTotal(teamWithLemurianCount(1)) - 0) < 1e-9,
    "1 Lemurian alone → AMP 0",
  );
  assert(
    Math.abs(ampTotal(teamWithLemurianCount(2)) - 0.4) < 1e-9,
    "2 Lemurians → AMP 0.4 (2×0.2)",
  );
  assert(
    Math.abs(ampTotal(teamWithLemurianCount(3)) - 1.5) < 1e-9,
    "3 Lemurians → AMP 1.5 (3×0.5)",
  );
  assert(
    Math.abs(ampTotal(teamWithLemurianCount(4)) - 4.0) < 1e-9,
    "4 Lemurians → AMP 4.0 (4×1.0)",
  );
}

console.log("\nIntegration — trigger counts and math debug step");
{
  const team = teamWithLemurianCount(3);
  const { triggerCounts, steps } = computeReviewTagTotals(
    team,
    createManifestationApplyContext(team.awakeners, []),
  );
  assert(
    triggerCounts.get(SPECIAL_WHEN_LEMURIAN_SYNERGY_2_TAG_ID) === 1,
    "3 on team → When 2 count 1",
  );
  assert(
    (triggerCounts.get(SPECIAL_WHEN_LEMURIAN_SYNERGY_1_TAG_ID) ?? 0) === 0,
    "When 1 not active",
  );
  assert(
    (triggerCounts.get(SPECIAL_WHEN_LEMURIAN_SYNERGY_3_TAG_ID) ?? 0) === 0,
    "When 3 not active",
  );
  assert(
    steps.some(
      (s) =>
        s.kind === "special" &&
        s.label === "Lemurian Synergy" &&
        s.detail?.includes("tier=2"),
    ),
    "math debug step for tier 2",
  );
}

console.log("\nAll smoke-lemurian-synergy checks passed.");
