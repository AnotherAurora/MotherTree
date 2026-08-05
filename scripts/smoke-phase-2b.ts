/**
 * Phase 2b smoke test — dependency_stat scaling + leaf-gated buff restriction.
 * Run: npx tsx scripts/smoke-phase-2b.ts
 */
import { applyInteractions } from "../src/lib/path-carver/apply-interactions";
import {
  buildAwakenersById,
  scaleValueScalar,
} from "../src/lib/path-carver/effective-value-scalar";
import type {
  Awakener,
  DefaultInteraction,
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

function makeTag(id: number, tagName: string, isPercent = false, isAdditive = true): Tag {
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

console.log("Part A — dependency_stat scaling");
{
  const awakener = makeAwakener({
    id: 1,
    atk: 200,
    damageAmp: 0.1,
    keyflareRegen: 0.05,
    critDmg: 0.5,
  });

  assert(
    scaleValueScalar(0.45, "atk", awakener, "awakener") === 90,
    "atk non-percent: raw * atk (exact → unchanged by ceil)",
  );
  assert(
    scaleValueScalar(0.45, "atk", makeAwakener({ id: 3, atk: 201 }), "awakener") ===
      91,
    "atk ceil to whole: 0.45 * 201 → 91",
  );
  assert(
    scaleValueScalar(
      0.45,
      "atk",
      makeAwakener({ id: 5, atk: 201 }),
      "awakener",
      true,
    ) === 90.45,
    "atk + tag %: ceil to 2dp 0.45*201 → 90.45",
  );
  assert(
    scaleValueScalar(0.01, "damage_amp", awakener, "awakener") === 10,
    "damage_amp percent form (tag non-%: whole ceil)",
  );
  assert(
    scaleValueScalar(
      0.001231,
      "damage_amp",
      makeAwakener({ id: 4, damageAmp: 0.1 }),
      "awakener",
      true,
    ) === 1.24,
    "damage_amp + tag %: ceil to 2dp 1.231 → 1.24",
  );
  assert(
    scaleValueScalar(
      0.001231,
      "damage_amp",
      makeAwakener({ id: 6, damageAmp: 0.1 }),
      "awakener",
      false,
    ) === 2,
    "damage_amp + tag non-%: ceil whole 1.231 → 2",
  );
  assert(
    scaleValueScalar(2, "keyflare_regen", awakener, "awakener") === 1,
    "keyflare_regen → keyflareRegen then ceil whole (0.1 → 1)",
  );
  assert(
    scaleValueScalar(0.01, "crit_dmg", awakener, "awakener", true) === 50,
    "crit_dmg percent form (tag %)",
  );
  assert(
    scaleValueScalar(10, "team_max_hp", awakener, "awakener") === 10,
    "team_max_hp ignored",
  );
  assert(
    scaleValueScalar(10.7, null, awakener, "awakener") === 10.7,
    "null dependency_stat: raw unchanged (no ceil)",
  );
  assert(
    scaleValueScalar(10, "atk", awakener, "posse") === 10,
    "posse ignores dependency_stat",
  );
  assert(
    scaleValueScalar(5, "atk", makeAwakener({ id: 2, atk: null }), "awakener") ===
      0,
    "null awakener stat → 0",
  );
}

console.log("Part B — leaf-gated buff_target_type_restriction");
{
  const enhance = makeTag(68, "Support.Enhance", true);
  const finalDmg = makeTag(14, "Support.Final Damage", true);
  const active = makeTag(1, "Attacker.Active Damage", false);

  const tagsById: Record<number, Tag> = {
    [enhance.id]: enhance,
    [finalDmg.id]: finalDmg,
    [active.id]: active,
  };

  const awakener = makeAwakener({ id: 1, atk: 100 });
  const awakenersById = buildAwakenersById([awakener]);

  const manifestations: Manifestation[] = [
    makeManifestation({
      id: 10,
      tagId: enhance.id,
      tagName: enhance.tagName,
      valueScalar: 1,
      sourceType: "command card",
      targetType: "aoe",
    }),
    makeManifestation({
      id: 11,
      tagId: finalDmg.id,
      tagName: finalDmg.tagName,
      valueScalar: 0.2,
      sourceType: null,
      targetType: "aoe",
    }),
    makeManifestation({
      id: 12,
      tagId: active.id,
      tagName: active.tagName,
      valueScalar: 100,
      sourceType: "command card",
      targetType: "single",
    }),
    makeManifestation({
      id: 13,
      tagId: active.id,
      tagName: active.tagName,
      valueScalar: 50,
      sourceType: "tentacle",
      targetType: "single",
    }),
  ];

  const interactions: DefaultInteraction[] = [
    makeInteraction({
      id: 1,
      modifierTagId: enhance.id,
      modifierTagName: enhance.tagName,
      targetTagId: finalDmg.id,
      targetTagName: finalDmg.tagName,
      mathOperation: "multiply_one_plus",
      defaultFactor: 1,
      buffTargetTypeRestriction: "command card",
      createsBase: true,
      amplifiesSubject: false,
    }),
    makeInteraction({
      id: 2,
      modifierTagId: finalDmg.id,
      modifierTagName: finalDmg.tagName,
      targetTagId: active.id,
      targetTagName: active.tagName,
      mathOperation: "multiply_one_plus",
      defaultFactor: 1,
      createsBase: false,
      amplifiesSubject: true,
    }),
  ];

  const result = applyInteractions({
    manifestations,
    appliedManifestations: manifestations,
    defaultInteractions: interactions,
    tagsById,
    awakenersById,
  });

  const activeTotal = result.totalsByTagId.get(active.id) ?? 0;
  // Command-card leaf: Final Damage gets Enhance (0.2 → (1+0.2)*(1+1)-1 = 1.4),
  // then Active 100 * (1+1.4) = 240 (ceil).
  // Tentacle leaf: Enhance skipped, Final stays 0.2, Active 50 * (1+0.2) = 60 (ceil).
  // Sum ≈ 240 + 60 = 300.
  assert(activeTotal > 150, `Active Damage summed across leaves (${activeTotal})`);
  assert(
    activeTotal !== 100 + 50,
    "interactions applied (not raw sum of bases)",
  );

  const restrictionSteps = result.steps.filter(
    (s) => s.kind === "op" && s.buffRestrictionMet === "command card",
  );
  assert(
    restrictionSteps.length >= 1,
    `restricted op emitted when leaf matches (${restrictionSteps.length} steps)`,
  );

  const tentacleRestrictionSteps = result.steps.filter(
    (s) =>
      s.kind === "op" &&
      s.buffRestrictionMet === "command card" &&
      s.leafContext === "tentacle",
  );
  assert(
    tentacleRestrictionSteps.length === 0,
    "no restricted op line for tentacle leaf path",
  );

  // dependency_stat on Active Damage leaf
  const scaledLeaf = makeManifestation({
    id: 14,
    tagId: active.id,
    tagName: active.tagName,
    valueScalar: 2,
    dependencyStat: "atk",
    sourceType: "command card",
  });
  const scaledResult = applyInteractions({
    manifestations: [scaledLeaf],
    appliedManifestations: [scaledLeaf],
    defaultInteractions: [],
    tagsById,
    awakenersById,
  });
  assert(
    (scaledResult.totalsByTagId.get(active.id) ?? 0) === 200,
    "dependency_stat atk scales base into totals (2 * 100)",
  );
  const baseStep = scaledResult.steps.find((s) => s.kind === "base");
  assert(
    baseStep?.kind === "base" &&
      baseStep.rawScalar === 2 &&
      baseStep.scalar === 200,
    "base step shows raw vs effective",
  );
}

console.log("presence_multiply leaves owner buckets for later self multipliers");
{
  const awakener = makeAwakener({ id: 3, atk: 168 });
  const awakenersById = buildAwakenersById([awakener]);

  const vul = makeTag(34, "Support.Debuff.Vulnerability");
  const crit = makeTag(17, "Support.Crit Damage", true);
  const active = makeTag(42, "Attacker.Active Damage");
  const fixed = makeTag(46, "Attacker.Active Damage.Fixed Damage");

  const tagsById: Record<number, Tag> = {
    [vul.id]: vul,
    [crit.id]: crit,
    [active.id]: active,
    [fixed.id]: fixed,
  };

  const manifests: Manifestation[] = [
    makeManifestation({
      id: 9,
      awakenerId: 3,
      tagId: vul.id,
      tagName: vul.tagName,
      valueScalar: 1,
      sourceType: "command card",
      targetType: "aoe",
    }),
    makeManifestation({
      id: 6,
      awakenerId: 3,
      tagId: crit.id,
      tagName: crit.tagName,
      valueScalar: 0.2,
      sourceType: "rouse",
      targetType: "self",
    }),
    makeManifestation({
      id: 14,
      awakenerId: 3,
      sourceKind: "covenant",
      sourceName: "Cov",
      tagId: crit.id,
      tagName: crit.tagName,
      valueScalar: 0.2,
      targetType: "self",
    }),
    makeManifestation({
      id: 2,
      awakenerId: 3,
      tagId: active.id,
      tagName: active.tagName,
      valueScalar: 1.5,
      dependencyStat: "atk",
      sourceType: "exalt",
      targetType: "single",
    }),
  ];

  const interactions: DefaultInteraction[] = [
    makeInteraction({
      id: 1,
      modifierTagId: vul.id,
      modifierTagName: vul.tagName,
      targetTagId: active.id,
      targetTagName: active.tagName,
      exclusionTagId: fixed.id,
      exclusionTagName: fixed.tagName,
      mathOperation: "presence_multiply",
      defaultFactor: 1.5,
    }),
    makeInteraction({
      id: 10,
      modifierTagId: crit.id,
      modifierTagName: crit.tagName,
      targetTagId: active.id,
      targetTagName: active.tagName,
      exclusionTagId: fixed.id,
      exclusionTagName: fixed.tagName,
      mathOperation: "multiply_one_plus",
      defaultFactor: 1,
    }),
  ];

  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: interactions,
    tagsById,
    awakenersById,
    awakenerNamesById: new Map([[3, "24"]]),
  });

  const ops = result.steps.filter((s) => s.kind === "op");
  const hasVuln = ops.some(
    (s) =>
      s.kind === "op" &&
      s.op === "presence_multiply" &&
      s.modifierTagName === vul.tagName,
  );
  const hasCrit = ops.some(
    (s) =>
      s.kind === "op" &&
      s.op === "multiply_one_plus" &&
      s.modifierTagName === crit.tagName,
  );
  assert(hasVuln, "Vulnerability presence_multiply applied");
  assert(hasCrit, "self Crit still applies after Vulnerability");

  // Base AD = ceil(1.5 * 168) = 252; ×1.5 vuln = 378; ×(1+0.4) crit = 529.2 → ceil 530
  const adTotal = result.totalsByTagId.get(active.id) ?? 0;
  assert(
    adTotal === 530,
    `Active Damage reflects Vulnerability then Crit (${adTotal})`,
  );
}

console.log("Existence gate — Attacker/Defender targets; Support synthesizable");
{
  const awakener = makeAwakener({ id: 1, atk: 100 });
  const awakenersById = buildAwakenersById([awakener]);

  const strUp = makeTag(30, "Support.STR Up");
  const active = makeTag(42, "Attacker.Active Damage");
  const fiamma = makeTag(100, "Support.Fiamma", true);
  const finalDmg = makeTag(14, "Support.Final Damage", true);
  const createInsight = makeTag(200, "Support.Create.Insight");
  const draw = makeTag(201, "Support.Draw", true);
  const arithmetica = makeTag(202, "Support.Arithmetica", true);

  const tagsById: Record<number, Tag> = {
    [strUp.id]: strUp,
    [active.id]: active,
    [fiamma.id]: fiamma,
    [finalDmg.id]: finalDmg,
    [createInsight.id]: createInsight,
    [draw.id]: draw,
    [arithmetica.id]: arithmetica,
  };

  // 1) Deny phantom: STR Up with no Active Damage base
  {
    const manifests = [
      makeManifestation({
        id: 1,
        tagId: strUp.id,
        tagName: strUp.tagName,
        valueScalar: 20,
        targetType: "aoe",
      }),
    ];
    const interactions: DefaultInteraction[] = [
      makeInteraction({
        id: 1,
        modifierTagId: strUp.id,
        modifierTagName: strUp.tagName,
        targetTagId: active.id,
        targetTagName: active.tagName,
        mathOperation: "add_scaled",
        defaultFactor: 1,
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: interactions,
      tagsById,
      awakenersById,
    });
    assert(
      (result.totalsByTagId.get(active.id) ?? 0) === 0,
      "STR Up does not invent phantom Active Damage",
    );
    const phantomOp = result.steps.some(
      (s) =>
        s.kind === "op" &&
        s.tagId === active.id &&
        s.modifierTagName === strUp.tagName,
    );
    assert(!phantomOp, "no add_scaled op step inventing Active Damage");
  }

  // 2) Allow STR when Active Damage base exists
  {
    const manifests = [
      makeManifestation({
        id: 1,
        tagId: strUp.id,
        tagName: strUp.tagName,
        valueScalar: 20,
        targetType: "aoe",
      }),
      makeManifestation({
        id: 2,
        tagId: active.id,
        tagName: active.tagName,
        valueScalar: 100,
        sourceType: "command card",
        targetType: "single",
      }),
    ];
    const interactions: DefaultInteraction[] = [
      makeInteraction({
        id: 1,
        modifierTagId: strUp.id,
        modifierTagName: strUp.tagName,
        targetTagId: active.id,
        targetTagName: active.tagName,
        mathOperation: "add_scaled",
        defaultFactor: 1,
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: interactions,
      tagsById,
      awakenersById,
    });
    // Base 100 + owner add_scaled 20*1 = 120
    assert(
      (result.totalsByTagId.get(active.id) ?? 0) === 120,
      `STR Up scales existing Active Damage (${result.totalsByTagId.get(active.id)})`,
    );
  }

  // 3) Fiamma → Final Damage (no Final Damage base) → Active Damage (base present)
  {
    const manifests = [
      makeManifestation({
        id: 1,
        tagId: fiamma.id,
        tagName: fiamma.tagName,
        valueScalar: 1,
        sourceType: "command card",
        targetType: "aoe",
      }),
      makeManifestation({
        id: 2,
        tagId: active.id,
        tagName: active.tagName,
        valueScalar: 100,
        sourceType: "command card",
        targetType: "single",
      }),
    ];
    const interactions: DefaultInteraction[] = [
      makeInteraction({
        id: 1,
        modifierTagId: fiamma.id,
        modifierTagName: fiamma.tagName,
        targetTagId: finalDmg.id,
        targetTagName: finalDmg.tagName,
        mathOperation: "multiply_one_plus",
        defaultFactor: 0.3,
        buffTargetTypeRestriction: "command card",
        createsBase: true,
        amplifiesSubject: false,
      }),
      makeInteraction({
        id: 2,
        modifierTagId: finalDmg.id,
        modifierTagName: finalDmg.tagName,
        targetTagId: active.id,
        targetTagName: active.tagName,
        mathOperation: "multiply_one_plus",
        defaultFactor: 1,
        createsBase: false,
        amplifiesSubject: true,
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: interactions,
      tagsById,
      awakenersById,
    });
    // Fiamma 1 * 0.3 → Final Damage 0.3 (from 0); Active 100 * (1+0.3) → ceil
    const ad = result.totalsByTagId.get(active.id) ?? 0;
    assert(
      ad === 130 || ad === 131,
      `Fiamma chain raises Active Damage (${ad})`,
    );
    const fd = result.totalsByTagId.get(finalDmg.id) ?? 0;
    // Restricted create is path-scoped — does not merge into global Final totals.
    assert(fd === 0, `restricted Fiamma Final not globally merged (${fd})`);
    const fdOp = result.steps.some(
      (s) =>
        s.kind === "op" &&
        s.tagId === finalDmg.id &&
        s.modifierTagName === fiamma.tagName &&
        s.buffRestrictionMet === "command card",
    );
    assert(fdOp, "Fiamma synthesizes Final Damage from 0 on matching leaf path");
  }

  // 4) Create.Insight → Draw / Arithmetica: unrestricted creates merge Support bases
  {
    const manifests = [
      makeManifestation({
        id: 1,
        tagId: createInsight.id,
        tagName: createInsight.tagName,
        valueScalar: 2,
        targetType: "aoe",
      }),
    ];
    const interactions: DefaultInteraction[] = [
      makeInteraction({
        id: 1,
        modifierTagId: createInsight.id,
        modifierTagName: createInsight.tagName,
        targetTagId: draw.id,
        targetTagName: draw.tagName,
        mathOperation: "add_scaled",
        defaultFactor: 1,
        createsBase: true,
        amplifiesSubject: false,
      }),
      makeInteraction({
        id: 2,
        modifierTagId: createInsight.id,
        modifierTagName: createInsight.tagName,
        targetTagId: arithmetica.id,
        targetTagName: arithmetica.tagName,
        mathOperation: "multiply_one_plus",
        defaultFactor: 1,
        createsBase: true,
        amplifiesSubject: false,
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: interactions,
      tagsById,
      awakenersById,
    });
    assert(
      (result.totalsByTagId.get(createInsight.id) ?? 0) === 2,
      "Create.Insight subject total is its base",
    );
    assert(
      (result.totalsByTagId.get(draw.id) ?? 0) === 2,
      `Draw created base merged (${result.totalsByTagId.get(draw.id)})`,
    );
    // percent multiply from 0: (1+0)*(1+2*1)-1 = 2
    assert(
      (result.totalsByTagId.get(arithmetica.id) ?? 0) === 2,
      `Arithmetica created base merged (${result.totalsByTagId.get(arithmetica.id)})`,
    );
  }
}

console.log("Subject-centric + creates_base / amplifies_subject regressions");
{
  const awakener = makeAwakener({ id: 1, atk: 100 });
  const awakener2 = makeAwakener({ id: 2, atk: 100 });
  const awakenersById = buildAwakenersById([awakener, awakener2]);

  const strUp = makeTag(30, "Support.STR Up");
  const vul = makeTag(34, "Support.Debuff.Vulnerability");
  const crit = makeTag(17, "Support.Crit Damage", true);
  const active = makeTag(42, "Attacker.Active Damage");
  const strike = makeTag(43, "Attacker.Active Damage.Strike");
  const shield = makeTag(50, "Defender.Shield");
  const alert = makeTag(51, "Defender.Alert");
  const increaseStr = makeTag(60, "Support.Increase Gain.STR Up", true);

  const tagsById: Record<number, Tag> = {
    [strUp.id]: strUp,
    [vul.id]: vul,
    [crit.id]: crit,
    [active.id]: active,
    [strike.id]: strike,
    [shield.id]: shield,
    [alert.id]: alert,
    [increaseStr.id]: increaseStr,
  };

  // 1) Single-track: base + STR + Vuln + Crit (no orphan Crit on STR flat)
  {
    const manifests = [
      makeManifestation({
        id: 1,
        tagId: strike.id,
        tagName: strike.tagName,
        valueScalar: 100,
        sourceType: "command card",
      }),
      makeManifestation({
        id: 2,
        tagId: strUp.id,
        tagName: strUp.tagName,
        valueScalar: 20,
        targetType: "aoe",
      }),
      makeManifestation({
        id: 3,
        tagId: vul.id,
        tagName: vul.tagName,
        valueScalar: 1,
        targetType: "aoe",
      }),
      makeManifestation({
        id: 4,
        tagId: crit.id,
        tagName: crit.tagName,
        valueScalar: 0.3,
        targetType: "aoe",
      }),
    ];
    const interactions: DefaultInteraction[] = [
      makeInteraction({
        id: 1,
        modifierTagId: strUp.id,
        modifierTagName: strUp.tagName,
        targetTagId: strike.id,
        targetTagName: strike.tagName,
        mathOperation: "add_scaled",
        defaultFactor: 1,
      }),
      makeInteraction({
        id: 2,
        modifierTagId: vul.id,
        modifierTagName: vul.tagName,
        targetTagId: strike.id,
        targetTagName: strike.tagName,
        mathOperation: "presence_multiply",
        defaultFactor: 1.5,
      }),
      makeInteraction({
        id: 3,
        modifierTagId: crit.id,
        modifierTagName: crit.tagName,
        targetTagId: strike.id,
        targetTagName: strike.tagName,
        mathOperation: "multiply_one_plus",
        defaultFactor: 1,
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: interactions,
      tagsById,
      awakenersById,
    });
    // 100+20=120; ×1.5=180; ×1.3=234
    assert(
      (result.totalsByTagId.get(strike.id) ?? 0) === 234,
      `single-track Strike total (${result.totalsByTagId.get(strike.id)})`,
    );
    const critOps = result.steps.filter(
      (s) =>
        s.kind === "op" &&
        s.op === "multiply_one_plus" &&
        s.modifierTagName === crit.tagName &&
        s.tagId === strike.id,
    );
    assert(critOps.length === 1, `one Crit op on Strike (${critOps.length})`);
    assert(
      critOps[0]?.kind === "op" && critOps[0].before === 180,
      "Crit applies to combined 180 not orphan 23",
    );
  }

  // 2) Two Strike subjects: each gets +STR once
  {
    const manifests = [
      makeManifestation({
        id: 1,
        awakenerId: 1,
        tagId: strike.id,
        tagName: strike.tagName,
        valueScalar: 100,
        sourceType: "command card",
      }),
      makeManifestation({
        id: 2,
        awakenerId: 2,
        tagId: strike.id,
        tagName: strike.tagName,
        valueScalar: 50,
        sourceType: "command card",
      }),
      makeManifestation({
        id: 3,
        tagId: strUp.id,
        tagName: strUp.tagName,
        valueScalar: 20,
        targetType: "aoe",
      }),
    ];
    const interactions: DefaultInteraction[] = [
      makeInteraction({
        id: 1,
        modifierTagId: strUp.id,
        modifierTagName: strUp.tagName,
        targetTagId: strike.id,
        targetTagName: strike.tagName,
        mathOperation: "add_scaled",
        defaultFactor: 1,
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: interactions,
      tagsById,
      awakenersById,
    });
    assert(
      (result.totalsByTagId.get(strike.id) ?? 0) === 190,
      `two subjects each +20 STR (${result.totalsByTagId.get(strike.id)})`,
    );
  }

  // 3) Per-leaf STR override ×10 on one Strike only
  {
    const manifests = [
      makeManifestation({
        id: 1,
        awakenerId: 1,
        tagId: strike.id,
        tagName: strike.tagName,
        valueScalar: 100,
        sourceType: "command card",
        interactionOverrides: [
          {
            id: 1,
            mode: "unique_scaling",
            modifierTagId: strUp.id,
            modifierTagName: strUp.tagName,
            targetTagId: null,
            targetTagName: null,
            layer: null,
            mathOperation: null,
            valueScalar: 10,
            targetType: "aoe",
            dependencyStat: null,
            isDisabled: false,
          },
        ],
      }),
      makeManifestation({
        id: 2,
        awakenerId: 2,
        tagId: strike.id,
        tagName: strike.tagName,
        valueScalar: 100,
        sourceType: "command card",
      }),
      makeManifestation({
        id: 3,
        tagId: strUp.id,
        tagName: strUp.tagName,
        valueScalar: 2,
        targetType: "aoe",
      }),
    ];
    const interactions: DefaultInteraction[] = [
      makeInteraction({
        id: 1,
        modifierTagId: strUp.id,
        modifierTagName: strUp.tagName,
        targetTagId: strike.id,
        targetTagName: strike.tagName,
        mathOperation: "add_scaled",
        defaultFactor: 1,
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: interactions,
      tagsById,
      awakenersById,
    });
    // A: 100+2*10=120; B: 100+2*1=102; sum=222
    assert(
      (result.totalsByTagId.get(strike.id) ?? 0) === 222,
      `per-subject STR override (${result.totalsByTagId.get(strike.id)})`,
    );
  }

  // 4) Two Shield bases + Alert: each Shield +Alert once
  {
    const manifests = [
      makeManifestation({
        id: 1,
        awakenerId: 1,
        tagId: shield.id,
        tagName: shield.tagName,
        valueScalar: 40,
      }),
      makeManifestation({
        id: 2,
        awakenerId: 2,
        tagId: shield.id,
        tagName: shield.tagName,
        valueScalar: 10,
      }),
      makeManifestation({
        id: 3,
        tagId: alert.id,
        tagName: alert.tagName,
        valueScalar: 5,
        targetType: "aoe",
      }),
    ];
    const interactions: DefaultInteraction[] = [
      makeInteraction({
        id: 1,
        modifierTagId: alert.id,
        modifierTagName: alert.tagName,
        targetTagId: shield.id,
        targetTagName: shield.tagName,
        mathOperation: "add_scaled",
        defaultFactor: 1,
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: interactions,
      tagsById,
      awakenersById,
    });
    assert(
      (result.totalsByTagId.get(shield.id) ?? 0) === 60,
      `two Shields each +5 Alert (${result.totalsByTagId.get(shield.id)})`,
    );
  }

  // 5) createsBase=false: Increase Gain → STR with no STR base → no phantom
  {
    const manifests = [
      makeManifestation({
        id: 1,
        tagId: increaseStr.id,
        tagName: increaseStr.tagName,
        valueScalar: 1,
        targetType: "aoe",
      }),
      makeManifestation({
        id: 2,
        tagId: strike.id,
        tagName: strike.tagName,
        valueScalar: 100,
        sourceType: "command card",
      }),
    ];
    const interactions: DefaultInteraction[] = [
      makeInteraction({
        id: 1,
        modifierTagId: increaseStr.id,
        modifierTagName: increaseStr.tagName,
        targetTagId: strUp.id,
        targetTagName: strUp.tagName,
        mathOperation: "multiply_one_plus",
        defaultFactor: 1,
        createsBase: false,
        amplifiesSubject: true,
      }),
      makeInteraction({
        id: 2,
        modifierTagId: strUp.id,
        modifierTagName: strUp.tagName,
        targetTagId: strike.id,
        targetTagName: strike.tagName,
        mathOperation: "add_scaled",
        defaultFactor: 1,
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: interactions,
      tagsById,
      awakenersById,
    });
    assert(
      (result.totalsByTagId.get(strike.id) ?? 0) === 100,
      "Increase Gain does not invent STR Up that buffs Strike",
    );
    assert(
      (result.totalsByTagId.get(strUp.id) ?? 0) === 0,
      "no phantom STR Up total",
    );
  }
}

console.log("creates_base / amplifies_subject — create-once vs per-subject");
{
  const awakener = makeAwakener({ id: 1 });
  const awakener2 = makeAwakener({ id: 2 });
  const awakenersById = buildAwakenersById([awakener, awakener2]);

  const embryo = makeTag(70, "Support.Embryo Fusion", true);
  const aliemu = makeTag(71, "Support.Aliemu", true);
  const tagsById: Record<number, Tag> = {
    [embryo.id]: embryo,
    [aliemu.id]: aliemu,
  };

  const manifests = [
    makeManifestation({
      id: 1,
      awakenerId: 1,
      tagId: aliemu.id,
      tagName: aliemu.tagName,
      valueScalar: 10,
    }),
    makeManifestation({
      id: 2,
      awakenerId: 2,
      tagId: aliemu.id,
      tagName: aliemu.tagName,
      valueScalar: 5,
    }),
    makeManifestation({
      id: 3,
      tagId: embryo.id,
      tagName: embryo.tagName,
      valueScalar: 3,
      targetType: "aoe",
    }),
  ];

  {
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: [
        makeInteraction({
          id: 1,
          modifierTagId: embryo.id,
          modifierTagName: embryo.tagName,
          targetTagId: aliemu.id,
          targetTagName: aliemu.tagName,
          mathOperation: "add_scaled",
          defaultFactor: 1,
          createsBase: true,
          amplifiesSubject: false,
        }),
      ],
      tagsById,
      awakenersById,
    });
    assert(
      (result.totalsByTagId.get(aliemu.id) ?? 0) === 18,
      `creates_base: Aliemu 10+5+3 once (${result.totalsByTagId.get(aliemu.id)})`,
    );
  }

  {
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: [
        makeInteraction({
          id: 1,
          modifierTagId: embryo.id,
          modifierTagName: embryo.tagName,
          targetTagId: aliemu.id,
          targetTagName: aliemu.tagName,
          mathOperation: "add_scaled",
          defaultFactor: 1,
          createsBase: false,
          amplifiesSubject: true,
        }),
      ],
      tagsById,
      awakenersById,
    });
    assert(
      (result.totalsByTagId.get(aliemu.id) ?? 0) === 21,
      `amplifies_subject: Aliemu each +3 (${result.totalsByTagId.get(aliemu.id)})`,
    );
  }
}

console.log("creates_base focused — Tentacle invent + unrestricted Fiamma");
{
  const awakener = makeAwakener({ id: 1, atk: 100 });
  const awakenersById = buildAwakenersById([awakener]);

  const generate = makeTag(58, "Support.Generate Permanent Tentacle");
  const tentacle = makeTag(5, "Attacker.Tentacle");
  const fiamma = makeTag(100, "Support.Fiamma", true);
  const finalDmg = makeTag(14, "Support.Final Damage", true);
  const active = makeTag(42, "Attacker.Active Damage");

  {
    const tagsById: Record<number, Tag> = {
      [generate.id]: generate,
      [tentacle.id]: tentacle,
    };
    const manifests = [
      makeManifestation({
        id: 1,
        tagId: generate.id,
        tagName: generate.tagName,
        valueScalar: 1,
        targetType: "aoe",
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: [
        makeInteraction({
          id: 1,
          modifierTagId: generate.id,
          modifierTagName: generate.tagName,
          targetTagId: tentacle.id,
          targetTagName: tentacle.tagName,
          mathOperation: "add_scaled",
          defaultFactor: 1,
          createsBase: true,
          amplifiesSubject: false,
        }),
      ],
      tagsById,
      awakenersById,
    });
    assert(
      (result.totalsByTagId.get(tentacle.id) ?? 0) === 1,
      `Generate invents Tentacle (${result.totalsByTagId.get(tentacle.id)})`,
    );
  }

  {
    const tagsById: Record<number, Tag> = {
      [fiamma.id]: fiamma,
      [finalDmg.id]: finalDmg,
      [active.id]: active,
    };
    const manifests = [
      makeManifestation({
        id: 1,
        tagId: fiamma.id,
        tagName: fiamma.tagName,
        valueScalar: 1,
        targetType: "aoe",
      }),
      makeManifestation({
        id: 2,
        tagId: active.id,
        tagName: active.tagName,
        valueScalar: 100,
        sourceType: "command card",
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: [
        makeInteraction({
          id: 1,
          modifierTagId: fiamma.id,
          modifierTagName: fiamma.tagName,
          targetTagId: finalDmg.id,
          targetTagName: finalDmg.tagName,
          mathOperation: "multiply_one_plus",
          defaultFactor: 0.3,
          createsBase: true,
          amplifiesSubject: false,
        }),
        makeInteraction({
          id: 2,
          modifierTagId: finalDmg.id,
          modifierTagName: finalDmg.tagName,
          targetTagId: active.id,
          targetTagName: active.tagName,
          mathOperation: "multiply_one_plus",
          defaultFactor: 1,
        }),
      ],
      tagsById,
      awakenersById,
    });
    const fd = result.totalsByTagId.get(finalDmg.id) ?? 0;
    const ad = result.totalsByTagId.get(active.id) ?? 0;
    assert(
      Math.abs(fd - 0.3) < 0.02,
      `unrestricted Fiamma Final merged (${fd})`,
    );
    assert(ad === 130 || ad === 131, `Active amplified by created Final (${ad})`);
  }

  {
    const tagsById: Record<number, Tag> = {
      [fiamma.id]: fiamma,
      [finalDmg.id]: finalDmg,
      [active.id]: active,
    };
    const manifests = [
      makeManifestation({
        id: 1,
        tagId: fiamma.id,
        tagName: fiamma.tagName,
        valueScalar: 1,
        targetType: "aoe",
      }),
      makeManifestation({
        id: 2,
        tagId: finalDmg.id,
        tagName: finalDmg.tagName,
        valueScalar: 0.2,
        targetType: "aoe",
      }),
      makeManifestation({
        id: 3,
        tagId: active.id,
        tagName: active.tagName,
        valueScalar: 100,
        sourceType: "command card",
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: [
        makeInteraction({
          id: 1,
          modifierTagId: fiamma.id,
          modifierTagName: fiamma.tagName,
          targetTagId: finalDmg.id,
          targetTagName: finalDmg.tagName,
          mathOperation: "multiply_one_plus",
          defaultFactor: 0.3,
          createsBase: true,
          amplifiesSubject: false,
        }),
        makeInteraction({
          id: 2,
          modifierTagId: finalDmg.id,
          modifierTagName: finalDmg.tagName,
          targetTagId: active.id,
          targetTagName: active.tagName,
          mathOperation: "multiply_one_plus",
          defaultFactor: 1,
        }),
      ],
      tagsById,
      awakenersById,
    });
    const fd = result.totalsByTagId.get(finalDmg.id) ?? 0;
    // Layer A 0.2 + created ~0.3 (float ceil may yield 0.31)
    assert(
      fd >= 0.5 && fd <= 0.51,
      `Final = Layer A + Fiamma create, not multiplied subject (${fd})`,
    );
  }
}

console.log("\nAll Phase 2b smoke checks passed.");
