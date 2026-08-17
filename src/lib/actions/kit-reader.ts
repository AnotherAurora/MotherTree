"use server";

import { revalidatePath } from "next/cache";
import { resolve } from "node:path";
import {
  adminUnavailableResult,
  isAdminRuntimeEnabled,
} from "@/lib/admin-runtime";
import {
  buildKitPackForAwakener,
  writeKitPackToRepo,
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

    const { data: pendingRows, error: pendingError } = await supabase
      .from("awakener_tag_manifestation")
      .select("awakener_id")
      .eq("verified", false)
      .is("deleted_at", null);

    if (pendingError) return { success: false, error: pendingError.message };

    const pendingByAwakener = new Map<number, number>();
    for (const row of pendingRows ?? []) {
      const id = Number(row.awakener_id);
      pendingByAwakener.set(id, (pendingByAwakener.get(id) ?? 0) + 1);
    }

    return {
      success: true,
      data: (awakeners ?? []).map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        pendingCount: pendingByAwakener.get(Number(row.id)) ?? 0,
      })),
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
    target_tag_id: number | null;
    math_operation: string | null;
    value_scalar: number | null;
    is_disabled: boolean | null;
  }[];
};

export async function listPendingAtmsForAwakener(
  awakenerId: number,
): Promise<ActionResult<PendingAtmRow[]>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("awakener_tag_manifestation")
      .select(
        "id, awakener_id, tag_id, trigger_condition, metadata, replaces_manifestation_id, dependency_stat, value_scalar, instance_count, base_copies, copy_provider_group_id, is_accumulating, is_permanent, verified, required_enlightenment, required_realm, source_type, target_type, buff_target_type_restriction, tag!tag_id(tag_name)",
      )
      .eq("awakener_id", awakenerId)
      .eq("verified", false)
      .is("deleted_at", null)
      .order("id");

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
          "id, manifestation_id, mode, modifier_tag_id, target_tag_id, math_operation, value_scalar, is_disabled",
        )
        .in("manifestation_id", ids)
        .is("deleted_at", null)
        .order("id");

      if (localsError) return { success: false, error: localsError.message };

      for (const local of locals ?? []) {
        const mid = Number(local.manifestation_id);
        const list = localsByManifestation.get(mid) ?? [];
        list.push({
          id: Number(local.id),
          mode: String(local.mode),
          modifier_tag_id:
            local.modifier_tag_id == null
              ? null
              : Number(local.modifier_tag_id),
          target_tag_id:
            local.target_tag_id == null ? null : Number(local.target_tag_id),
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
        error instanceof Error ? error.message : "Failed to list pending ATMs",
    };
  }
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
    writeKitPackToRepo(resolve(process.cwd()), slug, pack);

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

export async function softDeletePendingAtm(
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
      .eq("verified", false)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) {
      return { success: false, error: "Pending ATM not found" };
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
