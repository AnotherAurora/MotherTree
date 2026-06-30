"use server";

import type { ActionResult, ForeignKeyOption } from "@/lib/actions/crud";
import { createAdminClient } from "@/lib/supabase/admin";

export type AwakenerRelatedTagOverride = {
  modifierTagName: string;
  isDisabled: boolean;
};

export type AwakenerRelatedTagManifestation = {
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

    const { data: manifestations, error: manifestationError } = await supabase
      .from("awakener_tag_manifestation")
      .select("id, tag:tag_id(tag_name)")
      .eq("awakener_id", awakenerId)
      .is("deleted_at", null);

    if (manifestationError) {
      return { success: false, error: manifestationError.message };
    }

    const manifestationRows = manifestations ?? [];
    const manifestationIds = manifestationRows.map((row) => row.id);

    const overridesByManifestationId = new Map<
      number,
      AwakenerRelatedTagOverride[]
    >();

    if (manifestationIds.length > 0) {
      const { data: overrides, error: overrideError } = await supabase
        .from("manifestation_interaction_override")
        .select(
          "manifestation_id, modifier_tag:modifier_tag_id(tag_name), is_disabled",
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
