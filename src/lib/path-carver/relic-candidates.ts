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

  const selectedSet = new Set(selectedRelicIds);
  const byRelicId = new Map(relicCatalog.map((entry) => [entry.relicId, entry]));
  const outputsKey = relicValueInputsKey(inputs);

  // Per-team setup is independent of the candidate under test, so build it once.
  const applyContext = createManifestationApplyContext(
    teamData.awakeners,
    damageDealerAwakenerIds,
    new Map(),
    teamData.realms,
    teamData.manifestations,
  );
  const teamRealms = applyContext.teamRealms;

  const eligibleAll = relicCatalog.filter(
    (entry) =>
      entry.isDamage &&
      !selectedSet.has(entry.relicId) &&
      (entry.requiredRealmId == null ||
        teamRealms.satisfiesRequiredRealm(entry.requiredRealmId, "present")),
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

  // Build every candidate's rows once; reuse across the sweep and the closure.
  const manifestationsByRelicId = new Map<number, Manifestation[]>();
  const manifestationsOf = (relicId: number): Manifestation[] => {
    let rows = manifestationsByRelicId.get(relicId);
    if (rows == null) {
      const entry = byRelicId.get(relicId);
      rows = entry ? buildRelicManifestations(entry, inputs) : [];
      manifestationsByRelicId.set(relicId, rows);
    }
    return rows;
  };
  const manifestationsFor = (relicIds: readonly number[]): Manifestation[] => {
    const rows: Manifestation[] = [];
    for (const relicId of relicIds) rows.push(...manifestationsOf(relicId));
    return rows;
  };

  // Damage-relevance closure over the team plus every selectable relic so the
  // filtered tag/interaction set stays stable for the whole sweep. Disabled by
  // default (see DAMAGE_RELEVANCE_FILTER_ENABLED).
  const relevance = DAMAGE_RELEVANCE_FILTER_ENABLED
    ? computeDamageRelevance({
        tagsById: teamData.tagsById,
        defaultInteractions: teamData.defaultInteractions,
        manifestations: [
          ...teamData.manifestations,
          ...manifestationsFor(selectedRelicIds),
          ...eligibleAll.flatMap((entry) => manifestationsOf(entry.relicId)),
        ],
      })
    : null;
  const filteredTeamData = relevance
    ? filterTeamDataToRelevance(teamData, relevance)
    : teamData;

  // A relic whose rows are all outside the closure can only contribute 0.
  const eligible =
    relevance == null
      ? eligibleAll
      : eligibleAll.filter((entry) =>
          manifestationsOf(entry.relicId).some((m) =>
            relevance.tagIds.has(m.tagId),
          ),
        );

  const relevantManifestationsFor = (
    relicIds: readonly number[],
  ): Manifestation[] => {
    const rows = manifestationsFor(relicIds);
    return relevance ? filterManifestationsToRelevance(rows, relevance) : rows;
  };

  const selectedKey = `${outputsKey}|${relicSelectionKey(selectedRelicIds)}`;
  const baselineTotal = getCachedTotal(totalCache, selectedKey, () =>
    computeTotalForSelection(
      filteredTeamData,
      applyContext,
      relevantManifestationsFor(selectedRelicIds),
    ),
  );

  const ranked: RelicRankingRow[] = eligible.map((entry) => {
    const withCandidate = [...selectedRelicIds, entry.relicId];
    const key = `${outputsKey}|${relicSelectionKey(withCandidate)}`;
    const total = getCachedTotal(totalCache, key, () =>
      computeTotalForSelection(
        filteredTeamData,
        applyContext,
        relevantManifestationsFor(withCandidate),
      ),
    );
    const percentIncrease =
      baselineTotal > 0 ? ((total - baselineTotal) / baselineTotal) * 100 : null;
    return { entry, total, percentIncrease };
  });

  ranked.sort((a, b) => {
    const av = a.percentIncrease ?? -Infinity;
    const bv = b.percentIncrease ?? -Infinity;
    if (bv !== av) return bv - av;
    return a.entry.name.localeCompare(b.entry.name);
  });

  return { eligible, baselineTotal, ranked };
}
