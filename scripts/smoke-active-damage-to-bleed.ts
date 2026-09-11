/**
 * Special.Active Damage to Bleed (tag 181) smoke.
 * Run: npx tsx scripts/smoke-active-damage-to-bleed.ts
 *
 * Tag 181 converts a fraction of the finalized Attacker.Active Damage family
 * (prefix + descendants; no Attacker.Tentacle) into
 * Attacker.Non-Active Damage.Bleed Damage. Scope mirrors Special.Birth Ritual:
 * - team (aoe/single/null + posse/realm) → all-owner Active Damage pool
 * - self → owning awakener's own Active Damage only
 * The converted amount is then amplified once by Attacker.Bleed Trigger.
 */
import { applyInteractions } from "../src/lib/path-carver/apply-interactions";
import {
  applyActiveDamageToBleedConversion,
  ATTACKER_NON_ACTIVE_DAMAGE_BLEED_DAMAGE_TAG_ID,
  computeBleedDamageAmount,
  SPECIAL_ACTIVE_DAMAGE_TO_BLEED_TAG_ID,
  sumActiveDamagePool,
} from "../src/lib/path-carver/active-damage-to-bleed";
import { buildAwakenersById } from "../src/lib/path-carver/effective-value-scalar";
import {
  ATTACKER_ACTIVE_DAMAGE_TAG_ID,
  ATTACKER_TENTACLE_TAG_ID,
} from "../src/lib/path-carver/hit-tentacle-attack";
import type {
  Awakener,
  DefaultInteraction,
  Layer,
  Manifestation,
  Tag,
} from "../src/lib/team-data/types";

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
  opts: { isPercent?: boolean; isAdditive?: boolean; layer?: Layer | null } = {},
): Tag {
  return {
    id,
    tagName,
    layer: opts.layer === undefined ? "add" : opts.layer,
    isPercent: opts.isPercent ?? false,
    isAdditive: opts.isAdditive ?? true,
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
    instanceCount: partial.instanceCount ?? 1,
    baseCopies: partial.baseCopies ?? 1,
    copyProviderGroupId: null,
    copyProviderGroupName: null,
    copyProviderTagIds: partial.copyProviderTagIds ?? [],
    dependencyStat: partial.dependencyStat ?? null,
    sourceType: partial.sourceType ?? null,
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
    mathOperation: partial.mathOperation ?? "add_scaled",
    defaultFactor: partial.defaultFactor ?? 1,
    createsBase: partial.createsBase ?? false,
    amplifiesSubject: partial.amplifiesSubject ?? true,
    exclusionTagId: partial.exclusionTagId ?? null,
    exclusionTagName: partial.exclusionTagName ?? null,
    buffTargetTypeRestriction: partial.buffTargetTypeRestriction ?? null,
    ...partial,
  };
}

const adToBleedTag = makeTag(
  SPECIAL_ACTIVE_DAMAGE_TO_BLEED_TAG_ID,
  "Special.Active Damage to Bleed",
  { isPercent: true, layer: null },
);
const bleedDamageTag = makeTag(
  ATTACKER_NON_ACTIVE_DAMAGE_BLEED_DAMAGE_TAG_ID,
  "Attacker.Non-Active Damage.Bleed Damage",
  { layer: null },
);
const activeTag = makeTag(
  ATTACKER_ACTIVE_DAMAGE_TAG_ID,
  "Attacker.Active Damage",
  { layer: "pre_add" },
);
const fixedDamageTag = makeTag(9999, "Attacker.Active Damage.Fixed Damage", {
  layer: "add",
});
const tentacleTag = makeTag(ATTACKER_TENTACLE_TAG_ID, "Attacker.Tentacle", {
  layer: "pre_add",
});
const bleedTriggerTag = makeTag(156, "Attacker.Bleed Trigger", {
  isPercent: true,
  layer: "post_add",
});

console.log("Unit — conversion math");
{
  assert(
    computeBleedDamageAmount(0.3, 1000) === 300,
    "0.3 × 1000 = 300",
  );
  assert(
    computeBleedDamageAmount(0.3, 333) === 100,
    "ceil(0.3 × 333 = 99.9) = 100",
  );
  assert(computeBleedDamageAmount(0, 1000) === 0, "0 rate → 0");
  assert(computeBleedDamageAmount(0.5, 0) === 0, "0 pool → 0");
}

console.log("\nUnit — Active Damage pool excludes Tentacle");
{
  const ownerValues = new Map<string, Map<number, number>>([
    [
      "awakener:1",
      new Map([
        [activeTag.id, 1000],
        [fixedDamageTag.id, 500],
        [tentacleTag.id, 7000],
      ]),
    ],
  ]);
  const tagsById = {
    [activeTag.id]: activeTag,
    [fixedDamageTag.id]: fixedDamageTag,
    [tentacleTag.id]: tentacleTag,
  };
  const pool = sumActiveDamagePool(ownerValues, tagsById);
  assert(pool === 1500, `pool 1500 active + descendant, no Tentacle (got ${pool})`);
}

console.log("\nUnit — scope split (team vs self)");
{
  const ownerValues = new Map<string, Map<number, number>>([
    [
      "awakener:1",
      new Map([
        [adToBleedTag.id, 0.2],
        [activeTag.id, 1000],
      ]),
    ],
    [
      "awakener:2",
      new Map([
        [adToBleedTag.id, 0.1],
        [activeTag.id, 500],
      ]),
    ],
  ]);
  const tagsById = {
    [adToBleedTag.id]: adToBleedTag,
    [activeTag.id]: activeTag,
    [bleedDamageTag.id]: bleedDamageTag,
  };
  const { result, steps } = applyActiveDamageToBleedConversion({
    ownerValues,
    selfByOwner: new Map([["awakener:1", 0.2]]),
    tagsById,
  });
  assert(
    Math.abs(result.team.rate - 0.1) < 1e-9,
    `team rate 0.1 (got ${result.team.rate})`,
  );
  assert(
    result.team.pool === 1500,
    `team pool 1500 (got ${result.team.pool})`,
  );
  assert(
    result.team.conversion === 150,
    `team conversion 150 (got ${result.team.conversion})`,
  );
  const self = result.selfByOwner.get("awakener:1");
  assert(self != null && self.conversion === 200, "self conversion 200");
  assert(
    steps.some(
      (s) =>
        s.label === "Special.Active Damage to Bleed → Bleed Damage" &&
        s.detail.includes("scope=self owner=awakener:1"),
    ),
    "self scope debug step present",
  );
}

console.log("\nIntegration — no tag 181");
{
  const awakener = makeAwakener({ id: 1 });
  const tagsById: Record<number, Tag> = {
    [activeTag.id]: activeTag,
    [bleedDamageTag.id]: bleedDamageTag,
  };
  const manifests = [
    makeManifestation({
      id: 1,
      tagId: activeTag.id,
      tagName: activeTag.tagName,
      valueScalar: 1000,
      awakenerId: 1,
    }),
  ];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  assert(
    (result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_BLEED_DAMAGE_TAG_ID) ??
      0) === 0,
    "no Bleed Damage without tag 181",
  );
}

console.log("\nIntegration — team 181 + Bleed Trigger");
{
  const awakener = makeAwakener({ id: 1 });
  const tagsById: Record<number, Tag> = {
    [adToBleedTag.id]: adToBleedTag,
    [activeTag.id]: activeTag,
    [tentacleTag.id]: tentacleTag,
    [bleedDamageTag.id]: bleedDamageTag,
    [bleedTriggerTag.id]: bleedTriggerTag,
  };
  const manifests = [
    makeManifestation({
      id: 1,
      tagId: adToBleedTag.id,
      tagName: adToBleedTag.tagName,
      valueScalar: 0.3,
      awakenerId: 1,
    }),
    makeManifestation({
      id: 2,
      tagId: activeTag.id,
      tagName: activeTag.tagName,
      valueScalar: 1000,
      awakenerId: 1,
    }),
    makeManifestation({
      id: 3,
      tagId: tentacleTag.id,
      tagName: tentacleTag.tagName,
      valueScalar: 500,
      awakenerId: 1,
    }),
    makeManifestation({
      id: 4,
      tagId: bleedTriggerTag.id,
      tagName: bleedTriggerTag.tagName,
      valueScalar: 0.5,
      awakenerId: 1,
    }),
  ];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [
      makeInteraction({
        id: 104,
        modifierTagId: bleedTriggerTag.id,
        modifierTagName: bleedTriggerTag.tagName,
        targetTagId: bleedDamageTag.id,
        targetTagName: bleedDamageTag.tagName,
        mathOperation: "multiply_one_plus",
      }),
    ],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  assert(
    (result.totalsByTagId.get(SPECIAL_ACTIVE_DAMAGE_TO_BLEED_TAG_ID) ?? 0) === 0.3,
    "tag 181 total 0.3",
  );
  assert(
    (result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_BLEED_DAMAGE_TAG_ID) ??
      0) === 450,
    `Bleed Damage 450 = 1000 × 0.3 × 1.5 (got ${result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_BLEED_DAMAGE_TAG_ID)})`,
  );
}

console.log("\nIntegration — no Bleed Trigger → unamplified");
{
  const awakener = makeAwakener({ id: 1 });
  const tagsById: Record<number, Tag> = {
    [adToBleedTag.id]: adToBleedTag,
    [activeTag.id]: activeTag,
    [bleedDamageTag.id]: bleedDamageTag,
  };
  const manifests = [
    makeManifestation({
      id: 1,
      tagId: adToBleedTag.id,
      tagName: adToBleedTag.tagName,
      valueScalar: 0.3,
      awakenerId: 1,
    }),
    makeManifestation({
      id: 2,
      tagId: activeTag.id,
      tagName: activeTag.tagName,
      valueScalar: 1000,
      awakenerId: 1,
    }),
  ];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  assert(
    (result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_BLEED_DAMAGE_TAG_ID) ??
      0) === 300,
    `Bleed Damage 300 (got ${result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_BLEED_DAMAGE_TAG_ID)})`,
  );
}

console.log("\nIntegration — self 181 uses own Active Damage only");
{
  const a1 = makeAwakener({ id: 1 });
  const a2 = makeAwakener({ id: 2, name: "B" });
  const tagsById: Record<number, Tag> = {
    [adToBleedTag.id]: adToBleedTag,
    [activeTag.id]: activeTag,
    [tentacleTag.id]: tentacleTag,
    [bleedDamageTag.id]: bleedDamageTag,
  };
  const manifests = [
    makeManifestation({
      id: 1,
      tagId: adToBleedTag.id,
      tagName: adToBleedTag.tagName,
      valueScalar: 0.5,
      targetType: "self",
      awakenerId: 1,
    }),
    makeManifestation({
      id: 2,
      tagId: activeTag.id,
      tagName: activeTag.tagName,
      valueScalar: 1000,
      awakenerId: 1,
    }),
    makeManifestation({
      id: 3,
      tagId: activeTag.id,
      tagName: activeTag.tagName,
      valueScalar: 500,
      awakenerId: 2,
    }),
    makeManifestation({
      id: 4,
      tagId: tentacleTag.id,
      tagName: tentacleTag.tagName,
      valueScalar: 900,
      awakenerId: 1,
    }),
  ];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById,
    awakenersById: buildAwakenersById([a1, a2]),
  });
  assert(
    (result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_BLEED_DAMAGE_TAG_ID) ??
      0) === 500,
    `self Bleed Damage 500 = own AD 1000 × 0.5, no Tentacle (got ${result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_BLEED_DAMAGE_TAG_ID)})`,
  );
}

console.log("\nAll Active Damage to Bleed smoke tests passed.");
