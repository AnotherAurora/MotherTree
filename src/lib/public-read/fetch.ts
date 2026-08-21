import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  PUBLIC_BULK_MAX_ROWS,
  PUBLIC_FETCH_PAGE_SIZE,
  PUBLIC_ROW_LIMIT,
  isPublicReadTable,
  publicSelectClause,
  type PublicReadTable,
  type PublicRow,
} from "@/lib/public-read/allowlist";
import {
  PUBLIC_READ_CACHE_TTL_MS,
  getPublicReadCacheEntry,
  publicReadCacheKey,
  publicReadCacheKeyAll,
  setPublicReadCacheEntry,
} from "@/lib/public-read/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { paginateQuery } from "@/lib/supabase/paginate-query";

export { PUBLIC_READ_CACHE_TTL_MS };

export type PublicReadResult<T extends PublicReadTable> =
  | { success: true; data: PublicRow<T>[]; truncated: boolean }
  | { success: false; error: string };

export type PublicReadOptions = {
  /** Cap rows returned (hard max: PUBLIC_ROW_LIMIT). */
  limit?: number;
  /** Optional client (defaults to anon). Used by smoke tests. */
  client?: SupabaseClient<Database>;
};

export type PublicReadAllOptions = {
  /** Optional client (defaults to anon). Used by smoke tests. */
  client?: SupabaseClient<Database>;
};

/**
 * Allowlisted SELECT via anon + RLS. Projects non-timestamp columns only.
 * Soft-deleted rows are excluded by RLS (`deleted_at IS NULL`).
 * Successful reads are cached in-process for 5 minutes (`PUBLIC_READ_CACHE_TTL_MS`).
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
  const key = publicReadCacheKey(table, limit);

  const cached = getPublicReadCacheEntry(key);
  if (cached) {
    return {
      success: true,
      data: cached.data as PublicRow<T>[],
      truncated: cached.truncated,
    };
  }

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
  const result = {
    success: true as const,
    data: truncated ? rows.slice(0, limit) : rows,
    truncated,
  };

  setPublicReadCacheEntry(key, {
    data: result.data,
    truncated: result.truncated,
  });

  return result;
}

/**
 * Paginated fetch-all for Search catalog loads. Stays within PostgREST page size
 * per request; `truncated` means the safety cap (`PUBLIC_BULK_MAX_ROWS`) was hit.
 */
export async function fetchAllPublicTable<T extends PublicReadTable>(
  table: T,
  options: PublicReadAllOptions = {},
): Promise<PublicReadResult<T>> {
  if (!isPublicReadTable(table)) {
    return { success: false, error: `Table "${table}" is not publicly readable` };
  }

  const key = publicReadCacheKeyAll(table);
  const cached = getPublicReadCacheEntry(key);
  if (cached) {
    return {
      success: true,
      data: cached.data as PublicRow<T>[],
      truncated: cached.truncated,
    };
  }

  const supabase = options.client ?? createAnonClient();
  const select = publicSelectClause(table);

  const paged = await paginateQuery<PublicRow<T>>(
    async (from, to) => {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .order("id")
        .range(from, to);
      return {
        data: (data ?? []) as unknown as PublicRow<T>[],
        error,
      };
    },
    {
      pageSize: PUBLIC_FETCH_PAGE_SIZE,
      maxRows: PUBLIC_BULK_MAX_ROWS,
    },
  );

  if (paged.error) {
    return { success: false, error: paged.error };
  }

  const result = {
    success: true as const,
    data: paged.data,
    truncated: paged.truncated,
  };

  setPublicReadCacheEntry(key, {
    data: result.data,
    truncated: result.truncated,
  });

  return result;
}
