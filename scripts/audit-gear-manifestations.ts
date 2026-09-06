/**
 * Deterministic full-table gear manifestation audit (SKeyDB vs MotherTree).
 *
 * Usage:
 *   npm run gear:audit
 *   npm run gear:audit -- --kind wheel
 *   npm run gear:audit -- --kind all --include-needs-review
 *
 * Prerequisite: npm run gear:export (writes full.skeydb.json + full.mothertree.json)
 *
 * Exits 1 when definite or suspicious findings remain (needs_review alone does not fail).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasBlockingFindings, runGearAudit } from "../src/lib/gear-audit/audit-run";
import type { GearAuditKind } from "../src/lib/gear-audit/finding-schema";
import {
  findingsFullAbsolutePath,
  mothertreeFullPackAbsolutePath,
  skeydbFullPackAbsolutePath,
} from "../src/lib/gear-audit/paths";
import {
  parseMothertreeGearPack,
  parseSkeydbGearPack,
} from "../src/lib/gear-audit/pack-schema";

const ALL_KINDS: GearAuditKind[] = ["posse", "wheel", "covenant"];

type AuditOptions = {
  kinds: GearAuditKind[];
  includeNeedsReview: boolean;
};

function parseArgs(argv: string[]): AuditOptions {
  let kinds: GearAuditKind[] = [...ALL_KINDS];
  let includeNeedsReview = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--kind") {
      const value = argv[++i];
      if (value === "all") kinds = [...ALL_KINDS];
      else if (value === "posse" || value === "wheel" || value === "covenant") kinds = [value];
      else throw new Error(`Invalid --kind "${value}". Use posse, wheel, covenant, or all.`);
    } else if (arg === "--include-needs-review") {
      includeNeedsReview = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: npm run gear:audit [-- options]

Options:
  --kind KIND                 posse | wheel | covenant | all (default: all)
  --include-needs-review      Exit 1 when needs_review findings exist too

Convenience: npm run gear:audit -- wheel
`);
      process.exit(0);
    } else if (!arg.startsWith("-") && kinds.length === ALL_KINDS.length) {
      if (arg === "all") kinds = [...ALL_KINDS];
      else if (arg === "posse" || arg === "wheel" || arg === "covenant") kinds = [arg];
    }
  }

  return { kinds, includeNeedsReview };
}

function loadPacks(root: string, kind: GearAuditKind) {
  const skeydbPath = skeydbFullPackAbsolutePath(root, kind);
  const mtPath = mothertreeFullPackAbsolutePath(root, kind);

  if (!existsSync(skeydbPath)) {
    throw new Error(`Missing ${skeydbPath}. Run: npm run gear:export -- --kind ${kind}`);
  }
  if (!existsSync(mtPath)) {
    throw new Error(`Missing ${mtPath}. Run: npm run gear:export -- --kind ${kind}`);
  }

  const skeydbPack = parseSkeydbGearPack(
    JSON.parse(readFileSync(skeydbPath, "utf8")) as unknown,
  );
  const mtPack = parseMothertreeGearPack(
    JSON.parse(readFileSync(mtPath, "utf8")) as unknown,
  );
  return { skeydbPack, mtPack };
}

function printSummary(kind: GearAuditKind, result: ReturnType<typeof runGearAudit>): void {
  const { stats, summary } = result;
  console.log(`\n=== ${kind} ===`);
  console.log(
    `  Parents: SKeyDB=${stats.skeydbParentCount}  MT alive=${stats.mothertreeAliveParentCount}  matched=${stats.matchedParents}`,
  );
  console.log(
    `  Missing: in DB=${stats.missingInDb}  in SKeyDB=${stats.missingInSkeydb}  manifestations=${stats.manifestationCount}`,
  );
  console.log(
    `  Findings: definite=${summary.definite}  suspicious=${summary.suspicious}  needs_review=${summary.needsReview}`,
  );
}

async function auditKind(
  root: string,
  kind: GearAuditKind,
): Promise<ReturnType<typeof runGearAudit>> {
  const { skeydbPack, mtPack } = loadPacks(root, kind);
  const result = runGearAudit(skeydbPack, mtPack);
  const outPath = findingsFullAbsolutePath(root, kind);
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  printSummary(kind, result);
  console.log(`  Wrote ${outPath}`);

  if (result.summary.definite > 0) {
    console.log("\n  Definite findings (first 10):");
    for (const finding of result.findings
      .filter((f) => f.severity === "definite")
      .slice(0, 10)) {
      console.log(`    [${finding.category}] ${finding.parentName}: ${finding.message}`);
    }
  }

  return result;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const root = resolve(process.cwd());
  const results: ReturnType<typeof runGearAudit>[] = [];

  for (const kind of opts.kinds) {
    results.push(await auditKind(root, kind));
  }

  const blocked = results.some((r) => hasBlockingFindings(r));
  const needsReviewBlocked =
    opts.includeNeedsReview && results.some((r) => r.summary.needsReview > 0);

  if (blocked || needsReviewBlocked) {
    console.log("\nAudit FAILED (blocking findings remain).");
    process.exit(1);
  }

  console.log("\nAudit OK (no definite/suspicious findings).");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
