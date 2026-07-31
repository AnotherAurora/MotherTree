/**
 * Phase 2b.6 smoke — Base Tentacle Damage (aequor + benthos).
 * Run: npx tsx scripts/smoke-base-tentacle-damage.ts
 */
import { computeReviewTagTotals } from "../src/lib/path-carver/aggregate-tag-scalars";
import {
  REALM_TAG_MANIFESTATION_AEQUOR_FIXED_HP_ID,
  REALM_TAG_MANIFESTATION_BENTHOS_BASE_TDU_ID,
  SUPPORT_DAMAGE_AMP_TAG_ID,
  SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID,
  baseTentacleDamageManifestationId,
  computeBaseTentacleDamage,
  resolveBaseTentacleMode,
} from "../src/lib/path-carver/base-tentacle-damage";
import { createManifestationApplyContext } from "../src/lib/path-carver/manifestation-apply";
import { oceanDamageMultiplierForLevel } from "../src/lib/path-carver/ocean-damage-multipliers";
import {
  AEQUOR_REALM_ID,
  BENTHOS_AEQUOR_REALM_ID,
  CHAOS_REALM_ID,
} from "../src/lib/team-data/realm";
import type {
  Awakener,
  Manifestation,
  RealmLookupRow,
  Tag,
  TeamData,
} from "../src/lib/team-data/types";
import { createEmptyTeamData } from "../src/lib/team-data/types";

const CARO = 2;

const REALMS: RealmLookupRow[] = [
  { id: CHAOS_REALM_ID, name: "chaos", replace: null },
  { id: CARO, name: "caro", replace: null },
  { id: AEQUOR_REALM_ID, name: "aequor", replace: null },
  { id: BENTHOS_AEQUOR_REALM_ID, name: "benthos aequor", replace: AEQUOR_REALM_ID },
];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
}

function makeAwakener(
  partial: Partial<Awakener> & { id: number; realmId: number },
): Awakener {
  return {
    name: partial.name ?? `A${partial.id}`,
    realm: null,
    con: partial.con ?? 100,
    atk: partial.atk ?? 100,
    def: partial.def ?? 100,
    keyflareRegen: partial.keyflareRegen ?? 15,
    damageAmp: partial.damageAmp ?? 0,
    critRate: partial.critRate ?? 0,
    critDmg: partial.critDmg ?? 0,
    realmMastery: partial.realmMastery ?? 0,
    baseAliemus: partial.baseAliemus ?? 0,
    aliemusRegen: partial.aliemusRegen ?? 0,
    sigilYield: partial.sigilYield ?? 0,
    deathResist: partial.deathResist ?? 0,
    enlightenment: partial.enlightenment ?? 5,
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
    sourceKind: partial.sourceKind ?? "realm",
    awakenerId: partial.awakenerId ?? null,
    slotIndex: partial.slotIndex ?? null,
    sourceName: partial.sourceName ?? "realm",
    valueScalar: partial.valueScalar ?? 0,
    baseHits: null,
    dependencyStat: partial.dependencyStat ?? null,
    sourceType: null,
    targetType: null,
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
    realmId: partial.realmId ?? AEQUOR_REALM_ID,
    requiredRealmMode: partial.requiredRealmMode ?? "present",
    dependencyRate: null,
    dependencyRateStat: null,
    pureBonusTarget: partial.pureBonusTarget ?? "none",
    ...partial,
  };
}

function makeTeam(
  awakeners: Awakener[],
  manifestations: Manifestation[],
  tagsById: Record<number, Tag>,
): TeamData {
  const base = createEmptyTeamData();
  return {
    ...base,
    awakeners,
    manifestations,
    tagsById,
    realms: REALMS,
    summary: {
      ...base.summary,
      awakenerCount: awakeners.length,
      manifestationCount: manifestations.length,
    },
  };
}

console.log("OceanDamageMultiplier");
assert(oceanDamageMultiplierForLevel(60) === 1.8, "60 → 1.80");
assert(oceanDamageMultiplierForLevel(80) === 1.9, "80 → 1.90");
assert(oceanDamageMultiplierForLevel(25) === 1.0, "25 → 1.00");
assert(oceanDamageMultiplierForLevel(70) === 1.9, "70 → 1.90");

console.log("\nresolveBaseTentacleMode");
assert(
  resolveBaseTentacleMode(new Set([BENTHOS_AEQUOR_REALM_ID])) === "benthos",
  "benthos wins",
);
assert(
  resolveBaseTentacleMode(new Set([AEQUOR_REALM_ID, CHAOS_REALM_ID])) ===
    "aequor",
  "aequor when not replaced",
);
assert(resolveBaseTentacleMode(new Set([CARO])) === null, "no ocean realm");

console.log("\ncomputeBaseTentacleDamage — normal aequor (verified 116)");
{
  const awakeners = [
    { atk: 135 },
    { atk: 182 },
    { atk: 190 },
    { atk: 145 },
  ];
  const zeroAmp = computeBaseTentacleDamage({
    mode: "aequor",
    awakeners,
    accountLevel: 80,
    teamMaxHp: 1724,
    chaosComboStacks: 3,
    damageAmpTotal: 0,
  });
  assert(zeroAmp.rawAtk === 62, `rawAtk 62 (got ${zeroAmp.rawAtk})`);
  assert(zeroAmp.hpTerm === 54, `hpTerm 54 (got ${zeroAmp.hpTerm})`);
  assert(zeroAmp.baseAmount === 116, `base 116 (got ${zeroAmp.baseAmount})`);
  assert(zeroAmp.valueScalar === 116, `scalar 116 (got ${zeroAmp.valueScalar})`);

  const withAmp = computeBaseTentacleDamage({
    mode: "aequor",
    awakeners,
    accountLevel: 80,
    teamMaxHp: 1724,
    chaosComboStacks: 3,
    damageAmpTotal: 0.5,
  });
  assert(withAmp.valueScalar === 174, `amp 0.5 → 174 (got ${withAmp.valueScalar})`);
}

console.log("\ncomputeBaseTentacleDamage — benthos (verified 250)");
{
  const zeroAmp = computeBaseTentacleDamage({
    mode: "benthos",
    awakeners: [],
    accountLevel: 80,
    teamMaxHp: 1560,
    chaosComboStacks: 3,
    damageAmpTotal: 0,
  });
  assert(zeroAmp.baseAmount === 125, `base 125 (got ${zeroAmp.baseAmount})`);
  assert(zeroAmp.valueScalar === 125, `scalar 125 (got ${zeroAmp.valueScalar})`);

  const withAmp = computeBaseTentacleDamage({
    mode: "benthos",
    awakeners: [],
    accountLevel: 80,
    teamMaxHp: 1560,
    chaosComboStacks: 3,
    damageAmpTotal: 1.0,
  });
  assert(withAmp.valueScalar === 250, `amp 1.0 → 250 (got ${withAmp.valueScalar})`);
}

console.log("\nIntegration — aequor suppresses RTM 5, emits synthetic");
{
  const tagsById: Record<number, Tag> = {
    [SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID]: makeTag(
      SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID,
      "Support.Tentacle Damage Up",
    ),
    [SUPPORT_DAMAGE_AMP_TAG_ID]: makeTag(
      SUPPORT_DAMAGE_AMP_TAG_ID,
      "Support.Damage AMP",
      true,
    ),
    75: makeTag(75, "Support.Tentacle Damage Up.Fixed"),
  };
  const awakeners = [
    makeAwakener({ id: 1, realmId: AEQUOR_REALM_ID, atk: 135, con: 200 }),
    makeAwakener({ id: 2, realmId: CHAOS_REALM_ID, atk: 182, con: 200 }),
    makeAwakener({ id: 3, realmId: CHAOS_REALM_ID, atk: 190, con: 200 }),
    makeAwakener({ id: 4, realmId: CHAOS_REALM_ID, atk: 145, con: 200 }),
  ];
  const rtm5 = makeManifestation({
    id: REALM_TAG_MANIFESTATION_AEQUOR_FIXED_HP_ID,
    realmId: AEQUOR_REALM_ID,
    tagId: 75,
    tagName: "Support.Tentacle Damage Up.Fixed",
    valueScalar: 0.01,
    dependencyStat: "team_max_hp",
    requiredRealmMode: "combo",
  });
  const team = makeTeam(awakeners, [rtm5], tagsById);
  const ctx = createManifestationApplyContext(awakeners, [], new Map(), REALMS);
  const result = computeReviewTagTotals(team, ctx);
  assert(
    result.reviewTeamData.manifestations.some(
      (m) => m.id === baseTentacleDamageManifestationId(),
    ),
    "synthetic present in reviewTeamData",
  );
  assert(
    !result.reviewTeamData.manifestations.some(
      (m) => m.id === REALM_TAG_MANIFESTATION_AEQUOR_FIXED_HP_ID,
    ),
    "RTM 5 suppressed from reviewTeamData",
  );
  assert(
    (result.totalsByTagId.get(SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID) ?? 0) > 0,
    "tag 29 total > 0",
  );
  assert(
    result.steps.some(
      (s) => s.kind === "special" && s.label === "Base Tentacle Damage",
    ),
    "math step present",
  );
}

console.log("\nIntegration — benthos suppresses RTM 30");
{
  const tagsById: Record<number, Tag> = {
    [SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID]: makeTag(
      SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID,
      "Support.Tentacle Damage Up",
    ),
    [SUPPORT_DAMAGE_AMP_TAG_ID]: makeTag(
      SUPPORT_DAMAGE_AMP_TAG_ID,
      "Support.Damage AMP",
      true,
    ),
  };
  const awakeners = [
    makeAwakener({ id: 1, realmId: BENTHOS_AEQUOR_REALM_ID, atk: 135, con: 200 }),
    makeAwakener({ id: 2, realmId: CHAOS_REALM_ID, atk: 182, con: 200 }),
    makeAwakener({ id: 3, realmId: CHAOS_REALM_ID, atk: 135, con: 200 }),
    makeAwakener({ id: 4, realmId: CHAOS_REALM_ID, atk: 145, con: 200 }),
  ];
  const rtm30 = makeManifestation({
    id: REALM_TAG_MANIFESTATION_BENTHOS_BASE_TDU_ID,
    realmId: BENTHOS_AEQUOR_REALM_ID,
    tagId: SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID,
    tagName: "Support.Tentacle Damage Up",
    valueScalar: 0.05,
    dependencyStat: "team_max_hp",
    requiredRealmMode: "present",
  });
  const rtm31 = makeManifestation({
    id: 31,
    realmId: BENTHOS_AEQUOR_REALM_ID,
    tagId: SUPPORT_DAMAGE_AMP_TAG_ID,
    tagName: "Support.Damage AMP",
    valueScalar: 0.5,
    pureBonusTarget: "value_scalar",
    requiredRealmMode: "present",
  });
  const team = makeTeam(awakeners, [rtm30, rtm31], tagsById);
  const ctx = createManifestationApplyContext(awakeners, [], new Map(), REALMS);
  const result = computeReviewTagTotals(team, ctx);
  assert(
    !result.reviewTeamData.manifestations.some(
      (m) => m.id === REALM_TAG_MANIFESTATION_BENTHOS_BASE_TDU_ID,
    ),
    "RTM 30 suppressed",
  );
  assert(
    result.reviewTeamData.manifestations.some((m) => m.id === 31),
    "RTM 31 Damage AMP kept",
  );
  assert(
    result.reviewTeamData.manifestations.some(
      (m) => m.id === baseTentacleDamageManifestationId(),
    ),
    "benthos synthetic present",
  );
}

console.log("\nIntegration — neither ocean realm → no synthetic");
{
  const tagsById: Record<number, Tag> = {
    [SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID]: makeTag(
      SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID,
      "Support.Tentacle Damage Up",
    ),
    [SUPPORT_DAMAGE_AMP_TAG_ID]: makeTag(
      SUPPORT_DAMAGE_AMP_TAG_ID,
      "Support.Damage AMP",
      true,
    ),
  };
  const awakeners = [
    makeAwakener({ id: 1, realmId: CARO, atk: 100, con: 100 }),
    makeAwakener({ id: 2, realmId: CARO, atk: 100, con: 100 }),
  ];
  const team = makeTeam(awakeners, [], tagsById);
  const ctx = createManifestationApplyContext(awakeners, [], new Map(), REALMS);
  const result = computeReviewTagTotals(team, ctx);
  assert(
    !result.reviewTeamData.manifestations.some(
      (m) => m.id === baseTentacleDamageManifestationId(),
    ),
    "no synthetic without aequor/benthos",
  );
  assert(
    (result.totalsByTagId.get(SUPPORT_TENTACLE_DAMAGE_UP_TAG_ID) ?? 0) === 0,
    "tag 29 stays 0",
  );
}

console.log("\nAll Base Tentacle Damage smoke checks passed.");
