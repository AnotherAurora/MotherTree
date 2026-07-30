/**
 * Phase 2b.3 — realm_tag_manifestation apply + scalar + immunity.
 * Run: npx tsx scripts/smoke-realm-tags.ts
 */
import { applyInteractions } from "../src/lib/path-carver/apply-interactions";
import {
  createManifestationApplyContext,
  evaluateManifestationApply,
} from "../src/lib/path-carver/manifestation-apply";
import {
  buildAwakenersById,
  scaleRealmValueScalar,
  sumTeamRealmMastery,
} from "../src/lib/path-carver/effective-value-scalar";
import { CHAOS_REALM_ID } from "../src/lib/team-data/realm";
import { resolveTeamRealms } from "../src/lib/team-data/resolve-team-realms";
import type {
  Awakener,
  DefaultInteraction,
  Manifestation,
  RealmLookupRow,
  Tag,
} from "../src/lib/team-data/types";

const CARO = 2;
const PROPAGATION_CARO = 3;
const AEQUOR = 4;
const ULTRA = 6;
const PRIMORDIA = 8;

const REALMS: RealmLookupRow[] = [
  { id: CHAOS_REALM_ID, name: "chaos", replace: null },
  { id: CARO, name: "caro", replace: null },
  { id: PROPAGATION_CARO, name: "propagation caro", replace: CARO },
  { id: AEQUOR, name: "aequor", replace: null },
  { id: ULTRA, name: "ultra", replace: null },
  { id: PRIMORDIA, name: "primordia chaos", replace: CHAOS_REALM_ID },
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

function makeRealmManifest(
  partial: Partial<Manifestation> & {
    id: number;
    realmId: number;
    tagId: number;
    tagName: string;
  },
): Manifestation {
  return {
    sourceKind: "realm",
    awakenerId: null,
    slotIndex: null,
    sourceName: REALMS.find((r) => r.id === partial.realmId)?.name ?? "realm",
    triggerCondition: null,
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
    requiredRealmMode: partial.requiredRealmMode ?? "present",
    dependencyRate: partial.dependencyRate ?? null,
    dependencyRateStat: partial.dependencyRateStat ?? null,
    pureBonusTarget: partial.pureBonusTarget ?? "none",
    ...partial,
  };
}

function makeTag(
  id: number,
  tagName: string,
  isPercent = false,
): Tag {
  return {
    id,
    tagName,
    layer: null,
    isPercent,
    isAdditive: true,
  };
}

console.log("smoke-realm-tags");

console.log("\nReplace collapse — caro RTM off when propagation present");
{
  const awakeners = [
    makeAwakener({ id: 1, realmId: CARO }),
    makeAwakener({ id: 2, realmId: PROPAGATION_CARO }),
  ];
  const ctx = createManifestationApplyContext(awakeners, [1], new Map(), REALMS);
  const caroRow = makeRealmManifest({
    id: 100,
    realmId: CARO,
    tagId: 9,
    tagName: "Defender.Shield",
    valueScalar: 0.08,
    requiredRealmMode: "present",
  });
  const propRow = makeRealmManifest({
    id: 101,
    realmId: PROPAGATION_CARO,
    tagId: 130,
    tagName: "Defender.Max HP Up",
    valueScalar: 0.1,
    requiredRealmMode: "present",
  });
  assert(
    !evaluateManifestationApply(caroRow, ctx).applied,
    "caro present RTM not applied when replaced",
  );
  assert(
    evaluateManifestationApply(propRow, ctx).applied,
    "propagation present RTM applied",
  );
}

console.log("\nPrimordia replaces chaos — chaos RTM + combo off");
{
  const awakeners = [
    makeAwakener({ id: 1, realmId: PRIMORDIA }),
    makeAwakener({ id: 2, realmId: CARO }),
  ];
  const ctx = createManifestationApplyContext(awakeners, [1], new Map(), REALMS);
  assert(ctx.teamRealms.chaosComboStacks === 0, "primordia → combo stacks 0");
  const chaosExclusive = makeRealmManifest({
    id: 1,
    realmId: CHAOS_REALM_ID,
    tagId: 53,
    tagName: "Support.Trigger Posse",
    valueScalar: 1,
    requiredRealmMode: "exclusive",
  });
  const caroCombo = makeRealmManifest({
    id: 7,
    realmId: CARO,
    tagId: 59,
    tagName: "Support.Embryo Fusion",
    valueScalar: 35,
    requiredRealmMode: "combo",
  });
  assert(
    !evaluateManifestationApply(chaosExclusive, ctx).applied,
    "chaos exclusive RTM off when replaced",
  );
  assert(
    !evaluateManifestationApply(caroCombo, ctx).applied,
    "caro combo off when chaos replaced",
  );
}

console.log("\nPure caro + chaos — exclusive + combo×1");
{
  const awakeners = [
    makeAwakener({ id: 1, realmId: CARO, realmMastery: 100 }),
    makeAwakener({ id: 2, realmId: CHAOS_REALM_ID }),
  ];
  const ctx = createManifestationApplyContext(awakeners, [1], new Map(), REALMS);
  assert(ctx.teamRealms.isPure(CARO), "caro+chaos is pure caro");
  assert(ctx.teamRealms.chaosComboStacks === 1, "combo stacks 1");
  const exclusive = makeRealmManifest({
    id: 200,
    realmId: CARO,
    tagId: 1,
    tagName: "Support.Test Exclusive",
    valueScalar: 10,
    requiredRealmMode: "exclusive",
  });
  const combo = makeRealmManifest({
    id: 7,
    realmId: CARO,
    tagId: 59,
    tagName: "Support.Embryo Fusion",
    valueScalar: 35,
    requiredRealmMode: "combo",
  });
  assert(evaluateManifestationApply(exclusive, ctx).applied, "caro exclusive ok");
  assert(evaluateManifestationApply(combo, ctx).applied, "caro combo ok");
  const scaled = scaleRealmValueScalar(
    combo,
    { teamRealms: ctx.teamRealms, realmMasteryTotal: 100 },
    false,
    buildAwakenersById(awakeners),
  );
  assert(scaled === 35, "combo ×1 leaves scalar 35");
}

console.log("\nTwo chaos + ultra — combo ×2");
{
  const awakeners = [
    makeAwakener({ id: 1, realmId: CHAOS_REALM_ID }),
    makeAwakener({ id: 2, realmId: CHAOS_REALM_ID }),
    makeAwakener({ id: 3, realmId: ULTRA }),
  ];
  const teamRealms = resolveTeamRealms(
    awakeners.map((a) => a.realmId),
    REALMS,
  );
  assert(teamRealms.chaosComboStacks === 2, "combo stacks 2");
  const combo = makeRealmManifest({
    id: 6,
    realmId: AEQUOR,
    tagId: 28,
    tagName: "Support.Aliemus",
    valueScalar: 10,
    requiredRealmMode: "combo",
  });
  // aequor not effective → not applied
  const ctx = createManifestationApplyContext(awakeners, [1], new Map(), REALMS);
  assert(
    !evaluateManifestationApply(combo, ctx).applied,
    "aequor combo not applied without aequor",
  );

  const withAequor = [
    makeAwakener({ id: 1, realmId: CHAOS_REALM_ID }),
    makeAwakener({ id: 2, realmId: CHAOS_REALM_ID }),
    makeAwakener({ id: 3, realmId: AEQUOR }),
  ];
  const ctx2 = createManifestationApplyContext(
    withAequor,
    [1],
    new Map(),
    REALMS,
  );
  assert(ctx2.teamRealms.chaosComboStacks === 2, "chaos+aequor stacks 2");
  assert(evaluateManifestationApply(combo, ctx2).applied, "aequor combo applied");
  const scaled = scaleRealmValueScalar(
    combo,
    { teamRealms: ctx2.teamRealms },
    false,
    buildAwakenersById(withAequor),
  );
  assert(scaled === 20, "combo ×2 → 20");
}

console.log("\nFiesta two-row + pure double");
{
  const awakeners = [
    makeAwakener({ id: 1, realmId: PROPAGATION_CARO, realmMastery: 434 }),
  ];
  const teamRealms = resolveTeamRealms(
    awakeners.map((a) => a.realmId),
    REALMS,
  );
  assert(teamRealms.isPure(PROPAGATION_CARO), "pure propagation");
  const base = makeRealmManifest({
    id: 19,
    realmId: PROPAGATION_CARO,
    tagId: 69,
    tagName: "Support.Propagation Fiesta",
    valueScalar: 20,
    requiredRealmMode: "present",
    pureBonusTarget: "none",
  });
  const rm = makeRealmManifest({
    id: 51,
    realmId: PROPAGATION_CARO,
    tagId: 69,
    tagName: "Support.Propagation Fiesta",
    valueScalar: 0.01,
    dependencyStat: "realm_mastery",
    requiredRealmMode: "present",
    pureBonusTarget: "value_scalar",
  });
  const opts = {
    teamRealms,
    realmMasteryTotal: sumTeamRealmMastery(awakeners),
  };
  const byId = buildAwakenersById(awakeners);
  assert(scaleRealmValueScalar(base, opts, false, byId) === 20, "fiesta base 20");
  // ceil(0.01 * 2 * 434) = ceil(8.68) = 9
  assert(
    scaleRealmValueScalar(rm, opts, false, byId) === 9,
    "fiesta RM pure: ceil(0.01*2*434)=9",
  );
}

console.log("\nHP × (rate + RM × rate_mult) ceil");
{
  const awakeners = [
    makeAwakener({ id: 1, realmId: CARO, realmMastery: 400 }),
  ];
  const teamRealms = resolveTeamRealms(
    awakeners.map((a) => a.realmId),
    REALMS,
  );
  const row = makeRealmManifest({
    id: 39,
    realmId: CARO,
    tagId: 9,
    tagName: "Defender.Shield",
    valueScalar: 0,
    dependencyStat: "team_max_hp",
    dependencyRate: 0.0002,
    dependencyRateStat: "realm_mastery",
    pureBonusTarget: "dependency_rate",
    requiredRealmMode: "present",
  });
  const byId = buildAwakenersById(awakeners);
  // pure: rate_mult=2 → ceil(1000 * (0 + 0.0002 * 400 * 2)) = ceil(160) = 160
  const scaled = scaleRealmValueScalar(
    row,
    {
      teamRealms,
      teamMaxHp: 1000,
      realmMasteryTotal: 400,
    },
    true,
    byId,
  );
  assert(scaled === 160, "HP rate-scaled pure shield → 160");
}

console.log("\nAttacker.* realm always applies (no damage-dealer gate)");
{
  const awakeners = [makeAwakener({ id: 1, realmId: AEQUOR })];
  const noDd = createManifestationApplyContext(
    awakeners,
    [],
    new Map(),
    REALMS,
  );
  const withDd = createManifestationApplyContext(
    awakeners,
    [1],
    new Map(),
    REALMS,
  );
  const tentacle = makeRealmManifest({
    id: 24,
    realmId: AEQUOR,
    tagId: 5,
    tagName: "Attacker.Tentacle",
    valueScalar: 4,
    requiredRealmMode: "present",
  });
  assert(
    evaluateManifestationApply(tentacle, noDd).applied,
    "Attacker realm on with zero dealers",
  );
  assert(
    evaluateManifestationApply(tentacle, withDd).applied,
    "Attacker realm on with a dealer",
  );
}

console.log("\nInbound interaction immunity for realm subjects");
{
  const shieldTag = makeTag(9, "Defender.Shield", true);
  const gainTag = makeTag(40, "Support.Increase Gain.Shield");
  const tagsById: Record<number, Tag> = {
    9: shieldTag,
    40: gainTag,
  };
  const awakeners = [
    makeAwakener({ id: 1, realmId: CARO, realmMastery: 0 }),
  ];
  const realmShield = makeRealmManifest({
    id: 12,
    realmId: CARO,
    tagId: 9,
    tagName: "Defender.Shield",
    valueScalar: 0.08,
    dependencyStat: "team_max_hp",
    requiredRealmMode: "present",
  });
  const gain: Manifestation = {
    id: 900,
    sourceKind: "awakener",
    awakenerId: 1,
    slotIndex: 0,
    sourceName: "A1",
    tagId: 40,
    tagName: "Support.Increase Gain.Shield",
    triggerCondition: null,
    valueScalar: 0.5,
    baseHits: null,
    dependencyStat: null,
    sourceType: null,
    targetType: "self",
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
    realmId: null,
    requiredRealmMode: null,
    dependencyRate: null,
    dependencyRateStat: null,
    pureBonusTarget: null,
  };
  const interaction: DefaultInteraction = {
    id: 1,
    modifierTagId: 40,
    modifierTagName: "Support.Increase Gain.Shield",
    targetTagId: 9,
    targetTagName: "Defender.Shield",
    exclusionTagId: null,
    exclusionTagName: null,
    mathOperation: "add_scaled",
    defaultFactor: 1,
    buffTargetTypeRestriction: null,
    substitute: false,
    oncePerBase: true,
  };
  const teamRealms = resolveTeamRealms([CARO], REALMS);
  const result = applyInteractions({
    manifestations: [realmShield, gain],
    appliedManifestations: [realmShield, gain],
    defaultInteractions: [interaction],
    tagsById,
    awakenersById: buildAwakenersById(awakeners),
    teamMaxHp: 1000,
    realmMasteryTotal: 0,
    teamRealms,
  });
  // realm shield: ceil(0.08 * 1000) = 80; immune to Increase Gain
  assert(
    result.totalsByTagId.get(9) === 80,
    "realm Shield stays 80 (no inbound Increase Gain)",
  );
}

console.log("\nAll smoke-realm-tags checks passed.");
