"use server";

import { headers } from "next/headers";
import { fetchAllPublicTable } from "@/lib/public-read/fetch";
import { checkPublicRateLimit } from "@/lib/public-read/rate-limit";
import type { PublicRow } from "@/lib/public-read/allowlist";
import {
  buildSearchResults,
  expandTagIdsForSearch,
  type SearchQueryFilters,
  type SearchResultRow,
} from "@/lib/public/search-results";
import {
  fetchPrecomputedSoloTotals,
  type PrecomputedSoloTotal,
} from "@/lib/public/solo-totals";
import { shouldRunSoloAwakenerTotals } from "@/lib/public/solo-search-routing";
import {
  formatSearchTagLabel,
  type SearchFromValue,
} from "@/lib/public/search-filter-options";

export type RunPublicSearchResult =
  | {
      success: true;
      rows: SearchResultRow[];
      /** True when source catalog or results display hit a row cap. */
      truncated: boolean;
      /** Incomplete allowlisted catalog load (results may be wrong). */
      sourceTruncated: boolean;
      /** More than 500 matching rows after sort; top 500 by Value shown. */
      resultsTruncated: boolean;
      /** Simulated tags selected but absent from the last precompute sync. */
      pendingSyncTags: string[];
      /** Timestamp of the last successful precompute sync, if any. */
      simulationSyncedAt: string | null;
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
  const emptyRtm: PublicRow<"realm_tag_manifestation">[] = [];
  const emptyTdi: PublicRow<"tag_default_interaction">[] = [];
  const emptyCopyProviderMembers: PublicRow<"copy_provider_group_member">[] =
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
    rtmResult,
    tdiResult,
    copyProviderMembersResult,
    wtmResult,
    ptmResult,
    ctmResult,
  ] = await Promise.all([
    fetchAllPublicTable("tag"),
    fetchAllPublicTable("realm"),
    needAwakener
      ? fetchAllPublicTable("awakener")
      : Promise.resolve({
          success: true as const,
          data: [] as PublicRow<"awakener">[],
          truncated: false,
        }),
    needWheel
      ? fetchAllPublicTable("wheel")
      : Promise.resolve({
          success: true as const,
          data: [] as PublicRow<"wheel">[],
          truncated: false,
        }),
    needPosse
      ? fetchAllPublicTable("posse")
      : Promise.resolve({
          success: true as const,
          data: [] as PublicRow<"posse">[],
          truncated: false,
        }),
    needCovenant
      ? fetchAllPublicTable("covenant")
      : Promise.resolve({
          success: true as const,
          data: [] as PublicRow<"covenant">[],
          truncated: false,
        }),
    needAwakener
      ? fetchAllPublicTable("awakener_tag_manifestation")
      : Promise.resolve({
          success: true as const,
          data: [] as PublicRow<"awakener_tag_manifestation">[],
          truncated: false,
        }),
    needAwakener
      ? fetchAllPublicTable("awakener_local_manifestation_interaction")
      : Promise.resolve({
          success: true as const,
          data: emptyLocal,
          truncated: false,
        }),
    needAwakener
      ? fetchAllPublicTable("realm_tag_manifestation")
      : Promise.resolve({
          success: true as const,
          data: emptyRtm,
          truncated: false,
        }),
    needAwakener
      ? fetchAllPublicTable("tag_default_interaction")
      : Promise.resolve({
          success: true as const,
          data: emptyTdi,
          truncated: false,
        }),
    needAwakener
      ? fetchAllPublicTable("copy_provider_group_member")
      : Promise.resolve({
          success: true as const,
          data: emptyCopyProviderMembers,
          truncated: false,
        }),
    needWheel
      ? fetchAllPublicTable("wheel_tag_manifestation")
      : Promise.resolve({
          success: true as const,
          data: [] as PublicRow<"wheel_tag_manifestation">[],
          truncated: false,
        }),
    needPosse
      ? fetchAllPublicTable("posse_tag_manifestation")
      : Promise.resolve({
          success: true as const,
          data: [] as PublicRow<"posse_tag_manifestation">[],
          truncated: false,
        }),
    needCovenant
      ? fetchAllPublicTable("covenant_tag_manifestation")
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
    rtmResult,
    tdiResult,
    copyProviderMembersResult,
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
    !rtmResult.success ||
    !tdiResult.success ||
    !copyProviderMembersResult.success ||
    !wtmResult.success ||
    !ptmResult.success ||
    !ctmResult.success
  ) {
    return { success: false, error: "Could not load search data." };
  }

  const catalogTruncated =
    tagsResult.truncated ||
    realmsResult.truncated ||
    awakenersResult.truncated ||
    wheelsResult.truncated ||
    possesResult.truncated ||
    covenantsResult.truncated ||
    atmResult.truncated ||
    localResult.truncated ||
    rtmResult.truncated ||
    tdiResult.truncated ||
    copyProviderMembersResult.truncated ||
    wtmResult.truncated ||
    ptmResult.truncated ||
    ctmResult.truncated;

  // Simulated tags are served from precomputed rows. Never run the Path Carver
  // engine here — a full simulated search is ~19 s CPU (Workers Free is 10 ms).
  const tagsById = new Map(tagsResult.data.map((tag) => [tag.id, tag]));
  const matchingTagIds =
    filters.tagId != null
      ? expandTagIdsForSearch(tagsResult.data, filters.tagId)
      : null;
  const runSolo =
    needAwakener && shouldRunSoloAwakenerTotals(matchingTagIds, tagsById);

  let soloTotals: PrecomputedSoloTotal[] | undefined;
  let soloTotalsTruncated = false;
  let simulationSyncedAt: string | null = null;
  let pendingSyncTags: string[] = [];

  if (runSolo && matchingTagIds != null) {
    const simulatedMatchingTagIds = [...matchingTagIds].filter(
      (tagId) => tagsById.get(tagId)?.is_search_simulated === true,
    );
    const totals = await fetchPrecomputedSoloTotals({
      tagIds: simulatedMatchingTagIds,
      enlightenment: filters.awakenerEnlightenment,
    });
    if (!totals.success) {
      return { success: false, error: totals.error };
    }

    soloTotals = totals.rows;
    soloTotalsTruncated = totals.truncated;
    simulationSyncedAt = totals.syncedAt;
    const syncedTagIds = new Set(totals.syncedTagIds ?? []);
    pendingSyncTags = simulatedMatchingTagIds
      .filter((tagId) => !syncedTagIds.has(tagId))
      .map((tagId) => {
        const tag = tagsById.get(tagId);
        return tag ? formatSearchTagLabel(tag.tag_name) : `#${tagId}`;
      })
      .sort((a, b) => a.localeCompare(b));
  }

  const sourceTruncated = catalogTruncated || soloTotalsTruncated;

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
    realmManifestations: rtmResult.data,
    defaultInteractions: tdiResult.data,
    copyProviderMembers: copyProviderMembersResult.data,
    wheelManifestations: wtmResult.data,
    posseManifestations: ptmResult.data,
    covenantManifestations: ctmResult.data,
    soloTotals,
  });

  return {
    success: true,
    rows: built.rows,
    sourceTruncated,
    resultsTruncated: built.truncated,
    truncated: built.truncated || sourceTruncated,
    pendingSyncTags,
    simulationSyncedAt,
  };
}
