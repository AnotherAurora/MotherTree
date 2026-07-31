/**
 * Phase 2b.4 smoke — Keyflare → Create.Posse (non-consuming, max 2).
 * Run: npx tsx scripts/smoke-keyflare-to-posse.ts
 */
import { computeReviewTagTotals } from "../src/lib/path-carver/aggregate-tag-scalars";
import {
  BASE_POSSE_KEYFLARE_COST,
  MAX_POSSE_FROM_KEYFLARE,
  SPECIAL_INCREASE_POSSE_KEYFLARE_COST_TAG_ID,
  SUPPORT_KEYFLARE_TAG_ID,
  computeKeyflareToPosse,
} from "../src/lib/path-carver/keyflare-to-posse";
import { createManifestationApplyContext } from "../src/lib/path-carver/manifestation-apply";
import {
  SPECIAL_WHEN_POSSE_TAG_ID,
  SUPPORT_CREATE_POSSE_TAG_ID,
} from "../src/lib/path-carver/trigger-condition";
import { SPECIAL_INCREASE_BASE_KEYFLARE_TAG_ID } from "../src/lib/path-carver/awakener-base-stats";
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
const costTag = makeTag(
  SPECIAL_INCREASE_POSSE_KEYFLARE_COST_TAG_ID,
  "Special.Increase Posse Keyflare Cost",
);
const whenPosseTag = makeTag(SPECIAL_WHEN_POSSE_TAG_ID, "Special.When.Posse");
const increaseBaseKfTag = makeTag(
  SPECIAL_INCREASE_BASE_KEYFLARE_TAG_ID,
  "Special.Increase Base Keyflare",
  true,
);
const critTag = makeTag(17, "Support.Crit Damage", true);

console.log("computeKeyflareToPosse unit");
{
  assert(BASE_POSSE_KEYFLARE_COST === 1000, "base cost 1000");
  assert(MAX_POSSE_FROM_KEYFLARE === 2, "max 2 from Keyflare");

  let r = computeKeyflareToPosse({ keyflareTotal: 1000, costIncrease: 0 });
  assert(r.posseCreated === 1 && r.costPerPosse === 1000, "1000 → 1");

  r = computeKeyflareToPosse({ keyflareTotal: 999, costIncrease: 0 });
  assert(r.posseCreated === 0, "under-cost → 0");

  r = computeKeyflareToPosse({ keyflareTotal: 2000, costIncrease: 1000 });
  assert(
    r.costPerPosse === 2000 && r.posseCreated === 1,
    "Primordia-style cost 2000 → 1",
  );

  r = computeKeyflareToPosse({ keyflareTotal: 2500, costIncrease: 200 });
  assert(
    r.costPerPosse === 1200 && r.posseCreated === 2,
    "Ring +200 → cost 1200; 2500 → 2",
  );

  r = computeKeyflareToPosse({ keyflareTotal: 5000, costIncrease: 0 });
  assert(r.posseCreated === 2, "5000 capped at 2");
}

console.log("\nReview Tags: base conversion, Keyflare unchanged");
{
  const tagsById: Record<number, Tag> = {
    [keyflareTag.id]: keyflareTag,
    [createPosseTag.id]: createPosseTag,
    [costTag.id]: costTag,
  };
  const awakener = makeAwakener({ id: 1 });
  const teamData: TeamData = {
    ...createEmptyTeamData(),
    awakeners: [awakener],
    manifestations: [
      makeManifestation({
        id: 1,
        tagId: keyflareTag.id,
        tagName: keyflareTag.tagName,
        valueScalar: 1000,
        sourceKind: "wheel",
      }),
    ],
    tagsById,
  };
  const { totalsByTagId, steps } = computeReviewTagTotals(
    teamData,
    createManifestationApplyContext([awakener], []),
  );
  assert(
    (totalsByTagId.get(keyflareTag.id) ?? 0) === 1000,
    `Keyflare still 1000 (got ${totalsByTagId.get(keyflareTag.id)})`,
  );
  assert(
    (totalsByTagId.get(createPosseTag.id) ?? 0) === 1,
    `Create.Posse 1 (got ${totalsByTagId.get(createPosseTag.id)})`,
  );
  assert(
    steps.some(
      (s) =>
        s.kind === "special" && s.label === "Keyflare → Create.Posse",
    ),
    "math debug special step present",
  );
}

console.log("\nReview Tags: Primordia-style cost + Keyflare unchanged");
{
  const tagsById: Record<number, Tag> = {
    [keyflareTag.id]: keyflareTag,
    [createPosseTag.id]: createPosseTag,
    [costTag.id]: costTag,
  };
  const awakener = makeAwakener({ id: 1 });
  const teamData: TeamData = {
    ...createEmptyTeamData(),
    awakeners: [awakener],
    manifestations: [
      makeManifestation({
        id: 1,
        tagId: keyflareTag.id,
        tagName: keyflareTag.tagName,
        valueScalar: 2000,
        sourceKind: "wheel",
      }),
      makeManifestation({
        id: 2,
        tagId: costTag.id,
        tagName: costTag.tagName,
        valueScalar: 1000,
        sourceKind: "covenant",
      }),
    ],
    tagsById,
  };
  const { totalsByTagId } = computeReviewTagTotals(
    teamData,
    createManifestationApplyContext([awakener], []),
  );
  assert(
    (totalsByTagId.get(keyflareTag.id) ?? 0) === 2000,
    "Keyflare still 2000",
  );
  assert(
    (totalsByTagId.get(createPosseTag.id) ?? 0) === 1,
    "cost 2000 → 1 Posse",
  );
}

console.log("\nReview Tags: cap at 2");
{
  const tagsById: Record<number, Tag> = {
    [keyflareTag.id]: keyflareTag,
    [createPosseTag.id]: createPosseTag,
  };
  const awakener = makeAwakener({ id: 1 });
  const teamData: TeamData = {
    ...createEmptyTeamData(),
    awakeners: [awakener],
    manifestations: [
      makeManifestation({
        id: 1,
        tagId: keyflareTag.id,
        tagName: keyflareTag.tagName,
        valueScalar: 5000,
        sourceKind: "wheel",
      }),
    ],
    tagsById,
  };
  const { totalsByTagId } = computeReviewTagTotals(
    teamData,
    createManifestationApplyContext([awakener], []),
  );
  assert(
    (totalsByTagId.get(createPosseTag.id) ?? 0) === 2,
    "5000 Keyflare → 2 Posse (cap)",
  );
  assert(
    (totalsByTagId.get(keyflareTag.id) ?? 0) === 5000,
    "Keyflare still 5000",
  );
}

console.log("\nTag 131 Increase Base Keyflare does not raise posse cost");
{
  const tagsById: Record<number, Tag> = {
    [keyflareTag.id]: keyflareTag,
    [createPosseTag.id]: createPosseTag,
    [increaseBaseKfTag.id]: increaseBaseKfTag,
  };
  const awakener = makeAwakener({ id: 1 }); // null keyflare → no Harmony
  const teamData: TeamData = {
    ...createEmptyTeamData(),
    awakeners: [awakener],
    manifestations: [
      makeManifestation({
        id: 1,
        tagId: keyflareTag.id,
        tagName: keyflareTag.tagName,
        valueScalar: 1500,
        sourceKind: "wheel",
      }),
      makeManifestation({
        id: 2,
        tagId: increaseBaseKfTag.id,
        tagName: increaseBaseKfTag.tagName,
        valueScalar: 1000,
        sourceKind: "wheel",
        awakenerId: 1,
      }),
    ],
    tagsById,
  };
  const { totalsByTagId } = computeReviewTagTotals(
    teamData,
    createManifestationApplyContext([awakener], []),
  );
  // cost stays 1000 → floor(1500/1000)=1 (if 131 added to cost would be 0 or different)
  assert(
    (totalsByTagId.get(createPosseTag.id) ?? 0) === 1,
    "tag 131 ignored for cost; 1500/1000 → 1",
  );
}

console.log("\nWhen.Posse gating from converted Create.Posse");
{
  const tagsById: Record<number, Tag> = {
    [keyflareTag.id]: keyflareTag,
    [createPosseTag.id]: createPosseTag,
    [whenPosseTag.id]: whenPosseTag,
    [critTag.id]: critTag,
  };
  const awakener = makeAwakener({ id: 1 });
  const teamData: TeamData = {
    ...createEmptyTeamData(),
    awakeners: [awakener],
    manifestations: [
      makeManifestation({
        id: 1,
        tagId: keyflareTag.id,
        tagName: keyflareTag.tagName,
        valueScalar: 2000,
        sourceKind: "wheel",
      }),
      makeManifestation({
        id: 2,
        tagId: critTag.id,
        tagName: critTag.tagName,
        valueScalar: 0.05,
        triggerCondition: SPECIAL_WHEN_POSSE_TAG_ID,
        sourceKind: "wheel",
      }),
    ],
    tagsById,
  };
  const { totalsByTagId, triggerCounts } = computeReviewTagTotals(
    teamData,
    createManifestationApplyContext([awakener], []),
  );
  assert(
    triggerCounts.get(SPECIAL_WHEN_POSSE_TAG_ID) === 2,
    `When.Posse count 2 (got ${triggerCounts.get(SPECIAL_WHEN_POSSE_TAG_ID)})`,
  );
  assert(
    Math.abs((totalsByTagId.get(critTag.id) ?? 0) - 0.1) < 1e-9,
    `gated Crit 0.05×2 = 0.1 (got ${totalsByTagId.get(critTag.id)})`,
  );
}

console.log("\nAll Keyflare→Posse smoke checks passed.");
