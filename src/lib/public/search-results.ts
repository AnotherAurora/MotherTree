import type { Enums } from "@/lib/database.types";
import { scaleValueScalar } from "@/lib/path-carver/effective-value-scalar";
import {
  PUBLIC_ROW_LIMIT,
  type PublicRow,
} from "@/lib/public-read/allowlist";
import {
  SEARCH_FROM_OPTIONS,
  formatSearchBuffRestrictionLabel,
  formatSearchDependencyStatLabel,
  formatSearchRealmLabel,
  formatSearchTagLabel,
  formatSearchTargetTypeLabel,
  type SearchFromValue,
  type SearchRequiredRealmId,
} from "@/lib/public/search-filter-options";
import { matchesDemandTag } from "@/lib/simulator/tag-matching";
import { applyManifestationReplacements } from "@/lib/team-data/resolve-manifestations";
import type { AllStats, Awakener } from "@/lib/team-data/types";

const EMPTY_DISPLAY = "—";

export type SearchQueryFilters = {
  tagId: number | null;
  from: SearchFromValue | null;
  targetType: Enums<"target_type"> | null;
  dependencyStat: Enums<"all_stats"> | null;
  buffRestriction: Enums<"source_type"> | null;
  everyTurn: boolean | null;
  triggerConditionTagId: number | null;
  requiredRealmId: SearchRequiredRealmId | null;
  /** Assumed awakener enlightenment (Path Carver load/resolve gate). */
  awakenerEnlightenment: number;
};

export type SearchResultRow = {
  id: string;
  assetKind: SearchFromValue;
  from: string;
  name: string;
  tag: string;
  targetType: string;
  dependencyStat: string;
  /** Numeric value for sorting; null when value_scalar is null. */
  value: number | null;
  valueDisplay: string;
  buffRestriction: string;
  everyTurn: string;
  triggerCondition: string;
  requiredRealm: string;
  /** Awakener manifestation notes only; null for other sources / empty. */
  metadata: string | null;
};

export type SearchResultsInput = {
  filters: SearchQueryFilters;
  tags: PublicRow<"tag">[];
  realms: PublicRow<"realm">[];
  awakeners: PublicRow<"awakener">[];
  wheels: PublicRow<"wheel">[];
  posses: PublicRow<"posse">[];
  covenants: PublicRow<"covenant">[];
  awakenerManifestations: PublicRow<"awakener_tag_manifestation">[];
  wheelManifestations: PublicRow<"wheel_tag_manifestation">[];
  posseManifestations: PublicRow<"posse_tag_manifestation">[];
  covenantManifestations: PublicRow<"covenant_tag_manifestation">[];
};

export type SearchResultsOutput = {
  rows: SearchResultRow[];
  truncated: boolean;
};

type NamedParent = { id: number; name: string | null };

function fromLabel(from: SearchFromValue): string {
  return SEARCH_FROM_OPTIONS.find((o) => o.value === from)?.label ?? from;
}

function parentName(
  parents: ReadonlyMap<number, NamedParent>,
  id: number | null | undefined,
): string {
  if (id == null) return EMPTY_DISPLAY;
  const name = parents.get(id)?.name?.trim();
  return name && name.length > 0 ? name : EMPTY_DISPLAY;
}

function formatOptionalEnum(
  value: string | null | undefined,
  format: (v: string) => string,
): string {
  if (value == null || value === "") return EMPTY_DISPLAY;
  return format(value);
}

function formatValueDisplay(
  value: number | null,
  isPercent: boolean,
): string {
  if (value == null) return EMPTY_DISPLAY;
  if (!isPercent) return String(value);
  // Stored fraction → percent points (0.3 → 30%); trim float noise.
  const pct = Math.round(value * 100 * 1e10) / 1e10;
  return `${pct}%`;
}

function formatEveryTurn(isAccumulating: boolean): string {
  return isAccumulating ? "Yes" : EMPTY_DISPLAY;
}

function formatTriggerCondition(
  triggerCondition: number | null | undefined,
  tagsById: ReadonlyMap<number, PublicRow<"tag">>,
): string {
  if (triggerCondition == null) return EMPTY_DISPLAY;
  const tag = tagsById.get(triggerCondition);
  if (!tag) return EMPTY_DISPLAY;
  return formatSearchTagLabel(tag.tag_name);
}

function formatRequiredRealmSingle(
  realmId: number | null | undefined,
  realmsById: ReadonlyMap<number, PublicRow<"realm">>,
): string {
  if (realmId == null) return EMPTY_DISPLAY;
  const realm = realmsById.get(realmId);
  if (!realm) return EMPTY_DISPLAY;
  return formatSearchRealmLabel(realm.name ?? String(realmId));
}

function formatRequiredRealmCovenant(
  realm1: number | null | undefined,
  realm2: number | null | undefined,
  realmsById: ReadonlyMap<number, PublicRow<"realm">>,
): string {
  const parts: string[] = [];
  const a = formatRequiredRealmSingle(realm1, realmsById);
  const b = formatRequiredRealmSingle(realm2, realmsById);
  if (a !== EMPTY_DISPLAY) parts.push(a);
  if (b !== EMPTY_DISPLAY) parts.push(b);
  if (parts.length === 0) return EMPTY_DISPLAY;
  return parts.join(" / ");
}

/** Expand selected tag to exact + dotted descendants. */
export function expandTagIdsForSearch(
  tags: readonly PublicRow<"tag">[],
  selectedTagId: number,
): Set<number> | null {
  const selected = tags.find((t) => t.id === selectedTagId);
  if (!selected) return null;
  const selectedName = selected.tag_name;
  const ids = new Set<number>();
  for (const tag of tags) {
    if (matchesDemandTag(tag.tag_name, selectedName)) {
      ids.add(tag.id);
    }
  }
  return ids;
}

export function publicAwakenerToScalingAwakener(
  row: PublicRow<"awakener">,
): Awakener {
  return {
    id: row.id,
    name: row.name,
    realm: null,
    realmId: row.realm,
    con: row.con,
    atk: row.atk,
    def: row.def,
    keyflareRegen: row.keyflare_regen,
    damageAmp: row.damage_amp,
    critRate: row.crit_rate,
    critDmg: row.crit_dmg,
    realmMastery: row.realm_mastery,
    baseAliemus: row.base_aliemus,
    aliemusRegen: row.aliemus_regen,
    sigilYield: row.sigil_yield,
    deathResist: row.death_resist,
    enlightenment: row.enlightenment,
  };
}

function computeAwakenerValue(
  raw: number | null,
  dependencyStat: Enums<"all_stats"> | null,
  awakener: Awakener | null,
  tagIsPercent: boolean,
): number | null {
  if (raw == null) return null;
  return scaleValueScalar(
    raw,
    dependencyStat as AllStats | null,
    awakener,
    "awakener",
    tagIsPercent,
  );
}

function computeRawValue(raw: number | null): number | null {
  return raw == null ? null : raw;
}

type CommonManifestFilters = {
  tagId: number | null;
  targetType: Enums<"target_type"> | null;
  dependencyStat: Enums<"all_stats"> | null;
  buffRestriction: Enums<"source_type"> | null;
  isAccumulating: boolean;
};

function passesCommonFilters(
  row: CommonManifestFilters,
  filters: SearchQueryFilters,
  matchingTagIds: Set<number> | null,
): boolean {
  if (matchingTagIds != null) {
    if (row.tagId == null || !matchingTagIds.has(row.tagId)) return false;
  }
  if (filters.targetType != null && row.targetType !== filters.targetType) {
    return false;
  }
  if (
    filters.dependencyStat != null &&
    row.dependencyStat !== filters.dependencyStat
  ) {
    return false;
  }
  if (
    filters.buffRestriction != null &&
    row.buffRestriction !== filters.buffRestriction
  ) {
    return false;
  }
  if (filters.everyTurn === true && !row.isAccumulating) {
    return false;
  }
  return true;
}

function formatMetadata(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function sortAndCap(rows: SearchResultRow[]): SearchResultsOutput {
  // Negative Value is a penalty/debuff; omit it from Search results.
  const visible = rows.filter((row) => row.value == null || row.value >= 0);
  visible.sort((a, b) => {
    const av = a.value;
    const bv = b.value;
    if (av == null && bv == null) {
      return a.name.localeCompare(b.name);
    }
    if (av == null) return 1;
    if (bv == null) return -1;
    if (bv !== av) return bv - av;
    return a.name.localeCompare(b.name);
  });

  const truncated = visible.length > PUBLIC_ROW_LIMIT;
  return {
    rows: truncated ? visible.slice(0, PUBLIC_ROW_LIMIT) : visible,
    truncated,
  };
}

/**
 * Filter, join, scale, sort, and cap Search manifestation results in memory.
 */
export function buildSearchResults(
  input: SearchResultsInput,
): SearchResultsOutput {
  const { filters } = input;
  const tagsById = new Map(input.tags.map((t) => [t.id, t]));
  const realmsById = new Map(input.realms.map((r) => [r.id, r]));
  const awakenersById = new Map(input.awakeners.map((a) => [a.id, a]));
  const wheelsById = new Map(input.wheels.map((w) => [w.id, w]));
  const possesById = new Map(input.posses.map((p) => [p.id, p]));
  const covenantsById = new Map(input.covenants.map((c) => [c.id, c]));

  const matchingTagIds =
    filters.tagId != null
      ? expandTagIdsForSearch(input.tags, filters.tagId)
      : null;

  // Selected tag missing from catalog → no matches.
  if (filters.tagId != null && matchingTagIds == null) {
    return { rows: [], truncated: false };
  }

  const sources: SearchFromValue[] =
    filters.from != null
      ? [filters.from]
      : ["awakener", "wheel", "posse", "covenant"];

  const rows: SearchResultRow[] = [];

  if (sources.includes("awakener")) {
    // Mirror Path Carver load/resolve: enlightenment gate, then replacements,
    // then Search filters on survivors.
    const enlightenmentGated = input.awakenerManifestations.filter(
      (m) =>
        (m.required_enlightenment ?? 0) <= filters.awakenerEnlightenment,
    );
    const resolvedAwakenerManifestations = applyManifestationReplacements(
      enlightenmentGated.map((row) => ({
        ...row,
        replacesManifestationId: row.replaces_manifestation_id,
      })),
    );

    for (const m of resolvedAwakenerManifestations) {
      if (
        !passesCommonFilters(
          {
            tagId: m.tag_id,
            targetType: m.target_type,
            dependencyStat: m.dependency_stat,
            buffRestriction: m.buff_target_type_restriction,
            isAccumulating: m.is_accumulating,
          },
          filters,
          matchingTagIds,
        )
      ) {
        continue;
      }
      if (
        filters.triggerConditionTagId != null &&
        m.trigger_condition !== filters.triggerConditionTagId
      ) {
        continue;
      }
      if (
        filters.requiredRealmId != null &&
        m.required_realm !== filters.requiredRealmId
      ) {
        continue;
      }

      const tag = tagsById.get(m.tag_id);
      const awakenerRow = awakenersById.get(m.awakener_id);
      const scalingAwakener = awakenerRow
        ? publicAwakenerToScalingAwakener(awakenerRow)
        : null;
      const value = computeAwakenerValue(
        m.value_scalar,
        m.dependency_stat,
        scalingAwakener,
        tag?.is_percent === true,
      );

      rows.push({
        id: `awakener:${m.id}`,
        assetKind: "awakener",
        from: fromLabel("awakener"),
        name: parentName(awakenersById, m.awakener_id),
        tag: tag ? formatSearchTagLabel(tag.tag_name) : EMPTY_DISPLAY,
        targetType: formatOptionalEnum(
          m.target_type,
          formatSearchTargetTypeLabel,
        ),
        dependencyStat: formatOptionalEnum(
          m.dependency_stat,
          formatSearchDependencyStatLabel,
        ),
        value,
        valueDisplay: formatValueDisplay(value, tag?.is_percent === true),
        buffRestriction: formatOptionalEnum(
          m.buff_target_type_restriction,
          formatSearchBuffRestrictionLabel,
        ),
        everyTurn: formatEveryTurn(m.is_accumulating),
        triggerCondition: formatTriggerCondition(
          m.trigger_condition,
          tagsById,
        ),
        requiredRealm: formatRequiredRealmSingle(
          m.required_realm,
          realmsById,
        ),
        metadata: formatMetadata(m.metadata),
      });
    }
  }

  if (sources.includes("wheel")) {
    for (const m of input.wheelManifestations) {
      if (
        !passesCommonFilters(
          {
            tagId: m.tag_id,
            targetType: m.target_type,
            dependencyStat: m.dependency_stat,
            buffRestriction: m.buff_target_type_restriction,
            isAccumulating: m.is_accumulating,
          },
          filters,
          matchingTagIds,
        )
      ) {
        continue;
      }
      if (
        filters.triggerConditionTagId != null &&
        m.trigger_condition !== filters.triggerConditionTagId
      ) {
        continue;
      }
      if (
        filters.requiredRealmId != null &&
        m.required_realm !== filters.requiredRealmId
      ) {
        continue;
      }

      const tag = m.tag_id != null ? tagsById.get(m.tag_id) : undefined;
      const value = computeRawValue(m.value_scalar);

      rows.push({
        id: `wheel:${m.id}`,
        assetKind: "wheel",
        from: fromLabel("wheel"),
        name: parentName(wheelsById, m.wheel_id),
        tag: tag ? formatSearchTagLabel(tag.tag_name) : EMPTY_DISPLAY,
        targetType: formatOptionalEnum(
          m.target_type,
          formatSearchTargetTypeLabel,
        ),
        dependencyStat: formatOptionalEnum(
          m.dependency_stat,
          formatSearchDependencyStatLabel,
        ),
        value,
        valueDisplay: formatValueDisplay(
          value,
          tag?.is_percent === true || m.dependency_stat != null,
        ),
        buffRestriction: formatOptionalEnum(
          m.buff_target_type_restriction,
          formatSearchBuffRestrictionLabel,
        ),
        everyTurn: formatEveryTurn(m.is_accumulating),
        triggerCondition: formatTriggerCondition(
          m.trigger_condition,
          tagsById,
        ),
        requiredRealm: formatRequiredRealmSingle(
          m.required_realm,
          realmsById,
        ),
        metadata: null,
      });
    }
  }

  if (sources.includes("posse")) {
    // Posse has no trigger_condition — never matches when that filter is set.
    if (filters.triggerConditionTagId == null) {
      for (const m of input.posseManifestations) {
        if (
          !passesCommonFilters(
            {
              tagId: m.tag_id,
              targetType: m.target_type,
              dependencyStat: m.dependency_stat,
              buffRestriction: m.buff_target_type_restriction,
              isAccumulating: m.is_accumulating,
            },
            filters,
            matchingTagIds,
          )
        ) {
          continue;
        }
        if (
          filters.requiredRealmId != null &&
          m.required_realm !== filters.requiredRealmId
        ) {
          continue;
        }

        const tag = m.tag_id != null ? tagsById.get(m.tag_id) : undefined;
        const value = computeRawValue(m.value_scalar);

        rows.push({
          id: `posse:${m.id}`,
          assetKind: "posse",
          from: fromLabel("posse"),
          name: parentName(possesById, m.posse_id),
          tag: tag ? formatSearchTagLabel(tag.tag_name) : EMPTY_DISPLAY,
          targetType: formatOptionalEnum(
            m.target_type,
            formatSearchTargetTypeLabel,
          ),
          dependencyStat: formatOptionalEnum(
            m.dependency_stat,
            formatSearchDependencyStatLabel,
          ),
          value,
          valueDisplay: formatValueDisplay(
            value,
            tag?.is_percent === true || m.dependency_stat != null,
          ),
          buffRestriction: formatOptionalEnum(
            m.buff_target_type_restriction,
            formatSearchBuffRestrictionLabel,
          ),
          everyTurn: formatEveryTurn(m.is_accumulating),
          triggerCondition: EMPTY_DISPLAY,
          requiredRealm: formatRequiredRealmSingle(
            m.required_realm,
            realmsById,
          ),
          metadata: null,
        });
      }
    }
  }

  if (sources.includes("covenant")) {
    for (const m of input.covenantManifestations) {
      if (
        !passesCommonFilters(
          {
            tagId: m.tag_id,
            targetType: m.target_type,
            dependencyStat: m.dependency_stat,
            buffRestriction: m.buff_target_type_restriction,
            isAccumulating: m.is_accumulating,
          },
          filters,
          matchingTagIds,
        )
      ) {
        continue;
      }
      if (
        filters.triggerConditionTagId != null &&
        m.trigger_condition !== filters.triggerConditionTagId
      ) {
        continue;
      }
      if (filters.requiredRealmId != null) {
        const matches =
          m.required_realm1 === filters.requiredRealmId ||
          m.required_realm2 === filters.requiredRealmId;
        if (!matches) continue;
      }

      const tag = m.tag_id != null ? tagsById.get(m.tag_id) : undefined;
      const value = computeRawValue(m.value_scalar);

      rows.push({
        id: `covenant:${m.id}`,
        assetKind: "covenant",
        from: fromLabel("covenant"),
        name: parentName(covenantsById, m.covenant_id),
        tag: tag ? formatSearchTagLabel(tag.tag_name) : EMPTY_DISPLAY,
        targetType: formatOptionalEnum(
          m.target_type,
          formatSearchTargetTypeLabel,
        ),
        dependencyStat: formatOptionalEnum(
          m.dependency_stat,
          formatSearchDependencyStatLabel,
        ),
        value,
        valueDisplay: formatValueDisplay(
          value,
          tag?.is_percent === true || m.dependency_stat != null,
        ),
        buffRestriction: formatOptionalEnum(
          m.buff_target_type_restriction,
          formatSearchBuffRestrictionLabel,
        ),
        everyTurn: formatEveryTurn(m.is_accumulating),
        triggerCondition: formatTriggerCondition(
          m.trigger_condition,
          tagsById,
        ),
        requiredRealm: formatRequiredRealmCovenant(
          m.required_realm1,
          m.required_realm2,
          realmsById,
        ),
        metadata: null,
      });
    }
  }

  return sortAndCap(rows);
}
