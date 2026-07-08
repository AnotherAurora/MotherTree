import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { SEED_DESIRE_NAMES } from "./simulator-seed-constants";

function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function hardDeleteDesireChildren(
  supabase: SupabaseClient<Database>,
  desireId: number,
): Promise<{ paths: number; demands: number; anchors: number }> {
  const [pathResult, demandResult, anchorResult] = await Promise.all([
    supabase.from("path").delete().eq("desire_id", desireId).select("id"),
    supabase
      .from("desire_demand")
      .delete()
      .eq("desire_id", desireId)
      .select("id"),
    supabase
      .from("desire_anchored_awakener")
      .delete()
      .eq("desire_id", desireId)
      .select("id"),
  ]);

  if (pathResult.error) throw new Error(pathResult.error.message);
  if (demandResult.error) throw new Error(demandResult.error.message);
  if (anchorResult.error) throw new Error(anchorResult.error.message);

  return {
    paths: pathResult.data?.length ?? 0,
    demands: demandResult.data?.length ?? 0,
    anchors: anchorResult.data?.length ?? 0,
  };
}

async function hardDeleteDesireByName(
  supabase: SupabaseClient<Database>,
  name: string,
): Promise<void> {
  const { data: desires, error: findError } = await supabase
    .from("desire")
    .select("id, name, deleted_at")
    .eq("name", name);

  if (findError) throw new Error(findError.message);

  if (!desires || desires.length === 0) {
    console.log(`  - ${name}: not found, skipping`);
    return;
  }

  for (const desire of desires) {
    const counts = await hardDeleteDesireChildren(supabase, desire.id);

    const { error: deleteError } = await supabase
      .from("desire")
      .delete()
      .eq("id", desire.id);

    if (deleteError) throw new Error(deleteError.message);

    const deletedLabel =
      desire.deleted_at != null ? " (was soft-deleted)" : "";
    console.log(
      `  ✓ ${name} (id=${desire.id}${deletedLabel}): removed ${counts.paths} path(s), ${counts.demands} demand(s), ${counts.anchors} anchor(s)`,
    );
  }
}

async function main() {
  const supabase = createAdminClient();
  console.log("Removing simulator seed desires...\n");

  for (const name of SEED_DESIRE_NAMES) {
    await hardDeleteDesireByName(supabase, name);
  }

  console.log("\nUnseed complete.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`db:unseed-simulator failed: ${message}`);
  process.exit(1);
});
