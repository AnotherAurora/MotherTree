"use server";

import { revalidatePath } from "next/cache";
import type { TableName } from "@/lib/database.types";
import {
  TABLE_CONFIG_MAP,
  isValidTableName,
  type TableConfig,
} from "@/lib/schema-config";
import {
  adminUnavailableResult,
  isAdminRuntimeEnabled,
} from "@/lib/admin-runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type ForeignKeyOption = {
  value: number;
  label: string;
  filterValue?: number;
  /** When set with assetKind, resolve icon from this instead of label. */
  assetName?: string;
  /** When set, shown next to the icon instead of label (label still used for search). */
  shortLabel?: string;
};

export type AwakenerLocalManifestationInteractionInput = {
  id?: number;
  mode: string;
  modifier_tag_id: number | null;
  target_tag_id: number | null;
  layer: string | null;
  math_operation: string | null;
  value_scalar: number | null;
  target_type: string;
  dependency_stat: string | null;
  is_disabled: boolean;
};

/** @deprecated Use AwakenerLocalManifestationInteractionInput */
export type InteractionOverrideInput = AwakenerLocalManifestationInteractionInput;

export type AnchoredAwakenerInput = {
  id?: number;
  awakener_id: number | null;
  is_damage_dealer: boolean;
};

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function revalidateTable(tableName: TableName) {
  revalidatePath(`/tables/${tableName}`);
  revalidatePath("/");
}

function getConfig(tableName: string): TableConfig | null {
  if (!isValidTableName(tableName)) return null;
  return TABLE_CONFIG_MAP[tableName];
}

function nowIso() {
  return new Date().toISOString();
}

function mapDbError(
  config: TableConfig,
  error: { code?: string; message: string },
): string {
  if (error.code === "23505" && config.uniqueConstraints?.length) {
    const match = config.uniqueConstraints.find((constraint) => constraint.message);
    return match?.message ?? "Duplicate record";
  }

  return error.message;
}

async function assertUniqueConstraints(
  supabase: SupabaseClient<Database>,
  config: TableConfig,
  payload: Record<string, unknown>,
  excludeId?: number,
): Promise<ActionResult> {
  if (!config.uniqueConstraints?.length) {
    return { success: true, data: undefined };
  }

  for (const constraint of config.uniqueConstraints) {
    let query = supabase.from(config.name).select("id");

    for (const field of constraint.fields) {
      const value = payload[field];
      if (value == null) {
        query = query.is(field, null);
      } else {
        query = query.eq(field, value);
      }
    }

    if (constraint.ignoreDeleted) {
      query = query.is("deleted_at", null);
    }

    if (excludeId != null) {
      query = query.neq("id", excludeId);
    }

    const { data, error } = await query.limit(1);
    if (error) return { success: false, error: error.message };
    if (data && data.length > 0) {
      return {
        success: false,
        error: constraint.message ?? "Duplicate record",
      };
    }
  }

  return { success: true, data: undefined };
}

async function buildManifestationLabels(
  ids: number[],
): Promise<Map<number, string>> {
  const labels = new Map<number, string>();
  if (ids.length === 0) return labels;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("awakener_tag_manifestation")
    .select(
      "id, awakener!awakener_id(name), tag!tag_id(tag_name)",
    )
    .in("id", ids);

  if (error || !data) return labels;

  for (const row of data) {
    const awakener = row.awakener as { name: string | null } | null;
    const tag = row.tag as { tag_name: string | null } | null;
    const awakenerName = awakener?.name ?? "Unknown Awakener";
    const tagName = tag?.tag_name ?? "Unknown Tag";
    labels.set(row.id, `${awakenerName} · ${tagName} (#${row.id})`);
  }

  return labels;
}

async function attachManifestationOverrideCounts(
  supabase: SupabaseClient<Database>,
  records: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const ids = records
    .map((record) => Number(record.id))
    .filter((id) => !Number.isNaN(id));

  if (ids.length === 0) {
    return records.map((record) => ({ ...record, override_count: 0 }));
  }

  const { data, error } = await supabase
    .from("awakener_local_manifestation_interaction")
    .select("manifestation_id")
    .in("manifestation_id", ids)
    .is("deleted_at", null);

  if (error) throw error;

  const counts = new Map<number, number>();
  for (const row of data ?? []) {
    if (row.manifestation_id == null) continue;
    const manifestationId = Number(row.manifestation_id);
    counts.set(manifestationId, (counts.get(manifestationId) ?? 0) + 1);
  }

  return records.map((record) => ({
    ...record,
    override_count: counts.get(Number(record.id)) ?? 0,
  }));
}

async function attachDesireAnchoredAwakenerCounts(
  supabase: SupabaseClient<Database>,
  records: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const ids = records
    .map((record) => Number(record.id))
    .filter((id) => !Number.isNaN(id));

  if (ids.length === 0) {
    return records.map((record) => ({ ...record, anchored_awakener_count: 0 }));
  }

  const { data, error } = await supabase
    .from("desire_anchored_awakener")
    .select("desire_id")
    .in("desire_id", ids)
    .is("deleted_at", null);

  if (error) throw error;

  const counts = new Map<number, number>();
  for (const row of data ?? []) {
    const desireId = Number(row.desire_id);
    counts.set(desireId, (counts.get(desireId) ?? 0) + 1);
  }

  return records.map((record) => ({
    ...record,
    anchored_awakener_count: counts.get(Number(record.id)) ?? 0,
  }));
}

export async function listRecords(
  tableName: string,
  deletedOnly = false,
): Promise<ActionResult<Record<string, unknown>[]>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();
  const config = getConfig(tableName);
  if (!config) return { success: false, error: "Unknown table" };

  try {
    const supabase = createAdminClient();
    let query = supabase.from(config.name).select("*");
    if (config.defaultListSort) {
      query = query.order(config.defaultListSort.field, {
        ascending: config.defaultListSort.direction === "asc",
      });
    } else {
      query = query.order("id");
    }

    if (config.softDelete) {
      query = deletedOnly
        ? query.not("deleted_at", "is", null)
        : query.is("deleted_at", null);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    let records = (data ?? []) as Record<string, unknown>[];

    if (config.name === "awakener_tag_manifestation") {
      records = await attachManifestationOverrideCounts(supabase, records);
    }

    if (config.name === "desire") {
      records = await attachDesireAnchoredAwakenerCounts(supabase, records);
    }

    return { success: true, data: records };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list records",
    };
  }
}

export async function getForeignKeyOptions(
  tableName: string,
  displayColumn: string,
  labelKind?: "manifestation",
  filterColumn?: string,
): Promise<ActionResult<ForeignKeyOption[]>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();
  const config = getConfig(tableName);
  if (!config) return { success: false, error: "Unknown parent table" };

  try {
    const supabase = createAdminClient();
    let query = supabase.from(config.name).select("*").order("id");

    if (config.softDelete) {
      query = query.is("deleted_at", null);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    const rows = (data ?? []) as Record<string, unknown>[];

    let options: ForeignKeyOption[];

    if (labelKind === "manifestation") {
      const ids = rows.map((row) => Number(row.id));
      const labels = await buildManifestationLabels(ids);
      options = rows.map((row) => ({
        value: Number(row.id),
        label: labels.get(Number(row.id)) ?? `#${row.id}`,
        ...(filterColumn
          ? { filterValue: Number(row[filterColumn]) }
          : {}),
      }));
    } else {
      options = rows.map((row) => {
        const display = row[displayColumn];
        const id = Number(row.id);
        const label =
          display != null && String(display).trim() !== ""
            ? filterColumn
              ? String(display)
              : `${String(display)} (#${id})`
            : `#${id}`;
        return {
          value: id,
          label,
          ...(filterColumn
            ? { filterValue: Number(row[filterColumn]) }
            : {}),
        };
      });
    }

    options.sort((a, b) => a.label.localeCompare(b.label));

    return { success: true, data: options };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to load related records",
    };
  }
}

export async function createRecord(
  tableName: string,
  payload: Record<string, unknown>,
): Promise<ActionResult<Record<string, unknown>>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();
  const config = getConfig(tableName);
  if (!config) return { success: false, error: "Unknown table" };

  try {
    const supabase = createAdminClient();
    const record: Record<string, unknown> = { ...payload };
    delete record.id;

    if (config.fields.some((field) => field.name === "created_at")) {
      record.created_at = nowIso();
    }
    if (config.fields.some((field) => field.name === "updated_at")) {
      record.updated_at = nowIso();
    }

    for (const field of config.fields) {
      if (
        field.defaultValue !== undefined &&
        (record[field.name] === undefined || record[field.name] === null)
      ) {
        record[field.name] = field.defaultValue;
      }
    }

    const uniqueCheck = await assertUniqueConstraints(
      supabase,
      config,
      record,
    );
    if (!uniqueCheck.success) return uniqueCheck;

    const { data, error } = await supabase
      .from(config.name)
      .insert(record as never)
      .select("*")
      .single();

    if (error) return { success: false, error: mapDbError(config, error) };

    revalidateTable(config.name);
    return { success: true, data: data as Record<string, unknown> };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create record",
    };
  }
}

export async function updateRecord(
  tableName: string,
  id: number,
  payload: Record<string, unknown>,
): Promise<ActionResult<Record<string, unknown>>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();
  const config = getConfig(tableName);
  if (!config) return { success: false, error: "Unknown table" };

  try {
    const supabase = createAdminClient();
    const record: Record<string, unknown> = { ...payload };
    delete record.id;

    if (config.fields.some((field) => field.name === "updated_at")) {
      record.updated_at = nowIso();
    }

    let constraintPayload = record;
    if (config.uniqueConstraints?.length) {
      const { data: existing, error: fetchError } = await supabase
        .from(config.name)
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) {
        return { success: false, error: fetchError.message };
      }

      constraintPayload = {
        ...(existing as Record<string, unknown>),
        ...record,
      };
    }

    const uniqueCheck = await assertUniqueConstraints(
      supabase,
      config,
      constraintPayload,
      id,
    );
    if (!uniqueCheck.success) return uniqueCheck;

    const { data, error } = await supabase
      .from(config.name)
      .update(record as never)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return { success: false, error: mapDbError(config, error) };

    revalidateTable(config.name);
    return { success: true, data: data as Record<string, unknown> };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update record",
    };
  }
}

export async function listAwakenerLocalManifestationInteractions(
  manifestationId: number,
): Promise<ActionResult<Record<string, unknown>[]>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("awakener_local_manifestation_interaction")
      .select("*")
      .eq("manifestation_id", manifestationId)
      .is("deleted_at", null)
      .order("id");

    if (error) return { success: false, error: error.message };

    return { success: true, data: (data ?? []) as Record<string, unknown>[] };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load local manifestation interactions",
    };
  }
}

/** @deprecated Use listAwakenerLocalManifestationInteractions */
export const listInteractionOverrides =
  listAwakenerLocalManifestationInteractions;

function buildOverrideRecord(
  manifestationId: number,
  override: AwakenerLocalManifestationInteractionInput,
): Record<string, unknown> {
  return {
    manifestation_id: manifestationId,
    mode: override.mode,
    modifier_tag_id: override.modifier_tag_id,
    target_tag_id: override.target_tag_id,
    layer: override.layer,
    math_operation: override.math_operation,
    value_scalar: override.value_scalar,
    target_type: override.target_type,
    dependency_stat: override.dependency_stat,
    is_disabled: override.is_disabled,
  };
}

export async function saveManifestationWithOverrides(
  payload: Record<string, unknown>,
  overrides: AwakenerLocalManifestationInteractionInput[],
  manifestationId?: number,
): Promise<ActionResult<Record<string, unknown>>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();
  const config = getConfig("awakener_tag_manifestation");
  if (!config) return { success: false, error: "Unknown table" };

  try {
    const supabase = createAdminClient();

    let savedManifestationId = manifestationId;

    if (savedManifestationId != null) {
      const record: Record<string, unknown> = { ...payload };
      delete record.id;

      if (config.fields.some((field) => field.name === "updated_at")) {
        record.updated_at = nowIso();
      }

      const uniqueCheck = await assertUniqueConstraints(
        supabase,
        config,
        record,
        savedManifestationId,
      );
      if (!uniqueCheck.success) return uniqueCheck;

      const { data, error } = await supabase
        .from("awakener_tag_manifestation")
        .update(record as never)
        .eq("id", savedManifestationId)
        .select("*")
        .single();

      if (error) return { success: false, error: mapDbError(config, error) };
      if (!data) {
        return { success: false, error: "Manifestation record not found" };
      }
    } else {
      const record: Record<string, unknown> = { ...payload };
      delete record.id;

      if (config.fields.some((field) => field.name === "created_at")) {
        record.created_at = nowIso();
      }
      if (config.fields.some((field) => field.name === "updated_at")) {
        record.updated_at = nowIso();
      }
      // Manual creates default verified; Kit Reader insert CLI forces false.
      if (record.verified == null) {
        record.verified = true;
      }

      const uniqueCheck = await assertUniqueConstraints(
        supabase,
        config,
        record,
      );
      if (!uniqueCheck.success) return uniqueCheck;

      const { data, error } = await supabase
        .from("awakener_tag_manifestation")
        .insert(record as never)
        .select("*")
        .single();

      if (error) return { success: false, error: mapDbError(config, error) };
      savedManifestationId = Number(data.id);
    }

    const overrideConfig = getConfig("awakener_local_manifestation_interaction");
    if (!overrideConfig) {
      return { success: false, error: "Unknown local interaction table" };
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("awakener_local_manifestation_interaction")
      .select("id")
      .eq("manifestation_id", savedManifestationId)
      .is("deleted_at", null);

    if (existingError) {
      return { success: false, error: existingError.message };
    }

    const existingIds = new Set(
      (existingRows ?? []).map((row) => Number(row.id)),
    );
    const submittedIds = new Set(
      overrides
        .map((override) => override.id)
        .filter((id): id is number => id != null),
    );

    for (const existingId of existingIds) {
      if (submittedIds.has(existingId)) continue;

      const { error } = await supabase
        .from("awakener_local_manifestation_interaction")
        .update({
          deleted_at: nowIso(),
          updated_at: nowIso(),
        } as never)
        .eq("id", existingId);

      if (error) return { success: false, error: error.message };
    }

    for (const override of overrides) {
      const overrideRecord = buildOverrideRecord(
        savedManifestationId,
        override,
      );

      if (override.id != null) {
        overrideRecord.updated_at = nowIso();
        const { error } = await supabase
          .from("awakener_local_manifestation_interaction")
          .update(overrideRecord as never)
          .eq("id", override.id);

        if (error) return { success: false, error: error.message };
        continue;
      }

      overrideRecord.created_at = nowIso();
      overrideRecord.updated_at = nowIso();

      const { error } = await supabase
        .from("awakener_local_manifestation_interaction")
        .insert(overrideRecord as never);

      if (error) return { success: false, error: error.message };
    }

    revalidateTable("awakener_tag_manifestation");
    revalidateTable("awakener_local_manifestation_interaction");

    const { data: manifestation, error: loadError } = await supabase
      .from("awakener_tag_manifestation")
      .select("*")
      .eq("id", savedManifestationId)
      .single();

    if (loadError) return { success: false, error: loadError.message };

    return {
      success: true,
      data: manifestation as Record<string, unknown>,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to save manifestation",
    };
  }
}

export async function listDesireAnchoredAwakeners(
  desireId: number,
): Promise<ActionResult<Record<string, unknown>[]>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("desire_anchored_awakener")
      .select("*")
      .eq("desire_id", desireId)
      .is("deleted_at", null)
      .order("id");

    if (error) return { success: false, error: error.message };

    return { success: true, data: (data ?? []) as Record<string, unknown>[] };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load anchored awakeners",
    };
  }
}

function buildAnchoredAwakenerRecord(
  desireId: number,
  anchor: AnchoredAwakenerInput,
): Record<string, unknown> {
  return {
    desire_id: desireId,
    awakener_id: anchor.awakener_id,
    is_damage_dealer: anchor.is_damage_dealer,
  };
}

export async function saveDesireWithAnchoredAwakeners(
  payload: Record<string, unknown>,
  anchors: AnchoredAwakenerInput[],
  desireId?: number,
): Promise<ActionResult<Record<string, unknown>>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();
  const config = getConfig("desire");
  if (!config) return { success: false, error: "Unknown table" };

  try {
    const supabase = createAdminClient();

    let savedDesireId = desireId;

    if (savedDesireId != null) {
      const record: Record<string, unknown> = { ...payload };
      delete record.id;

      if (config.fields.some((field) => field.name === "updated_at")) {
        record.updated_at = nowIso();
      }

      const uniqueCheck = await assertUniqueConstraints(
        supabase,
        config,
        record,
        savedDesireId,
      );
      if (!uniqueCheck.success) return uniqueCheck;

      const { data, error } = await supabase
        .from("desire")
        .update(record as never)
        .eq("id", savedDesireId)
        .select("*")
        .single();

      if (error) return { success: false, error: mapDbError(config, error) };
      if (!data) {
        return { success: false, error: "Desire record not found" };
      }
    } else {
      const record: Record<string, unknown> = { ...payload };
      delete record.id;

      if (config.fields.some((field) => field.name === "created_at")) {
        record.created_at = nowIso();
      }
      if (config.fields.some((field) => field.name === "updated_at")) {
        record.updated_at = nowIso();
      }

      const uniqueCheck = await assertUniqueConstraints(
        supabase,
        config,
        record,
      );
      if (!uniqueCheck.success) return uniqueCheck;

      const { data, error } = await supabase
        .from("desire")
        .insert(record as never)
        .select("*")
        .single();

      if (error) return { success: false, error: mapDbError(config, error) };
      savedDesireId = Number(data.id);
    }

    const anchorConfig = getConfig("desire_anchored_awakener");
    if (!anchorConfig) {
      return { success: false, error: "Unknown anchored awakener table" };
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("desire_anchored_awakener")
      .select("id")
      .eq("desire_id", savedDesireId)
      .is("deleted_at", null);

    if (existingError) {
      return { success: false, error: existingError.message };
    }

    const existingIds = new Set(
      (existingRows ?? []).map((row) => Number(row.id)),
    );
    const submittedIds = new Set(
      anchors
        .map((anchor) => anchor.id)
        .filter((id): id is number => id != null),
    );

    for (const existingId of existingIds) {
      if (submittedIds.has(existingId)) continue;

      const { error } = await supabase
        .from("desire_anchored_awakener")
        .update({
          deleted_at: nowIso(),
          updated_at: nowIso(),
        } as never)
        .eq("id", existingId);

      if (error) return { success: false, error: error.message };
    }

    for (const anchor of anchors) {
      const anchorRecord = buildAnchoredAwakenerRecord(savedDesireId, anchor);

      if (anchor.id != null) {
        anchorRecord.updated_at = nowIso();
        const { error } = await supabase
          .from("desire_anchored_awakener")
          .update(anchorRecord as never)
          .eq("id", anchor.id);

        if (error) return { success: false, error: error.message };
        continue;
      }

      anchorRecord.created_at = nowIso();
      anchorRecord.updated_at = nowIso();

      const { error } = await supabase
        .from("desire_anchored_awakener")
        .insert(anchorRecord as never);

      if (error) return { success: false, error: error.message };
    }

    revalidateTable("desire");
    revalidateTable("desire_anchored_awakener");

    const { data: desire, error: loadError } = await supabase
      .from("desire")
      .select("*")
      .eq("id", savedDesireId)
      .single();

    if (loadError) return { success: false, error: loadError.message };

    return {
      success: true,
      data: desire as Record<string, unknown>,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to save desire",
    };
  }
}

export type CopyProviderGroupMemberInput = {
  id?: number;
  tag_id: number | null;
};

export async function listCopyProviderGroupMembers(
  groupId: number,
): Promise<ActionResult<Record<string, unknown>[]>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("copy_provider_group_member")
      .select("*")
      .eq("group_id", groupId)
      .is("deleted_at", null)
      .order("id");

    if (error) return { success: false, error: error.message };

    return { success: true, data: (data ?? []) as Record<string, unknown>[] };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load copy provider group members",
    };
  }
}

function buildCopyProviderMemberRecord(
  groupId: number,
  member: CopyProviderGroupMemberInput,
): Record<string, unknown> {
  return {
    group_id: groupId,
    tag_id: member.tag_id,
  };
}

export async function saveCopyProviderGroupWithMembers(
  payload: Record<string, unknown>,
  members: CopyProviderGroupMemberInput[],
  groupId?: number,
): Promise<ActionResult<Record<string, unknown>>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();
  const config = getConfig("copy_provider_group");
  if (!config) return { success: false, error: "Unknown table" };

  try {
    const supabase = createAdminClient();

    let savedGroupId = groupId;

    if (savedGroupId != null) {
      const record: Record<string, unknown> = { ...payload };
      delete record.id;

      if (config.fields.some((field) => field.name === "updated_at")) {
        record.updated_at = nowIso();
      }

      const uniqueCheck = await assertUniqueConstraints(
        supabase,
        config,
        record,
        savedGroupId,
      );
      if (!uniqueCheck.success) return uniqueCheck;

      const { data, error } = await supabase
        .from("copy_provider_group")
        .update(record as never)
        .eq("id", savedGroupId)
        .select("*")
        .single();

      if (error) return { success: false, error: mapDbError(config, error) };
      if (!data) {
        return { success: false, error: "Copy provider group not found" };
      }
    } else {
      const record: Record<string, unknown> = { ...payload };
      delete record.id;

      if (config.fields.some((field) => field.name === "created_at")) {
        record.created_at = nowIso();
      }
      if (config.fields.some((field) => field.name === "updated_at")) {
        record.updated_at = nowIso();
      }

      const uniqueCheck = await assertUniqueConstraints(
        supabase,
        config,
        record,
      );
      if (!uniqueCheck.success) return uniqueCheck;

      const { data, error } = await supabase
        .from("copy_provider_group")
        .insert(record as never)
        .select("*")
        .single();

      if (error) return { success: false, error: mapDbError(config, error) };
      savedGroupId = Number(data.id);
    }

    const memberConfig = getConfig("copy_provider_group_member");
    if (!memberConfig) {
      return { success: false, error: "Unknown copy provider group member table" };
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("copy_provider_group_member")
      .select("id")
      .eq("group_id", savedGroupId)
      .is("deleted_at", null);

    if (existingError) {
      return { success: false, error: existingError.message };
    }

    const existingIds = new Set(
      (existingRows ?? []).map((row) => Number(row.id)),
    );
    const submittedIds = new Set(
      members
        .map((member) => member.id)
        .filter((id): id is number => id != null),
    );

    for (const existingId of existingIds) {
      if (submittedIds.has(existingId)) continue;

      const { error } = await supabase
        .from("copy_provider_group_member")
        .update({
          deleted_at: nowIso(),
          updated_at: nowIso(),
        } as never)
        .eq("id", existingId);

      if (error) return { success: false, error: error.message };
    }

    for (const member of members) {
      if (member.tag_id == null) {
        return { success: false, error: "Each member needs a tag" };
      }
      const memberRecord = buildCopyProviderMemberRecord(savedGroupId, member);

      if (member.id != null) {
        memberRecord.updated_at = nowIso();
        const uniqueCheck = await assertUniqueConstraints(
          supabase,
          memberConfig,
          memberRecord,
          member.id,
        );
        if (!uniqueCheck.success) return uniqueCheck;

        const { error } = await supabase
          .from("copy_provider_group_member")
          .update(memberRecord as never)
          .eq("id", member.id);

        if (error) {
          return { success: false, error: mapDbError(memberConfig, error) };
        }
      } else {
        memberRecord.created_at = nowIso();
        memberRecord.updated_at = nowIso();
        const uniqueCheck = await assertUniqueConstraints(
          supabase,
          memberConfig,
          memberRecord,
        );
        if (!uniqueCheck.success) return uniqueCheck;

        const { error } = await supabase
          .from("copy_provider_group_member")
          .insert(memberRecord as never);

        if (error) {
          return { success: false, error: mapDbError(memberConfig, error) };
        }
      }
    }

    revalidateTable("copy_provider_group");
    revalidateTable("copy_provider_group_member");

    const { data: group, error: loadError } = await supabase
      .from("copy_provider_group")
      .select("*")
      .eq("id", savedGroupId)
      .single();

    if (loadError) return { success: false, error: loadError.message };

    return {
      success: true,
      data: group as Record<string, unknown>,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to save copy provider group",
    };
  }
}

export async function softDeleteRecord(
  tableName: string,
  id: number,
): Promise<ActionResult> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();
  const config = getConfig(tableName);
  if (!config) return { success: false, error: "Unknown table" };

  try {
    const supabase = createAdminClient();

    if (config.softDelete) {
      const { error } = await supabase
        .from(config.name)
        .update({
          deleted_at: nowIso(),
          updated_at: nowIso(),
        } as never)
        .eq("id", id);

      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await supabase
        .from(config.name)
        .delete()
        .eq("id", id);

      if (error) return { success: false, error: error.message };
    }

    revalidateTable(config.name);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete record",
    };
  }
}

export async function restoreRecord(
  tableName: string,
  id: number,
): Promise<ActionResult> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();
  const config = getConfig(tableName);
  if (!config) return { success: false, error: "Unknown table" };
  if (!config.softDelete) {
    return { success: false, error: "This table does not support soft delete" };
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from(config.name)
      .update({
        deleted_at: null,
        updated_at: nowIso(),
      } as never)
      .eq("id", id)
      .not("deleted_at", "is", null);

    if (error) return { success: false, error: error.message };

    revalidateTable(config.name);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to restore record",
    };
  }
}

export async function permanentDeleteRecord(
  tableName: string,
  id: number,
): Promise<ActionResult> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();
  const config = getConfig(tableName);
  if (!config) return { success: false, error: "Unknown table" };

  try {
    const supabase = createAdminClient();
    let query = supabase.from(config.name).delete().eq("id", id);

    if (config.softDelete) {
      query = query.not("deleted_at", "is", null);
    }

    const { error } = await query;
    if (error) return { success: false, error: error.message };

    revalidateTable(config.name);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to permanently delete record",
    };
  }
}

export async function resolveForeignKeyLabels(
  tableName: string,
  records: Record<string, unknown>[],
): Promise<ActionResult<Record<string, string>>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();
  const config = getConfig(tableName);
  if (!config) return { success: false, error: "Unknown table" };

  const fkFields = config.fields.filter(
    (field) => field.type === "foreignKey" && field.foreignKey,
  );

  const labelMap: Record<string, string> = {};

  try {
    for (const field of fkFields) {
      const fk = field.foreignKey!;
      const ids = [
        ...new Set(
          records
            .map((record) => record[field.name])
            .filter((value) => value != null)
            .map((value) => Number(value)),
        ),
      ];

      if (ids.length === 0) continue;

      if (fk.labelKind === "manifestation") {
        const labels = await buildManifestationLabels(ids);
        for (const [id, label] of labels) {
          labelMap[`${field.name}:${id}`] = label;
        }
        continue;
      }

      const parentConfig = TABLE_CONFIG_MAP[fk.table];
      const supabase = createAdminClient();
      let query = supabase
        .from(fk.table)
        .select(`id, ${fk.displayColumn}`)
        .in("id", ids);

      if (parentConfig.softDelete) {
        query = query.is("deleted_at", null);
      }

      const { data, error } = await query;
      if (error) return { success: false, error: error.message };

      for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
        const display = row[fk.displayColumn];
        const id = Number(row.id);
        labelMap[`${field.name}:${id}`] =
          display != null && String(display).trim() !== ""
            ? String(display)
            : `#${id}`;
      }
    }

    return { success: true, data: labelMap };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to resolve labels",
    };
  }
}
