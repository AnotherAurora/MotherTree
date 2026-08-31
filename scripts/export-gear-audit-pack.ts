/**
 * Export full-table gear audit packs (SKeyDB + MotherTree) for posse / wheel / covenant.
 *
 * Usage:
 *   npm run gear:export
 *   npm run gear:export -- --kind wheel
 *   npm run gear:export -- --kind all --skeydb-sha abc1234
 *
 * Output (per kind under sample-data/gear-audit/{kind}/):
 *   full.skeydb.json     — SKeyDB catalog + all records at chosen commit
 *   full.mothertree.json — live Supabase parents + manifestations + tag/realm joins
 *
 * Default SKeyDB commit: latest main on dansa/SKeyDB.
 * Requires .env.local with Supabase service role for MotherTree export.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchLatestSkeydbMainSha, COMMIT_RE } from "../src/lib/gear-audit/constants";
import type { GearAuditKind } from "../src/lib/gear-audit/finding-schema";
import { buildMothertreeGearPack } from "../src/lib/gear-audit/mothertree-export";
import {
  findingsFullAbsolutePath,
  gearAuditDirAbsolute,
  mothertreeFullPackAbsolutePath,
  skeydbFullPackAbsolutePath,
} from "../src/lib/gear-audit/paths";
import { buildSkeydbGearPack } from "../src/lib/gear-audit/skeydb-export";

const ALL_KINDS: GearAuditKind[] = ["posse", "wheel", "covenant"];

type ExportOptions = {
  kinds: GearAuditKind[];
  skeydbSha: string | null;
};

function parseArgs(argv: string[]): ExportOptions {
  let kinds: GearAuditKind[] = [...ALL_KINDS];
  let skeydbSha: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--kind") {
      const value = argv[++i];
      if (value === "all") {
        kinds = [...ALL_KINDS];
      } else if (value === "posse" || value === "wheel" || value === "covenant") {
        kinds = [value];
      } else {
        throw new Error(`Invalid --kind "${value}". Use posse, wheel, covenant, or all.`);
      }
    } else if (arg === "--skeydb-sha") {
      skeydbSha = argv[++i] ?? null;
      if (!skeydbSha || !COMMIT_RE.test(skeydbSha)) {
        throw new Error("Invalid --skeydb-sha (expected 7–40 hex chars).");
      }
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: npm run gear:export [-- options]

Options:
  --kind KIND       posse | wheel | covenant | all (default: all)
  --skeydb-sha SHA  Pin SKeyDB commit (default: latest main)

Convenience: npm run gear:export -- wheel
`);
      process.exit(0);
    } else if (!arg.startsWith("-") && kinds.length === ALL_KINDS.length) {
      if (arg === "all") kinds = [...ALL_KINDS];
      else if (arg === "posse" || arg === "wheel" || arg === "covenant") kinds = [arg];
    }
  }

  return { kinds, skeydbSha };
}

async function exportKind(root: string, kind: GearAuditKind, sha: string): Promise<void> {
  const outDir = gearAuditDirAbsolute(root, kind);
  mkdirSync(outDir, { recursive: true });

  console.log(`\n[${kind}] Fetching SKeyDB @ ${sha.slice(0, 7)}…`);
  const skeydbPack = await buildSkeydbGearPack(kind, sha);
  const skeydbPath = skeydbFullPackAbsolutePath(root, kind);
  writeFileSync(skeydbPath, `${JSON.stringify(skeydbPack, null, 2)}\n`, "utf8");
  console.log(
    `  SKeyDB: ${skeydbPack.catalog.length} catalog, ${Object.keys(skeydbPack.recordsById).length} records → ${skeydbPath}`,
  );

  console.log(`[${kind}] Exporting MotherTree from Supabase…`);
  const mtPack = await buildMothertreeGearPack(kind);
  const mtPath = mothertreeFullPackAbsolutePath(root, kind);
  writeFileSync(mtPath, `${JSON.stringify(mtPack, null, 2)}\n`, "utf8");
  const aliveParents = mtPack.parents.filter((p) => p.deleted_at == null).length;
  const aliveRows = mtPack.manifestations.filter((m) => m.deleted_at == null).length;
  console.log(
    `  MotherTree: ${aliveParents} alive parents, ${aliveRows} alive manifestations → ${mtPath}`,
  );
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const root = resolve(process.cwd());
  const sha = opts.skeydbSha ?? (await fetchLatestSkeydbMainSha());

  console.log(`Gear audit export — SKeyDB ${sha}`);
  console.log(`Kinds: ${opts.kinds.join(", ")}`);

  for (const kind of opts.kinds) {
    await exportKind(root, kind, sha);
  }

  console.log("\nExport complete. Run: npm run gear:audit");
  console.log(
    "Optional agent review: paste full-table prompt from docs/admin/gear-audit.md for needs_review follow-up.",
  );

  // Hint findings path (not written here)
  if (opts.kinds.length === 1) {
    console.log(`Findings path (after audit): ${findingsFullAbsolutePath(root, opts.kinds[0]!)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
