/**
 * Phase 2c smoke — modifier-layer pass order (pre_add → add → post_add).
 * Run: npx tsx scripts/smoke-phase-2c.ts
 */
import {
  applyInteractions,
  type ScalarMathStep,
} from "../src/lib/path-carver/apply-interactions";
import { buildAwakenersById } from "../src/lib/path-carver/effective-value-scalar";
import type {
  Awakener,
  DefaultInteraction,
  Layer,
  Manifestation,
  Tag,
} from "../src/lib/team-data/types";

type OpStep = Extract<ScalarMathStep, { kind: "op" }>;

function opStepsForTag(steps: ScalarMathStep[], tagId: number): OpStep[] {
  return steps.filter((s): s is OpStep => s.kind === "op" && s.tagId === tagId);
}

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

const awakener = makeAwakener({ id: 1, name: "LayerTester" });
const awakenersById = buildAwakenersById([awakener]);

console.log("Part A — pre_add → add → post_add order + totals");
{
  // Base 100 Active Damage.
  // pre_add multiply_one_plus +0.25 → 125 (exact; avoid 0.1 float→ceil trap)
  // add add_scaled +50 → 175
  // post_add (former-f Crit Damage) multiply_one_plus +0.50 → 263 (ceil 262.5)
  // Old add-then-multiply: 100+50=150; ×1.25=188; ×1.5=282 — different total.
  const active = makeTag(42, "Attacker.Active Damage");
  const preMul = makeTag(10, "Support.PreMultiply", { layer: "pre_add" });
  const flatAdd = makeTag(11, "Support.Flat Add", { layer: "add" });
  // Former layer=f tag now on post_add (e.g. Support.Crit Damage).
  const critDmg = makeTag(17, "Support.Crit Damage", {
    layer: "post_add",
    isPercent: true,
  });

  // Deliberately reverse ids so id-order alone would NOT match layer order.
  const interactions = [
    makeInteraction({
      id: 300,
      modifierTagId: critDmg.id,
      modifierTagName: critDmg.tagName,
      targetTagId: active.id,
      targetTagName: active.tagName,
      mathOperation: "multiply_one_plus",
      defaultFactor: 1,
    }),
    makeInteraction({
      id: 200,
      modifierTagId: flatAdd.id,
      modifierTagName: flatAdd.tagName,
      targetTagId: active.id,
      targetTagName: active.tagName,
      mathOperation: "add_scaled",
      defaultFactor: 1,
    }),
    makeInteraction({
      id: 100,
      modifierTagId: preMul.id,
      modifierTagName: preMul.tagName,
      targetTagId: active.id,
      targetTagName: active.tagName,
      mathOperation: "multiply_one_plus",
      defaultFactor: 1,
    }),
  ];

  const manifestations = [
    makeManifestation({
      id: 1,
      tagId: active.id,
      tagName: active.tagName,
      valueScalar: 100,
      sourceType: "command card",
      targetType: "aoe",
    }),
    makeManifestation({
      id: 2,
      tagId: preMul.id,
      tagName: preMul.tagName,
      valueScalar: 0.25,
      sourceType: "command card",
      targetType: "aoe",
    }),
    makeManifestation({
      id: 3,
      tagId: flatAdd.id,
      tagName: flatAdd.tagName,
      valueScalar: 50,
      sourceType: "command card",
      targetType: "aoe",
    }),
    makeManifestation({
      id: 4,
      tagId: critDmg.id,
      tagName: critDmg.tagName,
      valueScalar: 0.5,
      sourceType: "command card",
      targetType: "aoe",
    }),
  ];

  const tagsById: Record<number, Tag> = {
    [active.id]: active,
    [preMul.id]: preMul,
    [flatAdd.id]: flatAdd,
    [critDmg.id]: critDmg,
  };

  const result = applyInteractions({
    manifestations,
    appliedManifestations: manifestations,
    defaultInteractions: interactions,
    tagsById,
    awakenersById,
  });

  const activeOps = opStepsForTag(result.steps, active.id);
  assert(activeOps.length === 3, "exactly 3 amplify ops on Active Damage");

  const layers = activeOps.map((s) => s.layer);
  assert(
    layers[0] === "pre_add" && layers[1] === "add" && layers[2] === "post_add",
    `step layers are pre_add→add→post_add (got ${layers.join("→")})`,
  );

  const mods = activeOps.map((s) => s.modifierTagName);
  assert(
    mods[0] === preMul.tagName &&
      mods[1] === flatAdd.tagName &&
      mods[2] === critDmg.tagName,
    `modifier order follows layers (got ${mods.join(" → ")})`,
  );

  assert(activeOps[0]!.before === 100 && activeOps[0]!.after === 125, "pre_add: 100→125");
  assert(activeOps[1]!.before === 125 && activeOps[1]!.after === 175, "add: 125→175");
  assert(
    activeOps[2]!.before === 175 && activeOps[2]!.after === 263,
    "post_add Crit Damage: 175→262.5→ceil 263",
  );

  assert(
    result.totalsByTagId.get(active.id) === 263,
    `Active Damage total 263 (layer order), not old add-then-mul 282; got ${result.totalsByTagId.get(active.id)}`,
  );
}

console.log("Part B — null layer shares add band; within-rank add_scaled first");
{
  const active = makeTag(42, "Attacker.Active Damage");
  const nullMul = makeTag(20, "Support.Null Multiply", { layer: null });
  const addFlat = makeTag(21, "Support.Add Flat", { layer: "add" });

  // Null multiply has lower id than add_scaled; within-rank op tiebreak must win.
  const interactions = [
    makeInteraction({
      id: 10,
      modifierTagId: nullMul.id,
      modifierTagName: nullMul.tagName,
      targetTagId: active.id,
      targetTagName: active.tagName,
      mathOperation: "multiply_one_plus",
      defaultFactor: 1,
    }),
    makeInteraction({
      id: 20,
      modifierTagId: addFlat.id,
      modifierTagName: addFlat.tagName,
      targetTagId: active.id,
      targetTagName: active.tagName,
      mathOperation: "add_scaled",
      defaultFactor: 1,
    }),
  ];

  const manifestations = [
    makeManifestation({
      id: 1,
      tagId: active.id,
      tagName: active.tagName,
      valueScalar: 100,
      sourceType: "command card",
      targetType: "aoe",
    }),
    makeManifestation({
      id: 2,
      tagId: nullMul.id,
      tagName: nullMul.tagName,
      valueScalar: 0.25,
      sourceType: "command card",
      targetType: "aoe",
    }),
    makeManifestation({
      id: 3,
      tagId: addFlat.id,
      tagName: addFlat.tagName,
      valueScalar: 50,
      sourceType: "command card",
      targetType: "aoe",
    }),
  ];

  const tagsById: Record<number, Tag> = {
    [active.id]: active,
    [nullMul.id]: nullMul,
    [addFlat.id]: addFlat,
  };

  const result = applyInteractions({
    manifestations,
    appliedManifestations: manifestations,
    defaultInteractions: interactions,
    tagsById,
    awakenersById,
  });

  const activeOps = opStepsForTag(result.steps, active.id);
  assert(activeOps.length === 2, "two ops in add/null band");
  assert(
    activeOps[0]!.op === "add_scaled" && activeOps[0]!.layer === "add",
    "add_scaled (layer=add) runs before null-layer multiply",
  );
  assert(
    activeOps[1]!.op === "multiply_one_plus" && activeOps[1]!.layer === null,
    "null-layer multiply runs second in same band",
  );
  // 100+50=150, then 150*1.25=187.5→ceil 188
  assert(
    result.totalsByTagId.get(active.id) === 188,
    `null-compat total 188; got ${result.totalsByTagId.get(active.id)}`,
  );
}

console.log("Part C — override op change does not move pass layer");
{
  const active = makeTag(42, "Attacker.Active Damage");
  const preMul = makeTag(10, "Support.PreMultiply", { layer: "pre_add" });
  const postMod = makeTag(17, "Support.Crit Damage", {
    layer: "post_add",
    isPercent: true,
  });

  const interactions = [
    makeInteraction({
      id: 1,
      modifierTagId: preMul.id,
      modifierTagName: preMul.tagName,
      targetTagId: active.id,
      targetTagName: active.tagName,
      mathOperation: "multiply_one_plus",
      defaultFactor: 1,
    }),
    makeInteraction({
      id: 2,
      modifierTagId: postMod.id,
      modifierTagName: postMod.tagName,
      targetTagId: active.id,
      targetTagName: active.tagName,
      // Default is multiply; override will force add_scaled — pass still post_add.
      mathOperation: "multiply_one_plus",
      defaultFactor: 1,
    }),
  ];

  const manifestations = [
    makeManifestation({
      id: 1,
      tagId: active.id,
      tagName: active.tagName,
      valueScalar: 100,
      sourceType: "command card",
      targetType: "aoe",
      interactionOverrides: [
        {
          id: 1,
          modifierTagId: postMod.id,
          modifierTagName: postMod.tagName,
          // Op override only — pass timing still follows modifier layer post_add.
          mathOperation: "add_scaled",
          valueScalar: null,
          targetType: null,
          dependencyStat: null,
          isDisabled: false,
        },
      ],
    }),
    makeManifestation({
      id: 2,
      tagId: preMul.id,
      tagName: preMul.tagName,
      valueScalar: 0.25,
      sourceType: "command card",
      targetType: "aoe",
    }),
    makeManifestation({
      id: 3,
      tagId: postMod.id,
      tagName: postMod.tagName,
      valueScalar: 25,
      sourceType: "command card",
      targetType: "aoe",
    }),
  ];

  const tagsById: Record<number, Tag> = {
    [active.id]: active,
    [preMul.id]: preMul,
    [postMod.id]: postMod,
  };

  const result = applyInteractions({
    manifestations,
    appliedManifestations: manifestations,
    defaultInteractions: interactions,
    tagsById,
    awakenersById,
  });

  const activeOps = opStepsForTag(result.steps, active.id);
  assert(activeOps.length === 2, "pre_add then overridden post_add");
  assert(
    activeOps[0]!.layer === "pre_add" && activeOps[1]!.layer === "post_add",
    "override op does not pull post_add into an earlier pass",
  );
  assert(
    activeOps[1]!.op === "add_scaled" && activeOps[1]!.after === 150,
    "override applies add_scaled math at post_add timing: 125+25=150",
  );
  assert(
    result.totalsByTagId.get(active.id) === 150,
    `override-at-post_add total 150; got ${result.totalsByTagId.get(active.id)}`,
  );
}

console.log("\nAll Phase 2c smoke checks passed.");
