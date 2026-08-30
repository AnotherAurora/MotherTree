/**
 * Birth Ritual → Sacrifice smoke (Phase 4e).
 * Run: npx tsx scripts/smoke-birth-ritual-sacrifice.ts
 *
 * Active Damage and converted Tentacle both enter the damage pool (no dedup).
 */
import { applyInteractions } from "../src/lib/path-carver/apply-interactions";
import {
  applyBirthRitualCap,
  ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID,
  computeSacrificeAmount,
  MAX_BIRTH_RITUAL,
  SPECIAL_BIRTH_RITUAL_TAG_ID,
  sumSacrificeDamagePool,
  sumTagAcrossOwners,
} from "../src/lib/path-carver/birth-ritual-sacrifice";
import { buildAwakenersById } from "../src/lib/path-carver/effective-value-scalar";
import {
  ATTACKER_ACTIVE_DAMAGE_TAG_ID,
  ATTACKER_TENTACLE_TAG_ID,
  SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID,
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

const birthRitualTag = makeTag(
  SPECIAL_BIRTH_RITUAL_TAG_ID,
  "Special.Birth Ritual",
);
const sacrificeTag = makeTag(
  ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID,
  "Attacker.Non-Active Damage.Sacrifice",
);
const activeTag = makeTag(
  ATTACKER_ACTIVE_DAMAGE_TAG_ID,
  "Attacker.Active Damage",
  { layer: "pre_add" },
);
const tentacleTag = makeTag(ATTACKER_TENTACLE_TAG_ID, "Attacker.Tentacle", {
  layer: "pre_add",
});
const strUpTag = makeTag(30, "Support.STR Up", { layer: "add" });
const tduTag = makeTag(
  SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID,
  "Support.Tentacle Damage Up",
  { layer: "add" },
);

console.log("Unit — cap and sacrifice math");
{
  const ownerValues = new Map<string, Map<number, number>>();
  ownerValues.set("awakener:1", new Map([[SPECIAL_BIRTH_RITUAL_TAG_ID, 60]]));
  ownerValues.set("awakener:2", new Map([[SPECIAL_BIRTH_RITUAL_TAG_ID, 40]]));
  const cap = applyBirthRitualCap(ownerValues);
  assert(cap.rawTotal === 100, `raw 100 (got ${cap.rawTotal})`);
  assert(cap.cappedTotal === MAX_BIRTH_RITUAL, `capped 75 (got ${cap.cappedTotal})`);
  assert(cap.capApplied, "cap applied");
  assert(
    sumTagAcrossOwners(ownerValues, SPECIAL_BIRTH_RITUAL_TAG_ID) === 75,
    "owner buckets scaled to 75 total",
  );

  ownerValues.set("awakener:1", new Map([[ATTACKER_ACTIVE_DAMAGE_TAG_ID, 500]]));
  ownerValues.set("awakener:2", new Map([[ATTACKER_TENTACLE_TAG_ID, 300]]));
  const pool = sumSacrificeDamagePool(ownerValues, {
    [activeTag.id]: activeTag,
    [tentacleTag.id]: tentacleTag,
  });
  assert(pool === 800, `damage pool 800 (got ${pool})`);
  assert(
    computeSacrificeAmount(10, pool) === 80,
    "10 Birth Ritual → 80 Sacrifice",
  );
}

console.log("\nIntegration — no Birth Ritual");
{
  const awakener = makeAwakener({ id: 1 });
  const tagsById: Record<number, Tag> = {
    [activeTag.id]: activeTag,
    [sacrificeTag.id]: sacrificeTag,
  };
  const manifests = [
    makeManifestation({
      id: 1,
      tagId: activeTag.id,
      tagName: activeTag.tagName,
      valueScalar: 500,
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
    (result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID) ??
      0) === 0,
    "no Sacrifice without Birth Ritual",
  );
}

console.log("\nIntegration — 50 Birth Ritual, AD 1000 + Tentacle 200");
{
  const awakener = makeAwakener({ id: 1 });
  const tagsById: Record<number, Tag> = {
    [birthRitualTag.id]: birthRitualTag,
    [activeTag.id]: activeTag,
    [tentacleTag.id]: tentacleTag,
    [tduTag.id]: tduTag,
    [sacrificeTag.id]: sacrificeTag,
  };
  const manifests = [
    makeManifestation({
      id: 1,
      tagId: birthRitualTag.id,
      tagName: birthRitualTag.tagName,
      valueScalar: 50,
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
      valueScalar: 200,
      awakenerId: 1,
    }),
    makeManifestation({
      id: 4,
      tagId: tduTag.id,
      tagName: tduTag.tagName,
      valueScalar: 1,
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
    (result.totalsByTagId.get(SPECIAL_BIRTH_RITUAL_TAG_ID) ?? 0) === 50,
    "Birth Ritual total 50",
  );
  assert(
    (result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID) ??
      0) === 600,
    `Sacrifice 600 (got ${result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID)})`,
  );
  assert(
    result.steps.some(
      (s) =>
        s.kind === "special" &&
        s.label === "Special.Birth Ritual → Sacrifice",
    ),
    "conversion debug step present",
  );
}

console.log("\nIntegration — cap 100 → 75");
{
  const a1 = makeAwakener({ id: 1 });
  const a2 = makeAwakener({ id: 2, name: "B" });
  const tagsById: Record<number, Tag> = {
    [birthRitualTag.id]: birthRitualTag,
    [activeTag.id]: activeTag,
    [sacrificeTag.id]: sacrificeTag,
  };
  const manifests = [
    makeManifestation({
      id: 1,
      tagId: birthRitualTag.id,
      tagName: birthRitualTag.tagName,
      valueScalar: 60,
      awakenerId: 1,
    }),
    makeManifestation({
      id: 2,
      tagId: birthRitualTag.id,
      tagName: birthRitualTag.tagName,
      valueScalar: 40,
      awakenerId: 2,
    }),
    makeManifestation({
      id: 3,
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
    awakenersById: buildAwakenersById([a1, a2]),
  });
  assert(
    (result.totalsByTagId.get(SPECIAL_BIRTH_RITUAL_TAG_ID) ?? 0) === 75,
    `Birth Ritual capped at 75 (got ${result.totalsByTagId.get(SPECIAL_BIRTH_RITUAL_TAG_ID)})`,
  );
  assert(
    (result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID) ??
      0) === 750,
    `Sacrifice uses 75% (got ${result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID)})`,
  );
  assert(
    result.steps.some(
      (s) => s.kind === "special" && s.label === "Special.Birth Ritual cap",
    ),
    "cap debug step present",
  );
}

console.log("\nIntegration — multi-owner damage pool");
{
  const a1 = makeAwakener({ id: 1 });
  const a2 = makeAwakener({ id: 2, name: "B" });
  const tagsById: Record<number, Tag> = {
    [birthRitualTag.id]: birthRitualTag,
    [activeTag.id]: activeTag,
    [tentacleTag.id]: tentacleTag,
    [tduTag.id]: tduTag,
    [sacrificeTag.id]: sacrificeTag,
  };
  const manifests = [
    makeManifestation({
      id: 1,
      tagId: birthRitualTag.id,
      tagName: birthRitualTag.tagName,
      valueScalar: 10,
      awakenerId: 1,
    }),
    makeManifestation({
      id: 2,
      tagId: activeTag.id,
      tagName: activeTag.tagName,
      valueScalar: 500,
      awakenerId: 1,
    }),
    makeManifestation({
      id: 3,
      tagId: tentacleTag.id,
      tagName: tentacleTag.tagName,
      valueScalar: 300,
      awakenerId: 2,
    }),
    makeManifestation({
      id: 4,
      tagId: tduTag.id,
      tagName: tduTag.tagName,
      valueScalar: 1,
      awakenerId: 2,
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
    (result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID) ??
      0) === 80,
    `Sacrifice 80 from pool 800 (got ${result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID)})`,
  );
}

console.log("\nIntegration — STR Up amplifies Active Damage before conversion");
{
  const awakener = makeAwakener({ id: 1, atk: 100 });
  const tagsById: Record<number, Tag> = {
    [birthRitualTag.id]: birthRitualTag,
    [activeTag.id]: activeTag,
    [strUpTag.id]: strUpTag,
    [sacrificeTag.id]: sacrificeTag,
  };
  const manifests = [
    makeManifestation({
      id: 1,
      tagId: birthRitualTag.id,
      tagName: birthRitualTag.tagName,
      valueScalar: 10,
      awakenerId: 1,
    }),
    makeManifestation({
      id: 2,
      tagId: activeTag.id,
      tagName: activeTag.tagName,
      valueScalar: 100,
      awakenerId: 1,
    }),
    makeManifestation({
      id: 3,
      tagId: strUpTag.id,
      tagName: strUpTag.tagName,
      valueScalar: 1,
      awakenerId: 1,
      dependencyStat: "atk",
    }),
  ];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [
      makeInteraction({
        id: 1,
        modifierTagId: strUpTag.id,
        modifierTagName: strUpTag.tagName,
        targetTagId: activeTag.id,
        targetTagName: activeTag.tagName,
        mathOperation: "add_scaled",
        defaultFactor: 1,
      }),
    ],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  const activeTotal = result.totalsByTagId.get(activeTag.id) ?? 0;
  assert(activeTotal === 200, `Active Damage 200 after STR (got ${activeTotal})`);
  assert(
    (result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID) ??
      0) === 20,
    `Sacrifice 10% of 200 = 20 (got ${result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID)})`,
  );
}

console.log("\nIntegration — Layer A Sacrifice base merges additively");
{
  const awakener = makeAwakener({ id: 1 });
  const tagsById: Record<number, Tag> = {
    [birthRitualTag.id]: birthRitualTag,
    [activeTag.id]: activeTag,
    [sacrificeTag.id]: sacrificeTag,
  };
  const manifests = [
    makeManifestation({
      id: 1,
      tagId: sacrificeTag.id,
      tagName: sacrificeTag.tagName,
      valueScalar: 50,
      awakenerId: 1,
      sourceKind: "wheel",
    }),
    makeManifestation({
      id: 2,
      tagId: birthRitualTag.id,
      tagName: birthRitualTag.tagName,
      valueScalar: 50,
      awakenerId: 1,
    }),
    makeManifestation({
      id: 3,
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
    (result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID) ??
      0) === 550,
    `Sacrifice 50 base + 500 conversion = 550 (got ${result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID)})`,
  );
}

console.log("\nAll Birth Ritual → Sacrifice smoke tests passed.");
