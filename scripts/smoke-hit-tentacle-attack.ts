/**
 * Phase 3d + 3e smoke — Hit = Tentacle Attack and Tentacle TDU pool.
 * Run: npx tsx scripts/smoke-hit-tentacle-attack.ts
 */
import { applyInteractions } from "../src/lib/path-carver/apply-interactions";
import { manifestationHitCountKey } from "../src/lib/path-carver/copy-instances";
import { buildAwakenersById } from "../src/lib/path-carver/effective-value-scalar";
import {
  ATTACKER_ACTIVE_DAMAGE_TAG_ID,
  ATTACKER_POISON_FIXED_TAG_ID,
  ATTACKER_TENTACLE_TAG_ID,
  SPECIAL_HIT_TENTACLE_ATTACK_TAG_ID,
  SPECIAL_TENTACLE_HIT_POISON_TAG_ID,
  SUPPORT_TENTACLE_DAMAGE_UP_FIXED_TAG_ID,
  SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID,
  SUPPORT_UNIQUE_TENTACLE_DAMAGE_UP_TAG_ID,
  TENTACLE_TDU_FAMILY_POOL_LABEL,
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
    mathOperation: DefaultInteraction["mathOperation"];
  },
): DefaultInteraction {
  return {
    exclusionTagId: null,
    exclusionTagName: null,
    defaultFactor: 1,
    buffTargetTypeRestriction: null,
    createsBase: false,
    amplifiesSubject: true,
    ...partial,
  };
}

const hitTag = makeTag(SPECIAL_HIT_TENTACLE_ATTACK_TAG_ID, "Special.Hit = Tentacle Attack", {
  isPercent: true,
  isAdditive: true,
  layer: null,
});
const tentacleHitPoisonTag = makeTag(
  SPECIAL_TENTACLE_HIT_POISON_TAG_ID,
  "Special.Tentacle Hit = Poison",
  {
    layer: null,
  },
);
const tentacleTag = makeTag(ATTACKER_TENTACLE_TAG_ID, "Attacker.Tentacle", {
  layer: "pre_add",
});
const poisonFixedTag = makeTag(ATTACKER_POISON_FIXED_TAG_ID, "Attacker.Poison.Fixed", {
  layer: "pre_add",
});
const activeTag = makeTag(ATTACKER_ACTIVE_DAMAGE_TAG_ID, "Attacker.Active Damage", {
  layer: "pre_add",
});
const strikeTag = makeTag(43, "Attacker.Active Damage.Strike", { layer: "pre_add" });
const tduTag = makeTag(SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID, "Support.Tentacle Damage Up");
const tduFixedTag = makeTag(
  SUPPORT_TENTACLE_DAMAGE_UP_FIXED_TAG_ID,
  "Support.Tentacle Damage Up.Fixed",
);
const uniqueTduTag = makeTag(
  SUPPORT_UNIQUE_TENTACLE_DAMAGE_UP_TAG_ID,
  "Support.Unique Tentacle Damage Up",
);
const multiplyTag = makeTag(150, "Support.Multiply Tentacle Damage", {
  isPercent: true,
  isAdditive: false,
});
const generateTag = makeTag(58, "Support.Generate Permanent Tentacle", {
  layer: null,
});
const generateTempTag = makeTag(57, "Support.Generate Temporary Tentacle", {
  layer: null,
});
const strUpTag = makeTag(31, "Support.STR Up");
const vulnTag = makeTag(200, "Support.Debuff.Tentacle Vulnerability", {
  isPercent: true,
});
const poisonAmpTag = makeTag(210, "Support.Increase Gain.Poison.Fixed", {
  isPercent: true,
});
const conversionTag = makeTag(300, "Special.Corrosion Conversion");
const debuffTag = makeTag(301, "Support.Debuff.Corrosion");
const corrosionDmgTag = makeTag(302, "Attacker.Corrosion Damage");

const multiplyToTdu = makeInteraction({
  id: 90,
  modifierTagId: multiplyTag.id,
  modifierTagName: multiplyTag.tagName,
  targetTagId: tduTag.id,
  targetTagName: tduTag.tagName,
  mathOperation: "multiply",
});
const generateToTentacle = makeInteraction({
  id: 91,
  modifierTagId: generateTag.id,
  modifierTagName: generateTag.tagName,
  targetTagId: tentacleTag.id,
  targetTagName: tentacleTag.tagName,
  mathOperation: "add_scaled",
  createsBase: true,
  amplifiesSubject: false,
});
const generateTempToTentacle = makeInteraction({
  id: 92,
  modifierTagId: generateTempTag.id,
  modifierTagName: generateTempTag.tagName,
  targetTagId: tentacleTag.id,
  targetTagName: tentacleTag.tagName,
  mathOperation: "add_scaled",
  createsBase: true,
  amplifiesSubject: false,
});
const strToUnique = makeInteraction({
  id: 16,
  modifierTagId: strUpTag.id,
  modifierTagName: strUpTag.tagName,
  targetTagId: uniqueTduTag.id,
  targetTagName: uniqueTduTag.tagName,
  mathOperation: "add_scaled",
  defaultFactor: 0.5,
  createsBase: true,
  amplifiesSubject: false,
});
const vulnToTentacle = makeInteraction({
  id: 73,
  modifierTagId: vulnTag.id,
  modifierTagName: vulnTag.tagName,
  targetTagId: tentacleTag.id,
  targetTagName: tentacleTag.tagName,
  mathOperation: "multiply_one_plus",
});
const poisonAmpToFixed = makeInteraction({
  id: 211,
  modifierTagId: poisonAmpTag.id,
  modifierTagName: poisonAmpTag.tagName,
  targetTagId: poisonFixedTag.id,
  targetTagName: poisonFixedTag.tagName,
  mathOperation: "multiply_one_plus",
});

const coreTags: Record<number, Tag> = {
  [hitTag.id]: hitTag,
  [tentacleHitPoisonTag.id]: tentacleHitPoisonTag,
  [tentacleTag.id]: tentacleTag,
  [poisonFixedTag.id]: poisonFixedTag,
  [activeTag.id]: activeTag,
  [strikeTag.id]: strikeTag,
  [tduTag.id]: tduTag,
  [tduFixedTag.id]: tduFixedTag,
  [uniqueTduTag.id]: uniqueTduTag,
};

function hitMap(manifests: Manifestation[], hitCount: number): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of manifests) {
    if (m.tagName.startsWith("Attacker.Active Damage")) {
      map.set(manifestationHitCountKey(m), hitCount);
    }
  }
  return map;
}

console.log("Part A — 3 hits × Hit 0.5 × TDU 116 = 174");
{
  const awakener = makeAwakener({ id: 1 });
  const active = makeManifestation({
    id: 1,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 0.5,
    instanceCount: 3,
  });
  const hit = makeManifestation({
    id: 2,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 0.5,
    targetType: "aoe",
  });
  const tdu = makeManifestation({
    id: 3,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 116,
    targetType: "aoe",
  });
  const manifests = [active, hit, tdu];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById: coreTags,
    awakenersById: buildAwakenersById([awakener]),
    hitCountByManifestationKey: hitMap(manifests, 3),
  });
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 174,
    `Tentacle 3×0.5×116=174 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
  const special = result.steps.find(
    (s) => s.kind === "special" && s.label === "Special.Hit = Tentacle Attack",
  );
  assert(special != null, "special step recorded");
  const tduOps = result.steps.filter(
    (s) =>
      s.kind === "op" &&
      s.tagName === tentacleTag.tagName &&
      s.modifierTagName === TENTACLE_TDU_FAMILY_POOL_LABEL,
  );
  assert(
    tduOps.length > 0 && tduOps.every((s) => s.kind === "op" && s.modifierValue === 116 && s.factor === 1),
    "TDU debug mod is pool 116 (not product 174)",
  );
  const hitOps = result.steps.filter(
    (s) =>
      s.kind === "op" &&
      s.tagName === tentacleTag.tagName &&
      s.modifierTagName === hitTag.tagName,
  );
  assert(
    hitOps.length === 1 &&
      hitOps[0]?.kind === "op" &&
      hitOps[0].modifierValue === 0.5 &&
      hitOps[0].factor === 1 &&
      hitOps[0].before === 348 &&
      hitOps[0].after === 174,
    "Hit debug mod is 0.5 after TDU 348 → 174",
  );
}

console.log("Part B — 10× hitCount 1 vs 1× hitCount 10");
{
  const awakener = makeAwakener({ id: 1 });
  const hit = makeManifestation({
    id: 100,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 0.5,
    targetType: "aoe",
  });
  const tdu = makeManifestation({
    id: 101,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 116,
    targetType: "aoe",
  });
  const ten = Array.from({ length: 10 }, (_, i) =>
    makeManifestation({
      id: i + 1,
      tagId: activeTag.id,
      tagName: activeTag.tagName,
      valueScalar: 0.2,
    }),
  );
  const one = [
    makeManifestation({
      id: 1,
      tagId: activeTag.id,
      tagName: activeTag.tagName,
      valueScalar: 0.2,
      instanceCount: 10,
    }),
  ];
  const mapTen = new Map<string, number>();
  for (const m of ten) mapTen.set(manifestationHitCountKey(m), 1);
  const mapOne = new Map([[manifestationHitCountKey(one[0]!), 10]]);
  const left = applyInteractions({
    manifestations: [...ten, hit, tdu],
    appliedManifestations: [...ten, hit, tdu],
    defaultInteractions: [],
    tagsById: coreTags,
    awakenersById: buildAwakenersById([awakener]),
    hitCountByManifestationKey: mapTen,
  });
  const right = applyInteractions({
    manifestations: [...one, hit, tdu],
    appliedManifestations: [...one, hit, tdu],
    defaultInteractions: [],
    tagsById: coreTags,
    awakenersById: buildAwakenersById([awakener]),
    hitCountByManifestationKey: mapOne,
  });
  assert(
    left.totalsByTagId.get(tentacleTag.id) ===
      right.totalsByTagId.get(tentacleTag.id),
    `10×1 === 1×10 (${left.totalsByTagId.get(tentacleTag.id)})`,
  );
  assert(
    (left.totalsByTagId.get(tentacleTag.id) ?? 0) === 580,
    `10×0.5×116=580 (got ${left.totalsByTagId.get(tentacleTag.id)})`,
  );
}

console.log("Part C — Hit self skips teammate Active Damage");
{
  const a1 = makeAwakener({ id: 1, name: "Aurita" });
  const a2 = makeAwakener({ id: 2, name: "Teammate" });
  const auritaHit = makeManifestation({
    id: 1,
    awakenerId: 1,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 1,
    targetType: "self",
  });
  const auritaDmg = makeManifestation({
    id: 2,
    awakenerId: 1,
    slotIndex: 0,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 0.4,
  });
  const teammateDmg = makeManifestation({
    id: 3,
    awakenerId: 2,
    slotIndex: 1,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 0.4,
  });
  const tdu = makeManifestation({
    id: 4,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 100,
    targetType: "aoe",
  });
  const manifests = [auritaHit, auritaDmg, teammateDmg, tdu];
  const map = new Map<string, number>([
    [manifestationHitCountKey(auritaDmg), 2],
    [manifestationHitCountKey(teammateDmg), 5],
  ]);
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById: coreTags,
    awakenersById: buildAwakenersById([a1, a2]),
    hitCountByManifestationKey: map,
  });
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 200,
    `self Hit: only Aurita 2×1×100=200 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
}

console.log("Part D — Unique TDU self only that owner");
{
  const a1 = makeAwakener({ id: 1 });
  const a2 = makeAwakener({ id: 2 });
  const hit = makeManifestation({
    id: 1,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 1,
    targetType: "aoe",
  });
  const dmg1 = makeManifestation({
    id: 2,
    awakenerId: 1,
    slotIndex: 0,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 0.3,
  });
  const dmg2 = makeManifestation({
    id: 3,
    awakenerId: 2,
    slotIndex: 1,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 0.3,
  });
  const tdu = makeManifestation({
    id: 4,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 100,
    targetType: "aoe",
  });
  const unique = makeManifestation({
    id: 5,
    awakenerId: 1,
    tagId: uniqueTduTag.id,
    tagName: uniqueTduTag.tagName,
    valueScalar: 10,
    targetType: "self",
  });
  const manifests = [hit, dmg1, dmg2, tdu, unique];
  const map = new Map<string, number>([
    [manifestationHitCountKey(dmg1), 1],
    [manifestationHitCountKey(dmg2), 1],
  ]);
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById: coreTags,
    awakenersById: buildAwakenersById([a1, a2]),
    hitCountByManifestationKey: map,
  });
  // Alice 1×1×(100+10)=110; Bob 1×1×100=100; additive Tentacle 210
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 210,
    `Unique self: 110+100=210 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
}

console.log("Part E — TDU.Fixed in pool; Multiply chains onto TDU");
{
  const awakener = makeAwakener({ id: 1 });
  const active = makeManifestation({
    id: 1,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 0.2,
  });
  const hit = makeManifestation({
    id: 2,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 1,
    targetType: "aoe",
  });
  const tdu = makeManifestation({
    id: 3,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 100,
    targetType: "aoe",
  });
  const fixed = makeManifestation({
    id: 4,
    tagId: tduFixedTag.id,
    tagName: tduFixedTag.tagName,
    valueScalar: 20,
    targetType: "aoe",
  });
  const multiply = makeManifestation({
    id: 5,
    tagId: multiplyTag.id,
    tagName: multiplyTag.tagName,
    valueScalar: 1.25,
    targetType: "aoe",
  });
  const manifests = [active, hit, tdu, fixed, multiply];
  const tagsById: Record<number, Tag> = {
    ...coreTags,
    [multiplyTag.id]: multiplyTag,
  };
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [multiplyToTdu],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
    hitCountByManifestationKey: hitMap(manifests, 1),
  });
  // Multiply targets TDU prefix (includes .Fixed): 100×1.25 + 20×1.25 = 150
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 150,
    `Fixed+Multiply pool 150 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
}

console.log("Part F — Generate Tentacle career vs Hit (shared TDU pool)");
{
  const awakener = makeAwakener({ id: 1 });
  const active = makeManifestation({
    id: 1,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 0.2,
  });
  const hit = makeManifestation({
    id: 2,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 0.5,
    targetType: "aoe",
  });
  const tdu = makeManifestation({
    id: 3,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 116,
    targetType: "aoe",
  });
  const generate = makeManifestation({
    id: 4,
    tagId: generateTag.id,
    tagName: generateTag.tagName,
    valueScalar: 1,
    targetType: "aoe",
  });
  const layerATentacle = makeManifestation({
    id: 5,
    tagId: tentacleTag.id,
    tagName: tentacleTag.tagName,
    valueScalar: 1,
    sourceType: null,
    targetType: "aoe",
  });
  const manifests = [active, hit, tdu, generate, layerATentacle];
  const tagsById: Record<number, Tag> = {
    ...coreTags,
    [generateTag.id]: generateTag,
  };
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [generateToTentacle],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
    hitCountByManifestationKey: hitMap(manifests, 3),
  });
  // Layer A Tentacle 1×116 + Hit 3×0.5×116=174 on awakener:1 → 290
  // Generate invent +1 on posse → 1×116=116
  // Total 406
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 406,
    `Generate+LayerA+Hit 116+290=406 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
}

console.log("Part G — Corrosion capacity includes Hit Tentacle");
{
  const awakener = makeAwakener({ id: 1 });
  const active = makeManifestation({
    id: 1,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 10,
  });
  const hit = makeManifestation({
    id: 2,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 0.5,
    targetType: "aoe",
  });
  const tdu = makeManifestation({
    id: 3,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 116,
    targetType: "aoe",
  });
  const conversion = makeManifestation({
    id: 4,
    tagId: conversionTag.id,
    tagName: conversionTag.tagName,
    valueScalar: 1,
  });
  const debuff = makeManifestation({
    id: 5,
    tagId: debuffTag.id,
    tagName: debuffTag.tagName,
    valueScalar: 1000,
  });
  const manifests = [active, hit, tdu, conversion, debuff];
  const tagsById: Record<number, Tag> = {
    ...coreTags,
    [conversionTag.id]: conversionTag,
    [debuffTag.id]: debuffTag,
    [corrosionDmgTag.id]: corrosionDmgTag,
  };
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
    hitCountByManifestationKey: hitMap(manifests, 3),
  });
  // Hit Tentacle 174; Active Damage 10 × hitCount 3 = 30; capacity 204; damage 612
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 174,
    `Tentacle still 174 after conversion (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
  assert(
    (result.totalsByTagId.get(corrosionDmgTag.id) ?? 0) === 612,
    `Corrosion damage 204×3=612 (got ${result.totalsByTagId.get(corrosionDmgTag.id)})`,
  );
}

console.log("Part H — Active Damage.Strike descendant counts");
{
  const awakener = makeAwakener({ id: 1 });
  const strike = makeManifestation({
    id: 1,
    tagId: strikeTag.id,
    tagName: strikeTag.tagName,
    valueScalar: 0.2,
  });
  const hit = makeManifestation({
    id: 2,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 1,
    targetType: "aoe",
  });
  const tdu = makeManifestation({
    id: 3,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 50,
    targetType: "aoe",
  });
  const manifests = [strike, hit, tdu];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById: coreTags,
    awakenersById: buildAwakenersById([awakener]),
    hitCountByManifestationKey: new Map([
      [manifestationHitCountKey(strike), 2],
    ]),
  });
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 100,
    `Strike hits 2×1×50=100 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
}

console.log("Part I — Vulnerability still applies after product");
{
  const awakener = makeAwakener({ id: 1 });
  const active = makeManifestation({
    id: 1,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 0.2,
  });
  const hit = makeManifestation({
    id: 2,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 1,
    targetType: "aoe",
  });
  const tdu = makeManifestation({
    id: 3,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 100,
    targetType: "aoe",
  });
  const vuln = makeManifestation({
    id: 4,
    tagId: vulnTag.id,
    tagName: vulnTag.tagName,
    valueScalar: 0.2,
    targetType: "aoe",
  });
  const manifests = [active, hit, tdu, vuln];
  const tagsById: Record<number, Tag> = {
    ...coreTags,
    [vulnTag.id]: vulnTag,
  };
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [vulnToTentacle],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
    hitCountByManifestationKey: hitMap(manifests, 1),
  });
  // product 100; × (1+0.2) = 120; ceil 120
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 120,
    `Vulnerability after product 120 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
}

console.log("Part J — non-applied Active Damage does not convert");
{
  const awakener = makeAwakener({ id: 1 });
  const appliedDmg = makeManifestation({
    id: 1,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 0.2,
  });
  const excludedDmg = makeManifestation({
    id: 99,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 0.9,
  });
  const hit = makeManifestation({
    id: 2,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 1,
    targetType: "aoe",
  });
  const tdu = makeManifestation({
    id: 3,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 40,
    targetType: "aoe",
  });
  const applied = [appliedDmg, hit, tdu];
  const result = applyInteractions({
    manifestations: [...applied, excludedDmg],
    appliedManifestations: applied,
    defaultInteractions: [],
    tagsById: coreTags,
    awakenersById: buildAwakenersById([awakener]),
    hitCountByManifestationKey: new Map([
      [manifestationHitCountKey(appliedDmg), 1],
      [manifestationHitCountKey(excludedDmg), 8],
    ]),
  });
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 40,
    `only applied hits 1×40=40 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
}

console.log("Part K — Generate Temporary equals Permanent (1 × TDU 116)");
{
  const awakener = makeAwakener({ id: 1 });
  const tdu = makeManifestation({
    id: 1,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 116,
    targetType: "aoe",
  });
  function runGenerate(
    genTag: Tag,
    interaction: DefaultInteraction,
  ): number {
    const generate = makeManifestation({
      id: 2,
      tagId: genTag.id,
      tagName: genTag.tagName,
      valueScalar: 1,
      targetType: "aoe",
    });
    const manifests = [tdu, generate];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: [interaction],
      tagsById: { ...coreTags, [genTag.id]: genTag },
      awakenersById: buildAwakenersById([awakener]),
    });
    return result.totalsByTagId.get(tentacleTag.id) ?? 0;
  }
  const permanent = runGenerate(generateTag, generateToTentacle);
  const temporary = runGenerate(generateTempTag, generateTempToTentacle);
  assert(permanent === 116, `Permanent Generate 1×116=116 (got ${permanent})`);
  assert(temporary === 116, `Temporary Generate 1×116=116 (got ${temporary})`);
}

console.log("Part L — RTM Tentacle 4 × TDU 116 = 464");
{
  const awakener = makeAwakener({ id: 1 });
  const rtm = makeManifestation({
    id: 24,
    sourceKind: "realm",
    awakenerId: null,
    slotIndex: null,
    sourceName: "aequor",
    tagId: tentacleTag.id,
    tagName: tentacleTag.tagName,
    valueScalar: 4,
  });
  const tdu = makeManifestation({
    id: 3,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 116,
    targetType: "aoe",
  });
  const manifests = [rtm, tdu];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById: coreTags,
    awakenersById: buildAwakenersById([awakener]),
  });
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 464,
    `RTM 4×116=464 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
}

console.log("Part M — Unique + TDU + Fixed add then multiply");
{
  const awakener = makeAwakener({ id: 1 });
  const rtm = makeManifestation({
    id: 24,
    sourceKind: "realm",
    awakenerId: null,
    slotIndex: null,
    sourceName: "aequor",
    tagId: tentacleTag.id,
    tagName: tentacleTag.tagName,
    valueScalar: 1,
  });
  const tdu = makeManifestation({
    id: 1,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 100,
    targetType: "aoe",
  });
  const unique = makeManifestation({
    id: 2,
    tagId: uniqueTduTag.id,
    tagName: uniqueTduTag.tagName,
    valueScalar: 10,
    targetType: "aoe",
  });
  const fixed = makeManifestation({
    id: 3,
    tagId: tduFixedTag.id,
    tagName: tduFixedTag.tagName,
    valueScalar: 20,
    targetType: "aoe",
  });
  const manifests = [rtm, tdu, unique, fixed];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById: coreTags,
    awakenersById: buildAwakenersById([awakener]),
  });
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 130,
    `1×(10+100+20)=130 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
}

console.log("Part N — STR Up invents Unique TDU into the pool");
{
  const awakener = makeAwakener({ id: 1 });
  const str = makeManifestation({
    id: 1,
    tagId: strUpTag.id,
    tagName: strUpTag.tagName,
    valueScalar: 100,
    targetType: "aoe",
  });
  const tdu = makeManifestation({
    id: 2,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 10,
    targetType: "aoe",
  });
  const tentacle = makeManifestation({
    id: 3,
    tagId: tentacleTag.id,
    tagName: tentacleTag.tagName,
    valueScalar: 2,
    sourceType: null,
    targetType: "aoe",
  });
  const manifests = [str, tdu, tentacle];
  const tagsById: Record<number, Tag> = {
    ...coreTags,
    [strUpTag.id]: strUpTag,
  };
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [strToUnique],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  assert(
    (result.totalsByTagId.get(uniqueTduTag.id) ?? 0) === 50,
    `STR 100×0.5 invents Unique 50 (got ${result.totalsByTagId.get(uniqueTduTag.id)})`,
  );
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 120,
    `Tentacle 2×(10+50)=120 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
}

console.log("Part O — RTM Vulnerability after TDU pool");
{
  const awakener = makeAwakener({ id: 1 });
  const rtm = makeManifestation({
    id: 24,
    sourceKind: "realm",
    awakenerId: null,
    slotIndex: null,
    sourceName: "aequor",
    tagId: tentacleTag.id,
    tagName: tentacleTag.tagName,
    valueScalar: 4,
  });
  const tdu = makeManifestation({
    id: 3,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 116,
    targetType: "aoe",
  });
  const vuln = makeManifestation({
    id: 4,
    tagId: vulnTag.id,
    tagName: vulnTag.tagName,
    valueScalar: 0.25,
    targetType: "aoe",
  });
  const manifests = [rtm, tdu, vuln];
  const tagsById: Record<number, Tag> = {
    ...coreTags,
    [vulnTag.id]: vulnTag,
  };
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [vulnToTentacle],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  // 4×116=464; ×(1+0.25)=580
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 580,
    `RTM Vulnerability after pool 580 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
}

console.log("Part P — Aurita realm Hit 0.5 + ATM Hit 1 self; teammate skips ATM");
{
  const a1 = makeAwakener({ id: 1, name: "Aurita" });
  const a2 = makeAwakener({ id: 2, name: "Teammate" });
  const realmHit = makeManifestation({
    id: 10,
    sourceKind: "realm",
    awakenerId: null,
    slotIndex: null,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 0.5,
    targetType: "aoe",
  });
  const auritaHit = makeManifestation({
    id: 11,
    awakenerId: 1,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 1,
    targetType: "self",
  });
  const auritaDmg = makeManifestation({
    id: 12,
    awakenerId: 1,
    slotIndex: 0,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 0.4,
  });
  const teammateDmg = makeManifestation({
    id: 13,
    awakenerId: 2,
    slotIndex: 1,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 0.4,
  });
  const tdu = makeManifestation({
    id: 14,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 100,
    targetType: "aoe",
  });
  const solo = applyInteractions({
    manifestations: [realmHit, auritaHit, auritaDmg, tdu],
    appliedManifestations: [realmHit, auritaHit, auritaDmg, tdu],
    defaultInteractions: [],
    tagsById: coreTags,
    awakenersById: buildAwakenersById([a1]),
    hitCountByManifestationKey: new Map([
      [manifestationHitCountKey(auritaDmg), 1],
    ]),
  });
  assert(
    (solo.totalsByTagId.get(tentacleTag.id) ?? 0) === 150,
    `Aurita solo 50+100=150 (got ${solo.totalsByTagId.get(tentacleTag.id)})`,
  );
  assert(
    (solo.totalsByTagId.get(hitTag.id) ?? 0) === 1.5,
    `Hit tag total 0.5+1=1.5 (got ${solo.totalsByTagId.get(hitTag.id)})`,
  );
  const tduOps = solo.steps.filter(
    (s) =>
      s.kind === "op" &&
      s.tagName === tentacleTag.tagName &&
      s.modifierTagName === TENTACLE_TDU_FAMILY_POOL_LABEL,
  );
  assert(
    tduOps.length === 2 &&
      tduOps.every((s) => s.kind === "op" && s.modifierValue === 100 && s.factor === 1),
    "TDU debug mod is pool 100 on both Hit channels (not product 50)",
  );
  const hitOps = solo.steps.filter(
    (s) =>
      s.kind === "op" &&
      s.tagName === tentacleTag.tagName &&
      s.modifierTagName === hitTag.tagName,
  );
  assert(
    hitOps.length === 1 &&
      hitOps[0]?.kind === "op" &&
      hitOps[0].modifierValue === 0.5 &&
      hitOps[0].after === 50,
    "realm Hit debug mod is 0.5; ATM Hit=1 has no Hit factor step",
  );

  const both = applyInteractions({
    manifestations: [realmHit, auritaHit, auritaDmg, teammateDmg, tdu],
    appliedManifestations: [realmHit, auritaHit, auritaDmg, teammateDmg, tdu],
    defaultInteractions: [],
    tagsById: coreTags,
    awakenersById: buildAwakenersById([a1, a2]),
    hitCountByManifestationKey: new Map([
      [manifestationHitCountKey(auritaDmg), 1],
      [manifestationHitCountKey(teammateDmg), 1],
    ]),
  });
  assert(
    (both.totalsByTagId.get(tentacleTag.id) ?? 0) === 200,
    `teammate only realm 50; total 150+50=200 (got ${both.totalsByTagId.get(tentacleTag.id)})`,
  );
}

console.log("Part Q — two Hit ATMs ceil per channel (0.4+0.4)");
{
  const awakener = makeAwakener({ id: 1 });
  const active = makeManifestation({
    id: 1,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 0.2,
  });
  const hitA = makeManifestation({
    id: 2,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 0.4,
    targetType: "aoe",
  });
  const hitB = makeManifestation({
    id: 3,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 0.4,
    targetType: "aoe",
  });
  const tdu = makeManifestation({
    id: 4,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 1,
    targetType: "aoe",
  });
  const manifests = [active, hitA, hitB, tdu];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById: coreTags,
    awakenersById: buildAwakenersById([awakener]),
    hitCountByManifestationKey: hitMap(manifests, 1),
  });
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 2,
    `two ATM channels ceil(0.4)+ceil(0.4)=2 not ceil(0.8)=1 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
}

console.log("Part R — two realm Hit rows sum into one channel");
{
  const awakener = makeAwakener({ id: 1 });
  const active = makeManifestation({
    id: 1,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 0.2,
  });
  const hitA = makeManifestation({
    id: 2,
    sourceKind: "realm",
    awakenerId: null,
    slotIndex: null,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 0.4,
    targetType: "aoe",
  });
  const hitB = makeManifestation({
    id: 3,
    sourceKind: "realm",
    awakenerId: null,
    slotIndex: null,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 0.4,
    targetType: "aoe",
  });
  const tdu = makeManifestation({
    id: 4,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 1,
    targetType: "aoe",
  });
  const manifests = [active, hitA, hitB, tdu];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById: coreTags,
    awakenersById: buildAwakenersById([awakener]),
    hitCountByManifestationKey: hitMap(manifests, 1),
  });
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 1,
    `realm 0.4+0.4 one channel ceil(0.8)=1 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
}

console.log("Part S — covenant Hit is not summed into realm factor");
{
  const awakener = makeAwakener({ id: 1 });
  const active = makeManifestation({
    id: 1,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 0.2,
  });
  const realmHit = makeManifestation({
    id: 2,
    sourceKind: "realm",
    awakenerId: null,
    slotIndex: null,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 0.4,
    targetType: "aoe",
  });
  const covHit = makeManifestation({
    id: 3,
    sourceKind: "covenant",
    awakenerId: null,
    slotIndex: null,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 0.4,
    targetType: "aoe",
  });
  const tdu = makeManifestation({
    id: 4,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 1,
    targetType: "aoe",
  });
  const manifests = [active, realmHit, covHit, tdu];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById: coreTags,
    awakenersById: buildAwakenersById([awakener]),
    hitCountByManifestationKey: hitMap(manifests, 1),
  });
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 2,
    `realm 0.4 + covenant 0.4 two channels =2 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
}

console.log("Part T — finalized TDU pool uses base TDU + Fixed + unique_scaling");
{
  const awakener = makeAwakener({ id: 133, atk: 200, aliemusRegen: 10 });
  const tduBase = makeManifestation({
    id: 1,
    awakenerId: 133,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 49,
    targetType: "aoe",
  });
  const jellyfishFixed = makeManifestation({
    id: 2,
    awakenerId: 133,
    tagId: tduFixedTag.id,
    tagName: tduFixedTag.tagName,
    valueScalar: 0.24,
    dependencyStat: "atk",
    targetType: "aoe",
  });
  const talentFixed = makeManifestation({
    id: 3,
    awakenerId: 133,
    tagId: tduFixedTag.id,
    tagName: tduFixedTag.tagName,
    valueScalar: 0.01,
    dependencyStat: "atk",
    targetType: "aoe",
    metadata: "Talent Fixed with aliemus unique_scaling",
    interactionOverrides: [
      {
        id: 1,
        mode: "unique_scaling",
        modifierTagId: null,
        modifierTagName: "Unknown",
        targetTagId: null,
        targetTagName: null,
        dependencyStat: "aliemus_regen",
        mathOperation: "multiply",
        valueScalar: 1,
        targetType: "aoe",
        layer: "add",
        isDisabled: false,
      },
    ],
  });
  const rtmTentacle = makeManifestation({
    id: 4,
    sourceKind: "realm",
    awakenerId: null,
    slotIndex: null,
    sourceName: "aequor",
    tagId: tentacleTag.id,
    tagName: tentacleTag.tagName,
    valueScalar: 1,
  });
  const manifests = [tduBase, jellyfishFixed, talentFixed, rtmTentacle];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById: {
      ...coreTags,
      [tduFixedTag.id]: tduFixedTag,
    },
    awakenersById: buildAwakenersById([awakener]),
  });
  // Fixed: ceil(0.24×200)=48; talent base ceil(0.01×200)=2 × aliemus_regen 10 = 20
  const expectedPool = 49 + 48 + 20;
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === expectedPool,
    `1×(${expectedPool})=${expectedPool} (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
  const poolOps = result.steps.filter(
    (s) =>
      s.kind === "op" &&
      s.tagName === tentacleTag.tagName &&
      s.modifierTagName === TENTACLE_TDU_FAMILY_POOL_LABEL,
  );
  assert(
    poolOps.length === 1 &&
      poolOps[0]?.kind === "op" &&
      poolOps[0].modifierValue === expectedPool,
    `hop 4d pool mod is full TDU family ${expectedPool} (not TDU-only 49)`,
  );
  const special = result.steps.find(
    (s) => s.kind === "special" && s.label === "Tentacle TDU pool",
  );
  assert(
    special != null &&
      special.kind === "special" &&
      special.detail.includes(`pool=${expectedPool}`) &&
      special.detail.includes("Fixed=68"),
    "special step shows pool breakdown with Fixed contributions",
  );
}

console.log("Part U — finalized TDU pool then Vulnerability applies after pool");
{
  const awakener = makeAwakener({ id: 133, atk: 200, aliemusRegen: 10 });
  const tduBase = makeManifestation({
    id: 1,
    awakenerId: 133,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 49,
    targetType: "aoe",
  });
  const jellyfishFixed = makeManifestation({
    id: 2,
    awakenerId: 133,
    tagId: tduFixedTag.id,
    tagName: tduFixedTag.tagName,
    valueScalar: 0.24,
    dependencyStat: "atk",
    targetType: "aoe",
  });
  const talentFixed = makeManifestation({
    id: 3,
    awakenerId: 133,
    tagId: tduFixedTag.id,
    tagName: tduFixedTag.tagName,
    valueScalar: 0.01,
    dependencyStat: "atk",
    targetType: "aoe",
    interactionOverrides: [
      {
        id: 1,
        mode: "unique_scaling",
        modifierTagId: null,
        modifierTagName: "Unknown",
        targetTagId: null,
        targetTagName: null,
        dependencyStat: "aliemus_regen",
        mathOperation: "multiply",
        valueScalar: 1,
        targetType: "aoe",
        layer: "add",
        isDisabled: false,
      },
    ],
  });
  const vuln = makeManifestation({
    id: 4,
    tagId: vulnTag.id,
    tagName: vulnTag.tagName,
    valueScalar: 0.2,
    targetType: "aoe",
  });
  const rtmTentacle = makeManifestation({
    id: 5,
    sourceKind: "realm",
    awakenerId: null,
    slotIndex: null,
    sourceName: "aequor",
    tagId: tentacleTag.id,
    tagName: tentacleTag.tagName,
    valueScalar: 1,
  });
  const manifests = [tduBase, jellyfishFixed, talentFixed, vuln, rtmTentacle];
  const tagsById: Record<number, Tag> = {
    ...coreTags,
    [vulnTag.id]: vulnTag,
  };
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [vulnToTentacle],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  const expectedPool = 49 + 48 + 20;
  const expectedTotal = Math.ceil(expectedPool * 1.2);
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === expectedTotal,
    `1×${expectedPool} then Vulnerability => ${expectedTotal} (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
  const poolOp = result.steps.find(
    (s) =>
      s.kind === "op" &&
      s.tagName === tentacleTag.tagName &&
      s.modifierTagName === TENTACLE_TDU_FAMILY_POOL_LABEL &&
      s.modifierValue === expectedPool,
  );
  assert(poolOp != null, "pool op still uses finalized TDU family before Vulnerability");
  const vulnOp = result.steps.find(
    (s) =>
      s.kind === "op" &&
      s.tagName === tentacleTag.tagName &&
      s.modifierTagName === vulnTag.tagName &&
      s.before === expectedPool &&
      s.after === expectedTotal,
  );
  assert(vulnOp != null, "Vulnerability op applies to the pooled Tentacle synthetic");
}

console.log("Part O — Tentacle Hit Poison counts LayerA + RTM + Generate + Hit before TDU");
{
  const awakener = makeAwakener({ id: 1 });
  const active = makeManifestation({
    id: 1,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 0.2,
  });
  const hit = makeManifestation({
    id: 2,
    tagId: hitTag.id,
    tagName: hitTag.tagName,
    valueScalar: 0.5,
    targetType: "aoe",
  });
  const poison = makeManifestation({
    id: 3,
    tagId: tentacleHitPoisonTag.id,
    tagName: tentacleHitPoisonTag.tagName,
    valueScalar: 4,
    targetType: "aoe",
  });
  const tdu = makeManifestation({
    id: 4,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 100,
    targetType: "aoe",
  });
  const generate = makeManifestation({
    id: 5,
    tagId: generateTag.id,
    tagName: generateTag.tagName,
    valueScalar: 1,
    targetType: "aoe",
  });
  const layerATentacle = makeManifestation({
    id: 6,
    tagId: tentacleTag.id,
    tagName: tentacleTag.tagName,
    valueScalar: 2,
    sourceType: null,
    targetType: "aoe",
  });
  const rtmTentacle = makeManifestation({
    id: 7,
    sourceKind: "realm",
    awakenerId: null,
    slotIndex: null,
    sourceName: "aequor",
    tagId: tentacleTag.id,
    tagName: tentacleTag.tagName,
    valueScalar: 4,
    sourceType: null,
    targetType: "aoe",
  });
  const manifests = [active, hit, poison, tdu, generate, layerATentacle, rtmTentacle];
  const tagsById: Record<number, Tag> = {
    ...coreTags,
    [generateTag.id]: generateTag,
  };
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [generateToTentacle],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
    hitCountByManifestationKey: hitMap(manifests, 3),
  });
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 850,
    `Tentacle total 200+400+100+150=850 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
  assert(
    (result.totalsByTagId.get(poisonFixedTag.id) ?? 0) === 40,
    `Poison.Fixed uses raw attacks 5×4 + 4×4 + 1×4 = 40 (got ${result.totalsByTagId.get(poisonFixedTag.id)})`,
  );
  const poisonSpecial = result.steps.find(
    (s) => s.kind === "special" && s.label === tentacleHitPoisonTag.tagName,
  );
  assert(poisonSpecial != null, "tentacle poison special step recorded");
}

console.log("Part P — Tentacle Hit Poison self stays on owning awakener");
{
  const a1 = makeAwakener({ id: 1 });
  const a2 = makeAwakener({ id: 2 });
  const poisonSelf = makeManifestation({
    id: 1,
    awakenerId: 1,
    tagId: tentacleHitPoisonTag.id,
    tagName: tentacleHitPoisonTag.tagName,
    valueScalar: 3,
    targetType: "self",
  });
  const tentacle1 = makeManifestation({
    id: 2,
    awakenerId: 1,
    slotIndex: 0,
    tagId: tentacleTag.id,
    tagName: tentacleTag.tagName,
    valueScalar: 2,
    sourceType: null,
    targetType: "aoe",
  });
  const tentacle2 = makeManifestation({
    id: 3,
    awakenerId: 2,
    slotIndex: 1,
    tagId: tentacleTag.id,
    tagName: tentacleTag.tagName,
    valueScalar: 5,
    sourceType: null,
    targetType: "aoe",
  });
  const manifests = [poisonSelf, tentacle1, tentacle2];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById: coreTags,
    awakenersById: buildAwakenersById([a1, a2]),
  });
  assert(
    (result.totalsByTagId.get(poisonFixedTag.id) ?? 0) === 6,
    `self poison only owner 1: 2×3=6 (got ${result.totalsByTagId.get(poisonFixedTag.id)})`,
  );
}

console.log("Part Q — Tentacle Hit Poison ignores TDU count and still amplifies Poison.Fixed");
{
  const awakener = makeAwakener({ id: 1 });
  const tentacle = makeManifestation({
    id: 1,
    tagId: tentacleTag.id,
    tagName: tentacleTag.tagName,
    valueScalar: 2,
    sourceType: null,
    targetType: "aoe",
  });
  const poison = makeManifestation({
    id: 2,
    tagId: tentacleHitPoisonTag.id,
    tagName: tentacleHitPoisonTag.tagName,
    valueScalar: 5,
    targetType: "aoe",
  });
  const tdu = makeManifestation({
    id: 3,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 100,
    targetType: "aoe",
  });
  const poisonAmp = makeManifestation({
    id: 4,
    tagId: poisonAmpTag.id,
    tagName: poisonAmpTag.tagName,
    valueScalar: 0.2,
    targetType: "aoe",
  });
  const manifests = [tentacle, poison, tdu, poisonAmp];
  const tagsById: Record<number, Tag> = {
    ...coreTags,
    [poisonAmpTag.id]: poisonAmpTag,
  };
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [poisonAmpToFixed],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 200,
    `Tentacle still uses TDU 2×100=200 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
  assert(
    (result.totalsByTagId.get(poisonFixedTag.id) ?? 0) === 12,
    `Poison.Fixed uses raw attacks 2×5=10, then ×1.2 = 12 (got ${result.totalsByTagId.get(poisonFixedTag.id)})`,
  );
}

console.log("\nAll Hit = Tentacle Attack smoke checks passed.");
