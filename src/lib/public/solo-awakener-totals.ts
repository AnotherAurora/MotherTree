/**
 * Public Search solo-kit Review Tags totals (Phase 7).
 * Builds a one-slot TeamData from allowlisted public rows and runs Path Carver math.
 */
import { computeReviewTagTotals } from "@/lib/path-carver/aggregate-tag-scalars";
import { REQUIRED_BASE_STAT_TAG_IDS } from "@/lib/path-carver/awakener-base-stats";
import {
  createManifestationApplyContext,
  isManifestationApplied,
} from "@/lib/path-carver/manifestation-apply";
import { ENUM_VALUES } from "@/lib/database.types";
import type { PublicRow } from "@/lib/public-read/allowlist";
import {
  SEARCH_REQUIRED_REALM_IDS,
  type SearchRequiredRealmId,
} from "@/lib/public/search-filter-options";
import { applyManifestationReplacements } from "@/lib/team-data/resolve-manifestations";
import {
  DEFAULT_COPY_INSTANCE_FIELDS,
  NON_REALM_MANIFESTATION_FIELDS,
  type Awakener,
  type AwakenerLocalManifestationInteraction,
  type DefaultInteraction,
  type Manifestation,
  type Realm,
  type RealmLookupRow,
  type Tag,
  type TeamData,
} from "@/lib/team-data/types";

/** Appended once to solo Attacker/Defender metadata when any catalog RTM applied. */
export const REALM_GIMMICK_METADATA = "Realm gimmick";

const TARGET_TYPE_ORDER = new Map(
  ENUM_VALUES.target_type.map((value, index) => [value, index]),
);

/** Multi-realm Search exception (display name without edge quotes). */
export const MULTI_REALM_AWAKENER_NAME = "24";

/** Match DB names like `"24"` the same way asset slug lookup strips edge quotes. */
export function normalizeAwakenerSearchName(
  name: string | null | undefined,
): string {
  return (name ?? "").trim().replace(/^["']|["']$/g, "");
}

export function isAttackerOrDefenderTagName(tagName: string): boolean {
  return tagName.startsWith("Attacker.") || tagName.startsWith("Defender.");
}

export function isMultiRealmSearchAwakener(
  awakener: Pick<PublicRow<"awakener">, "name">,
): boolean {
  return (
    normalizeAwakenerSearchName(awakener.name) === MULTI_REALM_AWAKENER_NAME
  );
}

/**
 * Realm ids to simulate for one awakener.
 * Non-"24": native realm only (empty if null / filtered out).
 * "24": all search realms, or the Required Realm filter alone.
 */
export function realmSimsForAwakener(
  awakener: PublicRow<"awakener">,
  requiredRealmId: SearchRequiredRealmId | null,
): number[] {
  if (isMultiRealmSearchAwakener(awakener)) {
    if (requiredRealmId != null) return [requiredRealmId];
    return [...SEARCH_REQUIRED_REALM_IDS];
  }
  if (awakener.realm == null) return [];
  if (requiredRealmId != null && awakener.realm !== requiredRealmId) {
    return [];
  }
  return [awakener.realm];
}

export type SoloAwakenerCatalog = {
  tags: readonly PublicRow<"tag">[];
  realms: readonly PublicRow<"realm">[];
  realmManifestations: readonly PublicRow<"realm_tag_manifestation">[];
  defaultInteractions: readonly PublicRow<"tag_default_interaction">[];
  awakenerManifestations: readonly PublicRow<"awakener_tag_manifestation">[];
  awakenerLocalInteractions: readonly PublicRow<"awakener_local_manifestation_interaction">[];
};

export type SoloAwakenerTotalsResult = {
  totalsByTagId: Map<number, number>;
  hasAppliedRealmManifestation: boolean;
};

export type SoloTotalsCache = Map<string, SoloAwakenerTotalsResult>;

function cacheKey(
  awakenerId: number,
  realmId: number,
  enlightenment: number,
): string {
  return `${awakenerId}:${realmId}:${enlightenment}`;
}

function hasAppliedCatalogRealmManifestation(
  manifestations: readonly Manifestation[],
  applyContext: ReturnType<typeof createManifestationApplyContext>,
): boolean {
  for (const m of manifestations) {
    if (m.sourceKind !== "realm") continue;
    if (isManifestationApplied(m, applyContext)) return true;
  }
  return false;
}

function toTag(row: PublicRow<"tag">): Tag {
  return {
    id: row.id,
    tagName: row.tag_name,
    layer: row.layer,
    isPercent: row.is_percent === true,
    isAdditive: row.is_additive !== false,
  };
}

function buildTagsById(tags: readonly PublicRow<"tag">[]): Record<number, Tag> {
  const tagsById: Record<number, Tag> = {};
  for (const row of tags) {
    tagsById[row.id] = toTag(row);
  }
  return tagsById;
}

function realmLookupRows(
  realms: readonly PublicRow<"realm">[],
): RealmLookupRow[] {
  return realms.map((r) => ({
    id: r.id,
    name: r.name ?? String(r.id),
    replace: r.replace,
  }));
}

function realmDisplayName(
  realmsById: ReadonlyMap<number, PublicRow<"realm">>,
  realmId: number,
): Realm | null {
  const name = realmsById.get(realmId)?.name?.trim();
  return (name as Realm | undefined) ?? null;
}

function mapLocalInteraction(
  row: PublicRow<"awakener_local_manifestation_interaction">,
  tagsById: Readonly<Record<number, Tag>>,
): AwakenerLocalManifestationInteraction {
  const modifier = row.modifier_tag_id != null ? tagsById[row.modifier_tag_id] : null;
  const target = row.target_tag_id != null ? tagsById[row.target_tag_id] : null;
  return {
    id: row.id,
    mode: row.mode,
    modifierTagId: row.modifier_tag_id,
    modifierTagName: modifier?.tagName ?? "Unknown",
    targetTagId: row.target_tag_id,
    targetTagName: target?.tagName ?? null,
    layer: row.layer,
    mathOperation: row.math_operation,
    valueScalar: row.value_scalar,
    targetType: row.target_type,
    dependencyStat: row.dependency_stat,
    isDisabled: row.is_disabled === true,
  };
}

function mapDefaultInteraction(
  row: PublicRow<"tag_default_interaction">,
  tagsById: Readonly<Record<number, Tag>>,
): DefaultInteraction {
  const modifier =
    row.modifier_tag_id != null ? tagsById[row.modifier_tag_id] : null;
  const target = row.target_tag_id != null ? tagsById[row.target_tag_id] : null;
  const exclusion =
    row.exclusion_suffix != null ? tagsById[row.exclusion_suffix] : null;
  return {
    id: row.id,
    modifierTagId: row.modifier_tag_id,
    modifierTagName: modifier?.tagName ?? "Unknown",
    targetTagId: row.target_tag_id,
    targetTagName: target?.tagName ?? "Unknown",
    exclusionTagId: row.exclusion_suffix,
    exclusionTagName: exclusion?.tagName ?? null,
    mathOperation: row.math_operation,
    defaultFactor: row.default_factor,
    buffTargetTypeRestriction: row.buff_target_type_restriction,
    createsBase: row.creates_base ?? false,
    amplifiesSubject: row.amplifies_subject ?? true,
  };
}

function mapAtm(
  row: PublicRow<"awakener_tag_manifestation">,
  awakener: Awakener,
  tagsById: Readonly<Record<number, Tag>>,
  locals: AwakenerLocalManifestationInteraction[],
  realmsById: ReadonlyMap<number, PublicRow<"realm">>,
): Manifestation {
  const tag = tagsById[row.tag_id];
  const requiredRealmId = row.required_realm ?? null;
  return {
    id: row.id,
    sourceKind: "awakener",
    awakenerId: row.awakener_id,
    slotIndex: 0,
    sourceName: awakener.name,
    tagId: tag?.id ?? row.tag_id,
    tagName: tag?.tagName ?? "Unknown",
    triggerCondition: row.trigger_condition ?? null,
    valueScalar: row.value_scalar,
    instanceCount: row.instance_count ?? 1,
    baseCopies: row.base_copies ?? 1,
    // Public allowlist has copy_provider_group_id but not member tables.
    copyProviderGroupId: row.copy_provider_group_id ?? null,
    copyProviderGroupName: null,
    copyProviderTagIds: [],
    dependencyStat: row.dependency_stat,
    sourceType: row.source_type,
    targetType: row.target_type,
    buffTargetTypeRestriction: row.buff_target_type_restriction,
    metadata: row.metadata,
    isAccumulating: row.is_accumulating,
    requiredEnlightenment: row.required_enlightenment,
    requiredAwakenerId: null,
    requiredAwakenerName: null,
    requiredRealm:
      requiredRealmId != null
        ? realmDisplayName(realmsById, requiredRealmId)
        : null,
    requiredRealm2: null,
    requiredRealmId,
    requiredRealmId2: null,
    replacesManifestationId: row.replaces_manifestation_id,
    interactionOverrides: locals,
    isBaseStatTransfer: false,
    isCreatedBase: false,
    ...NON_REALM_MANIFESTATION_FIELDS,
  };
}

function mapRtm(
  row: PublicRow<"realm_tag_manifestation">,
  tagsById: Readonly<Record<number, Tag>>,
  realmsById: ReadonlyMap<number, PublicRow<"realm">>,
): Manifestation {
  const tag = row.tag_id != null ? tagsById[row.tag_id] : undefined;
  const realm = realmsById.get(row.realm_id);
  return {
    id: row.id,
    sourceKind: "realm",
    awakenerId: null,
    slotIndex: null,
    sourceName: realm?.name ?? `#${row.realm_id}`,
    tagId: tag?.id ?? row.tag_id ?? 0,
    tagName: tag?.tagName ?? "Unknown",
    triggerCondition: row.trigger_condition ?? null,
    valueScalar: row.value_scalar,
    ...DEFAULT_COPY_INSTANCE_FIELDS,
    dependencyStat: row.dependency_stat,
    sourceType: null,
    targetType: null,
    buffTargetTypeRestriction: null,
    metadata: row.metadata,
    isAccumulating: row.is_accumulating,
    requiredEnlightenment: null,
    requiredAwakenerId: null,
    requiredAwakenerName: null,
    requiredRealm: (realm?.name as Realm | undefined) ?? null,
    requiredRealm2: null,
    requiredRealmId: null,
    requiredRealmId2: null,
    replacesManifestationId: null,
    interactionOverrides: [],
    isBaseStatTransfer: false,
    isCreatedBase: false,
    realmId: row.realm_id,
    requiredRealmMode: row.required_realm_mode,
    dependencyRate: row.dependency_rate,
    dependencyRateStat: row.dependency_rate_stat,
    pureBonusTarget: row.pure_bonus_target,
  };
}

function toSoloAwakener(
  row: PublicRow<"awakener">,
  simulatedRealmId: number,
  realmsById: ReadonlyMap<number, PublicRow<"realm">>,
): Awakener {
  return {
    id: row.id,
    name: row.name,
    realm: realmDisplayName(realmsById, simulatedRealmId),
    realmId: simulatedRealmId,
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

function buildSoloTeamData(
  awakenerRow: PublicRow<"awakener">,
  simulatedRealmId: number,
  enlightenment: number,
  catalog: SoloAwakenerCatalog,
): TeamData {
  const tagsById = buildTagsById(catalog.tags);
  const realms = realmLookupRows(catalog.realms);
  const realmsById = new Map(catalog.realms.map((r) => [r.id, r]));
  const awakener = toSoloAwakener(awakenerRow, simulatedRealmId, realmsById);

  const localsByAtmId = new Map<number, AwakenerLocalManifestationInteraction[]>();
  for (const local of catalog.awakenerLocalInteractions) {
    if (local.manifestation_id == null) continue;
    const mapped = mapLocalInteraction(local, tagsById);
    const list = localsByAtmId.get(local.manifestation_id);
    if (list) list.push(mapped);
    else localsByAtmId.set(local.manifestation_id, [mapped]);
  }

  const enlightenmentGated = catalog.awakenerManifestations.filter(
    (m) =>
      m.awakener_id === awakenerRow.id &&
      (m.required_enlightenment ?? 0) <= enlightenment,
  );
  const resolvedAtms = applyManifestationReplacements(
    enlightenmentGated.map((row) => ({
      ...row,
      replacesManifestationId: row.replaces_manifestation_id,
    })),
  );

  const manifestations: Manifestation[] = [];
  for (const atm of resolvedAtms) {
    manifestations.push(
      mapAtm(
        atm,
        awakener,
        tagsById,
        localsByAtmId.get(atm.id) ?? [],
        realmsById,
      ),
    );
  }
  for (const rtm of catalog.realmManifestations) {
    manifestations.push(mapRtm(rtm, tagsById, realmsById));
  }

  const defaultInteractions = catalog.defaultInteractions.map((row) =>
    mapDefaultInteraction(row, tagsById),
  );

  const awakenerManifestationCount = manifestations.filter(
    (m) => m.sourceKind === "awakener",
  ).length;
  const realmManifestationCount = manifestations.filter(
    (m) => m.sourceKind === "realm",
  ).length;
  let overrideCount = 0;
  for (const m of manifestations) {
    overrideCount += m.interactionOverrides.length;
  }

  // Ensure required base-stat tag stubs exist if the public tag fetch missed them.
  for (const tagId of REQUIRED_BASE_STAT_TAG_IDS) {
    if (tagsById[tagId] == null) {
      tagsById[tagId] = {
        id: tagId,
        tagName: `Missing.Tag.${tagId}`,
        layer: null,
        isPercent: false,
        isAdditive: true,
      };
    }
  }

  return {
    awakeners: [awakener],
    manifestations,
    defaultInteractions,
    tagsById,
    realms,
    gearStatContributions: [],
    summary: {
      awakenerCount: 1,
      manifestationCount: manifestations.length,
      overrideCount,
      defaultInteractionCount: defaultInteractions.length,
      tagCount: Object.keys(tagsById).length,
      posseManifestationCount: 0,
      wheelManifestationCount: 0,
      covenantManifestationCount: 0,
      awakenerManifestationCount,
      realmManifestationCount,
    },
  };
}

/**
 * Solo-kit totals for one awakener in one realm. Uses `cache` when provided.
 */
export function computeSoloAwakenerTotals(
  awakenerRow: PublicRow<"awakener">,
  simulatedRealmId: number,
  enlightenment: number,
  catalog: SoloAwakenerCatalog,
  cache?: SoloTotalsCache,
): SoloAwakenerTotalsResult {
  const key = cacheKey(awakenerRow.id, simulatedRealmId, enlightenment);
  if (cache?.has(key)) {
    return cache.get(key)!;
  }

  const teamData = buildSoloTeamData(
    awakenerRow,
    simulatedRealmId,
    enlightenment,
    catalog,
  );
  const applyContext = createManifestationApplyContext(
    teamData.awakeners,
    [awakenerRow.id],
    new Map(),
    teamData.realms,
    teamData.manifestations,
  );
  const hasAppliedRealmManifestation = hasAppliedCatalogRealmManifestation(
    teamData.manifestations,
    applyContext,
  );
  const { totalsByTagId } = computeReviewTagTotals(teamData, applyContext);
  const result: SoloAwakenerTotalsResult = {
    totalsByTagId,
    hasAppliedRealmManifestation,
  };
  cache?.set(key, result);
  return result;
}

/** True when Search should run solo sims (Attacker/Defender tag filter or no tag filter). */
export function shouldRunSoloAwakenerTotals(
  matchingTagIds: Set<number> | null,
  tagsById: ReadonlyMap<number, PublicRow<"tag">>,
): boolean {
  if (matchingTagIds == null) return true;
  for (const id of matchingTagIds) {
    const name = tagsById.get(id)?.tag_name;
    if (name != null && isAttackerOrDefenderTagName(name)) return true;
  }
  return false;
}

function atmAppliesInRealmSim(
  m: PublicRow<"awakener_tag_manifestation">,
  realmSim: number,
  enlightenment: number,
): boolean {
  if ((m.required_enlightenment ?? 0) > enlightenment) return false;
  if (m.required_realm != null && m.required_realm !== realmSim) return false;
  return true;
}

function joinUnique(values: Iterable<string>, separator: string): string | null {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const raw of values) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    parts.push(trimmed);
  }
  if (parts.length === 0) return null;
  return parts.join(separator);
}

/** Unique raw target_type enums in DB enum order (self → single → aoe). */
function joinUniqueTargetTypes(
  values: Iterable<string>,
  formatTargetType: (targetType: string) => string,
): string | null {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of values) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
  }
  if (unique.length === 0) return null;
  unique.sort((a, b) => {
    const ai = TARGET_TYPE_ORDER.get(a as (typeof ENUM_VALUES.target_type)[number]);
    const bi = TARGET_TYPE_ORDER.get(b as (typeof ENUM_VALUES.target_type)[number]);
    if (ai == null && bi == null) return a.localeCompare(b);
    if (ai == null) return 1;
    if (bi == null) return -1;
    return ai - bi;
  });
  return unique.map(formatTargetType).join(" + ");
}

export type SoloTagDisplayFields = {
  /** Formatted unique target types joined with ` + `, or null when none. */
  targetType: string | null;
  /** Unique trimmed metadata joined with ` +\\n`, or null when none. */
  metadata: string | null;
};

/**
 * Aggregate Target Type + Metadata for a solo Search tag row from catalog ATMs
 * (direct tag, aftereffects into that tag, and creates_base invent modifiers)
 * that pass enlightenment + realm gates. Realm contributions stay as
 * {@link REALM_GIMMICK_METADATA} only.
 */
export function collectSoloTagDisplayFields(input: {
  awakenerId: number;
  tagId: number;
  realmSim: number;
  enlightenment: number;
  awakenerManifestations: readonly PublicRow<"awakener_tag_manifestation">[];
  awakenerLocalInteractions: readonly PublicRow<"awakener_local_manifestation_interaction">[];
  defaultInteractions?: readonly PublicRow<"tag_default_interaction">[];
  formatTargetType: (targetType: string) => string;
  hasAppliedRealmManifestation?: boolean;
}): SoloTagDisplayFields {
  const {
    awakenerId,
    tagId,
    realmSim,
    enlightenment,
    formatTargetType,
    hasAppliedRealmManifestation = false,
  } = input;
  const defaultInteractions = input.defaultInteractions ?? [];

  const enlightenmentGated = input.awakenerManifestations.filter(
    (m) =>
      m.awakener_id === awakenerId &&
      (m.required_enlightenment ?? 0) <= enlightenment,
  );
  const resolved = applyManifestationReplacements(
    enlightenmentGated.map((row) => ({
      ...row,
      replacesManifestationId: row.replaces_manifestation_id,
    })),
  );
  const resolvedById = new Map(resolved.map((m) => [m.id, m]));

  const targetTypes: string[] = [];
  const metadatas: string[] = [];

  for (const m of resolved) {
    if (!atmAppliesInRealmSim(m, realmSim, enlightenment)) continue;
    if (m.tag_id !== tagId) continue;
    if (m.target_type != null) {
      targetTypes.push(m.target_type);
    }
    if (m.metadata != null) metadatas.push(m.metadata);
  }

  for (const local of input.awakenerLocalInteractions) {
    if (
      local.mode !== "aftereffect" ||
      local.is_disabled ||
      local.target_tag_id !== tagId ||
      local.manifestation_id == null
    ) {
      continue;
    }
    const m = resolvedById.get(local.manifestation_id);
    if (!m || !atmAppliesInRealmSim(m, realmSim, enlightenment)) continue;
    targetTypes.push(local.target_type);
    if (m.metadata != null) metadatas.push(m.metadata);
  }

  // Catalog invent edges (creates_base && !amplifies_subject): exact target only.
  const inventModifierTagIds = new Set<number>();
  for (const d of defaultInteractions) {
    if (
      d.creates_base === true &&
      d.amplifies_subject === false &&
      d.target_tag_id === tagId &&
      d.modifier_tag_id != null
    ) {
      inventModifierTagIds.add(d.modifier_tag_id);
    }
  }
  for (const m of resolved) {
    if (!atmAppliesInRealmSim(m, realmSim, enlightenment)) continue;
    if (!inventModifierTagIds.has(m.tag_id)) continue;
    if (m.metadata != null) metadatas.push(m.metadata);
  }

  if (hasAppliedRealmManifestation) {
    metadatas.push(REALM_GIMMICK_METADATA);
  }

  return {
    targetType: joinUniqueTargetTypes(targetTypes, formatTargetType),
    metadata: joinUnique(metadatas, " +\n"),
  };
}
