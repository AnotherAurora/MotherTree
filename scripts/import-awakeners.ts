/**
 * Import lv60 awakener stats from SKeyDB export JSON into public.awakener.
 *
 * Usage (dry run — default):
 *   npm run import:awakeners -- "<path-to-json>"
 *
 * Usage (insert into database):
 *   npm run import:awakeners:execute -- "<path-to-json>"
 *
 * Or call tsx directly (npm often drops `--execute`):
 *   npx tsx scripts/import-awakeners.ts "<path-to-json>" execute
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { loadEnv } from "./load-env";

type Realm = Database["public"]["Enums"]["realm"];
type AwakenerInsert = Database["public"]["Tables"]["awakener"]["Insert"];

type ExportStats = {
  CON: string;
  ATK: string;
  DEF: string;
  CritRate: string;
  CritDamage: string;
  AliemusRegen: string;
  KeyflareRegen: string;
  RealmMastery: string;
  SigilYield: string;
  DamageAmplification: string;
  DeathResistance: string;
};

type ExportAwakener = {
  name: string;
  realm: string;
  stats: ExportStats;
};

type ExportFile = {
  awakeners: ExportAwakener[];
};

/** Strip % and parse as number (schema stores numeric stats, not strings). */
function parseStat(value: string): number {
  const cleaned = value.replace(/%/g, "").trim();
  const n = Number(cleaned);
  if (Number.isNaN(n)) {
    throw new Error(`Invalid stat value: "${value}"`);
  }
  return n;
}

function mapRealm(realm: string): Realm {
  const normalized = realm.trim().toLowerCase() as Realm;
  const allowed: readonly Realm[] = [
    "chaos",
    "caro",
    "propagation caro",
    "aequor",
    "divine aequor",
    "ultra",
    "singularity ultra",
  ];
  if (!allowed.includes(normalized)) {
    throw new Error(`Unknown realm "${realm}" (normalized: "${normalized}")`);
  }
  return normalized;
}

/** Map JSON export row → awakener insert row (schema columns only). */
export function mapExportAwakener(row: ExportAwakener): AwakenerInsert {
  const s = row.stats;
  return {
    name: row.name,
    realm: mapRealm(row.realm),
    con: parseStat(s.CON),
    atk: parseStat(s.ATK),
    def: parseStat(s.DEF),
    crit_rate: parseStat(s.CritRate),
    crit_dmg: parseStat(s.CritDamage),
    aliemus_regen: parseStat(s.AliemusRegen),
    skey: parseStat(s.KeyflareRegen),
    realm_mastery: parseStat(s.RealmMastery),
    sigil_yield: parseStat(s.SigilYield),
    damage_amp: parseStat(s.DamageAmplification),
    death_resist: parseStat(s.DeathResistance),
  };
}

function createAdminClient() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function wantsExecute(args: string[]): boolean {
  return (
    args.includes("--execute") ||
    args.includes("execute") ||
    process.env.IMPORT_AWAKENERS_EXECUTE === "1"
  );
}

async function main() {
  const args = process.argv.slice(2);
  const jsonPath = args.find(
    (a) => !a.startsWith("--") && a !== "execute" && a !== "dry-run",
  );
  const execute = wantsExecute(args);
  const dryRun = !execute;

  if (!jsonPath) {
    console.error(
      [
        "Usage:",
        "  npm run import:awakeners -- \"<path-to-json>\"",
        "  npm run import:awakeners:execute -- \"<path-to-json>\"",
        "  npx tsx scripts/import-awakeners.ts \"<path-to-json>\" execute",
      ].join("\n"),
    );
    process.exit(1);
  }

  const absolute = resolve(jsonPath);
  const raw = readFileSync(absolute, "utf8");
  const data = JSON.parse(raw) as ExportFile;

  if (!Array.isArray(data.awakeners)) {
    throw new Error("JSON must contain an awakeners array");
  }

  const rows: AwakenerInsert[] = data.awakeners.map((row, i) => {
    try {
      return mapExportAwakener(row);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Row ${i + 1} (${row.name}): ${msg}`);
    }
  });

  console.log(`Mapped ${rows.length} awakeners from ${absolute}`);
  console.log("Sample (first row):", JSON.stringify(rows[0], null, 2));

  if (dryRun) {
    console.log(
      "\nDry run — no database writes.",
      "\nTo insert, run:",
      '\n  npm run import:awakeners:execute -- "' + absolute + '"',
    );
    return;
  }

  const supabase = createAdminClient();
  const { data: inserted, error } = await supabase
    .from("awakener")
    .insert(rows)
    .select("id, name");

  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }

  console.log(`Inserted ${inserted?.length ?? 0} rows.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
