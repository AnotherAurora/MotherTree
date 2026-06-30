import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  createEmptyDamageContext,
  type DamageAwakener,
  type DamageContext,
  type DamageContextInput,
  type DamageDefaultInteraction,
  type DamageInteractionOverride,
  type DamageManifestation,
  type DamageTag,
} from "@/lib/damage/types";

type TagRef = { id: number; tag_name: string | null } | null;

function parseTagRef(tag: TagRef): { id: number; tagName: string } | null {
  if (!tag?.id) return null;
  return { id: tag.id, tagName: tag.tag_name ?? `#${tag.id}` };
}

function collectTags(
  tagsById: Record<number, DamageTag>,
  ...refs: Array<{ id: number; tagName: string } | null>
) {
  for (const ref of refs) {
    if (ref) tagsById[ref.id] = ref;
  }
}

function buildSummary(context: Omit<DamageContext, "summary">) {
  return {
    awakenerCount: context.awakeners.length,
    manifestationCount: context.manifestations.length,
    overrideCount: context.overrides.length,
    defaultInteractionCount: context.defaultInteractions.length,
    tagCount: Object.keys(context.tagsById).length,
  };
}

function uniqueAwakenerIds(input: DamageContextInput): number[] {
  const ids = new Set<number>();
  for (const slot of input.slots) {
    if (slot.awakenerId != null) ids.add(slot.awakenerId);
  }
  return [...ids];
}

export async function fetchDamageContext(
  supabase: SupabaseClient<Database>,
  input: DamageContextInput,
): Promise<DamageContext> {
  const awakenerIds = uniqueAwakenerIds(input);
  if (awakenerIds.length === 0) {
    return createEmptyDamageContext();
  }

  const manifestationsQuery = supabase
    .from("awakener_tag_manifestation")
    .select(
      `
      id,
      awakener_id,
      tag_id,
      value_scalar,
      base_hits,
      dependency_stat,
      source_type,
      target_type,
      ramp_turns,
      required_e,
      required_realm,
      replaces_manifestation_id,
      tag:tag_id(id, tag_name)
    `,
    )
    .in("awakener_id", awakenerIds)
    .is("deleted_at", null);

  const defaultInteractionsQuery = supabase
    .from("tag_default_interaction")
    .select(
      `
      id,
      math_operation,
      default_factor,
      source_type,
      modifier_tag:tag!modifier_tag_id(id, tag_name),
      target_tag:tag!target_tag_id(id, tag_name),
      exclusion_tag:tag!exclusion_suffix(id, tag_name)
    `,
    )
    .is("deleted_at", null);

  const [awakenerResult, manifestationResult, defaultInteractionResult] =
    await Promise.all([
      supabase
        .from("awakener")
        .select(
          "id, name, realm, con, atk, def, skey, damage_amp, crit_rate, crit_dmg, realm_mastery, aliemus_regen, sigil_yield, death_resist",
        )
        .in("id", awakenerIds)
        .is("deleted_at", null),
      manifestationsQuery,
      defaultInteractionsQuery,
    ]);

  if (awakenerResult.error) {
    throw new Error(awakenerResult.error.message);
  }
  if (manifestationResult.error) {
    throw new Error(manifestationResult.error.message);
  }
  if (defaultInteractionResult.error) {
    throw new Error(defaultInteractionResult.error.message);
  }

  const awakeners: DamageAwakener[] = (awakenerResult.data ?? []).map(
    (row) => ({
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
    }),
  );

  const tagsById: Record<number, DamageTag> = {};
  const manifestations: DamageManifestation[] = [];

  for (const row of manifestationResult.data ?? []) {
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
      requiredE: row.required_e,
      requiredRealm: row.required_realm,
      replacesManifestationId: row.replaces_manifestation_id,
    });
  }

  const manifestationIds = manifestations.map((m) => m.id);
  let overrides: DamageInteractionOverride[] = [];

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
        modifier_tag:tag!modifier_tag_id(id, tag_name)
      `,
      )
      .in("manifestation_id", manifestationIds)
      .is("deleted_at", null);

    if (overrideResult.error) {
      throw new Error(overrideResult.error.message);
    }

    overrides = (overrideResult.data ?? []).map((row) => {
      const modifierTag = parseTagRef(row.modifier_tag as TagRef);
      if (modifierTag) collectTags(tagsById, modifierTag);

      return {
        id: row.id,
        manifestationId: row.manifestation_id,
        modifierTagId: row.modifier_tag_id,
        modifierTagName: modifierTag?.tagName ?? "Unknown",
        mathOperation: row.math_operation,
        overrideDefaultFactor: row.override_default_factor,
        targetType: row.target_type,
        dependencyStat: row.dependency_stat,
        isDisabled: row.is_disabled === true,
      };
    });
  }

  const defaultInteractions: DamageDefaultInteraction[] = (
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
    overrides,
    defaultInteractions,
    tagsById,
  };

  return {
    ...partial,
    summary: buildSummary(partial),
  };
}
