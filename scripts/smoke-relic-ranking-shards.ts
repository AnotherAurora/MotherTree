/**
 * Sharded ranking parity smoke.
 * Run: npm run smoke:relic-ranking-shards
 *
 * The Relic Picker runs its candidate sweep across a pool of Web Workers. Each
 * worker evaluates a disjoint subset of candidates with its own total cache via
 * `computeRelicCandidateTotals`. This asserts that merging those shards (and
 * sorting with the shared comparator) reproduces the single-shard result exactly.
 * Skips (exit 0) when Supabase env vars are absent.
 */
import {
  compareRelicRankingRows,
  computeEligibleRelicEntries,
  computeRelicCandidateTotals,
  createRelicRankingContext,
  type RelicRankingRow,
} from "../src/lib/path-carver/relic-candidates";
import type { RelicCatalogEntry } from "../src/lib/path-carver/relic-manifestations";
import {
  buildPublicRelicCatalog,
  buildPublicTeamData,
  type PublicTeamCatalog,
} from "../src/lib/public/relic-picker-data";
import type { PublicReadTable } from "../src/lib/public-read/allowlist";
import { fetchAllPublicTable } from "../src/lib/public-read/fetch";
import { createAnonClient } from "../src/lib/supabase/anon";
import { createEmptySlots } from "../src/lib/simulator/types";
import type { RelicValueInputs } from "../src/lib/path-carver/relic-manifestations";
import type { TeamData } from "../src/lib/team-data/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

/** Candidate subset size kept small so the smoke stays well under the 1-minute mark. */
const CANDIDATE_LIMIT = 6;

const TABLES: PublicReadTable[] = [
  "awakener",
  "awakener_tag_manifestation",
  "awakener_local_manifestation_interaction",
  "wheel",
  "wheel_tag_manifestation",
  "covenant",
  "covenant_tag_manifestation",
  "covenant_stat_set",
  "posse",
  "posse_tag_manifestation",
  "realm",
  "realm_tag_manifestation",
  "tag",
  "tag_default_interaction",
  "copy_provider_group_member",
  "relic",
  "relic_tag_manifestation",
];

async function loadCatalog(): Promise<PublicTeamCatalog> {
  const client = createAnonClient();
  const entries = await Promise.all(
    TABLES.map(async (table) => {
      const result = await fetchAllPublicTable(table, { client });
      if (!result.success) throw new Error(`${table}: ${result.error}`);
      return [table, result.data] as const;
    }),
  );
  const byTable = new Map(entries);
  return {
    awakeners: byTable.get("awakener")!,
    awakenersManifestations: byTable.get("awakener_tag_manifestation")!,
    awakenersLocalInteractions: byTable.get(
      "awakener_local_manifestation_interaction",
    )!,
    wheels: byTable.get("wheel")!,
    wheelManifestations: byTable.get("wheel_tag_manifestation")!,
    covenants: byTable.get("covenant")!,
    covenantManifestations: byTable.get("covenant_tag_manifestation")!,
    covenantStatSets: byTable.get("covenant_stat_set")!,
    posses: byTable.get("posse")!,
    posseManifestations: byTable.get("posse_tag_manifestation")!,
    realms: byTable.get("realm")!,
    realmManifestations: byTable.get("realm_tag_manifestation")!,
    tags: byTable.get("tag")!,
    defaultInteractions: byTable.get("tag_default_interaction")!,
    copyProviderMembers: byTable.get("copy_provider_group_member")!,
    relics: byTable.get("relic")!,
    relicManifestations: byTable.get("relic_tag_manifestation")!,
  } as unknown as PublicTeamCatalog;
}

type SweepArgs = {
  teamData: TeamData;
  damageDealerAwakenerIds: number[];
  relicCatalog: RelicCatalogEntry[];
  selectedRelicIds: number[];
  inputs: RelicValueInputs;
};

/** Reference: one call over all subset candidates (single worker). */
function referenceRows(
  args: SweepArgs & { candidates: RelicCatalogEntry[] },
): { baselineTotal: number | null; rows: Map<number, number> } {
  const { teamData, damageDealerAwakenerIds, relicCatalog } = args;
  const { applyContext } = createRelicRankingContext(
    teamData,
    damageDealerAwakenerIds,
  );
  const eligible = computeEligibleRelicEntries(
    applyContext,
    relicCatalog,
    args.selectedRelicIds,
  );
  const result = computeRelicCandidateTotals({
    teamData,
    applyContext,
    relicCatalog,
    eligibleRelicIds: eligible.map((entry) => entry.relicId),
    selectedRelicIds: args.selectedRelicIds,
    candidateRelicIds: args.candidates.map((entry) => entry.relicId),
    inputs: args.inputs,
    totalCache: new Map(),
    includeBaseline: true,
  });
  const rows = new Map<number, number>();
  for (const row of result.rows) rows.set(row.relicId, row.total);
  return { baselineTotal: result.baselineTotal, rows };
}

/** Mimic the worker pool: partition candidates across N workers, merge rows. */
function shardedRows(
  args: SweepArgs & { candidates: RelicCatalogEntry[]; shardCount: number },
): { baselineTotal: number | null; rows: Map<number, number> } {
  const { teamData, damageDealerAwakenerIds, relicCatalog, candidates } = args;
  const { applyContext } = createRelicRankingContext(
    teamData,
    damageDealerAwakenerIds,
  );
  const eligible = computeEligibleRelicEntries(
    applyContext,
    relicCatalog,
    args.selectedRelicIds,
  );
  const eligibleRelicIds = eligible.map((entry) => entry.relicId);

  const shards: RelicCatalogEntry[][] = Array.from(
    { length: args.shardCount },
    () => [],
  );
  candidates.forEach((entry, index) => {
    shards[index % args.shardCount].push(entry);
  });

  let baselineTotal: number | null = null;
  const rows = new Map<number, number>();
  shards.forEach((shard, index) => {
    const result = computeRelicCandidateTotals({
      teamData,
      applyContext,
      relicCatalog,
      eligibleRelicIds,
      selectedRelicIds: args.selectedRelicIds,
      candidateRelicIds: shard.map((entry) => entry.relicId),
      inputs: args.inputs,
      totalCache: new Map(),
      includeBaseline: index === 0,
    });
    if (result.baselineTotal != null) baselineTotal = result.baselineTotal;
    for (const row of result.rows) rows.set(row.relicId, row.total);
  });
  return { baselineTotal, rows };
}

function rankedFromRows(
  candidates: RelicCatalogEntry[],
  baselineTotal: number | null,
  rows: Map<number, number>,
): RelicRankingRow[] {
  const baseline = baselineTotal ?? 0;
  const ranked: RelicRankingRow[] = [];
  for (const entry of candidates) {
    const total = rows.get(entry.relicId);
    if (total == null) continue;
    ranked.push({
      entry,
      total,
      percentIncrease:
        baseline > 0 ? ((total - baseline) / baseline) * 100 : null,
    });
  }
  ranked.sort(compareRelicRankingRows);
  return ranked;
}

async function main(): Promise<void> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    console.log(
      "Skipping: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set.",
    );
    return;
  }

  const catalog = await loadCatalog();
  const awakeners = catalog.awakeners.slice(0, 4);
  if (awakeners.length === 0) {
    console.log("Skipping: no awakeners in catalog.");
    return;
  }

  const slots = createEmptySlots();
  awakeners.forEach((awakener, index) => {
    slots[index].awakenerId = awakener.id;
  });
  const posseId = catalog.posses[0]?.id ?? null;
  const teamData = buildPublicTeamData({ slots, posseId }, catalog);
  const relicCatalog = buildPublicRelicCatalog(catalog);
  const damageDealerAwakenerIds = awakeners.map((a) => a.id);
  const inputs = { accountLevel: 50, ownedPosseCount: 50, hsr: false };

  const base: SweepArgs = {
    teamData,
    damageDealerAwakenerIds,
    relicCatalog,
    selectedRelicIds: [],
    inputs,
  };
  const { applyContext } = createRelicRankingContext(
    teamData,
    damageDealerAwakenerIds,
  );
  const eligible = computeEligibleRelicEntries(
    applyContext,
    relicCatalog,
    [],
  );
  const candidates = eligible.slice(0, CANDIDATE_LIMIT);
  assert(candidates.length > 0, "expected at least one eligible relic");

  const selectedFirst = [candidates[0].relicId];
  const scenarios: number[][] = [[], selectedFirst];
  let checked = 0;

  for (const selectedRelicIds of scenarios) {
    const subset = selectedRelicIds.length > 0 ? candidates.slice(1) : candidates;
    assert(subset.length > 0, "expected candidate subset");
    const sweepArgs: SweepArgs = { ...base, selectedRelicIds };
    const reference = referenceRows({ ...sweepArgs, candidates: subset });
    const expected = rankedFromRows(
      subset,
      reference.baselineTotal,
      reference.rows,
    );

    for (const shardCount of [1, 2, 3, 8]) {
      const sharded = shardedRows({
        ...sweepArgs,
        candidates: subset,
        shardCount,
      });
      const actual = rankedFromRows(
        subset,
        sharded.baselineTotal,
        sharded.rows,
      );
      assert(
        actual.length === expected.length,
        `selection=[${selectedRelicIds}] shards=${shardCount} length ${actual.length} === ${expected.length}`,
      );
      for (let i = 0; i < actual.length; i += 1) {
        const a = actual[i];
        const b = expected[i];
        assert(
          a.entry.relicId === b.entry.relicId &&
            a.total === b.total &&
            a.percentIncrease === b.percentIncrease,
          `selection=[${selectedRelicIds}] shards=${shardCount} #${i} ` +
            `${a.entry.name}:${a.total}/${a.percentIncrease} === ` +
            `${b.entry.name}:${b.total}/${b.percentIncrease}`,
        );
      }
      checked += actual.length;
    }
  }

  console.log(
    `Sharded parity OK: ${checked} rows across ${scenarios.length} selections.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
