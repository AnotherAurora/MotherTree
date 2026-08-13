/**
 * Generate an idempotent SQL datapatch for awakener.con/atk/def under Path Carver
 * investment assumptions:
 *   - Awakener level 60
 *   - Soulforge lv10 (clamped to talent max; 0 if absent)
 *   - Gnostic Potential lv0, except limited awakeners (SKeyDB defaultMaxed → lv5)
 *
 * Talent files are resolved via SKeyDB relationships.ownedTalents (slug filenames can
 * differ from route.slug, e.g. Jenkin → talent.jenkins.*).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/generate-awakener-primary-stats-datapatch.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SKEYDB_COMMIT } from "../src/lib/assets/skeydb-base";
import type { Database } from "../src/lib/database.types";

const ROOT = resolve(process.cwd());
const RAW_BASE = `https://raw.githubusercontent.com/dansa/SKeyDB/${SKEYDB_COMMIT}`;
const AWAKENER_LEVEL = 60;
const TARGET_SOULFORGE_LEVEL = 10;
const PRIMARY_STAT_EPSILON = 1e-9;
const PRIMARY_KEYS = ["CON", "ATK", "DEF"] as const;
type PrimaryKey = (typeof PRIMARY_KEYS)[number];

type LinearArg = {
  kind: "linear";
  base: string;
  gainPerLevel: string;
};

type ScalingArg = {
  kind: "scaling";
  values: string[];
};

type DescriptionArg = LinearArg | ScalingArg | { kind: string; [key: string]: unknown };

type TalentRecord = {
  id: string;
  family?: string;
  maxLevel?: number;
  defaultMaxed?: boolean;
  descriptionArgs?: Record<string, DescriptionArg>;
};

type CatalogAwakener = {
  id: string;
  name: string;
  route: { slug: string };
  primaryScalingBase: number;
  statScaling: Record<PrimaryKey, number>;
};

type CatalogFile = {
  records: CatalogAwakener[];
};

type RelationshipsIndex = {
  forward: Record<string, { ownedTalents?: string[] }>;
};

type MotherTreeAwakener = {
  id: number;
  name: string;
  con: number | null;
  atk: number | null;
  def: number | null;
};

type ComputedStats = {
  con: number;
  atk: number;
  def: number;
  gnosticLevel: number;
  soulforgeLevel: number;
  soulforgeBonusPercent: number;
  limitedGnosticLv5: boolean;
};

function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  if (serviceRoleKey.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY looks like a publishable key. Use the Secret or service_role key.",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

function parseNumeric(raw: string | undefined): number {
  if (!raw) return 0;
  const parsed = Number(raw.trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveLinearArg(arg: LinearArg, rank: number): number {
  const clampedRank = Math.max(1, Math.floor(rank));
  return parseNumeric(arg.base) + parseNumeric(arg.gainPerLevel) * (clampedRank - 1);
}

function resolveDescriptionArgTotal(
  arg: DescriptionArg | undefined,
  rank: number,
): number | null {
  if (!arg) return null;
  if (arg.kind === "linear") {
    return resolveLinearArg(arg as LinearArg, rank);
  }
  if (arg.kind === "scaling") {
    const values = (arg as ScalingArg).values;
    const index = Math.max(0, Math.min(Math.floor(rank) - 1, values.length - 1));
    return parseNumeric(values[index]);
  }
  return null;
}

function resolvePrimaryStat(
  primaryScalingBase: number,
  growthPerLevel: number,
  level: number,
  gnosticBonusLevels: number,
): number {
  return Math.ceil(
    (primaryScalingBase + level + gnosticBonusLevels) * growthPerLevel -
      PRIMARY_STAT_EPSILON,
  );
}

function applySoulforgeBonus(baseValue: number, bonusPercent: number): number {
  if (!bonusPercent) return baseValue;
  return Math.ceil(baseValue * (1 + bonusPercent / 100) - PRIMARY_STAT_EPSILON);
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function loadMotherTreeAwakeners(
  supabase: SupabaseClient<Database>,
): Promise<MotherTreeAwakener[]> {
  const { data, error } = await supabase
    .from("awakener")
    .select("id, name, con, atk, def")
    .is("deleted_at", null)
    .order("id");

  if (error) {
    throw new Error(`Failed to load Mother Tree awakeners: ${error.message}`);
  }

  return (data ?? []) as MotherTreeAwakener[];
}

function findOwnedTalentId(
  ownedTalents: string[] | undefined,
  familySuffix: "gnostic-potential" | "soulforge-aptitude",
): string | undefined {
  return ownedTalents?.find((id) => id.endsWith(`.${familySuffix}`));
}

async function loadTalentById(talentId: string | undefined): Promise<TalentRecord | null> {
  if (!talentId) return null;
  return fetchJson<TalentRecord>(
    `${RAW_BASE}/src/data/public-v3/records/talents/${talentId}.json`,
  );
}

async function computeStatsForCatalogAwakener(
  catalog: CatalogAwakener,
  ownedTalents: string[] | undefined,
): Promise<ComputedStats> {
  const gnosticId = findOwnedTalentId(ownedTalents, "gnostic-potential");
  const soulforgeId = findOwnedTalentId(ownedTalents, "soulforge-aptitude");
  const [gnostic, soulforge] = await Promise.all([
    loadTalentById(gnosticId),
    loadTalentById(soulforgeId),
  ]);

  const limitedGnosticLv5 = Boolean(gnostic?.defaultMaxed);
  const gnosticMax = gnostic?.maxLevel ?? 5;
  const gnosticLevel = limitedGnosticLv5 ? gnosticMax : 0;

  let gnosticBonusLevels = 0;
  if (gnosticLevel > 0 && gnostic?.descriptionArgs?.Arg1) {
    gnosticBonusLevels =
      resolveDescriptionArgTotal(gnostic.descriptionArgs.Arg1, gnosticLevel) ?? 0;
  }

  const soulforgeMax = soulforge?.maxLevel ?? 0;
  const soulforgeLevel =
    soulforge && soulforgeMax > 0
      ? Math.min(TARGET_SOULFORGE_LEVEL, soulforgeMax)
      : 0;

  let soulforgeBonusPercent = 0;
  if (soulforgeLevel > 0 && soulforge?.descriptionArgs?.Arg1) {
    soulforgeBonusPercent =
      resolveDescriptionArgTotal(soulforge.descriptionArgs.Arg1, soulforgeLevel) ??
      0;
  }

  const raw: Record<PrimaryKey, number> = {
    CON: resolvePrimaryStat(
      catalog.primaryScalingBase,
      catalog.statScaling.CON,
      AWAKENER_LEVEL,
      gnosticBonusLevels,
    ),
    ATK: resolvePrimaryStat(
      catalog.primaryScalingBase,
      catalog.statScaling.ATK,
      AWAKENER_LEVEL,
      gnosticBonusLevels,
    ),
    DEF: resolvePrimaryStat(
      catalog.primaryScalingBase,
      catalog.statScaling.DEF,
      AWAKENER_LEVEL,
      gnosticBonusLevels,
    ),
  };

  return {
    con: applySoulforgeBonus(raw.CON, soulforgeBonusPercent),
    atk: applySoulforgeBonus(raw.ATK, soulforgeBonusPercent),
    def: applySoulforgeBonus(raw.DEF, soulforgeBonusPercent),
    gnosticLevel,
    soulforgeLevel,
    soulforgeBonusPercent,
    limitedGnosticLv5,
  };
}

function migrationTimestamp(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}${hh}${mm}${ss}`;
}

async function main() {
  console.log(`SKeyDB commit: ${SKEYDB_COMMIT}`);
  console.log(
    `Assumptions: awakener lv${AWAKENER_LEVEL}, soulforge lv${TARGET_SOULFORGE_LEVEL}, gnostic lv0 except limited (defaultMaxed → lv5)`,
  );

  const [catalog, relationships] = await Promise.all([
    fetchJson<CatalogFile>(`${RAW_BASE}/src/data/public-v3/catalogs/awakeners.json`),
    fetchJson<RelationshipsIndex>(
      `${RAW_BASE}/src/data/public-v3/indexes/relationships.json`,
    ),
  ]);
  if (!catalog?.records?.length) {
    throw new Error("Failed to load SKeyDB awakeners catalog");
  }
  if (!relationships?.forward) {
    throw new Error("Failed to load SKeyDB relationships index");
  }

  const skeyByName = new Map<string, CatalogAwakener>();
  for (const record of catalog.records) {
    skeyByName.set(record.name, record);
  }

  const supabase = createAdminClient();
  const motherTreeRows = await loadMotherTreeAwakeners(supabase);
  console.log(`Mother Tree alive awakeners: ${motherTreeRows.length}`);
  console.log(`SKeyDB catalog awakeners: ${catalog.records.length}`);

  const unmatched: string[] = [];
  const limitedNames: string[] = [];
  const changed: Array<{
    id: number;
    name: string;
    before: string;
    after: string;
    gnosticLevel: number;
  }> = [];
  const updateLines: string[] = [];

  // Sequential talent fetches to avoid hammering GitHub; catalog is small (~59).
  for (const row of motherTreeRows) {
    const catalogRow = skeyByName.get(row.name);
    if (!catalogRow) {
      unmatched.push(row.name);
      continue;
    }

    const ownedTalents = relationships.forward[catalogRow.id]?.ownedTalents;
    const computed = await computeStatsForCatalogAwakener(catalogRow, ownedTalents);
    if (computed.limitedGnosticLv5) {
      limitedNames.push(row.name);
    }

    const before = `${row.con}/${row.atk}/${row.def}`;
    const after = `${computed.con}/${computed.atk}/${computed.def}`;
    if (row.con !== computed.con || row.atk !== computed.atk || row.def !== computed.def) {
      changed.push({
        id: row.id,
        name: row.name,
        before,
        after,
        gnosticLevel: computed.gnosticLevel,
      });
    }

    updateLines.push(
      [
        `-- ${row.name} (gnostic lv${computed.gnosticLevel}, soulforge lv${computed.soulforgeLevel}, +${computed.soulforgeBonusPercent}%)`,
        `UPDATE public.awakener`,
        `SET`,
        `  con = ${computed.con},`,
        `  atk = ${computed.atk},`,
        `  def = ${computed.def},`,
        `  updated_at = NOW()`,
        `WHERE id = ${row.id}`,
        `  AND deleted_at IS NULL`,
        `  AND name = ${sqlString(row.name)};`,
        ``,
      ].join("\n"),
    );
  }

  if (unmatched.length > 0) {
    console.error(`Unmatched Mother Tree awakeners (${unmatched.length}):`);
    for (const name of unmatched) {
      console.error(`  - ${JSON.stringify(name)}`);
    }
    throw new Error("Aborting: every alive Mother Tree awakener must match SKeyDB by exact name");
  }

  const stamp = migrationTimestamp();
  const filename = `${stamp}_awakener_primary_stats_gnostic_limited_lv5_datapatch.sql`;
  const outPath = join(ROOT, "supabase", "migrations", filename);

  const header = [
    `-- Path Carver primary-stat bake-in (idempotent absolute SET).`,
    `-- Source: SKeyDB ${SKEYDB_COMMIT}`,
    `-- Assumptions:`,
    `--   Awakener level ${AWAKENER_LEVEL}`,
    `--   Soulforge lv${TARGET_SOULFORGE_LEVEL} (clamped to talent max; 0 if absent)`,
    `--   Gnostic Potential lv0, except limited awakeners who are lv5 (SKeyDB defaultMaxed)`,
    `-- Generated by scripts/generate-awakener-primary-stats-datapatch.ts`,
    `-- Re-running is safe (absolute values, not multipliers).`,
    ``,
    `-- Limited / gnostic lv5 (${limitedNames.length}): ${limitedNames.join(", ")}`,
    ``,
    ``,
  ].join("\n");

  writeFileSync(outPath, header + updateLines.join("\n"), "utf8");

  console.log(`Wrote ${outPath}`);
  console.log(`Limited (gnostic lv5): ${limitedNames.length}`);
  console.log(`Changed rows: ${changed.length} / ${motherTreeRows.length}`);
  for (const row of changed.slice(0, 40)) {
    console.log(
      `  ${row.name}: ${row.before} -> ${row.after} (gnostic lv${row.gnosticLevel})`,
    );
  }
  if (changed.length > 40) {
    console.log(`  ... and ${changed.length - 40} more`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
