/**
 * Post-pass same-tag merge via tag.is_additive.
 * Run: npx tsx scripts/smoke-is-additive.ts
 */
import { applyInteractions } from "../src/lib/path-carver/apply-interactions";
import { combineSameTagScalar } from "../src/lib/path-carver/combine-same-tag-scalar";
import { buildAwakenersById } from "../src/lib/path-carver/effective-value-scalar";
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

function makeTag(
  id: number,
  tagName: string,
  opts: { isPercent?: boolean; isAdditive?: boolean } = {},
): Tag {
  return {
    id,
    tagName,
    layer: null,
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
  },
): DefaultInteraction {
  return {
    exclusionTagId: null,
    exclusionTagName: null,
    mathOperation: partial.mathOperation ?? "add_scaled",
    defaultFactor: partial.defaultFactor ?? 1,
    buffTargetTypeRestriction: null,
    createsBase: partial.createsBase ?? false,
    amplifiesSubject: partial.amplifiesSubject ?? true,
    ...partial,
  };
}

console.log("combineSameTagScalar helper");
{
  assert(combineSameTagScalar(undefined, 0.1, true, true) === 0.1, "first value");
  assert(
    Math.abs(combineSameTagScalar(0.1, 0.2, true, true) - 0.3) < 1e-12,
    "additive percent",
  );
  assert(
    combineSameTagScalar(0.1, 0.2, false, true) === 0.33,
    "multiplicative percent fold-back ceil (0.1,0.2 → 0.33)",
  );
  assert(combineSameTagScalar(2, 3, false, false) === 6, "multiplicative flat");
  assert(combineSameTagScalar(100, 50, true, false) === 150, "additive flat");
}

console.log("\nPost-pass merge via applyInteractions");
{
  const a1 = makeAwakener({ id: 1, atk: 100 });
  const a2 = makeAwakener({ id: 2, atk: 100 });
  const awakenersById = buildAwakenersById([a1, a2]);

  {
    const active = makeTag(42, "Attacker.Active Damage", { isAdditive: true });
    const tagsById = { [active.id]: active };
    const manifests = [
      makeManifestation({
        id: 1,
        awakenerId: 1,
        tagId: active.id,
        tagName: active.tagName,
        valueScalar: 100,
      }),
      makeManifestation({
        id: 2,
        awakenerId: 2,
        tagId: active.id,
        tagName: active.tagName,
        valueScalar: 50,
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: [],
      tagsById,
      awakenersById,
    });
    assert(
      (result.totalsByTagId.get(active.id) ?? 0) === 150,
      `additive Active Damage 100+50 (${result.totalsByTagId.get(active.id)})`,
    );
  }

  {
    const bonus = makeTag(17, "Support.Crit Damage", {
      isPercent: true,
      isAdditive: false,
    });
    const tagsById = { [bonus.id]: bonus };
    const manifests = [
      makeManifestation({
        id: 1,
        awakenerId: 1,
        tagId: bonus.id,
        tagName: bonus.tagName,
        valueScalar: 0.1,
      }),
      makeManifestation({
        id: 2,
        awakenerId: 2,
        tagId: bonus.id,
        tagName: bonus.tagName,
        valueScalar: 0.2,
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: [],
      tagsById,
      awakenersById,
    });
    assert(
      (result.totalsByTagId.get(bonus.id) ?? 0) === 0.33,
      `multiplicative percent 0.1,0.2 → 0.33 (${result.totalsByTagId.get(bonus.id)})`,
    );
  }

  {
    const flat = makeTag(99, "Support.Flat Multi", { isAdditive: false });
    const tagsById = { [flat.id]: flat };
    const manifests = [
      makeManifestation({
        id: 1,
        awakenerId: 1,
        tagId: flat.id,
        tagName: flat.tagName,
        valueScalar: 2,
      }),
      makeManifestation({
        id: 2,
        awakenerId: 2,
        tagId: flat.id,
        tagName: flat.tagName,
        valueScalar: 3,
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: [],
      tagsById,
      awakenersById,
    });
    assert(
      (result.totalsByTagId.get(flat.id) ?? 0) === 6,
      `multiplicative flat 2*3 (${result.totalsByTagId.get(flat.id)})`,
    );
  }

  {
    // Passes first: each Active Damage gets STR Up add_scaled, then additive merge.
    const strUp = makeTag(30, "Support.STR Up");
    const active = makeTag(42, "Attacker.Active Damage", { isAdditive: true });
    const tagsById = { [strUp.id]: strUp, [active.id]: active };
    const manifests = [
      makeManifestation({
        id: 1,
        awakenerId: 1,
        tagId: active.id,
        tagName: active.tagName,
        valueScalar: 100,
      }),
      makeManifestation({
        id: 2,
        awakenerId: 2,
        tagId: active.id,
        tagName: active.tagName,
        valueScalar: 50,
      }),
      makeManifestation({
        id: 3,
        awakenerId: 1,
        tagId: strUp.id,
        tagName: strUp.tagName,
        valueScalar: 10,
        targetType: "aoe",
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: [
        makeInteraction({
          id: 1,
          modifierTagId: strUp.id,
          modifierTagName: strUp.tagName,
          targetTagId: active.id,
          targetTagName: active.tagName,
          mathOperation: "add_scaled",
          defaultFactor: 1,
        }),
      ],
      tagsById,
      awakenersById,
    });
    // Each Active subject runs with STR Up in cohort → 100+10 and 50+10, then add → 170
    assert(
      (result.totalsByTagId.get(active.id) ?? 0) === 170,
      `post-pass then additive: (100+10)+(50+10)=170 (${result.totalsByTagId.get(active.id)})`,
    );
  }

  {
    const strUp = makeTag(30, "Support.STR Up");
    const active = makeTag(42, "Attacker.Active Damage", {
      isAdditive: false,
    });
    const tagsById = { [strUp.id]: strUp, [active.id]: active };
    const manifests = [
      makeManifestation({
        id: 1,
        awakenerId: 1,
        tagId: active.id,
        tagName: active.tagName,
        valueScalar: 10,
      }),
      makeManifestation({
        id: 2,
        awakenerId: 2,
        tagId: active.id,
        tagName: active.tagName,
        valueScalar: 3,
      }),
      makeManifestation({
        id: 3,
        awakenerId: 1,
        tagId: strUp.id,
        tagName: strUp.tagName,
        valueScalar: 2,
        targetType: "aoe",
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: [
        makeInteraction({
          id: 1,
          modifierTagId: strUp.id,
          modifierTagName: strUp.tagName,
          targetTagId: active.id,
          targetTagName: active.tagName,
          mathOperation: "add_scaled",
          defaultFactor: 1,
        }),
      ],
      tagsById,
      awakenersById,
    });
    // (10+2)*(3+2)=12*5=60 after ceil
    assert(
      (result.totalsByTagId.get(active.id) ?? 0) === 60,
      `post-pass then multiplicative flat: 12*5=60 (${result.totalsByTagId.get(active.id)})`,
    );
  }
}

console.log("\nIn-pass modifier collapse via is_additive");
{
  const a1 = makeAwakener({ id: 1 });
  const a2 = makeAwakener({ id: 2 });
  const awakenersById = buildAwakenersById([a1, a2]);

  {
    // Cross-owner: two Base Damage 0.2 (multiplicative percent) → mod 0.44 on Active.
    const baseDmg = makeTag(80, "Support.Base Damage", {
      isPercent: true,
      isAdditive: false,
    });
    const active = makeTag(42, "Attacker.Active Damage", { isAdditive: true });
    const tagsById = { [baseDmg.id]: baseDmg, [active.id]: active };
    const manifests = [
      makeManifestation({
        id: 1,
        awakenerId: 1,
        tagId: active.id,
        tagName: active.tagName,
        valueScalar: 100,
        sourceType: "exalt",
      }),
      makeManifestation({
        id: 2,
        awakenerId: 1,
        tagId: baseDmg.id,
        tagName: baseDmg.tagName,
        valueScalar: 0.2,
        targetType: "aoe",
      }),
      makeManifestation({
        id: 3,
        awakenerId: 2,
        tagId: baseDmg.id,
        tagName: baseDmg.tagName,
        valueScalar: 0.2,
        targetType: "aoe",
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: [
        makeInteraction({
          id: 1,
          modifierTagId: baseDmg.id,
          modifierTagName: baseDmg.tagName,
          targetTagId: active.id,
          targetTagName: active.tagName,
          mathOperation: "multiply_one_plus",
          defaultFactor: 1,
        }),
      ],
      tagsById,
      awakenersById,
    });
    const baseOp = result.steps.find(
      (s) =>
        s.kind === "op" &&
        s.tagId === active.id &&
        s.modifierTagName === baseDmg.tagName,
    );
    assert(
      baseOp?.kind === "op" && baseOp.modifierValue === 0.44,
      `cross-owner Base Damage modValue 0.44 not 0.4 (${baseOp?.kind === "op" ? baseOp.modifierValue : "missing"})`,
    );
    // 100 * (1+0.44) = 144
    assert(
      (result.totalsByTagId.get(active.id) ?? 0) === 144,
      `Active with mod 0.44 → 144 (${result.totalsByTagId.get(active.id)})`,
    );
    assert(
      (result.totalsByTagId.get(baseDmg.id) ?? 0) === 0.44,
      `Base Damage scalar sum 0.44 (${result.totalsByTagId.get(baseDmg.id)})`,
    );
  }

  {
    // Same-owner duplicate Base Damage modifiers.
    const baseDmg = makeTag(80, "Support.Base Damage", {
      isPercent: true,
      isAdditive: false,
    });
    const active = makeTag(42, "Attacker.Active Damage", { isAdditive: true });
    const tagsById = { [baseDmg.id]: baseDmg, [active.id]: active };
    const manifests = [
      makeManifestation({
        id: 1,
        awakenerId: 1,
        tagId: active.id,
        tagName: active.tagName,
        valueScalar: 100,
        sourceType: "exalt",
      }),
      makeManifestation({
        id: 2,
        awakenerId: 1,
        tagId: baseDmg.id,
        tagName: baseDmg.tagName,
        valueScalar: 0.2,
        targetType: "aoe",
      }),
      makeManifestation({
        id: 3,
        awakenerId: 1,
        tagId: baseDmg.id,
        tagName: baseDmg.tagName,
        valueScalar: 0.2,
        targetType: "aoe",
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: [
        makeInteraction({
          id: 1,
          modifierTagId: baseDmg.id,
          modifierTagName: baseDmg.tagName,
          targetTagId: active.id,
          targetTagName: active.tagName,
          mathOperation: "multiply_one_plus",
          defaultFactor: 1,
        }),
      ],
      tagsById,
      awakenersById,
    });
    const baseOp = result.steps.find(
      (s) =>
        s.kind === "op" &&
        s.tagId === active.id &&
        s.modifierTagName === baseDmg.tagName,
    );
    assert(
      baseOp?.kind === "op" && baseOp.modifierValue === 0.44,
      `same-owner Base Damage modValue 0.44 (${baseOp?.kind === "op" ? baseOp.modifierValue : "missing"})`,
    );
    assert(
      (result.totalsByTagId.get(active.id) ?? 0) === 144,
      `same-owner Active → 144 (${result.totalsByTagId.get(active.id)})`,
    );
  }

  {
    // Additive modifier still sums (0.2+0.2=0.4).
    const baseDmg = makeTag(80, "Support.Base Damage", {
      isPercent: true,
      isAdditive: true,
    });
    const active = makeTag(42, "Attacker.Active Damage", { isAdditive: true });
    const tagsById = { [baseDmg.id]: baseDmg, [active.id]: active };
    const manifests = [
      makeManifestation({
        id: 1,
        awakenerId: 1,
        tagId: active.id,
        tagName: active.tagName,
        valueScalar: 100,
        sourceType: "exalt",
      }),
      makeManifestation({
        id: 2,
        awakenerId: 1,
        tagId: baseDmg.id,
        tagName: baseDmg.tagName,
        valueScalar: 0.2,
        targetType: "aoe",
      }),
      makeManifestation({
        id: 3,
        awakenerId: 2,
        tagId: baseDmg.id,
        tagName: baseDmg.tagName,
        valueScalar: 0.2,
        targetType: "aoe",
      }),
    ];
    const result = applyInteractions({
      manifestations: manifests,
      appliedManifestations: manifests,
      defaultInteractions: [
        makeInteraction({
          id: 1,
          modifierTagId: baseDmg.id,
          modifierTagName: baseDmg.tagName,
          targetTagId: active.id,
          targetTagName: active.tagName,
          mathOperation: "multiply_one_plus",
          defaultFactor: 1,
        }),
      ],
      tagsById,
      awakenersById,
    });
    const baseOp = result.steps.find(
      (s) =>
        s.kind === "op" &&
        s.tagId === active.id &&
        s.modifierTagName === baseDmg.tagName,
    );
    assert(
      baseOp?.kind === "op" &&
        Math.abs(baseOp.modifierValue - 0.4) < 1e-12,
      `additive Base Damage modValue 0.4 (${baseOp?.kind === "op" ? baseOp.modifierValue : "missing"})`,
    );
    // 100 * 1.4 = 140
    assert(
      (result.totalsByTagId.get(active.id) ?? 0) === 140,
      `additive mod Active → 140 (${result.totalsByTagId.get(active.id)})`,
    );
  }
}

console.log("\nAll is_additive smoke checks passed.");
