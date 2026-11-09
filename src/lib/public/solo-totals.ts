/**
 * Read path for precomputed Public Search solo totals.
 *
 * The values live in `public.search_solo_totals` and are regenerated offline by
 * `npm run sync:search-totals`. Search must never run the calculation engine in
 * the Worker: a full simulated search is ~19 s of CPU, far beyond the Workers
 * Free 10 ms budget.
 */
import {
  publicSelectClause,
  type PublicRow,
} from "@/lib/public-read/allowlist";
import { createAnonClient } from "@/lib/supabase/anon";
import { paginateQuery } from "@/lib/supabase/paginate-query";

/** Safety valve for a single Search request. */
export const SOLO_TOTALS_FETCH_MAX_ROWS = 5000;

export type PrecomputedSoloTotal = {
  awakenerId: number;
  realmId: number;
  tagId: number;
  value: number;
  targetType: string | null;
  metadata: string | null;
  syncedAt: string;
};

export type PrecomputedSoloTotalsResult =
  | {
      success: true;
      rows: PrecomputedSoloTotal[];
      /** Tag ids included by the last sync; null when never synced. */
      syncedTagIds: number[] | null;
      /** Last successful sync timestamp; null when never synced. */
      syncedAt: string | null;
      truncated: boolean;
    }
  | { success: false; error: string };

export function soloTotalLookupKey(
  awakenerId: number,
  realmId: number,
  tagId: number,
): string {
  return `${awakenerId}:${realmId}:${tagId}`;
}

function mapTotalsRow(
  row: PublicRow<"search_solo_totals">,
): PrecomputedSoloTotal {
  return {
    awakenerId: row.awakener_id,
    realmId: row.realm_id,
    tagId: row.tag_id,
    value: row.value,
    targetType: row.target_type_display,
    metadata: row.metadata_display,
    syncedAt: row.synced_at,
  };
}

/**
 * Load precomputed solo totals for the selected tag ids at one enlightenment.
 * Tag ids must already be restricted to `is_search_simulated` tags.
 */
export async function fetchPrecomputedSoloTotals(input: {
  tagIds: readonly number[];
  enlightenment: number;
}): Promise<PrecomputedSoloTotalsResult> {
  const tagIds = [...new Set(input.tagIds)].sort((a, b) => a - b);
  if (tagIds.length === 0) {
    return {
      success: true,
      rows: [],
      syncedTagIds: [],
      syncedAt: null,
      truncated: false,
    };
  }

  const supabase = createAnonClient();

  const [totals, meta] = await Promise.all([
    paginateQuery<PublicRow<"search_solo_totals">>(
      async (from, to) => {
        const { data, error } = await supabase
          .from("search_solo_totals")
          .select(publicSelectClause("search_solo_totals"))
          .in("tag_id", tagIds)
          .eq("enlightenment", input.enlightenment)
          .order("id")
          .range(from, to);
        return {
          data: (data ?? []) as unknown as PublicRow<"search_solo_totals">[],
          error,
        };
      },
      { maxRows: SOLO_TOTALS_FETCH_MAX_ROWS },
    ),
    supabase
      .from("search_solo_totals_meta")
      .select(publicSelectClause("search_solo_totals_meta"))
      .limit(1)
      .maybeSingle(),
  ]);

  if (totals.error) {
    return { success: false, error: totals.error };
  }
  if (meta.error) {
    return { success: false, error: meta.error.message };
  }

  const metaRow = meta.data as unknown as
    | PublicRow<"search_solo_totals_meta">
    | null;

  return {
    success: true,
    rows: totals.data.map(mapTotalsRow),
    syncedTagIds: metaRow?.tag_ids ?? null,
    syncedAt: metaRow?.synced_at ?? null,
    truncated: totals.truncated,
  };
}
