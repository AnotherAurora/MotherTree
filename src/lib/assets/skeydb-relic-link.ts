import relicSkeydbLinks from "@/lib/assets/maps/relic-skeydb-links.json";

/** Public SKeyDB site root (the deep-link page, not the raw asset host). */
export const SKEYDB_SITE_BASE = "https://skeydb.com";

type RelicSkeydbLink = {
  slug: string;
  category: string;
  /** Variant tier (`Gold` / `Cursed`) → `relic-variant-####`. */
  variants: Record<string, string>;
};

const links = relicSkeydbLinks as Record<string, RelicSkeydbLink>;

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Deep link to a relic's SKeyDB page for the variant MotherTree models.
 * Keyed by `relic.name`; `tier` comes from `relic.tier` (`Gold` / `Cursed`).
 * Returns undefined when the relic or tier is not mapped.
 */
export function resolveSkeydbRelicUrl(
  name: string,
  tier: string,
): string | undefined {
  const entry = links[normalizeNameKey(name)];
  if (!entry) return undefined;
  const variant = entry.variants[tier];
  if (!variant) return undefined;
  const params = new URLSearchParams({
    category: entry.category,
    variant,
  });
  return `${SKEYDB_SITE_BASE}/database/relics/${entry.slug}?${params.toString()}`;
}
