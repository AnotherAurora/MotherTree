"use server";

import { revalidatePath } from "next/cache";
import {
  adminUnavailableResult,
  isAdminRuntimeEnabled,
} from "@/lib/admin-runtime";
import {
  buildKitPackForAwakener,
  writeKitPackToSampleData,
} from "@/lib/kit-reader/build-kit-pack";
import { buildKitReaderCursorPrompt } from "@/lib/kit-reader/cursor-prompt";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function nowIso(): string {
  return new Date().toISOString();
}

export type KitReaderAwakenerOption = {
  id: number;
  name: string;
  pendingCount: number;
  verifiedCount: number;
  totalCount: number;
};

export async function listKitReaderAwakeners(): Promise<
  ActionResult<KitReaderAwakenerOption[]>
> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();

  try {
    const supabase = createAdminClient();
    const { data: awakeners, error } = await supabase
      .from("awakener")
      .select("id, name")
      .is("deleted_at", null)
      .order("name");

    if (error) return { success: false, error: error.message };

    const { data: atmRows, error: atmError } = await supabase
      .from("awakener_tag_manifestation")
      .select("awakener_id, verified")
      .is("deleted_at", null);

    if (atmError) return { success: false, error: atmError.message };

    const pendingByAwakener = new Map<number, number>();
    const verifiedByAwakener = new Map<number, number>();

    for (const row of atmRows ?? []) {
      const id = Number(row.awakener_id);
      if (row.verified) {
        verifiedByAwakener.set(id, (verifiedByAwakener.get(id) ?? 0) + 1);
      } else {
        pendingByAwakener.set(id, (pendingByAwakener.get(id) ?? 0) + 1);
      }
    }

    return {
      success: true,
      data: (awakeners ?? []).map((row) => {
        const id = Number(row.id);
        const pendingCount = pendingByAwakener.get(id) ?? 0;
        const verifiedCount = verifiedByAwakener.get(id) ?? 0;
        return {
          id,
          name: String(row.name),
          pendingCount,
          verifiedCount,
          totalCount: pendingCount + verifiedCount,
        };
      }),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list awakeners",
    };
  }
}

export type PendingAtmRow = {
  id: number;
  awakener_id: number;
  tag_id: number;
  tag_name: string | null;
  trigger_condition: number | null;
  metadata: string | null;
  replaces_manifestation_id: number | null;
  dependency_stat: string | null;
  value_scalar: number | null;
  instance_count: number;
  base_copies: number;
  copy_provider_group_id: number | null;
  is_accumulating: boolean;
  is_permanent: boolean | null;
  verified: boolean;
  required_enlightenment: number | null;
  required_realm: number | null;
  source_type: string | null;
  target_type: string | null;
  buff_target_type_restriction: string | null;
  locals: {
    id: number;
    mode: string;
    modifier_tag_id: number | null;
    modifier_tag_name: string | null;
    target_tag_id: number | null;
    target_tag_name: string | null;
    math_operation: string | null;
    value_scalar: number | null;
    is_disabled: boolean | null;
  }[];
};

export type KitReaderAtmMode = "pending" | "verified" | "all";

export async function listAtmsForAwakener(
  awakenerId: number,
  mode: KitReaderAtmMode = "pending",
): Promise<ActionResult<PendingAtmRow[]>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();

  try {
    const supabase = createAdminClient();
    let query = supabase
      .from("awakener_tag_manifestation")
      .select(
        "id, awakener_id, tag_id, trigger_condition, metadata, replaces_manifestation_id, dependency_stat, value_scalar, instance_count, base_copies, copy_provider_group_id, is_accumulating, is_permanent, verified, required_enlightenment, required_realm, source_type, target_type, buff_target_type_restriction, tag!tag_id(tag_name)",
      )
      .eq("awakener_id", awakenerId)
      .is("deleted_at", null);

    if (mode === "pending") {
      query = query.eq("verified", false);
    } else if (mode === "verified") {
      query = query.eq("verified", true);
    }

    const { data, error } = await query.order("id");

    if (error) return { success: false, error: error.message };

    const rows = data ?? [];
    const ids = rows.map((row) => Number(row.id));
    const localsByManifestation = new Map<
      number,
      PendingAtmRow["locals"]
    >();

    if (ids.length > 0) {
      const { data: locals, error: localsError } = await supabase
        .from("awakener_local_manifestation_interaction")
        .select(
          "id, manifestation_id, mode, modifier_tag_id, target_tag_id, math_operation, value_scalar, is_disabled, modifier_tag:tag!modifier_tag_id(tag_name), target_tag:tag!target_tag_id(tag_name)",
        )
        .in("manifestation_id", ids)
        .is("deleted_at", null)
        .order("id");

      if (localsError) return { success: false, error: localsError.message };

      for (const local of locals ?? []) {
        const mid = Number(local.manifestation_id);
        const modifierTag = local.modifier_tag as { tag_name?: string } | null;
        const targetTag = local.target_tag as { tag_name?: string } | null;
        const list = localsByManifestation.get(mid) ?? [];
        list.push({
          id: Number(local.id),
          mode: String(local.mode),
          modifier_tag_id:
            local.modifier_tag_id == null
              ? null
              : Number(local.modifier_tag_id),
          modifier_tag_name: modifierTag?.tag_name ?? null,
          target_tag_id:
            local.target_tag_id == null ? null : Number(local.target_tag_id),
          target_tag_name: targetTag?.tag_name ?? null,
          math_operation: local.math_operation,
          value_scalar: local.value_scalar,
          is_disabled: local.is_disabled,
        });
        localsByManifestation.set(mid, list);
      }
    }

    return {
      success: true,
      data: rows.map((row) => {
        const tag = row.tag as { tag_name?: string } | null;
        return {
          id: Number(row.id),
          awakener_id: Number(row.awakener_id),
          tag_id: Number(row.tag_id),
          tag_name: tag?.tag_name ?? null,
          trigger_condition:
            row.trigger_condition == null
              ? null
              : Number(row.trigger_condition),
          metadata: row.metadata,
          replaces_manifestation_id:
            row.replaces_manifestation_id == null
              ? null
              : Number(row.replaces_manifestation_id),
          dependency_stat: row.dependency_stat,
          value_scalar: row.value_scalar,
          instance_count: Number(row.instance_count),
          base_copies: Number(row.base_copies),
          copy_provider_group_id:
            row.copy_provider_group_id == null
              ? null
              : Number(row.copy_provider_group_id),
          is_accumulating: Boolean(row.is_accumulating),
          is_permanent: row.is_permanent,
          verified: Boolean(row.verified),
          required_enlightenment: row.required_enlightenment,
          required_realm:
            row.required_realm == null ? null : Number(row.required_realm),
          source_type: row.source_type,
          target_type: row.target_type,
          buff_target_type_restriction: row.buff_target_type_restriction,
          locals: localsByManifestation.get(Number(row.id)) ?? [],
        };
      }),
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to list ATMs",
    };
  }
}

export async function listPendingAtmsForAwakener(
  awakenerId: number,
): Promise<ActionResult<PendingAtmRow[]>> {
  return listAtmsForAwakener(awakenerId, "pending");
}

export async function exportKitPackAndPrompt(
  awakenerId: number,
): Promise<
  ActionResult<{
    relativePath: string;
    slug: string;
    awakenerName: string;
    prompt: string;
    pendingCount: number;
  }>
> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();

  try {
    const supabase = createAdminClient();

    const { count, error: pendingError } = await supabase
      .from("awakener_tag_manifestation")
      .select("id", { count: "exact", head: true })
      .eq("awakener_id", awakenerId)
      .eq("verified", false)
      .is("deleted_at", null);

    if (pendingError) return { success: false, error: pendingError.message };
    const pendingCount = count ?? 0;
    if (pendingCount > 0) {
      return {
        success: false,
        error: `This awakener has ${pendingCount} pending ATM(s). Verify or soft-delete them before exporting a new kit pack.`,
      };
    }

    const { pack, slug, relativePath } = await buildKitPackForAwakener(
      supabase,
      awakenerId,
    );
    writeKitPackToSampleData(slug, pack);

    const prompt = buildKitReaderCursorPrompt({
      awakenerName: pack.awakener.name,
      slug,
      skeydbCommit: pack.awakener.skeydbCommit,
    });

    return {
      success: true,
      data: {
        relativePath,
        slug,
        awakenerName: pack.awakener.name,
        prompt,
        pendingCount: 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to export kit pack",
    };
  }
}

export async function verifyPendingAtm(
  manifestationId: number,
): Promise<ActionResult<{ id: number }>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("awakener_tag_manifestation")
      .update({ verified: true, updated_at: nowIso() } as never)
      .eq("id", manifestationId)
      .eq("verified", false)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) {
      return {
        success: false,
        error: "Pending ATM not found (already verified or deleted)",
      };
    }

    revalidatePath("/kit-reader");
    revalidatePath("/tables/awakener_tag_manifestation");
    return { success: true, data: { id: Number(data.id) } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to verify ATM",
    };
  }
}

export async function unverifyAtm(
  manifestationId: number,
): Promise<ActionResult<{ id: number }>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("awakener_tag_manifestation")
      .update({ verified: false, updated_at: nowIso() } as never)
      .eq("id", manifestationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) {
      return {
        success: false,
        error: "ATM not found",
      };
    }

    revalidatePath("/kit-reader");
    revalidatePath("/tables/awakener_tag_manifestation");
    return { success: true, data: { id: Number(data.id) } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to unverify ATM",
    };
  }
}

export async function verifyAllPendingForAwakener(
  awakenerId: number,
): Promise<ActionResult<{ count: number }>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("awakener_tag_manifestation")
      .update({ verified: true, updated_at: nowIso() } as never)
      .eq("awakener_id", awakenerId)
      .eq("verified", false)
      .is("deleted_at", null)
      .select("id");

    if (error) return { success: false, error: error.message };

    revalidatePath("/kit-reader");
    revalidatePath("/tables/awakener_tag_manifestation");
    return { success: true, data: { count: (data ?? []).length } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to verify pending ATMs",
    };
  }
}

export async function softDeleteAtm(
  manifestationId: number,
): Promise<ActionResult<{ id: number }>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();

  try {
    const supabase = createAdminClient();
    const stamp = nowIso();

    const { data, error } = await supabase
      .from("awakener_tag_manifestation")
      .update({ deleted_at: stamp, updated_at: stamp } as never)
      .eq("id", manifestationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) {
      return { success: false, error: "ATM not found" };
    }

    await supabase
      .from("awakener_local_manifestation_interaction")
      .update({ deleted_at: stamp, updated_at: stamp } as never)
      .eq("manifestation_id", manifestationId)
      .is("deleted_at", null);

    revalidatePath("/kit-reader");
    revalidatePath("/tables/awakener_tag_manifestation");
    return { success: true, data: { id: Number(data.id) } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to soft-delete ATM",
    };
  }
}

export async function softDeletePendingAtm(
  manifestationId: number,
): Promise<ActionResult<{ id: number }>> {
  return softDeleteAtm(manifestationId);
}

export async function getAwakenerNotes(
  awakenerId: number,
): Promise<ActionResult<{ notes: string | null }>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("awakener")
      .select("notes")
      .eq("id", awakenerId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, data: { notes: data?.notes ?? null } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load awakener notes",
    };
  }
}

export async function saveAwakenerNotes(
  awakenerId: number,
  notes: string | null,
): Promise<ActionResult<{ notes: string | null }>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("awakener")
      .update({ notes: notes || null, updated_at: nowIso() } as never)
      .eq("id", awakenerId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    revalidatePath("/kit-reader");
    return { success: true, data: { notes: notes || null } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save awakener notes",
    };
  }
}
