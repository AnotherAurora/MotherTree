/**
 * Regenerate public.search_solo_totals (Public Search precomputed solo totals).
 *
 * Search rows for tags flagged `tag.is_search_simulated` used to run the whole
 * Path Carver pipeline inside the Cloudflare Worker — 65 solo sims (~19 s CPU),
 * far over the Workers Free 10 ms budget. The values are a pure function of
 * (awakener, realm, enlightenment, tag), so this script recomputes the matrix
 * offline and the request path only reads it.
 *
 * The catalog is loaded through the same anon + RLS public-read path the Worker
 * uses, so soft-deleted rows are excluded identically. Writes use the service
 * role key.
 *
 * Run: npm run sync:search-totals
 *      npm run sync:search-totals -- --dry-run
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AWAKENER_ENLIGHTENMENT_OPTIONS } from "../src/lib/enlightenment-options";
import { fetchAllPublicTable } from "../src/lib/public-read/fetch";
import type { PublicRow } from "../src/lib/public-read/allowlist";
import { formatSearchTargetTypeLabel } from "../src/lib/public/search-filter-options";
import {
  collectSoloTagDisplayFields,
  computeSoloAwakenerTotals,
  realmSimsForAwakener,
  type SoloAwakenerCatalog,
} from "../src/lib/public/solo-awakener-totals";
import type { Database } from "../src/lib/database.types";

type SoloTotalInsert =
  Database["public"]["Tables"]["search_solo_totals"]["Insert"];
type SoloTotalRow = Database["public"]["Tables"]["search_solo_totals"]["Row"];

const DRY_RUN = process.argv.includes("--dry-run");
const ALLOW_EMPTY = process.argv.includes("--allow-empty");
const PAGE_SIZE = 1000;
const WRITE_CHUNK = 500;

function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, then run: npm run sync:search-totals",
    );
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function keyOf(
  awakenerId: number,
  realmId: number,
  enlightenment: number,
  tagId: number,
): string {
  return `${awakenerId}:${realmId}:${enlightenment}:${tagId}`;
}

async function loadCatalogTable<
  T extends Parameters<typeof fetchAllPublicTable>[0],
>(table: T): Promise<PublicRow<T>[]> {
  const result = await fetchAllPublicTable(table);
  if (!result.success) {
    throw new Error(`${table}: ${result.error}`);
  }
  if (result.truncated) {
    throw new Error(`${table}: hit the public bulk row cap; aborting.`);
  }
  return result.data;
}

async function fetchExistingRows(
  admin: SupabaseClient<Database>,
): Promise<SoloTotalRow[]> {
  const rows: SoloTotalRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("search_solo_totals")
      .select("*")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`search_solo_totals read: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Float-safe enough: values are deterministic JS doubles round-tripped as JSON. */
function sameValue(a: number, b: number): boolean {
  return a === b || Math.abs(a - b) < 1e-9;
}

async function main(): Promise<void> {
  const startedAt = performance.now();
  const admin = createAdminClient();

  const [
    tags,
    realms,
    awakeners,
    awakenerManifestations,
    awakenerLocalInteractions,
    realmManifestations,
    defaultInteractions,
    copyProviderMembers,
  ] = await Promise.all([
    loadCatalogTable("tag"),
    loadCatalogTable("realm"),
    loadCatalogTable("awakener"),
    loadCatalogTable("awakener_tag_manifestation"),
    loadCatalogTable("awakener_local_manifestation_interaction"),
    loadCatalogTable("realm_tag_manifestation"),
    loadCatalogTable("tag_default_interaction"),
    loadCatalogTable("copy_provider_group_member"),
  ]);

  const catalog: SoloAwakenerCatalog = {
    tags,
    realms,
    realmManifestations,
    defaultInteractions,
    awakenerManifestations,
    awakenerLocalInteractions,
    copyProviderMembers,
  };

  const simulatedTagIds = tags
    .filter((tag) => tag.is_search_simulated === true)
    .map((tag) => tag.id);

  if (simulatedTagIds.length === 0 && !ALLOW_EMPTY) {
    throw new Error(
      "No tags are flagged is_search_simulated. Re-run with --allow-empty to clear the table.",
    );
  }

  console.log(
    `catalog: awakeners=${awakeners.length} simulatedTags=${simulatedTagIds.length} ` +
      `enlightenment=${AWAKENER_ENLIGHTENMENT_OPTIONS.length}`,
  );

  const syncedAt = new Date().toISOString();
  const expected = new Map<string, SoloTotalInsert>();
  let simsRun = 0;

  for (const awakener of awakeners) {
    for (const realmId of realmSimsForAwakener(awakener, null)) {
      for (const option of AWAKENER_ENLIGHTENMENT_OPTIONS) {
        const { totalsByTagId, hasAppliedRealmManifestation } =
          computeSoloAwakenerTotals(
            awakener,
            realmId,
            option.value,
            catalog,
            undefined,
            { totalsOnly: true },
          );
        simsRun += 1;

        for (const tagId of simulatedTagIds) {
          const total = totalsByTagId.get(tagId);
          // Only tags the engine actually produced contribute a Search row.
          if (total == null) continue;

          const display = collectSoloTagDisplayFields({
            awakenerId: awakener.id,
            tagId,
            realmSim: realmId,
            enlightenment: option.value,
            awakenerManifestations,
            awakenerLocalInteractions,
            defaultInteractions,
            formatTargetType: formatSearchTargetTypeLabel,
            hasAppliedRealmManifestation,
          });

          expected.set(keyOf(awakener.id, realmId, option.value, tagId), {
            awakener_id: awakener.id,
            realm_id: realmId,
            enlightenment: option.value,
            tag_id: tagId,
            value: total,
            has_realm_gimmick: hasAppliedRealmManifestation,
            target_type_display: display.targetType,
            metadata_display: display.metadata,
            synced_at: syncedAt,
          });
        }
      }
    }
  }

  const existing = await fetchExistingRows(admin);
  const existingByKey = new Map<string, SoloTotalRow>();
  for (const row of existing) {
    existingByKey.set(
      keyOf(row.awakener_id, row.realm_id, row.enlightenment, row.tag_id),
      row,
    );
  }

  const toUpsert: SoloTotalInsert[] = [];
  for (const [key, row] of expected) {
    const current = existingByKey.get(key);
    if (
      current == null ||
      !sameValue(current.value, row.value) ||
      current.has_realm_gimmick !== row.has_realm_gimmick ||
      (current.target_type_display ?? null) !==
        (row.target_type_display ?? null) ||
      (current.metadata_display ?? null) !== (row.metadata_display ?? null)
    ) {
      // Keep the surrogate id stable on updates so only values change.
      if (current != null) row.id = current.id;
      toUpsert.push(row);
    }
  }

  const toDelete: number[] = [];
  for (const [key, row] of existingByKey) {
    if (!expected.has(key)) toDelete.push(row.id);
  }

  console.log(
    `sims=${simsRun} expected=${expected.size} existing=${existing.length} ` +
      `upsert=${toUpsert.length} delete=${toDelete.length}`,
  );

  if (DRY_RUN) {
    console.log("--dry-run: no rows written.");
    return;
  }

  for (const rows of chunk(toUpsert, WRITE_CHUNK)) {
    const { error } = await admin
      .from("search_solo_totals")
      .upsert(rows, {
        onConflict: "awakener_id,realm_id,enlightenment,tag_id",
      });
    if (error) throw new Error(`upsert: ${error.message}`);
  }

  for (const ids of chunk(toDelete, WRITE_CHUNK)) {
    const { error } = await admin
      .from("search_solo_totals")
      .delete()
      .in("id", ids);
    if (error) throw new Error(`delete: ${error.message}`);
  }

  const { error: metaError } = await admin
    .from("search_solo_totals_meta")
    .upsert(
      { id: true, synced_at: syncedAt, tag_ids: simulatedTagIds },
      { onConflict: "id" },
    );
  if (metaError) throw new Error(`meta upsert: ${metaError.message}`);

  console.log(
    `Wrote search_solo_totals in ${((performance.now() - startedAt) / 1000).toFixed(1)}s.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
