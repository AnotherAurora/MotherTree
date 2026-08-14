/**
 * Smoke: Search ATM instance_count + aftereffect target rows.
 * Run: npx tsx scripts/smoke-search-aftereffect.ts
 */
import { buildSearchResults } from "../src/lib/public/search-results";
import type { PublicRow } from "../src/lib/public-read/allowlist";

const emptyFilters = {
  tagId: null as number | null,
  from: "awakener" as const,
  targetType: null,
  dependencyStat: null,
  buffRestriction: null,
  everyTurn: null,
  triggerConditionTagId: null,
  requiredRealmId: null,
  awakenerEnlightenment: 3,
};

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
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
] as PublicRow<"tag">[];

const awakeners = [
  {
    id: 10,
    name: "TestAwakener",
    realm: null,
    con: 100,
    atk: 200,
    def: 100,
    keyflare_regen: 1,
    damage_amp: 0,
    crit_rate: 0,
    crit_dmg: 0,
    realm_mastery: 0,
    base_aliemus: 0,
    aliemus_regen: 0,
    sigil_yield: 0,
    death_resist: 0,
    enlightenment: 3,
  },
] as PublicRow<"awakener">[];

const atm = {
  id: 100,
  awakener_id: 10,
  tag_id: 1,
  metadata: "  Active Damage notes  ",
  value_scalar: 1.5,
  instance_count: 2,
  required_enlightenment: 0,
  source_type: null,
  target_type: "aoe",
  dependency_stat: "atk",
  buff_target_type_restriction: null,
  replaces_manifestation_id: null,
  is_accumulating: false,
  is_permanent: false,
  trigger_condition: null,
  required_realm: null,
  base_copies: 1,
  copy_provider_group_id: null,
} as PublicRow<"awakener_tag_manifestation">;

const local = {
  id: 50,
  manifestation_id: 100,
  modifier_tag_id: null,
  value_scalar: 0.5,
  is_disabled: false,
  math_operation: "multiply",
  target_type: "aoe",
  dependency_stat: null,
  mode: "aftereffect",
  layer: "add",
  target_tag_id: 2,
} as PublicRow<"awakener_local_manifestation_interaction">;

const empty = {
  realms: [] as PublicRow<"realm">[],
  wheels: [] as PublicRow<"wheel">[],
  posses: [] as PublicRow<"posse">[],
  covenants: [] as PublicRow<"covenant">[],
  wheelManifestations: [] as PublicRow<"wheel_tag_manifestation">[],
  posseManifestations: [] as PublicRow<"posse_tag_manifestation">[],
  covenantManifestations: [] as PublicRow<"covenant_tag_manifestation">[],
};

// ceil(1.5 * 200) = 300; × instance_count 2 = 600
const allTags = buildSearchResults({
  filters: emptyFilters,
  tags,
  awakeners,
  awakenerManifestations: [atm],
  awakenerLocalInteractions: [local],
  ...empty,
});

const atmRow = allTags.rows.find((r) => r.id === "awakener:100");
const aeRow = allTags.rows.find((r) => r.id === "awakener-aftereffect:50");
assert(atmRow, "ATM row missing");
assert(aeRow, "aftereffect row missing");
assert(atmRow.value === 600, `ATM value expected 600 got ${atmRow.value}`);
// contrib = 300 * 0.5 = 150; × 2 = 300
assert(aeRow.value === 300, `aftereffect value expected 300 got ${aeRow.value}`);
assert(aeRow.tag.includes("Poison"), `aftereffect tag expected Poison got ${aeRow.tag}`);
assert(
  aeRow.metadata === "Active Damage notes",
  `aftereffect metadata expected trimmed ATM notes got ${JSON.stringify(aeRow.metadata)}`,
);
assert(
  atmRow.metadata === "Active Damage notes",
  `ATM metadata expected trimmed notes got ${JSON.stringify(atmRow.metadata)}`,
);

const poisonOnly = buildSearchResults({
  filters: { ...emptyFilters, tagId: 2 },
  tags,
  awakeners,
  awakenerManifestations: [atm],
  awakenerLocalInteractions: [local],
  ...empty,
});
assert(
  poisonOnly.rows.length === 1 &&
    poisonOnly.rows[0]?.id === "awakener-aftereffect:50",
  "Poison filter should return only aftereffect row",
);

const disabled = buildSearchResults({
  filters: emptyFilters,
  tags,
  awakeners,
  awakenerManifestations: [atm],
  awakenerLocalInteractions: [{ ...local, is_disabled: true }],
  ...empty,
});
assert(
  !disabled.rows.some((r) => r.id.startsWith("awakener-aftereffect:")),
  "disabled aftereffect should be omitted",
);

const uniqueScalingIgnored = buildSearchResults({
  filters: emptyFilters,
  tags,
  awakeners,
  awakenerManifestations: [atm],
  awakenerLocalInteractions: [
    { ...local, mode: "unique_scaling", target_tag_id: null, modifier_tag_id: 2 },
  ],
  ...empty,
});
assert(
  !uniqueScalingIgnored.rows.some((r) =>
    r.id.startsWith("awakener-aftereffect:"),
  ),
  "unique_scaling should not emit aftereffect rows",
);

// Final ceil: raw finishedOnce (no dep) = 1.1; × 3 = 3.3 → ceil 4 (non-percent)
const ceilAtm = {
  ...atm,
  id: 101,
  tag_id: 1,
  value_scalar: 1.1,
  dependency_stat: null,
  instance_count: 3,
  metadata: null,
} as PublicRow<"awakener_tag_manifestation">;
const ceilLocal = {
  ...local,
  id: 51,
  manifestation_id: 101,
  value_scalar: 0.4,
  target_tag_id: 2,
} as PublicRow<"awakener_local_manifestation_interaction">;
const ceilCase = buildSearchResults({
  filters: emptyFilters,
  tags,
  awakeners,
  awakenerManifestations: [ceilAtm],
  awakenerLocalInteractions: [ceilLocal],
  ...empty,
});
const ceilAtmRow = ceilCase.rows.find((r) => r.id === "awakener:101");
const ceilAeRow = ceilCase.rows.find((r) => r.id === "awakener-aftereffect:51");
assert(ceilAtmRow, "ceil ATM row missing");
assert(ceilAeRow, "ceil aftereffect row missing");
// 1.1 * 3 = 3.3 → Math.ceil = 4
assert(
  ceilAtmRow.value === 4,
  `ATM final ceil expected 4 got ${ceilAtmRow.value}`,
);
// contrib = 1.1 * 0.4 = 0.44; × 3 = 1.32 → Math.ceil = 2
assert(
  ceilAeRow.value === 2,
  `aftereffect final ceil expected 2 got ${ceilAeRow.value}`,
);

// Percent target: finishedOnce 0.113 (raw); factor 1; instances 1 → ceil to 2dp = 0.12
const pctAtm = {
  ...atm,
  id: 102,
  tag_id: 3,
  value_scalar: 0.113,
  dependency_stat: null,
  instance_count: 1,
  metadata: "pct notes",
} as PublicRow<"awakener_tag_manifestation">;
const pctLocal = {
  ...local,
  id: 52,
  manifestation_id: 102,
  value_scalar: 1,
  target_tag_id: 3,
} as PublicRow<"awakener_local_manifestation_interaction">;
const pctCase = buildSearchResults({
  filters: { ...emptyFilters, tagId: 3 },
  tags,
  awakeners,
  awakenerManifestations: [pctAtm],
  awakenerLocalInteractions: [pctLocal],
  ...empty,
});
const pctAtmRow = pctCase.rows.find((r) => r.id === "awakener:102");
const pctAeRow = pctCase.rows.find((r) => r.id === "awakener-aftereffect:52");
assert(pctAtmRow, "percent ATM row missing");
assert(pctAeRow, "percent aftereffect row missing");
assert(
  pctAtmRow.value === 0.12,
  `percent ATM ceil expected 0.12 got ${pctAtmRow.value}`,
);
assert(
  pctAeRow.value === 0.12,
  `percent aftereffect ceil expected 0.12 got ${pctAeRow.value}`,
);
assert(
  pctAeRow.metadata === "pct notes",
  `percent aftereffect metadata expected pct notes got ${JSON.stringify(pctAeRow.metadata)}`,
);

console.log("smoke-search-aftereffect: ok");
