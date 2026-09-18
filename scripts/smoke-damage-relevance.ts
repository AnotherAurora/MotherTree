/**
 * Damage-relevance smoke — closure rules + filtered/full engine parity.
 * Run: npm run smoke:damage-relevance
 *
 * The Relic Picker filters `tagsById` / `defaultInteractions` / `manifestations`
 * to the damage-reachable closure before ranking. These checks prove the filter
 * does not change Total Damage on a mixed relevant/irrelevant team.
 */
import { computeReviewTagTotals } from "../src/lib/path-carver/aggregate-tag-scalars";
import {
  computeDamageRelevance,
  filterManifestationsToRelevance,
  filterTeamDataToRelevance,
} from "../src/lib/path-carver/damage-relevance";
import { createManifestationApplyContext } from "../src/lib/path-carver/manifestation-apply";
import { computeTotalDamage } from "../src/lib/path-carver/total-damage";
import {
  createEmptyTeamData,
  type Awakener,
  type AwakenerLocalManifestationInteraction,
  type DefaultInteraction,
  type Manifestation,
  type Tag,
  type TeamData,
} from "../src/lib/team-data/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
}

function makeTag(
  id: number,
  tagName: string,
  opts: { isPercent?: boolean; layer?: Tag["layer"] } = {},
): Tag {
  return {
    id,
    tagName,
    layer: opts.layer ?? "add",
    isPercent: opts.isPercent ?? false,
    isAdditive: true,
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

function makeManifestation(
  id: number,
  tag: Tag,
  value: number,
  overrides: AwakenerLocalManifestationInteraction[] = [],
  extra: Partial<Manifestation> = {},
): Manifestation {
  return {
    id,
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
    interactionOverrides: overrides,
    isBaseStatTransfer: false,
    isCreatedBase: false,
    realmId: null,
    requiredRealmMode: null,
    dependencyRate: null,
    dependencyRateStat: null,
    pureBonusTarget: null,
    ...extra,
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

function aftereffectRow(
  id: number,
  target: Tag,
): AwakenerLocalManifestationInteraction {
  return {
    id,
    mode: "aftereffect",
    modifierTagId: null,
    modifierTagName: "",
    targetTagId: target.id,
    targetTagName: target.tagName,
    layer: "add",
    mathOperation: "multiply_one_plus",
    valueScalar: 0.2,
    targetType: "aoe",
    dependencyStat: null,
    isDisabled: false,
  };
}

function uniqueScalingRow(
  id: number,
  modifier: Tag,
): AwakenerLocalManifestationInteraction {
  return {
    id,
    mode: "unique_scaling",
    modifierTagId: modifier.id,
    modifierTagName: modifier.tagName,
    targetTagId: null,
    targetTagName: null,
    layer: "add",
    mathOperation: "multiply_one_plus",
    valueScalar: 0.3,
    targetType: "aoe",
    dependencyStat: null,
    isDisabled: false,
  };
}

// Use ids well outside the real seed-id range to avoid id collisions with
// DAMAGE_SEED_TAG_IDS (which uses the production tag ids).
const channel = makeTag(1001, "Attacker.Active Damage", { layer: "pre_add" });
const amp = makeTag(1002, "Support.Damage AMP", { isPercent: true });
const boost = makeTag(1003, "Support.Boost", { isPercent: true });
const irrelevant = makeTag(1004, "Support.Irrelevant", { isPercent: true });
const irrelevantTarget = makeTag(1005, "Support.Irrelevant.Target");
const afterSrc = makeTag(1006, "Support.After Src", { isPercent: true });
const afterIrrelevant = makeTag(1007, "Support.After Irrelevant", {
  isPercent: true,
});
const uniqueMod = makeTag(1008, "Support.Unique Mod", { isPercent: true });
const copyProvider = makeTag(1009, "Support.Copy Provider");
const causeDevour = makeTag(126, "Special.Cause.Devour");
const whenDevour = makeTag(128, "Special.When.Devour");

const tagsById: Record<number, Tag> = Object.fromEntries(
  [
    channel,
    amp,
    boost,
    irrelevant,
    irrelevantTarget,
    afterSrc,
    afterIrrelevant,
    uniqueMod,
    copyProvider,
    causeDevour,
    whenDevour,
  ].map((tag) => [tag.id, tag]),
);

const manifestations: Manifestation[] = [
  makeManifestation(500, channel, 1000),
  makeManifestation(501, amp, 0.5),
  makeManifestation(502, boost, 0.5),
  makeManifestation(503, irrelevant, 0.9),
  makeManifestation(504, irrelevantTarget, 100),
  // Aftereffect into the channel ⇒ source is relevant.
  makeManifestation(505, afterSrc, 0.1, [aftereffectRow(600, channel)]),
  // Aftereffect into an irrelevant tag ⇒ source is NOT relevant.
  makeManifestation(506, afterIrrelevant, 0.1, [
    aftereffectRow(601, irrelevantTarget),
  ]),
  // unique_scaling on a relevant parent ⇒ modifier is relevant.
  makeManifestation(507, amp, 0.1, [uniqueScalingRow(602, uniqueMod)]),
  // Trigger-gated relevant row ⇒ When + matching Cause are relevant.
  makeManifestation(508, amp, 0.1, [], { triggerCondition: whenDevour.id }),
  // Copy provider on a relevant row ⇒ provider tag is relevant.
  makeManifestation(509, amp, 0.1, [], {
    copyProviderGroupId: 1,
    copyProviderGroupName: "#1",
    copyProviderTagIds: [copyProvider.id],
  }),
];

const defaultInteractions: DefaultInteraction[] = [
  ampInteraction(1, amp, channel),
  ampInteraction(2, boost, amp),
  ampInteraction(3, irrelevant, irrelevantTarget),
];

console.log("Unit — closure seeds channels, reverse chains, and ignores dead ends");
{
  const relevance = computeDamageRelevance({
    tagsById,
    defaultInteractions,
    manifestations,
  });
  assert(relevance.tagIds.has(channel.id), "channel seeded");
  assert(relevance.tagIds.has(amp.id), "reverse TDI: amp reaches channel");
  assert(relevance.tagIds.has(boost.id), "reverse TDI chain: boost → amp");
  assert(
    relevance.tagIds.has(afterSrc.id),
    "aftereffect into channel keeps source",
  );
  assert(
    relevance.tagIds.has(uniqueMod.id),
    "unique_scaling modifier on relevant parent kept",
  );
  assert(
    relevance.tagIds.has(causeDevour.id) && relevance.tagIds.has(whenDevour.id),
    "trigger When + matching Cause kept",
  );
  assert(
    relevance.tagIds.has(copyProvider.id),
    "copy provider tag kept",
  );
  assert(!relevance.tagIds.has(irrelevant.id), "dead-end modifier excluded");
  assert(!relevance.tagIds.has(irrelevantTarget.id), "dead-end target excluded");
  assert(
    !relevance.tagIds.has(afterIrrelevant.id),
    "aftereffect into dead end excluded",
  );
  assert(
    relevance.defaultInteractions.length === 2,
    `only relevant interactions kept (got ${relevance.defaultInteractions.length})`,
  );
}

console.log("\nParity — filtered engine total equals full engine total");
{
  const awakeners = [makeAwakener(1)];
  const teamData: TeamData = {
    ...createEmptyTeamData(),
    awakeners,
    tagsById,
    manifestations,
    defaultInteractions,
  };
  const applyContext = createManifestationApplyContext(
    awakeners,
    [1],
    new Map(),
    [],
    manifestations,
  );
  const fullTotal = computeTotalDamage(
    computeReviewTagTotals(teamData, applyContext).totalsByTagId,
    tagsById,
  ).total;

  const relevance = computeDamageRelevance({
    tagsById,
    defaultInteractions,
    manifestations,
  });
  const filtered = filterTeamDataToRelevance(teamData, relevance);
  const filteredContext = createManifestationApplyContext(
    filtered.awakeners,
    [1],
    new Map(),
    filtered.realms,
    filtered.manifestations,
  );
  const filteredTotal = computeTotalDamage(
    computeReviewTagTotals(filtered, filteredContext).totalsByTagId,
    filtered.tagsById,
  ).total;

  assert(fullTotal > 0, `full total > 0 (got ${fullTotal})`);
  assert(
    filteredTotal === fullTotal,
    `filtered total ${filteredTotal} === full total ${fullTotal}`,
  );
}

console.log("\nPrefilter — relic rows outside the closure are dropped");
{
  const relevance = computeDamageRelevance({
    tagsById,
    defaultInteractions,
    manifestations,
  });
  const relevantRows = filterManifestationsToRelevance(
    [makeManifestation(9001, amp, 0.5)],
    relevance,
  );
  const irrelevantRows = filterManifestationsToRelevance(
    [makeManifestation(9002, irrelevantTarget, 999)],
    relevance,
  );
  assert(relevantRows.length === 1, "relevant relic row kept");
  assert(irrelevantRows.length === 0, "irrelevant relic row dropped");
}

console.log("\nAll damage-relevance smoke checks passed.");
