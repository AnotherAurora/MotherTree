import type { Enums } from "@/lib/database.types";
import { ENUM_VALUES } from "@/lib/database.types";

export type SearchTagOption = {
  id: number;
  tag_name: string;
  layer: Enums<"layer"> | null;
  is_searchable: boolean;
};

export type SearchInteractionEdge = {
  modifier_tag_id: number | null;
  target_tag_id: number | null;
};

export type SearchRealmOption = {
  id: number;
  name: string | null;
};

export type AttackerLayerBucket = "pre_add" | "add" | "post_add";

/** Base realms exposed on Search Required Realm filter. */
export const SEARCH_REQUIRED_REALM_IDS = [1, 2, 4, 6] as const;

export type SearchRequiredRealmId = (typeof SEARCH_REQUIRED_REALM_IDS)[number];

/** Catalog scopes for the Search "From" filter (manifestation parent tables). */
export const SEARCH_FROM_OPTIONS = [
  { value: "awakener", label: "Awakener" },
  { value: "wheel", label: "Wheel" },
  { value: "posse", label: "Posse" },
  { value: "covenant", label: "Covenant" },
] as const;

export type SearchFromValue = (typeof SEARCH_FROM_OPTIONS)[number]["value"];

/** Exact dotted segments dropped from Search display labels. */
export const SEARCH_TAG_LABEL_DROPPED_SEGMENTS = new Set([
  "Attacker",
  "Defender",
  "Support",
  "Special",
  "When",
  "Fixed",
  "Debuff",
]);

/**
 * Human-readable Search label for a tag_name.
 * Keeps raw tag_name elsewhere for ids / filtering / queries.
 */
export function formatSearchTagLabel(tagName: string): string {
  const kept = tagName
    .split(".")
    .filter((segment) => segment.length > 0)
    .filter((segment) => !SEARCH_TAG_LABEL_DROPPED_SEGMENTS.has(segment));
  if (kept.length === 0) return tagName;
  return kept.join(" for ");
}

/**
 * Human-readable Search label for an all_stats enum value.
 * Stored filter value stays the raw enum string.
 */
export function formatSearchDependencyStatLabel(stat: string): string {
  if (stat === "con" || stat === "atk" || stat === "def") {
    return stat.toUpperCase();
  }
  return stat
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Human-readable Search label for a target_type enum value.
 * Stored filter value stays the raw enum string.
 */
export function formatSearchTargetTypeLabel(targetType: string): string {
  if (targetType === "aoe") return "AoE";
  if (targetType.length === 0) return targetType;
  return targetType.charAt(0).toUpperCase() + targetType.slice(1);
}

/**
 * Human-readable Search label for a source_type / buff restriction enum value.
 * Stored filter value stays the raw enum string.
 */
export function formatSearchBuffRestrictionLabel(value: string): string {
  return value
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Human-readable Search label for a realm name.
 * Stored filter value stays the realm id.
 */
export function formatSearchRealmLabel(name: string): string {
  return formatSearchBuffRestrictionLabel(name);
}

function sortByTagName(a: SearchTagOption, b: SearchTagOption): number {
  return a.tag_name.localeCompare(b.tag_name);
}

/**
 * Tags that are prefix seeds OR can reach a prefix seed by walking
 * modifier → target edges (non-searchable tags participate in the walk).
 * Returned set is searchable-only.
 */
export function tagsReachingPrefix(
  tags: readonly SearchTagOption[],
  interactions: readonly SearchInteractionEdge[],
  prefix: string,
): SearchTagOption[] {
  const byId = new Map(tags.map((t) => [t.id, t]));
  const incoming = new Map<number, number[]>();

  for (const edge of interactions) {
    const mod = edge.modifier_tag_id;
    const target = edge.target_tag_id;
    if (mod == null || target == null) continue;
    if (!byId.has(mod) || !byId.has(target)) continue;
    const list = incoming.get(target);
    if (list) list.push(mod);
    else incoming.set(target, [mod]);
  }

  const reachable = new Set<number>();
  const queue: number[] = [];

  for (const tag of tags) {
    if (tag.tag_name.startsWith(prefix)) {
      reachable.add(tag.id);
      queue.push(tag.id);
    }
  }

  while (queue.length > 0) {
    const targetId = queue.pop()!;
    const modifiers = incoming.get(targetId);
    if (!modifiers) continue;
    for (const modId of modifiers) {
      if (reachable.has(modId)) continue;
      reachable.add(modId);
      queue.push(modId);
    }
  }

  return tags
    .filter((t) => reachable.has(t.id) && t.is_searchable)
    .sort(sortByTagName);
}

/** null layer buckets with add (engine treats null like add). */
export function attackerLayerBucket(
  layer: Enums<"layer"> | null,
): AttackerLayerBucket {
  if (layer === "pre_add") return "pre_add";
  if (layer === "post_add") return "post_add";
  return "add";
}

export function bucketAttackerTags(tags: readonly SearchTagOption[]): {
  pre_add: SearchTagOption[];
  add: SearchTagOption[];
  post_add: SearchTagOption[];
} {
  const buckets = {
    pre_add: [] as SearchTagOption[],
    add: [] as SearchTagOption[],
    post_add: [] as SearchTagOption[],
  };
  for (const tag of tags) {
    buckets[attackerLayerBucket(tag.layer)].push(tag);
  }
  buckets.pre_add.sort(sortByTagName);
  buckets.add.sort(sortByTagName);
  buckets.post_add.sort(sortByTagName);
  return buckets;
}

export function supportSearchTags(
  tags: readonly SearchTagOption[],
): SearchTagOption[] {
  return tags
    .filter((t) => t.is_searchable && t.tag_name.startsWith("Support."))
    .sort(sortByTagName);
}

export function triggerConditionTags(
  tags: readonly SearchTagOption[],
): SearchTagOption[] {
  return tags
    .filter((t) => t.is_searchable && t.tag_name.startsWith("Special.When."))
    .sort(sortByTagName);
}

export function requiredRealmOptions(
  realms: readonly SearchRealmOption[],
): { id: SearchRequiredRealmId; name: string }[] {
  const byId = new Map(realms.map((r) => [r.id, r]));
  const out: { id: SearchRequiredRealmId; name: string }[] = [];
  for (const id of SEARCH_REQUIRED_REALM_IDS) {
    const row = byId.get(id);
    out.push({ id, name: row?.name?.trim() || String(id) });
  }
  return out;
}

export function buildSearchFilterOptions(
  tags: readonly SearchTagOption[],
  interactions: readonly SearchInteractionEdge[],
  realms: readonly SearchRealmOption[],
) {
  const attackerReachable = tagsReachingPrefix(tags, interactions, "Attacker.");
  const defenderReachable = tagsReachingPrefix(tags, interactions, "Defender.");

  return {
    attacker: bucketAttackerTags(attackerReachable),
    defender: defenderReachable,
    support: supportSearchTags(tags),
    triggerCondition: triggerConditionTags(tags),
    requiredRealm: requiredRealmOptions(realms),
    targetType: ENUM_VALUES.target_type,
    dependencyStat: ENUM_VALUES.all_stats,
    buffRestriction: ENUM_VALUES.source_type.filter(
      (v) => v !== "rouse" && v !== "talent",
    ),
    from: SEARCH_FROM_OPTIONS,
  };
}

export type SearchFilterOptions = ReturnType<typeof buildSearchFilterOptions>;
