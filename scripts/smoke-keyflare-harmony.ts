/**
 * Phase 2b.5 smoke — Keyflare Harmony
 * (ceil(200% team-avg keyflare) × 4 non-exalted → Support.Keyflare).
 * Run: npx tsx scripts/smoke-keyflare-harmony.ts
 */
import { computeReviewTagTotals } from "../src/lib/path-carver/aggregate-tag-scalars";
import { applyKeyflareDiminishingReturn } from "../src/lib/path-carver/awakener-base-stats";
import { SPECIAL_INCREASE_BASE_KEYFLARE_TAG_ID } from "../src/lib/path-carver/awakener-base-stats";
import {
  KEYFLARE_HARMONY_AVG_FACTOR,
  TEAM_SLOT_COUNT,
  computeKeyflareHarmonyScalar,
  keyflareHarmonyManifestationId,
} from "../src/lib/path-carver/keyflare-harmony";
import { SUPPORT_KEYFLARE_TAG_ID } from "../src/lib/path-carver/keyflare-to-posse";
import { createManifestationApplyContext } from "../src/lib/path-carver/manifestation-apply";
import { SUPPORT_CREATE_POSSE_TAG_ID } from "../src/lib/path-carver/trigger-condition";
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

const keyflareTag = makeTag(SUPPORT_KEYFLARE_TAG_ID, "Support.Keyflare");
const createPosseTag = makeTag(
  SUPPORT_CREATE_POSSE_TAG_ID,
  "Support.Create.Posse",
);
const increaseBaseKfTag = makeTag(
  SPECIAL_INCREASE_BASE_KEYFLARE_TAG_ID,
  "Special.Increase Base Keyflare",
  true,
);

console.log("computeKeyflareHarmonyScalar unit");
{
  assert(TEAM_SLOT_COUNT === 4, "4 slots");
  assert(KEYFLARE_HARMONY_AVG_FACTOR === 2, "200% of avg");

  const four = computeKeyflareHarmonyScalar([
    { keyflareRegen: 20 },
    { keyflareRegen: 20 },
    { keyflareRegen: 20 },
    { keyflareRegen: 20 },
  ]);
  assert(
    four.teamAverage === 20 &&
      four.perNonExalted === 40 &&
      four.valueScalar === 160 &&
      four.minusPerExalt === -40,
    "4×20 → avg 20 → ceil(40)×4 = 160",
  );

  const one = computeKeyflareHarmonyScalar([{ keyflareRegen: 20 }]);
  assert(
    one.teamAverage === 5 &&
      one.perNonExalted === 10 &&
      one.valueScalar === 40 &&
      one.minusPerExalt === -10,
    "1×20 → avg 5 → ceil(10)×4 = 40",
  );

  const empty = computeKeyflareHarmonyScalar([]);
  assert(empty.valueScalar === 0, "empty scalar 0");
  assert(empty.perNonExalted === 0, "empty perNonExalted 0");
  assert(empty.minusPerExalt === 0, "empty minusPerExalt 0");

  // Fractional avg: sum 105 → avg 26.25 → ceil(52.5)=53 → 212 (not 210).
  const fractional = computeKeyflareHarmonyScalar([
    { keyflareRegen: 15 },
    { keyflareRegen: 15 },
    { keyflareRegen: 60 },
    { keyflareRegen: 15 },
  ]);
  assert(
    fractional.perNonExalted === 53 &&
      fractional.valueScalar === 212 &&
      fractional.minusPerExalt === -53,
    "sum 105 → ceil(52.5)×4 = 212, minus exalt −53",
  );
}

console.log("\nReview Tags: four awakeners keyflare 15 (DR floor) → Harmony 120");
{
  // keyflareRegen 15 stays 15 after DR.
  const tagsById: Record<number, Tag> = {
    [keyflareTag.id]: keyflareTag,
  };
  const awakeners = [1, 2, 3, 4].map((id) =>
    makeAwakener({ id, keyflareRegen: 15 }),
  );
  const teamData: TeamData = {
    ...createEmptyTeamData(),
    awakeners,
    manifestations: [],
    tagsById,
  };
  const { totalsByTagId, steps, reviewTeamData } = computeReviewTagTotals(
    teamData,
    createManifestationApplyContext(awakeners, []),
  );
  assert(
    (totalsByTagId.get(keyflareTag.id) ?? 0) === 120,
    `Keyflare Harmony 120 (got ${totalsByTagId.get(keyflareTag.id)})`,
  );
  const synth = reviewTeamData.manifestations.find(
    (m) => m.id === keyflareHarmonyManifestationId(),
  );
  assert(synth != null, "Harmony synthetic present");
  assert(synth!.targetType === "aoe", "target_type aoe");
  assert(synth!.isAccumulating === true, "is_accumulating true");
  assert(
    steps.some((s) => s.kind === "special" && s.label === "Keyflare Harmony"),
    "math debug Harmony step",
  );
}

console.log("\nReview Tags: one awakener keyflare 15 → Harmony 32");
{
  const tagsById: Record<number, Tag> = {
    [keyflareTag.id]: keyflareTag,
  };
  const awakener = makeAwakener({ id: 1, keyflareRegen: 15 });
  const teamData: TeamData = {
    ...createEmptyTeamData(),
    awakeners: [awakener],
    manifestations: [],
    tagsById,
  };
  const { totalsByTagId } = computeReviewTagTotals(
    teamData,
    createManifestationApplyContext([awakener], []),
  );
  // avg 15/4 = 3.75; ceil(7.5)=8; ×4 = 32 (was 30 before ceil).
  assert(
    (totalsByTagId.get(keyflareTag.id) ?? 0) === 32,
    `ceil(15/4×2)×4 = 32 (got ${totalsByTagId.get(keyflareTag.id)})`,
  );
}

console.log("\nTag 131 Increase Base Keyflare feeds Harmony");
{
  const tagsById: Record<number, Tag> = {
    [keyflareTag.id]: keyflareTag,
    [increaseBaseKfTag.id]: increaseBaseKfTag,
  };
  // 15 after DR; +100% → ceil(15*2)=30; avg 30/4=7.5; ceil(15)=15; ×4=60
  const awakener = makeAwakener({ id: 1, keyflareRegen: 15 });
  const teamData: TeamData = {
    ...createEmptyTeamData(),
    awakeners: [awakener],
    manifestations: [
      makeManifestation({
        id: 1,
        tagId: increaseBaseKfTag.id,
        tagName: increaseBaseKfTag.tagName,
        valueScalar: 1,
        sourceKind: "wheel",
        awakenerId: 1,
      }),
    ],
    tagsById,
  };
  const { totalsByTagId, reviewTeamData } = computeReviewTagTotals(
    teamData,
    createManifestationApplyContext([awakener], []),
  );
  const boosted = reviewTeamData.awakeners[0]?.keyflareRegen;
  assert(boosted === 30, `post-Increase keyflare 30 (got ${boosted})`);
  assert(
    (totalsByTagId.get(keyflareTag.id) ?? 0) === 60,
    `Harmony 60 from boosted 30 (got ${totalsByTagId.get(keyflareTag.id)})`,
  );
}

console.log("\nHarmony Keyflare feeds Keyflare→Posse");
{
  const tagsById: Record<number, Tag> = {
    [keyflareTag.id]: keyflareTag,
    [createPosseTag.id]: createPosseTag,
  };
  // Need post-DR sum ≥ 500 so Harmony ≥ 1000 → 1 Posse.
  // Find raw x with DR ≈ 125; use four awakeners at that value.
  let raw = 15;
  while (applyKeyflareDiminishingReturn(raw) < 125) raw += 1;
  const afterDr = applyKeyflareDiminishingReturn(raw);
  const awakeners = [1, 2, 3, 4].map((id) =>
    makeAwakener({ id, keyflareRegen: raw }),
  );
  const expectedHarmony =
    Math.ceil((afterDr * TEAM_SLOT_COUNT) / TEAM_SLOT_COUNT * KEYFLARE_HARMONY_AVG_FACTOR) *
    TEAM_SLOT_COUNT;
  assert(expectedHarmony >= 1000, `Harmony ${expectedHarmony} ≥ 1000`);

  const teamData: TeamData = {
    ...createEmptyTeamData(),
    awakeners,
    manifestations: [],
    tagsById,
  };
  const { totalsByTagId } = computeReviewTagTotals(
    teamData,
    createManifestationApplyContext(awakeners, []),
  );
  assert(
    (totalsByTagId.get(keyflareTag.id) ?? 0) === expectedHarmony,
    `Harmony Keyflare ${expectedHarmony}`,
  );
  assert(
    (totalsByTagId.get(createPosseTag.id) ?? 0) === 1,
    `Harmony alone → 1 Create.Posse (got ${totalsByTagId.get(createPosseTag.id)})`,
  );
}

console.log("\nAll Keyflare Harmony smoke checks passed.");
