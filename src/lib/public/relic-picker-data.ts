/**
 * Public (anon / allowlisted) Path Carver TeamData builder for the Relic Picker.
 *
 * Mirrors `src/lib/team-data/load-team-data.ts` but only reads columns exposed
 * by the public read allowlist and expects the raw `PublicRow` arrays to be
 * fetched via `fetchAllPublicTable`.
 */
import { indexCopyProviderMembersByGroupId } from "@/lib/path-carver/copy-instances";
import { REQUIRED_BASE_STAT_TAG_IDS } from "@/lib/path-carver/awakener-base-stats";
import type {
  RelicBaseFormula,
  RelicArgKind,
} from "@/lib/path-carver/relic-research-curve";
import {
  groupRelicManifestations,
  type RelicCatalogEntry,
  type RelicRtmRow,
} from "@/lib/path-carver/relic-manifestations";
import type { PublicRow } from "@/lib/public-read/allowlist";
import { applyManifestationReplacements, effectiveEnlightenment } from "@/lib/team-data/resolve-manifestations";
import {
  DEFAULT_COPY_INSTANCE_FIELDS,
  NON_REALM_MANIFESTATION_FIELDS,
  type AllStats,
  type Awakener,
  type AwakenerLocalManifestationInteraction,
  type DefaultInteraction,
  type GearStatContribution,
  type Manifestation,
  type ManifestationSourceKind,
  type OperationType,
  type Realm,
  type RealmLookupRow,
  type RealmMatchMode,
  type SourceType,
  type Tag,
  type TargetType,
  type TeamData,
} from "@/lib/team-data/types";
import type {
  CovenantGearOption,
  GearOption,
  SimulatorGearOptions,
  SlotState,
  WheelGearOption,
} from "@/lib/simulator/types";

export type PublicAwakenerOption = {
  value: number;
  label: string;
  realm: Realm | null;
  realmId: number | null;
  realmFamilyId: number | null;
};

export type PublicTeamCatalog = {
  awakeners: readonly PublicRow<"awakener">[];
  awakenersManifestations: readonly PublicRow<"awakener_tag_manifestation">[];
  awakenersLocalInteractions: readonly PublicRow<"awakener_local_manifestation_interaction">[];
  wheels: readonly PublicRow<"wheel">[];
  wheelManifestations: readonly PublicRow<"wheel_tag_manifestation">[];
  covenants: readonly PublicRow<"covenant">[];
  covenantManifestations: readonly PublicRow<"covenant_tag_manifestation">[];
  covenantStatSets: readonly PublicRow<"covenant_stat_set">[];
  posses: readonly PublicRow<"posse">[];
  posseManifestations: readonly PublicRow<"posse_tag_manifestation">[];
  realms: readonly PublicRow<"realm">[];
  realmManifestations: readonly PublicRow<"realm_tag_manifestation">[];
  tags: readonly PublicRow<"tag">[];
  defaultInteractions: readonly PublicRow<"tag_default_interaction">[];
  copyProviderMembers: readonly PublicRow<"copy_provider_group_member">[];
  relics: readonly PublicRow<"relic">[];
  relicManifestations: readonly PublicRow<"relic_tag_manifestation">[];
};

export type PublicTeamSelection = {
  slots: SlotState[];
  posseId: number | null;
};

function toTag(row: PublicRow<"tag">): Tag {
  return {
    id: row.id,
    tagName: row.tag_name,
    layer: row.layer,
    isPercent: row.is_percent === true,
    isAdditive: row.is_additive !== false,
  };
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
  realmId: number | null,
): Realm | null {
  if (realmId == null) return null;
  const name = realmsById.get(realmId)?.name?.trim();
  return (name as Realm | undefined) ?? null;
}

function mapLocalInteraction(
  row: PublicRow<"awakener_local_manifestation_interaction">,
  tagsById: Readonly<Record<number, Tag>>,
): AwakenerLocalManifestationInteraction {
  const modifier =
    row.modifier_tag_id != null ? tagsById[row.modifier_tag_id] : null;
  const target = row.target_tag_id != null ? tagsById[row.target_tag_id] : null;
  return {
    id: row.id,
    mode: row.mode,
    modifierTagId: row.modifier_tag_id,
    modifierTagName: modifier?.tagName ?? "Unknown",
    targetTagId: row.target_tag_id,
    targetTagName: target?.tagName ?? null,
    layer: row.layer,
    mathOperation: row.math_operation as OperationType | null,
    valueScalar: row.value_scalar,
    targetType: row.target_type as TargetType,
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
  membersByGroupId: ReadonlyMap<number, number[]>,
): Manifestation {
  const tag = tagsById[row.tag_id];
  const requiredRealmId = row.required_realm ?? null;
  const copyProviderGroupId = row.copy_provider_group_id ?? null;
  return {
    id: row.id,
    sourceKind: "awakener",
    awakenerId: row.awakener_id,
    slotIndex: null,
    sourceName: awakener.name,
    tagId: tag?.id ?? row.tag_id,
    tagName: tag?.tagName ?? "Unknown",
    triggerCondition: row.trigger_condition ?? null,
    valueScalar: row.value_scalar,
    instanceCount: row.instance_count ?? 1,
    baseCopies: row.base_copies ?? 1,
    copyProviderGroupId,
    copyProviderGroupName:
      copyProviderGroupId != null ? `#${copyProviderGroupId}` : null,
    copyProviderTagIds:
      copyProviderGroupId != null
        ? (membersByGroupId.get(copyProviderGroupId) ?? [])
        : [],
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

function mapGearManifestation(
  row: {
    id: number;
    tag_id: number | null;
    trigger_condition?: number | null;
    value_scalar: number | null;
    target_type: TargetType | null;
    is_accumulating: boolean;
    dependency_stat?: AllStats | null;
    buff_target_type_restriction?: SourceType | null;
    metadata?: string | null;
    replaces_manifestation_id?: number | null;
    required_awakener?: number | null;
    required_realm?: number | null;
    required_realm1?: number | null;
    required_realm2?: number | null;
  },
  sourceKind: ManifestationSourceKind,
  slotIndex: number | null,
  awakenerId: number | null,
  sourceName: string | null,
  tagsById: Readonly<Record<number, Tag>>,
  realmsById: ReadonlyMap<number, PublicRow<"realm">>,
): Manifestation {
  const tag = row.tag_id != null ? tagsById[row.tag_id] : undefined;
  const requiredRealmId = row.required_realm1 ?? row.required_realm ?? null;
  const requiredRealmId2 = row.required_realm2 ?? null;
  const requiredAwakenerId = row.required_awakener ?? null;
  return {
    id: row.id,
    sourceKind,
    awakenerId,
    slotIndex,
    sourceName,
    tagId: tag?.id ?? row.tag_id ?? 0,
    tagName: tag?.tagName ?? "Unknown",
    triggerCondition: row.trigger_condition ?? null,
    valueScalar: row.value_scalar,
    ...DEFAULT_COPY_INSTANCE_FIELDS,
    dependencyStat: row.dependency_stat ?? null,
    sourceType: null,
    targetType: row.target_type,
    buffTargetTypeRestriction: row.buff_target_type_restriction ?? null,
    metadata: row.metadata ?? null,
    isAccumulating: row.is_accumulating,
    requiredEnlightenment: null,
    requiredAwakenerId,
    requiredAwakenerName:
      requiredAwakenerId != null ? `#${requiredAwakenerId}` : null,
    requiredRealm: realmDisplayName(realmsById, requiredRealmId),
    requiredRealm2: realmDisplayName(realmsById, requiredRealmId2),
    requiredRealmId,
    requiredRealmId2,
    replacesManifestationId: row.replaces_manifestation_id ?? null,
    interactionOverrides: [],
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
    requiredRealmMode: row.required_realm_mode as RealmMatchMode,
    dependencyRate: row.dependency_rate,
    dependencyRateStat: row.dependency_rate_stat,
    pureBonusTarget: row.pure_bonus_target,
  };
}

/**
 * Build a team `TeamData` (no relic rows) for the Relic Picker. Relic
 * manifestations are injected later by `computeRelicRanking`.
 */
export function buildPublicTeamData(
  selection: PublicTeamSelection,
  catalog: PublicTeamCatalog,
): TeamData {
  const tagsById: Record<number, Tag> = {};
  for (const row of catalog.tags) tagsById[row.id] = toTag(row);

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

  const realmsById = new Map(catalog.realms.map((r) => [r.id, r]));
  const realms = realmLookupRows(catalog.realms);
  const membersByGroupId = indexCopyProviderMembersByGroupId(
    catalog.copyProviderMembers,
  );

  const awakenersById = new Map(
    catalog.awakeners.map((row) => [row.id, row]),
  );

  const selectedAwakenerIds = new Set<number>();
  const enlightenmentByAwakenerId = new Map<number, number>();
  for (const slot of selection.slots) {
    if (slot.awakenerId == null) continue;
    selectedAwakenerIds.add(slot.awakenerId);
    enlightenmentByAwakenerId.set(
      slot.awakenerId,
      effectiveEnlightenment(slot.awakenerEnlightenment),
    );
  }

  const awakeners: Awakener[] = [...selectedAwakenerIds]
    .map((id) => awakenersById.get(id))
    .filter((row): row is PublicRow<"awakener"> => row != null)
    .map((row) => ({
      id: row.id,
      name: row.name,
      realm: realmDisplayName(realmsById, row.realm),
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
      enlightenment: enlightenmentByAwakenerId.get(row.id) ?? 0,
    }));

  const localsByAtmId = new Map<
    number,
    AwakenerLocalManifestationInteraction[]
  >();
  for (const local of catalog.awakenersLocalInteractions) {
    if (local.manifestation_id == null) continue;
    const mapped = mapLocalInteraction(local, tagsById);
    const list = localsByAtmId.get(local.manifestation_id);
    if (list) list.push(mapped);
    else localsByAtmId.set(local.manifestation_id, [mapped]);
  }

  const manifestations: Manifestation[] = [];
  const gearStatContributions: GearStatContribution[] = [];

  const pushGear = (
    awakenerId: number | null,
    sourceKind: GearStatContribution["sourceKind"],
    entity:
      | { stat: AllStats | null; stat_amount: number | null }
      | undefined,
    entityId: number,
  ) => {
    if (awakenerId == null || !entity) return;
    gearStatContributions.push({
      awakenerId,
      sourceKind,
      entityId,
      stat: entity.stat,
      statAmount: entity.stat_amount,
    });
  };

  const wheelsById = new Map(catalog.wheels.map((w) => [w.id, w]));
  const covenantsById = new Map(catalog.covenants.map((c) => [c.id, c]));
  const covenantStatSetsById = new Map(
    catalog.covenantStatSets.map((s) => [s.id, s]),
  );
  const wheelManifestationsByWheelId = groupBy(
    catalog.wheelManifestations,
    (row) => row.wheel_id,
  );
  const covenantManifestationsByCovenantId = groupBy(
    catalog.covenantManifestations,
    (row) => row.covenant_id,
  );

  for (const [slotIndex, slot] of selection.slots.entries()) {
    for (const wheelId of [slot.wheel1Id, slot.wheel2Id]) {
      if (wheelId == null) continue;
      const wheel = wheelsById.get(wheelId);
      pushGear(slot.awakenerId, "wheel", wheel, wheelId);
      for (const row of wheelManifestationsByWheelId.get(wheelId) ?? []) {
        manifestations.push(
          mapGearManifestation(
            row,
            "wheel",
            slotIndex,
            slot.awakenerId,
            wheel?.name ?? `#${wheelId}`,
            tagsById,
            realmsById,
          ),
        );
      }
    }

    if (slot.covenantId != null) {
      const covenant = covenantsById.get(slot.covenantId);
      pushGear(slot.awakenerId, "covenant", covenant, slot.covenantId);
      const rows = applyManifestationReplacements(
        (covenantManifestationsByCovenantId.get(slot.covenantId) ?? []).map(
          (row) => ({
            ...row,
            replacesManifestationId: row.replaces_manifestation_id,
          }),
        ),
      );
      for (const row of rows) {
        manifestations.push(
          mapGearManifestation(
            row,
            "covenant",
            slotIndex,
            slot.awakenerId,
            covenant?.name ?? `#${slot.covenantId}`,
            tagsById,
            realmsById,
          ),
        );
      }
    }

    if (slot.covenantStatSetId != null) {
      pushGear(
        slot.awakenerId,
        "covenant_stat_set",
        covenantStatSetsById.get(slot.covenantStatSetId),
        slot.covenantStatSetId,
      );
    }
  }

  // Awakener ATMs (enlightenment-gated) with local interactions.
  const atmsByAwakenerId = groupBy(
    catalog.awakenersManifestations,
    (row) => row.awakener_id,
  );
  for (const awakener of awakeners) {
    const gated = (atmsByAwakenerId.get(awakener.id) ?? []).filter(
      (row) =>
        (row.required_enlightenment ?? 0) <=
        effectiveEnlightenment(awakener.enlightenment),
    );
    const resolved = applyManifestationReplacements(
      gated.map((row) => ({
        ...row,
        replacesManifestationId: row.replaces_manifestation_id,
      })),
    );
    for (const row of resolved) {
      manifestations.push(
        mapAtm(
          row,
          awakener,
          tagsById,
          localsByAtmId.get(row.id) ?? [],
          realmsById,
          membersByGroupId,
        ),
      );
    }
  }

  // Posse manifestations (team-wide).
  if (selection.posseId != null) {
    const posse = catalog.posses.find((p) => p.id === selection.posseId);
    for (const row of catalog.posseManifestations.filter(
      (m) => m.posse_id === selection.posseId,
    )) {
      manifestations.push(
        mapGearManifestation(
          row,
          "posse",
          null,
          null,
          posse?.name ?? `#${selection.posseId}`,
          tagsById,
          realmsById,
        ),
      );
    }
  }

  // Realm RTMs (all realms; applied filtering happens in the engine).
  for (const row of catalog.realmManifestations) {
    manifestations.push(mapRtm(row, tagsById, realmsById));
  }

  const defaultInteractions = catalog.defaultInteractions.map((row) =>
    mapDefaultInteraction(row, tagsById),
  );

  const partial = {
    awakeners,
    manifestations,
    defaultInteractions,
    tagsById,
    realms,
    gearStatContributions,
  };

  return {
    ...partial,
    summary: {
      awakenerCount: awakeners.length,
      manifestationCount: manifestations.length,
      overrideCount: manifestations.reduce(
        (n, m) => n + m.interactionOverrides.length,
        0,
      ),
      defaultInteractionCount: defaultInteractions.length,
      tagCount: Object.keys(tagsById).length,
      posseManifestationCount: countBySourceKind(manifestations, "posse"),
      wheelManifestationCount: countBySourceKind(manifestations, "wheel"),
      covenantManifestationCount: countBySourceKind(manifestations, "covenant"),
      awakenerManifestationCount: countBySourceKind(manifestations, "awakener"),
      realmManifestationCount: countBySourceKind(manifestations, "realm"),
    },
  };
}

function countBySourceKind(
  manifestations: readonly Manifestation[],
  kind: ManifestationSourceKind,
): number {
  return manifestations.filter((m) => m.sourceKind === kind).length;
}

function groupBy<T, K>(
  rows: readonly T[],
  keyOf: (row: T) => K,
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return map;
}

/** Awakener options for `BuildStep` / `AwakenerSlotRow`. */
export function buildPublicAwakenerOptions(input: {
  awakeners: readonly PublicRow<"awakener">[];
  realms: readonly PublicRow<"realm">[];
}): PublicAwakenerOption[] {
  const replaceOf = new Map(input.realms.map((r) => [r.id, r.replace]));
  const realmsById = new Map(input.realms.map((r) => [r.id, r]));
  return input.awakeners.map((row) => ({
    value: row.id,
    label: row.name ?? `#${row.id}`,
    realm: realmDisplayName(realmsById, row.realm),
    realmId: row.realm,
    realmFamilyId:
      row.realm == null ? null : (replaceOf.get(row.realm) ?? row.realm),
  }));
}

/** Gear options for `BuildStep` / `AwakenerSlotRow`. */
export function buildPublicGearOptions(input: {
  posses: readonly PublicRow<"posse">[];
  wheels: readonly PublicRow<"wheel">[];
  covenants: readonly PublicRow<"covenant">[];
  covenantStatSets: readonly PublicRow<"covenant_stat_set">[];
}): SimulatorGearOptions {
  const posse: GearOption[] = input.posses.map((p) => ({
    value: p.id,
    label: p.name ?? `#${p.id}`,
  }));
  const wheel: WheelGearOption[] = input.wheels.map((w) => ({
    value: w.id,
    label: w.name ?? `#${w.id}`,
    rarity: w.rarity as WheelGearOption["rarity"],
    enlightenment: effectiveEnlightenment(w.enlightenment),
  }));
  const covenant: CovenantGearOption[] = input.covenants.map((c) => ({
    value: c.id,
    label: c.name ?? `#${c.id}`,
    teamUnique: Boolean(c.team_unique),
  }));
  const covenantStatSet: GearOption[] = input.covenantStatSets.map((row) => ({
    value: row.id,
    label: `${row.stat ?? "?"} ${row.stat_amount ?? 0}`,
    assetName: row.stat ?? undefined,
    shortLabel: String(row.stat_amount ?? 0),
  }));
  return { posse, wheel, covenant, covenantStatSet };
}

/** Full relic catalog (damage + realm metadata + rows) for ranking. */
export function buildPublicRelicCatalog(
  catalog: PublicTeamCatalog,
): RelicCatalogEntry[] {
  const entries = catalog.relics.map((row) => ({
    relicId: row.id,
    name: row.name ?? `#${row.id}`,
    tier: row.tier,
    requiredRealmId: row.required_realm,
    isDamage: row.is_damage === true,
  }));

  const tagNamesById = new Map(catalog.tags.map((t) => [t.id, t.tag_name]));
  const rows: (RelicRtmRow & { relicId: number })[] =
    catalog.relicManifestations.map((row) => ({
      relicId: row.relic_id,
      id: row.id,
      tagId: row.tag_id,
      tagName: tagNamesById.get(row.tag_id) ?? "Unknown",
      triggerCondition: row.trigger_condition,
      valueScalar: row.value_scalar,
      kind: row.kind as RelicArgKind,
      baseFormula: row.base_formula as RelicBaseFormula | null,
      targetType: row.target_type,
      dependencyStat: row.dependency_stat,
      isAccumulating: row.is_accumulating,
    }));

  return groupRelicManifestations(entries, rows);
}
