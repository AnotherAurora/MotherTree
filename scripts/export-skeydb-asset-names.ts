/**
 * Slim dump of wheel / covenant / posse names for SKeyDB asset map generation.
 *
 * Output: sample-data/skeydb-asset-names/{wheel,covenant,posse}.json
 * Prefer: npm run sync:skeydb-assets (runs this, then bumps pin + regenerates maps)
 * Standalone: npm run db:dump-skeydb-assets
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Database } from "../src/lib/database.types";

const PAGE_SIZE = 1000;

const TABLES = ["wheel", "covenant", "posse"] as const;
type AssetNameTable = (typeof TABLES)[number];

type NameRow = { name: string };

function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, then run: npm run db:dump-skeydb-assets",
    );
  }

  if (serviceRoleKey.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY looks like a publishable key. Use the Secret or service_role key from Supabase Dashboard → API keys.",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function fetchAliveNames(
  supabase: SupabaseClient<Database>,
  table: AssetNameTable,
): Promise<NameRow[]> {
  const rows: NameRow[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select("name")
      .is("deleted_at", null)
      .range(from, to);

    if (error) {
      throw new Error(`Failed to export ${table} names: ${error.message}`);
    }

    const page = (data ?? []) as NameRow[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows
    .filter((row) => typeof row.name === "string" && row.name.trim().length > 0)
    .map((row) => ({ name: row.name.trim() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const outDir = resolve(process.cwd(), "sample-data", "skeydb-asset-names");
  mkdirSync(outDir, { recursive: true });

  const supabase = createAdminClient();

  for (const table of TABLES) {
    const rows = await fetchAliveNames(supabase, table);
    const file = `${table}.json`;
    const outPath = resolve(outDir, file);
    writeFileSync(outPath, `${JSON.stringify(rows, null, 2)}\n`, "utf-8");
    console.log(`  ${table}: ${rows.length} names → ${file}`);
  }

  console.log(`\nAsset name dump complete: ${outDir}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`db:dump-skeydb-assets failed: ${message}`);
  process.exit(1);
});
