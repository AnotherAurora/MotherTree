/**
 * Support.Double Posse (tag 53) smoke — doubles the equipped posse's effective
 * scalar (presence-only, ×2 once).
 * Run: npx tsx scripts/smoke-double-posse.ts
 */
import { computeReviewTagTotals } from "../src/lib/path-carver/aggregate-tag-scalars";
import {
  POSSE_EFFECT_MULTIPLIER,
  SUPPORT_DOUBLE_POSSE_TAG_ID,
  isDoublePosseActive,
  scalePosseManifestations,
} from "../src/lib/path-carver/double-posse";
import { createManifestationApplyContext } from "../src/lib/path-carver/manifestation-apply";
import {
  SUPPORT_CREATE_POSSE_TAG_ID,
  SUPPORT_KEYFLARE_TAG_ID,
} from "../src/lib/path-carver/keyflare-to-posse";
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
    triggerCondition: partial.triggerCondition ?? null,
    realmId: null,
    requiredRealmMode: null,
    dependencyRate: null,
    dependencyRateStat: null,
    pureBonusTarget: null,
    ...partial,
  };
}

const doublePosseTag = makeTag(
  SUPPORT_DOUBLE_POSSE_TAG_ID,
  "Support.Double Posse",
);
const strUpTag = makeTag(77, "Support.STR Up.Fixed");
const keyflareTag = makeTag(SUPPORT_KEYFLARE_TAG_ID, "Support.Keyflare");
const createPosseTag = makeTag(
  SUPPORT_CREATE_POSSE_TAG_ID,
  "Support.Create.Posse",
);

const awakener = makeAwakener({ id: 1 });
const applyContext = createManifestationApplyContext([awakener], [1]);

console.log("unit — isDoublePosseActive / scalePosseManifestations");
{
  const posseRow = makeManifestation({
    id: 100,
    tagId: strUpTag.id,
    tagName: strUpTag.tagName,
    valueScalar: 10,
    sourceKind: "posse",
    awakenerId: null,
    slotIndex: null,
  });
  const awakenerRow = makeManifestation({
    id: 101,
    tagId: strUpTag.id,
    tagName: strUpTag.tagName,
    valueScalar: 5,
  });
  const tag53 = makeManifestation({
    id: 102,
    tagId: doublePosseTag.id,
    tagName: doublePosseTag.tagName,
    valueScalar: 1,
  });

  assert(POSSE_EFFECT_MULTIPLIER === 2, "multiplier is 2");
  assert(
    !isDoublePosseActive([posseRow, awakenerRow], applyContext),
    "inactive without tag 53",
  );
  assert(
    isDoublePosseActive([posseRow, tag53], applyContext),
    "active with applied tag 53",
  );

  const scaled = scalePosseManifestations([posseRow, awakenerRow], 2);
  assert(scaled[0].valueScalar === 20, "posse row ×2");
  assert(scaled[1].valueScalar === 5, "non-posse row unchanged");
  assert(
    scalePosseManifestations([posseRow], 1)[0].valueScalar === 10,
    "multiplier 1 passes through",
  );
}

function runTeam(manifestations: Manifestation[]) {
  const tagsById: Record<number, Tag> = {
    [doublePosseTag.id]: doublePosseTag,
    [strUpTag.id]: strUpTag,
    [keyflareTag.id]: keyflareTag,
    [createPosseTag.id]: createPosseTag,
  };
  const teamData: TeamData = {
    ...createEmptyTeamData(),
    awakeners: [awakener],
    manifestations,
    tagsById,
  };
  return computeReviewTagTotals(teamData, applyContext);
}

console.log("\nintegration — posse effect doubles under tag 53");
{
  const posseStrUp = makeManifestation({
    id: 1,
    tagId: strUpTag.id,
    tagName: strUpTag.tagName,
    valueScalar: 10,
    sourceKind: "posse",
    awakenerId: null,
    slotIndex: null,
  });

  const baseline = runTeam([posseStrUp]);
  assert(
    (baseline.totalsByTagId.get(strUpTag.id) ?? 0) === 10,
    `baseline posse STR Up 10 (got ${baseline.totalsByTagId.get(strUpTag.id)})`,
  );

  const doubled = runTeam([
    posseStrUp,
    makeManifestation({
      id: 2,
      tagId: doublePosseTag.id,
      tagName: doublePosseTag.tagName,
      valueScalar: 1,
    }),
  ]);
  assert(
    (doubled.totalsByTagId.get(strUpTag.id) ?? 0) === 20,
    `doubled posse STR Up 20 (got ${doubled.totalsByTagId.get(strUpTag.id)})`,
  );
  const reviewPosse = doubled.reviewTeamData.manifestations.find(
    (m) => m.sourceKind === "posse" && m.tagId === strUpTag.id,
  );
  assert(
    reviewPosse?.valueScalar === 20,
    `reviewTeamData posse scalar doubled (got ${reviewPosse?.valueScalar})`,
  );
  assert(
    doubled.steps.some(
      (s) => s.kind === "special" && s.label === "Support.Double Posse",
    ),
    "math debug special step present",
  );
}

console.log("\nintegration — presence-only, no stacking");
{
  const posseStrUp = makeManifestation({
    id: 1,
    tagId: strUpTag.id,
    tagName: strUpTag.tagName,
    valueScalar: 10,
    sourceKind: "posse",
    awakenerId: null,
    slotIndex: null,
  });
  const twoSources = runTeam([
    posseStrUp,
    makeManifestation({
      id: 2,
      tagId: doublePosseTag.id,
      tagName: doublePosseTag.tagName,
      valueScalar: 1,
    }),
    makeManifestation({
      id: 3,
      tagId: doublePosseTag.id,
      tagName: doublePosseTag.tagName,
      valueScalar: 1,
      sourceKind: "wheel",
      awakenerId: null,
      slotIndex: 0,
    }),
  ]);
  assert(
    (twoSources.totalsByTagId.get(strUpTag.id) ?? 0) === 20,
    `two tag-53 sources still ×2 (got ${twoSources.totalsByTagId.get(strUpTag.id)})`,
  );
}

console.log("\nintegration — non-posse rows unaffected");
{
  const result = runTeam([
    makeManifestation({
      id: 1,
      tagId: strUpTag.id,
      tagName: strUpTag.tagName,
      valueScalar: 10,
      sourceKind: "posse",
      awakenerId: null,
      slotIndex: null,
    }),
    makeManifestation({
      id: 2,
      tagId: strUpTag.id,
      tagName: strUpTag.tagName,
      valueScalar: 5,
    }),
    makeManifestation({
      id: 3,
      tagId: doublePosseTag.id,
      tagName: doublePosseTag.tagName,
      valueScalar: 1,
    }),
  ]);
  assert(
    (result.totalsByTagId.get(strUpTag.id) ?? 0) === 25,
    `posse 20 + awakener 5 = 25 (got ${result.totalsByTagId.get(strUpTag.id)})`,
  );
}

console.log("\nintegration — non-posse Keyflare→Create.Posse not double-dipped");
{
  const result = runTeam([
    makeManifestation({
      id: 1,
      tagId: keyflareTag.id,
      tagName: keyflareTag.tagName,
      valueScalar: 1000,
      sourceKind: "wheel",
      awakenerId: null,
      slotIndex: 0,
    }),
    makeManifestation({
      id: 2,
      tagId: doublePosseTag.id,
      tagName: doublePosseTag.tagName,
      valueScalar: 1,
    }),
  ]);
  assert(
    (result.totalsByTagId.get(createPosseTag.id) ?? 0) === 1,
    `wheel Keyflare 1000 → 1 Create.Posse (got ${result.totalsByTagId.get(createPosseTag.id)})`,
  );
}

console.log("\nintegration — doubled posse Keyflare flows through once");
{
  const tagsById: Record<number, Tag> = {
    [doublePosseTag.id]: doublePosseTag,
    [keyflareTag.id]: keyflareTag,
    [createPosseTag.id]: createPosseTag,
  };
  const posseKeyflare = makeManifestation({
    id: 1,
    tagId: keyflareTag.id,
    tagName: keyflareTag.tagName,
    valueScalar: 1000,
    sourceKind: "posse",
    awakenerId: null,
    slotIndex: null,
  });
  const withDouble = computeReviewTagTotals(
    {
      ...createEmptyTeamData(),
      awakeners: [awakener],
      manifestations: [
        posseKeyflare,
        makeManifestation({
          id: 2,
          tagId: doublePosseTag.id,
          tagName: doublePosseTag.tagName,
          valueScalar: 1,
        }),
      ],
      tagsById,
    },
    applyContext,
  );
  assert(
    (withDouble.totalsByTagId.get(keyflareTag.id) ?? 0) === 2000,
    `posse Keyflare doubled to 2000 (got ${withDouble.totalsByTagId.get(keyflareTag.id)})`,
  );
  assert(
    (withDouble.totalsByTagId.get(createPosseTag.id) ?? 0) === 2,
    `doubled posse Keyflare 2000 → 2 Create.Posse (got ${withDouble.totalsByTagId.get(createPosseTag.id)})`,
  );
}

console.log("\nAll Double Posse smoke checks passed.");
