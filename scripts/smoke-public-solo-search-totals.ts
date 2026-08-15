/**
 * Phase 7 — Public Search solo-kit Attacker/Defender totals.
 * Run: npx tsx scripts/smoke-public-solo-search-totals.ts
 */
import { buildSearchResults } from "../src/lib/public/search-results";
import {
  REALM_GIMMICK_METADATA,
  computeSoloAwakenerTotals,
  isAttackerOrDefenderTagName,
  isMultiRealmSearchAwakener,
  realmSimsForAwakener,
  type SoloTotalsCache,
} from "../src/lib/public/solo-awakener-totals";
import type { PublicRow } from "../src/lib/public-read/allowlist";
import { AEQUOR_REALM_ID, CHAOS_REALM_ID } from "../src/lib/team-data/realm";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
}

const tags = [
  {
    id: 1,
    tag_name: "Attacker.Active Damage",
    layer: "add",
    is_percent: false,
    is_additive: true,
    is_searchable: true,
  },
  {
    id: 2,
    tag_name: "Attacker.Poison",
    layer: "add",
    is_percent: false,
    is_additive: true,
    is_searchable: true,
  },
  {
    id: 3,
    tag_name: "Support.Crit Rate",
    layer: "add",
    is_percent: true,
    is_additive: true,
    is_searchable: true,
  },
  {
    id: 16,
    tag_name: "Support.Damage AMP",
    layer: "add",
    is_percent: true,
    is_additive: true,
    is_searchable: true,
  },
  {
    id: 17,
    tag_name: "Support.Crit Damage",
    layer: "add",
    is_percent: true,
    is_additive: true,
    is_searchable: true,
  },
  {
    id: 18,
    tag_name: "Support.Crit Rate",
    layer: "add",
    is_percent: true,
    is_additive: true,
    is_searchable: true,
  },
  {
    id: 12,
    tag_name: "Defender.Base Death Resist",
    layer: "add",
    is_percent: false,
    is_additive: true,
    is_searchable: true,
  },
  {
    id: 28,
    tag_name: "Support.Aliemus Regen",
    layer: "add",
    is_percent: false,
    is_additive: true,
    is_searchable: true,
  },
  {
    id: 29,
    tag_name: "Support.Tentacle Damage Up",
    layer: "add",
    is_percent: false,
    is_additive: true,
    is_searchable: true,
  },
  {
    id: 63,
    tag_name: "Support.Realm Mastery",
    layer: "add",
    is_percent: false,
    is_additive: true,
    is_searchable: true,
  },
] as PublicRow<"tag">[];

const realms = [
  { id: CHAOS_REALM_ID, name: "chaos", replace: null },
  { id: 2, name: "caro", replace: null },
  { id: AEQUOR_REALM_ID, name: "aequor", replace: null },
  { id: 6, name: "ultra", replace: null },
] as PublicRow<"realm">[];

const awakener24 = {
  id: 24,
  // DB stores edge quotes: `"24"` — must still match multi-realm exception.
  name: '"24"',
  realm: CHAOS_REALM_ID,
  con: 1000,
  atk: 200,
  def: 100,
  keyflare_regen: 10,
  damage_amp: 0,
  crit_rate: 0,
  crit_dmg: 0,
  realm_mastery: 0,
  base_aliemus: 0,
  aliemus_regen: 0,
  sigil_yield: 0,
  death_resist: 0,
  enlightenment: 3,
} as PublicRow<"awakener">;

const otherAwakener = {
  ...awakener24,
  id: 11,
  name: "Other",
  realm: AEQUOR_REALM_ID,
} as PublicRow<"awakener">;

/** Aequor-only Active Damage that aftereffects into Poison. */
const aequorDamageAtm = {
  id: 100,
  awakener_id: 24,
  tag_id: 1,
  metadata: "Aequor exalt notes",
  value_scalar: 1,
  instance_count: 1,
  required_enlightenment: 0,
  source_type: "command card",
  target_type: "aoe",
  dependency_stat: "atk",
  buff_target_type_restriction: null,
  replaces_manifestation_id: null,
  is_accumulating: false,
  is_permanent: false,
  trigger_condition: null,
  required_realm: AEQUOR_REALM_ID,
  base_copies: 1,
  copy_provider_group_id: null,
} as PublicRow<"awakener_tag_manifestation">;

const poisonAftereffect = {
  id: 50,
  manifestation_id: 100,
  modifier_tag_id: null,
  value_scalar: 0.5,
  is_disabled: false,
  math_operation: "multiply",
  target_type: "single",
  dependency_stat: null,
  mode: "aftereffect",
  layer: "add",
  target_tag_id: 2,
} as PublicRow<"awakener_local_manifestation_interaction">;

const supportAtm = {
  id: 200,
  awakener_id: 24,
  tag_id: 3,
  metadata: null,
  value_scalar: 0.2,
  instance_count: 1,
  required_enlightenment: 0,
  source_type: null,
  target_type: "aoe",
  dependency_stat: null,
  buff_target_type_restriction: null,
  replaces_manifestation_id: null,
  is_accumulating: false,
  is_permanent: false,
  trigger_condition: null,
  required_realm: null,
  base_copies: 1,
  copy_provider_group_id: null,
} as PublicRow<"awakener_tag_manifestation">;

/** Aequor present-mode RTM — applies in aequor solo sim, not chaos. */
const aequorRealmRtm = {
  id: 900,
  realm_id: AEQUOR_REALM_ID,
  tag_id: 16,
  metadata: null,
  value_scalar: 0.05,
  is_accumulating: false,
  is_permanent: false,
  required_realm_mode: "present",
  dependency_stat: null,
  trigger_condition: null,
  dependency_rate: null,
  pure_bonus_target: "none",
  dependency_rate_stat: null,
} as PublicRow<"realm_tag_manifestation">;

const emptyGear = {
  wheels: [] as PublicRow<"wheel">[],
  posses: [] as PublicRow<"posse">[],
  covenants: [] as PublicRow<"covenant">[],
  realmManifestations: [] as PublicRow<"realm_tag_manifestation">[],
  defaultInteractions: [] as PublicRow<"tag_default_interaction">[],
  wheelManifestations: [] as PublicRow<"wheel_tag_manifestation">[],
  posseManifestations: [] as PublicRow<"posse_tag_manifestation">[],
  covenantManifestations: [] as PublicRow<"covenant_tag_manifestation">[],
};

const filtersBase = {
  tagId: null as number | null,
  from: "awakener" as const,
  targetType: null,
  dependencyStat: null,
  buffRestriction: null,
  everyTurn: null,
  triggerConditionTagId: null,
  requiredRealmId: null as null | 1 | 2 | 4 | 6,
  awakenerEnlightenment: 3,
};

console.log("realmSimsForAwakener");
assert(
  isMultiRealmSearchAwakener(awakener24),
  'quoted DB name `"24"` matches multi-realm exception',
);
assert(
  realmSimsForAwakener(awakener24, null).join(",") === "1,2,4,6",
  "24 expands all search realms",
);
assert(
  realmSimsForAwakener(awakener24, AEQUOR_REALM_ID as 4).join(",") === "4",
  "24 with realm filter sims only that realm",
);
assert(
  realmSimsForAwakener(otherAwakener, null).join(",") === String(AEQUOR_REALM_ID),
  "other awakener uses native realm only",
);
assert(
  realmSimsForAwakener(otherAwakener, CHAOS_REALM_ID as 1).length === 0,
  "other awakener skipped when native ≠ filter",
);

console.log("solo totals — 24 aequor vs chaos");
const catalog = {
  tags,
  realms,
  realmManifestations: [],
  defaultInteractions: [],
  awakenerManifestations: [aequorDamageAtm],
  awakenerLocalInteractions: [poisonAftereffect],
};
const aequorTotals = computeSoloAwakenerTotals(
  awakener24,
  AEQUOR_REALM_ID,
  3,
  catalog,
);
const chaosTotals = computeSoloAwakenerTotals(
  awakener24,
  CHAOS_REALM_ID,
  3,
  catalog,
);
assert(aequorTotals.totalsByTagId.has(1), "aequor has Active Damage in totals");
assert(aequorTotals.totalsByTagId.has(2), "aequor has Poison in totals (aftereffect)");
assert(
  !aequorTotals.hasAppliedRealmManifestation,
  "no catalog RTM → hasAppliedRealmManifestation false",
);
assert(!chaosTotals.totalsByTagId.has(1), "chaos has no Active Damage (realm-gated ATM)");
assert(!chaosTotals.totalsByTagId.has(2), "chaos has no Poison");

console.log("buildSearchResults — Poison filter for 24");
const poisonSearch = buildSearchResults({
  filters: { ...filtersBase, tagId: 2 },
  tags,
  realms,
  awakeners: [awakener24],
  awakenerManifestations: [aequorDamageAtm],
  awakenerLocalInteractions: [poisonAftereffect],
  ...emptyGear,
});
assert(
  poisonSearch.rows.length === 1,
  `Poison search one row (got ${poisonSearch.rows.length})`,
);
const poisonRow = poisonSearch.rows[0]!;
assert(
  poisonRow.id === `awakener-solo:24:2:${AEQUOR_REALM_ID}`,
  `Poison row id solo aequor (got ${poisonRow.id})`,
);
assert(
  !poisonSearch.rows.some((r) => r.id.startsWith("awakener-aftereffect:")),
  "no raw aftereffect row for Attacker.Poison",
);
assert(
  !poisonSearch.rows.some((r) => r.id.startsWith("awakener:") && !r.id.includes("solo")),
  "no raw ATM row for Attacker tags when solo ran",
);
assert(
  poisonRow.name.includes("24"),
  `name includes 24 (got ${poisonRow.name})`,
);
assert(
  poisonRow.name.includes("·"),
  `quoted 24 still gets multi-realm name suffix (got ${poisonRow.name})`,
);
assert(
  poisonRow.assetName === "24",
  `assetName stays bare 24 for icon/link (got ${poisonRow.assetName})`,
);
assert(
  poisonRow.targetType === "Single",
  `Poison aftereffect target type from local (got ${poisonRow.targetType})`,
);
assert(
  poisonRow.metadata === "Aequor exalt notes",
  `Poison metadata from parent ATM (got ${JSON.stringify(poisonRow.metadata)})`,
);

console.log("buildSearchResults — multi-realm expand emit-if-present");
const damageSearch = buildSearchResults({
  filters: { ...filtersBase, tagId: 1 },
  tags,
  realms,
  awakeners: [awakener24],
  awakenerManifestations: [aequorDamageAtm],
  awakenerLocalInteractions: [poisonAftereffect],
  ...emptyGear,
});
assert(
  damageSearch.rows.length === 1,
  `Active Damage only aequor emit (got ${damageSearch.rows.length})`,
);
assert(
  damageSearch.rows[0]!.id === `awakener-solo:24:1:${AEQUOR_REALM_ID}`,
  "Active Damage only from aequor sim",
);
assert(
  damageSearch.rows[0]!.name.includes("·"),
  "24 multi-realm name uses realm suffix when expand yields multiple sims",
);
assert(
  damageSearch.rows[0]!.targetType === "AoE",
  `Active Damage target type (got ${damageSearch.rows[0]!.targetType})`,
);
assert(
  damageSearch.rows[0]!.metadata === "Aequor exalt notes",
  `Active Damage metadata (got ${JSON.stringify(damageSearch.rows[0]!.metadata)})`,
);

console.log("Support stays raw");
const supportSearch = buildSearchResults({
  filters: { ...filtersBase, tagId: 3 },
  tags,
  realms,
  awakeners: [awakener24],
  awakenerManifestations: [aequorDamageAtm, supportAtm],
  awakenerLocalInteractions: [poisonAftereffect],
  ...emptyGear,
});
assert(
  supportSearch.rows.some((r) => r.id === "awakener:200"),
  "Support Crit Rate still per-ATM row",
);
assert(
  !supportSearch.rows.some((r) => r.id.startsWith("awakener-solo:")),
  "Support tag filter does not emit solo Attacker rows",
);

console.log("cache — same sim reused");
const cache: SoloTotalsCache = new Map();
const first = computeSoloAwakenerTotals(
  awakener24,
  AEQUOR_REALM_ID,
  3,
  catalog,
  cache,
);
const second = computeSoloAwakenerTotals(
  awakener24,
  AEQUOR_REALM_ID,
  3,
  catalog,
  cache,
);
assert(first === second, "in-request cache returns same result instance");
assert(cache.size === 1, "one cache entry for awakener+realm+enlightenment");

console.log("helpers");
assert(isAttackerOrDefenderTagName("Attacker.Poison"), "Attacker prefix");
assert(isAttackerOrDefenderTagName("Defender.Shield"), "Defender prefix");
assert(!isAttackerOrDefenderTagName("Support.Crit Rate"), "Support not AD");

console.log("display fields — unique target type + metadata join");
const dualAtms = [
  {
    ...aequorDamageAtm,
    id: 301,
    metadata: "noteA",
    target_type: "aoe",
    value_scalar: 0.5,
  },
  {
    ...aequorDamageAtm,
    id: 302,
    metadata: "noteB",
    target_type: "aoe",
    value_scalar: 0.5,
  },
] as PublicRow<"awakener_tag_manifestation">[];
const dualSearch = buildSearchResults({
  filters: { ...filtersBase, tagId: 1 },
  tags,
  realms,
  awakeners: [awakener24],
  awakenerManifestations: dualAtms,
  awakenerLocalInteractions: [],
  ...emptyGear,
});
const dualRow = dualSearch.rows.find(
  (r) => r.id === `awakener-solo:24:1:${AEQUOR_REALM_ID}`,
);
assert(dualRow, "dual ATM Active Damage solo row");
assert(
  dualRow.targetType === "AoE",
  `deduped aoe + aoe → AoE (got ${dualRow.targetType})`,
);
assert(
  dualRow.metadata === "noteA +\nnoteB",
  `unique metadata joined with +\\n (got ${JSON.stringify(dualRow.metadata)})`,
);

const emptyMetaAtm = {
  ...aequorDamageAtm,
  id: 303,
  metadata: "   ",
  target_type: "aoe",
} as PublicRow<"awakener_tag_manifestation">;
const emptyMetaSearch = buildSearchResults({
  filters: { ...filtersBase, tagId: 1 },
  tags,
  realms,
  awakeners: [awakener24],
  awakenerManifestations: [emptyMetaAtm],
  awakenerLocalInteractions: [],
  ...emptyGear,
});
const emptyMetaRow = emptyMetaSearch.rows.find(
  (r) => r.id === `awakener-solo:24:1:${AEQUOR_REALM_ID}`,
);
assert(emptyMetaRow, "empty-metadata ATM solo row");
assert(
  emptyMetaRow.metadata == null,
  `blank metadata omitted (got ${JSON.stringify(emptyMetaRow.metadata)})`,
);
assert(
  emptyMetaRow.targetType === "AoE",
  `target type still present (got ${emptyMetaRow.targetType})`,
);

console.log("display fields — target type enum order");
const mixedOrderAtms = [
  {
    ...aequorDamageAtm,
    id: 401,
    metadata: null,
    target_type: "aoe",
    value_scalar: 0.4,
  },
  {
    ...aequorDamageAtm,
    id: 402,
    metadata: null,
    target_type: "single",
    value_scalar: 0.4,
  },
  {
    ...aequorDamageAtm,
    id: 403,
    metadata: null,
    target_type: "self",
    value_scalar: 0.2,
  },
] as PublicRow<"awakener_tag_manifestation">[];
const mixedOrderSearch = buildSearchResults({
  filters: { ...filtersBase, tagId: 1 },
  tags,
  realms,
  awakeners: [awakener24],
  awakenerManifestations: mixedOrderAtms,
  awakenerLocalInteractions: [],
  ...emptyGear,
});
const mixedOrderRow = mixedOrderSearch.rows.find(
  (r) => r.id === `awakener-solo:24:1:${AEQUOR_REALM_ID}`,
);
assert(mixedOrderRow, "mixed target-type solo row");
assert(
  mixedOrderRow.targetType === "Self + Single + AoE",
  `target types sorted self→single→aoe (got ${mixedOrderRow.targetType})`,
);

console.log("realm gimmick — RTM applied vs not");
const gimmickCatalog = {
  ...catalog,
  realmManifestations: [aequorRealmRtm],
};
const aequorWithRtm = computeSoloAwakenerTotals(
  awakener24,
  AEQUOR_REALM_ID,
  3,
  gimmickCatalog,
);
const chaosWithRtm = computeSoloAwakenerTotals(
  awakener24,
  CHAOS_REALM_ID,
  3,
  gimmickCatalog,
);
assert(
  aequorWithRtm.hasAppliedRealmManifestation,
  "aequor present RTM sets hasAppliedRealmManifestation",
);
assert(
  !chaosWithRtm.hasAppliedRealmManifestation,
  "chaos sim does not apply aequor RTM",
);

const gimmickPoisonSearch = buildSearchResults({
  filters: { ...filtersBase, tagId: 2 },
  tags,
  realms,
  awakeners: [awakener24],
  awakenerManifestations: [aequorDamageAtm],
  awakenerLocalInteractions: [poisonAftereffect],
  ...emptyGear,
  realmManifestations: [aequorRealmRtm],
});
const gimmickPoisonRow = gimmickPoisonSearch.rows.find(
  (r) => r.id === `awakener-solo:24:2:${AEQUOR_REALM_ID}`,
);
assert(gimmickPoisonRow, "Poison solo row with applying RTM");
assert(
  gimmickPoisonRow.metadata ===
    `Aequor exalt notes +\n${REALM_GIMMICK_METADATA}`,
  `Poison metadata appends Realm gimmick (got ${JSON.stringify(gimmickPoisonRow.metadata)})`,
);

const chaosGimmickDamage = gimmickPoisonSearch.rows.find(
  (r) => r.id === `awakener-solo:24:2:${CHAOS_REALM_ID}`,
);
assert(!chaosGimmickDamage, "no Poison solo row in chaos (ATM gated)");

const noRtmPoisonSearch = buildSearchResults({
  filters: { ...filtersBase, tagId: 2 },
  tags,
  realms,
  awakeners: [awakener24],
  awakenerManifestations: [aequorDamageAtm],
  awakenerLocalInteractions: [poisonAftereffect],
  ...emptyGear,
});
const noRtmPoisonRow = noRtmPoisonSearch.rows.find(
  (r) => r.id === `awakener-solo:24:2:${AEQUOR_REALM_ID}`,
);
assert(noRtmPoisonRow, "Poison solo row without RTM");
assert(
  noRtmPoisonRow.metadata === "Aequor exalt notes",
  `no RTM → no Realm gimmick (got ${JSON.stringify(noRtmPoisonRow.metadata)})`,
);

console.log("realm gimmick — uniqueness with existing notes");
const dualWithGimmickSearch = buildSearchResults({
  filters: { ...filtersBase, tagId: 1 },
  tags,
  realms,
  awakeners: [awakener24],
  awakenerManifestations: dualAtms,
  awakenerLocalInteractions: [],
  ...emptyGear,
  realmManifestations: [aequorRealmRtm],
});
const dualWithGimmickRow = dualWithGimmickSearch.rows.find(
  (r) => r.id === `awakener-solo:24:1:${AEQUOR_REALM_ID}`,
);
assert(dualWithGimmickRow, "dual ATM Active Damage with RTM");
assert(
  dualWithGimmickRow.metadata ===
    `noteA +\nnoteB +\n${REALM_GIMMICK_METADATA}`,
  `notes then Realm gimmick once (got ${JSON.stringify(dualWithGimmickRow.metadata)})`,
);

const blankMetaWithGimmickSearch = buildSearchResults({
  filters: { ...filtersBase, tagId: 1 },
  tags,
  realms,
  awakeners: [awakener24],
  awakenerManifestations: [emptyMetaAtm],
  awakenerLocalInteractions: [],
  ...emptyGear,
  realmManifestations: [aequorRealmRtm],
});
const blankMetaWithGimmickRow = blankMetaWithGimmickSearch.rows.find(
  (r) => r.id === `awakener-solo:24:1:${AEQUOR_REALM_ID}`,
);
assert(blankMetaWithGimmickRow, "blank ATM metadata with RTM");
assert(
  blankMetaWithGimmickRow.metadata === REALM_GIMMICK_METADATA,
  `gimmick alone when notes empty (got ${JSON.stringify(blankMetaWithGimmickRow.metadata)})`,
);

console.log("smoke-public-solo-search-totals: ok");
