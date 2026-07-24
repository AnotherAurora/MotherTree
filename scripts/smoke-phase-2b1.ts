/**
 * Phase 2b.1 smoke — awakener total base stats (gear + DR + Special.Increase)
 * + synthetic base-stat transfers.
 * Run: npx tsx scripts/smoke-phase-2b1.ts
 */
import { applyInteractions } from "../src/lib/path-carver/apply-interactions";
import {
  applyKeyflareDiminishingReturn,
  buildBaseStatTransferManifestations,
  computeAwakenerTotalBaseStats,
  SPECIAL_INCREASE_BASE_KEYFLARE_TAG_ID,
} from "../src/lib/path-carver/awakener-base-stats";
import {
  buildAwakenersById,
  scaleValueScalar,
} from "../src/lib/path-carver/effective-value-scalar";
import type {
  Awakener,
  DefaultInteraction,
  GearStatContribution,
  Manifestation,
  Tag,
  TeamData,
} from "../src/lib/team-data/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
}

function makeAwakener(partial: Partial<Awakener> & { id: number }): Awakener {
  return {
    name: partial.name ?? `A${partial.id}`,
    realm: partial.realm ?? "chaos",
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
  isPercent = false,
  isAdditive = true,
): Tag {
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
    replacesManifestationId: null,
    interactionOverrides: partial.interactionOverrides ?? [],
    isBaseStatTransfer: partial.isBaseStatTransfer ?? false,
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
    substitute: partial.substitute ?? true,
    oncePerBase: partial.oncePerBase ?? true,
    ...partial,
  };
}

console.log("Keyflare diminishing return");
{
  assert(applyKeyflareDiminishingReturn(15) === 15, "x=15 → 15");
  const x = 144;
  const expected = Math.ceil(15 + (144 * (x - 15)) / (x + 129));
  assert(
    applyKeyflareDiminishingReturn(x) === expected,
    `x=144 → ${expected}`,
  );
}

console.log("\nGear sum into total base stats");
{
  const awakener = makeAwakener({ id: 1, atk: 100, keyflareRegen: 15 });
  const contributions: GearStatContribution[] = [
    {
      awakenerId: 1,
      sourceKind: "wheel",
      entityId: 10,
      stat: "atk",
      statAmount: 10,
    },
    {
      awakenerId: 1,
      sourceKind: "wheel",
      entityId: 11,
      stat: "atk",
      statAmount: 20,
    },
    {
      awakenerId: 1,
      sourceKind: "covenant",
      entityId: 20,
      stat: "atk",
      statAmount: 5,
    },
  ];
  const teamSlice: Pick<TeamData, "awakeners" | "gearStatContributions"> = {
    awakeners: [awakener],
    gearStatContributions: contributions,
  };
  const [total] = computeAwakenerTotalBaseStats(teamSlice, []);
  assert(total.atk === 135, `atk 100+10+20+5 = 135 (got ${total.atk})`);
  assert(
    total.keyflareRegen === 15,
    `keyflare DR at floor stays 15 (got ${total.keyflareRegen})`,
  );
}

console.log("\nSpecial.Increase Base Keyflare stacking (additive on original)");
{
  const awakener = makeAwakener({ id: 1, keyflareRegen: 15 });
  const specialTag = makeTag(
    SPECIAL_INCREASE_BASE_KEYFLARE_TAG_ID,
    "Special.Increase Base Keyflare",
  );
  const applied = [
    makeManifestation({
      id: 1,
      tagId: specialTag.id,
      tagName: specialTag.tagName,
      valueScalar: 0.1,
    }),
    makeManifestation({
      id: 2,
      tagId: specialTag.id,
      tagName: specialTag.tagName,
      valueScalar: 0.2,
    }),
  ];
  const [total] = computeAwakenerTotalBaseStats(
    { awakeners: [awakener], gearStatContributions: [] },
    applied,
  );
  assert(
    total.keyflareRegen === 20,
    `ceil(15 * 1.3) = 20 (got ${total.keyflareRegen})`,
  );
}

console.log("\ndependency_stat uses post–Special.Increase keyflare");
{
  const awakener = makeAwakener({ id: 1, keyflareRegen: 15 });
  const specialTag = makeTag(
    SPECIAL_INCREASE_BASE_KEYFLARE_TAG_ID,
    "Special.Increase Base Keyflare",
  );
  const applied = [
    makeManifestation({
      id: 1,
      tagId: specialTag.id,
      tagName: specialTag.tagName,
      valueScalar: 0.1,
    }),
  ];
  const [total] = computeAwakenerTotalBaseStats(
    { awakeners: [awakener], gearStatContributions: [] },
    applied,
  );
  // ceil(15 * 1.1) = 17; raw 2 * 17 → 34
  assert(
    scaleValueScalar(2, "keyflare_regen", total, "awakener") === 34,
    `keyflare dep after boost: 2 * 17 → 34 (got ${scaleValueScalar(2, "keyflare_regen", total, "awakener")})`,
  );
}

console.log("\nSynthetic transfers + interaction immunity / modifier role");
{
  const critDmgTag = makeTag(17, "Support.Crit Damage", true);
  const aliemusTag = makeTag(28, "Support.Aliemus", true);
  const increaseAliemus = makeTag(99, "Support.Increase Gain.Aliemus", true);
  const activeTag = makeTag(42, "Attacker.Active Damage");

  const tagsById: Record<number, Tag> = {
    [critDmgTag.id]: critDmgTag,
    [aliemusTag.id]: aliemusTag,
    [increaseAliemus.id]: increaseAliemus,
    [activeTag.id]: activeTag,
  };

  const awakener = makeAwakener({
    id: 1,
    critDmg: 0.5,
    aliemusRegen: 0.2,
  });
  const [total] = computeAwakenerTotalBaseStats(
    { awakeners: [awakener], gearStatContributions: [] },
    [],
  );
  const transfers = buildBaseStatTransferManifestations([total], tagsById);
  const syntheticCrit = transfers.find((m) => m.tagId === 17);
  const syntheticAliemus = transfers.find((m) => m.tagId === 28);
  assert(syntheticCrit != null, "synthetic Support.Crit Damage present");
  assert(syntheticAliemus != null, "synthetic Support.Aliemus present");
  assert(
    syntheticCrit!.targetType === "self",
    "crit_dmg transfer target_type=self",
  );
  assert(
    syntheticAliemus!.valueScalar === 0.2,
    "aliemus transfer value matches base",
  );

  const active = makeManifestation({
    id: 100,
    tagId: activeTag.id,
    tagName: activeTag.tagName,
    valueScalar: 100,
    sourceType: "command card",
  });
  const increase = makeManifestation({
    id: 101,
    tagId: increaseAliemus.id,
    tagName: increaseAliemus.tagName,
    valueScalar: 0.5,
    targetType: "self",
  });

  const applied = [active, increase, syntheticCrit!, syntheticAliemus!];
  const awakenersById = buildAwakenersById([total]);

  const result = applyInteractions({
    manifestations: applied,
    appliedManifestations: applied,
    defaultInteractions: [
      makeInteraction({
        id: 1,
        modifierTagId: critDmgTag.id,
        modifierTagName: critDmgTag.tagName,
        targetTagId: activeTag.id,
        targetTagName: activeTag.tagName,
        mathOperation: "multiply_one_plus",
        defaultFactor: 1,
      }),
      makeInteraction({
        id: 2,
        modifierTagId: increaseAliemus.id,
        modifierTagName: increaseAliemus.tagName,
        targetTagId: aliemusTag.id,
        targetTagName: aliemusTag.tagName,
        mathOperation: "add_scaled",
        defaultFactor: 1,
      }),
    ],
    tagsById,
    awakenersById,
  });

  // Active Damage boosted by synthetic Crit Damage 0.5 → 100 * (1+0.5) = 150
  assert(
    (result.totalsByTagId.get(activeTag.id) ?? 0) === 150,
    `synthetic Crit Damage modifies Active (${result.totalsByTagId.get(activeTag.id)})`,
  );
  // Synthetic Aliemus stays 0.2 — Increase Gain must not change transfer subject
  assert(
    (result.totalsByTagId.get(aliemusTag.id) ?? 0) === 0.2,
    `synthetic Aliemus immune to Increase Gain (${result.totalsByTagId.get(aliemusTag.id)})`,
  );
}

console.log("\nAll Phase 2b.1 smoke checks passed.");
