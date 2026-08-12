import type { SearchFromValue } from "@/lib/public/search-filter-options";

const SKEYDB_SITE = "https://skeydb.com";

const COLLECTION_BY_KIND: Record<SearchFromValue, string> = {
  awakener: "awakeners",
  wheel: "wheels",
  posse: "posses",
  covenant: "covenants",
};

function trimEdgeDashes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === "-") {
    start += 1;
  }
  while (end > start && value[end - 1] === "-") {
    end -= 1;
  }
  return value.slice(start, end);
}

/**
 * Kebab-case slug for SKeyDB entity pages (not asset filenames).
 * Keeps display names like `"24"` as `24` (no asset overrides).
 */
export function toSkeydbPageSlug(name: string): string {
  const normalizedName = name.trim().toLowerCase().replace(/^["']|["']$/g, "");
  return trimEdgeDashes(
    normalizedName
      .replace(/['"]/g, "")
      .replace(/[:\s]+/g, "-")
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-"),
  );
}

/** SKeyDB site URL for an entity, or undefined when name is empty / dash. */
export function resolveSkeydbPageUrl(
  kind: SearchFromValue,
  name: string,
): string | undefined {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "—") return undefined;
  const slug = toSkeydbPageSlug(trimmed);
  if (!slug) return undefined;
  return `${SKEYDB_SITE}/database/${COLLECTION_BY_KIND[kind]}/${slug}`;
}
