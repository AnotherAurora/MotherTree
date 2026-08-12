/**
 * Refresh SKeyDB asset pin + name→icon maps for Search / Path Carver.
 *
 * 1. Slim-dump wheel/covenant/posse names from live DB
 * 2. Bump SKEYDB_COMMIT to latest main (or CLI SHA)
 * 3. Regenerate src/lib/assets/maps/*-by-name.json
 *
 * Usage:
 *   npm run sync:skeydb-assets
 *   npx tsx --env-file=.env.local scripts/sync-skeydb-assets.ts <fullSha>
 *
 * See docs/admin/updating-skeydb-assets.md
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const SKEYDB_BASE_PATH = resolve(ROOT, "src/lib/assets/skeydb-base.ts");
const SKEYDB_REPO = "dansa/SKeyDB";
const COMMIT_RE = /^[0-9a-f]{7,40}$/i;

function runNpmScript(script: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("npm", ["run", script], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: process.env,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`npm run ${script} exited with code ${code ?? "null"}`));
    });
  });
}

function readCurrentCommit(): string {
  const source = readFileSync(SKEYDB_BASE_PATH, "utf8");
  const match = source.match(
    /export const SKEYDB_COMMIT = "([0-9a-f]{7,40})";/i,
  );
  if (!match?.[1]) {
    throw new Error(`Could not find SKEYDB_COMMIT in ${SKEYDB_BASE_PATH}`);
  }
  return match[1];
}

function writeCommit(sha: string): void {
  const source = readFileSync(SKEYDB_BASE_PATH, "utf8");
  const next = source.replace(
    /export const SKEYDB_COMMIT = "[0-9a-f]{7,40}";/i,
    `export const SKEYDB_COMMIT = "${sha}";`,
  );
  if (next === source) {
    throw new Error(`Failed to update SKEYDB_COMMIT in ${SKEYDB_BASE_PATH}`);
  }
  writeFileSync(SKEYDB_BASE_PATH, next, "utf8");
}

async function fetchLatestMainSha(): Promise<string> {
  const url = `https://api.github.com/repos/${SKEYDB_REPO}/commits/main`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "MotherTree-sync-skeydb-assets",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch latest SKeyDB commit: ${response.status} ${response.statusText}`,
    );
  }
  const body = (await response.json()) as { sha?: string };
  if (!body.sha || !COMMIT_RE.test(body.sha)) {
    throw new Error("GitHub API response missing a valid commit sha");
  }
  return body.sha;
}

function resolveTargetSha(arg: string | undefined): Promise<string> {
  if (arg == null || arg.trim() === "") {
    return fetchLatestMainSha();
  }
  const sha = arg.trim().toLowerCase();
  if (!COMMIT_RE.test(sha)) {
    throw new Error(
      `Invalid commit SHA "${arg}". Pass a 7–40 character hex SHA, or omit for latest main.`,
    );
  }
  return Promise.resolve(sha);
}

async function main() {
  console.log("Step 1/3: dumping wheel/covenant/posse names…");
  await runNpmScript("db:dump-skeydb-assets");

  const oldSha = readCurrentCommit();
  const argSha = process.argv[2];
  const newSha = await resolveTargetSha(argSha);

  console.log(`Step 2/3: SKeyDB pin ${oldSha} → ${newSha}`);
  if (oldSha.toLowerCase() !== newSha.toLowerCase()) {
    writeCommit(newSha);
  } else {
    console.log("  (pin unchanged; regenerating maps from current dump)");
  }

  console.log("Step 3/3: regenerating asset maps…");
  await runNpmScript("generate:skeydb-assets");

  console.log("\nSync complete.");
  console.log(`  SKEYDB_COMMIT: ${newSha}`);
  console.log("  Commit: src/lib/assets/skeydb-base.ts, src/lib/assets/maps/*, sample-data/skeydb-asset-names/*");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`sync:skeydb-assets failed: ${message}`);
  process.exit(1);
});
