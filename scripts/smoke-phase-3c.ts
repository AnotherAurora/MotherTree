/**
 * Phase 3c smoke — aftereffect emit/merge, Layer B reshape, closure look-ahead.
 * Run: npx tsx scripts/smoke-phase-3c.ts
 */
import {
  applyInteractions,
  type ScalarMathStep,
} from "../src/lib/path-carver/apply-interactions";
import { manifestationHitCountKey } from "../src/lib/path-carver/copy-instances";
import { buildAwakenersById } from "../src/lib/path-carver/effective-value-scalar";
import type {
  Awakener,
  AwakenerLocalManifestationInteraction,
  DefaultInteraction,
  Layer,
  Manifestation,
  Tag,
} from "../src/lib/team-data/types";

type AftereffectStep = Extract<ScalarMathStep, { kind: "aftereffect" }>;
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
    mathOperation: "multiply",
    valueScalar: 1,
    targetType: "aoe",
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

function aftereffectSteps(steps: ScalarMathStep[]): AftereffectStep[] {
  return steps.filter((s): s is AftereffectStep => s.kind === "aftereffect");
}

function lookAheadStep(steps: ScalarMathStep[]): string | undefined {
  const step = steps.find(
    (s) => s.kind === "special" && s.label === "look-ahead closure",
  );
  return step?.kind === "special" ? step.detail : undefined;
}

const damage = makeTag(1, "Attacker.Active Damage");
const bleed = makeTag(10, "Attacker.Bleed");
const bleedDamage = makeTag(
  11,
  "Attacker.Non-Active Damage.Bleed Damage",
);
const trigger = makeTag(12, "Support.Bleed Trigger", { layer: "post_add" });
const shield = makeTag(2, "Defender.Shield", { layer: "pre_add" });
const shieldInc = makeTag(3, "Support.Shield Increase", { layer: "pre_add" });
const poison = makeTag(20, "Attacker.Poison", { layer: "pre_add" });
const poisonDamage = makeTag(
  21,
  "Attacker.Non-Active Damage.Poison Damage",
);
const poisonInc = makeTag(22, "Support.Increase Gain.Poison", {
  layer: "post_add",
  isPercent: true,
  isAdditive: false,
});

console.log("Part A — one-subject aftereffect (invent on source owner)");
{
  const awakener = makeAwakener({ id: 1, name: "Solo" });
  const manifests = [
    makeManifestation({
      id: 10,
      tagId: damage.id,
      tagName: damage.tagName,
      valueScalar: 100,
      interactionOverrides: [
        makeLocal({
          id: 1,
          mode: "aftereffect",
          targetTagId: bleed.id,
          targetTagName: bleed.tagName,
          mathOperation: "multiply",
          valueScalar: 0.5,
          layer: "add",
        }),
        makeLocal({
          id: 2,
          mode: "aftereffect",
          targetTagId: bleed.id,
          targetTagName: bleed.tagName,
          mathOperation: "multiply",
          valueScalar: 10,
          isDisabled: true,
        }),
      ],
    }),
  ];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById: {
      [damage.id]: damage,
      [bleed.id]: bleed,
    },
    awakenersById: buildAwakenersById([awakener]),
  });
  assert(
    (result.totalsByTagId.get(damage.id) ?? 0) === 100,
    `own-tag Damage 100 (got ${result.totalsByTagId.get(damage.id)})`,
  );
  assert(
    (result.totalsByTagId.get(bleed.id) ?? 0) === 50,
    `Bleed aftereffect 100×0.5=50 (got ${result.totalsByTagId.get(bleed.id)})`,
  );
  const emits = aftereffectSteps(result.steps);
  assert(emits.length === 1, "disabled aftereffect skipped");
  assert(emits[0]!.owner === "awakener:1", "write owner is source awakener");
  assert(emits[0]!.invented, "invent isCreatedBase when owner lacked Bleed");
  assert(
    !result.steps.some(
      (s) =>
        (s.kind === "aftereffect" || s.kind === "op") && s.owner === "*team*",
    ),
    "aftereffect emit does not invent *team*",
  );
  const detail = lookAheadStep(result.steps);
  assert(detail != null && detail.includes("Attacker.Bleed"), "look-ahead logs closure0");
}

console.log("Part B — two-subject Bleed + Trigger (Option A combined-before-trigger)");
{
  const a1 = makeAwakener({ id: 1, name: "A" });
  const a2 = makeAwakener({ id: 2, name: "B" });
  const aftereffect = (id: number) =>
    makeLocal({
      id,
      mode: "aftereffect",
      targetTagId: bleed.id,
      targetTagName: bleed.tagName,
      mathOperation: "multiply",
      valueScalar: 0.5,
    });
  const manifests = [
    makeManifestation({
      id: 20,
      awakenerId: 1,
      slotIndex: 0,
      tagId: damage.id,
      tagName: damage.tagName,
      valueScalar: 100,
      interactionOverrides: [aftereffect(1)],
    }),
    makeManifestation({
      id: 21,
      awakenerId: 2,
      slotIndex: 1,
      tagId: damage.id,
      tagName: damage.tagName,
      valueScalar: 200,
      interactionOverrides: [aftereffect(2)],
    }),
    makeManifestation({
      id: 22,
      awakenerId: 1,
      tagId: trigger.id,
      tagName: trigger.tagName,
      valueScalar: 0.5,
      targetType: "aoe",
    }),
  ];
  const interactions = [
    makeInteraction({
      id: 1,
      modifierTagId: bleed.id,
      modifierTagName: bleed.tagName,
      targetTagId: bleedDamage.id,
      targetTagName: bleedDamage.tagName,
      mathOperation: "add_scaled",
      defaultFactor: 1,
      createsBase: true,
      amplifiesSubject: false,
    }),
    makeInteraction({
      id: 2,
      modifierTagId: trigger.id,
      modifierTagName: trigger.tagName,
      targetTagId: bleedDamage.id,
      targetTagName: bleedDamage.tagName,
      mathOperation: "multiply_one_plus",
      defaultFactor: 1,
    }),
  ];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: interactions,
    tagsById: {
      [damage.id]: damage,
      [bleed.id]: bleed,
      [bleedDamage.id]: bleedDamage,
      [trigger.id]: trigger,
    },
    awakenersById: buildAwakenersById([a1, a2]),
  });
  // Bleed 50+100=150; one BD create 150; Trigger once → 150×1.5=225.
  assert(
    (result.totalsByTagId.get(bleed.id) ?? 0) === 150,
    `combined Bleed stack 150 (got ${result.totalsByTagId.get(bleed.id)})`,
  );
  assert(
    (result.totalsByTagId.get(bleedDamage.id) ?? 0) === 225,
    `Option A BD 150×1.5=225 (got ${result.totalsByTagId.get(bleedDamage.id)})`,
  );
  const emits = aftereffectSteps(result.steps);
  assert(emits.length === 2, "two aftereffect emits");
  assert(
    emits.every((e) => e.owner.startsWith("awakener:")),
    "each aftereffect writes to source owner",
  );
  const createOps = result.steps.filter(
    (s): s is OpStep =>
      s.kind === "op" && s.subjectKey === "deferred-create",
  );
  const amplifyOps = result.steps.filter(
    (s): s is OpStep =>
      s.kind === "op" && s.subjectKey === "deferred-amplify",
  );
  assert(createOps.length === 1, "one deferred Bleed → Bleed Damage create");
  assert(amplifyOps.length === 1, "one thin Trigger amplify");
  assert(
    amplifyOps[0]!.leafContext === null,
    "deferred amplify leafContext is synthetic sourceType (null)",
  );
  assert(
    result.steps.filter(
      (s) => s.kind === "op" && s.tagId === bleedDamage.id,
    ).length === 2,
    "no Phase 1 Bleed Damage beside the deferred hop (create+amplify only)",
  );
}

console.log("Part C — aftereffect add_scaled × hitCount (not op(folded, factor))");
{
  const awakener = makeAwakener({ id: 1, name: "Hits" });
  const subject = makeManifestation({
    id: 30,
    tagId: damage.id,
    tagName: damage.tagName,
    valueScalar: 10,
    instanceCount: 3,
    interactionOverrides: [
      makeLocal({
        id: 1,
        mode: "aftereffect",
        targetTagId: bleed.id,
        targetTagName: bleed.tagName,
        mathOperation: "add_scaled",
        valueScalar: 5,
      }),
    ],
  });
  const hitCountByManifestationKey = new Map([
    [manifestationHitCountKey(subject), 3],
  ]);
  const result = applyInteractions({
    manifestations: [subject],
    appliedManifestations: [subject],
    defaultInteractions: [],
    tagsById: { [damage.id]: damage, [bleed.id]: bleed },
    awakenersById: buildAwakenersById([awakener]),
    hitCountByManifestationKey,
  });
  // contribution = 10+5 = 15; merge 15×3 = 45. Folded op would be 30+5 = 35.
  assert(
    (result.totalsByTagId.get(bleed.id) ?? 0) === 45,
    `3×(finishedOnce+factor)=45 not op(folded, factor)=35 (got ${result.totalsByTagId.get(bleed.id)})`,
  );
  assert(
    (result.totalsByTagId.get(damage.id) ?? 0) === 30,
    `own-tag merge finishedOnce×hitCount=30 (got ${result.totalsByTagId.get(damage.id)})`,
  );
  const emit = aftereffectSteps(result.steps)[0];
  assert(emit != null && emit.contribution === 15, "contribution is op(finishedOnce, factor)");
  assert(emit != null && emit.merged === 45, "merge scales contribution × hitCount");
}

console.log("Part D — Layer A Bleed + aftereffect combined stack");
{
  const awakener = makeAwakener({ id: 1, name: "Mixed" });
  const manifests = [
    makeManifestation({
      id: 40,
      tagId: bleed.id,
      tagName: bleed.tagName,
      valueScalar: 20,
      targetType: "aoe",
    }),
    makeManifestation({
      id: 41,
      tagId: damage.id,
      tagName: damage.tagName,
      valueScalar: 100,
      interactionOverrides: [
        makeLocal({
          id: 1,
          mode: "aftereffect",
          targetTagId: bleed.id,
          targetTagName: bleed.tagName,
          mathOperation: "multiply",
          valueScalar: 0.5,
        }),
      ],
    }),
    makeManifestation({
      id: 42,
      tagId: trigger.id,
      tagName: trigger.tagName,
      valueScalar: 0.5,
      targetType: "aoe",
    }),
  ];
  const interactions = [
    makeInteraction({
      id: 1,
      modifierTagId: bleed.id,
      modifierTagName: bleed.tagName,
      targetTagId: bleedDamage.id,
      targetTagName: bleedDamage.tagName,
      mathOperation: "add_scaled",
      defaultFactor: 1,
      createsBase: true,
      amplifiesSubject: false,
    }),
    makeInteraction({
      id: 2,
      modifierTagId: trigger.id,
      modifierTagName: trigger.tagName,
      targetTagId: bleedDamage.id,
      targetTagName: bleedDamage.tagName,
      mathOperation: "multiply_one_plus",
      defaultFactor: 1,
    }),
  ];
  const tagsById = {
    [damage.id]: damage,
    [bleed.id]: bleed,
    [bleedDamage.id]: bleedDamage,
    [trigger.id]: trigger,
  };
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: interactions,
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  // Layer A Bleed 20 + aftereffect 50 = 70; one BD; Trigger once → 105.
  assert(
    (result.totalsByTagId.get(bleed.id) ?? 0) === 70,
    `combined Layer A+aftereffect Bleed 70 (got ${result.totalsByTagId.get(bleed.id)})`,
  );
  assert(
    (result.totalsByTagId.get(bleedDamage.id) ?? 0) === 105,
    `one Trigger on combined BD 70×1.5=105 (got ${result.totalsByTagId.get(bleedDamage.id)})`,
  );
  const emits = aftereffectSteps(result.steps);
  assert(emits.length === 1 && !emits[0]!.invented, "merge into Layer A Bleed; no parallel synthetic");
  assert(
    result.steps.filter(
      (s) => s.kind === "op" && s.tagId === bleedDamage.id,
    ).length === 2,
    "look-ahead still defers; no Phase 1 BD + second Trigger on Layer-A-only",
  );
}

console.log("Part E — empty aftereffect set matches 3b additive totals");
{
  const awakener = makeAwakener({ id: 1, name: "Empty" });
  const manifests = [
    makeManifestation({
      id: 10,
      tagId: damage.id,
      tagName: damage.tagName,
      valueScalar: 100,
      interactionOverrides: [
        makeLocal({
          id: 1,
          mode: "unique_scaling",
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
  // Shield 10×(1+1)=20; invent add_scaled +20 onto Damage → 120.
  assert(
    (result.totalsByTagId.get(damage.id) ?? 0) === 120,
    `empty aftereffect 3b path Damage 120 (got ${result.totalsByTagId.get(damage.id)})`,
  );
  assert(
    lookAheadStep(result.steps) == null,
    "empty closure0 does not pull / does not log look-ahead",
  );
  assert(aftereffectSteps(result.steps).length === 0, "no aftereffect steps");
}

console.log("Part F — aftereffect Poison + Increase stack amplify before create");
{
  const awakener = makeAwakener({ id: 1, name: "Sunfall" });
  const manifests = [
    makeManifestation({
      id: 60,
      tagId: damage.id,
      tagName: damage.tagName,
      valueScalar: 100,
      interactionOverrides: [
        makeLocal({
          id: 1,
          mode: "aftereffect",
          targetTagId: poison.id,
          targetTagName: poison.tagName,
          mathOperation: "multiply",
          valueScalar: 0.5,
        }),
      ],
    }),
    makeManifestation({
      id: 61,
      tagId: poisonInc.id,
      tagName: poisonInc.tagName,
      valueScalar: 0.2,
      targetType: "self",
    }),
  ];
  const interactions = [
    makeInteraction({
      id: 1,
      modifierTagId: poisonInc.id,
      modifierTagName: poisonInc.tagName,
      targetTagId: poison.id,
      targetTagName: poison.tagName,
      mathOperation: "multiply_one_plus",
      defaultFactor: 1,
    }),
    makeInteraction({
      id: 2,
      modifierTagId: poison.id,
      modifierTagName: poison.tagName,
      targetTagId: poisonDamage.id,
      targetTagName: poisonDamage.tagName,
      mathOperation: "add_scaled",
      defaultFactor: 1,
      createsBase: true,
      amplifiesSubject: false,
    }),
  ];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: interactions,
    tagsById: {
      [damage.id]: damage,
      [poison.id]: poison,
      [poisonDamage.id]: poisonDamage,
      [poisonInc.id]: poisonInc,
    },
    awakenersById: buildAwakenersById([awakener]),
  });
  // Aftereffect 50; Increase ×1.2 → 60; create Damage 60.
  assert(
    (result.totalsByTagId.get(poison.id) ?? 0) === 60,
    `aftereffect Poison×Increase 60 (got ${result.totalsByTagId.get(poison.id)})`,
  );
  assert(
    (result.totalsByTagId.get(poisonDamage.id) ?? 0) === 60,
    `Poison Damage from amplified stack 60 (got ${result.totalsByTagId.get(poisonDamage.id)})`,
  );
  const stackOps = result.steps.filter(
    (s): s is OpStep =>
      s.kind === "op" && s.subjectKey === "deferred-stack-amplify",
  );
  assert(stackOps.length >= 1, "deferred stack amplify ran on Poison");
}

console.log("Part G — Layer A Poison + aftereffect combined then Increase");
{
  const awakener = makeAwakener({ id: 1, name: "MixedPoison" });
  const manifests = [
    makeManifestation({
      id: 70,
      tagId: poison.id,
      tagName: poison.tagName,
      valueScalar: 20,
      targetType: "aoe",
    }),
    makeManifestation({
      id: 71,
      tagId: damage.id,
      tagName: damage.tagName,
      valueScalar: 100,
      interactionOverrides: [
        makeLocal({
          id: 1,
          mode: "aftereffect",
          targetTagId: poison.id,
          targetTagName: poison.tagName,
          mathOperation: "multiply",
          valueScalar: 0.5,
        }),
      ],
    }),
    makeManifestation({
      id: 72,
      tagId: poisonInc.id,
      tagName: poisonInc.tagName,
      valueScalar: 0.2,
      targetType: "self",
    }),
  ];
  const interactions = [
    makeInteraction({
      id: 1,
      modifierTagId: poisonInc.id,
      modifierTagName: poisonInc.tagName,
      targetTagId: poison.id,
      targetTagName: poison.tagName,
      mathOperation: "multiply_one_plus",
      defaultFactor: 1,
    }),
    makeInteraction({
      id: 2,
      modifierTagId: poison.id,
      modifierTagName: poison.tagName,
      targetTagId: poisonDamage.id,
      targetTagName: poisonDamage.tagName,
      mathOperation: "add_scaled",
      defaultFactor: 1,
      createsBase: true,
      amplifiesSubject: false,
    }),
  ];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: interactions,
    tagsById: {
      [damage.id]: damage,
      [poison.id]: poison,
      [poisonDamage.id]: poisonDamage,
      [poisonInc.id]: poisonInc,
    },
    awakenersById: buildAwakenersById([awakener]),
  });
  // Layer A 20 + aftereffect 50 = 70; ×1.2 = 84.
  assert(
    (result.totalsByTagId.get(poison.id) ?? 0) === 84,
    `combined Poison then Increase 84 (got ${result.totalsByTagId.get(poison.id)})`,
  );
  assert(
    (result.totalsByTagId.get(poisonDamage.id) ?? 0) === 84,
    `Poison Damage 84 (got ${result.totalsByTagId.get(poisonDamage.id)})`,
  );
}

console.log("Part H — Increase self does not amplify other awakener aftereffect Poison");
{
  const a1 = makeAwakener({ id: 1, name: "HasInc" });
  const a2 = makeAwakener({ id: 2, name: "HasAe" });
  const manifests = [
    makeManifestation({
      id: 80,
      awakenerId: 1,
      slotIndex: 0,
      tagId: poisonInc.id,
      tagName: poisonInc.tagName,
      valueScalar: 0.2,
      targetType: "self",
    }),
    makeManifestation({
      id: 81,
      awakenerId: 2,
      slotIndex: 1,
      tagId: damage.id,
      tagName: damage.tagName,
      valueScalar: 100,
      interactionOverrides: [
        makeLocal({
          id: 1,
          mode: "aftereffect",
          targetTagId: poison.id,
          targetTagName: poison.tagName,
          mathOperation: "multiply",
          valueScalar: 0.5,
        }),
      ],
    }),
  ];
  const interactions = [
    makeInteraction({
      id: 1,
      modifierTagId: poisonInc.id,
      modifierTagName: poisonInc.tagName,
      targetTagId: poison.id,
      targetTagName: poison.tagName,
      mathOperation: "multiply_one_plus",
      defaultFactor: 1,
    }),
  ];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: interactions,
    tagsById: {
      [damage.id]: damage,
      [poison.id]: poison,
      [poisonInc.id]: poisonInc,
    },
    awakenersById: buildAwakenersById([a1, a2]),
  });
  assert(
    (result.totalsByTagId.get(poison.id) ?? 0) === 50,
    `cross-owner self Increase skipped (got ${result.totalsByTagId.get(poison.id)})`,
  );
}

console.log("Part I — empty aftereffect Layer A Poison + Increase stays on subject path");
{
  const awakener = makeAwakener({ id: 1, name: "LayerAOnly" });
  const manifests = [
    makeManifestation({
      id: 90,
      tagId: poison.id,
      tagName: poison.tagName,
      valueScalar: 50,
      targetType: "aoe",
    }),
    makeManifestation({
      id: 91,
      tagId: poisonInc.id,
      tagName: poisonInc.tagName,
      valueScalar: 0.2,
      targetType: "self",
    }),
  ];
  const interactions = [
    makeInteraction({
      id: 1,
      modifierTagId: poisonInc.id,
      modifierTagName: poisonInc.tagName,
      targetTagId: poison.id,
      targetTagName: poison.tagName,
      mathOperation: "multiply_one_plus",
      defaultFactor: 1,
    }),
  ];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: interactions,
    tagsById: {
      [poison.id]: poison,
      [poisonInc.id]: poisonInc,
    },
    awakenersById: buildAwakenersById([awakener]),
  });
  assert(
    lookAheadStep(result.steps) == null,
    "empty closure0 does not defer Increase",
  );
  assert(
    (result.totalsByTagId.get(poison.id) ?? 0) === 60,
    `3b subject-path Poison×Increase 60 (got ${result.totalsByTagId.get(poison.id)})`,
  );
  assert(
    !result.steps.some(
      (s) => s.kind === "op" && s.subjectKey === "deferred-stack-amplify",
    ),
    "no deferred stack amplify without aftereffect",
  );
}

console.log("\nPhase 3c smoke passed.");
