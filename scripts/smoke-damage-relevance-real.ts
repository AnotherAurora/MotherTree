/**
 * Real-data ranking parity smoke.
 * Run: npm run smoke:damage-relevance-real
 *
 * Loads the public (anon) catalog, builds a real team, and asserts that
 * `computeRelicRanking` totals match an unfiltered engine run for every eligible
 * relic. Guards the Relic Picker ranking path (worker/totalsOnly/hoist) against
 * accidental divergence. Skips (exit 0) when Supabase env vars are absent.
 */
import { computeReviewTagTotals } from "../src/lib/path-carver/aggregate-tag-scalars";
import { computeRelicRanking } from "../src/lib/path-carver/relic-candidates";
import { buildRelicManifestations } from "../src/lib/path-carver/relic-manifestations";
import { createManifestationApplyContext } from "../src/lib/path-carver/manifestation-apply";
import { computeTotalDamage } from "../src/lib/path-carver/total-damage";
import {
  buildPublicRelicCatalog,
  buildPublicTeamData,
  type PublicTeamCatalog,
} from "../src/lib/public/relic-picker-data";
import type { PublicReadTable } from "../src/lib/public-read/allowlist";
import { fetchAllPublicTable } from "../src/lib/public-read/fetch";
import { createAnonClient } from "../src/lib/supabase/anon";
import { createEmptySlots } from "../src/lib/simulator/types";
import type { Manifestation, TeamData } from "../src/lib/team-data/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

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

function fullTotal(
  teamData: TeamData,
  damageDealerAwakenerIds: readonly number[],
  relics: readonly Manifestation[],
): number {
  const merged: TeamData = {
    ...teamData,
    manifestations: [...teamData.manifestations, ...relics],
  };
  const context = createManifestationApplyContext(
    teamData.awakeners,
    damageDealerAwakenerIds,
    new Map(),
    teamData.realms,
    teamData.manifestations,
  );
  return computeTotalDamage(
    computeReviewTagTotals(merged, context).totalsByTagId,
    merged.tagsById,
  ).total;
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
  const eligible = relicCatalog.filter((entry) => entry.isDamage);

  const ranking = computeRelicRanking({
    teamData,
    damageDealerAwakenerIds,
    relicCatalog,
    selectedRelicIds: [],
    inputs,
  });

  const expectedBaseline = fullTotal(teamData, damageDealerAwakenerIds, []);
  assert(
    ranking.baselineTotal === expectedBaseline,
    `baseline ${ranking.baselineTotal} === unfiltered ${expectedBaseline}`,
  );

  let checked = 0;
  for (const row of ranking.ranked) {
    const rows = buildRelicManifestations(row.entry, inputs);
    const expected = fullTotal(teamData, damageDealerAwakenerIds, rows);
    assert(
      row.total === expected,
      `relic ${row.entry.name}: ranking ${row.total} === unfiltered ${expected}`,
    );
    checked += 1;
  }

  assert(
    ranking.eligible.length <= eligible.length,
    `eligible ${ranking.eligible.length} <= unfiltered ${eligible.length}`,
  );
  console.log(
    `Real-data parity OK: baseline=${ranking.baselineTotal}, relics=${checked}/${eligible.length}, realm-eligible=${ranking.eligible.length}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
