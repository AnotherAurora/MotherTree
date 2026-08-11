import type { TableRow } from "@/lib/database.types";

/** Public SELECT allowlist — expand only when amending the public site plan. */
export const PUBLIC_READ_TABLES = [
  "realm",
  "realm_tag_manifestation",
  "covenant",
  "covenant_tag_manifestation",
  "awakener",
  "awakener_tag_manifestation",
  "awakener_local_manifestation_interaction",
  "posse",
  "posse_tag_manifestation",
  "wheel",
  "wheel_tag_manifestation",
  "tag",
  "tag_default_interaction",
] as const;

export type PublicReadTable = (typeof PUBLIC_READ_TABLES)[number];

export const PUBLIC_ROW_LIMIT = 500;
export const PUBLIC_RATE_LIMIT_PER_MINUTE = 60;

const HIDDEN_COLUMNS = ["created_at", "updated_at", "deleted_at"] as const;
export type PublicHiddenColumn = (typeof HIDDEN_COLUMNS)[number];

export type PublicRow<T extends PublicReadTable> = Omit<
  TableRow<T>,
  PublicHiddenColumn
>;

/** Explicit projections — never select audit/soft-delete timestamps. */
export const PUBLIC_TABLE_COLUMNS = {
  realm: ["id", "name", "replace"],
  realm_tag_manifestation: [
    "id",
    "realm_id",
    "tag_id",
    "metadata",
    "value_scalar",
    "is_accumulating",
    "is_permanent",
    "required_realm_mode",
    "dependency_stat",
    "trigger_condition",
    "dependency_rate",
    "pure_bonus_target",
    "dependency_rate_stat",
  ],
  covenant: ["id", "name", "stat", "stat_amount", "team_unique"],
  covenant_tag_manifestation: [
    "id",
    "covenant_id",
    "tag_id",
    "metadata",
    "value_scalar",
    "target_type",
    "replaces_manifestation_id",
    "is_accumulating",
    "is_permanent",
    "buff_target_type_restriction",
    "dependency_stat",
    "trigger_condition",
    "required_realm1",
    "required_realm2",
  ],
  awakener: [
    "id",
    "name",
    "con",
    "atk",
    "def",
    "keyflare_regen",
    "damage_amp",
    "crit_rate",
    "crit_dmg",
    "realm_mastery",
    "aliemus_regen",
    "sigil_yield",
    "death_resist",
    "enlightenment",
    "base_aliemus",
    "realm",
  ],
  awakener_tag_manifestation: [
    "id",
    "awakener_id",
    "tag_id",
    "metadata",
    "value_scalar",
    "instance_count",
    "required_enlightenment",
    "source_type",
    "target_type",
    "dependency_stat",
    "buff_target_type_restriction",
    "replaces_manifestation_id",
    "is_accumulating",
    "is_permanent",
    "trigger_condition",
    "required_realm",
    "base_copies",
    "copy_provider_group_id",
  ],
  awakener_local_manifestation_interaction: [
    "id",
    "manifestation_id",
    "modifier_tag_id",
    "value_scalar",
    "is_disabled",
    "math_operation",
    "target_type",
    "dependency_stat",
    "mode",
    "layer",
    "target_tag_id",
  ],
  posse: ["id", "name"],
  posse_tag_manifestation: [
    "id",
    "posse_id",
    "tag_id",
    "required_awakener",
    "value_scalar",
    "target_type",
    "metadata",
    "is_accumulating",
    "is_permanent",
    "dependency_stat",
    "group_key",
    "buff_target_type_restriction",
    "required_realm",
  ],
  wheel: ["id", "name", "stat", "stat_amount", "rarity", "enlightenment"],
  wheel_tag_manifestation: [
    "id",
    "wheel_id",
    "tag_id",
    "metadata",
    "dependency_stat",
    "value_scalar",
    "target_type",
    "buff_target_type_restriction",
    "is_accumulating",
    "is_permanent",
    "trigger_condition",
    "required_realm",
  ],
  tag: ["id", "tag_name", "layer", "is_percent", "is_additive", "is_searchable"],
  tag_default_interaction: [
    "id",
    "modifier_tag_id",
    "target_tag_id",
    "math_operation",
    "default_factor",
    "exclusion_suffix",
    "buff_target_type_restriction",
    "creates_base",
    "amplifies_subject",
  ],
} as const satisfies {
  [K in PublicReadTable]: readonly (keyof PublicRow<K> & string)[];
};

export function isPublicReadTable(value: string): value is PublicReadTable {
  return (PUBLIC_READ_TABLES as readonly string[]).includes(value);
}

export function publicSelectClause(table: PublicReadTable): string {
  return PUBLIC_TABLE_COLUMNS[table].join(",");
}
