import { createClient } from "@supabase/supabase-js";
import { isAdminRuntimeEnabled } from "../src/lib/admin-runtime";

if (!isAdminRuntimeEnabled()) {
  throw new Error("ADMIN_ENABLED required");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const updates = [
  { id: 637, value_scalar: 0.95, label: "Soul Overture MD STR Down" },
  { id: 640, value_scalar: 0.57, label: "Exalt MD STR Down" },
  { id: 648, value_scalar: 1.9, label: "OE Soul Overture MD STR Down" },
  { id: 652, value_scalar: 0.57, label: "OE Exalt MD STR Down" },
] as const;

async function main() {
  const now = new Date().toISOString();
  const results: unknown[] = [];

  for (const row of updates) {
    const { data, error } = await supabase
      .from("awakener_tag_manifestation")
      .update({
        value_scalar: row.value_scalar,
        dependency_stat: "atk",
        updated_at: now,
      })
      .eq("id", row.id)
      .is("deleted_at", null)
      .select("id, metadata, value_scalar, dependency_stat")
      .maybeSingle();

    if (error) throw new Error(`${row.label}: ${error.message}`);
    if (!data) throw new Error(`${row.label}: id ${row.id} missing or soft-deleted`);
    results.push(data);
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
