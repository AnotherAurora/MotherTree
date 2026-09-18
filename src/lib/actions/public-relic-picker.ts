"use server";

import { headers } from "next/headers";
import type { ActionResult } from "@/lib/actions/crud";
import { fetchAllPublicTable } from "@/lib/public-read/fetch";
import type { PublicReadTable, PublicRow } from "@/lib/public-read/allowlist";
import { checkPublicRateLimit } from "@/lib/public-read/rate-limit";
import {
  buildPublicRelicCatalog,
  buildPublicTeamData,
  type PublicTeamCatalog,
  type PublicTeamSelection,
} from "@/lib/public/relic-picker-data";
import type { RelicCatalogEntry } from "@/lib/path-carver/relic-manifestations";
import { buildMotherTreeNameMaps, importIngameTeamFromCode } from "@/lib/team-import";
import type { ImportTeamResult } from "@/lib/team-import";
import type { TeamData } from "@/lib/team-data/types";

/** Interactive tool: allow a generous per-IP budget on top of in-process caching. */
const RELIC_PICKER_RATE_LIMIT_PER_MINUTE = 240;

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

async function guardRateLimit(): Promise<void> {
  const rate = checkPublicRateLimit(
    await clientIpKey(),
    RELIC_PICKER_RATE_LIMIT_PER_MINUTE,
  );
  if (!rate.ok) {
    throw new Error(
      `Rate limit exceeded. Retry in ${Math.ceil(rate.retryAfterMs / 1000)}s`,
    );
  }
}

async function loadTable<T extends PublicReadTable>(
  table: T,
): Promise<PublicRow<T>[]> {
  const result = await fetchAllPublicTable(table);
  if (!result.success) {
    throw new Error(`Failed to load ${table}: ${result.error}`);
  }
  return result.data;
}

/**
 * Fetch every allowlisted catalog table via anon reads (in-process cached) and
 * assemble the shapes the Relic Picker needs. Shared by the team-data and import
 * actions.
 */
async function loadPublicCatalog(): Promise<PublicTeamCatalog> {
  const [
    awakeners,
    awakenersManifestations,
    awakenersLocalInteractions,
    wheels,
    wheelManifestations,
    covenants,
    covenantManifestations,
    covenantStatSets,
    posses,
    posseManifestations,
    realms,
    realmManifestations,
    tags,
    defaultInteractions,
    copyProviderMembers,
    relics,
    relicManifestations,
  ] = await Promise.all([
    loadTable("awakener"),
    loadTable("awakener_tag_manifestation"),
    loadTable("awakener_local_manifestation_interaction"),
    loadTable("wheel"),
    loadTable("wheel_tag_manifestation"),
    loadTable("covenant"),
    loadTable("covenant_tag_manifestation"),
    loadTable("covenant_stat_set"),
    loadTable("posse"),
    loadTable("posse_tag_manifestation"),
    loadTable("realm"),
    loadTable("realm_tag_manifestation"),
    loadTable("tag"),
    loadTable("tag_default_interaction"),
    loadTable("copy_provider_group_member"),
    loadTable("relic"),
    loadTable("relic_tag_manifestation"),
  ]);

  return {
    awakeners,
    awakenersManifestations,
    awakenersLocalInteractions,
    wheels,
    wheelManifestations,
    covenants,
    covenantManifestations,
    covenantStatSets,
    posses,
    posseManifestations,
    realms,
    realmManifestations,
    tags,
    defaultInteractions,
    copyProviderMembers,
    relics,
    relicManifestations,
  };
}

export type RelicPickerTeamBundle = {
  teamData: TeamData;
  relicCatalog: RelicCatalogEntry[];
};

/**
 * Public team-data loader. The returned `TeamData` excludes relics; the client
 * injects candidate relics and runs the Path Carver totals locally.
 */
export async function loadPublicRelicPickerTeamData(
  selection: PublicTeamSelection,
): Promise<ActionResult<RelicPickerTeamBundle>> {
  try {
    await guardRateLimit();
    const catalog = await loadPublicCatalog();
    return {
      success: true,
      data: {
        teamData: buildPublicTeamData(selection, catalog),
        relicCatalog: buildPublicRelicCatalog(catalog),
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load relic picker team data",
    };
  }
}

/** Public in-game team import (no admin runtime required). */
export async function importTeamCodePublic(
  code: string,
): Promise<ActionResult<ImportTeamResult>> {
  try {
    await guardRateLimit();
    const catalog = await loadPublicCatalog();
    const gearOptions = {
      posse: catalog.posses.map((p) => ({ value: p.id, label: p.name ?? `#${p.id}` })),
      wheel: catalog.wheels.map((w) => ({ value: w.id, label: w.name ?? `#${w.id}` })),
      covenant: catalog.covenants.map((c) => ({
        value: c.id,
        label: c.name ?? `#${c.id}`,
      })),
    };
    const nameMaps = buildMotherTreeNameMaps({
      awakeners: catalog.awakeners.map((a) => ({
        value: a.id,
        label: a.name ?? `#${a.id}`,
      })),
      wheels: gearOptions.wheel,
      covenants: gearOptions.covenant,
      posses: gearOptions.posse,
    });
    const result = await importIngameTeamFromCode(code, nameMaps);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to import team code",
    };
  }
}
