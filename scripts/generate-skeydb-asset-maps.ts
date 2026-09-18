import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SKEYDB_COMMIT } from "../src/lib/assets/skeydb-base";

type NamedRow = { name: string };

type CatalogRecord = {
  id: string;
  name: string;
  assets?: { icon?: string };
  route?: { slug?: string };
};

type CatalogFile = {
  records: CatalogRecord[];
};

/** SKeyDB relic record file (`records/relics/relic-####.json`), variants trimmed. */
type RelicRecordFile = {
  id: string;
  name: string;
  route?: { slug?: string };
  variants?: {
    id: string;
    tier?: string;
    category?: string;
  }[];
};

/** Static SKeyDB deep-link data for one relic family. */
type RelicLinkEntry = {
  slug: string;
  category: string;
  variants: Record<string, string>;
};

/** Astral Reign is the only relic category MotherTree models. */
const RELIC_CATEGORY = "ASTRAL_REIGN";

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
const ASSET_NAMES_DIR = join(ROOT, "sample-data/skeydb-asset-names");

const RAW_BASE = `https://raw.githubusercontent.com/dansa/SKeyDB/${SKEYDB_COMMIT}`;

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function basenameWithoutExt(path: string): string {
  const filename = path.split("/").at(-1) ?? path;
  return filename.replace(/\.(webp|png)$/i, "");
}

function readMotherTreeNames(table: string): string[] {
  const filePath = join(ASSET_NAMES_DIR, `${table}.json`);
  if (!existsSync(filePath)) {
    throw new Error(
      `Missing ${filePath}. Run: npm run db:dump-skeydb-assets (or npm run sync:skeydb-assets)`,
    );
  }
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

function writeRelicLinkMap(data: Record<string, RelicLinkEntry>) {
  const path = join(MAPS_DIR, "relic-skeydb-links.json");
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path} (${Object.keys(data).length} entries)`);
}

/** Run an async mapper over `items` with a bounded number of in-flight calls. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index]!);
    }
  }
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Build `normalized name -> { slug, category, variants }` for every MotherTree
 * relic. The catalog only carries `defaultVariantId`, so each family's record
 * file is fetched to resolve the Astral Reign variant id per tier (Gold /
 * Cursed), which the picker combines with `relic.tier` to deep-link SKeyDB.
 */
async function buildRelicLinkMap(
  relicsCatalog: CatalogFile,
): Promise<Record<string, RelicLinkEntry>> {
  const names = readMotherTreeNames("relic");
  const recordByName = new Map<string, CatalogRecord>();
  for (const record of relicsCatalog.records) {
    recordByName.set(normalizeNameKey(record.name), record);
  }

  const missing: string[] = [];
  const resolved: { name: string; key: string; record: CatalogRecord }[] = [];
  for (const name of names) {
    const key = normalizeNameKey(name);
    const record = recordByName.get(key);
    if (!record) {
      missing.push(name);
      continue;
    }
    resolved.push({ name, key, record });
  }
  if (missing.length > 0) {
    console.error(`Unmatched relic names (${missing.length}):`);
    for (const name of missing) console.error(`  - ${name}`);
    throw new Error("Failed to map all MotherTree relic names to SKeyDB links");
  }

  const uniqueIds = [...new Set(resolved.map((row) => row.record.id))];
  const recordById = new Map<string, RelicRecordFile>();
  await mapWithConcurrency(uniqueIds, 8, async (id) => {
    const record = await fetchJson<RelicRecordFile>(
      `src/data/public-v3/records/relics/${id}.json`,
    );
    recordById.set(id, record);
  });

  const out: Record<string, RelicLinkEntry> = {};
  for (const { key, record } of resolved) {
    const file = recordById.get(record.id);
    const slug = file?.route?.slug ?? record.route?.slug;
    if (!slug) {
      throw new Error(`Missing SKeyDB slug for relic "${record.name}"`);
    }
    const variants: Record<string, string> = {};
    for (const variant of file?.variants ?? []) {
      if (variant.category !== RELIC_CATEGORY) continue;
      if (!variant.tier || !variant.id) continue;
      variants[variant.tier] = variant.id;
    }
    if (Object.keys(variants).length === 0) {
      throw new Error(
        `No ${RELIC_CATEGORY} variant found for relic "${record.name}"`,
      );
    }
    out[key] = { slug, category: RELIC_CATEGORY, variants };
  }

  return Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => a.localeCompare(b)),
  );
}

async function main() {
  if (!existsSync(ASSET_NAMES_DIR)) {
    throw new Error(
      `Missing ${ASSET_NAMES_DIR}. Run: npm run db:dump-skeydb-assets (or npm run sync:skeydb-assets)`,
    );
  }

  console.log(`Using MotherTree asset names: ${ASSET_NAMES_DIR}`);
  console.log(`SKeyDB commit: ${SKEYDB_COMMIT}`);

  const [
    wheelsCatalog,
    covenantsCatalog,
    possesCatalog,
    relicsCatalog,
    assetsIndex,
  ] = await Promise.all([
    fetchJson<CatalogFile>("src/data/public-v3/catalogs/wheels.json"),
    fetchJson<CatalogFile>("src/data/public-v3/catalogs/covenants.json"),
    fetchJson<CatalogFile>("src/data/public-v3/catalogs/posses.json"),
    fetchJson<CatalogFile>("src/data/public-v3/catalogs/relics.json"),
    fetchJson<AssetsIndex>("src/data/public-v3/indexes/assets.json"),
  ]);

  const wheelSkey = buildNameToAssetMap(wheelsCatalog, assetsIndex);
  const covenantSkey = buildNameToAssetMap(covenantsCatalog, assetsIndex);
  const posseSkey = buildNameToAssetMap(possesCatalog, assetsIndex);
  const relicSkey = buildNameToAssetMap(relicsCatalog, assetsIndex);

  const wheelMap = joinMaps(readMotherTreeNames("wheel"), wheelSkey, "wheel");
  const covenantMap = joinMaps(
    readMotherTreeNames("covenant"),
    covenantSkey,
    "covenant",
  );
  const posseMap = joinMaps(readMotherTreeNames("posse"), posseSkey, "posse");
  const relicMap = joinMaps(readMotherTreeNames("relic"), relicSkey, "relic");

  writeMap("wheel-by-name.json", wheelMap);
  writeMap("covenant-by-name.json", covenantMap);
  writeMap("posse-by-name.json", posseMap);
  writeMap("relic-by-name.json", relicMap);

  console.log("Building relic SKeyDB deep links…");
  const relicLinks = await buildRelicLinkMap(relicsCatalog);
  writeRelicLinkMap(relicLinks);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
