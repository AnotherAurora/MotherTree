"use server";

import { revalidatePath } from "next/cache";
import type { TableName } from "@/lib/database.types";
import {
  TABLE_CONFIG_MAP,
  isValidTableName,
  type TableConfig,
} from "@/lib/schema-config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type ForeignKeyOption = {
  value: number;
  label: string;
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
      "id, awakener:awakener_id(name), tag:tag_id(tag_name)",
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

export async function listRecords(
  tableName: string,
  includeDeleted = false,
): Promise<ActionResult<Record<string, unknown>[]>> {
  const config = getConfig(tableName);
  if (!config) return { success: false, error: "Unknown table" };

  try {
    const supabase = createAdminClient();
    let query = supabase.from(config.name).select("*").order("id");

    if (config.softDelete && !includeDeleted) {
      query = query.is("deleted_at", null);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, data: (data ?? []) as Record<string, unknown>[] };
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
): Promise<ActionResult<ForeignKeyOption[]>> {
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

    if (labelKind === "manifestation") {
      const ids = rows.map((row) => Number(row.id));
      const labels = await buildManifestationLabels(ids);
      return {
        success: true,
        data: rows.map((row) => ({
          value: Number(row.id),
          label: labels.get(Number(row.id)) ?? `#${row.id}`,
        })),
      };
    }

    return {
      success: true,
      data: rows.map((row) => {
        const display = row[displayColumn];
        const id = Number(row.id);
        const label =
          display != null && String(display).trim() !== ""
            ? `${String(display)} (#${id})`
            : `#${id}`;
        return { value: id, label };
      }),
    };
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
  const config = getConfig(tableName);
  if (!config) return { success: false, error: "Unknown table" };

  try {
    const supabase = createAdminClient();
    const record: Record<string, unknown> = { ...payload };
    delete record.id;

    if (config.fields.some((field) => field.name === "updated_at")) {
      record.updated_at = nowIso();
    }

    const uniqueCheck = await assertUniqueConstraints(
      supabase,
      config,
      record,
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

export async function softDeleteRecord(
  tableName: string,
  id: number,
): Promise<ActionResult> {
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

export async function resolveForeignKeyLabels(
  tableName: string,
  records: Record<string, unknown>[],
): Promise<ActionResult<Record<string, string>>> {
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
