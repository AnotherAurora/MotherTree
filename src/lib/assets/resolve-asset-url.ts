import { toAwakenerAssetSlug } from "@/lib/assets/awakener-slug";
import { assetUrl } from "@/lib/assets/skeydb-base";
import covenantByName from "@/lib/assets/maps/covenant-by-name.json";
import posseByName from "@/lib/assets/maps/posse-by-name.json";
import wheelByName from "@/lib/assets/maps/wheel-by-name.json";

export type AssetKind =
  | "awakener"
  | "realm"
  | "wheel"
  | "covenant"
  | "posse"
  | "stat";
export type AssetVariant = "portrait" | "card" | "icon" | "mini";

const REALM_BASES = new Set(["chaos", "caro", "aequor", "ultra"]);

/** MotherTree `all_stats` → SKeyDB `UI_Battle_White_Buff_` iconId. */
const STAT_ICON_ID_BY_KEY: Record<string, string> = {
  sigil_yield: "001",
  realm_mastery: "002",
  aliemus_regen: "003",
  damage_amp: "004",
  keyflare_regen: "005",
  death_resist: "006",
  crit_dmg: "007",
  crit_rate: "008",
  def: "009",
  atk: "010",
  con: "011",
};

const wheelMap = wheelByName as Record<string, string>;
const covenantMap = covenantByName as Record<string, string>;
const posseMap = posseByName as Record<string, string>;

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Map realm display names (including variants) to faction asset base. */
export function toRealmAssetBase(name: string): string | undefined {
  const normalized = normalizeNameKey(name);
  if (REALM_BASES.has(normalized)) {
    return normalized;
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const token = tokens[i]!;
    if (REALM_BASES.has(token)) {
      return token;
    }
  }

  return undefined;
}

function defaultVariant(kind: AssetKind): AssetVariant {
  switch (kind) {
    case "awakener":
      return "portrait";
    case "wheel":
      return "mini";
    case "realm":
    case "covenant":
    case "posse":
    case "stat":
      return "icon";
  }
}

/**
 * Resolve a remote SKeyDB asset URL for a MotherTree entity display name.
 * Returns undefined when the name cannot be mapped.
 */
export function resolveSkeydbAssetUrl(
  kind: AssetKind,
  name: string,
  variant?: AssetVariant,
): string | undefined {
  const effective = variant ?? defaultVariant(kind);

  switch (kind) {
    case "awakener": {
      const slug = toAwakenerAssetSlug(name);
      if (!slug) return undefined;
      if (effective === "card") {
        return assetUrl(`awk-cards/${slug}.webp`);
      }
      return assetUrl(`awk-portraits/${slug}.webp`);
    }
    case "realm": {
      const base = toRealmAssetBase(name);
      if (!base) return undefined;
      return assetUrl(`factions/${base}.webp`);
    }
    case "wheel": {
      const fullId = wheelMap[normalizeNameKey(name)];
      if (!fullId) return undefined;
      if (effective === "icon" || effective === "card") {
        return assetUrl(`wheels/${fullId}.webp`);
      }
      const miniId = fullId.replace(/^Weapon_Full_/, "Weapon_Mini_");
      return assetUrl(`wheels/Mini/${miniId}.webp`);
    }
    case "covenant": {
      const assetId = covenantMap[normalizeNameKey(name)];
      if (!assetId) return undefined;
      return assetUrl(`covenants/Icon/${assetId}.webp`);
    }
    case "posse": {
      const assetId = posseMap[normalizeNameKey(name)];
      if (!assetId) return undefined;
      return assetUrl(`posse/Icon/${assetId}.webp`);
    }
    case "stat": {
      const iconId = STAT_ICON_ID_BY_KEY[normalizeNameKey(name)];
      if (!iconId) return undefined;
      return assetUrl(`icons/UI_Battle_White_Buff_${iconId}.webp`);
    }
  }
}
