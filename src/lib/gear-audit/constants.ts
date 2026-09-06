/** Shared helpers for gear audit export + deterministic checks. */

import type { GearAuditKind } from "./finding-schema";

export const SKEYDB_REPO = "dansa/SKeyDB";
export const COMMIT_RE = /^[0-9a-f]{7,40}$/i;

export function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const GEAR_AUDIT_KIND_CONFIG: Record<
  GearAuditKind,
  {
    catalogPath: string;
    recordsDir: string;
    recordIdPrefix: string;
    parentTable: string;
    manifestationTable: string;
    parentFk: string;
  }
> = {
  wheel: {
    catalogPath: "src/data/public-v3/catalogs/wheels.json",
    recordsDir: "src/data/public-v3/records/wheels",
    recordIdPrefix: "wheel-",
    parentTable: "wheel",
    manifestationTable: "wheel_tag_manifestation",
    parentFk: "wheel_id",
  },
  covenant: {
    catalogPath: "src/data/public-v3/catalogs/covenants.json",
    recordsDir: "src/data/public-v3/records/covenants",
    recordIdPrefix: "covenant-",
    parentTable: "covenant",
    manifestationTable: "covenant_tag_manifestation",
    parentFk: "covenant_id",
  },
  posse: {
    catalogPath: "src/data/public-v3/catalogs/posses.json",
    recordsDir: "src/data/public-v3/records/posses",
    recordIdPrefix: "posse-",
    parentTable: "posse",
    manifestationTable: "posse_tag_manifestation",
    parentFk: "posse_id",
  },
};

export async function fetchLatestSkeydbMainSha(): Promise<string> {
  const url = `https://api.github.com/repos/${SKEYDB_REPO}/commits/main`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "MotherTree-gear-audit",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch latest SKeyDB commit: ${response.status} ${response.statusText}`,
    );
  }
  const body = (await response.json()) as { sha?: string };
  if (!body.sha || !COMMIT_RE.test(body.sha)) {
    throw new Error("GitHub API response missing a valid commit sha");
  }
  return body.sha;
}

export async function fetchSkeydbJson<T>(
  sha: string,
  relativePath: string,
): Promise<T> {
  const url = `https://raw.githubusercontent.com/${SKEYDB_REPO}/${sha}/${relativePath}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

/** SKeyDB mainstatKey → MotherTree all_stats enum (lowercase). */
export const SKEYDB_MAINSTAT_TO_ALL_STATS: Record<string, string> = {
  CON: "con",
  ATK: "atk",
  DEF: "def",
  KEYFLARE_REGEN: "keyflare_regen",
  DAMAGE_AMP: "damage_amp",
  CRIT_RATE: "crit_rate",
  CRIT_DMG: "crit_dmg",
  REALM_MASTERY: "realm_mastery",
  ALIEMUS_REGEN: "aliemus_regen",
  SIGIL_YIELD: "sigil_yield",
  DEATH_RESIST: "death_resist",
};

export function mapSkeydbMainstat(key: string | undefined | null): string | null {
  if (!key) return null;
  return SKEYDB_MAINSTAT_TO_ALL_STATS[key.toUpperCase()] ?? null;
}

export type SkeydbDescriptionArg = {
  kind?: string;
  values?: string[];
  value?: string;
  suffix?: string;
  stat?: string;
};

export type SkeydbSetEffect = {
  set?: number;
  descriptionTemplate?: string;
  descriptionArgs?: Record<string, SkeydbDescriptionArg>;
};

export type SkeydbGearRecord = {
  id: string;
  name: string;
  kind?: string;
  rarity?: string;
  realm?: string;
  mainstatKey?: string;
  descriptionTemplate?: string;
  descriptionArgs?: Record<string, SkeydbDescriptionArg>;
  setEffects?: SkeydbSetEffect[];
};

export type SkeydbCatalogRecord = {
  id: string;
  name: string;
  kind?: string;
  rarity?: string;
  mainstatKey?: string;
  realm?: string;
};

export type SkeydbCatalogFile = {
  records: SkeydbCatalogRecord[];
};

/** Max enlightenment tiers implied by scaling args (wheel graded lines). */
export function countScalingTiers(record: SkeydbGearRecord): number {
  let max = 0;
  const args = record.descriptionArgs ?? {};
  for (const arg of Object.values(args)) {
    if (arg.kind === "scaling" && Array.isArray(arg.values)) {
      max = Math.max(max, arg.values.length);
    }
  }
  return max;
}

export function recordHasEffectText(record: SkeydbGearRecord): boolean {
  if (record.descriptionTemplate?.trim()) return true;
  if (record.setEffects?.some((e) => e.descriptionTemplate?.trim())) return true;
  return false;
}

export function countCovenantSetEffects(record: SkeydbGearRecord): number {
  return record.setEffects?.length ?? 0;
}
