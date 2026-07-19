import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  applyManifestationReplacements,
  effectiveEnlightenment,
} from "@/lib/team-data/resolve-manifestations";
import {
  createEmptyTeamData,
  type Awakener,
  type DefaultInteraction,
  type InteractionOverride,
  type Manifestation,
  type Layer,
  type Realm,
  type Tag,
  type TeamData,
  type TeamDataInput,
  type TeamDataSlotInput,
} from "@/lib/team-data/types";

type TagRef = {
  id: number;
  tag_name: string | null;
  layer: Layer | null;
  is_percent?: boolean | null;
} | null;

function parseTagRef(tag: TagRef): Tag | null {
  if (!tag?.id) return null;
  return {
    id: tag.id,
    tagName: tag.tag_name ?? `#${tag.id}`,
    layer: tag.layer ?? null,
    isPercent: tag.is_percent === true,
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
  };
}

function uniqueAwakenerIds(input: TeamDataInput): number[] {
  const ids = new Set<number>();
  for (const slot of input.slots) {
    if (slot.awakenerId != null) ids.add(slot.awakenerId);
  }
  return [...ids];
}

const AWAKENER_MANIFESTATION_SELECT = `
  id,
  awakener_id,
  tag_id,
  value_scalar,
  base_hits,
  dependency_stat,
  source_type,
  target_type,
  buff_target_type_restriction,
  metadata,
  is_accumulating,
  required_enlightenment,
  required_realm,
  replaces_manifestation_id,
  tag:tag_id(id, tag_name, layer, is_percent)
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
  value_scalar,
  target_type,
  buff_target_type_restriction,
  metadata,
  is_accumulating,
  required_realm,
  tag:tag_id(id, tag_name, layer, is_percent)
`;

const COVENANT_MANIFESTATION_SELECT = `
  id,
  tag_id,
  value_scalar,
  target_type,
  buff_target_type_restriction,
  metadata,
  dependency_stat,
  is_accumulating,
  required_realm1,
  required_realm2,
  replaces_manifestation_id,
  tag:tag_id(id, tag_name, layer, is_percent)
`;

function matchesCovenantSlotRealm(
  requiredRealm1: Realm | null,
  requiredRealm2: Realm | null,
  slotRealm: Realm | null,
): boolean {
  if (requiredRealm1 == null && requiredRealm2 == null) return true;
  if (slotRealm == null) return true;
  return requiredRealm1 === slotRealm || requiredRealm2 === slotRealm;
}

async function fetchWheelManifestations(
  supabase: SupabaseClient<Database>,
  wheelId: number,
  slotRealm: Realm | null,
) {
  let query = supabase
    .from("wheel_tag_manifestation")
    .select(`${GEAR_MANIFESTATION_SELECT}, dependency_stat`)
    .eq("wheel_id", wheelId)
    .is("deleted_at", null);

  if (slotRealm) {
    query = query.or(`required_realm.is.null,required_realm.eq.${slotRealm}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchCovenantManifestations(
  supabase: SupabaseClient<Database>,
  covenantId: number,
  slotRealm: Realm | null,
) {
  const { data, error } = await supabase
    .from("covenant_tag_manifestation")
    .select(COVENANT_MANIFESTATION_SELECT)
    .eq("covenant_id", covenantId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  return (data ?? []).filter((row) =>
    matchesCovenantSlotRealm(
      row.required_realm1,
      row.required_realm2,
      slotRealm,
    ),
  );
}

async function fetchPosseManifestations(
  supabase: SupabaseClient<Database>,
  posseId: number,
  realms: Realm[],
) {
  const { data, error } = await supabase
    .from("posse_tag_manifestation")
    .select(
      `${GEAR_MANIFESTATION_SELECT}, required_awakener, dependency_stat, required_awakener_ref:awakener!required_awakener(id, name)`,
    )
    .eq("posse_id", posseId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  // required_awakener is soft-filtered later via isManifestationApplied so
  // debug can show gated posse tags as Applied: no.
  return (data ?? []).filter((row) => {
    if (
      row.required_realm != null &&
      realms.length > 0 &&
      !realms.includes(row.required_realm)
    ) {
      return false;
    }
    return true;
  });
}

function mapGearManifestation(
  row: {
    id: number;
    tag_id: number | null;
    value_scalar: number | null;
    target_type: Manifestation["targetType"];
    is_accumulating: boolean;
    required_realm: Realm | null;
    required_realm2?: Realm | null;
    replaces_manifestation_id?: number | null;
    required_awakener?: number | null;
    required_awakener_ref?: { id: number; name: string | null } | null;
    tag: TagRef;
    base_hits?: number | null;
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
    valueScalar: row.value_scalar,
    baseHits: row.base_hits ?? null,
    dependencyStat: row.dependency_stat ?? null,
    sourceType: row.source_type ?? null,
    targetType: row.target_type,
    buffTargetTypeRestriction: row.buff_target_type_restriction ?? null,
    metadata: row.metadata ?? null,
    isAccumulating: row.is_accumulating,
    requiredEnlightenment: null,
    requiredAwakenerId,
    requiredAwakenerName,
    requiredRealm: row.required_realm,
    requiredRealm2: row.required_realm2 ?? null,
    replacesManifestationId: row.replaces_manifestation_id ?? null,
    interactionOverrides: [],
  };
}

async function fetchEntityNamesById(
  supabase: SupabaseClient<Database>,
  table: "wheel" | "covenant" | "posse",
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

async function loadOverridesForManifestations(
  supabase: SupabaseClient<Database>,
  manifestationIds: number[],
  tagsById: Record<number, Tag>,
): Promise<Map<number, InteractionOverride[]>> {
  const overridesByManifestationId = new Map<number, InteractionOverride[]>();
  if (manifestationIds.length === 0) return overridesByManifestationId;

  const overrideResult = await supabase
    .from("manifestation_interaction_override")
    .select(
      `
      id,
      manifestation_id,
      modifier_tag_id,
      math_operation,
      value_scalar,
      target_type,
      dependency_stat,
      is_disabled,
      modifier_tag:tag!modifier_tag_id(id, tag_name, layer, is_percent)
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
    if (modifierTag) collectTags(tagsById, modifierTag);

    const override: InteractionOverride = {
      id: row.id,
      modifierTagId: row.modifier_tag_id,
      modifierTagName: modifierTag?.tagName ?? "Unknown",
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
      substitute,
      modifier_tag:tag!modifier_tag_id(id, tag_name, layer, is_percent),
      target_tag:tag!target_tag_id(id, tag_name, layer, is_percent),
      exclusion_tag:tag!exclusion_suffix(id, tag_name, layer, is_percent)
    `,
    )
    .is("deleted_at", null);

  const awakenerResult =
    awakenerIds.length > 0
      ? await supabase
          .from("awakener")
          .select(
            "id, name, realm, con, atk, def, keyflare_regen, damage_amp, crit_rate, crit_dmg, realm_mastery, aliemus_regen, sigil_yield, death_resist, enlightenment",
          )
          .in("id", awakenerIds)
          .is("deleted_at", null)
      : { data: [], error: null };

  const defaultInteractionResult = await defaultInteractionsQuery;

  if (awakenerResult.error) {
    throw new Error(awakenerResult.error.message);
  }
  if (defaultInteractionResult.error) {
    throw new Error(defaultInteractionResult.error.message);
  }

  const awakenerById = new Map(
    (awakenerResult.data ?? []).map((row) => [row.id, row]),
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
    realm: row.realm,
    con: row.con,
    atk: row.atk,
    def: row.def,
    keyflareRegen: row.keyflare_regen,
    damageAmp: row.damage_amp,
    critRate: row.crit_rate,
    critDmg: row.crit_dmg,
    realmMastery: row.realm_mastery,
    aliemusRegen: row.aliemus_regen,
    sigilYield: row.sigil_yield,
    deathResist: row.death_resist,
    enlightenment: row.enlightenment,
  }));

  const tagsById: Record<number, Tag> = {};
  const manifestations: Manifestation[] = [];

  const wheelIds = new Set<number>();
  const covenantIds = new Set<number>();
  for (const slot of input.slots) {
    if (slot.wheel1Id != null) wheelIds.add(slot.wheel1Id);
    if (slot.wheel2Id != null) wheelIds.add(slot.wheel2Id);
    if (slot.covenantId != null) covenantIds.add(slot.covenantId);
  }
  const posseIds =
    input.posseId != null ? [input.posseId] : ([] as number[]);

  const [wheelNamesById, covenantNamesById, posseNamesById] =
    await Promise.all([
      fetchEntityNamesById(supabase, "wheel", [...wheelIds]),
      fetchEntityNamesById(supabase, "covenant", [...covenantIds]),
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
      const sourceName = wheelNamesById.get(wheelId) ?? `#${wheelId}`;
      gearManifestationPromises.push(
        fetchWheelManifestations(supabase, wheelId, slotRealm).then(
          (rows) => {
            for (const row of rows) {
              const tag = parseTagRef(row.tag as TagRef);
              if (tag) collectTags(tagsById, tag);
              manifestations.push(
                mapGearManifestation(
                  row,
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
      const sourceName = wheelNamesById.get(wheelId) ?? `#${wheelId}`;
      gearManifestationPromises.push(
        fetchWheelManifestations(supabase, wheelId, slotRealm).then(
          (rows) => {
            for (const row of rows) {
              const tag = parseTagRef(row.tag as TagRef);
              if (tag) collectTags(tagsById, tag);
              manifestations.push(
                mapGearManifestation(
                  row,
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
      const sourceName =
        covenantNamesById.get(covenantId) ?? `#${covenantId}`;
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
                  required_realm: row.required_realm1 ?? null,
                  required_realm2: row.required_realm2 ?? null,
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
  }

  if (input.posseId != null) {
    const posseId = input.posseId;
    const sourceName = posseNamesById.get(posseId) ?? `#${posseId}`;
    const realms = [
      ...new Set(
        (awakenerResult.data ?? [])
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
            mapGearManifestation(row, "posse", null, null, sourceName),
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

  for (const row of awakenerManifestationRows) {
    const tag = parseTagRef(row.tag as TagRef);
    if (tag) collectTags(tagsById, tag);

    const awakenerRow = awakenerById.get(row.awakener_id);
    const sourceName =
      awakenerRow?.name ??
      (row.awakener_id != null ? `#${row.awakener_id}` : null);

    manifestations.push({
      id: row.id,
      sourceKind: "awakener",
      awakenerId: row.awakener_id,
      slotIndex: null,
      sourceName,
      tagId: tag?.id ?? row.tag_id ?? 0,
      tagName: tag?.tagName ?? "Unknown",
      valueScalar: row.value_scalar,
      baseHits: row.base_hits,
      dependencyStat: row.dependency_stat,
      sourceType: row.source_type,
      targetType: row.target_type,
      buffTargetTypeRestriction: row.buff_target_type_restriction,
      metadata: row.metadata,
      isAccumulating: row.is_accumulating,
      requiredEnlightenment: row.required_enlightenment,
      requiredAwakenerId: null,
      requiredAwakenerName: null,
      requiredRealm: row.required_realm,
      requiredRealm2: null,
      replacesManifestationId: row.replaces_manifestation_id,
      interactionOverrides: overridesByManifestationId.get(row.id) ?? [],
    });
  }

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
      substitute: row.substitute ?? true,
    };
  });

  const partial = {
    awakeners,
    manifestations,
    defaultInteractions,
    tagsById,
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
