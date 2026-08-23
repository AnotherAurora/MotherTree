/**
 * Audit awakener_tag_manifestation rows that may be missing dependency_stat.
 *
 * Heuristic: non-percent tags (tag.is_percent = false) with a fractional
 * value_scalar, no dependency_stat, and (by default) value_scalar < 1 — the
 * usual N/100 kit encoding that should scale off atk/def/con.
 *
 * Usage:
 *   npm run audit:atm-dependency-stat
 *   npm run audit:atm-dependency-stat -- --awakener-name Hameln
 *   npm run audit:atm-dependency-stat -- --all-decimals
 *   npm run audit:atm-dependency-stat -- --include-steal
 *
 * Requires .env.local with Supabase service role (same as other admin scripts).
 * Exits 1 when suspicious rows remain after filters.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

/** Tags where null dependency + small decimals can be intentional. */
const TAG_ALLOWLIST_PREFIXES = [
  "Support.Increase Gain.",
  "Support.Take Effect Again",
  "Special.Cause.",
  "When.",
] as const;

type Row = {
  id: number;
  metadata: string | null;
  value_scalar: number | null;
  dependency_stat: string | null;
  verified: boolean | null;
  required_enlightenment: number | null;
  awakener_id: number;
  awakener: { name: string } | null;
  tag: { tag_name: string; is_percent: boolean | null } | null;
};

type AuditOptions = {
  awakenerId: number | null;
  awakenerName: string | null;
  maxScalar: number | null;
  includeStealPairs: boolean;
};

function createScriptClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function parseArgs(argv: string[]): AuditOptions {
  let awakenerId: number | null = null;
  let awakenerName: string | null = null;
  let maxScalar: number | null = 1;
  let includeStealPairs = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--awakener-id") {
      awakenerId = Number(argv[++i]);
    } else if (arg === "--awakener-name") {
      awakenerName = argv[++i] ?? null;
    } else if (arg === "--all-decimals") {
      maxScalar = null;
    } else if (arg === "--include-steal") {
      includeStealPairs = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: npm run audit:atm-dependency-stat [-- options]

Options:
  --awakener-id N       Limit to one awakener
  --awakener-name NAME  Limit to one awakener by name
  --all-decimals        Include value_scalar >= 1 (default: only < 1)
  --include-steal       Do not suppress likely Steal STR pairs
`);
      process.exit(0);
    } else if (!arg.startsWith("-") && awakenerName == null && awakenerId == null) {
      // Convenience: npm run audit:atm-dependency-stat -- Hameln
      awakenerName = arg;
    }
  }

  return { awakenerId, awakenerName, maxScalar, includeStealPairs };
}

function isFractional(value: number): boolean {
  return Math.abs(value - Math.trunc(value)) > 1e-9;
}

function isAllowlistedTag(tagName: string): boolean {
  return TAG_ALLOWLIST_PREFIXES.some(
    (prefix) => tagName === prefix || tagName.startsWith(`${prefix}.`),
  );
}

function isSuspicious(row: Row, maxScalar: number | null): boolean {
  const tag = row.tag;
  const scalar = row.value_scalar;
  if (!tag || scalar == null) return false;
  if (tag.is_percent === true) return false;
  if (row.dependency_stat != null) return false;
  if (scalar <= 0 || !isFractional(scalar)) return false;
  if (maxScalar != null && scalar >= maxScalar) return false;
  if (isAllowlistedTag(tag.tag_name)) return false;
  return true;
}

/** Steal STR: matching STR Down + STR Up at same scalar with null dep. */
function buildStealPairKeys(rows: Row[]): Set<string> {
  const downs = new Map<string, Row[]>();
  const ups = new Map<string, Row[]>();

  for (const row of rows) {
    const tagName = row.tag?.tag_name;
    const scalar = row.value_scalar;
    if (scalar == null || row.dependency_stat != null) continue;

    const key = `${row.awakener_id}:${scalar}:${row.required_enlightenment ?? 0}`;
    if (tagName === "Defender.STR Down") {
      const list = downs.get(key) ?? [];
      list.push(row);
      downs.set(key, list);
    } else if (tagName === "Support.STR Up.Fixed") {
      const list = ups.get(key) ?? [];
      list.push(row);
      ups.set(key, list);
    }
  }

  const stealKeys = new Set<string>();
  for (const [key, downRows] of downs) {
    if ((ups.get(key)?.length ?? 0) > 0) {
      for (const row of downRows) {
        stealKeys.add(String(row.id));
      }
      for (const row of ups.get(key) ?? []) {
        stealKeys.add(String(row.id));
      }
    }
  }
  return stealKeys;
}

async function resolveAwakenerId(
  supabase: SupabaseClient<Database>,
  opts: AuditOptions,
): Promise<number | null> {
  if (opts.awakenerId != null && !Number.isNaN(opts.awakenerId)) {
    return opts.awakenerId;
  }
  if (!opts.awakenerName) return null;

  const { data, error } = await supabase
    .from("awakener")
    .select("id")
    .eq("name", opts.awakenerName)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Awakener "${opts.awakenerName}" not found`);
  return Number(data.id);
}

async function loadRows(
  supabase: SupabaseClient<Database>,
  awakenerId: number | null,
): Promise<Row[]> {
  let query = supabase
    .from("awakener_tag_manifestation")
    .select(
      `
      id,
      metadata,
      value_scalar,
      dependency_stat,
      verified,
      required_enlightenment,
      awakener_id,
      awakener:awakener_id ( name ),
      tag!tag_id ( tag_name, is_percent )
    `,
    )
    .is("deleted_at", null);

  if (awakenerId != null) {
    query = query.eq("awakener_id", awakenerId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

function printRow(row: Row, note?: string): void {
  const awakener = row.awakener?.name ?? "?";
  const tagName = row.tag?.tag_name ?? "?";
  const verified = row.verified ? "verified" : "pending";
  const suffix = note ? `  (${note})` : "";
  console.log(
    `  id=${row.id}  ${awakener}  ${tagName}  scalar=${row.value_scalar}  dep=${row.dependency_stat ?? "null"}  ${verified}  ${row.metadata ?? ""}${suffix}`,
  );
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const supabase = createScriptClient();
  const awakenerId = await resolveAwakenerId(supabase, opts);
  const rows = await loadRows(supabase, awakenerId);

  const suspicious = rows.filter((row) => isSuspicious(row, opts.maxScalar));
  const stealIds = opts.includeStealPairs
    ? new Set<string>()
    : buildStealPairKeys(rows);

  const flagged = suspicious.filter((row) => !stealIds.has(String(row.id)));
  const suppressedSteal = suspicious.filter((row) =>
    stealIds.has(String(row.id)),
  );

  const scope =
    awakenerId != null
      ? `awakener_id=${awakenerId}`
      : "all awakeners";
  const scalarRule =
    opts.maxScalar != null
      ? `value_scalar in (0, ${opts.maxScalar})`
      : "any positive fraction";

  console.log("ATM dependency_stat audit");
  console.log(
    `  Scope: ${scope}  |  ${rows.length} alive rows  |  rule: is_percent=false, dep null, fractional, ${scalarRule}`,
  );
  console.log("");

  if (flagged.length === 0) {
    console.log("OK: no suspicious rows after filters.");
    if (suppressedSteal.length > 0) {
      console.log(
        `\nSuppressed ${suppressedSteal.length} likely Steal STR pair row(s) (use --include-steal to show):`,
      );
      for (const row of suppressedSteal) {
        printRow(row, "likely Steal pair");
      }
    }
    return;
  }

  console.log(`Suspicious (${flagged.length}):`);
  for (const row of flagged) {
    printRow(row);
  }

  if (suppressedSteal.length > 0) {
    console.log(
      `\nSuppressed ${suppressedSteal.length} likely Steal STR pair row(s):`,
    );
    for (const row of suppressedSteal) {
      printRow(row, "likely Steal pair");
    }
  }

  console.log(
    "\nLikely fix: set dependency_stat to atk/def/con when kit arg has stat+% (see docs/admin/kit-reader.md#skeydb-arg-scaling-resolvedargmeta).",
  );
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
