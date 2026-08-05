/**
 * Phase 3a.3 — instance_count × effective copies via copy_provider_group members.
 * hitCount applies after Layer B (per-hit interactions).
 * Run: npx tsx scripts/smoke-instances-copies.ts
 */
import { aggregateTagScalarsById } from "../src/lib/path-carver/aggregate-tag-scalars";
import { applyInteractions } from "../src/lib/path-carver/apply-interactions";
import {
  buildHitCountByManifestationKey,
  buildLayerAProviderPool,
  effectiveCopiesForManifestation,
  hitCountForManifestation,
  layerAContribution,
  manifestationHitCountKey,
} from "../src/lib/path-carver/copy-instances";
import { buildAwakenersById } from "../src/lib/path-carver/effective-value-scalar";
import { createManifestationApplyContext } from "../src/lib/path-carver/manifestation-apply";
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

function makeTag(id: number, tagName: string): Tag {
  return { id, tagName, layer: null, isPercent: false, isAdditive: true };
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
    sourceName: partial.sourceName ?? "Test",
    valueScalar: partial.valueScalar ?? 0,
    instanceCount: 1,
    baseCopies: 1,
    copyProviderGroupId: null,
    copyProviderGroupName: null,
    copyProviderTagIds: [],
    dependencyStat: null,
    sourceType: partial.sourceType ?? "command card",
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
    interactionOverrides: [],
    isBaseStatTransfer: false,
    isCreatedBase: false,
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

function main(): void {
  console.log("smoke-instances-copies");

  const damageTag = makeTag(1, "Attacker.Active Damage");
  const providerTag = makeTag(56, "Support.Create.Command Card");
  const tagsById: Record<number, Tag> = {
    [damageTag.id]: damageTag,
    [providerTag.id]: providerTag,
  };

  const awakener = makeAwakener({ id: 1 });
  const awakenersById = buildAwakenersById([awakener]);

  // Provider pool tag contributes 1 (instance 1, copies 1).
  const providerM = makeManifestation({
    id: 10,
    tagId: providerTag.id,
    tagName: providerTag.tagName,
    valueScalar: 1,
    instanceCount: 1,
    baseCopies: 1,
  });

  // Damage ATM: scalar 10, instances 3, base copies 2, group → provider tag.
  const damageM = makeManifestation({
    id: 20,
    tagId: damageTag.id,
    tagName: damageTag.tagName,
    valueScalar: 10,
    instanceCount: 3,
    baseCopies: 2,
    copyProviderGroupId: 1,
    copyProviderGroupName: "Command Card Creates",
    copyProviderTagIds: [providerTag.id],
  });

  const applied = [providerM, damageM];
  const pool = buildLayerAProviderPool(applied, awakenersById, tagsById);
  assert(pool.get(providerTag.id) === 1, "provider poolContrib = 1");
  assert(
    effectiveCopiesForManifestation(damageM, pool) === 3,
    "effectiveCopies = 2 + floor(1) = 3",
  );
  assert(
    hitCountForManifestation(damageM, pool) === 9,
    "hitCount = 3 × 3 = 9",
  );
  assert(
    layerAContribution(damageM, awakenersById, tagsById, pool) === 90,
    "Layer A contribution 10 × hitCount 9 = 90",
  );

  const hitMap = buildHitCountByManifestationKey(applied, pool);
  assert(
    hitMap.get(manifestationHitCountKey(damageM)) === 9,
    "hitCount map damage = 9",
  );
  assert(
    hitMap.get(manifestationHitCountKey(providerM)) === 1,
    "hitCount map provider = 1",
  );
  assert(
    damageM.valueScalar === 10,
    "single-hit base stays 10 (no pre-scale before Layer B)",
  );

  // Same numeric id across sourceKind must not collide (ATM vs realm/wheel).
  {
    const atm = makeManifestation({
      id: 1,
      tagId: damageTag.id,
      tagName: damageTag.tagName,
      valueScalar: 1.5,
      instanceCount: 3,
      baseCopies: 1,
      sourceKind: "awakener",
    });
    const realm = makeManifestation({
      id: 1,
      tagId: providerTag.id,
      tagName: providerTag.tagName,
      valueScalar: 1,
      instanceCount: 1,
      baseCopies: 1,
      sourceKind: "realm",
      awakenerId: null,
    });
    const collidePool = buildLayerAProviderPool(
      [atm, realm],
      awakenersById,
      tagsById,
    );
    const collideMap = buildHitCountByManifestationKey(
      [atm, realm],
      collidePool,
    );
    assert(
      collideMap.get(manifestationHitCountKey(atm)) === 3,
      "composite key: ATM id 1 keeps hitCount 3",
    );
    assert(
      collideMap.get(manifestationHitCountKey(realm)) === 1,
      "composite key: realm id 1 stays hitCount 1",
    );
  }
  const applyContext = createManifestationApplyContext(
    [awakener],
    [awakener.id],
    [],
  );
  const totals = aggregateTagScalarsById(
    applied,
    applyContext,
    [awakener],
    tagsById,
  );
  assert(totals.get(damageTag.id) === 90, "aggregate Layer A damage total = 90");
  assert(totals.get(providerTag.id) === 1, "aggregate provider total = 1");

  // Identity path: no group, 1×1 → hitCount 1.
  const plain = makeManifestation({
    id: 30,
    tagId: damageTag.id,
    tagName: damageTag.tagName,
    valueScalar: 5,
  });
  const plainPool = buildLayerAProviderPool([plain], awakenersById, tagsById);
  assert(
    hitCountForManifestation(plain, plainPool) === 1,
    "identity hitCount = 1",
  );

  // Layer B: single-hit base 10, hitCount 3, add_scaled +5 → 3×(10+5)=45 (not 35).
  console.log("\nadd_scaled after Layer B × hitCount");
  {
    const strUp = makeTag(30, "Support.STR Up");
    const active = makeTag(42, "Attacker.Active Damage");
    const layerBTags: Record<number, Tag> = {
      [strUp.id]: strUp,
      [active.id]: active,
    };
    const subject = makeManifestation({
      id: 100,
      tagId: active.id,
      tagName: active.tagName,
      valueScalar: 10,
      instanceCount: 3,
      baseCopies: 1,
    });
    const modifier = makeManifestation({
      id: 101,
      tagId: strUp.id,
      tagName: strUp.tagName,
      valueScalar: 5,
    });
    const manifests = [subject, modifier];
    const layerBPool = buildLayerAProviderPool(
      manifests,
      awakenersById,
      layerBTags,
    );
    const hitCountByKey = buildHitCountByManifestationKey(
      manifests,
      layerBPool,
    );
    assert(
      hitCountByKey.get(manifestationHitCountKey(subject)) === 3,
      "add_scaled case hitCount = 3",
    );
    assert(
      subject.valueScalar === 10,
      "add_scaled case: no pre-scale before amplify",
    );

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
          amplifiesSubject: true,
          createsBase: false,
        }),
      ],
      tagsById: layerBTags,
      awakenersById,
      hitCountByManifestationKey: hitCountByKey,
    });
    assert(
      (result.totalsByTagId.get(active.id) ?? 0) === 45,
      `add_scaled 10+5 × hitCount 3 → 45 (got ${result.totalsByTagId.get(active.id)})`,
    );
    // Pre-scale bug would yield 3×10+5 = 35.
    assert(
      (result.totalsByTagId.get(active.id) ?? 0) !== 35,
      "not the pre-scale-before-amplify result 35",
    );
    const hitStep = result.steps.find(
      (s) => s.kind === "hitCount" && s.tagId === active.id,
    );
    assert(hitStep != null && hitStep.kind === "hitCount", "hitCount debug step present");
    if (hitStep?.kind === "hitCount") {
      assert(hitStep.finishedOnce === 15, "hitCount step finishedOnce = 15");
      assert(hitStep.hitCount === 3, "hitCount step hitCount = 3");
      assert(hitStep.after === 45, "hitCount step after = 45");
    }
  }

  console.log("\nAll smoke-instances-copies checks passed.");
}

main();
