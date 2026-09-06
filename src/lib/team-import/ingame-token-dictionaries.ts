import type {
  SkeydbLineupCatalogFile,
  SkeydbLineupCatalogs,
} from "./types";

export type IngameTokenCategory = "awakeners" | "wheels" | "covenants" | "posses";

export type IngameTokenDictionaryBuildResult = {
  byIdToken: Map<string, string>;
  byTokenId: Map<string, string>;
  byTokenIds: Map<string, string[]>;
};

export type IngameTokenDictionaries = {
  awakeners: IngameTokenDictionaryBuildResult;
  wheels: IngameTokenDictionaryBuildResult;
  covenants: IngameTokenDictionaryBuildResult;
  posses: IngameTokenDictionaryBuildResult;
};

function buildTokenDictionaryFromCatalog(
  catalog: SkeydbLineupCatalogFile,
): IngameTokenDictionaryBuildResult {
  const provisionalByIdToken = new Map<string, string>();
  const provisionalByTokenIds = new Map<string, string[]>();

  for (const entry of catalog.records) {
    if (!entry.id || !entry.lineupToken) {
      continue;
    }

    provisionalByIdToken.set(entry.id, entry.lineupToken);
    const existing = provisionalByTokenIds.get(entry.lineupToken) ?? [];
    existing.push(entry.id);
    provisionalByTokenIds.set(entry.lineupToken, existing);
  }

  const byIdToken = new Map<string, string>(provisionalByIdToken);
  const byTokenId = new Map<string, string>();

  for (const [token, mappedIds] of provisionalByTokenIds) {
    if (mappedIds.length === 1) {
      byTokenId.set(token, mappedIds[0]!);
    }
  }

  return {
    byIdToken,
    byTokenId,
    byTokenIds: provisionalByTokenIds,
  };
}

export function buildIngameTokenDictionaries(
  catalogs: SkeydbLineupCatalogs,
): IngameTokenDictionaries {
  return {
    awakeners: buildTokenDictionaryFromCatalog(catalogs.awakeners),
    wheels: buildTokenDictionaryFromCatalog(catalogs.wheels),
    covenants: buildTokenDictionaryFromCatalog(catalogs.covenants),
    posses: buildTokenDictionaryFromCatalog(catalogs.posses),
  };
}
