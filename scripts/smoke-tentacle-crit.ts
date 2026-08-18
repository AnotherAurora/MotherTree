/**
 * Phase 3f smoke — Tentacle Crit Rate / Tentacle Crit Damage.
 * Run: npx tsx scripts/smoke-tentacle-crit.ts
 */
import { applyInteractions } from "../src/lib/path-carver/apply-interactions";
import { buildAwakenersById } from "../src/lib/path-carver/effective-value-scalar";
import {
  ATTACKER_TENTACLE_TAG_ID,
  SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID,
  TENTACLE_TDU_FAMILY_POOL_LABEL,
} from "../src/lib/path-carver/hit-tentacle-attack";
import {
  computeTentacleCritDamage,
  computeTentacleCritRate,
  formatTentacleCritDetail,
  SUPPORT_CRIT_DAMAGE_TAG_ID,
  SUPPORT_CRIT_RATE_TAG_ID,
  TENTACLE_CRIT_DAMAGE_LABEL,
  TENTACLE_CRIT_RATE_LABEL,
  type ComputeTentacleCritInput,
} from "../src/lib/path-carver/tentacle-crit";
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

const critDmgTag = makeTag(SUPPORT_CRIT_DAMAGE_TAG_ID, "Support.Crit Damage", {
  isPercent: true,
});
const critRateTag = makeTag(SUPPORT_CRIT_RATE_TAG_ID, "Support.Crit Rate", {
  isPercent: true,
});
const critDmgStrikeTag = makeTag(141, "Support.Crit Damage.Strike", {
  isPercent: true,
});
const tentacleTag = makeTag(ATTACKER_TENTACLE_TAG_ID, "Attacker.Tentacle", {
  layer: "pre_add",
});
const tduTag = makeTag(
  SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID,
  "Support.Tentacle Damage Up",
);
const vulnTag = makeTag(200, "Support.Debuff.Tentacle Vulnerability", {
  isPercent: true,
});

const tagsById: Record<number, Tag> = {
  [critDmgTag.id]: critDmgTag,
  [critRateTag.id]: critRateTag,
  [critDmgStrikeTag.id]: critDmgStrikeTag,
  [tentacleTag.id]: tentacleTag,
  [tduTag.id]: tduTag,
  [vulnTag.id]: vulnTag,
};

const vulnToTentacle = makeInteraction({
  id: 73,
  modifierTagId: vulnTag.id,
  modifierTagName: vulnTag.tagName,
  targetTagId: tentacleTag.id,
  targetTagName: tentacleTag.tagName,
  mathOperation: "multiply_one_plus",
});

function emptyInput(
  extra: Partial<ComputeTentacleCritInput> & {
    awakeners: ComputeTentacleCritInput["awakeners"];
    appliedManifestations?: readonly Manifestation[];
  },
): ComputeTentacleCritInput {
  const awakeners = extra.awakeners as Awakener[];
  return {
    appliedManifestations: extra.appliedManifestations ?? [],
    awakenersById: extra.awakenersById ?? buildAwakenersById(awakeners),
    tagsById: extra.tagsById ?? tagsById,
    ...extra,
  };
}

console.log("Part A — base only: 4 × 0.4 critDmg → ceil(1.6/2)=1");
{
  const awakeners = [1, 2, 3, 4].map((id) =>
    makeAwakener({ id, critDmg: 0.4 }),
  );
  const dmg = computeTentacleCritDamage(emptyInput({ awakeners }));
  assert(dmg.baseSum === 1.6, `baseSum 1.6 (got ${dmg.baseSum})`);
  assert(dmg.basePart === 1, `basePart ceil(1.6/2)=1 (got ${dmg.basePart})`);
  assert(dmg.supportPart === 0, "no support");
  assert(dmg.total === 1, `total 1 (got ${dmg.total})`);
}

console.log("Part B — Support self /4: two 0.2 self → ceil(0.4/4)=1");
{
  const a1 = makeAwakener({ id: 1 });
  const a2 = makeAwakener({ id: 2 });
  const rows = [
    makeManifestation({
      id: 1,
      awakenerId: 1,
      tagId: critDmgTag.id,
      tagName: critDmgTag.tagName,
      valueScalar: 0.2,
      targetType: "self",
    }),
    makeManifestation({
      id: 2,
      awakenerId: 2,
      tagId: critDmgTag.id,
      tagName: critDmgTag.tagName,
      valueScalar: 0.2,
      targetType: "self",
    }),
  ];
  const dmg = computeTentacleCritDamage(
    emptyInput({ awakeners: [a1, a2], appliedManifestations: rows }),
  );
  assert(dmg.supportNonAoeSum === 0.4, `nonAoe 0.4 (got ${dmg.supportNonAoeSum})`);
  assert(
    dmg.supportNonAoePart === 1,
    `nonAoePart ceil(0.4/4)=1 (got ${dmg.supportNonAoePart})`,
  );
  assert(dmg.supportAoeSum === 0, "aoe empty");
  assert(dmg.total === 1, `total 1 (got ${dmg.total})`);
}

console.log("Part C — Support aoe direct: 0.3 aoe, no /4");
{
  const a1 = makeAwakener({ id: 1 });
  const row = makeManifestation({
    id: 1,
    tagId: critDmgTag.id,
    tagName: critDmgTag.tagName,
    valueScalar: 0.3,
    targetType: "aoe",
  });
  const dmg = computeTentacleCritDamage(
    emptyInput({ awakeners: [a1], appliedManifestations: [row] }),
  );
  assert(dmg.supportAoeSum === 0.3, `aoe 0.3 (got ${dmg.supportAoeSum})`);
  assert(dmg.supportNonAoeSum === 0, "nonAoe empty");
  assert(dmg.total === 0.3, `total 0.3 (got ${dmg.total})`);
}

console.log("Part D — mixed aoe 0.25 + self 0.8 → 0.25 + ceil(0.8/4)=1.25");
{
  const a1 = makeAwakener({ id: 1 });
  const rows = [
    makeManifestation({
      id: 1,
      tagId: critDmgTag.id,
      tagName: critDmgTag.tagName,
      valueScalar: 0.25,
      targetType: "aoe",
    }),
    makeManifestation({
      id: 2,
      tagId: critDmgTag.id,
      tagName: critDmgTag.tagName,
      valueScalar: 0.8,
      targetType: "self",
    }),
  ];
  const dmg = computeTentacleCritDamage(
    emptyInput({ awakeners: [a1], appliedManifestations: rows }),
  );
  assert(dmg.supportAoeSum === 0.25, `aoe 0.25 (got ${dmg.supportAoeSum})`);
  assert(dmg.supportNonAoeSum === 0.8, `nonAoe 0.8 (got ${dmg.supportNonAoeSum})`);
  assert(dmg.supportPart === 1.25, `supportPart 1.25 (got ${dmg.supportPart})`);
  assert(dmg.total === 1.25, `total 1.25 (got ${dmg.total})`);
}

console.log("Part E — descendant Support.Crit Damage.Strike excluded");
{
  const a1 = makeAwakener({ id: 1 });
  const row = makeManifestation({
    id: 1,
    tagId: critDmgStrikeTag.id,
    tagName: critDmgStrikeTag.tagName,
    valueScalar: 0.9,
    targetType: "aoe",
  });
  const dmg = computeTentacleCritDamage(
    emptyInput({ awakeners: [a1], appliedManifestations: [row] }),
  );
  assert(dmg.total === 0, `descendant excluded (got ${dmg.total})`);
}

console.log("Part F — base-stat transfer on tag 17 excluded from support");
{
  const a1 = makeAwakener({ id: 1, critDmg: 0.4 });
  const transfer = makeManifestation({
    id: 1,
    tagId: critDmgTag.id,
    tagName: critDmgTag.tagName,
    valueScalar: 0.4,
    targetType: "self",
    isBaseStatTransfer: true,
  });
  const dmg = computeTentacleCritDamage(
    emptyInput({ awakeners: [a1], appliedManifestations: [transfer] }),
  );
  assert(dmg.basePart === 1, `basePart ceil(0.4/2)=1 (got ${dmg.basePart})`);
  assert(dmg.supportPart === 0, "transfer not in support");
  assert(dmg.total === 1, `total 1 (got ${dmg.total})`);
}

console.log("Part G — buffTargetTypeRestriction strict skip (even tentacle)");
{
  const a1 = makeAwakener({ id: 1 });
  const restricted = makeManifestation({
    id: 1,
    tagId: critDmgTag.id,
    tagName: critDmgTag.tagName,
    valueScalar: 0.5,
    targetType: "aoe",
    buffTargetTypeRestriction: "tentacle",
  });
  const allowed = makeManifestation({
    id: 2,
    tagId: critDmgTag.id,
    tagName: critDmgTag.tagName,
    valueScalar: 0.1,
    targetType: "aoe",
  });
  const dmg = computeTentacleCritDamage(
    emptyInput({
      awakeners: [a1],
      appliedManifestations: [restricted, allowed],
    }),
  );
  assert(dmg.supportAoeSum === 0.1, `only null-restriction 0.1 (got ${dmg.supportAoeSum})`);
  assert(dmg.total === 0.1, `total 0.1 (got ${dmg.total})`);
}

console.log("Part H — single and null use /4 bucket");
{
  const a1 = makeAwakener({ id: 1 });
  const rows = [
    makeManifestation({
      id: 1,
      tagId: critDmgTag.id,
      tagName: critDmgTag.tagName,
      valueScalar: 0.2,
      targetType: "single",
    }),
    makeManifestation({
      id: 2,
      tagId: critDmgTag.id,
      tagName: critDmgTag.tagName,
      valueScalar: 0.2,
      targetType: null,
    }),
  ];
  const dmg = computeTentacleCritDamage(
    emptyInput({ awakeners: [a1], appliedManifestations: rows }),
  );
  assert(dmg.supportNonAoeSum === 0.4, `single+null 0.4 (got ${dmg.supportNonAoeSum})`);
  assert(dmg.supportAoeSum === 0, "not aoe");
  assert(dmg.supportNonAoePart === 1, "ceil(0.4/4)=1");
}

console.log("Part I — crit rate uses same buckets on tag 18 / critRate");
{
  const awakeners = [1, 2, 3, 4].map((id) =>
    makeAwakener({ id, critRate: 0.4 }),
  );
  const rows = [
    makeManifestation({
      id: 10,
      tagId: critRateTag.id,
      tagName: critRateTag.tagName,
      valueScalar: 0.25,
      targetType: "aoe",
    }),
    makeManifestation({
      id: 11,
      tagId: critRateTag.id,
      tagName: critRateTag.tagName,
      valueScalar: 0.8,
      targetType: "self",
    }),
    makeManifestation({
      id: 12,
      tagId: critDmgTag.id,
      tagName: critDmgTag.tagName,
      valueScalar: 9,
      targetType: "aoe",
    }),
  ];
  const rate = computeTentacleCritRate(
    emptyInput({ awakeners, appliedManifestations: rows }),
  );
  assert(rate.basePart === 1, `rate basePart 1 (got ${rate.basePart})`);
  assert(rate.supportPart === 1.25, `rate support 1.25 (got ${rate.supportPart})`);
  assert(rate.total === 2.25, `rate total 2.25 (got ${rate.total})`);
  const dmg = computeTentacleCritDamage(
    emptyInput({ awakeners, appliedManifestations: rows }),
  );
  assert(dmg.basePart === 0, "critDmg base empty");
  assert(dmg.total === 9, "crit damage ATM not mixed into rate");
}

console.log("Part J — tentacle × TDU then × (1+critDmg): 10×2×1.5=30");
{
  const awakener = makeAwakener({ id: 1 });
  const tentacle = makeManifestation({
    id: 1,
    tagId: tentacleTag.id,
    tagName: tentacleTag.tagName,
    valueScalar: 10,
  });
  const tdu = makeManifestation({
    id: 2,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 2,
    targetType: "aoe",
  });
  const crit = makeManifestation({
    id: 3,
    tagId: critDmgTag.id,
    tagName: critDmgTag.tagName,
    valueScalar: 0.5,
    targetType: "aoe",
  });
  const manifests = [tentacle, tdu, crit];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 30,
    `Tentacle 10×2×1.5=30 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
  const critOps = result.steps.filter(
    (s) =>
      s.kind === "op" &&
      s.tagName === tentacleTag.tagName &&
      s.modifierTagName === TENTACLE_CRIT_DAMAGE_LABEL,
  );
  assert(
    critOps.length === 1 &&
      critOps[0]?.kind === "op" &&
      critOps[0].op === "multiply_one_plus" &&
      critOps[0].before === 20 &&
      critOps[0].after === 30,
    "crit damage op is 20 → 30 after TDU",
  );
}

console.log("Part K — crit rate display-only; tentacle unchanged vs control");
{
  const awakener = makeAwakener({ id: 1 });
  const tentacle = makeManifestation({
    id: 1,
    tagId: tentacleTag.id,
    tagName: tentacleTag.tagName,
    valueScalar: 10,
  });
  const tdu = makeManifestation({
    id: 2,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 2,
    targetType: "aoe",
  });
  const rate = makeManifestation({
    id: 3,
    tagId: critRateTag.id,
    tagName: critRateTag.tagName,
    valueScalar: 0.8,
    targetType: "aoe",
  });
  const withRate = applyInteractions({
    manifestations: [tentacle, tdu, rate],
    appliedManifestations: [tentacle, tdu, rate],
    defaultInteractions: [],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  const control = applyInteractions({
    manifestations: [tentacle, tdu],
    appliedManifestations: [tentacle, tdu],
    defaultInteractions: [],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  assert(
    withRate.totalsByTagId.get(tentacleTag.id) ===
      control.totalsByTagId.get(tentacleTag.id),
    `crit rate does not change tentacle (${withRate.totalsByTagId.get(tentacleTag.id)})`,
  );
  const special = withRate.steps.find(
    (s) => s.kind === "special" && s.label === TENTACLE_CRIT_RATE_LABEL,
  );
  assert(special != null && special.kind === "special", "crit rate special step");
  assert(
    special.kind === "special" && special.detail.includes("aoe=0.8"),
    `rate detail shows aoe=0.8 (got ${special.kind === "special" ? special.detail : ""})`,
  );
  const rateOps = withRate.steps.filter(
    (s) =>
      s.kind === "op" &&
      s.tagName === tentacleTag.tagName &&
      s.modifierTagName === TENTACLE_CRIT_RATE_LABEL,
  );
  assert(rateOps.length === 0, "no crit-rate op on Tentacle");
}

console.log("Part L — order: TDU then Tentacle Crit Damage then Vulnerability");
{
  const awakener = makeAwakener({ id: 1 });
  const tentacle = makeManifestation({
    id: 1,
    sourceKind: "realm",
    awakenerId: null,
    slotIndex: null,
    sourceName: "aequor",
    tagId: tentacleTag.id,
    tagName: tentacleTag.tagName,
    valueScalar: 10,
  });
  const tdu = makeManifestation({
    id: 2,
    tagId: tduTag.id,
    tagName: tduTag.tagName,
    valueScalar: 2,
    targetType: "aoe",
  });
  const crit = makeManifestation({
    id: 3,
    tagId: critDmgTag.id,
    tagName: critDmgTag.tagName,
    valueScalar: 0.5,
    targetType: "aoe",
  });
  const vuln = makeManifestation({
    id: 4,
    tagId: vulnTag.id,
    tagName: vulnTag.tagName,
    valueScalar: 0.25,
    targetType: "aoe",
  });
  const manifests = [tentacle, tdu, crit, vuln];
  const result = applyInteractions({
    manifestations: manifests,
    appliedManifestations: manifests,
    defaultInteractions: [vulnToTentacle],
    tagsById,
    awakenersById: buildAwakenersById([awakener]),
  });
  // 10×2=20; ×1.5=30; ×1.25=37.5→ceil 38
  assert(
    (result.totalsByTagId.get(tentacleTag.id) ?? 0) === 38,
    `order 20→30→38 (got ${result.totalsByTagId.get(tentacleTag.id)})`,
  );
  const tentacleOps = result.steps.filter(
    (s) => s.kind === "op" && s.tagName === tentacleTag.tagName,
  );
  const names = tentacleOps.map((s) =>
    s.kind === "op" ? s.modifierTagName : "",
  );
  const tduIdx = names.indexOf(TENTACLE_TDU_FAMILY_POOL_LABEL);
  const critIdx = names.indexOf(TENTACLE_CRIT_DAMAGE_LABEL);
  const vulnIdx = names.indexOf(vulnTag.tagName);
  assert(tduIdx >= 0 && critIdx >= 0 && vulnIdx >= 0, "TDU, crit, vuln ops present");
  assert(
    tduIdx < critIdx && critIdx < vulnIdx,
    `order TDU < crit < vuln (got ${names.join(" → ")})`,
  );
}

console.log("Part M — formatTentacleCritDetail");
{
  const detail = formatTentacleCritDetail({
    baseSum: 1.2,
    basePart: 1,
    supportAoeSum: 0.15,
    supportNonAoeSum: 0.8,
    supportNonAoePart: 1,
    supportPart: 1.15,
    total: 2.15,
  });
  assert(
    detail === "base=ceil(1.2/2)=1 aoe=0.15 nonAoe=0.8→ceil(0.8/4)=1 total=2.15",
    `detail format (got ${detail})`,
  );
}

console.log("\nAll tentacle-crit smokes passed.");
