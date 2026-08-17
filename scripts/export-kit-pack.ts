/**
 * Secondary CLI: export one awakener kit pack to sample-data/kit-reader/{slug}.kit.json
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/export-kit-pack.ts --id 5
 *   npx tsx --env-file=.env.local scripts/export-kit-pack.ts --name Aurita
 *
 * Prefer the admin Kit Reader UI for export + Cursor prompt. This CLI is optional.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolve } from "node:path";
import { isAdminRuntimeEnabled } from "../src/lib/admin-runtime";
import type { Database } from "../src/lib/database.types";
import {
  buildKitPackForAwakener,
  writeKitPackToRepo,
} from "../src/lib/kit-reader/build-kit-pack";
import { buildKitReaderCursorPrompt } from "../src/lib/kit-reader/cursor-prompt";

function createScriptClient(): SupabaseClient<Database> {
  if (!isAdminRuntimeEnabled()) {
    throw new Error(
      "Kit Reader export is local-only. Set ADMIN_ENABLED=true (not on Vercel).",
    );
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase env in .env.local");
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function parseArgs(argv: string[]) {
  let id: number | null = null;
  let name: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--id") id = Number(argv[++i]);
    else if (argv[i] === "--name") name = argv[++i] ?? null;
  }
  return { id, name };
}

async function main() {
  const { id, name } = parseArgs(process.argv.slice(2));
  if ((id == null || Number.isNaN(id)) && !name) {
    console.error(
      "Usage: npx tsx --env-file=.env.local scripts/export-kit-pack.ts (--id N | --name Name)",
    );
    process.exit(1);
  }

  const supabase = createScriptClient();
  let awakenerId = id;

  if (awakenerId == null) {
    const { data, error } = await supabase
      .from("awakener")
      .select("id")
      .eq("name", name!)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Awakener "${name}" not found`);
    awakenerId = Number(data.id);
  }

  const { count, error: pendingError } = await supabase
    .from("awakener_tag_manifestation")
    .select("id", { count: "exact", head: true })
    .eq("awakener_id", awakenerId)
    .eq("verified", false)
    .is("deleted_at", null);
  if (pendingError) throw new Error(pendingError.message);
  if ((count ?? 0) > 0) {
    throw new Error(
      `Abort: ${count} pending ATM(s). Verify or soft-delete before export.`,
    );
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

  console.log(`Wrote ${relativePath}`);
  console.log("--- Cursor prompt ---");
  console.log(prompt);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
