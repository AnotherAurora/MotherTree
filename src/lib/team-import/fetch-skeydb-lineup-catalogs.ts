import { SKEYDB_COMMIT } from "@/lib/assets/skeydb-base";
import { fetchSkeydbJson } from "@/lib/gear-audit/constants";
import type { SkeydbLineupCatalogFile, SkeydbLineupCatalogs } from "./types";

const CATALOG_PATHS = {
  awakeners: "src/data/public-v3/catalogs/awakeners.json",
  wheels: "src/data/public-v3/catalogs/wheels.json",
  covenants: "src/data/public-v3/catalogs/covenants.json",
  posses: "src/data/public-v3/catalogs/posses.json",
} as const;

const cache = new Map<string, Promise<SkeydbLineupCatalogs>>();

async function fetchCatalog(
  sha: string,
  path: string,
): Promise<SkeydbLineupCatalogFile> {
  return fetchSkeydbJson<SkeydbLineupCatalogFile>(sha, path);
}

export async function fetchSkeydbLineupCatalogs(
  commit: string = SKEYDB_COMMIT,
): Promise<SkeydbLineupCatalogs> {
  const cached = cache.get(commit);
  if (cached) {
    return cached;
  }

  const promise = Promise.all([
    fetchCatalog(commit, CATALOG_PATHS.awakeners),
    fetchCatalog(commit, CATALOG_PATHS.wheels),
    fetchCatalog(commit, CATALOG_PATHS.covenants),
    fetchCatalog(commit, CATALOG_PATHS.posses),
  ]).then(([awakeners, wheels, covenants, posses]) => ({
    awakeners,
    wheels,
    covenants,
    posses,
  }));

  cache.set(commit, promise);
  return promise;
}
