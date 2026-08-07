/**
 * Phase 2 public read smoke — anon SELECT allowlist, writes blocked, caps/trim.
 * Run: npx tsx --env-file=.env.local scripts/smoke-public-read.ts
 */
import { createClient } from "@supabase/supabase-js";
import {
  PUBLIC_READ_TABLES,
  PUBLIC_ROW_LIMIT,
  PUBLIC_TABLE_COLUMNS,
  type PublicReadTable,
} from "../src/lib/public-read/allowlist";
import { fetchPublicTable } from "../src/lib/public-read/fetch";
import {
  checkPublicRateLimit,
  resetPublicRateLimitForTests,
} from "../src/lib/public-read/rate-limit";
import type { Database } from "../src/lib/database.types";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
}

function createAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function hasHiddenColumns(row: Record<string, unknown>): string[] {
  return ["created_at", "updated_at", "deleted_at"].filter((k) => k in row);
}

async function main() {
  console.log("Phase 2 public read smoke\n");

  const anon = createAnon();

  console.log("1) Allowlisted SELECT succeeds (projected columns, no timestamps)");
  for (const table of PUBLIC_READ_TABLES) {
    const result = await fetchPublicTable(table as PublicReadTable, {
      client: anon,
      limit: 5,
    });
    assert(result.success, `${table}: fetch succeeded`);
    if (!result.success) continue;
    assert(result.data.length >= 0, `${table}: returned rows array`);
    if (result.data[0]) {
      const hidden = hasHiddenColumns(result.data[0] as Record<string, unknown>);
      assert(
        hidden.length === 0,
        `${table}: no timestamp columns in response (got ${hidden.join(",") || "none"})`,
      );
      const expected = new Set(PUBLIC_TABLE_COLUMNS[table] as readonly string[]);
      for (const key of Object.keys(result.data[0] as object)) {
        assert(expected.has(key), `${table}: column "${key}" is allowlisted`);
      }
    }
  }

  console.log("\n2) Soft-deleted rows excluded by RLS");
  {
    const { data, error } = await anon
      .from("tag")
      .select("id,deleted_at")
      .not("deleted_at", "is", null)
      .limit(1);
    // RLS hides deleted rows entirely; select of deleted_at still fails projection
    // for alive rows only — any returned row with deleted_at set would be a leak.
    assert(!error || data !== null, "tag deleted probe completed");
    const leaked = (data ?? []).filter((r) => r.deleted_at != null);
    assert(leaked.length === 0, "no soft-deleted tag rows visible to anon");
  }

  console.log("\n3) Non-allowlisted SELECT fails for anon");
  {
    const { data, error } = await anon.from("desire").select("id").limit(1);
    assert(!!error || (data ?? []).length === 0, "desire SELECT blocked or empty under RLS");
    assert(!!error, `desire SELECT errors for anon (got: ${error?.message ?? "no error"})`);
  }

  console.log("\n4) Anon writes fail");
  {
    const { error } = await anon.from("tag").insert({
      tag_name: `__public_read_smoke_${Date.now()}`,
    } as never);
    assert(!!error, `tag INSERT rejected (got: ${error?.message ?? "no error"})`);
  }
  {
    const { data: sample } = await anon.from("tag").select("id").limit(1).maybeSingle();
    if (sample?.id != null) {
      const { error } = await anon
        .from("tag")
        .update({ tag_name: "should_not_update" } as never)
        .eq("id", sample.id);
      assert(!!error, `tag UPDATE rejected (got: ${error?.message ?? "no error"})`);
    } else {
      console.log("  skip — no tag row available to probe UPDATE");
    }
  }

  console.log("\n5) Row cap enforced at 500");
  {
    const over = await fetchPublicTable("tag", {
      client: anon,
      limit: PUBLIC_ROW_LIMIT + 50,
    });
    assert(over.success, "tag fetch with oversize limit request succeeded");
    if (over.success) {
      assert(
        over.data.length <= PUBLIC_ROW_LIMIT,
        `returned ≤ ${PUBLIC_ROW_LIMIT} rows (got ${over.data.length})`,
      );
    }
  }

  console.log("\n6) In-memory rate limit (~60/min/IP)");
  {
    resetPublicRateLimitForTests();
    const key = "smoke-test-ip";
    let blocked = false;
    for (let i = 0; i < 61; i++) {
      const result = checkPublicRateLimit(key, 60);
      if (!result.ok) {
        blocked = true;
        assert(i === 60, `61st request blocked (at index ${i})`);
        break;
      }
    }
    assert(blocked, "rate limiter blocks after 60 requests in the window");
    resetPublicRateLimitForTests();
  }

  console.log("\nAll Phase 2 public-read smoke checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
