/**
 * Lightweight Public Search routing helpers.
 *
 * Kept separate from `solo-awakener-totals.ts` so the Search Worker does not
 * pull the Path Carver engine into its bundle: simulated values are read from
 * `search_solo_totals`, never computed at request time.
 */
import type { PublicRow } from "@/lib/public-read/allowlist";
import {
  SEARCH_REQUIRED_REALM_IDS,
  type SearchRequiredRealmId,
} from "@/lib/public/search-filter-options";

/** Multi-realm Search exception (display name without edge quotes). */
export const MULTI_REALM_AWAKENER_NAME = "24";

/** Match DB names like `"24"` the same way asset slug lookup strips edge quotes. */
export function normalizeAwakenerSearchName(
  name: string | null | undefined,
): string {
  return (name ?? "").trim().replace(/^["']|["']$/g, "");
}

export function isMultiRealmSearchAwakener(
  awakener: Pick<PublicRow<"awakener">, "name">,
): boolean {
  return normalizeAwakenerSearchName(awakener.name) === MULTI_REALM_AWAKENER_NAME;
}

/**
 * Realm ids to simulate for one awakener.
 * Non-"24": native realm only (empty if null / filtered out).
 * "24": all search realms, or the Required Realm filter alone.
 */
export function realmSimsForAwakener(
  awakener: PublicRow<"awakener">,
  requiredRealmId: SearchRequiredRealmId | null,
): number[] {
  if (isMultiRealmSearchAwakener(awakener)) {
    if (requiredRealmId != null) return [requiredRealmId];
    return [...SEARCH_REQUIRED_REALM_IDS];
  }
  if (awakener.realm == null) return [];
  if (requiredRealmId != null && awakener.realm !== requiredRealmId) {
    return [];
  }
  return [awakener.realm];
}

/**
 * True when Search should read precomputed solo rows. Only runs when a specific
 * tag filter is active and the expanded matching set contains at least one tag
 * flagged `is_search_simulated`. With no tag filter set (browse-all), flagged
 * tags are excluded from results; unflagged tags are served by direct rows.
 */
export function shouldRunSoloAwakenerTotals(
  matchingTagIds: Set<number> | null,
  tagsById: ReadonlyMap<number, PublicRow<"tag">>,
): boolean {
  if (matchingTagIds == null) return false;
  for (const id of matchingTagIds) {
    if (tagsById.get(id)?.is_search_simulated === true) return true;
  }
  return false;
}
