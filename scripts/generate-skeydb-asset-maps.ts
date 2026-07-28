import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SKEYDB_COMMIT } from "../src/lib/assets/skeydb-base";

type NamedRow = { name: string };

type CatalogRecord = {
  id: string;
  name: string;
  assets?: { icon?: string };
};

type CatalogFile = {
  records: CatalogRecord[];
};

type AssetAvailability = {
  status: string;
  path?: string;
};

type AssetRecord = {
  id: string;
  assetId: string;
  availability?: AssetAvailability;
};

type AssetsIndex = {
  assets: Record<string, AssetRecord>;
};

const ROOT = resolve(process.cwd());
const MAPS_DIR = join(ROOT, "src/lib/assets/maps");
const DUMPS_DIR = join(ROOT, "sample-data/dumps");

const RAW_BASE = `https://raw.githubusercontent.com/dansa/SKeyDB/${SKEYDB_COMMIT}`;

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function basenameWithoutExt(path: string): string {
  const filename = path.split("/").at(-1) ?? path;
  return filename.replace(/\.(webp|png)$/i, "");
}

function latestDumpDate(): string {
  const dates = readdirSync(DUMPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .sort();
  const latest = dates.at(-1);
  if (!latest) {
    throw new Error(`No dated dumps found under ${DUMPS_DIR}`);
  }
  return latest;
}

function readMotherTreeNames(dumpDate: string, table: string): string[] {
  const filePath = join(DUMPS_DIR, dumpDate, `${table}.json`);
  const rows = JSON.parse(readFileSync(filePath, "utf8")) as NamedRow[];
  return rows.map((row) => row.name).filter((name) => typeof name === "string");
}

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${RAW_BASE}/${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

function resolveAssetBasename(
  assetsIndex: AssetsIndex,
  assetRef: string | undefined,
): string | undefined {
  if (!assetRef) return undefined;
  const record = assetsIndex.assets[assetRef];
  if (!record) return undefined;
  const path = record.availability?.path;
  if (path) {
    return basenameWithoutExt(path);
  }
  return record.assetId || undefined;
}

function buildNameToAssetMap(
  catalog: CatalogFile,
  assetsIndex: AssetsIndex,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const record of catalog.records) {
    const basename = resolveAssetBasename(assetsIndex, record.assets?.icon);
    if (!basename) continue;
    map.set(normalizeNameKey(record.name), basename);
  }
  return map;
}

function joinMaps(
  motherTreeNames: string[],
  skeydbByName: Map<string, string>,
  label: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  const missing: string[] = [];

  for (const name of motherTreeNames) {
    const key = normalizeNameKey(name);
    const assetId = skeydbByName.get(key);
    if (!assetId) {
      missing.push(name);
      continue;
    }
    out[key] = assetId;
  }

  if (missing.length > 0) {
    console.error(`Unmatched ${label} names (${missing.length}):`);
    for (const name of missing) {
      console.error(`  - ${name}`);
    }
    throw new Error(`Failed to map all MotherTree ${label} names to SKeyDB assets`);
  }

  return Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => a.localeCompare(b)),
  );
}

function writeMap(filename: string, data: Record<string, string>) {
  const path = join(MAPS_DIR, filename);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path} (${Object.keys(data).length} entries)`);
}

async function main() {
  const dumpDate = latestDumpDate();
  console.log(`Using MotherTree dump: ${dumpDate}`);
  console.log(`SKeyDB commit: ${SKEYDB_COMMIT}`);

  const [wheelsCatalog, covenantsCatalog, possesCatalog, assetsIndex] =
    await Promise.all([
      fetchJson<CatalogFile>("src/data/public-v3/catalogs/wheels.json"),
      fetchJson<CatalogFile>("src/data/public-v3/catalogs/covenants.json"),
      fetchJson<CatalogFile>("src/data/public-v3/catalogs/posses.json"),
      fetchJson<AssetsIndex>("src/data/public-v3/indexes/assets.json"),
    ]);

  const wheelSkey = buildNameToAssetMap(wheelsCatalog, assetsIndex);
  const covenantSkey = buildNameToAssetMap(covenantsCatalog, assetsIndex);
  const posseSkey = buildNameToAssetMap(possesCatalog, assetsIndex);

  const wheelMap = joinMaps(
    readMotherTreeNames(dumpDate, "wheel"),
    wheelSkey,
    "wheel",
  );
  const covenantMap = joinMaps(
    readMotherTreeNames(dumpDate, "covenant"),
    covenantSkey,
    "covenant",
  );
  const posseMap = joinMaps(
    readMotherTreeNames(dumpDate, "posse"),
    posseSkey,
    "posse",
  );

  writeMap("wheel-by-name.json", wheelMap);
  writeMap("covenant-by-name.json", covenantMap);
  writeMap("posse-by-name.json", posseMap);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
