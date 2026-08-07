import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  PUBLIC_ROW_LIMIT,
  isPublicReadTable,
  publicSelectClause,
  type PublicReadTable,
  type PublicRow,
} from "@/lib/public-read/allowlist";
import { createAnonClient } from "@/lib/supabase/anon";

export type PublicReadResult<T extends PublicReadTable> =
  | { success: true; data: PublicRow<T>[]; truncated: boolean }
  | { success: false; error: string };

export type PublicReadOptions = {
  /** Cap rows returned (hard max: PUBLIC_ROW_LIMIT). */
  limit?: number;
  /** Optional client (defaults to anon). Used by smoke tests. */
  client?: SupabaseClient<Database>;
};

/**
 * Allowlisted SELECT via anon + RLS. Projects non-timestamp columns only.
 * Soft-deleted rows are excluded by RLS (`deleted_at IS NULL`).
 */
export async function fetchPublicTable<T extends PublicReadTable>(
  table: T,
  options: PublicReadOptions = {},
): Promise<PublicReadResult<T>> {
  if (!isPublicReadTable(table)) {
    return { success: false, error: `Table "${table}" is not publicly readable` };
  }

  const requested = options.limit ?? PUBLIC_ROW_LIMIT;
  if (!Number.isFinite(requested) || requested < 1) {
    return { success: false, error: "limit must be a positive number" };
  }
  const limit = Math.min(Math.floor(requested), PUBLIC_ROW_LIMIT);

  const supabase = options.client ?? createAnonClient();
  const select = publicSelectClause(table);

  // Fetch one extra row to detect truncation without a separate count query.
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .limit(limit + 1);

  if (error) {
    return { success: false, error: error.message };
  }

  const rows = (data ?? []) as unknown as PublicRow<T>[];
  const truncated = rows.length > limit;
  return {
    success: true,
    data: truncated ? rows.slice(0, limit) : rows,
    truncated,
  };
}
