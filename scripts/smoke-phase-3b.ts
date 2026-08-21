/**
 * Phase 3b smoke — unique_scaling invent / patch / disable / base-stat / layer.
 * Run: npx tsx scripts/smoke-phase-3b.ts
 */
import {
  applyInteractions,
  type ScalarMathStep,
} from "../src/lib/path-carver/apply-interactions";
import { buildAwakenersById } from "../src/lib/path-carver/effective-value-scalar";
import type {
  Awakener,
  AwakenerLocalManifestationInteraction,
  DefaultInteraction,
  Layer,
  Manifestation,
  Tag,
} from "../src/lib/team-data/types";

type OpStep = Extract<ScalarMathStep, { kind: "op" }>;

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
  opts: { layer?: Layer | null; isPercent?: boolean; isAdditive?: boolean } = {},
): Tag {
  return {
    id,
    tagName,
    layer: opts.layer === undefined ? null : opts.layer,
    isPercent: opts.isPercent ?? false,
    isAdditive: opts.isAdditive ?? true,
  };
}

function makeLocal(
  partial: Partial<AwakenerLocalManifestationInteraction> & { id: number },
): AwakenerLocalManifestationInteraction {
  return {
    mode: "unique_scaling",
    modifierTagId: null,
    modifierTagName: "Unknown",
    targetTagId: null,
    targetTagName: null,
    layer: null,
    mathOperation: "multiply_one_plus",
    valueScalar: 1,
    targetType: "self",
    dependencyStat: null,
    isDisabled: false,
    ...partial,
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

function opStepsForTag(steps: ScalarMathStep[], tagId: number): OpStep[] {
  return steps.filter((s): s is OpStep => s.kind === "op" && s.tagId === tagId);
}

const damage = makeTag(1, "Attacker.Active Damage");
const shield = makeTag(2, "Defender.Shield", { layer: "pre_add" });
const shieldInc = makeTag(3, "Support.Shield Increase", { layer: "pre_add" });

console.log("Part A — invent Shield → Damage (no default)");
{
  const awakener = makeAwakener({ id: 1, name: "Invent" });
  const manifests = [
    makeManifestation({
      id: 10,
      tagId: damage.id,
      tagName: damage.tagName,
      valueScalar: 100,
      interactionOverrides: [
        makeLocal({
          id: 1,
          modifierTagId: shield.id,
          modifierTagName: shield.tagName,
          layer: "add",
          mathOperation: "add_scaled",
          valueScalar: 1,
        }),
      ],
    }),
    makeManifestation({
      id: 11,
      tagId: shield.id,
      tagName: shield.tagName,
      valueScalar: 10,
      targetType: "aoe",
    }),
    makeManifestation({
      id: 12,
      tagId: shieldInc.id,
      tagName: shieldInc.tagName,
      valueScalar: 1,
      targetType: "aoe",
    }),
  ];
  // Shield increase: Shield *= (1 + 1) → 20, then invent add_scaled +20 onto Damage.
  const interactions = [
    makeInteraction({
      id: 1,
      modifierTagId: shieldInc.id,
      modifierTagName: shieldInc.tagName,
      targetTagId: shield.id,
      targetTagName: shield.tagName,
      mathOperation: "multiply_one_plus",
      defaultFactor: 1,
    }),
  ];
  const tagsById = {
    [damage.id]: damage,
    [shield.id]: shield,
    [shieldInc.id]: shieldInc,
  };
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: interactions,
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  assert(
    (result.totalsByTagId.get(damage.id) ?? 0) === 120,
    `invent reads increased Shield (got ${result.totalsByTagId.get(damage.id)})`,
  );
  const inventOps = opStepsForTag(result.steps, damage.id).filter(
    (s) => s.uniqueScaling === "invent",
  );
  assert(inventOps.length >= 1, "debug marks unique_scaling=invent");
  assert(
    inventOps.some((s) => s.layer === "add"),
    "local layer=add wins for invent timing",
  );
}

console.log("Part B — patch existing default (local wins factor)");
{
  const awakener = makeAwakener({ id: 1 });
  const manifests = [
    makeManifestation({
      id: 20,
      tagId: damage.id,
      tagName: damage.tagName,
      valueScalar: 100,
      interactionOverrides: [
        makeLocal({
          id: 2,
          modifierTagId: shield.id,
          modifierTagName: shield.tagName,
          mathOperation: "add_scaled",
          valueScalar: 2,
        }),
      ],
    }),
    makeManifestation({
      id: 21,
      tagId: shield.id,
      tagName: shield.tagName,
      valueScalar: 10,
      targetType: "aoe",
    }),
  ];
  const interactions = [
    makeInteraction({
      id: 2,
      modifierTagId: shield.id,
      modifierTagName: shield.tagName,
      targetTagId: damage.id,
      targetTagName: damage.tagName,
      mathOperation: "add_scaled",
      defaultFactor: 1,
    }),
  ];
  const tagsById = { [damage.id]: damage, [shield.id]: shield };
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: interactions,
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  // 100 + 10*2 = 120
  assert(
    (result.totalsByTagId.get(damage.id) ?? 0) === 120,
    `patch factor 2 (got ${result.totalsByTagId.get(damage.id)})`,
  );
  const patchOps = opStepsForTag(result.steps, damage.id).filter(
    (s) => s.uniqueScaling === "patch",
  );
  assert(patchOps.length >= 1, "debug marks unique_scaling=patch");
}

console.log("Part C — disable-only cuts matching default");
{
  const awakener = makeAwakener({ id: 1 });
  const manifests = [
    makeManifestation({
      id: 30,
      tagId: damage.id,
      tagName: damage.tagName,
      valueScalar: 100,
      interactionOverrides: [
        makeLocal({
          id: 3,
          modifierTagId: shield.id,
          modifierTagName: shield.tagName,
          isDisabled: true,
        }),
      ],
    }),
    makeManifestation({
      id: 31,
      tagId: shield.id,
      tagName: shield.tagName,
      valueScalar: 10,
      targetType: "aoe",
    }),
  ];
  const interactions = [
    makeInteraction({
      id: 3,
      modifierTagId: shield.id,
      modifierTagName: shield.tagName,
      targetTagId: damage.id,
      targetTagName: damage.tagName,
      mathOperation: "add_scaled",
      defaultFactor: 1,
    }),
  ];
  const tagsById = { [damage.id]: damage, [shield.id]: shield };
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: interactions,
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  assert(
    (result.totalsByTagId.get(damage.id) ?? 0) === 100,
    `disable cuts link (got ${result.totalsByTagId.get(damage.id)})`,
  );
}

console.log("Part D — ATM 27 base-stat invent → 111");
{
  const awakener = makeAwakener({
    id: 1,
    name: "Agrippa",
    sigilYield: 0.036,
  });
  const shieldFixed = makeTag(27, "Defender.Shield.Fixed");
  const manifests = [
    makeManifestation({
      id: 40,
      tagId: shieldFixed.id,
      tagName: shieldFixed.tagName,
      valueScalar: 109,
      interactionOverrides: [
        makeLocal({
          id: 4,
          modifierTagId: null,
          modifierTagName: "Unknown",
          dependencyStat: "sigil_yield",
          valueScalar: 0.005,
          mathOperation: "multiply_one_plus",
          layer: null,
        }),
      ],
    }),
  ];
  const tagsById = { [shieldFixed.id]: shieldFixed };
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  // 109 × (1 + 3.6×0.005) = 109 × 1.018 → ceil 111
  assert(
    (result.totalsByTagId.get(shieldFixed.id) ?? 0) === 111,
    `ATM27 base-stat → 111 (got ${result.totalsByTagId.get(shieldFixed.id)})`,
  );
  const baseOps = opStepsForTag(result.steps, shieldFixed.id).filter(
    (s) => s.uniqueScaling === "base_stat",
  );
  assert(baseOps.length >= 1, "debug marks unique_scaling=base_stat");
  assert(
    baseOps.some((s) => s.layer === "add"),
    "null-mod layer falls back to add",
  );
  assert(
    baseOps.some((s) => s.modifierValue === 3.6 && s.factor === 0.005),
    "percent-points modifier + raw factor",
  );
}

console.log("Part E — aftereffect does not patch source Damage (emit is 3c)");
{
  const awakener = makeAwakener({ id: 1 });
  const bleed = makeTag(5, "Attacker.Bleed");
  const manifests = [
    makeManifestation({
      id: 50,
      tagId: damage.id,
      tagName: damage.tagName,
      valueScalar: 100,
      interactionOverrides: [
        {
          id: 5,
          mode: "aftereffect",
          modifierTagId: null,
          modifierTagName: "Unknown",
          targetTagId: bleed.id,
          targetTagName: bleed.tagName,
          layer: "add",
          mathOperation: "multiply",
          valueScalar: 1,
          targetType: "aoe",
          dependencyStat: null,
          isDisabled: false,
        },
      ],
    }),
  ];
  const tagsById = { [damage.id]: damage, [bleed.id]: bleed };
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  assert(
    (result.totalsByTagId.get(damage.id) ?? 0) === 100,
    "aftereffect does not change source Damage",
  );
}

console.log("Part F — invent modifier=Shield uses only Shield.Fixed (prefix)");
{
  const awakener = makeAwakener({ id: 1, name: "PrefixFixed" });
  const shieldFixed = makeTag(6, "Defender.Shield.Fixed", { layer: "pre_add" });
  const manifests = [
    makeManifestation({
      id: 60,
      tagId: damage.id,
      tagName: damage.tagName,
      valueScalar: 100,
      interactionOverrides: [
        makeLocal({
          id: 6,
          modifierTagId: shield.id,
          modifierTagName: shield.tagName,
          layer: "add",
          mathOperation: "add_scaled",
          valueScalar: 1,
        }),
      ],
    }),
    makeManifestation({
      id: 61,
      tagId: shieldFixed.id,
      tagName: shieldFixed.tagName,
      valueScalar: 15,
      targetType: "aoe",
    }),
  ];
  const tagsById = {
    [damage.id]: damage,
    [shield.id]: shield,
    [shieldFixed.id]: shieldFixed,
  };
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  // 100 + 15 (Shield.Fixed under Shield prefix)
  assert(
    (result.totalsByTagId.get(damage.id) ?? 0) === 115,
    `prefix Fixed-only invent (got ${result.totalsByTagId.get(damage.id)})`,
  );
  const inventOps = opStepsForTag(result.steps, damage.id).filter(
    (s) => s.uniqueScaling === "invent",
  );
  assert(inventOps.length >= 1, "prefix Fixed invent marked invent");
  assert(
    inventOps.some((s) => s.modifierTagName === shield.tagName),
    "debug keeps root modifier name Defender.Shield",
  );
}

console.log("Part G — invent Shield + Shield.Fixed combine via is_additive");
{
  const awakener = makeAwakener({ id: 1, name: "PrefixBoth" });
  const shieldFixed = makeTag(7, "Defender.Shield.Fixed", {
    layer: "pre_add",
    isAdditive: true,
  });
  const manifests = [
    makeManifestation({
      id: 70,
      tagId: damage.id,
      tagName: damage.tagName,
      valueScalar: 100,
      interactionOverrides: [
        makeLocal({
          id: 7,
          modifierTagId: shield.id,
          modifierTagName: shield.tagName,
          layer: "add",
          mathOperation: "add_scaled",
          valueScalar: 1,
        }),
      ],
    }),
    makeManifestation({
      id: 71,
      tagId: shield.id,
      tagName: shield.tagName,
      valueScalar: 10,
      targetType: "aoe",
    }),
    makeManifestation({
      id: 72,
      tagId: shieldFixed.id,
      tagName: shieldFixed.tagName,
      valueScalar: 5,
      targetType: "aoe",
    }),
  ];
  const tagsById = {
    [damage.id]: damage,
    [shield.id]: shield,
    [shieldFixed.id]: shieldFixed,
  };
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  // 100 + (10+5) = 115
  assert(
    (result.totalsByTagId.get(damage.id) ?? 0) === 115,
    `prefix Shield+Fixed invent (got ${result.totalsByTagId.get(damage.id)})`,
  );
}

console.log("\nPhase 3b / 3b.1 smoke passed.");
