"use server";

import type { ActionResult, ForeignKeyOption } from "@/lib/actions/crud";
import { createAdminClient } from "@/lib/supabase/admin";

export type AwakenerRelatedTags = {
  manifestationTags: string[];
  overrideTags: string[];
};

export type SimulatorAwakenerOption = ForeignKeyOption & {
  realm: string | null;
};

function uniqueSortedTagNames(names: Iterable<string | null | undefined>): string[] {
  const unique = new Set<string>();
  for (const name of names) {
    if (name) unique.add(name);
  }
  return [...unique].sort((a, b) => a.localeCompare(b));
}

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

    const manifestationIds: number[] = [];
    const manifestationTagNames: string[] = [];

    for (const row of manifestations ?? []) {
      manifestationIds.push(row.id);
      const tag = row.tag as { tag_name: string | null } | null;
      if (tag?.tag_name) manifestationTagNames.push(tag.tag_name);
    }

    const overrideTagNames: string[] = [];

    if (manifestationIds.length > 0) {
      const { data: overrides, error: overrideError } = await supabase
        .from("manifestation_interaction_override")
        .select("modifier_tag:modifier_tag_id(tag_name), is_disabled")
        .in("manifestation_id", manifestationIds)
        .is("deleted_at", null);

      if (overrideError) {
        return { success: false, error: overrideError.message };
      }

      for (const row of overrides ?? []) {
        if (row.is_disabled === true) continue;
        const tag = row.modifier_tag as { tag_name: string | null } | null;
        if (tag?.tag_name) overrideTagNames.push(tag.tag_name);
      }
    }

    return {
      success: true,
      data: {
        manifestationTags: uniqueSortedTagNames(manifestationTagNames),
        overrideTags: uniqueSortedTagNames(overrideTagNames),
      },
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
