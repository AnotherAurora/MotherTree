/**
 * Special.All Tentacle Attack hop smoke (Phase 4f).
 * Run: npx tsx scripts/smoke-all-tentacle-attack.ts
 */
import { applyInteractions } from "../src/lib/path-carver/apply-interactions";
import {
  applyAllTentacleAttackHop,
  SPECIAL_ALL_TENTACLE_ATTACK_TAG_ID,
  sumGeneratedTentaclePool,
  SUPPORT_GENERATE_PERMANENT_TENTACLE_TAG_ID,
  SUPPORT_GENERATE_TEMPORARY_TENTACLE_TAG_ID,
} from "../src/lib/path-carver/all-tentacle-attack";
import { buildAwakenersById } from "../src/lib/path-carver/effective-value-scalar";
import { ATTACKER_TENTACLE_TAG_ID } from "../src/lib/path-carver/hit-tentacle-attack";
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
    layer: opts.layer === undefined ? null : opts.layer,
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
    instanceCount: 1,
    baseCopies: 1,
    copyProviderGroupId: null,
    copyProviderGroupName: null,
    copyProviderTagIds: [],
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

const generatePermTag = makeTag(
  SUPPORT_GENERATE_PERMANENT_TENTACLE_TAG_ID,
  "Support.Generate Permanent Tentacle",
);
const generateTempTag = makeTag(
  SUPPORT_GENERATE_TEMPORARY_TENTACLE_TAG_ID,
  "Support.Generate Temporary Tentacle",
);
const specialTag = makeTag(
  SPECIAL_ALL_TENTACLE_ATTACK_TAG_ID,
  "Special.All Tentacle Attack",
);
const tentacleTag = makeTag(ATTACKER_TENTACLE_TAG_ID, "Attacker.Tentacle", {
  layer: "pre_add",
});
const tduTag = makeTag(29, "Support.Tentacle Damage Up", { layer: "add" });

const generatePermToTentacle = makeInteraction({
  id: 91,
  modifierTagId: generatePermTag.id,
  modifierTagName: generatePermTag.tagName,
  targetTagId: tentacleTag.id,
  targetTagName: tentacleTag.tagName,
  createsBase: true,
  amplifiesSubject: false,
});
const generateTempToTentacle = makeInteraction({
  id: 92,
  modifierTagId: generateTempTag.id,
  modifierTagName: generateTempTag.tagName,
  targetTagId: tentacleTag.id,
  targetTagName: tentacleTag.tagName,
  createsBase: true,
  amplifiesSubject: false,
});

const baseTags: Record<number, Tag> = {
  [generatePermTag.id]: generatePermTag,
  [generateTempTag.id]: generateTempTag,
  [specialTag.id]: specialTag,
  [tentacleTag.id]: tentacleTag,
  [tduTag.id]: tduTag,
};

function withMinimalTdu(
  manifests: Manifestation[],
  awakenerId = 1,
): Manifestation[] {
  return [
    ...manifests,
    makeManifestation({
      id: 900,
      tagId: tduTag.id,
      tagName: tduTag.tagName,
      valueScalar: 1,
      targetType: "aoe",
      awakenerId,
    }),
  ];
}

console.log("Unit — sumGeneratedTentaclePool");
{
  const awakener = makeAwakener({ id: 1 });
  const awakenersById = buildAwakenersById([awakener]);
  const applied = [
    makeManifestation({
      id: 1,
      tagId: generateTempTag.id,
      tagName: generateTempTag.tagName,
      valueScalar: 1,
      targetType: "aoe",
    }),
    makeManifestation({
      id: 2,
      tagId: generatePermTag.id,
      tagName: generatePermTag.tagName,
      valueScalar: 1,
      targetType: "aoe",
    }),
    makeManifestation({
      id: 3,
      tagId: generateTempTag.id,
      tagName: generateTempTag.tagName,
      valueScalar: 5,
      targetType: "self",
      awakenerId: 1,
    }),
  ];
  const pool = sumGeneratedTentaclePool(applied, baseTags, awakenersById, {});
  assert(pool === 2, `team non-self Generate pool = 2 (got ${pool})`);
}

console.log("\nUnit — applyAllTentacleAttackHop");
{
  const awakener = makeAwakener({ id: 1 });
  const awakenersById = buildAwakenersById([awakener]);
  const applied = [
    makeManifestation({
      id: 1,
      tagId: generateTempTag.id,
      tagName: generateTempTag.tagName,
      valueScalar: 1,
    }),
    makeManifestation({
      id: 2,
      tagId: generatePermTag.id,
      tagName: generatePermTag.tagName,
      valueScalar: 1,
    }),
    makeManifestation({
      id: 3,
      tagId: specialTag.id,
      tagName: specialTag.tagName,
      valueScalar: 1,
      targetType: "single",
      awakenerId: 1,
    }),
  ];
  const ownerValues = new Map<string, Map<number, number>>();
  const hop = applyAllTentacleAttackHop({
    ownerValues,
    appliedManifestations: applied,
    tagsById: baseTags,
    awakenersById,
  });
  assert(hop.generatePool === 2, `generatePool 2 (got ${hop.generatePool})`);
  assert(hop.steps.length >= 2, "hop emits pool + conversion steps");
  assert(hop.synthetics.length === 1, "one synthetic tentacle");
  assert(hop.synthetics[0]!.targetType === "single", "inherits single target_type");
  assert(hop.synthetics[0]!.valueScalar === 2, "added 2×1=2");
  const ownerTentacle =
    ownerValues.get("awakener:1")?.get(ATTACKER_TENTACLE_TAG_ID) ?? 0;
  assert(ownerTentacle === 2, `owner Tentacle +2 (got ${ownerTentacle})`);
}

console.log("\nUnit — mult 0 skipped");
{
  const awakener = makeAwakener({ id: 1 });
  const awakenersById = buildAwakenersById([awakener]);
  const applied = [
    makeManifestation({
      id: 1,
      tagId: generateTempTag.id,
      tagName: generateTempTag.tagName,
      valueScalar: 1,
    }),
    makeManifestation({
      id: 2,
      tagId: specialTag.id,
      tagName: specialTag.tagName,
      valueScalar: 0,
      awakenerId: 1,
    }),
  ];
  const ownerValues = new Map<string, Map<number, number>>();
  const hop = applyAllTentacleAttackHop({
    ownerValues,
    appliedManifestations: applied,
    tagsById: baseTags,
    awakenersById,
  });
  assert(hop.synthetics.length === 0, "mult 0 → no synthetics");
  assert(
    (ownerValues.get("awakener:1")?.get(ATTACKER_TENTACLE_TAG_ID) ?? 0) === 0,
    "mult 0 → no owner tentacle",
  );
}

console.log("\nUnit — generatePool 0 → no steps");
{
  const awakener = makeAwakener({ id: 1 });
  const awakenersById = buildAwakenersById([awakener]);
  const applied = [
    makeManifestation({
      id: 1,
      tagId: specialTag.id,
      tagName: specialTag.tagName,
      valueScalar: 1,
      awakenerId: 1,
    }),
  ];
  const ownerValues = new Map<string, Map<number, number>>();
  const hop = applyAllTentacleAttackHop({
    ownerValues,
    appliedManifestations: applied,
    tagsById: baseTags,
    awakenersById,
  });
  assert(hop.generatePool === 0, "empty generate pool");
  assert(hop.steps.length === 0, "no hop steps when pool is 0");
}

console.log("\nUnit — target_type aoe vs single");
{
  const awakener = makeAwakener({ id: 1 });
  const awakenersById = buildAwakenersById([awakener]);
  for (const targetType of ["aoe", "single"] as const) {
    const applied = [
      makeManifestation({
        id: 1,
        tagId: generateTempTag.id,
        tagName: generateTempTag.tagName,
        valueScalar: 1,
      }),
      makeManifestation({
        id: 2,
        tagId: specialTag.id,
        tagName: specialTag.tagName,
        valueScalar: 1,
        targetType,
        awakenerId: 1,
      }),
    ];
    const ownerValues = new Map<string, Map<number, number>>();
    const hop = applyAllTentacleAttackHop({
      ownerValues,
      appliedManifestations: applied,
      tagsById: baseTags,
      awakenersById,
    });
    assert(
      hop.synthetics[0]!.targetType === targetType,
      `synthetic targetType=${targetType}`,
    );
  }
}

console.log("\nIntegration — Generate + Special mult 1 doubles tentacle portion");
{
  const awakener = makeAwakener({ id: 1 });
  const core = [
    makeManifestation({
      id: 1,
      tagId: generateTempTag.id,
      tagName: generateTempTag.tagName,
      valueScalar: 1,
      targetType: "aoe",
    }),
    makeManifestation({
      id: 2,
      tagId: generatePermTag.id,
      tagName: generatePermTag.tagName,
      valueScalar: 1,
      targetType: "aoe",
    }),
  ];
  const withSpecialManifests = withMinimalTdu([
    ...core,
    makeManifestation({
      id: 3,
      tagId: specialTag.id,
      tagName: specialTag.tagName,
      valueScalar: 1,
      targetType: "single",
      awakenerId: 1,
      sourceType: "talent",
    }),
  ]);
  const withoutSpecialManifests = withMinimalTdu(core);
  const withSpecial = applyInteractions({
    manifestations: withSpecialManifests,
    appliedManifestations: withSpecialManifests,
    defaultInteractions: [generatePermToTentacle, generateTempToTentacle],
    tagsById: baseTags,
    awakenersById: buildAwakenersById([awakener]),
  });
  const withoutSpecial = applyInteractions({
    manifestations: withoutSpecialManifests,
    appliedManifestations: withoutSpecialManifests,
    defaultInteractions: [generatePermToTentacle, generateTempToTentacle],
    tagsById: baseTags,
    awakenersById: buildAwakenersById([awakener]),
  });

  const withTotal = withSpecial.totalsByTagId.get(tentacleTag.id) ?? 0;
  const withoutTotal = withoutSpecial.totalsByTagId.get(tentacleTag.id) ?? 0;
  assert(withoutTotal === 2, `Phase 1 create only: Tentacle 2 (got ${withoutTotal})`);
  assert(withTotal === 4, `Phase 1 + hop: Tentacle 4 (got ${withTotal})`);
  assert(
    withSpecial.steps.some(
      (s) =>
        s.kind === "special" &&
        s.label === "Special.All Tentacle Attack → Tentacle",
    ),
    "integration emits Special hop step",
  );
}

console.log("\nIntegration — no Special ATM");
{
  const awakener = makeAwakener({ id: 1 });
  const manifests = withMinimalTdu([
    makeManifestation({
      id: 1,
      tagId: generateTempTag.id,
      tagName: generateTempTag.tagName,
      valueScalar: 1,
    }),
    makeManifestation({
      id: 2,
      tagId: generatePermTag.id,
      tagName: generatePermTag.tagName,
      valueScalar: 1,
    }),
  ]);
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [generatePermToTentacle, generateTempToTentacle],
    tagsById: baseTags,
    awakenersById: buildAwakenersById([awakener]),
  });
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 2,
    "no Special → only Phase 1 create",
  );
  assert(
    !result.steps.some(
      (s) =>
        s.kind === "special" &&
        s.label.startsWith("Special.All Tentacle Attack"),
    ),
    "no Special hop steps",
  );
}

console.log("\nAll Special.All Tentacle Attack smoke tests passed.");
