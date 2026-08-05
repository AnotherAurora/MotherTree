import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { REQUIRED_BASE_STAT_TAG_IDS } from "@/lib/path-carver/awakener-base-stats";
import {
  applyManifestationReplacements,
  effectiveEnlightenment,
} from "@/lib/team-data/resolve-manifestations";
import {
  createEmptyTeamData,
  type AllStats,
  type Awakener,
  type DefaultInteraction,
  type GearStatContribution,
  type AwakenerLocalManifestationInteraction,
  type Manifestation,
  type Layer,
  type PureBonusTarget,
  type Realm,
  type RealmLookupRow,
  type RealmMatchMode,
  type Tag,
  type TeamData,
  type TeamDataInput,
  type TeamDataSlotInput,
  NON_REALM_MANIFESTATION_FIELDS,
  DEFAULT_COPY_INSTANCE_FIELDS,
} from "@/lib/team-data/types";

type TagRef = {
  id: number;
  tag_name: string | null;
  layer: Layer | null;
  is_percent?: boolean | null;
  is_additive?: boolean | null;
} | null;

function parseTagRef(tag: TagRef): Tag | null {
  if (!tag?.id) return null;
  return {
    id: tag.id,
    tagName: tag.tag_name ?? `#${tag.id}`,
    layer: tag.layer ?? null,
    isPercent: tag.is_percent === true,
    isAdditive: tag.is_additive !== false,
  };
}

function collectTags(
  tagsById: Record<number, Tag>,
  ...refs: Array<Tag | null>
) {
  for (const ref of refs) {
    if (ref) tagsById[ref.id] = ref;
  }
}

function countBySourceKind(
  manifestations: Manifestation[],
  kind: Manifestation["sourceKind"],
): number {
  return manifestations.filter((m) => m.sourceKind === kind).length;
}

function buildSummary(context: Omit<TeamData, "summary">): TeamData["summary"] {
  return {
    awakenerCount: context.awakeners.length,
    manifestationCount: context.manifestations.length,
    overrideCount: context.manifestations.reduce(
      (n, m) => n + m.interactionOverrides.length,
      0,
    ),
    defaultInteractionCount: context.defaultInteractions.length,
    tagCount: Object.keys(context.tagsById).length,
    posseManifestationCount: countBySourceKind(
      context.manifestations,
      "posse",
    ),
    wheelManifestationCount: countBySourceKind(context.manifestations, "wheel"),
    covenantManifestationCount: countBySourceKind(
      context.manifestations,
      "covenant",
    ),
    awakenerManifestationCount: countBySourceKind(
      context.manifestations,
      "awakener",
    ),
    realmManifestationCount: countBySourceKind(
      context.manifestations,
      "realm",
    ),
  };
}

function uniqueAwakenerIds(input: TeamDataInput): number[] {
  const ids = new Set<number>();
  for (const slot of input.slots) {
    if (slot.awakenerId != null) ids.add(slot.awakenerId);
  }
  return [...ids];
}

type RealmRef = { name: string } | null;

function realmName(ref: RealmRef | undefined): Realm | null {
  return (ref?.name as Realm | undefined) ?? null;
}

const AWAKENER_MANIFESTATION_SELECT = `
  id,
  awakener_id,
  tag_id,
  trigger_condition,
  value_scalar,
  instance_count,
  base_copies,
  copy_provider_group_id,
  dependency_stat,
  source_type,
  target_type,
  buff_target_type_restriction,
  metadata,
  is_accumulating,
  required_enlightenment,
  required_realm,
  required_realm_ref:realm!required_realm(name),
  replaces_manifestation_id,
  tag!tag_id(id, tag_name, layer, is_percent, is_additive),
  copy_provider_group:copy_provider_group_id(id, name)
`;

async function fetchAwakenerManifestations(
  supabase: SupabaseClient<Database>,
  awakenerId: number,
  enlightenment: number | null,
) {
  const { data, error } = await supabase
    .from("awakener_tag_manifestation")
    .select(AWAKENER_MANIFESTATION_SELECT)
    .eq("awakener_id", awakenerId)
    .lte("required_enlightenment", effectiveEnlightenment(enlightenment))
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
  return data ?? [];
}

const GEAR_MANIFESTATION_SELECT = `
  id,
  tag_id,
  trigger_condition,
  value_scalar,
  target_type,
  buff_target_type_restriction,
  metadata,
  is_accumulating,
  required_realm,
  required_realm_ref:realm!required_realm(name),
  tag!tag_id(id, tag_name, layer, is_percent, is_additive)
`;

const POSSE_MANIFESTATION_SELECT = `
  id,
  tag_id,
  value_scalar,
  target_type,
  buff_target_type_restriction,
  metadata,
  is_accumulating,
  required_realm,
  required_realm_ref:realm!required_realm(name),
  required_awakener,
  dependency_stat,
  required_awakener_ref:awakener!required_awakener(id, name),
  tag!tag_id(id, tag_name, layer, is_percent, is_additive)
`;

const COVENANT_MANIFESTATION_SELECT = `
  id,
  tag_id,
  trigger_condition,
  value_scalar,
  target_type,
  buff_target_type_restriction,
  metadata,
  dependency_stat,
  is_accumulating,
  required_realm1,
  required_realm2,
  required_realm1_ref:realm!required_realm1(name),
  required_realm2_ref:realm!required_realm2(name),
  replaces_manifestation_id,
  tag!tag_id(id, tag_name, layer, is_percent, is_additive)
`;

async function fetchWheelManifestations(
  supabase: SupabaseClient<Database>,
  wheelId: number,
  _slotRealm: Realm | null,
) {
  const { data, error } = await supabase
    .from("wheel_tag_manifestation")
    .select(`${GEAR_MANIFESTATION_SELECT}, dependency_stat`)
    .eq("wheel_id", wheelId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  // Realm gating is soft-filtered later via isManifestationApplied so
  // debug can show gated gear tags as Applied: no (incl. replacer→base).
  return data ?? [];
}

async function fetchCovenantManifestations(
  supabase: SupabaseClient<Database>,
  covenantId: number,
  _slotRealm: Realm | null,
) {
  const { data, error } = await supabase
    .from("covenant_tag_manifestation")
    .select(COVENANT_MANIFESTATION_SELECT)
    .eq("covenant_id", covenantId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  return data ?? [];
}

async function fetchPosseManifestations(
  supabase: SupabaseClient<Database>,
  posseId: number,
  _realms: Realm[],
) {
  const { data, error } = await supabase
    .from("posse_tag_manifestation")
    .select(POSSE_MANIFESTATION_SELECT)
    .eq("posse_id", posseId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  // required_awakener / required_realm are soft-filtered later via
  // isManifestationApplied so debug can show gated posse tags as Applied: no.
  return data ?? [];
}

function mapGearManifestation(
  row: {
    id: number;
    tag_id: number | null;
    trigger_condition?: number | null;
    value_scalar: number | null;
    target_type: Manifestation["targetType"];
    is_accumulating: boolean;
    requiredRealm: Realm | null;
    requiredRealm2?: Realm | null;
    requiredRealmId?: number | null;
    requiredRealmId2?: number | null;
    replaces_manifestation_id?: number | null;
    required_awakener?: number | null;
    required_awakener_ref?: { id: number; name: string | null } | null;
    tag: TagRef;
    instance_count?: number | null;
    base_copies?: number | null;
    dependency_stat?: Manifestation["dependencyStat"];
    source_type?: Manifestation["sourceType"];
    buff_target_type_restriction?: Manifestation["buffTargetTypeRestriction"];
    metadata?: string | null;
  },
  sourceKind: Manifestation["sourceKind"],
  slotIndex: number | null,
  awakenerId: number | null,
  sourceName: string | null,
): Manifestation {
  const tag = parseTagRef(row.tag as TagRef);
  const requiredAwakenerId = row.required_awakener ?? null;
  const requiredAwakenerName =
    row.required_awakener_ref?.name ??
    (requiredAwakenerId != null ? `#${requiredAwakenerId}` : null);
  return {
    id: row.id,
    sourceKind,
    awakenerId,
    slotIndex,
    sourceName,
    tagId: tag?.id ?? row.tag_id ?? 0,
    tagName: tag?.tagName ?? "Unknown",
    // Posse rows have no trigger_condition column → always null.
    triggerCondition: row.trigger_condition ?? null,
    valueScalar: row.value_scalar,
    ...DEFAULT_COPY_INSTANCE_FIELDS,
    dependencyStat: row.dependency_stat ?? null,
    sourceType: row.source_type ?? null,
    targetType: row.target_type,
    buffTargetTypeRestriction: row.buff_target_type_restriction ?? null,
    metadata: row.metadata ?? null,
    isAccumulating: row.is_accumulating,
    requiredEnlightenment: null,
    requiredAwakenerId,
    requiredAwakenerName,
    requiredRealm: row.requiredRealm,
    requiredRealm2: row.requiredRealm2 ?? null,
    requiredRealmId: row.requiredRealmId ?? null,
    requiredRealmId2: row.requiredRealmId2 ?? null,
    replacesManifestationId: row.replaces_manifestation_id ?? null,
    interactionOverrides: [],
    isBaseStatTransfer: false,
    isCreatedBase: false,
    ...NON_REALM_MANIFESTATION_FIELDS,
  };
}

type GearEntityRow = {
  id: number;
  name: string;
  stat: AllStats | null;
  statAmount: number | null;
};

async function fetchWheelGearById(
  supabase: SupabaseClient<Database>,
  ids: number[],
): Promise<Map<number, GearEntityRow>> {
  const map = new Map<number, GearEntityRow>();
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from("wheel")
    .select("id, name, stat, stat_amount")
    .in("id", ids)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    map.set(row.id, {
      id: row.id,
      name: row.name,
      stat: row.stat,
      statAmount: row.stat_amount,
    });
  }
  return map;
}

async function fetchCovenantGearById(
  supabase: SupabaseClient<Database>,
  ids: number[],
): Promise<Map<number, GearEntityRow>> {
  const map = new Map<number, GearEntityRow>();
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from("covenant")
    .select("id, name, stat, stat_amount")
    .in("id", ids)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    map.set(row.id, {
      id: row.id,
      name: row.name,
      stat: row.stat,
      statAmount: row.stat_amount,
    });
  }
  return map;
}

async function fetchCovenantStatSetById(
  supabase: SupabaseClient<Database>,
  ids: number[],
): Promise<Map<number, GearEntityRow>> {
  const map = new Map<number, GearEntityRow>();
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from("covenant_stat_set")
    .select("id, stat, stat_amount")
    .in("id", ids)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    map.set(row.id, {
      id: row.id,
      name: `${row.stat ?? "?"} ${row.stat_amount ?? 0}`,
      stat: row.stat,
      statAmount: row.stat_amount,
    });
  }
  return map;
}

async function fetchEntityNamesById(
  supabase: SupabaseClient<Database>,
  table: "posse",
  ids: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from(table)
    .select("id, name")
    .in("id", ids)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    map.set(row.id, row.name);
  }
  return map;
}

async function fetchRequiredBaseStatTags(
  supabase: SupabaseClient<Database>,
  tagsById: Record<number, Tag>,
): Promise<void> {
  const missing = REQUIRED_BASE_STAT_TAG_IDS.filter((id) => !tagsById[id]);
  if (missing.length === 0) return;

  const { data, error } = await supabase
    .from("tag")
    .select("id, tag_name, layer, is_percent, is_additive")
    .in("id", missing)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    collectTags(tagsById, {
      id: row.id,
      tagName: row.tag_name ?? `#${row.id}`,
      layer: row.layer ?? null,
      isPercent: row.is_percent === true,
      isAdditive: row.is_additive !== false,
    });
  }
}

function pushGearContribution(
  contributions: GearStatContribution[],
  awakenerId: number | null,
  sourceKind: "wheel" | "covenant" | "covenant_stat_set",
  entity: GearEntityRow | undefined,
  entityId: number,
): void {
  if (awakenerId == null || entity == null) return;
  contributions.push({
    awakenerId,
    sourceKind,
    entityId,
    stat: entity.stat,
    statAmount: entity.statAmount,
  });
}

async function loadOverridesForManifestations(
  supabase: SupabaseClient<Database>,
  manifestationIds: number[],
  tagsById: Record<number, Tag>,
): Promise<Map<number, AwakenerLocalManifestationInteraction[]>> {
  const overridesByManifestationId = new Map<
    number,
    AwakenerLocalManifestationInteraction[]
  >();
  if (manifestationIds.length === 0) return overridesByManifestationId;

  const overrideResult = await supabase
    .from("awakener_local_manifestation_interaction")
    .select(
      `
      id,
      manifestation_id,
      mode,
      modifier_tag_id,
      target_tag_id,
      layer,
      math_operation,
      value_scalar,
      target_type,
      dependency_stat,
      is_disabled,
      modifier_tag:tag!modifier_tag_id(id, tag_name, layer, is_percent, is_additive),
      target_tag:tag!target_tag_id(id, tag_name, layer, is_percent, is_additive)
    `,
    )
    .in("manifestation_id", manifestationIds)
    .is("deleted_at", null);

  if (overrideResult.error) {
    throw new Error(overrideResult.error.message);
  }

  for (const row of overrideResult.data ?? []) {
    const manifestationId = row.manifestation_id;
    if (manifestationId == null) continue;

    const modifierTag = parseTagRef(row.modifier_tag as TagRef);
    const targetTag = parseTagRef(row.target_tag as TagRef);
    if (modifierTag) collectTags(tagsById, modifierTag);
    if (targetTag) collectTags(tagsById, targetTag);

    const override: AwakenerLocalManifestationInteraction = {
      id: row.id,
      mode: row.mode,
      modifierTagId: row.modifier_tag_id,
      modifierTagName: modifierTag?.tagName ?? "Unknown",
      targetTagId: row.target_tag_id,
      targetTagName: targetTag?.tagName ?? null,
      layer: row.layer,
      mathOperation: row.math_operation,
      valueScalar: row.value_scalar,
      targetType: row.target_type,
      dependencyStat: row.dependency_stat,
      isDisabled: row.is_disabled === true,
    };

    const existing = overridesByManifestationId.get(manifestationId);
    if (existing) {
      existing.push(override);
    } else {
      overridesByManifestationId.set(manifestationId, [override]);
    }
  }

  return overridesByManifestationId;
}

async function loadCopyProviderMembersByGroupId(
  supabase: SupabaseClient<Database>,
  groupIds: number[],
): Promise<Map<number, number[]>> {
  const membersByGroupId = new Map<number, number[]>();
  if (groupIds.length === 0) return membersByGroupId;

  const { data, error } = await supabase
    .from("copy_provider_group_member")
    .select("group_id, tag_id")
    .in("group_id", groupIds)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const groupId = row.group_id;
    const tagId = row.tag_id;
    if (groupId == null || tagId == null) continue;
    const existing = membersByGroupId.get(groupId);
    if (existing) {
      existing.push(tagId);
    } else {
      membersByGroupId.set(groupId, [tagId]);
    }
  }
  return membersByGroupId;
}

export async function fetchTeamData(
  supabase: SupabaseClient<Database>,
  input: TeamDataInput,
): Promise<TeamData> {
  const awakenerIds = uniqueAwakenerIds(input);
  if (awakenerIds.length === 0 && input.posseId == null) {
    return createEmptyTeamData();
  }

  const defaultInteractionsQuery = supabase
    .from("tag_default_interaction")
    .select(
      `
      id,
      math_operation,
      default_factor,
      buff_target_type_restriction,
      creates_base,
      amplifies_subject,
      modifier_tag:tag!modifier_tag_id(id, tag_name, layer, is_percent, is_additive),
      target_tag:tag!target_tag_id(id, tag_name, layer, is_percent, is_additive),
      exclusion_tag:tag!exclusion_suffix(id, tag_name, layer, is_percent, is_additive)
    `,
    )
    .is("deleted_at", null);

  const realmsQuery = supabase
    .from("realm")
    .select("id, name, replace")
    .is("deleted_at", null);

  const realmTagManifestationsQuery = supabase
    .from("realm_tag_manifestation")
    .select(
      `
      id,
      realm_id,
      required_realm_mode,
      tag_id,
      trigger_condition,
      value_scalar,
      dependency_stat,
      dependency_rate,
      dependency_rate_stat,
      pure_bonus_target,
      metadata,
      is_accumulating,
      tag!tag_id(id, tag_name, layer, is_percent, is_additive),
      realm_ref:realm!realm_id(id, name)
    `,
    )
    .is("deleted_at", null);

  const awakenerResult =
    awakenerIds.length > 0
      ? await supabase
          .from("awakener")
          .select(
            "id, name, realm, realm_ref:realm!awakener_realm_fkey(name), con, atk, def, keyflare_regen, damage_amp, crit_rate, crit_dmg, realm_mastery, base_aliemus, aliemus_regen, sigil_yield, death_resist, enlightenment",
          )
          .in("id", awakenerIds)
          .is("deleted_at", null)
      : { data: [], error: null };

  const [defaultInteractionResult, realmsResult, realmTagResult] =
    await Promise.all([
      defaultInteractionsQuery,
      realmsQuery,
      realmTagManifestationsQuery,
    ]);

  if (awakenerResult.error) {
    throw new Error(awakenerResult.error.message);
  }
  if (defaultInteractionResult.error) {
    throw new Error(defaultInteractionResult.error.message);
  }
  if (realmsResult.error) {
    throw new Error(realmsResult.error.message);
  }
  if (realmTagResult.error) {
    throw new Error(realmTagResult.error.message);
  }

  const realmLookup: RealmLookupRow[] = (realmsResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    replace: row.replace,
  }));

  const awakenerById = new Map(
    (awakenerResult.data ?? []).map((row) => [
      row.id,
      {
        ...row,
        realm: realmName(row.realm_ref as RealmRef),
        realmId: row.realm,
      },
    ]),
  );

  const rawAwakenerManifestationRows = (
    await Promise.all(
      (awakenerResult.data ?? []).map((awakener) =>
        fetchAwakenerManifestations(
          supabase,
          awakener.id,
          awakener.enlightenment,
        ),
      ),
    )
  ).flat();

  const awakenerManifestationRows = applyManifestationReplacements(
    rawAwakenerManifestationRows.map((row) => ({
      ...row,
      replacesManifestationId: row.replaces_manifestation_id,
    })),
  );

  const awakeners: Awakener[] = (awakenerResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    realm: realmName(row.realm_ref as RealmRef),
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
  }));

  const tagsById: Record<number, Tag> = {};
  const manifestations: Manifestation[] = [];
  const gearStatContributions: GearStatContribution[] = [];

  const wheelIds = new Set<number>();
  const covenantIds = new Set<number>();
  const covenantStatSetIds = new Set<number>();
  for (const slot of input.slots) {
    if (slot.wheel1Id != null) wheelIds.add(slot.wheel1Id);
    if (slot.wheel2Id != null) wheelIds.add(slot.wheel2Id);
    if (slot.covenantId != null) covenantIds.add(slot.covenantId);
    if (slot.covenantStatSetId != null) {
      covenantStatSetIds.add(slot.covenantStatSetId);
    }
  }
  const posseIds =
    input.posseId != null ? [input.posseId] : ([] as number[]);

  const [wheelsById, covenantsById, covenantStatSetsById, posseNamesById] =
    await Promise.all([
      fetchWheelGearById(supabase, [...wheelIds]),
      fetchCovenantGearById(supabase, [...covenantIds]),
      fetchCovenantStatSetById(supabase, [...covenantStatSetIds]),
      fetchEntityNamesById(supabase, "posse", posseIds),
    ]);

  const gearManifestationPromises: Promise<void>[] = [];

  for (const [slotIndex, slot] of input.slots.entries()) {
    const awakener = slot.awakenerId
      ? awakenerById.get(slot.awakenerId)
      : null;
    const slotRealm = awakener?.realm ?? null;

    if (slot.wheel1Id != null) {
      const wheelId = slot.wheel1Id;
      const wheel = wheelsById.get(wheelId);
      const sourceName = wheel?.name ?? `#${wheelId}`;
      pushGearContribution(
        gearStatContributions,
        slot.awakenerId,
        "wheel",
        wheel,
        wheelId,
      );
      gearManifestationPromises.push(
        fetchWheelManifestations(supabase, wheelId, slotRealm).then(
          (rows) => {
            for (const row of rows) {
              const tag = parseTagRef(row.tag as TagRef);
              if (tag) collectTags(tagsById, tag);
              manifestations.push(
                mapGearManifestation(
                  {
                    ...row,
                    requiredRealm: realmName(row.required_realm_ref as RealmRef),
                    requiredRealmId: row.required_realm ?? null,
                  },
                  "wheel",
                  slotIndex,
                  slot.awakenerId,
                  sourceName,
                ),
              );
            }
          },
        ),
      );
    }

    if (slot.wheel2Id != null) {
      const wheelId = slot.wheel2Id;
      const wheel = wheelsById.get(wheelId);
      const sourceName = wheel?.name ?? `#${wheelId}`;
      pushGearContribution(
        gearStatContributions,
        slot.awakenerId,
        "wheel",
        wheel,
        wheelId,
      );
      gearManifestationPromises.push(
        fetchWheelManifestations(supabase, wheelId, slotRealm).then(
          (rows) => {
            for (const row of rows) {
              const tag = parseTagRef(row.tag as TagRef);
              if (tag) collectTags(tagsById, tag);
              manifestations.push(
                mapGearManifestation(
                  {
                    ...row,
                    requiredRealm: realmName(row.required_realm_ref as RealmRef),
                    requiredRealmId: row.required_realm ?? null,
                  },
                  "wheel",
                  slotIndex,
                  slot.awakenerId,
                  sourceName,
                ),
              );
            }
          },
        ),
      );
    }

    if (slot.covenantId != null) {
      const covenantId = slot.covenantId;
      const covenant = covenantsById.get(covenantId);
      const sourceName = covenant?.name ?? `#${covenantId}`;
      pushGearContribution(
        gearStatContributions,
        slot.awakenerId,
        "covenant",
        covenant,
        covenantId,
      );
      gearManifestationPromises.push(
        fetchCovenantManifestations(
          supabase,
          covenantId,
          slotRealm,
        ).then((rows) => {
          const filtered = applyManifestationReplacements(
            rows.map((row) => ({
              ...row,
              replacesManifestationId: row.replaces_manifestation_id,
            })),
          );
          for (const row of filtered) {
            const tag = parseTagRef(row.tag as TagRef);
            if (tag) collectTags(tagsById, tag);
            manifestations.push(
              mapGearManifestation(
                {
                  ...row,
                  requiredRealm: realmName(row.required_realm1_ref as RealmRef),
                  requiredRealm2: realmName(row.required_realm2_ref as RealmRef),
                  requiredRealmId: row.required_realm1 ?? null,
                  requiredRealmId2: row.required_realm2 ?? null,
                },
                "covenant",
                slotIndex,
                slot.awakenerId,
                sourceName,
              ),
            );
          }
        }),
      );
    }

    if (slot.covenantStatSetId != null) {
      const covenantStatSetId = slot.covenantStatSetId;
      pushGearContribution(
        gearStatContributions,
        slot.awakenerId,
        "covenant_stat_set",
        covenantStatSetsById.get(covenantStatSetId),
        covenantStatSetId,
      );
    }
  }

  if (input.posseId != null) {
    const posseId = input.posseId;
    const sourceName = posseNamesById.get(posseId) ?? `#${posseId}`;
    const realms = [
      ...new Set(
        [...awakenerById.values()]
          .map((a) => a.realm)
          .filter((r): r is Realm => r != null),
      ),
    ];
    gearManifestationPromises.push(
      fetchPosseManifestations(supabase, posseId, realms).then((rows) => {
        for (const row of rows) {
          const tag = parseTagRef(row.tag as TagRef);
          if (tag) collectTags(tagsById, tag);
          manifestations.push(
            mapGearManifestation(
              {
                ...row,
                requiredRealm: realmName(row.required_realm_ref as RealmRef),
                requiredRealmId: row.required_realm ?? null,
              },
              "posse",
              null,
              null,
              sourceName,
            ),
          );
        }
      }),
    );
  }

  await Promise.all(gearManifestationPromises);

  const awakenerManifestationIds = awakenerManifestationRows.map((r) => r.id);
  const overridesByManifestationId = await loadOverridesForManifestations(
    supabase,
    awakenerManifestationIds,
    tagsById,
  );

  const copyProviderGroupIds = [
    ...new Set(
      awakenerManifestationRows
        .map((r) => r.copy_provider_group_id)
        .filter((id): id is number => id != null),
    ),
  ];
  const copyProviderMembersByGroupId = await loadCopyProviderMembersByGroupId(
    supabase,
    copyProviderGroupIds,
  );

  for (const row of awakenerManifestationRows) {
    const tag = parseTagRef(row.tag as TagRef);
    if (tag) collectTags(tagsById, tag);

    const awakenerRow = awakenerById.get(row.awakener_id);
    const sourceName =
      awakenerRow?.name ??
      (row.awakener_id != null ? `#${row.awakener_id}` : null);

    const groupRef = row.copy_provider_group as
      | { id: number; name: string | null }
      | null
      | undefined;
    const copyProviderGroupId = row.copy_provider_group_id ?? null;
    const copyProviderGroupName =
      groupRef?.name ??
      (copyProviderGroupId != null ? `#${copyProviderGroupId}` : null);
    const copyProviderTagIds =
      copyProviderGroupId != null
        ? (copyProviderMembersByGroupId.get(copyProviderGroupId) ?? [])
        : [];

    manifestations.push({
      id: row.id,
      sourceKind: "awakener",
      awakenerId: row.awakener_id,
      slotIndex: null,
      sourceName,
      tagId: tag?.id ?? row.tag_id ?? 0,
      tagName: tag?.tagName ?? "Unknown",
      triggerCondition: row.trigger_condition ?? null,
      valueScalar: row.value_scalar,
      instanceCount: row.instance_count ?? 1,
      baseCopies: row.base_copies ?? 1,
      copyProviderGroupId,
      copyProviderGroupName,
      copyProviderTagIds,
      dependencyStat: row.dependency_stat,
      sourceType: row.source_type,
      targetType: row.target_type,
      buffTargetTypeRestriction: row.buff_target_type_restriction,
      metadata: row.metadata,
      isAccumulating: row.is_accumulating,
      requiredEnlightenment: row.required_enlightenment,
      requiredAwakenerId: null,
      requiredAwakenerName: null,
      requiredRealm: realmName(row.required_realm_ref as RealmRef),
      requiredRealm2: null,
      requiredRealmId: row.required_realm ?? null,
      requiredRealmId2: null,
      replacesManifestationId: row.replaces_manifestation_id,
      interactionOverrides: overridesByManifestationId.get(row.id) ?? [],
      isBaseStatTransfer: false,
      isCreatedBase: false,
      ...NON_REALM_MANIFESTATION_FIELDS,
    });
  }

  for (const row of realmTagResult.data ?? []) {
    const tag = parseTagRef(row.tag as TagRef);
    if (tag) collectTags(tagsById, tag);
    const realmRef = row.realm_ref as { id: number; name: string } | null;
    manifestations.push({
      id: row.id,
      sourceKind: "realm",
      awakenerId: null,
      slotIndex: null,
      sourceName: realmRef?.name ?? `#${row.realm_id}`,
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
      requiredRealm: (realmRef?.name as Realm | undefined) ?? null,
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
      pureBonusTarget: row.pure_bonus_target as PureBonusTarget,
    });
  }

  await fetchRequiredBaseStatTags(supabase, tagsById);

  const defaultInteractions: DefaultInteraction[] = (
    defaultInteractionResult.data ?? []
  ).map((row) => {
    const modifierTag = parseTagRef(row.modifier_tag as TagRef);
    const targetTag = parseTagRef(row.target_tag as TagRef);
    const exclusionTag = parseTagRef(row.exclusion_tag as TagRef);
    collectTags(tagsById, modifierTag, targetTag, exclusionTag);

    return {
      id: row.id,
      modifierTagId: modifierTag?.id ?? null,
      modifierTagName: modifierTag?.tagName ?? "Unknown",
      targetTagId: targetTag?.id ?? null,
      targetTagName: targetTag?.tagName ?? "Unknown",
      exclusionTagId: exclusionTag?.id ?? null,
      exclusionTagName: exclusionTag?.tagName ?? null,
      mathOperation: row.math_operation,
      defaultFactor: row.default_factor,
      buffTargetTypeRestriction: row.buff_target_type_restriction,
      createsBase: row.creates_base ?? false,
      amplifiesSubject: row.amplifies_subject ?? true,
    };
  });

  const partial = {
    awakeners,
    manifestations,
    defaultInteractions,
    tagsById,
    realms: realmLookup,
    gearStatContributions,
  };

  return {
    ...partial,
    summary: buildSummary(partial),
  };
}

export function toTeamDataInput(
  slots: TeamDataSlotInput[],
  posseId: number | null,
): TeamDataInput {
  return { slots, posseId };
}
