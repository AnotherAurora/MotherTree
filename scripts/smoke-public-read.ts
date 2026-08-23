/**
 * Phase 2 + Phase 6 public read smoke — anon SELECT allowlist, writes blocked,
 * caps/trim, in-process 5m TTL cache (2nd read within TTL skips Supabase).
 * Run: npx tsx --env-file=.env.local scripts/smoke-public-read.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  PUBLIC_BULK_MAX_ROWS,
  PUBLIC_READ_TABLES,
  PUBLIC_ROW_LIMIT,
  PUBLIC_TABLE_COLUMNS,
  type PublicReadTable,
} from "../src/lib/public-read/allowlist";
import { resetPublicReadCacheForTests } from "../src/lib/public-read/cache";
import { fetchAllPublicTable, fetchPublicTable } from "../src/lib/public-read/fetch";
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

/** Counts `.from()` calls so cache hits are observable without network sniffing. */
function withFromCounter(client: SupabaseClient<Database>): {
  client: SupabaseClient<Database>;
  fromCount: () => number;
} {
  let count = 0;
  const proxied = new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (...args: Parameters<SupabaseClient<Database>["from"]>) => {
          count += 1;
          return target.from(...args);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as SupabaseClient<Database>;
  return { client: proxied, fromCount: () => count };
}

function hasHiddenColumns(row: Record<string, unknown>): string[] {
  return ["created_at", "updated_at", "deleted_at"].filter((k) => k in row);
}

async function main() {
  console.log("Phase 2 + Phase 6 public read smoke\n");

  const anon = createAnon();
  resetPublicReadCacheForTests();

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

  console.log("\n5b) tag_default_interaction fits under 500-row option-list cap");
  {
    const full = await fetchPublicTable("tag_default_interaction", {
      client: anon,
      limit: PUBLIC_ROW_LIMIT,
    });
    assert(full.success, "tag_default_interaction full fetch succeeded");
    if (full.success) {
      assert(
        !full.truncated,
        `tag_default_interaction not truncated (got ${full.data.length} rows)`,
      );
      assert(
        full.data.length <= PUBLIC_ROW_LIMIT,
        `tag_default_interaction ≤ ${PUBLIC_ROW_LIMIT} (got ${full.data.length})`,
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

  console.log("\n7) Phase 6 — second fetch within TTL does not hit Supabase");
  {
    resetPublicReadCacheForTests();
    const { client, fromCount } = withFromCounter(anon);
    const first = await fetchPublicTable("realm", { client, limit: 3 });
    assert(first.success, "realm cold fetch succeeded");
    assert(fromCount() === 1, `cold fetch called .from once (got ${fromCount()})`);

    const second = await fetchPublicTable("realm", { client, limit: 3 });
    assert(second.success, "realm warm fetch succeeded");
    assert(fromCount() === 1, `warm fetch did not call .from again (got ${fromCount()})`);
    if (first.success && second.success) {
      assert(
        first.data.length === second.data.length,
        "warm fetch returns same row count as cold",
      );
      assert(
        first.truncated === second.truncated,
        "warm fetch returns same truncated flag",
      );
    }

    const differentLimit = await fetchPublicTable("realm", {
      client,
      limit: 4,
    });
    assert(differentLimit.success, "realm fetch with different limit succeeded");
    assert(
      fromCount() === 2,
      `different limit is a cache miss (got ${fromCount()} .from calls)`,
    );
    resetPublicReadCacheForTests();
  }

  console.log("\n8) fetchAllPublicTable paginates awakener_tag_manifestation");
  {
    resetPublicReadCacheForTests();
    const capped = await fetchPublicTable("awakener_tag_manifestation", {
      client: anon,
      limit: PUBLIC_ROW_LIMIT,
    });
    assert(capped.success, "ATM capped fetch succeeded");

    const { client, fromCount } = withFromCounter(anon);
    const all = await fetchAllPublicTable("awakener_tag_manifestation", {
      client,
    });
    assert(all.success, "ATM fetch-all succeeded");
    if (all.success && capped.success) {
      assert(
        all.data.length >= capped.data.length,
        `fetch-all ≥ capped fetch (${all.data.length} vs ${capped.data.length})`,
      );
      assert(
        all.data.length <= PUBLIC_BULK_MAX_ROWS,
        `fetch-all ≤ ${PUBLIC_BULK_MAX_ROWS} (got ${all.data.length})`,
      );
      if (capped.truncated) {
        assert(
          all.data.length > capped.data.length,
          "fetch-all returns more rows than 500-cap when table exceeds cap",
        );
      }
      assert(!all.truncated, "ATM fetch-all not truncated under safety cap");
    }
    assert(fromCount() >= 1, "fetch-all issued at least one Supabase page");
    resetPublicReadCacheForTests();
  }

  console.log("\n9) Phase 6 — fetchAllPublicTable cache hit skips Supabase");
  {
    resetPublicReadCacheForTests();
    const { client, fromCount } = withFromCounter(anon);
    const first = await fetchAllPublicTable("realm", { client });
    assert(first.success, "realm fetch-all cold succeeded");
    const coldCalls = fromCount();
    assert(coldCalls >= 1, `cold fetch-all called .from (got ${coldCalls})`);

    const second = await fetchAllPublicTable("realm", { client });
    assert(second.success, "realm fetch-all warm succeeded");
    assert(
      fromCount() === coldCalls,
      `warm fetch-all did not call .from again (got ${fromCount()})`,
    );
    resetPublicReadCacheForTests();
  }

  console.log("\nAll Phase 2 + Phase 6 public-read smoke checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
