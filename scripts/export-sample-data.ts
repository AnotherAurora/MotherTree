import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Database, TableName } from "../src/lib/database.types";

const PROJECT_ID = "brsxrctacuhllumnfwgx";
const PAGE_SIZE = 1000;

const TABLES: TableName[] = [
  "tag",
  "awakener",
  "desire",
  "awakener_tag_manifestation",
  "tag_default_interaction",
  "manifestation_interaction_override",
  "desire_demand",
  "path",
];

type ManifestTable = {
  file: string;
  rowCount: number;
};

type Manifest = {
  dumpedAt: string;
  dumpDate: string;
  source: "supabase";
  projectId: string;
  tables: Record<string, ManifestTable>;
};

function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, then run: npm run db:dump",
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

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchAllRows<T extends TableName>(
  supabase: SupabaseClient<Database>,
  table: T,
): Promise<Database["public"]["Tables"][T]["Row"][]> {
  const rows: Database["public"]["Tables"][T]["Row"][] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase.from(table).select("*").range(from, to);

    if (error) {
      throw new Error(`Failed to export ${table}: ${error.message}`);
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

async function main() {
  const now = new Date();
  const dumpDate = localDateString(now);
  const outDir = resolve(process.cwd(), "sample-data", "dumps", dumpDate);

  mkdirSync(outDir, { recursive: true });

  const supabase = createAdminClient();
  const manifest: Manifest = {
    dumpedAt: now.toISOString(),
    dumpDate,
    source: "supabase",
    projectId: PROJECT_ID,
    tables: {},
  };

  for (const table of TABLES) {
    const file = `${table}.json`;
    const rows = await fetchAllRows(supabase, table);
    const outPath = resolve(outDir, file);

    writeFileSync(outPath, `${JSON.stringify(rows, null, 2)}\n`, "utf-8");

    manifest.tables[table] = {
      file,
      rowCount: rows.length,
    };

    console.log(`  ${table}: ${rows.length} rows → ${file}`);
  }

  const manifestPath = resolve(outDir, "_manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

  console.log(`\nDump complete: ${outDir}`);
  console.log(`Manifest: ${manifestPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`db:dump failed: ${message}`);
  process.exit(1);
});
