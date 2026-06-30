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
  type Tag,
  type TeamData,
  type TeamDataInput,
} from "@/lib/team-data/types";

type TagRef = {
  id: number;
  tag_name: string | null;
  layer: Layer | null;
} | null;

function parseTagRef(tag: TagRef): Tag | null {
  if (!tag?.id) return null;
  return {
    id: tag.id,
    tagName: tag.tag_name ?? `#${tag.id}`,
    layer: tag.layer ?? null,
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

function buildSummary(context: Omit<TeamData, "summary">) {
  return {
    awakenerCount: context.awakeners.length,
    manifestationCount: context.manifestations.length,
    overrideCount: context.manifestations.reduce(
      (n, m) => n + m.interactionOverrides.length,
      0,
    ),
    defaultInteractionCount: context.defaultInteractions.length,
    tagCount: Object.keys(context.tagsById).length,
  };
}

function uniqueAwakenerIds(input: TeamDataInput): number[] {
  const ids = new Set<number>();
  for (const slot of input.slots) {
    if (slot.awakenerId != null) ids.add(slot.awakenerId);
  }
  return [...ids];
}

const MANIFESTATION_SELECT = `
  id,
  awakener_id,
  tag_id,
  value_scalar,
  base_hits,
  dependency_stat,
  source_type,
  target_type,
  ramp_turns,
  required_enlightenment,
  required_realm,
  replaces_manifestation_id,
  tag:tag_id(id, tag_name, layer)
`;

async function fetchManifestationsForAwakener(
  supabase: SupabaseClient<Database>,
  awakenerId: number,
  enlightenment: number | null,
) {
  const { data, error } = await supabase
    .from("awakener_tag_manifestation")
    .select(MANIFESTATION_SELECT)
    .eq("awakener_id", awakenerId)
    .lte("required_enlightenment", effectiveEnlightenment(enlightenment))
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function fetchTeamData(
  supabase: SupabaseClient<Database>,
  input: TeamDataInput,
): Promise<TeamData> {
  const awakenerIds = uniqueAwakenerIds(input);
  if (awakenerIds.length === 0) {
    return createEmptyTeamData();
  }

  const defaultInteractionsQuery = supabase
    .from("tag_default_interaction")
    .select(
      `
      id,
      math_operation,
      default_factor,
      source_type,
      modifier_tag:tag!modifier_tag_id(id, tag_name, layer),
      target_tag:tag!target_tag_id(id, tag_name, layer),
      exclusion_tag:tag!exclusion_suffix(id, tag_name, layer)
    `,
    )
    .is("deleted_at", null);

  const [awakenerResult, defaultInteractionResult] = await Promise.all([
    supabase
      .from("awakener")
      .select(
        "id, name, realm, con, atk, def, skey, damage_amp, crit_rate, crit_dmg, realm_mastery, aliemus_regen, sigil_yield, death_resist, enlightenment",
      )
      .in("id", awakenerIds)
      .is("deleted_at", null),
    defaultInteractionsQuery,
  ]);

  if (awakenerResult.error) {
    throw new Error(awakenerResult.error.message);
  }
  if (defaultInteractionResult.error) {
    throw new Error(defaultInteractionResult.error.message);
  }

  const awakenerRows = awakenerResult.data ?? [];
  const rawManifestationRows = (
    await Promise.all(
      awakenerRows.map((awakener) =>
        fetchManifestationsForAwakener(
          supabase,
          awakener.id,
          awakener.enlightenment,
        ),
      ),
    )
  ).flat();

  const manifestationRows = applyManifestationReplacements(
    rawManifestationRows.map((row) => ({
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
    skey: row.skey,
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

  const overridesByManifestationId = new Map<
    number,
    InteractionOverride[]
  >();

  const manifestationIds = manifestationRows.map((row) => row.id);

  if (manifestationIds.length > 0) {
    const overrideResult = await supabase
      .from("manifestation_interaction_override")
      .select(
        `
        id,
        manifestation_id,
        modifier_tag_id,
        math_operation,
        override_default_factor,
        target_type,
        dependency_stat,
        is_disabled,
        modifier_tag:tag!modifier_tag_id(id, tag_name, layer)
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
        overrideDefaultFactor: row.override_default_factor,
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
  }

  const manifestations: Manifestation[] = [];

  for (const row of manifestationRows) {
    const tag = parseTagRef(row.tag as TagRef);
    if (tag) collectTags(tagsById, tag);

    manifestations.push({
      id: row.id,
      awakenerId: row.awakener_id,
      tagId: tag?.id ?? row.tag_id,
      tagName: tag?.tagName ?? "Unknown",
      valueScalar: row.value_scalar,
      baseHits: row.base_hits,
      dependencyStat: row.dependency_stat,
      sourceType: row.source_type,
      targetType: row.target_type,
      rampTurns: row.ramp_turns,
      requiredEnlightenment: row.required_enlightenment,
      requiredRealm: row.required_realm,
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
      sourceType: row.source_type,
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
