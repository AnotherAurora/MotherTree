/** Explicit slug overrides matching SKeyDB `awakener-assets.ts`. */
const explicitSlugByAwakenerName: Record<string, string> = {
  "24": "mason",
  jenkins: "jenkin",
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
 * Normalize an awakener display name to the SKeyDB asset filename slug
 * (without extension), e.g. `"24"` → `mason`, `Helot: Catena` → `helot-catena`.
 */
export function toAwakenerAssetSlug(name: string): string {
  const normalizedName = name.trim().toLowerCase().replace(/^["']|["']$/g, "");
  const explicit = explicitSlugByAwakenerName[normalizedName];
  if (explicit) {
    return explicit;
  }

  return trimEdgeDashes(
    normalizedName
      .replace(/['"]/g, "")
      .replace(/[:\s]+/g, "-")
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-"),
  );
}
