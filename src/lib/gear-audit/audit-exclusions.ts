import type { GearAuditKind } from "./finding-schema";
import { normalizeNameKey } from "./constants";

/** Posse parents intentionally omitted from MotherTree (SKeyDB-only). */
export const POSSE_SKIP_NAME_PREFIXES = ["primordial memory:"] as const;

/** Wheel rarities not modeled in manifestation tables yet. */
export const WHEEL_SKIP_RARITIES = new Set(["N", "R"]);

/** Named wheels skipped from audit findings (intentional gaps). */
export const WHEEL_SKIP_NAMES: ReadonlySet<string> = new Set(
  [
    "School Day",
    "Dear Papa Noel",
    "Stakes of Wisdom",
    "To the Stars",
    "Dreaming of Wonderland",
  ].map(normalizeNameKey),
);

export function isPosseParentSkipped(name: string): boolean {
  const key = normalizeNameKey(name);
  return POSSE_SKIP_NAME_PREFIXES.some(
    (prefix) => key === prefix || key.startsWith(prefix),
  );
}

export function isWheelParentSkipped(
  name: string,
  rarity: string | null | undefined,
): boolean {
  const key = normalizeNameKey(name);
  if (WHEEL_SKIP_NAMES.has(key)) return true;
  if (rarity != null && WHEEL_SKIP_RARITIES.has(rarity)) return true;
  return false;
}

export function shouldSkipParentAudit(
  kind: GearAuditKind,
  name: string,
  options?: { rarity?: string | null },
): boolean {
  switch (kind) {
    case "posse":
      return isPosseParentSkipped(name);
    case "wheel":
      return isWheelParentSkipped(name, options?.rarity);
    case "covenant":
      return false;
  }
}
