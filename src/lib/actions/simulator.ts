"use server";

import type { ActionResult, ForeignKeyOption } from "@/lib/actions/crud";
import {
  applyManifestationReplacements,
  effectiveEnlightenment,
} from "@/lib/damage/resolve-manifestations";
import { createAdminClient } from "@/lib/supabase/admin";

export type AwakenerRelatedTagOverride = {
  id: number;
  modifierTagName: string;
  isDisabled: boolean;
};

export type AwakenerRelatedTagManifestation = {
  id: number;
  tagName: string;
  interactionOverrides: AwakenerRelatedTagOverride[];
};

export type AwakenerRelatedTags = {
  manifestations: AwakenerRelatedTagManifestation[];
};

export type SimulatorAwakenerOption = ForeignKeyOption & {
  realm: string | null;
};

export async function getSimulatorAwakenerOptions(): Promise<
  ActionResult<SimulatorAwakenerOption[]>
> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("awakener")
      .select("id, name, realm")
      .is("deleted_at", null)
      .order("name");

    if (error) return { success: false, error: error.message };

    const options: SimulatorAwakenerOption[] = (data ?? []).map((row) => ({
      value: row.id,
      label: row.name ?? `#${row.id}`,
      realm: row.realm,
    }));

    return { success: true, data: options };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load awakener options",
    };
  }
}

export async function getAwakenerRelatedTags(
  awakenerId: number,
): Promise<ActionResult<AwakenerRelatedTags>> {
  try {
    const supabase = createAdminClient();

    const awakenerResult = await supabase
      .from("awakener")
      .select("id, enlightenment")
      .eq("id", awakenerId)
      .is("deleted_at", null)
      .maybeSingle();

    if (awakenerResult.error) {
      return { success: false, error: awakenerResult.error.message };
    }
    if (awakenerResult.data == null) {
      return { success: false, error: "Awakener not found" };
    }

    const manifestationResult = await supabase
      .from("awakener_tag_manifestation")
      .select(
        "id, awakener_id, required_enlightenment, replaces_manifestation_id, tag:tag_id(tag_name)",
      )
      .eq("awakener_id", awakenerId)
      .lte(
        "required_enlightenment",
        effectiveEnlightenment(awakenerResult.data.enlightenment),
      )
      .is("deleted_at", null);

    if (manifestationResult.error) {
      return { success: false, error: manifestationResult.error.message };
    }

    const manifestationRows = applyManifestationReplacements(
      (manifestationResult.data ?? []).map((row) => ({
        ...row,
        replacesManifestationId: row.replaces_manifestation_id,
      })),
    );

    const manifestationIds = manifestationRows.map((row) => row.id);

    const overridesByManifestationId = new Map<
      number,
      AwakenerRelatedTagOverride[]
    >();

    if (manifestationIds.length > 0) {
      const { data: overrides, error: overrideError } = await supabase
        .from("manifestation_interaction_override")
        .select(
          "id, manifestation_id, modifier_tag:modifier_tag_id(tag_name), is_disabled",
        )
        .in("manifestation_id", manifestationIds)
        .is("deleted_at", null);

      if (overrideError) {
        return { success: false, error: overrideError.message };
      }

      for (const row of overrides ?? []) {
        const manifestationId = row.manifestation_id;
        if (manifestationId == null) continue;

        const tag = row.modifier_tag as { tag_name: string | null } | null;
        const modifierTagName = tag?.tag_name ?? "Unknown";

        const override: AwakenerRelatedTagOverride = {
          id: row.id,
          modifierTagName,
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

    const result: AwakenerRelatedTagManifestation[] = manifestationRows.map(
      (row) => {
        const tag = row.tag as { tag_name: string | null } | null;
        const interactionOverrides = [
          ...(overridesByManifestationId.get(row.id) ?? []),
        ].sort((a, b) =>
          a.modifierTagName.localeCompare(b.modifierTagName),
        );

        return {
          id: row.id,
          tagName: tag?.tag_name ?? "Unknown",
          interactionOverrides,
        };
      },
    );

    result.sort((a, b) => a.tagName.localeCompare(b.tagName));

    return {
      success: true,
      data: { manifestations: result },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load awakener related tags",
    };
  }
}
