"use server";

import { headers } from "next/headers";
import { fetchPublicTable } from "@/lib/public-read/fetch";
import { checkPublicRateLimit } from "@/lib/public-read/rate-limit";
import type { PublicRow } from "@/lib/public-read/allowlist";
import {
  buildSearchResults,
  type SearchQueryFilters,
  type SearchResultRow,
} from "@/lib/public/search-results";
import type { SearchFromValue } from "@/lib/public/search-filter-options";

export type RunPublicSearchResult =
  | {
      success: true;
      rows: SearchResultRow[];
      truncated: boolean;
    }
  | { success: false; error: string };

async function clientIpKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return `ip:${first}`;
  }
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return `ip:${realIp}`;
  return "ip:unknown";
}

function isSearchFromValue(value: string): value is SearchFromValue {
  return (
    value === "awakener" ||
    value === "wheel" ||
    value === "posse" ||
    value === "covenant"
  );
}

/**
 * Guided public Search. One rate-limit hit per call; allowlisted reads only.
 */
export async function runPublicSearch(
  filters: SearchQueryFilters,
): Promise<RunPublicSearchResult> {
  const rate = checkPublicRateLimit(await clientIpKey());
  if (!rate.ok) {
    return {
      success: false,
      error: `Rate limit exceeded. Retry in ${Math.ceil(rate.retryAfterMs / 1000)}s`,
    };
  }

  const from =
    filters.from != null && isSearchFromValue(filters.from)
      ? filters.from
      : null;

  const needAwakener = from == null || from === "awakener";
  const needWheel = from == null || from === "wheel";
  const needPosse = from == null || from === "posse";
  const needCovenant = from == null || from === "covenant";

  const emptyLocal: PublicRow<"awakener_local_manifestation_interaction">[] =
    [];

  const [
    tagsResult,
    realmsResult,
    awakenersResult,
    wheelsResult,
    possesResult,
    covenantsResult,
    atmResult,
    localResult,
    wtmResult,
    ptmResult,
    ctmResult,
  ] = await Promise.all([
    fetchPublicTable("tag"),
    fetchPublicTable("realm"),
    needAwakener
      ? fetchPublicTable("awakener")
      : Promise.resolve({
          success: true as const,
          data: [] as PublicRow<"awakener">[],
          truncated: false,
        }),
    needWheel
      ? fetchPublicTable("wheel")
      : Promise.resolve({
          success: true as const,
          data: [] as PublicRow<"wheel">[],
          truncated: false,
        }),
    needPosse
      ? fetchPublicTable("posse")
      : Promise.resolve({
          success: true as const,
          data: [] as PublicRow<"posse">[],
          truncated: false,
        }),
    needCovenant
      ? fetchPublicTable("covenant")
      : Promise.resolve({
          success: true as const,
          data: [] as PublicRow<"covenant">[],
          truncated: false,
        }),
    needAwakener
      ? fetchPublicTable("awakener_tag_manifestation")
      : Promise.resolve({
          success: true as const,
          data: [] as PublicRow<"awakener_tag_manifestation">[],
          truncated: false,
        }),
    needAwakener
      ? fetchPublicTable("awakener_local_manifestation_interaction")
      : Promise.resolve({
          success: true as const,
          data: emptyLocal,
          truncated: false,
        }),
    needWheel
      ? fetchPublicTable("wheel_tag_manifestation")
      : Promise.resolve({
          success: true as const,
          data: [] as PublicRow<"wheel_tag_manifestation">[],
          truncated: false,
        }),
    needPosse
      ? fetchPublicTable("posse_tag_manifestation")
      : Promise.resolve({
          success: true as const,
          data: [] as PublicRow<"posse_tag_manifestation">[],
          truncated: false,
        }),
    needCovenant
      ? fetchPublicTable("covenant_tag_manifestation")
      : Promise.resolve({
          success: true as const,
          data: [] as PublicRow<"covenant_tag_manifestation">[],
          truncated: false,
        }),
  ]);

  const failed = [
    tagsResult,
    realmsResult,
    awakenersResult,
    wheelsResult,
    possesResult,
    covenantsResult,
    atmResult,
    localResult,
    wtmResult,
    ptmResult,
    ctmResult,
  ].find((r) => !r.success);

  if (failed && !failed.success) {
    return { success: false, error: failed.error };
  }

  if (
    !tagsResult.success ||
    !realmsResult.success ||
    !awakenersResult.success ||
    !wheelsResult.success ||
    !possesResult.success ||
    !covenantsResult.success ||
    !atmResult.success ||
    !localResult.success ||
    !wtmResult.success ||
    !ptmResult.success ||
    !ctmResult.success
  ) {
    return { success: false, error: "Could not load search data." };
  }

  const sourceTruncated =
    tagsResult.truncated ||
    realmsResult.truncated ||
    awakenersResult.truncated ||
    wheelsResult.truncated ||
    possesResult.truncated ||
    covenantsResult.truncated ||
    atmResult.truncated ||
    localResult.truncated ||
    wtmResult.truncated ||
    ptmResult.truncated ||
    ctmResult.truncated;

  const built = buildSearchResults({
    filters: { ...filters, from },
    tags: tagsResult.data,
    realms: realmsResult.data,
    awakeners: awakenersResult.data,
    wheels: wheelsResult.data,
    posses: possesResult.data,
    covenants: covenantsResult.data,
    awakenerManifestations: atmResult.data,
    awakenerLocalInteractions: localResult.data,
    wheelManifestations: wtmResult.data,
    posseManifestations: ptmResult.data,
    covenantManifestations: ctmResult.data,
  });

  return {
    success: true,
    rows: built.rows,
    truncated: built.truncated || sourceTruncated,
  };
}
