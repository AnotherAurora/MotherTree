import { computeReviewTagTotals } from "@/lib/path-carver/aggregate-tag-scalars";
import {
  computeDamageRelevance,
  filterTeamDataToRelevance,
  filterManifestationsToRelevance,
} from "@/lib/path-carver/damage-relevance";
import {
  createManifestationApplyContext,
  type ManifestationApplyContext,
} from "@/lib/path-carver/manifestation-apply";
import {
  buildRelicManifestations,
  type RelicCatalogEntry,
  type RelicValueInputs,
} from "@/lib/path-carver/relic-manifestations";
import { computeTotalDamage } from "@/lib/path-carver/total-damage";
import type { Manifestation, TeamData } from "@/lib/team-data/types";

export type RelicRankingRow = {
  entry: RelicCatalogEntry;
  total: number;
  /** Percent change vs the current baseline total. `null` when baseline is 0. */
  percentIncrease: number | null;
};

export type RelicRankingResult = {
  /** Eligible, not-yet-selected damage relics. */
  eligible: RelicCatalogEntry[];
  baselineTotal: number;
  ranked: RelicRankingRow[];
};

/** Cache of finalized Total Damage by selection key. */
export type RelicTotalCache = Map<string, number>;

/** Candidate totals for a shard of the sweep (worker-friendly, plain data). */
export type RelicCandidateTotalRow = {
  relicId: number;
  total: number;
};

/**
 * Damage-relevance prefilter.
 *
 * OFF by default. The reverse closure over `tag_default_interaction` is not yet a
 * safe superset of everything the engine reads: real-data parity
 * (`npm run smoke:damage-relevance-real`) showed a manifest's *presence* couples
 * tags outside the modifier→target graph (e.g. a `Defender.Shield.Fixed` base
 * changes `Attacker.Active Damage.Strike` through the owner/pool machinery).
 * Until the closure models those couplings and the real-data parity smoke
 * passes, keep this off. `damage-relevance.ts`, the generated
 * `tag.is_damage_relevant` mirror, its generator, and both smokes remain in place
 * so this can be turned on once proven.
 *
 * The Relic Picker still gets the main-thread unblock (Web Worker),
 * `totalsOnly`, and hoisted per-team setup.
 */
export const DAMAGE_RELEVANCE_FILTER_ENABLED = false;

export function relicValueInputsKey(inputs: RelicValueInputs): string {
  return `${inputs.accountLevel}:${inputs.ownedPosseCount}:${inputs.hsr ? 1 : 0}`;
}

export function relicSelectionKey(selectedRelicIds: readonly number[]): string {
  return [...selectedRelicIds].sort((a, b) => a - b).join(",");
}

/** Sort ranked rows: percent desc, then name. Shared by worker + main thread. */
export function compareRelicRankingRows(
  a: RelicRankingRow,
  b: RelicRankingRow,
): number {
  const av = a.percentIncrease ?? -Infinity;
  const bv = b.percentIncrease ?? -Infinity;
  if (bv !== av) return bv - av;
  return a.entry.name.localeCompare(b.entry.name);
}

export type RelicRankingContext = {
  teamData: TeamData;
  applyContext: ManifestationApplyContext;
};

/**
 * Per-team setup independent of the candidate under test. Safe to build once
 * per team and reuse across every sweep (the engine never mutates it).
 */
export function createRelicRankingContext(
  teamData: TeamData,
  damageDealerAwakenerIds: readonly number[],
): RelicRankingContext {
  return {
    teamData,
    applyContext: createManifestationApplyContext(
      teamData.awakeners,
      damageDealerAwakenerIds,
      new Map(),
      teamData.realms,
      teamData.manifestations,
    ),
  };
}

/** Damage relics whose realm requirement is met and which are not selected. */
export function computeEligibleRelicEntries(
  applyContext: ManifestationApplyContext,
  relicCatalog: readonly RelicCatalogEntry[],
  selectedRelicIds: readonly number[],
): RelicCatalogEntry[] {
  const selectedSet = new Set(selectedRelicIds);
  const teamRealms = applyContext.teamRealms;
  return relicCatalog.filter(
    (entry) =>
      entry.isDamage &&
      !selectedSet.has(entry.relicId) &&
      (entry.requiredRealmId == null ||
        teamRealms.satisfiesRequiredRealm(entry.requiredRealmId, "present")),
  );
}

function computeTotalForSelection(
  teamData: TeamData,
  applyContext: ManifestationApplyContext,
  manifestations: Manifestation[],
): number {
  const merged: TeamData = {
    ...teamData,
    manifestations: [...teamData.manifestations, ...manifestations],
  };
  const { totalsByTagId } = computeReviewTagTotals(merged, applyContext, {
    totalsOnly: true,
  });
  return computeTotalDamage(totalsByTagId, merged.tagsById).total;
}

function getCachedTotal(
  cache: RelicTotalCache | undefined,
  key: string,
  compute: () => number,
): number {
  if (cache) {
    const hit = cache.get(key);
    if (hit != null) return hit;
  }
  const value = compute();
  cache?.set(key, value);
  return value;
}

type RelicManifestationResolver = {
  manifestationsOf: (relicId: number) => Manifestation[];
  manifestationsFor: (relicIds: readonly number[]) => Manifestation[];
};

function createRelicManifestationResolver(
  byRelicId: ReadonlyMap<number, RelicCatalogEntry>,
  inputs: RelicValueInputs,
): RelicManifestationResolver {
  const cache = new Map<number, Manifestation[]>();
  const manifestationsOf = (relicId: number): Manifestation[] => {
    let rows = cache.get(relicId);
    if (rows == null) {
      const entry = byRelicId.get(relicId);
      rows = entry ? buildRelicManifestations(entry, inputs) : [];
      cache.set(relicId, rows);
    }
    return rows;
  };
  const manifestationsFor = (relicIds: readonly number[]): Manifestation[] => {
    const rows: Manifestation[] = [];
    for (const relicId of relicIds) rows.push(...manifestationsOf(relicId));
    return rows;
  };
  return { manifestationsOf, manifestationsFor };
}

type PreparedRelicSweep = {
  eligible: RelicCatalogEntry[];
  filteredTeamData: TeamData;
  relevantManifestationsFor: (relicIds: readonly number[]) => Manifestation[];
  outputsKey: string;
};

/**
 * Shared per-sweep setup: relevance closure over team + selection + all eligible
 * relics, so the filtered tag/interaction set is stable for the whole sweep.
 * Disabled by default (see DAMAGE_RELEVANCE_FILTER_ENABLED).
 */
function prepareRelicSweep(args: {
  teamData: TeamData;
  relicCatalog: readonly RelicCatalogEntry[];
  eligibleAll: readonly RelicCatalogEntry[];
  selectedRelicIds: readonly number[];
  inputs: RelicValueInputs;
}): PreparedRelicSweep {
  const { teamData, relicCatalog, eligibleAll, selectedRelicIds, inputs } = args;
  const byRelicId = new Map(relicCatalog.map((entry) => [entry.relicId, entry]));
  const resolver = createRelicManifestationResolver(byRelicId, inputs);

  const relevance = DAMAGE_RELEVANCE_FILTER_ENABLED
    ? computeDamageRelevance({
        tagsById: teamData.tagsById,
        defaultInteractions: teamData.defaultInteractions,
        manifestations: [
          ...teamData.manifestations,
          ...resolver.manifestationsFor(selectedRelicIds),
          ...eligibleAll.flatMap((entry) =>
            resolver.manifestationsOf(entry.relicId),
          ),
        ],
      })
    : null;

  const filteredTeamData = relevance
    ? filterTeamDataToRelevance(teamData, relevance)
    : teamData;

  // A relic whose rows are all outside the closure can only contribute 0.
  const eligible =
    relevance == null
      ? [...eligibleAll]
      : eligibleAll.filter((entry) =>
          resolver
            .manifestationsOf(entry.relicId)
            .some((m) => relevance.tagIds.has(m.tagId)),
        );

  const relevantManifestationsFor = (
    relicIds: readonly number[],
  ): Manifestation[] => {
    const rows = resolver.manifestationsFor(relicIds);
    return relevance ? filterManifestationsToRelevance(rows, relevance) : rows;
  };

  return {
    eligible,
    filteredTeamData,
    relevantManifestationsFor,
    outputsKey: relicValueInputsKey(inputs),
  };
}

export type RelicCandidateTotalsArgs = {
  teamData: TeamData;
  applyContext: ManifestationApplyContext;
  relicCatalog: readonly RelicCatalogEntry[];
  /** Precomputed eligible ids for this selection (drives the relevance closure). */
  eligibleRelicIds: readonly number[];
  selectedRelicIds: readonly number[];
  candidateRelicIds: readonly number[];
  inputs: RelicValueInputs;
  totalCache?: RelicTotalCache;
  includeBaseline: boolean;
};

export type RelicCandidateTotalsResult = {
  baselineTotal: number | null;
  eligible: RelicCatalogEntry[];
  rows: RelicCandidateTotalRow[];
};

/**
 * Compute Total Damage for a subset of eligible candidate relics (plus the
 * baseline when requested). Pure: identical inputs produce identical results, so
 * shards can run in parallel workers and be merged on the main thread.
 */
export function computeRelicCandidateTotals(
  args: RelicCandidateTotalsArgs,
): RelicCandidateTotalsResult {
  const {
    teamData,
    applyContext,
    relicCatalog,
    eligibleRelicIds,
    selectedRelicIds,
    candidateRelicIds,
    inputs,
    totalCache,
    includeBaseline,
  } = args;

  const eligibleSet = new Set(eligibleRelicIds);
  const eligibleAll = relicCatalog.filter((entry) =>
    eligibleSet.has(entry.relicId),
  );
  const sweep = prepareRelicSweep({
    teamData,
    relicCatalog,
    eligibleAll,
    selectedRelicIds,
    inputs,
  });

  let baselineTotal: number | null = null;
  if (includeBaseline) {
    const key = `${sweep.outputsKey}|${relicSelectionKey(selectedRelicIds)}`;
    baselineTotal = getCachedTotal(totalCache, key, () =>
      computeTotalForSelection(
        sweep.filteredTeamData,
        applyContext,
        sweep.relevantManifestationsFor(selectedRelicIds),
      ),
    );
  }

  // Only evaluate candidates that survived the relevance filter; a filtered-out
  // relict contributes nothing, matching the unfiltered sweep's eligible set.
  const relevantEligibleSet = new Set(
    sweep.eligible.map((entry) => entry.relicId),
  );
  const ids = candidateRelicIds.filter(
    (relicId) =>
      eligibleSet.has(relicId) && relevantEligibleSet.has(relicId),
  );
  const rows: RelicCandidateTotalRow[] = ids.map((relicId) => {
    const withCandidate = [...selectedRelicIds, relicId];
    const key = `${sweep.outputsKey}|${relicSelectionKey(withCandidate)}`;
    const total = getCachedTotal(totalCache, key, () =>
      computeTotalForSelection(
        sweep.filteredTeamData,
        applyContext,
        sweep.relevantManifestationsFor(withCandidate),
      ),
    );
    return { relicId, total };
  });

  return { baselineTotal, eligible: sweep.eligible, rows };
}

/**
 * Baseline total (with selected relics applied) plus each remaining eligible
 * relic's standalone total. Sorting/percent formatting is left to the caller.
 *
 * `totalCache` is keyed by `inputsKey|selectionKey`, so the candidate that was
 * just selected becomes the next baseline for free, and re-renders do not
 * re-run the engine.
 */
export function computeRelicRanking(args: {
  teamData: TeamData;
  damageDealerAwakenerIds: readonly number[];
  relicCatalog: readonly RelicCatalogEntry[];
  selectedRelicIds: readonly number[];
  inputs: RelicValueInputs;
  totalCache?: RelicTotalCache;
}): RelicRankingResult {
  const {
    teamData,
    damageDealerAwakenerIds,
    relicCatalog,
    selectedRelicIds,
    inputs,
    totalCache,
  } = args;

  const { applyContext } = createRelicRankingContext(
    teamData,
    damageDealerAwakenerIds,
  );
  const eligibleAll = computeEligibleRelicEntries(
    applyContext,
    relicCatalog,
    selectedRelicIds,
  );

  // No damage dealer ⇒ nothing to calculate. Report a zero baseline and a list
  // of eligible relics with blank impact rather than sweeping the engine.
  if (damageDealerAwakenerIds.length === 0) {
    return {
      eligible: eligibleAll,
      baselineTotal: 0,
      ranked: eligibleAll.map((entry) => ({
        entry,
        total: 0,
        percentIncrease: null,
      })),
    };
  }

  const eligibleRelicIds = eligibleAll.map((entry) => entry.relicId);
  const { baselineTotal, eligible, rows } = computeRelicCandidateTotals({
    teamData,
    applyContext,
    relicCatalog,
    eligibleRelicIds,
    selectedRelicIds,
    candidateRelicIds: eligibleRelicIds,
    inputs,
    totalCache,
    includeBaseline: true,
  });

  const baseline = baselineTotal ?? 0;
  const byRelicId = new Map(
    eligibleAll.map((entry) => [entry.relicId, entry]),
  );
  const ranked: RelicRankingRow[] = [];
  for (const { relicId, total } of rows) {
    const entry = byRelicId.get(relicId);
    if (!entry) continue;
    ranked.push({
      entry,
      total,
      percentIncrease:
        baseline > 0 ? ((total - baseline) / baseline) * 100 : null,
    });
  }
  ranked.sort(compareRelicRankingRows);

  return { eligible, baselineTotal: baseline, ranked };
}
