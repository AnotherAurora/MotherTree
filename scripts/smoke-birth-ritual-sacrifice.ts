/**
 * Birth Ritual → Sacrifice smoke.
 * Run: npx tsx scripts/smoke-birth-ritual-sacrifice.ts
 *
 * Uncapped Birth Ritual scoped by target_type:
 * - team (aoe/single/null + posse/realm) → all-owner Active Damage + Tentacle → *team*
 * - self → owning awakener's own Active Damage only (no Tentacle) → awakener bucket
 */
import { applyInteractions } from "../src/lib/path-carver/apply-interactions";
import {
  applyBirthRitualSacrificeConversion,
  ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID,
  computeSacrificeAmount,
  SPECIAL_BIRTH_RITUAL_TAG_ID,
  sumOwnerActiveDamagePool,
  sumSacrificeDamagePool,
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

console.log("Unit — pools and sacrifice math");
{
  const ownerValues = new Map<string, Map<number, number>>();
  ownerValues.set(
    "awakener:1",
    new Map([[ATTACKER_ACTIVE_DAMAGE_TAG_ID, 500]]),
  );
  ownerValues.set(
    "awakener:2",
    new Map([[ATTACKER_TENTACLE_TAG_ID, 300]]),
  );
  const poolTagsById = {
    [activeTag.id]: activeTag,
    [tentacleTag.id]: tentacleTag,
  };
  const pool = sumSacrificeDamagePool(ownerValues, poolTagsById);
  assert(pool === 800, `team damage pool 800 (got ${pool})`);
  assert(
    computeSacrificeAmount(10, pool) === 80,
    "10 Birth Ritual → 80 Sacrifice",
  );

  const ownerPool = sumOwnerActiveDamagePool(
    ownerValues,
    "awakener:1",
    poolTagsById,
  );
  assert(
    ownerPool === 500,
    `self pool 500 excludes Tentacle (got ${ownerPool})`,
  );
}

console.log("\nUnit — scope conversion writes to correct buckets");
{
  const ownerValues = new Map<string, Map<number, number>>([
    [
      "awakener:1",
      new Map([
        [SPECIAL_BIRTH_RITUAL_TAG_ID, 30],
        [activeTag.id, 100],
      ]),
    ],
    [
      "awakener:2",
      new Map([
        [SPECIAL_BIRTH_RITUAL_TAG_ID, 40],
        [activeTag.id, 50],
      ]),
    ],
  ]);
  const tagsById = {
    [birthRitualTag.id]: birthRitualTag,
    [activeTag.id]: activeTag,
    [sacrificeTag.id]: sacrificeTag,
  };
  const { result, steps } = applyBirthRitualSacrificeConversion({
    ownerValues,
    selfByOwner: new Map([["awakener:1", 30]]),
    tagsById,
  });
  assert(
    result.teamBirthRitual === 40,
    `team BR 40 (got ${result.teamBirthRitual})`,
  );
  assert(
    result.teamDamagePool === 150,
    `team pool 150 (got ${result.teamDamagePool})`,
  );
  assert(
    (ownerValues
      .get("awakener:1")
      ?.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID) ?? 0) === 30,
    "self Sacrifice 30 written to awakener:1 bucket",
  );
  assert(
    (ownerValues
      .get("*team*")
      ?.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID) ?? 0) === 60,
    "team Sacrifice 60 written to *team* bucket",
  );
  assert(
    result.sacrificeAdded === 90,
    `sacrificeAdded 90 (got ${result.sacrificeAdded})`,
  );
  assert(
    result.sacrificeTotal === 90,
    `sacrificeTotal 90 (got ${result.sacrificeTotal})`,
  );
  assert(
    steps.some(
      (s) =>
        s.kind === "special" &&
        s.label === "Special.Birth Ritual → Sacrifice" &&
        s.detail.includes("scope=self owner=awakener:1"),
    ),
    "self scope debug step present",
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

console.log("\nIntegration — uncapped: aoe 100 converts 100%");
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
    (result.totalsByTagId.get(SPECIAL_BIRTH_RITUAL_TAG_ID) ?? 0) === 100,
    `Birth Ritual uncapped at 100 (got ${result.totalsByTagId.get(SPECIAL_BIRTH_RITUAL_TAG_ID)})`,
  );
  assert(
    (result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID) ??
      0) === 1000,
    `Sacrifice 100% of 1000 = 1000 (got ${result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID)})`,
  );
  assert(
    !result.steps.some(
      (s) => s.kind === "special" && s.label === "Special.Birth Ritual cap",
    ),
    "no cap debug step",
  );
}

console.log("\nIntegration — stacking: self (awakener 1) + aoe (awakener 2)");
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
      valueScalar: 30,
      awakenerId: 1,
      targetType: "self",
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
      tagId: birthRitualTag.id,
      tagName: birthRitualTag.tagName,
      valueScalar: 40,
      awakenerId: 2,
    }),
    makeManifestation({
      id: 4,
      tagId: activeTag.id,
      tagName: activeTag.tagName,
      valueScalar: 50,
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
    (result.totalsByTagId.get(SPECIAL_BIRTH_RITUAL_TAG_ID) ?? 0) === 70,
    `Birth Ritual total 70 (got ${result.totalsByTagId.get(SPECIAL_BIRTH_RITUAL_TAG_ID)})`,
  );
  assert(
    (result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID) ??
      0) === 90,
    `Sacrifice 60 team + 30 self = 90 (got ${result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID)})`,
  );
}

console.log("\nIntegration — self excludes Tentacle; aoe includes it");
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
  const selfManifests = [
    makeManifestation({
      id: 1,
      tagId: birthRitualTag.id,
      tagName: birthRitualTag.tagName,
      valueScalar: 30,
      awakenerId: 1,
      targetType: "self",
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
  const r1 = applyInteractions({
    manifestations: selfManifests,
    appliedManifestations: selfManifests,
    defaultInteractions: [],
    tagsById,
    awakenersById: buildAwakenersById([a1]),
  });
  assert(
    (r1.totalsByTagId.get(ATTACKER_TENTACLE_TAG_ID) ?? 0) === 200,
    "Tentacle 200 present",
  );
  assert(
    (r1.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID) ?? 0) ===
      30,
    "self-only Sacrifice 30 — Tentacle not in self pool",
  );

  const stackedManifests = [
    ...selfManifests,
    makeManifestation({
      id: 5,
      tagId: birthRitualTag.id,
      tagName: birthRitualTag.tagName,
      valueScalar: 10,
      awakenerId: 2,
    }),
  ];
  const r2 = applyInteractions({
    manifestations: stackedManifests,
    appliedManifestations: stackedManifests,
    defaultInteractions: [],
    tagsById,
    awakenersById: buildAwakenersById([a1, a2]),
  });
  assert(
    (r2.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID) ?? 0) ===
      60,
    "Sacrifice 60 — team pool 300 (AD 100 + Tentacle 200) ×10% + self 30",
  );
}

console.log("\nIntegration — posse self treated as team scope");
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
      tagId: birthRitualTag.id,
      tagName: birthRitualTag.tagName,
      valueScalar: 20,
      sourceKind: "posse",
      awakenerId: null,
      targetType: "self",
    }),
    makeManifestation({
      id: 2,
      tagId: activeTag.id,
      tagName: activeTag.tagName,
      valueScalar: 100,
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
    (result.totalsByTagId.get(SPECIAL_BIRTH_RITUAL_TAG_ID) ?? 0) === 20,
    `Birth Ritual total 20 (got ${result.totalsByTagId.get(SPECIAL_BIRTH_RITUAL_TAG_ID)})`,
  );
  assert(
    (result.totalsByTagId.get(ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID) ??
      0) === 20,
    "posse self converts team-wide 20% of 100 = 20",
  );
}

console.log("\nAll Birth Ritual → Sacrifice smoke tests passed.");
